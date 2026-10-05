import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { pdf } from '@react-pdf/renderer'
import { generatePilotoContent, regeneratePilotoContent } from '../ai/generatePiloto'
import { PilotoBrandFields } from '../components/PilotoBrandFields'
import type { PilotoBrand } from '../components/PilotoBrandFields'
import { PilotoContentEditor } from '../components/PilotoContentEditor'
import type { PilotoTextSection } from '../components/PilotoContentEditor'
import { getPilotoSlideIndex } from '../components/piloto'
import { SlidePreview } from '../components/piloto/SlidePreview'
import { ProposalPdfPagedPreview } from '../components/ProposalPdfPagedPreview'
import { ProposalStatusSelector } from '../components/ProposalStatusSelector'
import { Button, DownloadIcon, Input, Spinner, Switch, Textarea } from '../components/ui'
import { formatCurrencyBRL, maskCurrencyBRLInput, parseCurrencyBRL } from '../lib/currencyBRL'
import { sanitizeFilename } from '../lib/filename'
import {
  DEFAULT_INSTALLMENT_FEE_RATE,
  calcInstallments,
  completoSavingsCents,
  dealSavingsCents,
  getContinuationPlans,
  getPilotoPlans,
} from '../lib/pilotoPricing'
import type { ContinuationPlanId, PilotoPricing } from '../lib/pilotoPricing'
import { cn } from '../lib/cn'
import { PilotoPdfDocument, PILOTO_PDF_LAYOUT_REVISION } from '../pdf/PilotoPdfDocument'
import { getProposalDefaults, saveProposalDefaults } from '../services/proposalDefaults'
import { getColdCall, updateColdCall } from '../services/coldCalls'
import { createPiloto, getPiloto, updatePiloto, updatePilotoStatus } from '../services/pilotos'
import type { PilotoAiContent, PilotoInput, SituationAnswer } from '../types/piloto'
import {
  EMPTY_PILOTO_AI_CONTENT,
  applyBrandDefaults,
  normalizePilotoAiContent,
  normalizePilotoInput,
} from '../types/piloto'
import type { ProposalDefaults, ProposalStatus } from '../types/proposalDoc'
import {
  DEFAULT_ACCENT_COLOR,
  accentColorRgbChannels,
  accentForegroundColor,
  normalizeAccentColor,
} from '../types/proposalDoc'

const SITUATION_OPTIONS: { value: SituationAnswer; label: string }[] = [
  { value: 'sim', label: 'Sim' },
  { value: 'nao', label: 'Não' },
  { value: 'nao_sei', label: 'Não sei' },
]

const SITUATION_QUESTIONS = [
  { key: 'hasWebsite' as const, label: 'Já tem site' },
  { key: 'runsAds' as const, label: 'Já anuncia' },
  { key: 'whatsappOrganized' as const, label: 'WhatsApp organizado' },
]

const AUTOSAVE_DELAY = 800

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error'
type PreviewTab = 'deck' | 'pdf'

function emptyInput(): PilotoInput {
  return normalizePilotoInput({
    accentColor: DEFAULT_ACCENT_COLOR,
    hasWebsite: 'nao_sei',
    runsAds: 'nao_sei',
    whatsappOrganized: 'nao_sei',
    installmentFeeRate: DEFAULT_INSTALLMENT_FEE_RATE,
    validityDays: 15,
  })
}

function feeRateToPercentDisplay(rate: number): string {
  return (rate * 100).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 })
}

function parsePercentToRate(value: string): number {
  const parsed = Number.parseFloat(value.trim().replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed / 100 : DEFAULT_INSTALLMENT_FEE_RATE
}

function isContentEmpty(content: PilotoAiContent): boolean {
  return (
    !content.diagnosisHeadline.trim() &&
    !content.funnelTopLabel.trim() &&
    !content.funnelMiddleLabel.trim() &&
    !content.funnelBottomLabel.trim() &&
    !content.closingParagraph.trim() &&
    !content.diagnosisLines.some((line) => line.trim()) &&
    !content.adAngles.some((angle) => angle.title.trim() || angle.description.trim()) &&
    !(content.chatMessages ?? []).some((message) => message.trim())
  )
}

function pickBrand(input: PilotoInput): PilotoBrand {
  return {
    companyName: input.companyName,
    professionalName: input.professionalName,
    logoDataUrl: input.logoDataUrl,
    markDataUrl: input.markDataUrl,
    markAnchor: input.markAnchor,
    markScale: input.markScale,
    websiteUrl: input.websiteUrl,
    accentColor: input.accentColor,
  }
}

function SaveStatus({ state }: { state: SaveState }) {
  const label: Record<SaveState, string> = {
    idle: '',
    pending: 'Alterações não salvas',
    saving: 'Salvando…',
    saved: 'Salvo',
    error: 'Erro ao salvar',
  }
  if (state === 'idle') {
    return null
  }
  return (
    <span
      className={cn(
        'text-xs font-medium normal-case',
        state === 'error' ? 'text-status-error' : 'text-muted-foreground',
      )}
      role="status"
    >
      {label[state]}
    </span>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={cn('h-4 w-4 shrink-0 text-muted-foreground', open && 'rotate-180')}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

/** Seção da coluna de edição: título + resumo no cabeçalho; recolhível quando pedido. */
function PanelSection({
  title,
  summary,
  collapsible = false,
  open = true,
  onToggle,
  children,
}: {
  title: string
  summary?: ReactNode
  collapsible?: boolean
  open?: boolean
  onToggle?: () => void
  children: ReactNode
}) {
  const header = (
    <div className="flex items-center gap-3">
      <p className="text-sm font-semibold normal-case text-foreground">{title}</p>
      {summary && (!collapsible || !open) ? (
        <div className="ml-auto flex min-w-0 items-center gap-2 text-xs normal-case text-muted-foreground">
          {summary}
        </div>
      ) : null}
      {collapsible ? (
        <span className={cn(!summary || open ? 'ml-auto' : '')}>
          <Chevron open={open} />
        </span>
      ) : null}
    </div>
  )

  return (
    <section className="border-t border-border px-6 py-5 first:border-t-0">
      {collapsible ? (
        <button type="button" onClick={onToggle} aria-expanded={open} className="w-full text-left">
          {header}
        </button>
      ) : (
        header
      )}
      {open ? <div className="mt-5">{children}</div> : null}
    </section>
  )
}

/** Valor em reais digitado estilo banco: os dois últimos dígitos são centavos. */
function MoneyRow({
  label,
  cents,
  onChange,
  error,
}: {
  label: string
  cents: number
  onChange: (cents: number) => void
  error?: string
}) {
  return (
    <div className="py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm normal-case text-foreground">{label}</span>
        <input
          aria-label={label}
          aria-invalid={error ? true : undefined}
          inputMode="numeric"
          value={cents > 0 ? formatCurrencyBRL(cents) : ''}
          placeholder="R$ 0,00"
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, '')
            onChange(digits ? Number.parseInt(digits, 10) : 0)
          }}
          className={cn(
            'h-9 w-36 shrink-0 bg-surface-2 px-3 text-right text-sm tabular-nums text-foreground outline-none transition-colors focus-visible:ring-1 focus-visible:ring-accent',
            error && 'ring-1 ring-status-error',
          )}
        />
      </div>
      {error ? <p className="mt-1.5 text-xs normal-case text-status-error">{error}</p> : null}
    </div>
  )
}

const CONTINUATION_LABELS: Record<ContinuationPlanId, string> = {
  site: 'Site',
  'site-whatsapp': 'Site + WhatsApp',
  completo: 'Completo',
}

export default function NewPiloto() {
  const { id: routeId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  const [pilotoId, setPilotoId] = useState<string | null>(routeId ?? null)
  const [status, setStatus] = useState<ProposalStatus>('ativo')
  const [input, setInput] = useState<PilotoInput>(emptyInput)
  const [content, setContent] = useState<PilotoAiContent>(EMPTY_PILOTO_AI_CONTENT)
  const [brandDefaults, setBrandDefaults] = useState<ProposalDefaults | null>(null)
  const [ticketDisplay, setTicketDisplay] = useState('')
  const [feePercentDisplay, setFeePercentDisplay] = useState(
    feeRateToPercentDisplay(DEFAULT_INSTALLMENT_FEE_RATE),
  )

  const [loadingDoc, setLoadingDoc] = useState(Boolean(routeId))
  const [notFound, setNotFound] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [creating, setCreating] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [actionError, setActionError] = useState('')
  const [actionNotice, setActionNotice] = useState('')
  const [adjustment, setAdjustment] = useState('')

  const [brandOpen, setBrandOpen] = useState(false)
  const [commercialOpen, setCommercialOpen] = useState(false)
  const [pricingOpen, setPricingOpen] = useState(false)
  const [openSection, setOpenSection] = useState<PilotoTextSection | null>(null)
  const [previewTab, setPreviewTab] = useState<PreviewTab>('deck')
  const [slideIndex, setSlideIndex] = useState(0)

  const pilotoIdRef = useRef<string | null>(routeId ?? null)
  const loadedIdRef = useRef<string | null>(null)
  const latestRef = useRef({ input, content })
  latestRef.current = { input, content }
  const skipAutosaveRef = useRef(true)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const brandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const accent = normalizeAccentColor(input.accentColor)
  const { pricing } = input
  const installments = useMemo(
    () => calcInstallments(pricing.agencyDealCents, input.installmentFeeRate),
    [pricing.agencyDealCents, input.installmentFeeRate],
  )
  const completoInstallments = useMemo(
    () => calcInstallments(pricing.completoDealCents, input.installmentFeeRate),
    [pricing.completoDealCents, input.installmentFeeRate],
  )
  const plans = useMemo(() => getPilotoPlans(pricing), [pricing])
  const savingsCents = dealSavingsCents(pricing)
  const completoSavings = completoSavingsCents(pricing)
  const completoPlan = plans.find((plan) => plan.id === 'completo') ?? plans[0]
  const singleChannelPlan = plans.find((plan) => plan.id !== 'completo') ?? plans[0]
  const contentEmpty = isContentEmpty(content)
  const showContinuation = brandDefaults?.pilotoShowContinuation === true
  const missing = [
    !input.leadCompanyName.trim() ? 'empresa' : null,
    !input.leadNiche.trim() ? 'nicho' : null,
  ].filter(Boolean)
  const canGenerate = missing.length === 0
  const busy = generating || regenerating || creating

  // A cor da marca vale para a página inteira, como na proposta.
  useLayoutEffect(() => {
    const root = document.documentElement
    const foreground = accentForegroundColor(accent)
    root.style.setProperty('--color-accent', accent)
    root.style.setProperty('--color-accent-rgb', accentColorRgbChannels(accent))
    root.style.setProperty('--color-accent-foreground', foreground)
    root.style.setProperty('--color-accent-foreground-rgb', accentColorRgbChannels(foreground))
    return () => {
      root.style.removeProperty('--color-accent')
      root.style.removeProperty('--color-accent-rgb')
      root.style.removeProperty('--color-accent-foreground')
      root.style.removeProperty('--color-accent-foreground-rgb')
    }
  }, [accent])

  useEffect(() => {
    pilotoIdRef.current = pilotoId
  }, [pilotoId])

  async function persistNow(): Promise<void> {
    const id = pilotoIdRef.current
    if (!id) {
      return
    }
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    setSaveState('saving')
    try {
      await updatePiloto(id, {
        input: normalizePilotoInput(latestRef.current.input),
        content: normalizePilotoAiContent(latestRef.current.content),
      })
      setSaveState('saved')
    } catch (error) {
      console.error('[NewPiloto] autosave', error)
      setSaveState('error')
    }
  }

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current)
      }
      if (brandTimerRef.current) {
        clearTimeout(brandTimerRef.current)
      }
      // Sai da página com alteração pendente: salva antes.
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        void persistNow()
      }
    }
    // persistNow só lê refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      // Acabou de criar o piloto e trocou a URL: os dados já estão na tela.
      if (routeId && routeId === loadedIdRef.current) {
        return
      }
      try {
        if (routeId) {
          setLoadingDoc(true)
          const [doc, defaults] = await Promise.all([getPiloto(routeId), getProposalDefaults()])
          if (cancelled) {
            return
          }
          if (!doc) {
            setNotFound(true)
            return
          }
          loadedIdRef.current = doc.id
          skipAutosaveRef.current = true
          setBrandDefaults(defaults)
          setPilotoId(doc.id)
          setStatus(doc.status)
          setInput(applyBrandDefaults(doc.input, defaults))
          setContent(doc.content)
          setTicketDisplay(doc.input.ticketCents > 0 ? formatCurrencyBRL(doc.input.ticketCents) : '')
          setFeePercentDisplay(feeRateToPercentDisplay(doc.input.installmentFeeRate))
          setBrandOpen(!defaults.logoDataUrl)
          setSaveState('saved')
          return
        }

        const defaults = await getProposalDefaults()
        if (cancelled) {
          return
        }
        setBrandDefaults(defaults)
        // Vindo da ligação fria: empresa, nicho e cidade já preenchidos.
        const prefill = (location.state as { prefill?: Partial<PilotoInput> } | null)?.prefill ?? {}
        setInput((current) =>
          applyBrandDefaults(
            normalizePilotoInput({ ...current, ...prefill, accentColor: normalizeAccentColor(defaults.accentColor) }),
            defaults,
          ),
        )
        setBrandOpen(!defaults.logoDataUrl)
      } catch (error) {
        console.error('[NewPiloto] load', error)
        if (!cancelled) {
          setActionError(error instanceof Error ? error.message : 'Erro ao carregar')
        }
      } finally {
        if (!cancelled) {
          setLoadingDoc(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [routeId])

  // Salvamento automático depois que o piloto existe.
  useEffect(() => {
    if (loadingDoc || !pilotoId) {
      return
    }
    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false
      return
    }
    setSaveState('pending')
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      void persistNow()
    }, AUTOSAVE_DELAY)
    // persistNow só lê refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, content, pilotoId, loadingDoc])

  function showNotice(message: string) {
    setActionNotice(message)
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current)
    }
    noticeTimerRef.current = setTimeout(() => {
      setActionNotice('')
      noticeTimerRef.current = null
    }, 4000)
  }

  function patchInput(partial: Partial<PilotoInput>) {
    setInput((current) => normalizePilotoInput({ ...current, ...partial }))
  }

  function patchPricing(partial: Partial<PilotoPricing>) {
    setInput((current) => normalizePilotoInput({ ...current, pricing: { ...current.pricing, ...partial } }))
  }

  /** Marca muda no piloto e nos dados fixos (os mesmos da proposta). */
  function updateBrand(partial: Partial<PilotoBrand>) {
    patchInput(partial)
    if (!brandDefaults) {
      return
    }
    const next = { ...brandDefaults, ...partial }
    setBrandDefaults(next)
    if (brandTimerRef.current) {
      clearTimeout(brandTimerRef.current)
    }
    brandTimerRef.current = setTimeout(() => {
      void saveProposalDefaults(next).catch((error) => {
        console.error('[NewPiloto] saveProposalDefaults', error)
      })
    }, 600)
  }

  function setShowContinuation(checked: boolean) {
    if (!brandDefaults) {
      return
    }
    const next = { ...brandDefaults, pilotoShowContinuation: checked }
    setBrandDefaults(next)
    void saveProposalDefaults(next).catch((error) => {
      console.error('[NewPiloto] saveProposalDefaults continuation', error)
    })
  }

  /** Cria o documento na primeira vez; depois disso o salvamento é automático. */
  async function ensureCreated(nextContent: PilotoAiContent): Promise<string> {
    if (pilotoIdRef.current) {
      return pilotoIdRef.current
    }
    const id = await createPiloto(normalizePilotoInput(input), normalizePilotoAiContent(nextContent))
    skipAutosaveRef.current = true
    loadedIdRef.current = id
    pilotoIdRef.current = id
    setPilotoId(id)
    setSaveState('saved')
    // Vindo da ligação fria: amarra o piloto à reunião na Agenda.
    const coldCallId = (location.state as { coldCallId?: string } | null)?.coldCallId
    if (coldCallId) {
      void getColdCall(coldCallId)
        .then((doc) => {
          if (!doc) return
          return updateColdCall(coldCallId, {
            ...doc,
            notes: { ...doc.notes, pilotoId: id },
            done: doc.done.includes('piloto') ? doc.done : [...doc.done, 'piloto'],
          })
        })
        .catch((error) => console.error('[NewPiloto] link coldCall', error))
    }
    navigate(`/piloto/${id}`, { replace: true })
    return id
  }

  function openTextSection(section: PilotoTextSection | null) {
    setOpenSection(section)
    if (section) {
      setPreviewTab('deck')
      setSlideIndex(getPilotoSlideIndex(section, showContinuation))
    }
  }

  async function handleGenerate() {
    if (!canGenerate || busy) {
      return
    }
    setGenerating(true)
    setActionError('')
    setActionNotice('')
    try {
      const next = await generatePilotoContent(input)
      setContent(next)
      await ensureCreated(next)
      openTextSection('diagnostico')
      showNotice('Textos gerados. Revise cada bloco abaixo.')
    } catch (error) {
      console.error('[NewPiloto] generate', error)
      setActionError(error instanceof Error ? error.message : 'Erro ao gerar textos')
    } finally {
      setGenerating(false)
    }
  }

  async function handleRegenerate() {
    if (!adjustment.trim() || busy) {
      return
    }
    setRegenerating(true)
    setActionError('')
    setActionNotice('')
    try {
      const next = await regeneratePilotoContent(input, content, adjustment.trim())
      setContent(next)
      setAdjustment('')
      showNotice('Ajuste aplicado.')
    } catch (error) {
      console.error('[NewPiloto] regenerate', error)
      setActionError(error instanceof Error ? error.message : 'Erro ao ajustar textos')
    } finally {
      setRegenerating(false)
    }
  }

  async function handleCreateDraft() {
    if (busy) {
      return
    }
    setCreating(true)
    setActionError('')
    try {
      await ensureCreated(content)
    } catch (error) {
      console.error('[NewPiloto] create', error)
      setActionError(error instanceof Error ? error.message : 'Erro ao salvar')
    } finally {
      setCreating(false)
    }
  }

  async function handlePresent() {
    if (busy) {
      return
    }
    setActionError('')
    try {
      setCreating(!pilotoIdRef.current)
      const id = await ensureCreated(content)
      await persistNow()
      navigate(`/piloto/${id}/apresentar`)
    } catch (error) {
      console.error('[NewPiloto] present', error)
      setActionError(error instanceof Error ? error.message : 'Erro ao abrir a apresentação')
    } finally {
      setCreating(false)
    }
  }

  async function handleDownload() {
    if (downloading) {
      return
    }
    setDownloading(true)
    setActionError('')
    try {
      const blob = await pdf(
        <PilotoPdfDocument input={input} content={content} showContinuation={showContinuation} />,
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `Piloto 45 - ${sanitizeFilename(input.leadCompanyName || 'apresentacao')}.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('[NewPiloto] download', error)
      setActionError(error instanceof Error ? error.message : 'Erro ao baixar PDF')
    } finally {
      setDownloading(false)
    }
  }

  if (loadingDoc) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-lg font-semibold text-foreground">Apresentação não encontrada</p>
        <Link to="/?tab=pilotos" className="text-sm text-muted-foreground underline">
          Voltar para Piloto 45
        </Link>
      </div>
    )
  }

  const generateLine = !canGenerate
    ? `Falta preencher ${missing.join(' e ')} para gerar os textos.`
    : contentEmpty
      ? 'A IA escreve o diagnóstico, o caminho do cliente, as ideias dos vídeos, uma conversa de exemplo e o encerramento.'
      : 'Gerar de novo troca todos os textos atuais por novos.'

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <Link
              to="/?tab=pilotos"
              className="text-xs font-bold uppercase tracking-tight text-muted-foreground transition-colors hover:text-accent"
            >
              ← Voltar
            </Link>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              Piloto <span className="text-accent">45</span>
              {input.leadCompanyName.trim() ? (
                <span className="ml-3 text-base font-medium text-muted-foreground">
                  {input.leadCompanyName.trim()}
                </span>
              ) : null}
            </h1>
          </div>
          {pilotoId ? (
            <ProposalStatusSelector
              proposalId={pilotoId}
              status={status}
              onStatusChange={setStatus}
              updateStatus={updatePilotoStatus}
            />
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <main className="flex flex-col gap-8 lg:flex-row lg:items-start">
          {/* Coluna de edição */}
          <aside className="w-full shrink-0 border border-border bg-surface lg:w-[440px]">
            <PanelSection
              title="Sua marca"
              collapsible
              open={brandOpen}
              onToggle={() => setBrandOpen((value) => !value)}
              summary={
                <>
                  {input.logoDataUrl ? (
                    <span className="flex h-6 items-center bg-[#0B0B0B] px-1.5">
                      <img src={input.logoDataUrl} alt="" className="h-4 w-auto object-contain" />
                    </span>
                  ) : (
                    <span>Sem logo</span>
                  )}
                  <span className="truncate">{input.companyName || 'Sem nome'}</span>
                  <span className="h-3.5 w-3.5 shrink-0 border border-border" style={{ backgroundColor: accent }} />
                </>
              }
            >
              <PilotoBrandFields brand={pickBrand(input)} onChange={updateBrand} />
            </PanelSection>

            <PanelSection title="Lead">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Empresa"
                    value={input.leadCompanyName}
                    onChange={(event) => patchInput({ leadCompanyName: event.target.value })}
                    error={!input.leadCompanyName.trim() && !contentEmpty ? 'Obrigatório' : undefined}
                  />
                  <Input
                    label="Nicho"
                    value={input.leadNiche}
                    onChange={(event) => patchInput({ leadNiche: event.target.value })}
                    placeholder="Ex.: odontologia"
                  />
                  <Input
                    label="Cidade"
                    value={input.leadCity}
                    onChange={(event) => patchInput({ leadCity: event.target.value })}
                  />
                  <Input
                    label="Ticket médio"
                    value={ticketDisplay}
                    inputMode="numeric"
                    className="tabular-nums"
                    onChange={(event) => {
                      const masked = maskCurrencyBRLInput(event.target.value)
                      setTicketDisplay(masked)
                      patchInput({ ticketCents: parseCurrencyBRL(masked) })
                    }}
                  />
                </div>
                <Textarea
                  label="O que a empresa vende"
                  value={input.leadOffer}
                  rows={2}
                  className="!min-h-0"
                  onChange={(event) => patchInput({ leadOffer: event.target.value })}
                />

                <div>
                  <p className="kinetic-label mb-1">Situação hoje</p>
                  <div className="divide-y divide-border">
                    {SITUATION_QUESTIONS.map((question) => (
                      <div key={question.key} className="flex items-center justify-between gap-3 py-2.5">
                        <span className="text-sm normal-case text-foreground">{question.label}</span>
                        <div className="flex" role="group" aria-label={question.label}>
                          {SITUATION_OPTIONS.map((option) => {
                            const active = input[question.key] === option.value
                            return (
                              <button
                                key={option.value}
                                type="button"
                                aria-pressed={active}
                                onClick={() => patchInput({ [question.key]: option.value })}
                                className={cn(
                                  'h-8 whitespace-nowrap px-3 text-xs font-medium normal-case transition-colors',
                                  active
                                    ? 'bg-accent text-accent-foreground'
                                    : 'bg-surface-2 text-muted-foreground hover:text-foreground',
                                )}
                              >
                                {option.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Textarea
                  label="O que você descobriu na conversa"
                  value={input.contextNotes}
                  rows={3}
                  className="!min-h-0"
                  placeholder="Concorrência, época forte, o que já tentaram, o que mais perguntam."
                  onChange={(event) => patchInput({ contextNotes: event.target.value })}
                />
              </div>
            </PanelSection>

            <PanelSection
              title="Orçamento"
              collapsible
              open={pricingOpen}
              onToggle={() => setPricingOpen((value) => !value)}
              summary={
                <span className="tabular-nums">
                  Completo {formatCurrencyBRL(completoPlan.totalCents)}
                  {completoSavings > 0 ? ` · desconto ${formatCurrencyBRL(completoSavings)}` : ''}
                </span>
              }
            >
              <div className="divide-y divide-border">
                <MoneyRow
                  label="Instagram ou Google sem desconto"
                  cents={pricing.agencyListCents}
                  onChange={(cents) => patchPricing({ agencyListCents: cents })}
                  error={
                    pricing.agencyListCents > 0 && savingsCents === 0
                      ? 'Precisa ser maior que o valor na reunião. Sem diferença, o roteiro não fala de desconto.'
                      : undefined
                  }
                />
                <MoneyRow
                  label="Instagram ou Google na reunião"
                  cents={pricing.agencyDealCents}
                  onChange={(cents) => patchPricing({ agencyDealCents: cents })}
                />
                <MoneyRow
                  label="Completo sem desconto"
                  cents={pricing.completoListCents}
                  onChange={(cents) => patchPricing({ completoListCents: cents })}
                  error={
                    pricing.completoListCents > 0 && completoSavings === 0
                      ? 'Precisa ser maior que o valor na reunião. Sem diferença, o roteiro não fala de desconto.'
                      : undefined
                  }
                />
                <MoneyRow
                  label="Completo na reunião"
                  cents={pricing.completoDealCents}
                  onChange={(cents) => patchPricing({ completoDealCents: cents })}
                />
                <MoneyRow
                  label="Verba de anúncio por canal"
                  cents={pricing.adBudgetPerChannelCents}
                  onChange={(cents) => patchPricing({ adBudgetPerChannelCents: cents })}
                />
              </div>
              <p className="mt-2 text-xs normal-case text-muted-foreground tabular-nums">
                Total com anúncios: Instagram ou Google {formatCurrencyBRL(singleChannelPlan.totalCents)} · Completo{' '}
                {formatCurrencyBRL(completoPlan.totalCents)}. Vale nos slides, no PDF e no roteiro.
              </p>

              <p className="mt-5 text-sm font-semibold normal-case text-foreground">Planos recorrentes, por mês</p>
              <div className="mt-1 divide-y divide-border">
                {getContinuationPlans(pricing).map((plan) => (
                  <MoneyRow
                    key={plan.id}
                    label={CONTINUATION_LABELS[plan.id]}
                    cents={plan.monthlyCents}
                    onChange={(cents) =>
                      patchPricing({
                        continuationMonthlyCents: { ...pricing.continuationMonthlyCents, [plan.id]: cents },
                      })
                    }
                  />
                ))}
              </div>
            </PanelSection>

            <PanelSection
              title="Comercial"
              collapsible
              open={commercialOpen}
              onToggle={() => setCommercialOpen((value) => !value)}
              summary={
                <span className="tabular-nums">
                  10x de {formatCurrencyBRL(completoInstallments.installmentCents)} no Completo · {input.validityDays} dias
                </span>
              }
            >
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Taxa 10x (%)"
                  value={feePercentDisplay}
                  inputMode="decimal"
                  className="tabular-nums"
                  onChange={(event) => {
                    setFeePercentDisplay(event.target.value)
                    patchInput({ installmentFeeRate: parsePercentToRate(event.target.value) })
                  }}
                />
                <Input
                  label="Validade (dias)"
                  type="number"
                  min={1}
                  max={90}
                  className="tabular-nums"
                  value={input.validityDays}
                  onChange={(event) => {
                    const next = Number.parseInt(event.target.value, 10)
                    patchInput({ validityDays: Number.isFinite(next) ? next : 15 })
                  }}
                />
              </div>
              <p className="mt-3 text-xs normal-case text-muted-foreground">
                Taxa da InfinitePay repassada ao cliente. Completo {formatCurrencyBRL(pricing.completoDealCents)} à vista
                ou 10x de {formatCurrencyBRL(completoInstallments.installmentCents)} (total{' '}
                {formatCurrencyBRL(completoInstallments.totalCents)}). Instagram ou Google{' '}
                {formatCurrencyBRL(pricing.agencyDealCents)} à vista ou 10x de {formatCurrencyBRL(installments.installmentCents)} (total{' '}
                {formatCurrencyBRL(installments.totalCents)}).
              </p>

              <div className="mt-5 border-t border-border pt-4">
                <Switch
                  label="Exibir planos recorrentes"
                  labelPosition="before"
                  checked={showContinuation}
                  onChange={setShowContinuation}
                />
              </div>
            </PanelSection>

            <section className="border-t border-border px-6 py-5">
              <p className={cn('text-sm normal-case', canGenerate ? 'text-muted-foreground' : 'text-foreground')}>
                {generateLine}
              </p>
              <Button
                size="lg"
                className="mt-4 w-full"
                loading={generating}
                disabled={!canGenerate || busy}
                onClick={() => void handleGenerate()}
              >
                {contentEmpty ? 'Gerar textos' : 'Gerar de novo'}
              </Button>
            </section>

            <PanelSection title="Textos da apresentação">
              {contentEmpty ? (
                <p className="text-sm normal-case text-muted-foreground">
                  Depois de gerar, cada bloco de texto aparece aqui. Ao abrir um bloco, a prévia vai direto para o
                  slide dele.
                </p>
              ) : (
                <>
                  <div className="-mt-2">
                    <PilotoContentEditor
                      content={content}
                      onChange={setContent}
                      disabled={busy}
                      openSection={openSection}
                      onOpenSectionChange={openTextSection}
                      showContinuation={showContinuation}
                    />
                  </div>
                  <div className="mt-4 border-t border-border pt-5">
                    <Textarea
                      label="Pedir um ajuste à IA"
                      value={adjustment}
                      rows={2}
                      className="!min-h-0"
                      placeholder="Ex.: deixe o diagnóstico mais curto e fale de agendamento."
                      onChange={(event) => setAdjustment(event.target.value)}
                    />
                    <p className="mt-2 text-xs normal-case text-muted-foreground">
                      {adjustment.trim()
                        ? 'A IA reescreve só o que você pediu e mantém o resto.'
                        : 'Escreva o que deve mudar. Para mudanças pequenas, edite direto nos blocos.'}
                    </p>
                    <Button
                      variant="secondary"
                      className="mt-3 w-full"
                      loading={regenerating}
                      disabled={!adjustment.trim() || busy}
                      onClick={() => void handleRegenerate()}
                    >
                      Aplicar ajuste
                    </Button>
                  </div>
                </>
              )}
            </PanelSection>
          </aside>

          {/* Coluna da prévia */}
          <div className="min-w-0 flex-1 lg:sticky lg:top-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex" role="tablist" aria-label="Tipo de prévia">
                {(
                  [
                    { value: 'deck' as const, label: 'Apresentação' },
                    { value: 'pdf' as const, label: 'PDF para WhatsApp' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={previewTab === tab.value}
                    onClick={() => setPreviewTab(tab.value)}
                    className={cn(
                      'h-10 whitespace-nowrap border-b-2 px-4 text-sm font-medium normal-case transition-colors',
                      previewTab === tab.value
                        ? 'border-accent text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <SaveStatus state={saveState} />
                {!pilotoId ? (
                  <Button variant="ghost" size="sm" loading={creating} disabled={busy} onClick={() => void handleCreateDraft()}>
                    Salvar
                  </Button>
                ) : null}
                <Button variant="secondary" size="sm" loading={downloading} disabled={downloading} onClick={() => void handleDownload()}>
                  <DownloadIcon />
                  Baixar PDF
                </Button>
                {pilotoId ? (
                  <Link
                    to={`/piloto/${pilotoId}/roteiro`}
                    title="Abre o roteiro da reunião"
                    className="inline-flex h-11 min-h-touch items-center justify-center gap-2 whitespace-nowrap border-2 border-border bg-transparent px-4 text-xs font-bold uppercase tracking-tight text-foreground transition-colors duration-150 hover:bg-foreground hover:text-background"
                  >
                    Roteiro
                  </Link>
                ) : null}
                <Button size="sm" disabled={busy} onClick={() => void handlePresent()}>
                  Apresentar
                </Button>
              </div>
            </div>

            {previewTab === 'deck' ? (
              <SlidePreview
                input={input}
                content={content}
                accent={accent}
                index={slideIndex}
                onIndexChange={setSlideIndex}
                showContinuation={showContinuation}
              />
            ) : (
              <ProposalPdfPagedPreview
                document={
                  <PilotoPdfDocument
                    input={input}
                    content={content}
                    showContinuation={showContinuation}
                  />
                }
                pageAspect="810 / 1440"
                revision={PILOTO_PDF_LAYOUT_REVISION}
                sourceKey={JSON.stringify({ input, content, showContinuation })}
              />
            )}

            {actionError ? (
              <p className="mt-4 text-sm normal-case text-status-error">{actionError}</p>
            ) : actionNotice ? (
              <p className="mt-4 text-sm normal-case text-status-success">{actionNotice}</p>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}

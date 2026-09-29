import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { pdf } from '@react-pdf/renderer'
import { generatePilotoContent, regeneratePilotoContent } from '../ai/generatePiloto'
import { ProposalPdfPagedPreview } from '../components/ProposalPdfPagedPreview'
import { ProposalStatusSelector } from '../components/ProposalStatusSelector'
import {
  Button,
  Card,
  CardTitle,
  Dialog,
  DialogCloseButton,
  DownloadIcon,
  Input,
  Spinner,
  Textarea,
} from '../components/ui'
import { formatCurrencyBRL, maskCurrencyBRLInput, parseCurrencyBRL } from '../lib/currencyBRL'
import { sanitizeFilename } from '../lib/filename'
import { fileToScreenshotDataUrl } from '../lib/pilotoScreenshot'
import {
  AGENCY_DEAL_CENTS,
  DEFAULT_INSTALLMENT_FEE_RATE,
  calcInstallments,
} from '../lib/pilotoPricing'
import { cn } from '../lib/cn'
import { PilotoPdfDocument, PILOTO_PDF_LAYOUT_REVISION } from '../pdf/PilotoPdfDocument'
import { getProposalDefaults } from '../services/proposalDefaults'
import {
  createPiloto,
  getPiloto,
  updatePiloto,
  updatePilotoStatus,
} from '../services/pilotos'
import type { PilotoAiContent, PilotoInput, SituationAnswer } from '../types/piloto'
import {
  EMPTY_PILOTO_AI_CONTENT,
  normalizePilotoAiContent,
  normalizePilotoInput,
} from '../types/piloto'
import type { ProposalStatus } from '../types/proposalDoc'
import { DEFAULT_ACCENT_COLOR, normalizeAccentColor } from '../types/proposalDoc'

const SITUATION_OPTIONS: { value: SituationAnswer; label: string }[] = [
  { value: 'sim', label: 'Sim' },
  { value: 'nao', label: 'Não' },
  { value: 'nao_sei', label: 'Não sei' },
]

function emptyInput(): PilotoInput {
  return normalizePilotoInput({
    companyName: '',
    professionalName: '',
    logoDataUrl: '',
    websiteUrl: '',
    accentColor: DEFAULT_ACCENT_COLOR,
    leadCompanyName: '',
    leadNiche: '',
    leadCity: '',
    leadOffer: '',
    ticketCents: 0,
    hasWebsite: 'nao_sei',
    runsAds: 'nao_sei',
    whatsappOrganized: 'nao_sei',
    contextNotes: '',
    toolScreenshots: [],
    installmentFeeRate: DEFAULT_INSTALLMENT_FEE_RATE,
    validityDays: 15,
  })
}

function feeRateToPercentDisplay(rate: number): string {
  const percent = rate * 100
  return percent.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  })
}

function parsePercentToRate(value: string): number {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.')
  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed)) {
    return DEFAULT_INSTALLMENT_FEE_RATE
  }
  return parsed / 100
}

export default function NewPiloto() {
  const { id: routeId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [pilotoId, setPilotoId] = useState<string | null>(routeId ?? null)
  const [status, setStatus] = useState<ProposalStatus>('ativo')
  const [input, setInput] = useState<PilotoInput>(emptyInput)
  const [content, setContent] = useState<PilotoAiContent>(EMPTY_PILOTO_AI_CONTENT)
  const [ticketDisplay, setTicketDisplay] = useState('')
  const [feePercentDisplay, setFeePercentDisplay] = useState(
    feeRateToPercentDisplay(DEFAULT_INSTALLMENT_FEE_RATE),
  )

  const [loadingDoc, setLoadingDoc] = useState(Boolean(routeId))
  const [notFound, setNotFound] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [screenshotError, setScreenshotError] = useState('')
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustment, setAdjustment] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)

  const installments = useMemo(
    () => calcInstallments(AGENCY_DEAL_CENTS, input.installmentFeeRate),
    [input.installmentFeeRate],
  )

  const canGenerate = Boolean(input.leadCompanyName.trim() && input.leadNiche.trim())
  const generateHint = !canGenerate ? 'Preencha empresa e nicho para gerar' : null

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        if (routeId) {
          setLoadingDoc(true)
          const doc = await getPiloto(routeId)
          if (cancelled) {
            return
          }
          if (!doc) {
            setNotFound(true)
            return
          }
          setPilotoId(doc.id)
          setStatus(doc.status)
          setInput(doc.input)
          setContent(doc.content)
          setTicketDisplay(
            doc.input.ticketCents > 0 ? formatCurrencyBRL(doc.input.ticketCents) : '',
          )
          setFeePercentDisplay(feeRateToPercentDisplay(doc.input.installmentFeeRate))
          return
        }

        const defaults = await getProposalDefaults()
        if (cancelled) {
          return
        }
        setInput((current) =>
          normalizePilotoInput({
            ...current,
            companyName: defaults.companyName,
            professionalName: defaults.professionalName,
            logoDataUrl: defaults.logoDataUrl,
            websiteUrl: defaults.websiteUrl,
            accentColor: normalizeAccentColor(defaults.accentColor),
          }),
        )
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

  function patchInput(partial: Partial<PilotoInput>) {
    setInput((current) => normalizePilotoInput({ ...current, ...partial }))
  }

  async function handleScreenshotChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    setScreenshotError('')
    try {
      if (input.toolScreenshots.length >= 3) {
        setScreenshotError('Máximo de 3 prints.')
        return
      }
      const dataUrl = await fileToScreenshotDataUrl(file)
      patchInput({ toolScreenshots: [...input.toolScreenshots, dataUrl].slice(0, 3) })
    } catch (error) {
      setScreenshotError(error instanceof Error ? error.message : 'Erro ao processar imagem')
    }
  }

  function removeScreenshot(index: number) {
    patchInput({
      toolScreenshots: input.toolScreenshots.filter((_, itemIndex) => itemIndex !== index),
    })
  }

  async function handleGenerate() {
    if (!canGenerate || generating) {
      return
    }
    setGenerating(true)
    setActionError('')
    try {
      const next = await generatePilotoContent(input)
      setContent(next)
    } catch (error) {
      console.error('[NewPiloto] generate', error)
      setActionError(error instanceof Error ? error.message : 'Erro ao gerar textos')
    } finally {
      setGenerating(false)
    }
  }

  async function handleRegenerate() {
    if (!adjustment.trim() || regenerating) {
      return
    }
    setRegenerating(true)
    setActionError('')
    try {
      const next = await regeneratePilotoContent(input, content, adjustment.trim())
      setContent(next)
      setAdjustOpen(false)
      setAdjustment('')
    } catch (error) {
      console.error('[NewPiloto] regenerate', error)
      setActionError(error instanceof Error ? error.message : 'Erro ao ajustar textos')
    } finally {
      setRegenerating(false)
    }
  }

  async function handleSave() {
    if (saving) {
      return
    }
    setSaving(true)
    setActionError('')
    try {
      const normalizedInput = normalizePilotoInput(input)
      const normalizedContent = normalizePilotoAiContent(content)

      if (!pilotoId) {
        const id = await createPiloto(normalizedInput, normalizedContent)
        setPilotoId(id)
        navigate(`/piloto/${id}`, { replace: true })
      } else {
        await updatePiloto(pilotoId, {
          input: normalizedInput,
          content: normalizedContent,
        })
      }
    } catch (error) {
      console.error('[NewPiloto] save', error)
      setActionError(error instanceof Error ? error.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
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
        <PilotoPdfDocument input={input} content={content} />,
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-2 border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div>
            <Link
              to="/?tab=pilotos"
              className="text-xs font-bold uppercase tracking-tight text-muted-foreground hover:text-accent"
            >
              ← Voltar
            </Link>
            <h1 className="mt-1 text-xl font-bold uppercase tracking-tighter text-foreground">
              Piloto <span className="text-accent">45</span>
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

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-10 pb-40">
        <Card>
          <CardTitle>Lead</CardTitle>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input
              label="Empresa"
              value={input.leadCompanyName}
              onChange={(event) => patchInput({ leadCompanyName: event.target.value })}
              required
            />
            <Input
              label="Nicho"
              value={input.leadNiche}
              onChange={(event) => patchInput({ leadNiche: event.target.value })}
              required
            />
            <Input
              label="Cidade"
              value={input.leadCity}
              onChange={(event) => patchInput({ leadCity: event.target.value })}
            />
            <Input
              label="Ticket médio"
              value={ticketDisplay}
              onChange={(event) => {
                const masked = maskCurrencyBRLInput(event.target.value)
                setTicketDisplay(masked)
                patchInput({ ticketCents: parseCurrencyBRL(masked) })
              }}
              inputMode="numeric"
            />
            <div className="sm:col-span-2">
              <Textarea
                label="O que a empresa vende"
                value={input.leadOffer}
                onChange={(event) => patchInput({ leadOffer: event.target.value })}
                rows={3}
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle>Situação atual</CardTitle>
          <div className="mt-4 space-y-5">
            {(
              [
                { key: 'hasWebsite' as const, label: 'Já tem site?' },
                { key: 'runsAds' as const, label: 'Já anuncia?' },
                { key: 'whatsappOrganized' as const, label: 'WhatsApp organizado?' },
              ] as const
            ).map((question) => (
              <div key={question.key}>
                <p className="mb-2 text-xs font-bold uppercase tracking-tight text-muted-foreground">
                  {question.label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {SITUATION_OPTIONS.map((option) => {
                    const active = input[question.key] === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => patchInput({ [question.key]: option.value })}
                        className={cn(
                          'min-h-touch border-2 px-4 py-2 text-xs font-bold uppercase tracking-tight transition-colors duration-150',
                          active
                            ? 'border-accent bg-accent text-accent-foreground'
                            : 'border-border bg-transparent text-muted-foreground hover:text-accent',
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
        </Card>

        <Card>
          <CardTitle>Contexto para a IA</CardTitle>
          <div className="mt-4">
            <Textarea
              value={input.contextNotes}
              onChange={(event) => patchInput({ contextNotes: event.target.value })}
              hint="O que você descobriu na conversa: concorrência, sazonalidade, o que já tentaram."
              rows={4}
            />
          </div>
        </Card>

        <Card>
          <CardTitle>Prints da ferramenta</CardTitle>
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-3">
              {input.toolScreenshots.map((src, index) => (
                <div key={index} className="relative h-28 w-28 border-2 border-border bg-surface-2">
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    aria-label={`Remover print ${index + 1}`}
                    onClick={() => removeScreenshot(index)}
                    className="absolute right-1 top-1 border-2 border-border bg-surface px-1.5 py-0.5 text-[10px] font-bold uppercase"
                  >
                    Remover
                  </button>
                </div>
              ))}
              {input.toolScreenshots.length < 3 ? (
                <label className="flex h-28 w-28 cursor-pointer items-center justify-center border-2 border-dashed border-border text-center text-xs font-bold uppercase tracking-tight text-muted-foreground hover:border-accent hover:text-accent">
                  + Print
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="sr-only"
                    onChange={(event) => void handleScreenshotChange(event)}
                  />
                </label>
              ) : null}
            </div>
            {screenshotError ? (
              <p className="text-xs normal-case text-status-error">{screenshotError}</p>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardTitle>Comercial</CardTitle>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input
              label="Taxa de parcelamento (%)"
              value={feePercentDisplay}
              onChange={(event) => {
                setFeePercentDisplay(event.target.value)
                patchInput({ installmentFeeRate: parsePercentToRate(event.target.value) })
              }}
              hint="Taxa da InfinitePay repassada ao cliente. Confira a sua no painel."
              inputMode="decimal"
            />
            <Input
              label="Validade (dias)"
              type="number"
              min={1}
              max={90}
              value={input.validityDays}
              onChange={(event) => {
                const next = Number.parseInt(event.target.value, 10)
                patchInput({ validityDays: Number.isFinite(next) ? next : 15 })
              }}
            />
          </div>
          <p className="mt-4 text-sm normal-case text-muted-foreground">
            Condição de fechamento: {formatCurrencyBRL(AGENCY_DEAL_CENTS)} à vista no Pix, ou 10x
            de {formatCurrencyBRL(installments.installmentCents)} (total{' '}
            {formatCurrencyBRL(installments.totalCents)}).
          </p>
        </Card>

        <div className="sticky bottom-0 z-20 -mx-6 border-t-2 border-border bg-surface px-6 py-4">
          {generateHint ? (
            <p className="mb-3 text-sm normal-case text-muted-foreground">{generateHint}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              loading={generating}
              disabled={!canGenerate || generating || regenerating || saving}
              onClick={() => void handleGenerate()}
            >
              Gerar textos
            </Button>
            <Button
              variant="secondary"
              disabled={generating || regenerating || saving}
              onClick={() => setAdjustOpen(true)}
            >
              Ajustar
            </Button>
            <Button
              variant="secondary"
              loading={saving}
              disabled={generating || regenerating || saving}
              onClick={() => void handleSave()}
            >
              Salvar
            </Button>
            <Button
              variant="secondary"
              disabled={!pilotoId || generating || regenerating || saving}
              onClick={() => pilotoId && navigate(`/piloto/${pilotoId}/apresentar`)}
            >
              Apresentar
            </Button>
            <Button
              variant="secondary"
              loading={downloading}
              disabled={generating || regenerating || saving || downloading}
              onClick={() => void handleDownload()}
            >
              <DownloadIcon />
              Baixar PDF
            </Button>
          </div>
          {actionError ? (
            <p className="mt-3 text-sm normal-case text-status-error">{actionError}</p>
          ) : null}
        </div>

        <div className="border-2 border-border bg-surface">
          <button
            type="button"
            className="flex w-full items-center justify-between px-6 py-4 text-left"
            onClick={() => setPreviewOpen((open) => !open)}
          >
            <span className="text-sm font-bold uppercase tracking-tight text-foreground">
              Prévia do PDF
            </span>
            <span className="text-xs font-bold uppercase tracking-tight text-muted-foreground">
              {previewOpen ? 'Fechar' : 'Abrir'} · 5 páginas
            </span>
          </button>
          {previewOpen ? (
            <div className="border-t-2 border-border p-4">
              <ProposalPdfPagedPreview
                document={<PilotoPdfDocument input={input} content={content} />}
                pageAspect="810 / 1440"
                revision={PILOTO_PDF_LAYOUT_REVISION}
                sourceKey={JSON.stringify({ input, content })}
              />
            </div>
          ) : null}
        </div>
      </main>

      <Dialog
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title="Ajustar textos"
        description="Diga o que deve mudar. O restante é preservado."
        footer={
          <>
            <DialogCloseButton onClose={() => setAdjustOpen(false)} />
            <Button
              loading={regenerating}
              disabled={!adjustment.trim() || regenerating}
              onClick={() => void handleRegenerate()}
            >
              Aplicar ajuste
            </Button>
          </>
        }
      >
        <Textarea
          label="Instrução"
          value={adjustment}
          onChange={(event) => setAdjustment(event.target.value)}
          rows={5}
          placeholder="Ex.: deixe o diagnóstico mais específico para clínicas"
        />
      </Dialog>
    </div>
  )
}

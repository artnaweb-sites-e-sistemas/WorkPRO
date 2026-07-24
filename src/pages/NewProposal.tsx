import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PDFViewer, pdf } from '@react-pdf/renderer'
import {
  generateProposalAiContent,
  regenerateProposalAiContent,
} from '../ai/generateProposalDoc'
import { Button, Card, Dialog, Input, Switch, Textarea } from '../components/ui'
import { formatCurrencyBRL, maskCurrencyBRLInput, parseCurrencyBRL } from '../lib/currencyBRL'
import { formatRelativeTime } from '../lib/formatRelativeTime'
import { fileToLogoDataUrl } from '../lib/logoImage'
import { buildProposalContent } from '../lib/proposalTerms'
import { ProposalPdfDocument } from '../pdf/ProposalPdfDocument'
import {
  DEFAULT_PROPOSAL_DEFAULTS,
  getProposalDefaults,
  saveProposalDefaults,
} from '../services/proposalDefaults'
import { createProposal, getProposal, listProposals, updateProposal } from '../services/proposals'
import type {
  InstallmentKind,
  PaymentMethod,
  ProposalAiContent,
  ProposalContentDoc,
  ProposalDefaults,
  ProposalDoc,
  ProposalFormInput,
  ProposalPaymentTerms,
  ProposalRecurrence,
  RecurrenceStartTiming,
} from '../types/proposalDoc'
import { RECURRENCE_START_TIMING_OPTIONS } from '../types/proposalDoc'

function extractAiContent(content: ProposalContentDoc): ProposalAiContent {
  return {
    projectTitle: content.projectTitle,
    projectSubtitle: content.projectSubtitle,
    aboutText: content.aboutText,
    includedItems: content.includedItems,
    prerequisiteBody: content.prerequisiteBody,
    howItWorks: content.howItWorks,
    setupLabel: content.setupLabel,
    recurringLabel: content.recurringLabel,
    projectSteps: content.projectSteps,
    closingParagraph: content.closingParagraph,
  }
}

function sanitizeFilename(value: string): string {
  return value.replace(/[/\\:*?"<>|]/g, '-').trim() || 'Proposta'
}

function normalizeRecurrenceFromDoc(raw: ProposalRecurrence & { firstPaymentDate?: string | null }): ProposalRecurrence {
  if (!raw.enabled) {
    return { enabled: false, amountCents: null, startTiming: null }
  }

  const timing = raw.startTiming ?? 'ato_contratacao'

  return {
    enabled: true,
    amountCents: raw.amountCents,
    startTiming: timing,
  }
}

function buildInputFromState(params: {
  defaults: ProposalDefaults
  projectContext: string
  amountCents: number
  payment: ProposalPaymentTerms
  recurrence: ProposalRecurrence
  validityDays: number
}): ProposalFormInput {
  return {
    companyName: params.defaults.companyName,
    companyAbout: params.defaults.companyAbout,
    professionalName: params.defaults.professionalName,
    tagline: params.defaults.tagline || 'Desenvolvimento web & sistemas',
    logoDataUrl: params.defaults.logoDataUrl,
    markDataUrl: params.defaults.markDataUrl,
    projectContext: params.projectContext,
    amountCents: params.amountCents,
    payment: params.payment,
    recurrence: params.recurrence,
    validityDays: params.validityDays > 0 ? params.validityDays : 15,
  }
}

function getPendingMessage(input: ProposalFormInput): string | null {
  if (input.amountCents === 0) {
    return 'Falta o valor da proposta'
  }
  if (!input.projectContext.trim()) {
    return 'Falta o contexto do projeto'
  }
  if (!input.companyName.trim()) {
    return 'Falta o nome da empresa'
  }
  if (input.recurrence.enabled && !input.recurrence.startTiming) {
    return 'Falta quando começa a recorrência'
  }
  if (input.recurrence.enabled && (input.recurrence.amountCents == null || input.recurrence.amountCents <= 0)) {
    return 'Falta o valor mensal da recorrência'
  }
  if (!input.validityDays || input.validityDays < 1) {
    return 'Falta a validade da proposta'
  }
  return null
}

export default function NewProposal() {
  const { id: routeId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const logoInputRef = useRef<HTMLInputElement>(null)
  const markInputRef = useRef<HTMLInputElement>(null)
  const defaultsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const defaultsHydrated = useRef(false)

  const [defaults, setDefaults] = useState<ProposalDefaults>(DEFAULT_PROPOSAL_DEFAULTS)
  const [projectContext, setProjectContext] = useState('')
  const [amountDisplay, setAmountDisplay] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('avista')
  const [installments, setInstallments] = useState(3)
  const [installmentKind, setInstallmentKind] = useState<InstallmentKind>('boleto')
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false)
  const [recurrenceAmountDisplay, setRecurrenceAmountDisplay] = useState('')
  const [startTiming, setStartTiming] = useState<RecurrenceStartTiming>('ato_contratacao')
  const [validityDays, setValidityDays] = useState(15)
  const [logoError, setLogoError] = useState('')
  const [markError, setMarkError] = useState('')

  const [proposalId, setProposalId] = useState<string | null>(routeId ?? null)
  const [content, setContent] = useState<ProposalContentDoc | null>(null)
  const [aiContent, setAiContent] = useState<ProposalAiContent | null>(null)

  const [loadingDoc, setLoadingDoc] = useState(Boolean(routeId))
  const [generating, setGenerating] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [regenerateError, setRegenerateError] = useState('')
  const [adjustment, setAdjustment] = useState('')

  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyItems, setHistoryItems] = useState<ProposalDoc[]>([])

  const payment: ProposalPaymentTerms = useMemo(
    () => ({
      method: paymentMethod,
      installments: paymentMethod === 'parcelado' ? installments : null,
      installmentKind: paymentMethod === 'parcelado' ? installmentKind : null,
    }),
    [paymentMethod, installments, installmentKind],
  )

  const recurrence: ProposalRecurrence = useMemo(
    () => ({
      enabled: recurrenceEnabled,
      amountCents: recurrenceEnabled ? parseCurrencyBRL(recurrenceAmountDisplay) || null : null,
      startTiming: recurrenceEnabled ? startTiming : null,
    }),
    [recurrenceEnabled, recurrenceAmountDisplay, startTiming],
  )

  const amountCents = parseCurrencyBRL(amountDisplay)

  const formInput = useMemo(
    () =>
      buildInputFromState({
        defaults,
        projectContext,
        amountCents,
        payment,
        recurrence,
        validityDays,
      }),
    [defaults, projectContext, amountCents, payment, recurrence, validityDays],
  )

  const pendingMessage = getPendingMessage(formInput)
  const canGenerate = !pendingMessage && !generating && !loadingDoc

  const persistDefaults = useCallback((next: ProposalDefaults) => {
    if (defaultsSaveTimer.current) {
      clearTimeout(defaultsSaveTimer.current)
    }

    defaultsSaveTimer.current = setTimeout(() => {
      void saveProposalDefaults(next).catch((error) => {
        console.error('[NewProposal] saveProposalDefaults', error)
      })
    }, 600)
  }, [])

  const updateDefaults = useCallback(
    (partial: Partial<ProposalDefaults>) => {
      setDefaults((current) => {
        const next = { ...current, ...partial }
        if (defaultsHydrated.current) {
          persistDefaults(next)
        }
        return next
      })
    },
    [persistDefaults],
  )

  useEffect(() => {
    let cancelled = false

    void getProposalDefaults().then((loaded) => {
      if (cancelled) {
        return
      }
      setDefaults(loaded)
      defaultsHydrated.current = true
    })

    return () => {
      cancelled = true
      if (defaultsSaveTimer.current) {
        clearTimeout(defaultsSaveTimer.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!routeId) {
      setLoadingDoc(false)
      return
    }

    let cancelled = false
    setLoadingDoc(true)

    void getProposal(routeId)
      .then((doc) => {
        if (cancelled) {
          return
        }

        if (!doc) {
          navigate('/proposta', { replace: true })
          return
        }

        defaultsHydrated.current = false
        setDefaults({
          logoDataUrl: doc.input.logoDataUrl,
          markDataUrl: doc.input.markDataUrl ?? '',
          companyName: doc.input.companyName,
          companyAbout: doc.input.companyAbout,
          professionalName: doc.input.professionalName,
          tagline: doc.input.tagline,
        })
        setProjectContext(doc.input.projectContext)
        setAmountDisplay(doc.input.amountCents > 0 ? formatCurrencyBRL(doc.input.amountCents) : '')
        setPaymentMethod(doc.input.payment.method)
        setInstallments(doc.input.payment.installments ?? 3)
        setInstallmentKind(doc.input.payment.installmentKind ?? 'boleto')
        const normalizedRecurrence = normalizeRecurrenceFromDoc(
          doc.input.recurrence as ProposalRecurrence & { firstPaymentDate?: string | null },
        )
        setRecurrenceEnabled(normalizedRecurrence.enabled)
        setRecurrenceAmountDisplay(
          normalizedRecurrence.amountCents
            ? formatCurrencyBRL(normalizedRecurrence.amountCents)
            : '',
        )
        setStartTiming(normalizedRecurrence.startTiming ?? 'ato_contratacao')
        setValidityDays(doc.input.validityDays > 0 ? doc.input.validityDays : 15)
        setProposalId(doc.id)
        setContent(doc.content)
        setAiContent(extractAiContent(doc.content))
        setLoadingDoc(false)

        // Reabilita auto-save dos defaults após hidratar a proposta
        queueMicrotask(() => {
          defaultsHydrated.current = true
        })
      })
      .catch((error) => {
        console.error('[NewProposal] getProposal', error)
        if (!cancelled) {
          navigate('/proposta', { replace: true })
        }
      })

    return () => {
      cancelled = true
    }
  }, [routeId, navigate])

  async function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    setLogoError('')

    try {
      const dataUrl = await fileToLogoDataUrl(file)
      updateDefaults({ logoDataUrl: dataUrl })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao processar o logo.'
      setLogoError(message)
    }
  }

  async function handleMarkChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    setMarkError('')

    try {
      const dataUrl = await fileToLogoDataUrl(file)
      updateDefaults({ markDataUrl: dataUrl })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao processar o símbolo.'
      setMarkError(message)
    }
  }

  async function handleGenerate() {
    if (!canGenerate) {
      return
    }

    setGenerating(true)
    setGenerateError('')

    try {
      const ai = await generateProposalAiContent(formInput)
      const built = buildProposalContent(formInput, ai)
      const id = await createProposal(formInput, built)

      setAiContent(ai)
      setContent(built)
      setProposalId(id)
      navigate(`/proposta/${id}`, { replace: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao gerar a proposta.'
      setGenerateError(message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleRegenerate() {
    if (!proposalId || !aiContent || !adjustment.trim() || regenerating) {
      return
    }

    setRegenerating(true)
    setRegenerateError('')

    try {
      const ai = await regenerateProposalAiContent(formInput, aiContent, adjustment.trim())
      const built = buildProposalContent(formInput, ai)
      await updateProposal(proposalId, { input: formInput, content: built })

      setAiContent(ai)
      setContent(built)
      setAdjustment('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao refazer a proposta.'
      setRegenerateError(message)
    } finally {
      setRegenerating(false)
    }
  }

  async function handleDownload() {
    if (!content || downloading) {
      return
    }

    setDownloading(true)

    try {
      const blob = await pdf(
        <ProposalPdfDocument input={formInput} content={content} />,
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      const filename = `Proposta - ${sanitizeFilename(formInput.companyName)} - ${sanitizeFilename(content.projectTitle)}.pdf`
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('[NewProposal] download', error)
    } finally {
      setDownloading(false)
    }
  }

  async function openHistory() {
    setHistoryOpen(true)
    setHistoryLoading(true)

    try {
      const items = await listProposals()
      setHistoryItems(items)
    } catch (error) {
      console.error('[NewProposal] listProposals', error)
      setHistoryItems([])
    } finally {
      setHistoryLoading(false)
    }
  }

  if (loadingDoc) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="inline-block h-8 w-8 animate-spin border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <Link
                to="/"
                className="text-xs font-bold uppercase tracking-tight text-muted-foreground transition-colors hover:text-accent"
              >
                ← Voltar
              </Link>
              <h1 className="mt-3 text-3xl font-bold uppercase tracking-tighter text-foreground">
                Nova proposta
              </h1>
            </div>
            <Button variant="ghost" size="sm" onClick={() => void openHistory()}>
              Propostas anteriores
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <main className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
          <aside className="w-full shrink-0 lg:w-[400px]">
            <Card padding="lg">
              <div className="space-y-4">
                <p className="text-sm font-semibold text-foreground">Dados fixos</p>

                <div>
                  <p className="kinetic-label mb-2">Logo (PNG)</p>
                  {defaults.logoDataUrl ? (
                    <div className="flex items-center gap-3">
                      <div className="bg-surface-2 p-2">
                        <img
                          src={defaults.logoDataUrl}
                          alt="Logo da empresa"
                          className="h-16 object-contain"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => logoInputRef.current?.click()}
                      >
                        Substituir
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => logoInputRef.current?.click()}
                    >
                      Enviar logo PNG
                    </Button>
                  )}
                  <p className="mt-2 text-xs normal-case text-muted-foreground">
                    Recomenda-se uma logo clara para melhor visualização na capa escura.
                  </p>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png"
                    className="hidden"
                    onChange={(event) => void handleLogoChange(event)}
                  />
                  {logoError ? (
                    <p className="mt-2 text-xs text-status-error">{logoError}</p>
                  ) : null}
                </div>

                <div>
                  <p className="kinetic-label mb-2">Símbolo da marca (PNG)</p>
                  {defaults.markDataUrl ? (
                    <div className="flex items-center gap-3">
                      <div className="bg-surface-2 p-2">
                        <img
                          src={defaults.markDataUrl}
                          alt="Símbolo da marca"
                          className="h-16 object-contain"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => markInputRef.current?.click()}
                      >
                        Substituir
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => markInputRef.current?.click()}
                    >
                      Enviar símbolo PNG
                    </Button>
                  )}
                  <p className="mt-2 text-xs normal-case text-muted-foreground">
                    Aparece como marca d&apos;água no canto superior direito. Recomenda-se uma imagem
                    escura (a opacidade já vem reduzida no PDF).
                  </p>
                  <input
                    ref={markInputRef}
                    type="file"
                    accept="image/png"
                    className="hidden"
                    onChange={(event) => void handleMarkChange(event)}
                  />
                  {markError ? (
                    <p className="mt-2 text-xs text-status-error">{markError}</p>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Nome da empresa"
                    value={defaults.companyName}
                    onChange={(event) => updateDefaults({ companyName: event.target.value })}
                    onBlur={() => persistDefaults(defaults)}
                  />
                  <Input
                    label="Nome do profissional"
                    value={defaults.professionalName}
                    onChange={(event) => updateDefaults({ professionalName: event.target.value })}
                    onBlur={() => persistDefaults(defaults)}
                  />
                </div>

                <Textarea
                  label="Sobre a empresa"
                  value={defaults.companyAbout}
                  onChange={(event) => updateDefaults({ companyAbout: event.target.value })}
                  onBlur={() => persistDefaults(defaults)}
                  rows={4}
                />

                <Input
                  label="Segmento (linha sob o logo)"
                  value={defaults.tagline}
                  onChange={(event) => updateDefaults({ tagline: event.target.value })}
                  onBlur={() => persistDefaults(defaults)}
                  hint="Aparece em caixa alta abaixo do logo"
                />
              </div>

              <div className="mt-6 space-y-4 border-t border-border pt-6">
                <p className="text-sm font-semibold text-foreground">Projeto</p>

                <Textarea
                  label="Sobre o projeto"
                  value={projectContext}
                  onChange={(event) => setProjectContext(event.target.value)}
                  placeholder="Descreva o projeto: o que o cliente precisa, o que será entregue, prazos, dependências..."
                  className="min-h-[200px]"
                  rows={8}
                />

                <Input
                  label="Valor da proposta"
                  inputMode="numeric"
                  value={amountDisplay}
                  onChange={(event) => setAmountDisplay(maskCurrencyBRLInput(event.target.value))}
                  className="tabular-nums"
                />
              </div>

              <div className="mt-6 space-y-4 border-t border-border pt-6">
                <p className="text-sm font-semibold text-foreground">Forma de pagamento</p>
                <div className="divide-y divide-border">
                  {(
                    [
                      { value: 'avista' as const, label: 'À vista' },
                      {
                        value: 'metade' as const,
                        label: 'Metade no ato e o restante em 30 dias',
                      },
                      { value: 'parcelado' as const, label: 'Parcelado' },
                    ] as const
                  ).map((option) => (
                    <label key={option.value} className="flex cursor-pointer flex-col py-3">
                      <span className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="payment-method"
                          checked={paymentMethod === option.value}
                          onChange={() => setPaymentMethod(option.value)}
                          className="accent-[var(--color-accent)]"
                        />
                        <span className="text-sm normal-case text-foreground">{option.label}</span>
                      </span>
                      {option.value === 'parcelado' && paymentMethod === 'parcelado' ? (
                        <div className="grid grid-cols-2 gap-3 pl-7 pt-3">
                          <select
                            className="kinetic-input"
                            value={installments}
                            onChange={(event) => setInstallments(Number(event.target.value))}
                            aria-label="Número de parcelas"
                          >
                            {Array.from({ length: 11 }, (_, index) => index + 2).map((n) => (
                              <option key={n} value={n}>
                                {n}x
                              </option>
                            ))}
                          </select>
                          <select
                            className="kinetic-input"
                            value={installmentKind}
                            onChange={(event) =>
                              setInstallmentKind(event.target.value as InstallmentKind)
                            }
                            aria-label="Forma de parcelamento"
                          >
                            <option value="boleto">Boleto</option>
                            <option value="cartao">Cartão de crédito</option>
                          </select>
                        </div>
                      ) : null}
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-6 space-y-4 border-t border-border pt-6">
                <Switch
                  checked={recurrenceEnabled}
                  onChange={(checked) => {
                    setRecurrenceEnabled(checked)
                    if (checked && !startTiming) {
                      setStartTiming('ato_contratacao')
                    }
                  }}
                  label="Projeto com recorrência"
                />
                {recurrenceEnabled ? (
                  <div className="space-y-4">
                    <Input
                      label="Valor mensal"
                      inputMode="numeric"
                      value={recurrenceAmountDisplay}
                      onChange={(event) =>
                        setRecurrenceAmountDisplay(maskCurrencyBRLInput(event.target.value))
                      }
                      className="tabular-nums"
                    />
                    <div>
                      <p className="kinetic-label mb-2">Início da recorrência</p>
                      <div className="divide-y divide-border">
                        {RECURRENCE_START_TIMING_OPTIONS.map((option) => (
                          <label
                            key={option.value}
                            className="flex cursor-pointer items-center gap-3 py-3"
                          >
                            <input
                              type="radio"
                              name="recurrence-start"
                              checked={startTiming === option.value}
                              onChange={() => setStartTiming(option.value)}
                              className="accent-[var(--color-accent)]"
                            />
                            <span className="text-sm normal-case text-foreground">
                              {option.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-6 space-y-4 border-t border-border pt-6">
                <Input
                  label="Validade da proposta (dias)"
                  inputMode="numeric"
                  value={String(validityDays)}
                  onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, '')
                    setValidityDays(digits ? Number.parseInt(digits, 10) : 0)
                  }}
                  hint="Aparece no rodapé da última página do PDF."
                  className="tabular-nums"
                />
              </div>

              <div className="mt-6 border-t border-border pt-6">
                <p className="mb-3 text-xs normal-case text-muted-foreground">
                  {pendingMessage ??
                    'A IA vai escrever a proposta e montar o PDF com o seu template.'}
                </p>
                <Button
                  size="lg"
                  className="w-full"
                  disabled={!canGenerate}
                  loading={generating}
                  onClick={() => void handleGenerate()}
                >
                  Gerar proposta
                </Button>
                {generateError ? (
                  <p className="mt-3 text-sm text-status-error">{generateError}</p>
                ) : null}
              </div>
            </Card>
          </aside>

          <div className="flex flex-1 flex-col gap-8">
            {!content && !generating ? (
              <div className="flex min-h-[60vh] flex-col items-center justify-center border-2 border-border px-6 text-center">
                <p className="text-lg font-semibold text-foreground">Preview da proposta</p>
                <p className="mt-2 max-w-md text-sm normal-case text-muted-foreground">
                  Preencha o formulário e clique em Gerar proposta para ver o PDF aqui.
                </p>
              </div>
            ) : null}

            {generating ? (
              <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 border-2 border-border">
                <span className="inline-block h-8 w-8 animate-spin border-2 border-accent border-t-transparent" />
                <p className="text-sm normal-case text-muted-foreground">Escrevendo a proposta...</p>
              </div>
            ) : null}

            {content && !generating ? (
              <>
                <div className="flex items-center justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={downloading}
                    onClick={() => void handleDownload()}
                  >
                    Baixar PDF
                  </Button>
                </div>

                <PDFViewer
                  width="100%"
                  height={900}
                  showToolbar={false}
                  className="border-2 border-border"
                >
                  <ProposalPdfDocument input={formInput} content={content} />
                </PDFViewer>

                <div className="space-y-3">
                  <Textarea
                    label="Ajustar proposta"
                    value={adjustment}
                    onChange={(event) => setAdjustment(event.target.value)}
                    placeholder="O que você quer que a IA mude?"
                    rows={4}
                  />
                  <p className="text-xs normal-case text-muted-foreground">
                    {adjustment.trim()
                      ? 'A IA vai refazer a proposta inteira aplicando o seu pedido.'
                      : 'Escreva o que deve mudar.'}
                  </p>
                  <Button
                    size="lg"
                    disabled={!adjustment.trim() || regenerating}
                    loading={regenerating}
                    onClick={() => void handleRegenerate()}
                  >
                    Refazer proposta
                  </Button>
                  {regenerateError ? (
                    <p className="text-sm text-status-error">{regenerateError}</p>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </main>
      </div>

      <Dialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Propostas anteriores"
        className="max-w-lg"
      >
        {historyLoading ? (
          <div className="flex justify-center py-10">
            <span className="inline-block h-8 w-8 animate-spin border-2 border-accent border-t-transparent" />
          </div>
        ) : historyItems.length === 0 ? (
          <p className="py-6 text-sm normal-case text-muted-foreground">
            Nenhuma proposta salva ainda.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {historyItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full flex-col items-start gap-1 py-4 text-left transition-colors hover:text-accent"
                onClick={() => {
                  setHistoryOpen(false)
                  navigate(`/proposta/${item.id}`)
                }}
              >
                <span className="font-semibold text-foreground">
                  {item.content.projectTitle || 'Proposta sem título'}
                </span>
                <span className="text-xs normal-case text-muted-foreground tabular-nums">
                  {formatRelativeTime(item.createdAt)} ·{' '}
                  {formatCurrencyBRL(item.input.amountCents)}
                </span>
              </button>
            ))}
          </div>
        )}
      </Dialog>
    </div>
  )
}

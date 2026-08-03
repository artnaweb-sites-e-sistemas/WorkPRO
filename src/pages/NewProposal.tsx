import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { pdf } from '@react-pdf/renderer'
import {
  generateProposalAiContent,
  regenerateProposalAiContent,
} from '../ai/generateProposalDoc'
import { MarkAnchorGrid, MarkScaleSlider } from '../components/MarkPlacementPicker'
import { ProposalContentEditor } from '../components/ProposalContentEditor'
import { ProposalPdfPagedPreview } from '../components/ProposalPdfPagedPreview'
import { ProposalStatusSelector } from '../components/ProposalStatusSelector'
import { Button, Card, Input, Switch, Textarea, DownloadIcon, Spinner } from '../components/ui'
import { formatCurrencyBRL, maskCurrencyBRLInput, parseCurrencyBRL } from '../lib/currencyBRL'
import { fileToLogoDataUrl, fileToMarkDataUrl } from '../lib/logoImage'
import { buildProposalContent } from '../lib/proposalTerms'
import { ProposalPdfDocument } from '../pdf/ProposalPdfDocument'
import {
  DEFAULT_PROPOSAL_DEFAULTS,
  getProposalDefaults,
  saveProposalDefaults,
} from '../services/proposalDefaults'
import { createProposal, getProposal, updateProposal } from '../services/proposals'
import type {
  InstallmentKind,
  PaymentMethod,
  ProposalAiContent,
  ProposalContentDoc,
  ProposalDefaults,
  ProposalFormInput,
  ProposalPaymentTerms,
  ProposalRecurrence,
  RecurrenceStartTiming,
  ProposalStatus,
} from '../types/proposalDoc'
import {
  RECURRENCE_START_TIMING_OPTIONS,
  normalizeMarkAnchor,
  normalizeMarkScale,
} from '../types/proposalDoc'

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
    markAnchor: normalizeMarkAnchor(params.defaults.markAnchor),
    markScale: normalizeMarkScale(params.defaults.markScale),
    websiteUrl: params.defaults.websiteUrl.trim(),
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
  const proposalSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const defaultsHydrated = useRef(false)
  const skipProposalPersist = useRef(true)

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
  const [proposalStatus, setProposalStatus] = useState<ProposalStatus>('ativo')
  const [content, setContent] = useState<ProposalContentDoc | null>(null)
  const [aiContent, setAiContent] = useState<ProposalAiContent | null>(null)

  const [loadingDoc, setLoadingDoc] = useState(Boolean(routeId))
  const [generating, setGenerating] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [regenerateError, setRegenerateError] = useState('')
  const [adjustment, setAdjustment] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [savingEdits, setSavingEdits] = useState(false)

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

  /** Conteúdo exibido no PDF: textos da IA + termos recalculados do formulário. */
  const previewContent = useMemo(() => {
    if (!content) {
      return null
    }
    const ai = aiContent ?? extractAiContent(content)
    return buildProposalContent(formInput, ai)
  }, [content, aiContent, formInput])

  const pendingMessage = getPendingMessage(formInput)
  const canGenerate = !pendingMessage && !generating && !loadingDoc

  // Após gerar: qualquer ajuste do formulário atualiza o PDF e salva a proposta
  useEffect(() => {
    if (!proposalId || loadingDoc || generating) {
      return
    }

    const ai = aiContent ?? (content ? extractAiContent(content) : null)
    if (!ai) {
      return
    }

    if (skipProposalPersist.current) {
      skipProposalPersist.current = false
      return
    }

    if (proposalSaveTimer.current) {
      clearTimeout(proposalSaveTimer.current)
    }

    const built = buildProposalContent(formInput, ai)

    proposalSaveTimer.current = setTimeout(() => {
      void updateProposal(proposalId, { input: formInput, content: built })
        .then(() => {
          setContent(built)
        })
        .catch((error) => {
          console.error('[NewProposal] persistProposal', error)
        })
    }, 700)

    return () => {
      if (proposalSaveTimer.current) {
        clearTimeout(proposalSaveTimer.current)
      }
    }
    // content só entra para extrair AI na 1ª vez; mudanças de texto vêm de aiContent/formInput
    // eslint-disable-next-line react-hooks/exhaustive-deps -- evita loop ao setContent
  }, [proposalId, formInput, aiContent, loadingDoc, generating])

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

  const syncProposalBranding = useCallback(
    async (nextDefaults: ProposalDefaults) => {
      if (!proposalId) {
        return
      }

      const input = buildInputFromState({
        defaults: nextDefaults,
        projectContext,
        amountCents: parseCurrencyBRL(amountDisplay),
        payment,
        recurrence,
        validityDays,
      })

      try {
        await updateProposal(proposalId, { input })
      } catch (error) {
        console.error('[NewProposal] syncProposalBranding', error)
      }
    },
    [proposalId, projectContext, amountDisplay, payment, recurrence, validityDays],
  )

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
    // Com proposta na URL, a hidratação fica a cargo do efeito do documento
    if (routeId) {
      return
    }

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
  }, [routeId])

  useEffect(() => {
    if (!routeId) {
      setLoadingDoc(false)
      return
    }

    let cancelled = false
    setLoadingDoc(true)

    void Promise.all([getProposal(routeId), getProposalDefaults()])
      .then(([doc, savedDefaults]) => {
        if (cancelled) {
          return
        }

        if (!doc) {
          navigate('/proposta', { replace: true })
          return
        }

        defaultsHydrated.current = false

        const mergedDefaults: ProposalDefaults = {
          logoDataUrl: doc.input.logoDataUrl || savedDefaults.logoDataUrl,
          markDataUrl: doc.input.markDataUrl || savedDefaults.markDataUrl,
          markAnchor: normalizeMarkAnchor(doc.input.markAnchor ?? savedDefaults.markAnchor),
          markScale: normalizeMarkScale(doc.input.markScale ?? savedDefaults.markScale),
          companyName: doc.input.companyName || savedDefaults.companyName,
          companyAbout: doc.input.companyAbout || savedDefaults.companyAbout,
          professionalName: doc.input.professionalName || savedDefaults.professionalName,
          websiteUrl: doc.input.websiteUrl || savedDefaults.websiteUrl,
          tagline: doc.input.tagline || savedDefaults.tagline,
        }

        setDefaults(mergedDefaults)
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
        setProposalStatus(doc.status ?? 'ativo')
        setContent(doc.content)
        setAiContent(extractAiContent(doc.content))
        setLoadingDoc(false)
        skipProposalPersist.current = true

        // Backfill: proposta antiga sem símbolo, mas defaults já têm
        const needsBrandSync =
          (!doc.input.markDataUrl && mergedDefaults.markDataUrl) ||
          (!doc.input.logoDataUrl && mergedDefaults.logoDataUrl)

        if (needsBrandSync) {
          const input = {
            ...doc.input,
            logoDataUrl: mergedDefaults.logoDataUrl,
            markDataUrl: mergedDefaults.markDataUrl,
          }
          void updateProposal(doc.id, { input }).catch((error) => {
            console.error('[NewProposal] backfill branding', error)
          })
        }

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
      setDefaults((current) => {
        const next = { ...current, logoDataUrl: dataUrl }
        if (defaultsHydrated.current) {
          persistDefaults(next)
          queueMicrotask(() => {
            void syncProposalBranding(next)
          })
        }
        return next
      })
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
      const dataUrl = await fileToMarkDataUrl(file)
      setDefaults((current) => {
        const next = { ...current, markDataUrl: dataUrl }
        if (defaultsHydrated.current) {
          persistDefaults(next)
          queueMicrotask(() => {
            void syncProposalBranding(next)
          })
        }
        return next
      })
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
      setProposalStatus('ativo')
      setEditMode(false)
      skipProposalPersist.current = true
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
      setEditMode(false)
      skipProposalPersist.current = true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao refazer a proposta.'
      setRegenerateError(message)
    } finally {
      setRegenerating(false)
    }
  }

  async function handleDownload() {
    if (!previewContent || downloading) {
      return
    }

    setDownloading(true)

    try {
      const blob = await pdf(
        <ProposalPdfDocument input={formInput} content={previewContent} />,
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      const filename = `Proposta - ${sanitizeFilename(formInput.companyName)} - ${sanitizeFilename(previewContent.projectTitle)}.pdf`
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

  async function applyContentEdits(ai: ProposalAiContent) {
    const built = buildProposalContent(formInput, ai)
    setContent(built)
    setAiContent(ai)

    if (proposalId) {
      setSavingEdits(true)
      try {
        await updateProposal(proposalId, { input: formInput, content: built })
      } catch (error) {
        console.error('[NewProposal] applyContentEdits', error)
      } finally {
        setSavingEdits(false)
      }
    }
  }

  function handleEditModeChange(checked: boolean) {
    if (checked) {
      if (content && !aiContent) {
        setAiContent(extractAiContent(content))
      }
      setEditMode(true)
      return
    }

    if (aiContent) {
      void applyContentEdits(aiContent).then(() => setEditMode(false))
      return
    }

    setEditMode(false)
  }

  if (loadingDoc) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size="lg" />
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
                to="/?tab=propostas"
                className="text-xs font-bold uppercase tracking-tight text-muted-foreground transition-colors hover:text-accent"
              >
                ← Voltar
              </Link>
              <h1 className="mt-3 text-3xl font-bold uppercase tracking-tighter text-foreground">
                Nova proposta
              </h1>
              {proposalId ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <ProposalStatusSelector
                    proposalId={proposalId}
                    status={proposalStatus}
                    onStatusChange={setProposalStatus}
                  />
                </div>
              ) : null}
            </div>
            {content ? (
              <div className="self-end">
                <Switch
                  id="edit-proposal"
                  label={editMode ? 'Editando' : 'Editar proposta'}
                  checked={editMode}
                  disabled={generating || regenerating || savingEdits}
                  onChange={handleEditModeChange}
                />
              </div>
            ) : null}
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
                  <p className="kinetic-label mb-2">Logo</p>
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
                      Enviar logo
                    </Button>
                  )}
                  <p className="mt-2 text-xs normal-case text-muted-foreground">
                    Prefira uma logo clara (capa escura).
                  </p>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,.png,.jpg,.jpeg,.webp,.gif,.bmp"
                    className="hidden"
                    onChange={(event) => void handleLogoChange(event)}
                  />
                  {logoError ? (
                    <p className="mt-2 text-xs text-status-error">{logoError}</p>
                  ) : null}
                </div>

                <div>
                  <p className="kinetic-label mb-2">Símbolo da marca</p>
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
                      <MarkAnchorGrid
                        anchor={defaults.markAnchor}
                        onChange={(markAnchor) => updateDefaults({ markAnchor })}
                      />
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => markInputRef.current?.click()}
                    >
                      Enviar símbolo
                    </Button>
                  )}
                  <p className="mt-2 text-xs normal-case text-muted-foreground">
                    Marca d&apos;água nas páginas de conteúdo. Prefira imagem escura.
                  </p>
                  {defaults.markDataUrl ? (
                    <div className="mt-3">
                      <MarkScaleSlider
                        scale={defaults.markScale}
                        onChange={(markScale) => updateDefaults({ markScale })}
                      />
                    </div>
                  ) : null}
                  <input
                    ref={markInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,.png,.jpg,.jpeg,.webp,.gif,.bmp"
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

                <Input
                  label="Site"
                  value={defaults.websiteUrl}
                  onChange={(event) => updateDefaults({ websiteUrl: event.target.value })}
                  onBlur={() => persistDefaults(defaults)}
                  placeholder="www.suaempresa.com.br"
                  hint="Aparece no rodapé do PDF, acima da linha, à direita."
                />

                <Textarea
                  label="Sobre a empresa"
                  value={defaults.companyAbout}
                  onChange={(event) => updateDefaults({ companyAbout: event.target.value })}
                  onBlur={() => persistDefaults(defaults)}
                  rows={4}
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

              {!content ? (
                <div className="mt-6 border-t border-border pt-6">
                  <p className="mb-3 text-xs normal-case text-muted-foreground">
                    {pendingMessage ?? 'A IA escreve a proposta e gera o PDF.'}
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
              ) : (
                <div className="mt-6 border-t border-border pt-6">
                  <p className="text-xs normal-case text-muted-foreground">
                    Alterações neste formulário atualizam o PDF automaticamente.
                  </p>
                </div>
              )}
            </Card>
          </aside>

          <div className="flex flex-1 flex-col gap-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
              <div className="min-w-0 flex-1">
                <Input
                  label="Nome do cliente/projeto"
                  value={defaults.tagline}
                  onChange={(event) => updateDefaults({ tagline: event.target.value })}
                  onBlur={() => persistDefaults(defaults)}
                  placeholder="Ex: Clínica Sorriso / João Silva"
                />
              </div>
              {content && !generating ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  loading={downloading}
                  onClick={() => void handleDownload()}
                >
                  <DownloadIcon />
                  Baixar PDF
                </Button>
              ) : null}
            </div>

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
                <Spinner size="lg" />
                <p className="text-sm normal-case text-muted-foreground">Escrevendo a proposta...</p>
              </div>
            ) : null}

            {content && !generating ? (
              <>
                {editMode && aiContent ? (
                  <ProposalContentEditor
                    value={aiContent}
                    onChange={setAiContent}
                    showRecurringLabel={recurrenceEnabled}
                  />
                ) : previewContent ? (
                  <ProposalPdfPagedPreview input={formInput} content={previewContent} />
                ) : null}

                {!editMode ? (
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
                ) : null}
              </>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}

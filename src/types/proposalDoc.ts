import type { Timestamp } from 'firebase/firestore'

export type ProposalStatus = 'ativo' | 'fechado' | 'perdido'

export type PaymentMethod = 'avista' | 'metade' | 'metade_conclusao' | 'parcelado'
export type InstallmentKind = 'boleto' | 'cartao'


export type RecurrenceStartTiming =
  | 'ato_contratacao'
  | 'logo_apos_entrega'
  | '30_dias_apos_entrega'

/** Âncora da marca d'água na página — grade de 9 posições. */
export type MarkAnchor =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

/** Ordem de leitura da grade 3x3 (linha por linha). */
export const MARK_ANCHOR_GRID: { value: MarkAnchor; label: string }[] = [
  { value: 'top-left', label: 'Superior esquerda' },
  { value: 'top-center', label: 'Superior centro' },
  { value: 'top-right', label: 'Superior direita' },
  { value: 'middle-left', label: 'Meio esquerda' },
  { value: 'middle-center', label: 'Meio centro' },
  { value: 'middle-right', label: 'Meio direita' },
  { value: 'bottom-left', label: 'Inferior esquerda' },
  { value: 'bottom-center', label: 'Inferior centro' },
  { value: 'bottom-right', label: 'Inferior direita' },
]

/** Tamanho do símbolo em % da largura da página. */
export const MARK_SCALE_MIN = 15
export const MARK_SCALE_MAX = 90
export const DEFAULT_MARK_ANCHOR: MarkAnchor = 'middle-right'
export const DEFAULT_MARK_SCALE = 52
/** Amarelo original do template PDF — fallback da cor de destaque */
export const DEFAULT_ACCENT_COLOR = '#FFDE59'

export function normalizeMarkAnchor(value: unknown): MarkAnchor {
  return MARK_ANCHOR_GRID.some((option) => option.value === value)
    ? (value as MarkAnchor)
    : DEFAULT_MARK_ANCHOR
}

export function normalizeMarkScale(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_MARK_SCALE
  }

  return Math.min(MARK_SCALE_MAX, Math.max(MARK_SCALE_MIN, Math.round(value)))
}

/** Aceita #RGB ou #RRGGBB; inválido volta ao amarelo padrão. */
export function normalizeAccentColor(value: unknown): string {
  if (typeof value !== 'string') {
    return DEFAULT_ACCENT_COLOR
  }

  const trimmed = value.trim()
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return trimmed.toUpperCase()
  }

  if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
    const r = trimmed[1]
    const g = trimmed[2]
    const b = trimmed[3]
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }

  return DEFAULT_ACCENT_COLOR
}

/** Canais R G B (ex.: "255 222 89") para Tailwind com opacidade. */
export function accentColorRgbChannels(value: unknown): string {
  const hex = normalizeAccentColor(value)
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return `${r} ${g} ${b}`
}

/** Texto sobre a cor de destaque: preto em fundo claro, branco em fundo escuro. */
export function accentForegroundColor(value: unknown): string {
  const hex = normalizeAccentColor(value)
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luma > 0.55 ? '#000000' : '#FFFFFF'
}

export interface ProposalPaymentTerms {
  method: PaymentMethod
  /** 2..12, apenas quando method === 'parcelado'; senão null */
  installments: number | null
  /** apenas quando method === 'parcelado'; senão null */
  installmentKind: InstallmentKind | null
}

/** Item opcional oferecido à parte do valor do projeto. */
export interface ProposalExtraItem {
  title: string
  /** centavos; 0 significa "sob consulta" */
  amountCents: number
  /** 'ai' = veio da IA e pode ser substituído numa nova geração; 'manual' = preservado */
  source: 'ai' | 'manual'
  /** quando true, o valor sai no PDF como R$ x,00/mês */
  recurring: boolean
}

export interface ProposalExtras {
  enabled: boolean
  /** quando true, a IA gera os adicionais junto com a proposta */
  aiSuggest: boolean
  items: ProposalExtraItem[]
}

export const EMPTY_PROPOSAL_EXTRAS: ProposalExtras = {
  enabled: false,
  aiSuggest: false,
  items: [],
}

export function normalizeExtras(raw: unknown): ProposalExtras {
  if (!raw || typeof raw !== 'object') {
    return EMPTY_PROPOSAL_EXTRAS
  }

  const record = raw as { enabled?: unknown; aiSuggest?: unknown; items?: unknown }
  const items = Array.isArray(record.items)
    ? record.items
        .map((item) => {
          const entry = item as {
            title?: unknown
            amountCents?: unknown
            source?: unknown
            recurring?: unknown
          }
          return {
            title: typeof entry.title === 'string' ? entry.title.trim() : '',
            amountCents:
              typeof entry.amountCents === 'number' && entry.amountCents > 0
                ? Math.round(entry.amountCents)
                : 0,
            source: entry.source === 'ai' ? ('ai' as const) : ('manual' as const),
            recurring: entry.recurring === true,
          }
        })
        .filter((item) => item.title.length > 0)
    : []

  return {
    enabled: record.enabled === true,
    aiSuggest: record.aiSuggest === true,
    items,
  }
}

export interface ProposalRecurrence {
  enabled: boolean
  /** centavos; null quando enabled === false */
  amountCents: number | null
  /** quando começa a recorrência; null quando enabled === false */
  startTiming: RecurrenceStartTiming | null
  /** nome do serviço mensal (ex.: Hospedagem e manutenção); null quando enabled === false */
  title: string | null
  /** o que a recorrência cobre; gerado pela IA, editável; null quando enabled === false */
  description: string | null
}

/** Dados fixos que persistem entre propostas — users/{uid}/settings/proposalDefaults */
export interface ProposalDefaults {
  /** data URL PNG já redimensionada — logo clara da capa */
  logoDataUrl: string
  /** data URL PNG do símbolo da marca — marca d'água nas páginas de conteúdo */
  markDataUrl: string
  /** posição da marca d'água na página */
  markAnchor: MarkAnchor
  /** tamanho da marca d'água em % da largura da página */
  markScale: number
  companyName: string
  companyAbout: string
  professionalName: string
  /** site da empresa — aparece acima da linha do rodapé, à direita */
  websiteUrl: string
  /** cor de destaque do PDF (substitui o amarelo do template) */
  accentColor: string
  /**
   * legado nos defaults (não editar na UI).
   * Nome do cliente/projeto vive em ProposalFormInput.tagline por proposta.
   */
  tagline: string
  /**
   * Piloto 45: inclui o slide/página "Se fizer sentido continuar"
   * na apresentação e no PDF para WhatsApp.
   */
  pilotoShowContinuation: boolean
}

export interface ProposalFormInput {
  companyName: string
  companyAbout: string
  professionalName: string
  /** nome do cliente/projeto — capa e lista; por proposta */
  tagline: string
  logoDataUrl: string
  markDataUrl: string
  markAnchor: MarkAnchor
  markScale: number
  /** site da empresa (opcional) */
  websiteUrl: string
  /** cor de destaque do PDF */
  accentColor: string
  /** janela de contexto: o que o usuário escreve sobre o projeto */
  projectContext: string
  /** valor total do projeto, em centavos */
  amountCents: number
  payment: ProposalPaymentTerms
  recurrence: ProposalRecurrence
  /** itens opcionais impressos entre "Investimento" e "Próximos passos" */
  extras: ProposalExtras
  /** validade da proposta em dias (impressa no rodapé da última página) */
  validityDays: number
}

/** O que a IA gera. Valores e forma de pagamento NÃO passam pela IA. */
export interface ProposalAiContent {
  projectTitle: string
  projectSubtitle: string
  aboutText: string
  includedItems: string[]
  /** null quando o projeto não depende de nada que o cliente precise liberar */
  prerequisiteBody: string | null
  howItWorks: { stage: string; description: string }[]
  /** rótulo da linha de setup na tabela de investimento */
  setupLabel: string
  /** rótulo da linha de recorrência; usado só quando recurrence.enabled */
  recurringLabel: string
  /** texto explicando o que a recorrência cobre; vazio quando desligada */
  recurringDescription: string
  /** passos de execução do projeto, SEM passos de pagamento (o sistema monta esses) */
  projectSteps: string[]
  closingParagraph: string
}

export const PROPOSAL_SECTION_IDS = [
  'about',
  'included',
  'prerequisite',
  'howItWorks',
  'investment',
  'extras',
  'nextSteps',
] as const

export type ProposalSectionId = (typeof PROPOSAL_SECTION_IDS)[number]

/** Quando true, a seção começa numa página nova do PDF. */
export type ProposalPageBreaks = Partial<Record<ProposalSectionId, boolean>>

export function normalizePageBreaks(raw: unknown): ProposalPageBreaks {
  if (!raw || typeof raw !== 'object') {
    return {}
  }

  const record = raw as Record<string, unknown>
  const next: ProposalPageBreaks = {}
  for (const id of PROPOSAL_SECTION_IDS) {
    if (record[id] === true) {
      next[id] = true
    }
  }
  return next
}

/** IA + campos derivados deterministicamente pelo sistema */
export interface ProposalContentDoc extends ProposalAiContent {
  investmentRows: { label: string; value: string }[]
  paymentNote: string
  nextSteps: string[]
  pageBreaks: ProposalPageBreaks
}

export interface ProposalDoc {
  id: string
  ownerUid: string
  input: ProposalFormInput
  content: ProposalContentDoc
  status: ProposalStatus
  createdAt: Timestamp
  updatedAt: Timestamp
}

export const RECURRENCE_START_TIMING_OPTIONS: {
  value: RecurrenceStartTiming
  label: string
}[] = [
  { value: 'ato_contratacao', label: 'Ato da contratação' },
  { value: 'logo_apos_entrega', label: 'Logo após a entrega' },
  { value: '30_dias_apos_entrega', label: '30 dias após a entrega' },
]

export function formatRecurrenceStartTiming(timing: RecurrenceStartTiming): string {
  const match = RECURRENCE_START_TIMING_OPTIONS.find((option) => option.value === timing)
  return match?.label ?? timing
}

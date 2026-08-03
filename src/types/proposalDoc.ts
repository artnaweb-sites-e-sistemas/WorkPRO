import type { Timestamp } from 'firebase/firestore'

export type ProposalStatus = 'ativo' | 'fechado' | 'perdido'

export type PaymentMethod = 'avista' | 'metade' | 'parcelado'
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

export interface ProposalPaymentTerms {
  method: PaymentMethod
  /** 2..12, apenas quando method === 'parcelado'; senão null */
  installments: number | null
  /** apenas quando method === 'parcelado'; senão null */
  installmentKind: InstallmentKind | null
}

export interface ProposalRecurrence {
  enabled: boolean
  /** centavos; null quando enabled === false */
  amountCents: number | null
  /** quando começa a recorrência; null quando enabled === false */
  startTiming: RecurrenceStartTiming | null
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
  /** linha sob o logo na capa e título na lista. Default: 'Desenvolvimento web & sistemas' */
  tagline: string
}

export interface ProposalFormInput {
  companyName: string
  companyAbout: string
  professionalName: string
  tagline: string
  logoDataUrl: string
  markDataUrl: string
  markAnchor: MarkAnchor
  markScale: number
  /** site da empresa (opcional) */
  websiteUrl: string
  /** janela de contexto: o que o usuário escreve sobre o projeto */
  projectContext: string
  /** valor total do projeto, em centavos */
  amountCents: number
  payment: ProposalPaymentTerms
  recurrence: ProposalRecurrence
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
  /** passos de execução do projeto, SEM passos de pagamento (o sistema monta esses) */
  projectSteps: string[]
  closingParagraph: string
}

/** IA + campos derivados deterministicamente pelo sistema */
export interface ProposalContentDoc extends ProposalAiContent {
  investmentRows: { label: string; value: string }[]
  paymentNote: string
  nextSteps: string[]
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

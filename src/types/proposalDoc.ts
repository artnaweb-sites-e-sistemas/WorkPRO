import type { Timestamp } from 'firebase/firestore'

export type ProposalStatus = 'ativo' | 'fechado' | 'perdido'

export type PaymentMethod = 'avista' | 'metade' | 'parcelado'
export type InstallmentKind = 'boleto' | 'cartao'


export type RecurrenceStartTiming =
  | 'ato_contratacao'
  | 'logo_apos_entrega'
  | '30_dias_apos_entrega'

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
  /** 2 a 3 passos de execução do projeto, SEM passos de pagamento */
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

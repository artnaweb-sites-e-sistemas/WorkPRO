import type { Timestamp } from 'firebase/firestore'
import type { MarkAnchor, ProposalDefaults, ProposalStatus } from './proposalDoc'
import {
  DEFAULT_ACCENT_COLOR,
  normalizeAccentColor,
  normalizeMarkAnchor,
  normalizeMarkScale,
} from './proposalDoc'

const DEFAULT_INSTALLMENT_FEE_RATE = 0.1506

export type SituationAnswer = 'sim' | 'nao' | 'nao_sei'

export interface PilotoInput {
  companyName: string
  professionalName: string
  /** logo clara, para fundo escuro (capa e fechamento) */
  logoDataUrl: string
  /** símbolo da marca: marca d'água e assinatura das páginas claras */
  markDataUrl: string
  markAnchor: MarkAnchor
  markScale: number
  websiteUrl: string
  accentColor: string

  leadCompanyName: string
  leadNiche: string
  leadCity: string
  leadOffer: string
  ticketCents: number

  hasWebsite: SituationAnswer
  runsAds: SituationAnswer
  whatsappOrganized: SituationAnswer

  contextNotes: string

  installmentFeeRate: number
  validityDays: number
}

export interface PilotoAiContent {
  diagnosisHeadline: string
  diagnosisLines: string[]
  funnelTopLabel: string
  funnelMiddleLabel: string
  funnelBottomLabel: string
  adAngles: { title: string; description: string }[]
  /** conversa de exemplo no WhatsApp, alternando cliente e atendimento: [cliente, IA, cliente, IA] */
  chatMessages: string[]
  closingParagraph: string
}

export interface PilotoDoc {
  id: string
  ownerUid: string
  input: PilotoInput
  content: PilotoAiContent
  status: ProposalStatus
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** Limites de caracteres dos textos da IA. Usados pela geração e pelo editor. */
export const PILOTO_TEXT_LIMITS = {
  diagnosisHeadline: 70,
  diagnosisLine: 110,
  /** Coluna do funil no PDF: pode quebrar em várias linhas, sem cortar com reticências */
  funnelLabel: 90,
  angleTitle: 40,
  angleDescription: 110,
  chatMessage: 90,
  closingParagraph: 200,
} as const

export const CHAT_MESSAGE_COUNT = 4

export const EMPTY_PILOTO_AI_CONTENT: PilotoAiContent = {
  diagnosisHeadline: '',
  diagnosisLines: ['', '', ''],
  funnelTopLabel: '',
  funnelMiddleLabel: '',
  funnelBottomLabel: '',
  adAngles: [
    { title: '', description: '' },
    { title: '', description: '' },
    { title: '', description: '' },
  ],
  chatMessages: ['', '', '', ''],
  closingParagraph: '',
}

const SITUATION_ANSWERS: SituationAnswer[] = ['sim', 'nao', 'nao_sei']

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Remove reticências no fim (a IA às vezes corta a frase com "..."). */
function asFunnelLabel(value: unknown): string {
  return asString(value)
    .replace(/(?:\s*\.{3}|\s*…)+$/u, '')
    .trimEnd()
}

/** Texto digitado pelo usuário: sem trim, senão o espaço some enquanto ele digita. */
function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asFiniteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function normalizeSituationAnswer(value: unknown): SituationAnswer {
  return SITUATION_ANSWERS.includes(value as SituationAnswer)
    ? (value as SituationAnswer)
    : 'nao_sei'
}

export function normalizePilotoAiContent(raw: unknown): PilotoAiContent {
  if (!raw || typeof raw !== 'object') {
    return {
      ...EMPTY_PILOTO_AI_CONTENT,
      diagnosisLines: ['', '', ''],
      adAngles: EMPTY_PILOTO_AI_CONTENT.adAngles.map((item) => ({ ...item })),
      chatMessages: ['', '', '', ''],
    }
  }

  const record = raw as Record<string, unknown>

  const diagnosisLinesRaw = Array.isArray(record.diagnosisLines) ? record.diagnosisLines : []
  const diagnosisLines = [0, 1, 2].map((index) => {
    const value = diagnosisLinesRaw[index]
    return typeof value === 'string' ? value.trim() : ''
  })

  const adAnglesRaw = Array.isArray(record.adAngles) ? record.adAngles : []
  const adAngles = [0, 1, 2].map((index) => {
    const item = adAnglesRaw[index]
    if (!item || typeof item !== 'object') {
      return { title: '', description: '' }
    }
    const entry = item as { title?: unknown; description?: unknown }
    return {
      title: typeof entry.title === 'string' ? entry.title.trim() : '',
      description: typeof entry.description === 'string' ? entry.description.trim() : '',
    }
  })

  const chatRaw = Array.isArray(record.chatMessages) ? record.chatMessages : []
  const chatMessages = Array.from({ length: CHAT_MESSAGE_COUNT }, (_, index) => {
    const value = chatRaw[index]
    return typeof value === 'string' ? value.trim() : ''
  })

  return {
    diagnosisHeadline: asString(record.diagnosisHeadline),
    diagnosisLines,
    funnelTopLabel: asFunnelLabel(record.funnelTopLabel),
    funnelMiddleLabel: asFunnelLabel(record.funnelMiddleLabel),
    funnelBottomLabel: asFunnelLabel(record.funnelBottomLabel),
    adAngles,
    chatMessages,
    closingParagraph: asString(record.closingParagraph),
  }
}

export function normalizePilotoInput(raw: unknown): PilotoInput {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

  const ticketCents = asFiniteNumber(record.ticketCents)
  let installmentFeeRate = asFiniteNumber(record.installmentFeeRate)
  if (installmentFeeRate < 0 || installmentFeeRate > 0.5) {
    installmentFeeRate = DEFAULT_INSTALLMENT_FEE_RATE
  }

  let validityDays = Math.round(asFiniteNumber(record.validityDays))
  if (validityDays < 1 || validityDays > 90) {
    validityDays = 15
  }

  return {
    companyName: asText(record.companyName),
    professionalName: asText(record.professionalName),
    logoDataUrl: typeof record.logoDataUrl === 'string' ? record.logoDataUrl : '',
    markDataUrl: typeof record.markDataUrl === 'string' ? record.markDataUrl : '',
    markAnchor: normalizeMarkAnchor(record.markAnchor),
    markScale: normalizeMarkScale(record.markScale),
    websiteUrl: asText(record.websiteUrl),
    accentColor: normalizeAccentColor(record.accentColor ?? DEFAULT_ACCENT_COLOR),
    leadCompanyName: asText(record.leadCompanyName),
    leadNiche: asText(record.leadNiche),
    leadCity: asText(record.leadCity),
    leadOffer: asText(record.leadOffer),
    ticketCents: ticketCents > 0 ? Math.round(ticketCents) : 0,
    hasWebsite: normalizeSituationAnswer(record.hasWebsite),
    runsAds: normalizeSituationAnswer(record.runsAds),
    whatsappOrganized: normalizeSituationAnswer(record.whatsappOrganized),
    contextNotes: asText(record.contextNotes),
    installmentFeeRate,
    validityDays,
  }
}

/**
 * Marca do usuário vem dos defaults da proposta. Campo vazio no piloto é preenchido
 * com o default (piloto antigo, sem símbolo, passa a ter). O símbolo leva junto
 * posição e tamanho, porque os três só fazem sentido juntos.
 */
export function applyBrandDefaults(input: PilotoInput, defaults: ProposalDefaults): PilotoInput {
  const takeMark = !input.markDataUrl && Boolean(defaults.markDataUrl)

  return {
    ...input,
    companyName: input.companyName.trim() ? input.companyName : defaults.companyName,
    professionalName: input.professionalName.trim()
      ? input.professionalName
      : defaults.professionalName,
    logoDataUrl: input.logoDataUrl || defaults.logoDataUrl,
    websiteUrl: input.websiteUrl.trim() ? input.websiteUrl : defaults.websiteUrl,
    markDataUrl: takeMark ? defaults.markDataUrl : input.markDataUrl,
    markAnchor: takeMark ? normalizeMarkAnchor(defaults.markAnchor) : input.markAnchor,
    markScale: takeMark ? normalizeMarkScale(defaults.markScale) : input.markScale,
  }
}

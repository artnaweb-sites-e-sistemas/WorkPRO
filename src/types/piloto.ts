import type { Timestamp } from 'firebase/firestore'
import type { ProposalStatus } from './proposalDoc'
import { DEFAULT_ACCENT_COLOR, normalizeAccentColor } from './proposalDoc'

const DEFAULT_INSTALLMENT_FEE_RATE = 0.1506

export type SituationAnswer = 'sim' | 'nao' | 'nao_sei'

export interface PilotoInput {
  companyName: string
  professionalName: string
  logoDataUrl: string
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

  toolScreenshots: string[]

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
  closingParagraph: '',
}

const SITUATION_ANSWERS: SituationAnswer[] = ['sim', 'nao', 'nao_sei']

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
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
    return { ...EMPTY_PILOTO_AI_CONTENT, diagnosisLines: ['', '', ''], adAngles: EMPTY_PILOTO_AI_CONTENT.adAngles.map((item) => ({ ...item })) }
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

  return {
    diagnosisHeadline: asString(record.diagnosisHeadline),
    diagnosisLines,
    funnelTopLabel: asString(record.funnelTopLabel),
    funnelMiddleLabel: asString(record.funnelMiddleLabel),
    funnelBottomLabel: asString(record.funnelBottomLabel),
    adAngles,
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

  const screenshotsRaw = Array.isArray(record.toolScreenshots) ? record.toolScreenshots : []
  const toolScreenshots = screenshotsRaw
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, 3)

  return {
    companyName: asString(record.companyName),
    professionalName: asString(record.professionalName),
    logoDataUrl: typeof record.logoDataUrl === 'string' ? record.logoDataUrl : '',
    websiteUrl: asString(record.websiteUrl),
    accentColor: normalizeAccentColor(record.accentColor ?? DEFAULT_ACCENT_COLOR),
    leadCompanyName: asString(record.leadCompanyName),
    leadNiche: asString(record.leadNiche),
    leadCity: asString(record.leadCity),
    leadOffer: asString(record.leadOffer),
    ticketCents: ticketCents > 0 ? Math.round(ticketCents) : 0,
    hasWebsite: normalizeSituationAnswer(record.hasWebsite),
    runsAds: normalizeSituationAnswer(record.runsAds),
    whatsappOrganized: normalizeSituationAnswer(record.whatsappOrganized),
    contextNotes: asString(record.contextNotes),
    toolScreenshots,
    installmentFeeRate,
    validityDays,
  }
}

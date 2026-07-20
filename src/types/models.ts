import type { Timestamp } from 'firebase/firestore'
import type { ProposalContent } from './proposal'

export type Stage = 'abordagem' | 'relacionamento' | 'videocall' | 'orcamento' | 'fechamento'

export type ConversationChannel = 'workana' | 'whatsapp'

export type ConversationStatus = 'ativo' | 'fechado' | 'perdido'

export type Sender = 'cliente' | 'eu'

export interface ConversationServiceSnapshot {
  name: string
  description: string
}

export interface Conversation {
  id: string
  ownerUid: string
  clientName: string
  projectTitle: string
  projectDetails: string
  channel: ConversationChannel
  services: ConversationServiceSnapshot[]
  stage: Stage
  previousStage: Stage | null
  relationshipCount: number
  videoCallEnabled: boolean
  videoCallDone: boolean
  induceQuote: boolean
  suggestedPrice: string | null
  suggestedRecurringPrice: string | null
  isRecurring: boolean
  collectedInfo: string
  proposalContent: ProposalContent | null
  proposalText: string | null
  proposalUpdatedAt: Timestamp | null
  meetingScript: string | null
  meetingScriptUpdatedAt: Timestamp | null
  status: ConversationStatus
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Message {
  id: string
  sender: Sender
  stage: Stage
  text: string
  createdAt: Timestamp
}

export type ConversationUpdate = Partial<
  Omit<Conversation, 'id' | 'ownerUid' | 'createdAt'>
>

export interface Service {
  id: string
  name: string
  description: string
}

export interface PresenterProfile {
  nome: string
  empresa: string
  areas: string
  desde: string
  provaSocial: string
  tom: string
  temBriefing: boolean
  briefingInfo: string
}

export const DEFAULT_PRESENTER_PROFILE: PresenterProfile = {
  nome: 'Bira',
  empresa: 'Artnaweb',
  areas: 'web design, criação de sistemas, programação, gestão de tráfego, edição de vídeo',
  desde: '2015',
  provaSocial: 'mais de 100 projetos entregues na Workana, todos com satisfação máxima',
  tom: 'um pouco formal e um pouco informal (equilíbrio)',
  temBriefing: true,
  briefingInfo: 'formulário de briefing próprio',
}

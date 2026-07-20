import type { Conversation, Message, Sender, Stage } from '../types/models'

export interface NextStageResult {
  stage: Stage
  label: string
}

function relationshipLabel(relationshipCount: number): string {
  const next = relationshipCount + 1
  return next > 1 ? `Relacionamento (${next})` : 'Relacionamento'
}

function shouldInduceVideoCall(videoCallEnabled: boolean, videoCallDone: boolean): boolean {
  return videoCallEnabled && !videoCallDone
}

export function hasBudgetBeenSent(conversation: Conversation, messages: Message[]): boolean {
  if (conversation.stage === 'orcamento' || conversation.stage === 'fechamento') {
    return true
  }

  return messages.some((message) => message.sender === 'eu' && message.stage === 'orcamento')
}

export function resolveStepperStage(conversation: Conversation): Stage {
  const { stage, videoCallEnabled } = conversation

  if (videoCallEnabled && stage === 'relacionamento') {
    return 'videocall'
  }

  if (!videoCallEnabled && stage === 'videocall') {
    return 'relacionamento'
  }

  return stage
}

export function computeNextStage(
  conversation: Conversation,
  lastMessageSender: Sender | null,
): NextStageResult {
  const { stage, relationshipCount, videoCallEnabled, videoCallDone } = conversation
  const induceVideoCall = shouldInduceVideoCall(videoCallEnabled, videoCallDone)

  if (lastMessageSender === null) {
    return { stage: 'abordagem', label: 'Abordagem' }
  }

  if (stage === 'fechamento') {
    return { stage: 'fechamento', label: 'Fechamento' }
  }

  if (stage === 'orcamento') {
    if (lastMessageSender === 'cliente') {
      return { stage: 'fechamento', label: 'Fechamento' }
    }

    return { stage: 'orcamento', label: 'Orçamento' }
  }

  if (stage === 'videocall') {
    return { stage: 'videocall', label: 'Vídeo chamada' }
  }

  if (stage === 'abordagem' && lastMessageSender === 'cliente') {
    if (induceVideoCall) {
      return { stage: 'videocall', label: 'Vídeo chamada' }
    }

    return { stage: 'relacionamento', label: relationshipLabel(relationshipCount) }
  }

  if (stage === 'abordagem') {
    return { stage: 'abordagem', label: 'Abordagem' }
  }

  if (stage === 'relacionamento' && lastMessageSender === 'cliente' && induceVideoCall) {
    return { stage: 'videocall', label: 'Vídeo chamada' }
  }

  if (stage === 'relacionamento') {
    return { stage: 'relacionamento', label: relationshipLabel(relationshipCount) }
  }

  return { stage: 'abordagem', label: 'Abordagem' }
}

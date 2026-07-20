export type ProposalChannel = 'workana' | 'whatsapp'

export interface ProposalContent {
  intro: string
  topics: string[]
  reassurance: string
  netPrice: number
  recurringNetPrice: number | null
  prazo: string
}

export function parseStoredProposalContent(data: unknown): ProposalContent | null {
  if (!data || typeof data !== 'object') {
    return null
  }

  const record = data as Record<string, unknown>
  const topics = Array.isArray(record.topics)
    ? record.topics.filter(
        (topic): topic is string => typeof topic === 'string' && topic.trim().length > 0,
      )
    : []

  const intro = typeof record.intro === 'string' ? record.intro.trim() : ''
  const reassurance = typeof record.reassurance === 'string' ? record.reassurance.trim() : ''
  const prazo = typeof record.prazo === 'string' ? record.prazo.trim() : ''
  const netPrice =
    typeof record.netPrice === 'number' && record.netPrice > 0 ? record.netPrice : 0
  const recurringNetPrice =
    typeof record.recurringNetPrice === 'number' && record.recurringNetPrice > 0
      ? record.recurringNetPrice
      : null

  if (!intro && topics.length === 0 && !reassurance) {
    return null
  }

  return {
    intro,
    topics,
    reassurance,
    netPrice,
    recurringNetPrice,
    prazo: prazo || 'A combinar após o briefing',
  }
}

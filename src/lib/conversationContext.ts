import type { Conversation, ConversationChannel } from '../types/models'

export function buildServicesContextSection(conversation: Conversation): string | null {
  const services = conversation.services.filter((service) => service.name.trim())

  if (services.length === 0) {
    return null
  }

  const lines = services.map((service) => {
    const description = service.description.trim()
    return description ? `- ${service.name.trim()}: ${description}` : `- ${service.name.trim()}`
  })

  return [
    'SERVIÇOS OFERECIDOS NESTA CONVERSA (use como contexto do que entrega; não inventar serviços fora desta lista):',
    ...lines,
  ].join('\n')
}

export function buildChannelInstruction(channel: ConversationChannel): string {
  if (channel === 'whatsapp') {
    return `CANAL DESTA CONVERSA: WhatsApp (direto com o lead).
- NÃO mencionar Workana, plataforma, comissão, candidatura, proposta na plataforma nem "aqui na Workana".
- Fechamento e pagamento: direto com o cliente (ex.: Pix), sem taxa de plataforma.
- Tom igual ao de sempre; só muda a referência do canal e do pagamento.`
  }

  return `CANAL DESTA CONVERSA: Workana.
- Pode referenciar a Workana quando fizer sentido (formalizar proposta na plataforma, aceitar na Workana, comissão da plataforma etc.), como já é o padrão.`
}

export function buildProjectDetailsLabel(channel: ConversationChannel): string {
  return channel === 'whatsapp'
    ? 'DETALHES DO PROJETO / CONTEXTO DA CONVERSA:'
    : 'DETALHES DO PROJETO (colados da Workana):'
}

export function appendConversationContextSections(
  sections: string[],
  conversation: Conversation,
): string[] {
  const servicesSection = buildServicesContextSection(conversation)

  if (servicesSection) {
    sections.push(servicesSection)
  }

  sections.push(buildChannelInstruction(conversation.channel))

  return sections
}

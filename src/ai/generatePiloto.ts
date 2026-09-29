import { SchemaType } from '@google/generative-ai'
import { getGeminiModel } from '../lib/ai'
import { formatCurrencyBRL } from '../lib/currencyBRL'
import type { PilotoAiContent, PilotoInput, SituationAnswer } from '../types/piloto'
import { PILOTO_TEXT_LIMITS, normalizePilotoAiContent } from '../types/piloto'

const L = PILOTO_TEXT_LIMITS

const SYSTEM_INSTRUCTION = `Você escreve os textos de uma apresentação comercial para um projeto fechado de 45 dias. Quem vai ler é o DONO de um negócio local (dentista, loja, restaurante, oficina), não um profissional de marketing. Português do Brasil.

LINGUAGEM — A REGRA MAIS IMPORTANTE:
- Escreva como quem conversa com o dono do negócio no balcão: frases curtas, palavras do dia a dia, uma ideia por frase.
- Fale de situações concretas que ele reconhece na rotina ("o cliente pede o preço no WhatsApp e some", "quem procura no Google acha o concorrente primeiro").
- Se uma criança de 12 anos não entenderia a frase, reescreva.
- PROIBIDO usar jargão de marketing: lead, funil, conversão, converter, tráfego, engajamento, jornada, presença digital, posicionamento, autoridade, ROI, CAC, CTA, persona, público-alvo, nicho, algoritmo, orgânico, performance, captação, qualificação, estratégia, otimização, visibilidade, digital.
- Em vez de "lead", diga "cliente", "paciente", "quem chama" ou a palavra que o próprio negócio usa.

LIMITES DE CARACTERES — SÃO RÍGIDOS. Conte os caracteres antes de responder e reescreva se passar.

- diagnosisHeadline: uma frase que o dono do negócio leria e pensaria "é isso mesmo". Fala do cliente dele, não de marketing. MÁXIMO ${L.diagnosisHeadline} caracteres. Sem ponto final.
  Bom: "Em Campinas, quem procura dentista marca com quem responde primeiro"
  Ruim: "Clínicas precisam de presença digital para captar leads qualificados"
- diagnosisLines: exatamente 3 frases sobre o que acontece hoje na rotina de quem tem esse tipo de negócio nessa cidade. Cada uma é uma cena simples, não uma análise. MÁXIMO ${L.diagnosisLine} caracteres cada. Não vendem nada.
  Bom: "Muita gente pede o preço no WhatsApp, espera a resposta e acaba fechando com outro."
  Ruim: "A ausência de um processo de qualificação reduz a taxa de conversão dos leads."
- funnelTopLabel / funnelMiddleLabel / funnelBottomLabel: o que acontece com o cliente em cada etapa (ser encontrado, mostrar interesse, fechar), com as palavras do negócio. Frase curta, sem ponto final e sem reticências "...". MÁXIMO ${L.funnelLabel} caracteres cada, contando espaços.
- adAngles: exatamente 3 ideias de vídeo para anúncio. title é o gancho do vídeo, como o cliente falaria, MÁXIMO ${L.angleTitle} caracteres. description diz o que o vídeo mostra, MÁXIMO ${L.angleDescription} caracteres.
- chatMessages: exatamente 4 mensagens de WhatsApp entre um cliente desse negócio e o atendimento, nesta ordem: cliente, atendimento, cliente, atendimento. MÁXIMO ${L.chatMessage} caracteres cada.
  1. O cliente chega perguntando preço ou uma informação, do jeito que as pessoas escrevem no WhatsApp.
  2. O atendimento responde com simpatia e faz UMA pergunta sobre o que a pessoa precisa ou o que a incomoda hoje.
  3. O cliente conta o problema dele com as próprias palavras.
  4. O atendimento mostra que entendeu, diz que dá para resolver e convida para o próximo passo (agendar, visitar, orçamento).
  Tom natural de conversa, caloroso, sem parecer robô. Nunca diga preço, valor ou prazo de resultado.
- closingParagraph: parágrafo de encerramento, colocando-se à disposição, em tom próximo. MÁXIMO ${L.closingParagraph} caracteres. Sem despedida e sem assinatura.

PROIBIÇÕES:
- Nunca prometa resultado, número de clientes, faturamento, posição no Google ou prazo diferente dos 45 dias.
- Nunca escreva valores, "R$", percentuais ou formas de pagamento: o sistema imprime isso.
- Nunca afirme experiência no ramo do cliente nem cite clientes, cases ou números que não foram informados.
- Nunca use negrito, markdown, emoji, bullet, travessão "—" nem CAIXA ALTA.
- Não repita a mesma informação em campos diferentes.`

const PILOTO_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    diagnosisHeadline: { type: SchemaType.STRING },
    diagnosisLines: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    funnelTopLabel: { type: SchemaType.STRING },
    funnelMiddleLabel: { type: SchemaType.STRING },
    funnelBottomLabel: { type: SchemaType.STRING },
    adAngles: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
        },
        required: ['title', 'description'],
      },
    },
    chatMessages: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    closingParagraph: { type: SchemaType.STRING },
  },
  required: [
    'diagnosisHeadline',
    'diagnosisLines',
    'funnelTopLabel',
    'funnelMiddleLabel',
    'funnelBottomLabel',
    'adAngles',
    'chatMessages',
    'closingParagraph',
  ],
}

function truncate(text: string, max: number): string {
  const trimmed = text
    .trim()
    .replace(/(?:\s*\.{3}|\s*…)+$/u, '')
    .trimEnd()
  if (trimmed.length <= max) {
    return trimmed
  }

  const sliced = trimmed.slice(0, max)
  const lastSpace = sliced.lastIndexOf(' ')
  if (lastSpace > Math.floor(max * 0.5)) {
    return sliced.slice(0, lastSpace).trimEnd()
  }

  return sliced.trimEnd()
}

function situationLabel(value: SituationAnswer): string {
  if (value === 'sim') {
    return 'sim'
  }
  if (value === 'nao') {
    return 'não'
  }
  return 'não sei'
}

function buildUserContent(input: PilotoInput): string {
  const ticket =
    input.ticketCents > 0 ? formatCurrencyBRL(input.ticketCents) : 'não informado'

  return [
    `EMPRESA DO LEAD: ${input.leadCompanyName}`,
    `NICHO: ${input.leadNiche}`,
    `CIDADE: ${input.leadCity || 'não informada'}`,
    `O QUE A EMPRESA VENDE: ${input.leadOffer || 'não informado'}`,
    `TICKET MÉDIO: ${ticket}`,
    '',
    `Já tem site: ${situationLabel(input.hasWebsite)}`,
    `Já anuncia: ${situationLabel(input.runsAds)}`,
    `WhatsApp organizado: ${situationLabel(input.whatsappOrganized)}`,
    '',
    'NOTAS LIVRES DA CONVERSA:',
    input.contextNotes.trim() || '(sem notas)',
  ].join('\n')
}

function enforceLimits(content: PilotoAiContent): PilotoAiContent {
  return {
    diagnosisHeadline: truncate(content.diagnosisHeadline, L.diagnosisHeadline),
    diagnosisLines: content.diagnosisLines.map((line) => truncate(line, L.diagnosisLine)),
    funnelTopLabel: truncate(content.funnelTopLabel, L.funnelLabel),
    funnelMiddleLabel: truncate(content.funnelMiddleLabel, L.funnelLabel),
    funnelBottomLabel: truncate(content.funnelBottomLabel, L.funnelLabel),
    adAngles: content.adAngles.map((angle) => ({
      title: truncate(angle.title, L.angleTitle),
      description: truncate(angle.description, L.angleDescription),
    })),
    chatMessages: content.chatMessages.map((message) => truncate(message, L.chatMessage)),
    closingParagraph: truncate(content.closingParagraph, L.closingParagraph),
  }
}

function parseAndNormalize(raw: string): PilotoAiContent {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    throw new Error('A IA devolveu uma resposta inválida. Tente gerar novamente.')
  }

  const normalized = enforceLimits(normalizePilotoAiContent(parsed))

  if (!normalized.diagnosisHeadline.trim() && !normalized.closingParagraph.trim()) {
    throw new Error('A IA devolveu uma resposta vazia. Tente gerar novamente.')
  }

  return normalized
}

async function callPilotoModel(userContent: string): Promise<PilotoAiContent> {
  const model = getGeminiModel(SYSTEM_INSTRUCTION, PILOTO_SCHEMA)
  try {
    const result = await model.generateContent(userContent)
    return parseAndNormalize(result.response.text())
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith('A IA devolveu') ||
        error.message.startsWith('Falha ao chamar a IA:'))
    ) {
      throw error
    }
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    throw new Error(`Falha ao chamar a IA: ${message}`)
  }
}

export async function generatePilotoContent(input: PilotoInput): Promise<PilotoAiContent> {
  return callPilotoModel(buildUserContent(input))
}

export async function regeneratePilotoContent(
  input: PilotoInput,
  current: PilotoAiContent,
  instruction: string,
): Promise<PilotoAiContent> {
  const userContent = [
    buildUserContent(input),
    '',
    'CONTEÚDO ATUAL (JSON — use como base, preserve o que não foi pedido para mudar):',
    JSON.stringify(current, null, 2),
    '',
    'AJUSTE PEDIDO PELO USUÁRIO (prioridade máxima):',
    instruction,
    '',
    'Regenere o JSON COMPLETO já com o ajuste aplicado. Campos não afetados devem sair praticamente idênticos. Os limites de caracteres continuam valendo.',
  ].join('\n')

  return callPilotoModel(userContent)
}

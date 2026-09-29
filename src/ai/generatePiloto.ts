import { SchemaType } from '@google/generative-ai'
import { getGeminiModel } from '../lib/ai'
import { formatCurrencyBRL } from '../lib/currencyBRL'
import type { PilotoAiContent, PilotoInput, SituationAnswer } from '../types/piloto'
import { normalizePilotoAiContent } from '../types/piloto'

const SYSTEM_INSTRUCTION = `Você escreve os textos de uma apresentação comercial para um projeto fechado de 45 dias. Português do Brasil, tom profissional, direto e enxuto.

LIMITES DE CARACTERES — SÃO RÍGIDOS. Conte os caracteres antes de responder e reescreva se passar.

- diagnosisHeadline: uma frase que nomeia o problema do nicho. MÁXIMO 70 caracteres. Sem ponto final.
- diagnosisLines: exatamente 3 frases sobre a realidade de quem trabalha nesse nicho nessa cidade. MÁXIMO 130 caracteres cada. Descrevem a situação, não vendem nada.
- funnelTopLabel / funnelMiddleLabel / funnelBottomLabel: o que acontece em cada etapa do funil traduzido para o vocabulário do nicho. MÁXIMO 60 caracteres cada.
- adAngles: exatamente 3 ângulos de anúncio que serão testados nos vídeos. title MÁXIMO 40 caracteres, description MÁXIMO 110 caracteres.
- closingParagraph: parágrafo de encerramento, colocando-se à disposição. MÁXIMO 200 caracteres. Sem despedida e sem assinatura.

PROIBIÇÕES:
- Nunca prometa resultado, número de leads, faturamento, posição no Google ou prazo diferente dos 45 dias.
- Nunca escreva valores, "R$", percentuais ou formas de pagamento: o sistema imprime isso.
- Nunca afirme experiência no nicho do cliente nem cite clientes, cases ou números que não foram informados.
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
    closingParagraph: { type: SchemaType.STRING },
  },
  required: [
    'diagnosisHeadline',
    'diagnosisLines',
    'funnelTopLabel',
    'funnelMiddleLabel',
    'funnelBottomLabel',
    'adAngles',
    'closingParagraph',
  ],
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim()
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
    diagnosisHeadline: truncate(content.diagnosisHeadline, 70),
    diagnosisLines: content.diagnosisLines.map((line) => truncate(line, 130)),
    funnelTopLabel: truncate(content.funnelTopLabel, 60),
    funnelMiddleLabel: truncate(content.funnelMiddleLabel, 60),
    funnelBottomLabel: truncate(content.funnelBottomLabel, 60),
    adAngles: content.adAngles.map((angle) => ({
      title: truncate(angle.title, 40),
      description: truncate(angle.description, 110),
    })),
    closingParagraph: truncate(content.closingParagraph, 200),
  }
}

function parseAndNormalize(raw: string): PilotoAiContent {
  try {
    const parsed = JSON.parse(raw) as unknown
    return enforceLimits(normalizePilotoAiContent(parsed))
  } catch {
    return enforceLimits(normalizePilotoAiContent(null))
  }
}

export async function generatePilotoContent(input: PilotoInput): Promise<PilotoAiContent> {
  const model = getGeminiModel(SYSTEM_INSTRUCTION, PILOTO_SCHEMA)
  const result = await model.generateContent(buildUserContent(input))
  return parseAndNormalize(result.response.text())
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

  const model = getGeminiModel(SYSTEM_INSTRUCTION, PILOTO_SCHEMA)
  const result = await model.generateContent(userContent)
  return parseAndNormalize(result.response.text())
}

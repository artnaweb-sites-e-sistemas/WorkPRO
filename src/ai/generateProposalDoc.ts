import { SchemaType } from '@google/generative-ai'
import { getGeminiModel } from '../lib/ai'
import { formatCurrencyBRL } from '../lib/currencyBRL'
import { describePaymentForAi, describeRecurrenceForAi } from '../lib/proposalTerms'
import type { ProposalAiContent, ProposalFormInput } from '../types/proposalDoc'
import { BASE_IDENTITY } from './knowledgeBase'

const SYSTEM_INSTRUCTION = `${BASE_IDENTITY}

Gere os TEXTOS de uma PROPOSTA COMERCIAL formal em PDF. Não é mensagem de chat, não
termina com pergunta. Tom profissional, confiante e ENXUTO. Português do Brasil.

LIMITES DE CARACTERES — SÃO RÍGIDOS. O PDF tem largura fixa e estourar o limite quebra
o layout. Conte os caracteres antes de responder e reescreva se passar.

- projectTitle: nome curto do projeto. MÁXIMO 45 caracteres. Sem ponto final.
  Ex: "Plataforma digital para rede de cinemas"
- projectSubtitle: uma frase que resume o escopo. MÁXIMO 120 caracteres. Termina com ponto.
- aboutText: parágrafo único apresentando o que a proposta entrega. MÁXIMO 380 caracteres.
- includedItems: de 5 a 8 itens do que está incluso. Cada item MÁXIMO 85 caracteres,
  sem ponto final, começando com substantivo ou verbo no infinitivo/particípio.
- prerequisiteBody: use null na grande maioria dos casos. Só preencha quando o contexto
  do projeto deixar claro que existe uma dependência que o CLIENTE precisa liberar antes
  do início (acesso a API de terceiro, credencial, conteúdo, integração com sistema
  legado). Quando preencher: MÁXIMO 420 caracteres, explicando o que precisa ser
  liberado, por quem, e que sem isso escopo, prazo e valor são reestruturados.
  Se o contexto não menciona nada disso, é null. Não invente pré-requisito.
- howItWorks: de 3 a 5 etapas. stage MÁXIMO 22 caracteres (uma ou duas palavras,
  ex: "Catálogo", "Desenvolvimento", "Checkout", "Manutenção"). description MÁXIMO 120 caracteres.
- setupLabel: rótulo da linha de investimento do projeto. MÁXIMO 60 caracteres.
  Ex: "Desenvolvimento da plataforma (setup)"
- recurringLabel: rótulo da linha de recorrência mensal. MÁXIMO 70 caracteres.
  Ex: "Manutenção mensal (hospedagem, monitoramento, atualizações e suporte)"
  Preencha sempre, mesmo que a recorrência esteja desligada (o sistema descarta).
- projectSteps: de 2 a 4 passos de EXECUÇÃO. Cada um MÁXIMO 70 caracteres.
  Se a proposta atual já vier com passos escritos pelo usuário, PRESERVE todos eles
  (inclusive quando forem mais de 4) e só mexa no que o ajuste pedir.
  PROIBIDO incluir passo de pagamento, parcela, recorrência ou cobrança — o sistema
  monta esses passos sozinho.
  Ex: "Preenchimento do briefing com materiais", "Desenvolvimento e entrega dentro do
  prazo combinado"
- closingParagraph: parágrafo de encerramento colocando-se à disposição. MÁXIMO 200
  caracteres. Sem despedida ("Atenciosamente", "Abraço") e sem assinatura — o nome do
  profissional já é impresso separadamente.

REGRAS DE CONTEÚDO:
- Não invente valores, prazos, formas de pagamento, clientes, números de projetos ou
  experiência em nicho. Valor e forma de pagamento são impressos pelo sistema.
- Nunca use negrito, markdown, emoji, bullet ("-", "*") ou travessão "—".
- Nunca escreva "R$" nem número de valor em nenhum campo.
- Não repita a mesma informação em campos diferentes.
- Não use CAIXA ALTA (o sistema aplica onde precisa).`

const PROPOSAL_DOC_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    projectTitle: { type: SchemaType.STRING },
    projectSubtitle: { type: SchemaType.STRING },
    aboutText: { type: SchemaType.STRING },
    includedItems: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    prerequisiteBody: { type: SchemaType.STRING, nullable: true },
    howItWorks: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          stage: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
        },
        required: ['stage', 'description'],
      },
    },
    setupLabel: { type: SchemaType.STRING },
    recurringLabel: { type: SchemaType.STRING },
    projectSteps: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    closingParagraph: { type: SchemaType.STRING },
  },
  required: [
    'projectTitle',
    'projectSubtitle',
    'aboutText',
    'includedItems',
    'prerequisiteBody',
    'howItWorks',
    'setupLabel',
    'recurringLabel',
    'projectSteps',
    'closingParagraph',
  ],
}

function hardTruncate(text: string, max: number): string {
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

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function parseProposalAiContent(raw: string): ProposalAiContent {
  try {
    const parsed = JSON.parse(raw) as Partial<ProposalAiContent>

    const includedItems = Array.isArray(parsed.includedItems)
      ? parsed.includedItems
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .map((item) => hardTruncate(item, 85))
          .slice(0, 8)
      : []

    const howItWorks = Array.isArray(parsed.howItWorks)
      ? parsed.howItWorks
          .filter(
            (item): item is { stage: string; description: string } =>
              !!item &&
              typeof item === 'object' &&
              typeof (item as { stage?: unknown }).stage === 'string' &&
              typeof (item as { description?: unknown }).description === 'string',
          )
          .map((item) => ({
            stage: hardTruncate(item.stage, 22),
            description: hardTruncate(item.description, 120),
          }))
          .slice(0, 5)
      : []

    const projectSteps = Array.isArray(parsed.projectSteps)
      ? parsed.projectSteps
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .map((item) => hardTruncate(item, 70))
          .slice(0, 10)
      : []

    const prerequisiteRaw = parsed.prerequisiteBody
    const prerequisiteBody =
      prerequisiteRaw === null || prerequisiteRaw === undefined
        ? null
        : typeof prerequisiteRaw === 'string' && prerequisiteRaw.trim()
          ? hardTruncate(prerequisiteRaw, 420)
          : null

    return {
      projectTitle: hardTruncate(asString(parsed.projectTitle, 'Proposta comercial'), 45),
      projectSubtitle: hardTruncate(asString(parsed.projectSubtitle, 'Escopo alinhado ao briefing.'), 120),
      aboutText: hardTruncate(asString(parsed.aboutText), 380),
      includedItems:
        includedItems.length > 0
          ? includedItems
          : ['Levantamento de requisitos', 'Desenvolvimento do escopo combinado', 'Entrega e ajustes finais'],
      prerequisiteBody,
      howItWorks:
        howItWorks.length > 0
          ? howItWorks
          : [
              { stage: 'Briefing', description: 'Alinhamento do escopo e materiais necessários.' },
              { stage: 'Entrega', description: 'Desenvolvimento e validação com o cliente.' },
              { stage: 'Ajustes', description: 'Refinos finais e publicação.' },
            ],
      setupLabel: hardTruncate(asString(parsed.setupLabel, 'Desenvolvimento do projeto (setup)'), 60),
      recurringLabel: hardTruncate(
        asString(parsed.recurringLabel, 'Manutenção mensal (hospedagem, monitoramento, atualizações e suporte)'),
        70,
      ),
      projectSteps:
        projectSteps.length > 0
          ? projectSteps
          : ['Preenchimento do briefing com materiais', 'Desenvolvimento e entrega no prazo combinado'],
      closingParagraph: hardTruncate(
        asString(parsed.closingParagraph, 'Fico à disposição para alinhar os próximos passos e tirar qualquer dúvida.'),
        200,
      ),
    }
  } catch {
    return {
      projectTitle: 'Proposta comercial',
      projectSubtitle: 'Escopo alinhado ao briefing.',
      aboutText: '',
      includedItems: [
        'Levantamento de requisitos',
        'Desenvolvimento do escopo combinado',
        'Entrega e ajustes finais',
      ],
      prerequisiteBody: null,
      howItWorks: [
        { stage: 'Briefing', description: 'Alinhamento do escopo e materiais necessários.' },
        { stage: 'Entrega', description: 'Desenvolvimento e validação com o cliente.' },
        { stage: 'Ajustes', description: 'Refinos finais e publicação.' },
      ],
      setupLabel: 'Desenvolvimento do projeto (setup)',
      recurringLabel: 'Manutenção mensal (hospedagem, monitoramento, atualizações e suporte)',
      projectSteps: [
        'Preenchimento do briefing com materiais',
        'Desenvolvimento e entrega no prazo combinado',
      ],
      closingParagraph: 'Fico à disposição para alinhar os próximos passos e tirar qualquer dúvida.',
    }
  }
}

function buildUserContent(input: ProposalFormInput): string {
  return [
    `EMPRESA: ${input.companyName}`,
    `SOBRE A EMPRESA: ${input.companyAbout}`,
    `PROFISSIONAL: ${input.professionalName}`,
    '',
    'CONTEXTO DO PROJETO (escrito pelo usuário):',
    input.projectContext,
    '',
    `VALOR TOTAL DO PROJETO: ${formatCurrencyBRL(input.amountCents)}`,
    `FORMA DE PAGAMENTO: ${describePaymentForAi(input)}`,
    `RECORRÊNCIA: ${describeRecurrenceForAi(input)}`,
    `VALIDADE DA PROPOSTA: ${input.validityDays > 0 ? input.validityDays : 15} dias`,
  ].join('\n')
}

export async function generateProposalAiContent(
  input: ProposalFormInput,
): Promise<ProposalAiContent> {
  const model = getGeminiModel(SYSTEM_INSTRUCTION, PROPOSAL_DOC_SCHEMA)
  const result = await model.generateContent(buildUserContent(input))
  return parseProposalAiContent(result.response.text())
}

export async function regenerateProposalAiContent(
  input: ProposalFormInput,
  previous: ProposalAiContent,
  adjustmentRequest: string,
): Promise<ProposalAiContent> {
  const userContent = [
    buildUserContent(input),
    '',
    'PROPOSTA ATUAL (JSON gerado anteriormente — use como base, preserve o que não foi',
    'questionado):',
    JSON.stringify(previous, null, 2),
    '',
    'AJUSTE PEDIDO PELO USUÁRIO (prioridade máxima, aplique com precisão):',
    adjustmentRequest,
    '',
    'Regenere o JSON COMPLETO já com o ajuste aplicado. Campos não afetados pelo pedido',
    'devem sair praticamente idênticos aos atuais. Os limites de caracteres continuam valendo.',
  ].join('\n')

  const model = getGeminiModel(SYSTEM_INSTRUCTION, PROPOSAL_DOC_SCHEMA)
  const result = await model.generateContent(userContent)
  return parseProposalAiContent(result.response.text())
}

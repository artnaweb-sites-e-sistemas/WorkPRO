import { SchemaType } from '@google/generative-ai'
import { BASE_IDENTITY } from './knowledgeBase'
import { getStageInstruction } from './stagePrompts'
import { getGeminiModel } from '../lib/ai'
import {
  appendConversationContextSections,
  buildChannelInstruction,
  buildProjectDetailsLabel,
} from '../lib/conversationContext'
import { formatCurrencyBRL, parseCurrencyBRL } from '../lib/currencyBRL'
import { parseMeetingScriptSlots } from '../lib/meetingScript'
import type { MeetingScriptSlots } from '../types/meetingScript'
import type { Conversation, Message, PresenterProfile, Stage } from '../types/models'
import type { ProposalContent } from '../types/proposal'

export interface GenerateReplyResult {
  message: string
  suggestedPrice: string | null
  suggestedRecurringPrice: string | null
  collectedInfo: string
}

export interface GenerateFollowUpResult {
  message: string
}

export interface GenerateProposalResult {
  content: ProposalContent
  suggestedPrice: string | null
  suggestedRecurringPrice: string | null
}

export interface GenerateMeetingScriptResult {
  slots: MeetingScriptSlots
  suggestedPrice: string | null
  suggestedRecurringPrice: string | null
}

const REPLY_JSON_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    message: { type: SchemaType.STRING },
    suggestedPrice: { type: SchemaType.STRING, nullable: true },
    suggestedRecurringPrice: { type: SchemaType.STRING, nullable: true },
    collectedInfo: { type: SchemaType.STRING },
  },
  required: ['message', 'suggestedPrice', 'suggestedRecurringPrice', 'collectedInfo'],
}

const FOLLOW_UP_JSON_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    message: { type: SchemaType.STRING },
  },
  required: ['message'],
}

const PROPOSAL_JSON_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    intro: { type: SchemaType.STRING },
    topics: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    reassurance: { type: SchemaType.STRING },
    netPrice: { type: SchemaType.NUMBER },
    recurringNetPrice: { type: SchemaType.NUMBER, nullable: true },
    prazo: { type: SchemaType.STRING },
  },
  required: ['intro', 'topics', 'reassurance', 'netPrice', 'recurringNetPrice', 'prazo'],
}

const PROPOSAL_INSTRUCTION_BASE = `Gere os TEXTOS para uma PROPOSTA FORMAL (candidatura ao projeto). Não é mensagem de chat. Tom profissional, confiante e ENXUTO. Mantenha o estilo (sem negrito, sem travessão, reticências quando couber). NÃO reexplicar o escopo inteiro do projeto... o cliente já sabe. Sem inventar experiência de nicho, clientes ou avaliações.

Retorne JSON com:
- intro: parágrafo CURTO que entra DIRETO no assunto (SEM saudação "Olá"/"Oi" — proibido começar com cumprimento). MÁXIMO ~2 a 3 linhas curtas (aprox. 150 a 200 caracteres). Direto ao ponto.
- topics: array com 3 a 6 itens curtos do que está incluso no projeto (frases objetivas).
- reassurance: parágrafo CURTO de segurança com tom de autoridade honesta (cuidado, qualidade, entrega consistente). MÁXIMO ~2 a 3 linhas curtas. Conciso, sem repetir o intro. NUNCA inventar nicho, clientes ou números.
- netPrice: número em reais representando o CUSTO DO SERVIÇO (valor líquido que o freelancer quer receber). Se um valor já foi informado no contexto, use exatamente esse valor convertido para número. Se não houver, sugira um coerente com o escopo.
- recurringNetPrice: veja regra abaixo.
- prazo: texto curto do cronograma (ex: "3 semanas após o envio do briefing").`

function buildProposalInstruction(isRecurring: boolean): string {
  const recurringRule = isRecurring
    ? `- recurringNetPrice: número em reais da MANUTENÇÃO MENSAL. Use valor já definido no contexto quando existir; senão sugira coerente com o escopo.`
    : `- recurringNetPrice: SEMPRE null (este projeto NÃO tem orçamento recorrente).`

  return `${PROPOSAL_INSTRUCTION_BASE}

${recurringRule}

NÃO calcule comissão, total da Workana nem formatação por canal — isso é feito automaticamente pelo sistema.`
}

const MEETING_NET_PRICE_INSTRUCTION_RECURRING = `Com base no escopo e histórico, sugira netPrice (custo do serviço em reais, valor líquido) e recurringNetPrice (manutenção mensal em reais). Use valores já definidos no contexto quando existirem. Retorne JSON { "netPrice": number, "recurringNetPrice": number | null }.`

const MEETING_NET_PRICE_INSTRUCTION_ONE_TIME = `Com base no escopo e histórico, sugira APENAS netPrice: custo do serviço em reais (valor líquido). Este projeto NÃO tem orçamento recorrente — retorne recurringNetPrice como null. Retorne JSON { "netPrice": number, "recurringNetPrice": null }.`

const MEETING_NET_PRICE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    netPrice: { type: SchemaType.NUMBER },
    recurringNetPrice: { type: SchemaType.NUMBER, nullable: true },
  },
  required: ['netPrice', 'recurringNetPrice'],
}

const MEETING_SCRIPT_SLOTS_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    area: { type: SchemaType.STRING },
    aberturaResumo: { type: SchemaType.STRING },
    diferencial: { type: SchemaType.STRING },
    diagnosticoContexto: { type: SchemaType.STRING },
    diagnosticoPerguntas: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    comoResolveria: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    investimentoFraming: { type: SchemaType.STRING },
  },
  required: [
    'area',
    'aberturaResumo',
    'diferencial',
    'diagnosticoContexto',
    'diagnosticoPerguntas',
    'comoResolveria',
    'investimentoFraming',
  ],
}

const MEETING_SCRIPT_SLOTS_INSTRUCTION = `Preencha APENAS os encaixes personalizados de um roteiro de reunião de vendas (vídeo chamada). O texto fixo já existe no sistema... você gera só os slots abaixo. Em português.

TOM (vale para TODOS os slots de prosa — o MESMO das mensagens de chat):
- FALADO, NÃO ESCRITO: escreva como o apresentador falaria numa vídeo, simples e direto. Menos formal. Tom de conversa entre profissionais (WhatsApp/vídeo), não folder de marketing.
- CORTAR JARGÃO DE MARKETING/CORPORATIVO. Proibido termos como: "jornada de compra", "impulsionar/alavancar vendas", "de forma eficaz/eficiente", "solução robusta e escalável", "se encantarão", "otimizar", "estratégico", "diferenciação", "engajar", "materializar" e equivalentes. Use palavras do dia a dia.
- SEM RABINHOS: diga a ideia e pare. Não emendar explicação do benefício óbvio.
- NÃO recapitular em resumo o que o cliente disse. Use o nome do cliente com naturalidade quando disponível no contexto.

EXEMPLO DE TOM (diferencial — não copiar literal):
ERRADO (formal/genérico/rabinho + segmento do lead):
"Meu foco é criar um design que destaque seus produtos artesanais e simplifique a jornada de compra. Assim, seus clientes se encantarão mais facilmente, impulsionando suas vendas online de forma eficaz."
CERTO (natural, falado, curto, genérico — sem citar cerâmica/pizza/etc.):
"Minha experiência é em montar lojas que funcionam bem e ajudam a vender mais online."

Retorne JSON:
{
  "area": string,
  "aberturaResumo": string,
  "diferencial": string,
  "diagnosticoContexto": string,
  "diagnosticoPerguntas": string[],
  "comoResolveria": string[],
  "investimentoFraming": string
}

REGRAS DOS SLOTS:

area — escolha UMA área do profile.areas que melhor casa com este projeto. Escreva como UM termo único e limpo (ex: "criação de sistemas", "programação", "web design"). PROIBIDO usar "/" ou listar duas áreas (nunca "criação de sistemas/programação").

aberturaResumo — trecho CURTO e FALADO que referencia o projeto/necessidade e encaixa no meio da frase fixa da abertura (NÃO frase completa, NÃO começa com maiúscula, sem ponto final). Máximo ~60 caracteres. Ex: "a sua plataforma de saúde financeira", "o seu projeto de automação de mensagens", "a criação do seu site".

diferencial — 1 parágrafo CURTO (~140-170 caracteres), tom FALADO. Fale do FOCO/EXPERIÊNCIA do Bira de forma AMPLA, adaptada ao OBJETIVO do projeto (vender mais/novos clientes OU reduzir custo/melhorar processo) e à ÁREA — mas SEM citar segmento/produto específico do lead (proibido "cerâmica", "pizza", nome de nicho, etc.). Diga e pare — sem rabinho de benefício óbvio, sem jargão de marketing. Não inventar credenciais de nicho.
Exemplos de direção (não copiar literal):
- objetivo "vender mais": "Minha experiência é em montar lojas que funcionam bem e ajudam a vender mais online."
- objetivo "reduzir custo/processo": "Minha experiência é em criar sistemas que tiram o trabalho manual e deixam a operação mais leve."

diagnosticoContexto — 1 frase curta e falada de contexto (só se necessário). PROIBIDO parágrafo redundante resumindo a conversa ou o que o cliente já disse.

diagnosticoPerguntas — 2 a 3 perguntas certeiras, não óbvias, fáceis, NÃO técnicas, no tom de conversa (como você perguntaria ao vivo).

comoResolveria — exatamente 2 parágrafos curtos (~140-170 caracteres cada), tom FALADO, direcionamento alto nível sem consultoria grátis. Cada um uma ideia separada; diga e pare.

investimentoFraming — 1 frase COMPLETA de posicionamento, tom FALADO (~140-170 caracteres), que se sustenta sozinha. PROIBIDO terminar com "deixa" pro número ("...seria de", "...fica em"). PROIBIDO escrever R$ ou valores. Sem jargão de marketing.

RESPIRO — em slots de prosa com mais de uma ideia (comoResolveria), cada parágrafo do array vira um block separado na leitura (linha em branco entre eles). Nenhum parágrafo longo demais.

GERAL: honestidade (não inventar credenciais/nicho); parágrafos curtos; perguntas fáceis e não técnicas; autoverificação final — se soar como texto de site/apresentação corporativa, reescreva mais simples e falado.`

const FOLLOW_UP_INSTRUCTION = `O lead não respondeu à sua última mensagem. Gere um follow-up que dê CONTINUIDADE DIRETA ao assunto pendente, sem relembrar/reapresentar essa mensagem.

REGRA 1 — CONTINUAR, NÃO RELEMBRAR:
Retome o assunto/pergunta que ficou pendente na SUA última mensagem, mas JAMAIS com preâmbulo que a relembra. É a mensagem logo acima... não precisa reapresentar.
PROIBIDO começar com frases como: "Sobre aquela pergunta que te fiz...", "Sobre aquela das prioridades...", "Pra facilitar aquela escolha...", "Voltando ao que te perguntei...". Vá DIRETO ao ponto, como continuação natural.

REGRA 2 — ESCOLHER UM ÂNGULO (conforme contexto/lógica da conversa):
Use UM destes ângulos, amarrado ao tema pendente da última mensagem:
(A) EFEITO PADRÃO — propor resposta pronta para o lead só reagir (concordar/ajustar). Ex: "Pensando no seu caso, eu começaria pelo essencial e deixaria o resto pra uma segunda fase."
(B) PARADOXO DA ESCOLHA — transformar a pergunta aberta em escolha simples A ou B. Ex: "Você prefere focar primeiro em X, ou em já deixar Y redondo?"
(C) TIRAR O PESO — remover a barreira que travou o lead (não precisa decidir tudo agora). Ex: "Nem precisa ter tudo 100% definido, a gente vai lapidando junto."
Se houver follow-ups anteriores sem resposta no histórico, ALTERNE o ângulo (não repetir sempre o mesmo).

REGRA 3 — TOM E FORMATO:
- Começar com "Oi [nome]," (sem nome: "Oi,"). Sem "espero que esteja bem".
- Sem pressão, sem cobrança, sem "vi que você não respondeu".
- Curto (1 a 2 parágrafos curtos).
- Terminar com pergunta FÁCIL (sim/não ou A/B), parágrafo isolado com linha em branco (\\n\\n) antes.
- Manter regras gerais: não inventar credenciais/experiência de nicho, não explicar o óbvio, não recapitular o que o cliente disse (só reconhecimento curto + ponto), usar o nome do cliente com naturalidade quando cadastrado, sem negrito/travessão, reticências quando couber.

EXEMPLO (lead travou após pergunta sobre prioridades do MVP — não copiar literal):
FAZER (ângulo A, sem relembrar):
"Oi Tuane,

Pensando no seu caso, eu começaria pelo essencial e deixaria o resto pra uma segunda fase.

Isso faz sentido pra você?"
NÃO FAZER:
"Oi Tuane, sobre aquela das prioridades que te perguntei..."

Termine OBRIGATORIAMENTE com uma pergunta (a mensagem não pode acabar sem pergunta).`

function formatMessageHistory(messages: Message[]): string {
  if (messages.length === 0) {
    return '(Nenhuma mensagem ainda)'
  }

  return messages
    .map((message) => {
      const prefix = message.sender === 'cliente' ? 'CLIENTE' : 'EU'
      return `${prefix}: ${message.text}`
    })
    .join('\n\n')
}

function findLastClientMessage(messages: Message[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].sender === 'cliente') {
      return messages[index].text
    }
  }
  return null
}

function buildPriceContextSection(conversation: Conversation): string {
  const lines: string[] = []

  if (conversation.suggestedPrice?.trim()) {
    lines.push(`CUSTO DO SERVIÇO JÁ DEFINIDO: ${conversation.suggestedPrice}`)
  } else {
    lines.push('CUSTO DO SERVIÇO: ainda não definido.')
  }

  if (conversation.isRecurring) {
    if (conversation.suggestedRecurringPrice?.trim()) {
      lines.push(
        `ORÇAMENTO RECORRENTE (mensal) JÁ DEFINIDO: ${conversation.suggestedRecurringPrice}`,
      )
    } else {
      lines.push('ORÇAMENTO RECORRENTE (mensal): ainda não definido — sugira valor mensal coerente.')
    }
  } else {
    lines.push('ORÇAMENTO RECORRENTE: desativado para este projeto (NÃO mencionar manutenção mensal).')
  }

  return lines.join('\n')
}

function applyRecurringGate<
  T extends { suggestedRecurringPrice: string | null; recurringNetReais?: number | null },
>(conversation: Conversation, result: T): T {
  if (conversation.isRecurring) {
    return result
  }

  return {
    ...result,
    suggestedRecurringPrice: null,
    recurringNetReais: null,
  }
}

function buildUserContent(
  conversation: Conversation,
  messages: Message[],
  targetStage: Stage,
): string {
  const lastClientMessage = findLastClientMessage(messages)
  const history = formatMessageHistory(messages)

  const lastClientSection = lastClientMessage
    ? `ÚLTIMA FALA DO CLIENTE (responda a esta mensagem):\n${lastClientMessage}`
    : 'Não há fala do cliente ainda. Gere a mensagem inicial com base no projeto.'

  return appendConversationContextSections(
    [
      `ETAPA ALVO: ${targetStage}`,
      '',
      `CLIENTE: ${conversation.clientName}`,
      `TÍTULO DO PROJETO: ${conversation.projectTitle}`,
      '',
      buildProjectDetailsLabel(conversation.channel),
      conversation.projectDetails,
      '',
      'RESUMO JÁ COLETADO SOBRE O LEAD/PROJETO:',
      conversation.collectedInfo || '(vazio)',
      '',
      buildPriceContextSection(conversation),
      '',
      'HISTÓRICO DA CONVERSA:',
      history,
      '',
      lastClientSection,
    ],
    conversation,
  ).join('\n')
}

function appendExtraContext(userContent: string, extraContext?: string): string {
  const trimmed = extraContext?.trim()
  if (!trimmed) {
    return userContent
  }

  return `${userContent}\n\nINSTRUÇÃO ADICIONAL DO USUÁRIO (priorize isto ao gerar esta mensagem):\n${trimmed}`
}

function warnIfMessageMissingQuestion(message: string, context: string): void {
  if (!message.trim().endsWith('?')) {
    console.warn(`[generate] Mensagem sem pergunta final (${context}):`, message)
  }
}

function parseReplyResponse(raw: string, fallbackCollectedInfo: string): GenerateReplyResult {
  try {
    const parsed = JSON.parse(raw) as Partial<GenerateReplyResult>

    return {
      message: typeof parsed.message === 'string' ? parsed.message : raw,
      suggestedPrice:
        typeof parsed.suggestedPrice === 'string' ? parsed.suggestedPrice : null,
      suggestedRecurringPrice:
        typeof parsed.suggestedRecurringPrice === 'string'
          ? parsed.suggestedRecurringPrice
          : null,
      collectedInfo:
        typeof parsed.collectedInfo === 'string'
          ? parsed.collectedInfo
          : fallbackCollectedInfo,
    }
  } catch {
    return {
      message: raw,
      suggestedPrice: null,
      suggestedRecurringPrice: null,
      collectedInfo: fallbackCollectedInfo,
    }
  }
}

export async function generateReply(
  conversation: Conversation,
  messages: Message[],
  targetStage: Stage,
  extraContext?: string,
): Promise<GenerateReplyResult> {
  const ctx = {
    clientName: conversation.clientName,
    relationshipCount: conversation.relationshipCount,
    videoCallEnabled: conversation.videoCallEnabled,
    induceQuote: conversation.induceQuote,
    hasSuggestedPrice: conversation.suggestedPrice !== null,
    isRecurring: conversation.isRecurring,
  }

  const systemInstruction = `${BASE_IDENTITY}\n\n${buildChannelInstruction(conversation.channel)}\n\n${getStageInstruction(targetStage, ctx)}`
  const userContent = appendExtraContext(
    buildUserContent(conversation, messages, targetStage),
    extraContext,
  )
  const model = getGeminiModel(systemInstruction, REPLY_JSON_SCHEMA)

  const result = await model.generateContent(userContent)
  const raw = result.response.text()

  const parsed = applyRecurringGate(
    conversation,
    parseReplyResponse(raw, conversation.collectedInfo),
  )
  warnIfMessageMissingQuestion(parsed.message, `generateReply/${targetStage}`)
  return parsed
}

function buildFollowUpUserContent(conversation: Conversation, messages: Message[]): string {
  const history = formatMessageHistory(messages)
  const trailingEuMessages: Message[] = []

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].sender === 'eu') {
      trailingEuMessages.unshift(messages[index])
    } else {
      break
    }
  }

  const pendingMessage = trailingEuMessages.at(-1)
  const previousFollowUps = trailingEuMessages.slice(0, -1)

  const pendingSection = [
    'SUA ÚLTIMA MENSAGEM (o lead ainda não respondeu — dê continuidade DIRETA a ela, SEM relembrar/reapresentar):',
    pendingMessage?.text ?? '(vazio)',
  ]

  const previousFollowUpsSection =
    previousFollowUps.length > 0
      ? [
          '',
          `FOLLOW-UPS ANTERIORES SEM RESPOSTA (${previousFollowUps.length} — escolha um ÂNGULO DIFERENTE destes):`,
          ...previousFollowUps.flatMap((message, index) => [
            `Follow-up ${index + 1}:`,
            message.text,
            '',
          ]),
        ]
      : []

  return appendConversationContextSections(
    [
      `ETAPA ATUAL: ${conversation.stage}`,
      '',
      `CLIENTE: ${conversation.clientName}`,
      `TÍTULO DO PROJETO: ${conversation.projectTitle}`,
      '',
      buildProjectDetailsLabel(conversation.channel),
      conversation.projectDetails,
      '',
      'HISTÓRICO DA CONVERSA:',
      history,
      '',
      ...pendingSection,
      ...previousFollowUpsSection,
    ],
    conversation,
  ).join('\n')
}

function parseFollowUpResponse(raw: string): GenerateFollowUpResult {
  try {
    const parsed = JSON.parse(raw) as Partial<GenerateFollowUpResult>
    return {
      message: typeof parsed.message === 'string' ? parsed.message : raw,
    }
  } catch {
    return { message: raw }
  }
}

export async function generateFollowUp(
  conversation: Conversation,
  messages: Message[],
  extraContext?: string,
): Promise<GenerateFollowUpResult> {
  const systemInstruction = `${BASE_IDENTITY}\n\n${buildChannelInstruction(conversation.channel)}\n\n${FOLLOW_UP_INSTRUCTION}`
  const userContent = appendExtraContext(
    buildFollowUpUserContent(conversation, messages),
    extraContext,
  )
  const model = getGeminiModel(systemInstruction, FOLLOW_UP_JSON_SCHEMA)

  const result = await model.generateContent(userContent)
  const raw = result.response.text()

  const parsed = parseFollowUpResponse(raw)
  warnIfMessageMissingQuestion(parsed.message, 'generateFollowUp')
  return parsed
}

function buildProposalUserContent(conversation: Conversation, messages: Message[]): string {
  const history = formatMessageHistory(messages)

  return appendConversationContextSections(
    [
      `CLIENTE: ${conversation.clientName}`,
      `TÍTULO DO PROJETO: ${conversation.projectTitle}`,
      '',
      buildProjectDetailsLabel(conversation.channel),
      conversation.projectDetails,
      '',
      'RESUMO JÁ COLETADO SOBRE O LEAD/PROJETO:',
      conversation.collectedInfo || '(vazio)',
      '',
      buildPriceContextSection(conversation),
      '',
      'HISTÓRICO DA CONVERSA:',
      history,
    ],
    conversation,
  ).join('\n')
}

function parseProposalContent(raw: string): ProposalContent {
  try {
    const parsed = JSON.parse(raw) as Partial<ProposalContent>
    const topics = Array.isArray(parsed.topics)
      ? parsed.topics.filter(
          (topic): topic is string => typeof topic === 'string' && topic.trim().length > 0,
        )
      : []

    return {
      intro: typeof parsed.intro === 'string' ? parsed.intro : '',
      topics,
      reassurance: typeof parsed.reassurance === 'string' ? parsed.reassurance : '',
      netPrice: typeof parsed.netPrice === 'number' && parsed.netPrice > 0 ? parsed.netPrice : 0,
      recurringNetPrice:
        typeof parsed.recurringNetPrice === 'number' && parsed.recurringNetPrice > 0
          ? parsed.recurringNetPrice
          : null,
      prazo: typeof parsed.prazo === 'string' ? parsed.prazo : '',
    }
  } catch {
    return {
      intro: raw,
      topics: [],
      reassurance: '',
      netPrice: 0,
      recurringNetPrice: null,
      prazo: '',
    }
  }
}

function resolveRecurringNetReais(
  conversation: Conversation,
  content: ProposalContent,
): number | null {
  if (!conversation.isRecurring) {
    return null
  }

  if (conversation.suggestedRecurringPrice?.trim()) {
    const cents = parseCurrencyBRL(conversation.suggestedRecurringPrice)
    if (cents > 0) {
      return cents / 100
    }
  }

  if (content.recurringNetPrice && content.recurringNetPrice > 0) {
    return content.recurringNetPrice
  }

  return null
}

function resolveNetReais(conversation: Conversation, content: ProposalContent): number {
  if (conversation.suggestedPrice?.trim()) {
    const cents = parseCurrencyBRL(conversation.suggestedPrice)
    if (cents > 0) {
      return cents / 100
    }
  }

  return content.netPrice > 0 ? content.netPrice : 0
}

export async function generateProposal(
  conversation: Conversation,
  messages: Message[],
): Promise<GenerateProposalResult> {
  const systemInstruction = `${BASE_IDENTITY}\n\n${buildChannelInstruction(conversation.channel)}\n\n${buildProposalInstruction(conversation.isRecurring)}`
  const userContent = buildProposalUserContent(conversation, messages)
  const model = getGeminiModel(systemInstruction, PROPOSAL_JSON_SCHEMA)

  const result = await model.generateContent(userContent)
  const raw = result.response.text()
  const content = parseProposalContent(raw)
  const netReais = resolveNetReais(conversation, content)
  const recurringNetReais = resolveRecurringNetReais(conversation, content)
  const resolvedContent: ProposalContent = {
    intro: content.intro,
    topics: content.topics.length > 0 ? content.topics : ['Escopo conforme alinhado no projeto'],
    reassurance: content.reassurance,
    netPrice: netReais,
    recurringNetPrice: recurringNetReais,
    prazo: content.prazo || 'A combinar após o briefing',
  }

  const suggestedPrice =
    !conversation.suggestedPrice?.trim() && netReais > 0
      ? formatCurrencyBRL(Math.round(netReais * 100))
      : null
  const suggestedRecurringPrice =
    conversation.isRecurring &&
    !conversation.suggestedRecurringPrice?.trim() &&
    recurringNetReais &&
    recurringNetReais > 0
      ? formatCurrencyBRL(Math.round(recurringNetReais * 100))
      : null

  return applyRecurringGate(conversation, {
    content: resolvedContent,
    suggestedPrice,
    suggestedRecurringPrice,
  })
}

function buildMeetingScriptUserContent(
  conversation: Conversation,
  messages: Message[],
  profile: PresenterProfile,
): string {
  const history = formatMessageHistory(messages)

  const briefingSection = profile.temBriefing
    ? `Briefing: sim — ${profile.briefingInfo}`
    : 'Briefing: não usa formulário próprio — adaptar próximos passos.'

  return appendConversationContextSections(
    [
      'PERFIL DO APRESENTADOR (dados fixos reais — diferencial é GERADO por você: foco/experiência ampla + objetivo, sem segmento específico do lead):',
      `Nome: ${profile.nome}`,
      `Empresa: ${profile.empresa}`,
      `Áreas em que atua (escolher UMA, termo único, sem "/"): ${profile.areas}`,
      `Desde: ${profile.desde}`,
      `Prova social: ${profile.provaSocial}`,
      `Tom desejado: ${profile.tom}`,
      briefingSection,
      '',
      `CLIENTE: ${conversation.clientName}`,
      `TÍTULO DO PROJETO: ${conversation.projectTitle}`,
      '',
      buildProjectDetailsLabel(conversation.channel),
      conversation.projectDetails,
      '',
      'RESUMO JÁ COLETADO SOBRE O LEAD/PROJETO:',
      conversation.collectedInfo || '(vazio)',
      '',
      buildPriceContextSection(conversation),
      '',
      'O sistema monta o roteiro com template fixo. Gere APENAS os slots personalizados (JSON). Tom FALADO como nas mensagens de chat — nada de folder de marketing. NÃO escreva valores numéricos em investimentoFraming.',
      '',
      'HISTÓRICO DA CONVERSA:',
      history,
    ],
    conversation,
  ).join('\n')
}

async function resolveMeetingNetReais(
  conversation: Conversation,
  messages: Message[],
): Promise<{
  netReais: number
  recurringNetReais: number | null
  suggestedPrice: string | null
  suggestedRecurringPrice: string | null
}> {
  if (conversation.suggestedPrice?.trim()) {
    const cents = parseCurrencyBRL(conversation.suggestedPrice)
    const recurringCents =
      conversation.isRecurring && conversation.suggestedRecurringPrice?.trim()
        ? parseCurrencyBRL(conversation.suggestedRecurringPrice)
        : 0

    if (cents > 0) {
      return {
        netReais: cents / 100,
        recurringNetReais:
          conversation.isRecurring && recurringCents > 0 ? recurringCents / 100 : null,
        suggestedPrice: null,
        suggestedRecurringPrice: null,
      }
    }
  }

  const meetingInstruction = conversation.isRecurring
    ? MEETING_NET_PRICE_INSTRUCTION_RECURRING
    : MEETING_NET_PRICE_INSTRUCTION_ONE_TIME
  const model = getGeminiModel(meetingInstruction, MEETING_NET_PRICE_SCHEMA)
  const userContent = buildProposalUserContent(conversation, messages)
  const result = await model.generateContent(userContent)

  try {
    const parsed = JSON.parse(result.response.text()) as {
      netPrice?: number
      recurringNetPrice?: number | null
    }
    const netReais =
      typeof parsed.netPrice === 'number' && parsed.netPrice > 0 ? parsed.netPrice : 0
    const recurringNetReais =
      conversation.isRecurring &&
      typeof parsed.recurringNetPrice === 'number' &&
      parsed.recurringNetPrice > 0
        ? parsed.recurringNetPrice
        : null
    const suggestedPrice =
      !conversation.suggestedPrice?.trim() && netReais > 0
        ? formatCurrencyBRL(Math.round(netReais * 100))
        : null
    const suggestedRecurringPrice =
      conversation.isRecurring &&
      !conversation.suggestedRecurringPrice?.trim() &&
      recurringNetReais &&
      recurringNetReais > 0
        ? formatCurrencyBRL(Math.round(recurringNetReais * 100))
        : null

    return applyRecurringGate(conversation, {
      netReais,
      recurringNetReais,
      suggestedPrice,
      suggestedRecurringPrice,
    })
  } catch {
    return {
      netReais: 0,
      recurringNetReais: null,
      suggestedPrice: null,
      suggestedRecurringPrice: null,
    }
  }
}

function parseMeetingScriptSlotsResponse(raw: string): MeetingScriptSlots {
  const slots = parseMeetingScriptSlots(raw)
  if (!slots) {
    throw new Error('Resposta da IA não é JSON de slots válido')
  }

  return slots
}

export async function generateMeetingScript(
  conversation: Conversation,
  messages: Message[],
  profile: PresenterProfile,
): Promise<GenerateMeetingScriptResult> {
  const { suggestedPrice, suggestedRecurringPrice } = await resolveMeetingNetReais(
    conversation,
    messages,
  )

  const systemInstruction = `${BASE_IDENTITY}\n\n${buildChannelInstruction(conversation.channel)}\n\n${MEETING_SCRIPT_SLOTS_INSTRUCTION}`
  const userContent = buildMeetingScriptUserContent(conversation, messages, profile)
  const model = getGeminiModel(systemInstruction, MEETING_SCRIPT_SLOTS_SCHEMA)

  const result = await model.generateContent(userContent)
  const slots = parseMeetingScriptSlotsResponse(result.response.text())

  return applyRecurringGate(conversation, { slots, suggestedPrice, suggestedRecurringPrice })
}

import type { PilotoIconName } from './pilotoIcons'

/**
 * Texto fixo do Piloto 45. Nada aqui passa pela IA: escopo, fases e entregáveis
 * são iguais para todo lead. A IA só escreve diagnóstico, funil, ângulos e encerramento.
 */

export interface PilotoContentItem {
  title: string
  description: string
  icon?: PilotoIconName
}

export interface PilotoContentGroup {
  name: string
  items: PilotoContentItem[]
}

/** Promessa da capa: o que o lead ganha, não o nome do produto. */
export function pilotoPromise(leadCompanyName: string): string {
  const company = leadCompanyName.trim()
  return company
    ? `45 dias para descobrir de onde vêm os clientes da ${company}.`
    : '45 dias para descobrir de onde vêm os seus clientes.'
}

export const PROBLEM_STATEMENT =
  'O problema não é falta de cliente. É que o caminho até você tem falhas.'

/** Os três pontos onde o cliente se perde — cada um vira uma entrega da fundação. */
export const LEAKS: PilotoContentItem[] = [
  {
    title: 'Quem procura não te encontra',
    description: 'Sem anúncio e sem presença forte no Google, a busca termina no concorrente.',
  },
  {
    title: 'Quem encontra não confia',
    description: 'Site fraco ou Instagram parado fazem o cliente desistir antes de chamar.',
  },
  {
    title: 'Quem chama espera demais',
    description: 'Mensagem sem resposta esfria. O cliente fecha com quem respondeu primeiro.',
  },
]

export const FUNNEL_STAGES: { name: string; channels: { label: string; icon: PilotoIconName }[] }[] = [
  {
    name: 'Atrair',
    channels: [
      { label: 'Google Ads', icon: 'googleads' },
      { label: 'Instagram Ads', icon: 'instagram' },
      { label: 'Google Meu Negócio', icon: 'googlebusiness' },
      { label: 'Instagram', icon: 'instagram' },
    ],
  },
  {
    name: 'Qualificar',
    channels: [
      { label: 'WhatsApp com automação', icon: 'whatsapp' },
      { label: 'Retorno automático', icon: 'refresh' },
    ],
  },
  { name: 'Vender', channels: [{ label: 'Você fecha a venda', icon: 'team' }] },
]

export const PHASES = {
  foundation: {
    name: 'Fundação',
    days: '15 dias',
    summary: 'Tudo pronto antes de investir o primeiro real em anúncio.',
    highlights: ['Presença no Google e no Instagram', 'Contas de anúncio e três vídeos', 'WhatsApp com automação configurado'],
  },
  traffic: {
    name: 'Tráfego',
    days: '30 dias',
    summary: 'Seus anúncios no ar, ajustados sempre pra trazer mais clientes gastando menos.',
    highlights: ['Anúncios no Instagram e no Google', 'Ajustes e vídeos novos quando precisar', 'Relatório final: o que funcionou e onde vale investir'],
  },
}

export const MILESTONES: { day: string; label: string }[] = [
  { day: 'Dia 1', label: 'Início da fundação' },
  { day: 'Dia 16', label: 'Anúncios no ar' },
  { day: 'Dia 45', label: 'Relatório do que funcionou' },
]

export const FOUNDATION_GROUPS: PilotoContentGroup[] = [
  {
    name: 'Presença',
    items: [
      {
        title: 'Página de vendas',
        icon: 'page',
        description: 'Uma página com um objetivo só: fazer quem visita chamar no WhatsApp.',
      },
      {
        title: 'Instagram repaginado',
        icon: 'instagram',
        description: 'Perfil alinhado com o anúncio, para quem clica confiar no que vê.',
      },
      {
        title: 'Google Meu Negócio',
        icon: 'googlebusiness',
        description: 'Perfil otimizado para aparecer quando alguém busca na região.',
      },
    ],
  },
  {
    name: 'Anúncios',
    items: [
      {
        title: 'Conta de anúncios do Instagram',
        icon: 'instagram',
        description: 'Conta criada no nome da empresa, pronta para medir quem chama.',
      },
      {
        title: 'Conta de Google Ads',
        icon: 'googleads',
        description: 'Anúncios montados para aparecer em quem busca na sua região.',
      },
      {
        title: 'Três vídeos para anúncio',
        icon: 'video',
        description: 'Roteiro, orientação de gravação e edição dos três criativos.',
      },
    ],
  },
  {
    name: 'Atendimento',
    items: [
      {
        title: 'WhatsApp conectado',
        icon: 'whatsapp',
        description: 'Número ligado à ferramenta, com a automação montada pro seu negócio.',
      },
      {
        title: 'Roteiro de venda',
        icon: 'script',
        description: 'Como a automação puxa a conversa, entende a necessidade e aquece o cliente.',
      },
      {
        title: 'Retorno automático',
        icon: 'refresh',
        description: 'Quem parou de responder recebe uma mensagem no tempo certo.',
      },
    ],
  },
]

export const VIDEOS_NOTE =
  'Roteiro e edição inclusos. Se o relatório mostrar que precisa, gravamos novos vídeos durante o tráfego, sem custo extra.'

export const TRAFFIC_LOOP = ['Anunciar', 'Medir', 'Ajustar']

/** "R$ 1.000" sem centavos quando redondo, como nos slides. */
function moneyLabel(cents: number): string {
  const round = cents % 100 === 0
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: round ? 0 : 2,
    maximumFractionDigits: round ? 0 : 2,
  }).format(cents / 100)
}

/** Itens do tráfego; a verba por canal vem do orçamento do piloto. */
export const trafficItems = (adBudgetPerChannelCents: number): PilotoContentItem[] => [
  {
    title: 'Verba em campo',
    description: `${moneyLabel(adBudgetPerChannelCents)} por canal, pagos direto às plataformas ao longo dos 30 dias.`,
  },
  {
    title: 'Otimização contínua',
    description: 'Público, lance e criativo ajustados conforme o relatório mostra o que funciona.',
  },
  {
    title: 'Novos vídeos quando o relatório pedir',
    description: 'Gravação e edição adicionais, já inclusas no projeto.',
  },
  {
    title: 'Acompanhamento do atendimento',
    description: 'Revisamos as conversas no WhatsApp e ajustamos o fluxo para vender mais.',
  },
  {
    title: 'Relatórios de acompanhamento',
    description: 'Quanto foi investido, quantas pessoas chamaram e quanto custou cada uma.',
  },
]

export const QUALIFICATION_COPY =
  'A automação responde na hora, conversa sobre o que a pessoa precisa e conduz até ela estar pronta para comprar. Aí você, ou alguém da sua equipe, assume para fechar.'

export const QUALIFICATION_POINTS = [
  'Responde em segundos, até de madrugada',
  'Montada com técnicas de venda',
  'Conversa natural, no tom da sua empresa',
  'Retoma quem parou de responder',
]

/** O que acontece com cada conversa. A meta é levar todo mundo para "quente". */
export const TEMPERATURE_LANES: { name: string; action: string; level: 1 | 2 | 3 }[] = [
  { name: 'Quente', action: 'Pronto para comprar: passa pra você', level: 3 },
  { name: 'Morno', action: 'Parou de responder: recebe retorno automático', level: 2 },
  { name: 'Frio', action: 'Sem resposta após as tentativas: encerra e retoma depois', level: 1 },
]

/** Conversa de reserva, usada quando a IA ainda não gerou a do nicho. Genérica de propósito. */
export const CHAT_EXAMPLE: { from: 'lead' | 'ai'; text: string }[] = [
  { from: 'lead', text: 'Oi, quanto custa?' },
  { from: 'ai', text: 'Oi! Já te passo. Me conta rapidinho: o que você está querendo resolver?' },
  { from: 'lead', text: 'Tô com esse problema faz tempo e já tá me atrapalhando.' },
  { from: 'ai', text: 'Entendi, dá pra resolver sim. Consigo te encaixar ainda essa semana, pode ser?' },
]

export const CHAT_HANDOFF = 'Cliente quente · passando pra você'

/** Comparação do slide "por que funciona". Não critica a equipe do cliente: ela é quem fecha. */
export const COMPARISON_ROWS: { topic: string; common: string; ai: string }[] = [
  { topic: 'Tempo de resposta', common: 'Quando alguém vê a mensagem', ai: 'Em segundos' },
  { topic: 'Horário', common: 'Horário comercial', ai: '24 horas, todos os dias' },
  { topic: 'Jeito de vender', common: 'Depende de quem atende', ai: 'Sempre com técnica de venda' },
  { topic: 'Quem parou de responder', common: 'Costuma ficar esquecido', ai: 'Recebe retorno no tempo certo' },
  { topic: 'Dia corrido', common: 'A conversa espera', ai: 'Mesma atenção na 1ª e na 100ª' },
]

export const COMPARISON_TAGLINE = 'A automação aquece. Você fecha.'

export const REPORT_METRICS = [
  'Custo por contato no Instagram',
  'Custo por contato no Google',
  'Contatos com interesse real',
  'Vídeo com melhor resultado',
  'Onde vale investir mais',
]

export const PILOT_GOAL =
  'O objetivo destes 45 dias é gerar os primeiros resultados e mostrar onde vale investir. Continuar depois é opcional.'

/** O que é do cliente no dia 45, continuando ou não. */
export const ASSETS_THAT_STAY = [
  'Instagram repaginado',
  'Google Meu Negócio otimizado',
  'Três vídeos editados',
  'Contas de anúncio no nome da empresa',
  'Relatório com o que funcionou',
]

/** O que só segue funcionando com a continuidade — dito com clareza, sem destaque. */
export const CONTINUES_IF_YOU_WANT: PilotoContentItem[] = [
  { title: 'Página de vendas no ar', description: 'depende de hospedagem e manutenção' },
  { title: 'WhatsApp com automação', description: 'a ferramenta de atendimento e dos contatos' },
  { title: 'Anúncios rodando', description: 'com a gestão e a otimização de todo mês' },
]

/** Do fechamento ao dia 45. `detail` é opcional e aparece em letra menor. */
export const NEXT_STEPS: { when: string; what: string; detail?: string }[] = [
  { when: 'Hoje', what: 'Escolha o plano' },
  { when: 'Em até 24 horas', what: 'Pagamento e formulário sobre o seu negócio' },
  { when: 'Dia 1', what: 'Início da fundação' },
  { when: 'Dia 16', what: 'Anúncios no ar e gestão do tráfego', detail: 'Otimização contínua e relatórios até o fim.' },
  { when: 'Dia 45', what: 'Relatório e decisão', detail: 'Seguir com todos os serviços ou só com parte deles.' },
]

export const RECURRENCE_NOTE =
  'Nada é renovado automaticamente: a decisão do dia 45 é sua, com os números na mesa.'

export const AD_BUDGET_NOTE =
  'O dinheiro dos anúncios é pago direto pro Google e pro Instagram, no cartão da empresa, aos poucos durante os 30 dias. Não sai de uma vez.'

export const CLOSING_FALLBACK = 'Em 45 dias você vai saber de onde vêm os seus clientes. Qualquer dúvida, é só me chamar que a gente resolve junto.'

/** Conversa do nicho gerada pela IA; mensagem vazia cai na de reserva da mesma posição. */
export function resolveChat(chatMessages: string[]): { from: 'lead' | 'ai'; text: string }[] {
  return CHAT_EXAMPLE.map((fallback, index) => ({
    from: fallback.from,
    text: chatMessages[index]?.trim() || fallback.text,
  }))
}

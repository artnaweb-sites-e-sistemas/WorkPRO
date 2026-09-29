/**
 * Texto fixo do Piloto 45. Nada aqui passa pela IA: escopo, fases e entregáveis
 * são iguais para todo lead. A IA só escreve diagnóstico, funil, ângulos e encerramento.
 */

export interface PilotoContentItem {
  title: string
  description: string
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
  'O problema não é falta de cliente. É que o caminho até você tem buracos.'

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

export const FUNNEL_STAGES: { name: string; channels: string[] }[] = [
  { name: 'Atrair', channels: ['Google Ads', 'Meta Ads', 'Google Meu Negócio', 'Instagram'] },
  { name: 'Qualificar', channels: ['WhatsApp com IA', 'Follow-up automático'] },
  { name: 'Vender', channels: ['Você, com o lead pronto'] },
]

export const PHASES = {
  foundation: {
    name: 'Fundação',
    days: '15 dias',
    summary: 'Tudo pronto antes de investir o primeiro real em anúncio.',
    highlights: ['Presença no Google e no Instagram', 'Contas de anúncio e três vídeos', 'WhatsApp com IA configurado'],
  },
  traffic: {
    name: 'Tráfego',
    days: '30 dias',
    summary: 'Verba real, dado real e ajuste constante até o menor custo por lead.',
    highlights: ['Anúncios no ar em Meta e Google', 'Otimização e novos criativos', 'Relatório final para decidir'],
  },
}

export const MILESTONES: { day: string; label: string }[] = [
  { day: 'Dia 1', label: 'Início da fundação' },
  { day: 'Dia 16', label: 'Anúncios no ar' },
  { day: 'Dia 45', label: 'Relatório e decisão' },
]

export const FOUNDATION_GROUPS: PilotoContentGroup[] = [
  {
    name: 'Presença',
    items: [
      {
        title: 'Landing page',
        description: 'Uma página com um objetivo só: transformar visita em conversa.',
      },
      {
        title: 'Instagram repaginado',
        description: 'Perfil alinhado com o anúncio, para quem clica confiar no que vê.',
      },
      {
        title: 'Google Meu Negócio',
        description: 'Perfil otimizado para aparecer quando alguém busca na região.',
      },
    ],
  },
  {
    name: 'Anúncios',
    items: [
      {
        title: 'Conta de Meta Ads',
        description: 'Business Manager, pixel e públicos configurados do zero.',
      },
      {
        title: 'Conta de Google Ads',
        description: 'Conversões e campanhas estruturadas para a sua região.',
      },
      {
        title: 'Três vídeos para anúncio',
        description: 'Roteiro, orientação de gravação e edição dos três criativos.',
      },
    ],
  },
  {
    name: 'Atendimento',
    items: [
      {
        title: 'WhatsApp conectado',
        description: 'Número ligado à ferramenta, com a IA treinada no seu negócio.',
      },
      {
        title: 'Fluxo de qualificação',
        description: 'As perguntas que separam curioso de cliente, definidas com você.',
      },
      {
        title: 'Follow-up automático',
        description: 'Quem parou de responder recebe retorno no tempo certo.',
      },
    ],
  },
]

export const VIDEOS_NOTE =
  'Roteiro e edição inclusos. Se o dado pedir, gravamos novos vídeos durante o tráfego, sem custo extra.'

export const TRAFFIC_LOOP = ['Anunciar', 'Medir', 'Ajustar']

export const TRAFFIC_ITEMS: PilotoContentItem[] = [
  {
    title: 'Verba em campo',
    description: 'R$ 1.000 por canal, pagos direto às plataformas ao longo dos 30 dias.',
  },
  {
    title: 'Otimização contínua',
    description: 'Público, lance e criativo ajustados conforme o dado chega.',
  },
  {
    title: 'Novos vídeos quando o dado pedir',
    description: 'Gravação e edição adicionais, já inclusas no projeto.',
  },
  {
    title: 'Acompanhamento do atendimento',
    description: 'Revisamos as conversas no WhatsApp e ajustamos o fluxo para vender mais.',
  },
  {
    title: 'Relatórios de acompanhamento',
    description: 'Quanto foi investido, quantos leads entraram e quanto custou cada um.',
  },
]

export const QUALIFICATION_COPY =
  'Quem chama no WhatsApp é atendido na hora pela IA, que faz as perguntas certas e separa quem está pronto para comprar.'

export const QUALIFICATION_POINTS = [
  'Resposta em segundos, a qualquer hora',
  'Qualifica sem parecer robô',
  'Nenhum lead esquecido',
]

export const TEMPERATURE_LANES: { name: string; action: string; level: 1 | 2 | 3 }[] = [
  { name: 'Quente', action: 'Você assume a conversa', level: 3 },
  { name: 'Morno', action: 'Entra no follow-up automático', level: 2 },
  { name: 'Frio', action: 'Retomado no momento certo', level: 1 },
]

/** Conversa ilustrativa do diagrama. Genérica de propósito: serve para qualquer nicho. */
export const CHAT_EXAMPLE: { from: 'lead' | 'ai'; text: string }[] = [
  { from: 'lead', text: 'Oi, quanto custa?' },
  { from: 'ai', text: 'Oi! Já te passo. Pra indicar o melhor pra você: é pra quando?' },
  { from: 'lead', text: 'Essa semana ainda, se der.' },
]

export const REPORT_METRICS = [
  'Custo por lead no Meta',
  'Custo por lead no Google',
  'Leads qualificados',
  'Vídeo com melhor resultado',
  'Canal para escalar',
]

export const ASSETS_THAT_STAY = [
  'Landing page no ar',
  'Instagram repaginado',
  'Google Meu Negócio otimizado',
  'Contas de anúncio configuradas',
  'Três vídeos editados',
  'WhatsApp com IA funcionando',
]

export const NEXT_STEPS: { when: string; what: string }[] = [
  { when: 'Hoje', what: 'Escolha do plano e assinatura' },
  { when: 'Em até 24 horas', what: 'Pagamento e briefing de 30 minutos' },
  { when: 'Dia 1', what: 'Início da fundação' },
]

export const RECURRENCE_NOTE =
  'Ao final dos 45 dias você decide se continua. Nada é automático, e a conversa acontece com os números na mesa.'

export const AD_BUDGET_NOTE =
  'A verba de anúncio é paga direto às plataformas, no cartão da empresa, ao longo dos 30 dias. Não sai de uma vez.'

export const CLOSING_FALLBACK = 'Fico à disposição para alinhar os próximos passos.'

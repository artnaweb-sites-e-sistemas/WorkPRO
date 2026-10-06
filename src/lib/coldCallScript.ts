/**
 * Roteiro da ligação fria. Um objetivo só: marcar a reunião de 20 minutos por vídeo.
 * Não se vende por telefone; vende-se a próxima conversa.
 *
 * Mesma notação do roteiro da reunião:
 * `{chave}` = anotação (colorida), `[texto]` = pista para adaptar na hora,
 * `#` separa a fala de uma dica curta, `@chave ` no início marca a pergunta-chave.
 */

import type { ScriptColor } from './pilotoScript'

export interface CallField {
  label: string
  /** null = dado neutro (nomes, telefone), sem cor */
  color: ScriptColor | null
  hint: string
  short?: boolean
  /** trecho do roteiro (não é anotação): aparece como texto normal; vazio usa o fallback */
  fallback?: string
}

export const CALL_FIELDS: Record<string, CallField> = {
  empresa: { label: 'Empresa', color: null, hint: 'Nome da empresa', short: true },
  nicho: { label: 'Nicho', color: null, hint: 'Tipo de negócio', short: true },
  cidade: { label: 'Cidade', color: null, hint: 'Cidade da empresa', short: true },
  telefone: { label: 'Telefone', color: null, hint: '(DDD) número', short: true },
  atendente: { label: 'Quem atendeu', color: null, hint: 'Nome de quem atendeu', short: true },
  responsavel: { label: 'Nome do responsável', color: null, hint: 'Nome de quem decide', short: true },
  dor: { label: 'O problema, nas palavras dele', color: 'c3', hint: 'O que ele disse, do jeito dele' },
  hoje: { label: 'Como os clientes chegam hoje', color: 'c2', hint: 'Indicação, Instagram, Google…' },
  whats: { label: 'Como é o WhatsApp', color: 'c4', hint: 'Quem responde e quanto vira serviço' },
  horario: { label: 'Quando ligar de novo', color: 'c5', hint: 'Dia e hora do retorno', short: true },
  obs: { label: 'Observações', color: null, hint: 'Anotações livres sobre a ligação', short: false },
  whatsapp: { label: 'WhatsApp do responsável', color: null, hint: '(DDD) número', short: true },
  decisores: { label: 'Quem mais decide', color: 'c8', hint: 'Sócio, gerente…', short: true },
  reuniao: { label: 'Dia e hora da reunião', color: 'c1', hint: 'Escolha no calendário', short: true },
  /* escritos pela IA a partir do nicho; sem nicho, vale o genérico */
  grupo: { label: 'Como chamar o nicho', color: null, hint: '', fallback: 'negócios aqui da região' },
  clientes: { label: 'Clientes', color: null, hint: '', fallback: 'clientes' },
  dor1: {
    label: 'Dor do nicho',
    color: null,
    hint: '',
    fallback: 'tem mês cheio e mês parado',
  },
  dor2: {
    label: 'Dor do WhatsApp',
    color: null,
    hint: '',
    fallback: 'muita gente pede o preço e some',
  },
  /* pela hora do relógio: bom dia / boa tarde / boa noite */
  saudacao: { label: 'Saudação', color: null, hint: '', fallback: 'Olá' },
  /* preenchidos pelo seu cadastro, não aparecem como campo */
  eu: { label: 'Seu nome', color: null, hint: '' },
  agencia: { label: 'Sua empresa', color: null, hint: '' },
}

/** 'barrado': a recepção não passou. Não conta como recusa do dono. */
export type CallOutcome = 'agendou' | 'retorno' | 'sem-interesse' | 'barrado' | 'nao-atendeu' | 'deixei-recado'

export const CALL_OUTCOMES: Record<CallOutcome, { label: string; tone: 'good' | 'warn' | 'muted' }> = {
  agendou: { label: 'Agendou', tone: 'good' },
  retorno: { label: 'Ligar de novo', tone: 'warn' },
  'sem-interesse': { label: 'Sem interesse', tone: 'muted' },
  barrado: { label: 'Recepção barrou', tone: 'muted' },
  'nao-atendeu': { label: 'Não atendeu', tone: 'muted' },
  'deixei-recado': { label: 'Deixei recado', tone: 'warn' },
}

export type CallStage = 'Preparo' | 'Recepção' | 'Responsável' | 'Agendamento'

/** Fala que só aparece se a ligação passou por uma ficha antes (ex.: veio da recepção). */
export interface ConditionalLine {
  text: string
  onlyAfter: string
}

export type CallLine = string | ConditionalLine

export interface CallChoice {
  label: string
  /** próxima ficha ou o resultado que encerra a ligação */
  to: string | { outcome: CallOutcome }
  /** caminho principal: botão cheio */
  primary?: boolean
  /** recusa: botão em vermelho, para achar rápido */
  danger?: boolean
  /** só o ícone de desligar (o rótulo vira aria-label e dica) */
  iconOnly?: boolean
  /** copia uma anotação para outra ao escolher (se a de destino estiver vazia) */
  carry?: { from: string; to: string }
}

export interface CallNode {
  id: string
  stage: CallStage
  title: string
  goal: string
  /** lembretes para antes de falar, em texto apagado */
  tips?: string[]
  say?: CallLine[]
  /** se ele disser X, você responde Y */
  branch?: [string, string][]
  capture?: string[]
  choices: CallChoice[]
  /** mensagem pronta de WhatsApp mostrada na própria ficha */
  message?: keyof typeof CALL_MESSAGES
}

export const CALL_START = 'preparo'

export const CALL_NODES: Record<string, CallNode> = {
  preparo: {
    id: 'preparo',
    stage: 'Preparo',
    title: 'Antes de ligar',
    goal: 'Um objetivo só: marcar 20 minutos por vídeo.',
    tips: [
      'Você não vende por telefone. Você vende a próxima conversa.',
      'Tenha dois horários livres na agenda antes de discar.',
      'Fale em pé e sorrindo: a voz sai com mais energia.',
      'Não atendeu? Não deixe recado. Tente outro horário, até três vezes.',
    ],
    capture: ['empresa', 'nicho', 'cidade', 'telefone'],
    choices: [
      { label: 'Atendeu', to: 'quem', primary: true },
      { label: 'Não atendeu', to: { outcome: 'nao-atendeu' } },
    ],
  },
  quem: {
    id: 'quem',
    stage: 'Recepção',
    title: 'Quem atendeu',
    goal: 'Descobrir com quem você está falando.',
    say: [
      '@atendente {saudacao}, com quem eu falo?#Anote o nome. Chamar pelo nome muda o tom da ligação.',
      'Prazer, {atendente}. Quem cuida da {empresa} é você mesmo ou tem um responsável?',
    ],
    capture: ['atendente'],
    choices: [
      { label: 'É o responsável', to: 'abertura', primary: true, carry: { from: 'atendente', to: 'responsavel' } },
      { label: 'Não é o responsável', to: 'recepcao' },
      { label: 'Deixei recado', to: 'recado' },
      { label: 'Recepção barrou', to: { outcome: 'barrado' }, danger: true },
    ],
  },
  recepcao: {
    id: 'recepcao',
    stage: 'Recepção',
    title: 'Recepção',
    goal: 'Ela é aliada, não barreira. Peça ajuda e seja breve.',
    say: [
      '@responsavel {atendente}, você pode me ajudar? Qual o nome do responsável aí?',
      'Consegue me passar pro {responsavel}? É coisa de dois minutos.#Tom de quem já espera o sim.',
    ],
    capture: ['responsavel'],
    choices: [
      { label: 'Transferiu', to: 'abertura', primary: true },
      { label: 'Não está ou está ocupado', to: 'recepcao-retorno' },
      { label: 'Pediu pra mandar mensagem', to: 'recepcao-mensagem' },
      { label: 'Deixei recado', to: 'recado' },
      { label: 'Recepção barrou', to: { outcome: 'barrado' }, danger: true },
    ],
  },
  recado: {
    id: 'recado',
    stage: 'Recepção',
    title: 'Deixar recado',
    goal: 'Deixar nome e motivo curto. Sem vender. Sair com horário pra ligar de novo.',
    say: [
      'Sem problema. Pode anotar aí, por favor: é o {eu}, da {agencia}.',
      'É sobre trazer mais {clientes} pra {empresa} pelo Google e pelo WhatsApp. São dois minutinhos com o responsável.',
      '@horario Qual o melhor horário pra eu ligar de novo e achar ele?',
      'Obrigado, {atendente}. Ligo {horario} e digo que deixei recado com você.#Com horário marcado, a próxima ligação abre mais fácil.',
    ],
    capture: ['responsavel', 'horario'],
    choices: [{ label: 'Encerrar: deixei recado', to: { outcome: 'deixei-recado' }, primary: true }],
  },
  'recepcao-retorno': {
    id: 'recepcao-retorno',
    stage: 'Recepção',
    title: 'Marcar o retorno',
    goal: 'Sair com um horário e um nome, não com "liga outra hora".',
    say: [
      '@horario Sem problema. Qual o melhor horário pra eu falar com {responsavel}? De manhã ou à tarde?',
      'E tem um WhatsApp que {responsavel} usa? Mando uma mensagem avisando que vou ligar.',
      'Obrigado, {atendente}. Ligo {horario} e digo que falei com você, tá?#Citar quem te ajudou abre a porta na próxima.',
    ],
    capture: ['horario', 'whatsapp'],
    choices: [{ label: 'Encerrar e ligar de novo', to: { outcome: 'retorno' }, primary: true }],
  },
  'recepcao-mensagem': {
    id: 'recepcao-mensagem',
    stage: 'Recepção',
    title: 'Pediu mensagem',
    goal: 'Mandar, sim, mas amarrar uma ligação depois.',
    say: [
      'Mando sim. Qual o WhatsApp de {responsavel}?',
      '@horario Pra não virar só mais uma mensagem: qual o melhor horário pra eu ligar e ver se chegou?',
    ],
    capture: ['whatsapp', 'horario'],
    choices: [{ label: 'Encerrar e ligar de novo', to: { outcome: 'retorno' }, primary: true }],
  },
  abertura: {
    id: 'abertura',
    stage: 'Responsável',
    title: 'Abertura',
    goal: 'Assumir que é uma ligação fria e pedir 30 segundos.',
    say: [
      { text: '{atendente} me passou pra você.', onlyAfter: 'recepcao' },
      '{responsavel}, posso te falar em 30 segundos por que liguei, e aí você me diz se faz sentido continuar?#Pausa. Espere o "pode falar". A honestidade baixa a guarda.',
    ],
    capture: ['responsavel'],
    choices: [
      { label: '"Pode falar"', to: 'motivo', primary: true },
      { label: '"Agora não dá"', to: 'ocupado' },
      { label: 'Não quer ouvir', to: 'encerrar', danger: true },
    ],
  },
  motivo: {
    id: 'motivo',
    stage: 'Responsável',
    title: 'Por que liguei',
    goal: 'Uma frase sobre você e uma pergunta fácil sobre ele. Sem perguntar se ele tem problema.',
    say: [
      '{responsavel}, eu ajudo {grupo} a trazer {clientes} novos pelo Google e pelo WhatsApp.',
      '@hoje Me conta uma coisa: hoje, os {clientes} novos chegam mais por indicação, pelo Instagram ou pelo Google?#Pergunta fácil, sem certo ou errado. Deixe ele falar.',
    ],
    capture: ['hoje'],
    choices: [
      { label: 'Respondeu', to: 'aprofundar', primary: true },
      { label: 'Recusou', to: { outcome: 'sem-interesse' }, danger: true, iconOnly: true },
    ],
  },
  aprofundar: {
    id: 'aprofundar',
    stage: 'Responsável',
    title: 'Onde escapa',
    goal: 'Perguntas que ele mesmo responde e percebe o que deixa na mesa. Você não aponta problema.',
    say: [
      '@whats E os orçamentos que chegam pelo WhatsApp: de cada dez, mais ou menos quantos viram serviço?#Número baixo ou "não sei" é a deixa.',
      '@dor E o que você acha que faz o resto não fechar?#Anote nas palavras dele. É o que você usa no convite.',
    ],
    capture: ['whats', 'dor'],
    choices: [
      { label: 'Fazer o convite', to: 'convite', primary: true },
      { label: '"Tá tudo ótimo"', to: 'tranquilo' },
      { label: 'Recusou', to: { outcome: 'sem-interesse' }, danger: true, iconOnly: true },
    ],
  },
  tranquilo: {
    id: 'tranquilo',
    stage: 'Responsável',
    title: 'Tá tudo ótimo',
    goal: 'Concordar e fazer um convite leve, com saída fácil. Sem discutir.',
    say: [
      'Que bom, isso mostra que o trabalho de vocês é bem feito.',
      'Já pensou em melhorar ainda mais as suas vendas?#Pausa. Deixe ele responder: quem está bem quase sempre quer mais.',
      '@reuniao Posso te mostrar em 20 minutos, por vídeo chamada, o que daria pra ganhar a mais na {empresa}. Se não fizer sentido, você me fala. Tenho disponibilidade para reunião [dia] ou [dia]. O que acha?#Convite leve, com saída fácil.',
    ],
    capture: ['reuniao'],
    choices: [
      { label: 'Topou', to: 'agendar', primary: true },
      { label: 'Não quis', to: 'encerrar', danger: true },
    ],
  },
  convite: {
    id: 'convite',
    stage: 'Responsável',
    title: 'O convite',
    goal: 'Pedir a reunião com dois horários. Nunca "quando você pode?".',
    say: [
      'Já pensou em melhorar ainda mais as suas vendas?#Pausa. Com o sim dele, o convite vira resposta ao que ele quer.',
      'O que eu faço é montar um plano de 45 dias pra {empresa}, com o que funciona no seu tipo de negócio. Te mostro em 20 minutos, por vídeo.',
      '@reuniao Faz sentido a gente marcar? Eu tenho [dia] às [hora] ou [dia] às [hora]. O que acha?#Duas opções fecham mais que uma pergunta aberta.',
    ],
    capture: ['reuniao'],
    choices: [
      { label: 'Topou', to: 'agendar', primary: true },
      { label: 'Pediu pra ligar depois', to: 'ocupado' },
      { label: 'Não quis', to: 'encerrar', danger: true },
    ],
  },
  agendar: {
    id: 'agendar',
    stage: 'Agendamento',
    title: 'Agendado',
    goal: 'Confirmar tudo e garantir que quem decide vai estar lá.',
    say: [
      'Fechado! Então fica {reuniao}.',
      '@whatsapp Qual o seu WhatsApp para eu te mandar a confirmação da reunião?',
      '@decisores E além de você, mais alguém decide essa parte aí? Se tiver, seria importante chamar pra participar também.#Evita o "vou falar com meu sócio" no fim da reunião.',
      'Na conversa eu te mostro o plano da {empresa}, e você decide se faz sentido. Combinado?',
    ],
    capture: ['reuniao', 'whatsapp', 'decisores'],
    choices: [{ label: 'Encerrar: reunião marcada', to: { outcome: 'agendou' }, primary: true }],
  },
  ocupado: {
    id: 'ocupado',
    stage: 'Responsável',
    title: 'Ligar depois',
    goal: 'Sair com um horário marcado.',
    say: [
      '@horario Sem problema. Te ligo quando: hoje no fim da tarde ou amanhã de manhã?',
    ],
    capture: ['horario'],
    choices: [{ label: 'Encerrar e ligar de novo', to: { outcome: 'retorno' }, primary: true }],
  },
  encerrar: {
    id: 'encerrar',
    stage: 'Responsável',
    title: 'Encerrar bem',
    goal: 'Sair deixando a porta aberta. Sem insistir.',
    say: [
      'Tranquilo, {responsavel}. Obrigado pelo seu tempo.',
      'Posso te mandar meu contato no WhatsApp? Se um dia fizer sentido, você já sabe onde me achar.',
    ],
    capture: ['whatsapp'],
    message: 'contato',
    choices: [{ label: 'Encerrar', to: { outcome: 'sem-interesse' }, primary: true }],
  },
}

/**
 * O que quem atende (recepção) costuma perguntar antes de passar a ligação.
 * Responda curto, com segurança, e devolva com uma pergunta que leve ao responsável.
 */
export const CALL_RECEPTION_OBJECTIONS: [string, string][] = [
  [
    'Do que se trata?',
    'É um assunto que eu preciso ver direto com o {responsavel}, {atendente}. Coisa de dois minutos. Ele tá por aí?#Não explique. Quanto mais detalhe, mais ela filtra ou te manda pro e-mail. Tom tranquilo, de quem já conhece o caminho.',
  ],
  [
    'A gente já tem marketing / Já temos agência',
    'Ah, que bom! E não é pra mexer no que eles fazem. É uma coisa bem específica do atendimento pelo WhatsApp, que normalmente fica de fora do marketing. Se não fizer sentido, o próprio {responsavel} me fala. Consegue me passar pra ele?#Concorde primeiro. Mostre que é outra coisa, não uma disputa com a agência deles.',
  ],
  [
    'Quem gostaria? / De onde fala?',
    'É o {eu}, da {agencia}. Eu ajudo negócios daqui da região a trazer {clientes} novos. Consegue me passar pra quem cuida disso?',
  ],
  [
    'É venda? / É propaganda?',
    'É uma proposta, sim, por isso quero falar com quem decide. São dois minutinhos. Consegue me passar?#Honestidade aqui abre mais portas que desviar.',
  ],
  [
    'Ele não está / Está atendendo',
    'Sem problema. Qual o melhor horário pra eu falar com ele? De manhã ou à tarde?#Anote e siga para "Marcar o retorno".',
  ],
  [
    'Manda por e-mail / Deixa recado',
    'Até mandaria, mas não dá pra resolver por e-mail: depende de duas ou três perguntas rápidas sobre a {empresa}, e por escrito vira um texto genérico que não serve pra ele. Por telefone são dois minutos. Qual o melhor horário pra eu pegar ele aí?#Justifique com o bem dele (não perder tempo com texto genérico) e já peça o horário.',
  ],
  [
    'Não dá pra passar a ligação / Não posso passar o número dele',
    'Sem problema, entendo, {atendente}. Então me ajuda só com o melhor horário pra eu ligar e achar ele aí: de manhã ou à tarde? … Se ainda assim não der: Tranquilo, obrigado pela atenção! Eu tento de novo outro dia. Bom trabalho aí!#Com horário: siga para "Marcar o retorno". Sem horário: encerre com gentileza e marque "Ligar de novo" para tentar outro dia.',
  ],
  [
    'Me passa seu contato que ele te liga',
    'Claro, anota aí: {eu}, da {agencia}, [seu número]. E pra não deixar isso na sua mão: qual o melhor horário pra eu achar ele? Aí eu mesmo ligo, sem te dar trabalho.#Deixe o contato, mas não espere o retorno: quase nunca vem. Saia com um horário e siga para "Marcar o retorno".',
  ],
  [
    'Não temos interesse',
    'Tranquilo, entendo. Nem é pra decidir nada agora, é só uma ideia rápida pro {responsavel} avaliar. Qual o melhor horário pra eu falar com ele? Se ele não quiser, eu não ligo mais.#"Eu não ligo mais" tira a pressão dela. Se recusar de novo, agradeça e desligue com o botão vermelho.',
  ],
  [
    'Como conseguiu esse número?',
    'Tá no [Google / Instagram] da {empresa}. Eu procuro negócios da região que dá pra ajudar.#Diga sempre a verdade de onde tirou.',
  ],
]

/** Objeções do responsável: aparecem ao lado das fichas dele. Responda com pergunta. */
export const CALL_OBJECTIONS: [string, string][] = [
  [
    'Mas do que se trata?',
    'É sobre trazer mais {clientes} pra {empresa}, pelo Google e pelo WhatsApp. Por isso te pedi 30 segundos: posso te explicar?#Com o sim, siga pra "Por que liguei".',
  ],
  [
    'Me manda no WhatsApp.',
    'O que eu mostro é feito pra {empresa}, não é um material pronto. Por isso os 20 minutos. O que acha, posso reservar um horário pra eu te apresentar uma proposta?#Se insistir, pegue o WhatsApp e marque o retorno.',
  ],
  [
    'Já tenho alguém que faz isso.',
    'Ah, que bom que já tem alguém cuidando disso. Obrigado pela atenção, {responsavel}, e sucesso aí!#Não insista. Desligue com o botão vermelho.',
  ],
  [
    'Quanto custa?',
    'Depende do que a {empresa} precisa, por isso eu monto o plano antes. Na conversa eu te mostro o valor exato.',
  ],
  [
    'Não tenho tempo.',
    'Entendo. Por isso são só 20 minutos, por vídeo, de onde você estiver. O que acha? Posso reservar um horário pra eu te apresentar uma solução pra atrair mais clientes?',
  ],
  [
    'Tá difícil, sem dinheiro agora.',
    'Faz sentido. É justamente por isso que o plano mostra em 45 dias onde vale colocar dinheiro, e onde não vale. Vale 20 minutos pra você ver?',
  ],
  [
    'Não tenho gente pra dar conta do serviço.',
    'Entendo, {responsavel}, isso é mais comum do que parece. Me deixa te perguntar uma coisa. A sua agenda fica cheia o ano todo, ou tem mês bom e mês fraco? … ' +
      '[Se tem mês fraco] Então a ideia não é te encher no mês cheio, é não deixar o mês fraco vazio. E com serviço todo mês, contratar alguém deixa de ser um risco. Vale 20 minutos pra eu te mostrar? … ' +
      '[Se vive lotado] Que bom! Então o seu momento é de cobrar melhor, não de trazer mais gente. Se um dia quiser crescer, me chama.#Não discuta, é uma limitação real. Se ele vive lotado, não force. Agradeça e encerre.',
  ],
  [
    'Como você conseguiu meu número?',
    'Tá no [Google / Instagram] da {empresa}. Eu procuro negócios da região que dá pra ajudar.#Diga sempre a verdade de onde tirou.',
  ],
]

/** Mensagens prontas para copiar. Campo vazio vira [pista]. */
export const CALL_MESSAGES = {
  confirmacao:
    'Oi, {responsavel}! Aqui é o {eu}, da {agencia}. Confirmando nossa conversa: {reuniao}, por vídeo, uns 20 minutos. Vou te mostrar o plano de 45 dias que estou montando pra {empresa}. O link é este: [link]. Até lá!',
  lembrete:
    'Oi, {responsavel}! Passando pra lembrar da nossa conversa: {reuniao}. Prefira um local tranquilo, com computador ou notebook. O link é o mesmo: [link]. Até lá!',
  retorno:
    'Oi, {responsavel}! Aqui é o {eu}, da {agencia}. Combinei de te ligar {horario}. É rápido: quero te mostrar como trazer mais {clientes} pra {empresa} pelo Google e pelo WhatsApp.',
  contato:
    'Oi, {responsavel}! Aqui é o {eu}, da {agencia}, a gente se falou agora há pouco por telefone. Obrigado pelo seu tempo! Fica aqui o meu contato: se um dia quiser trazer mais {clientes} pra {empresa} pelo Google e pelo WhatsApp, é só me chamar. Sucesso aí!',
} as const

/** Passo a passo depois de marcar. */
export const AFTER_MEETING_STEPS: {
  id: string
  text: string
  message?: keyof typeof CALL_MESSAGES
  action?: 'piloto' | 'agenda'
}[] = [
  { id: 'confirmar', text: 'Mandar a confirmação no WhatsApp agora, com o link da chamada.', message: 'confirmacao' },
  { id: 'agenda', text: 'Colocar na sua agenda, com o link e o WhatsApp dele.', action: 'agenda' },
  { id: 'piloto', text: 'Criar a apresentação do Piloto 45 para a reunião.', action: 'piloto' },
  { id: 'lembrete', text: 'Um dia antes: mandar o lembrete.', message: 'lembrete' },
  { id: 'roteiro', text: 'Na hora da reunião: abrir o roteiro, ao lado da chamada.' },
]

/** Troca {chave} pela anotação; vazio vira [rótulo], para ficar claro o que falta. */
export function fillCallText(text: string, notes: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = (notes[key] ?? '').trim()
    return value || CALL_FIELDS[key]?.fallback || `[${(CALL_FIELDS[key]?.label ?? key).toLowerCase()}]`
  })
}

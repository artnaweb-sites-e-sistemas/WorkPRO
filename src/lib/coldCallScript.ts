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
  empresa: { label: 'Empresa', color: null, hint: 'Ex.: Studio Carla Carrion', short: true },
  nicho: { label: 'Nicho', color: null, hint: 'Ex.: pilates, odontologia, pet shop', short: true },
  cidade: { label: 'Cidade', color: null, hint: 'Ex.: Campinas', short: true },
  telefone: { label: 'Telefone', color: null, hint: 'Ex.: (19) 3232-0000', short: true },
  atendente: { label: 'Quem atendeu', color: null, hint: 'Ex.: Júlia', short: true },
  responsavel: { label: 'Nome do responsável', color: null, hint: 'Ex.: Carla', short: true },
  dor: { label: 'O problema, nas palavras dele', color: 'c3', hint: 'Ex.: tem mês que a agenda fica vazia' },
  hoje: { label: 'Como os clientes chegam hoje', color: 'c2', hint: 'Ex.: indicação e Instagram' },
  whats: { label: 'Como é o WhatsApp', color: 'c4', hint: 'Ex.: ela mesma responde, entre um aluno e outro' },
  horario: { label: 'Melhor horário pra ligar', color: 'c5', hint: 'Ex.: amanhã, depois das 14h', short: true },
  whatsapp: { label: 'WhatsApp do responsável', color: null, hint: 'Ex.: (19) 99999-0000', short: true },
  decisores: { label: 'Quem mais decide', color: 'c8', hint: 'Ex.: o sócio, Marcos', short: true },
  reuniao: { label: 'Dia e hora da reunião', color: 'c1', hint: 'Ex.: quinta, 10h', short: true },
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
  /* preenchidos pelo seu cadastro, não aparecem como campo */
  eu: { label: 'Seu nome', color: null, hint: '' },
  agencia: { label: 'Sua empresa', color: null, hint: '' },
}

export type CallOutcome = 'agendou' | 'retorno' | 'sem-interesse' | 'nao-atendeu'

export const CALL_OUTCOMES: Record<CallOutcome, { label: string; tone: 'good' | 'warn' | 'muted' }> = {
  agendou: { label: 'Agendou', tone: 'good' },
  retorno: { label: 'Ligar de novo', tone: 'warn' },
  'sem-interesse': { label: 'Sem interesse', tone: 'muted' },
  'nao-atendeu': { label: 'Não atendeu', tone: 'muted' },
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
      '@atendente [Bom dia / Boa tarde]! Aqui é o {eu}. Com quem eu falo?#Anote o nome. Chamar pelo nome muda o tom da ligação.',
      'Prazer, {atendente}. Quem cuida da {empresa} é você mesmo ou tem um responsável?',
    ],
    capture: ['atendente'],
    choices: [
      { label: 'É o responsável', to: 'abertura', primary: true, carry: { from: 'atendente', to: 'responsavel' } },
      { label: 'Não é o responsável', to: 'recepcao' },
      { label: 'Recusou', to: { outcome: 'sem-interesse' }, danger: true, iconOnly: true },
    ],
  },
  recepcao: {
    id: 'recepcao',
    stage: 'Recepção',
    title: 'Recepção',
    goal: 'Ela é aliada, não barreira. Peça ajuda e seja breve.',
    say: [
      '@responsavel {atendente}, você pode me ajudar? Qual o nome do responsável aí?',
      'Consegue me passar pra {responsavel} rapidinho? É coisa de dois minutos.#Tom de quem já espera o sim.',
    ],
    capture: ['responsavel'],
    choices: [
      { label: 'Transferiu', to: 'abertura', primary: true },
      { label: 'Não está ou está ocupado', to: 'recepcao-retorno' },
      { label: 'Pediu pra mandar mensagem', to: 'recepcao-mensagem' },
      { label: 'Recusou', to: { outcome: 'sem-interesse' }, danger: true, iconOnly: true },
    ],
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
      'Oi, {responsavel}! Aqui é o {eu}, da {agencia}.',
      'Eu sei que te liguei do nada. Posso te falar em 30 segundos por que liguei, e aí você me diz se faz sentido continuar?#Pausa. Espere o "pode falar". A honestidade baixa a guarda.',
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
    goal: 'Uma frase sobre você e uma pergunta sobre ele. Nada de apresentação longa.',
    say: [
      'Eu ajudo {grupo} a trazer {clientes} novos pelo Google e pelo WhatsApp.',
      '@dor Me diz uma coisa: hoje, a entrada de {clientes} novos aí tá do jeito que você queria?#Depois da pergunta, silêncio. Quem fala primeiro agora é ele.',
      'Tipo: {dor1}, ou {dor2}?#Só se ele travar. É um exemplo, não um discurso.',
    ],
    capture: ['dor'],
    choices: [
      { label: 'Reconheceu um problema', to: 'aprofundar', primary: true },
      { label: '"Tá tudo tranquilo"', to: 'tranquilo' },
      { label: 'Recusou', to: { outcome: 'sem-interesse' }, danger: true, iconOnly: true },
    ],
  },
  tranquilo: {
    id: 'tranquilo',
    stage: 'Responsável',
    title: 'Tá tudo tranquilo',
    goal: 'Não discutir. Uma curiosidade pode abrir a porta.',
    say: [
      '@hoje Que bom! Me tira uma curiosidade: hoje, de onde vêm os seus {clientes} novos?',
      'E se amanhã você quisesse o dobro de {clientes}, de onde eles viriam?#Se ele travar aqui, é a deixa pro convite.',
    ],
    capture: ['hoje'],
    choices: [
      { label: 'Abriu espaço', to: 'convite', primary: true },
      { label: 'Não quis seguir', to: 'encerrar', danger: true },
    ],
  },
  aprofundar: {
    id: 'aprofundar',
    stage: 'Responsável',
    title: 'Entender um pouco',
    goal: 'Duas perguntas, no máximo. O resto fica pra reunião.',
    say: [
      'Entendi. Isso acontece faz tempo?#Pergunta pra ganhar tempo enquanto você anota.',
      '@hoje E hoje, os {clientes} novos chegam como? Indicação, Instagram, Google?',
      '@whats E quando alguém chama no WhatsApp, quem responde? Dá conta?',
    ],
    capture: ['hoje', 'whats'],
    choices: [
      { label: 'Fazer o convite', to: 'convite', primary: true },
      { label: 'Recusou', to: { outcome: 'sem-interesse' }, danger: true, iconOnly: true },
    ],
  },
  convite: {
    id: 'convite',
    stage: 'Responsável',
    title: 'O convite',
    goal: 'Pedir a reunião com dois horários. Nunca "quando você pode?".',
    say: [
      'Pelo que você me contou, dá pra te ajudar, sim.',
      'O que eu faço é montar um plano de 45 dias pra {empresa}, com o que funciona no seu tipo de negócio. Te mostro em 20 minutos, por vídeo.',
      '@reuniao Faz sentido a gente marcar? Eu tenho [dia] às [hora] ou [dia] às [hora]. Qual fica melhor?#Duas opções fecham mais que uma pergunta aberta.',
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
      '@whatsapp Qual o seu WhatsApp? Te mando a confirmação agora, com o link da chamada.',
      '@decisores E além de você, mais alguém decide essa parte aí? Se tiver, chama pra participar também.#Evita o "vou falar com meu sócio" no fim da reunião.',
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
      'E qual o melhor WhatsApp pra eu te chamar, se não conseguir falar?',
    ],
    capture: ['horario', 'whatsapp'],
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
    choices: [{ label: 'Encerrar', to: { outcome: 'sem-interesse' }, primary: true }],
  },
}

/**
 * O que quem atende (recepção) costuma perguntar antes de passar a ligação.
 * Responda curto, com segurança, e devolva com uma pergunta que leve ao responsável.
 */
export const CALL_RECEPTION_OBJECTIONS: [string, string][] = [
  [
    '"Do que se trata?"',
    'Ah, é rapidinho, {atendente}. Eu tava olhando o Google da {empresa} e reparei numa coisa que queria mostrar pra quem cuida da parte dos {clientes} novos. Você me ajuda a falar com essa pessoa?#Tom leve, de quem pede ajuda. Sem falar em venda, anúncio ou proposta aqui.',
  ],
  [
    '"Quem gostaria?" / "De onde fala?"',
    'É o {eu}, da {agencia}. Eu ajudo negócios daqui da região a trazer {clientes} novos. Consegue me passar pra quem cuida disso?',
  ],
  [
    '"É venda?" / "É propaganda?"',
    'É uma proposta, sim, por isso quero falar com quem decide. São dois minutinhos. Consegue me passar?#Honestidade aqui abre mais portas que desviar.',
  ],
  [
    '"Ele não está" / "Está atendendo"',
    'Sem problema. Qual o melhor horário pra eu falar com ele? De manhã ou à tarde?#Anote e siga para "Marcar o retorno".',
  ],
  [
    '"Manda por e-mail" / "Deixa recado"',
    'Mando sim. Qual o WhatsApp de quem decide? E que horário eu ligo pra ver se chegou?#Siga para "Pediu mensagem".',
  ],
  [
    '"Não temos interesse"',
    'Entendo. Só pra eu não incomodar à toa: quem cuida dos clientes novos aí é o dono mesmo? Qual o melhor horário pra falar com ele?#Quem decide é o dono, não a recepção.',
  ],
  [
    '"Como conseguiu esse número?"',
    'Tá no [Google / Instagram] da {empresa}. Eu procuro negócios da região que dá pra ajudar.#Diga sempre a verdade de onde tirou.',
  ],
]

/** Objeções do responsável: aparecem ao lado das fichas dele. Responda com pergunta. */
export const CALL_OBJECTIONS: [string, string][] = [
  [
    '"Mas do que se trata?"',
    'É sobre trazer mais {clientes} pra {empresa}, pelo Google e pelo WhatsApp. Por isso te pedi 30 segundos: posso te explicar rapidinho?#Com o sim, siga pra "Por que liguei".',
  ],
  [
    '"Não tenho interesse."',
    'Tranquilo, {responsavel}, sem problema. Obrigado pelo seu tempo, e bom trabalho aí!#Não insista: quem já fechou não reabre por telefone. Desligue com o botão vermelho.',
  ],
  [
    '"Me manda no WhatsApp."',
    'Mando sim. Só que o que eu mostro é feito pra {empresa}, não é um material pronto. Por isso os 20 minutos. [dia] ou [dia], qual fica melhor?#Se insistir, pegue o WhatsApp e marque o retorno.',
  ],
  [
    '"Já tenho alguém que faz isso."',
    'Ah, que bom que já tem alguém cuidando disso. Obrigado pela atenção, {responsavel}, e sucesso aí!#Não insista. Desligue com o botão vermelho.',
  ],
  [
    '"Quanto custa?"',
    'Depende do que a {empresa} precisa, por isso eu monto o plano antes. Na conversa eu te mostro o valor exato, sem compromisso.',
  ],
  [
    '"Não tenho tempo."',
    'Entendo. Por isso são só 20 minutos, por vídeo, de onde você estiver. Fica melhor de manhã ou à tarde?',
  ],
  [
    '"Tá difícil, sem dinheiro agora."',
    'Faz sentido. É justamente por isso que o plano mostra em 45 dias onde vale colocar dinheiro, e onde não vale. Vale 20 minutos pra você ver?',
  ],
  [
    '"Como você conseguiu meu número?"',
    'Tá no [Google / Instagram] da {empresa}. Eu procuro negócios da região que dá pra ajudar.#Diga sempre a verdade de onde tirou.',
  ],
]

/** Mensagens prontas para copiar. Campo vazio vira [pista]. */
export const CALL_MESSAGES = {
  confirmacao:
    'Oi, {responsavel}! Aqui é o {eu}, da {agencia}. Confirmando nossa conversa: {reuniao}, por vídeo, uns 20 minutos. Vou te mostrar o plano de 45 dias que estou montando pra {empresa}. O link é este: [link]. Até lá!',
  lembrete:
    'Oi, {responsavel}! Passando pra lembrar da nossa conversa: {reuniao}. O link é o mesmo: [link]. Continua de pé?',
  retorno:
    'Oi, {responsavel}! Aqui é o {eu}, da {agencia}. Combinei de te ligar {horario}. É rápido: quero te mostrar como trazer mais {clientes} pra {empresa} pelo Google e pelo WhatsApp.',
  contato:
    'Oi, {responsavel}! Aqui é o {eu}, da {agencia}. Obrigado pela conversa de hoje. Fica meu contato: se um dia quiser trazer mais {clientes} pelo Google e pelo WhatsApp, é só chamar.',
} as const

/** Passo a passo depois de marcar. */
export const AFTER_MEETING_STEPS: { id: string; text: string; message?: keyof typeof CALL_MESSAGES; action?: 'piloto' }[] = [
  { id: 'confirmar', text: 'Mandar a confirmação no WhatsApp agora, com o link da chamada.', message: 'confirmacao' },
  { id: 'agenda', text: 'Colocar na sua agenda, com o link e o WhatsApp dele.' },
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

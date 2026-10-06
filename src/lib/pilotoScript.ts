/**
 * Roteiro da reunião do Piloto 45 (adaptado do Master Script).
 * Nas falas, `{chave}` é a anotação do lead (aparece colorida, na cor da chave) e
 * `[texto]` é uma pista para você adaptar na hora. `#` separa a fala de uma dica curta.
 * `@chave ` no início marca a pergunta-chave: espere a resposta e anote no campo daquela chave.
 */

/** Separa a marca de pergunta-chave (`@chave `) do texto da fala. */
/** As perguntas da ficha de slide como lista (uma ou várias). */
export function questionList(pergunte?: string | string[]): string[] {
  return pergunte === undefined ? [] : Array.isArray(pergunte) ? pergunte : [pergunte]
}

export function parseKeyQuestion(text: string): { key: string | null; text: string } {
  const match = text.match(/^@(\w+)\s+/)
  return match ? { key: match[1], text: text.slice(match[0].length) } : { key: null, text }
}

export type ScriptColor = 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6' | 'c7' | 'c8' | 'c9' | 'c10'

export interface ScriptCapture {
  label: string
  /** null = dado neutro (nome, empresa), sem cor */
  color: ScriptColor | null
  hint: string
  /** campo curto (input) em vez de texto longo */
  short?: boolean
  /** a IA corrige a anotação ao passar de ficha (texto livre; nomes e números não) */
  polish?: boolean
  /** para a IA do áudio: o que foi perguntado e o que conta como resposta */
  listen: string
}

export const SCRIPT_CAPTURES: Record<string, ScriptCapture> = {
  nome: { label: 'Nome dele', color: null, hint: 'Ex.: Carla', short: true, listen: 'Como o lead se chama, se ele disser.' },
  empresa: { label: 'Empresa', color: null, hint: 'Ex.: Studio Carla Carrion', short: true, listen: 'Nome do negócio, se ele citar.' },
  obj: { label: 'Objetivo', color: 'c1', hint: 'Ex.: encher os horários da manhã', polish: true, listen: 'Pergunta: o que ele quer conseguir trazendo mais clientes (encher horário, parar de depender de indicação, crescer). Anote a intenção que ele disser.' },
  hoje: { label: 'Como os clientes chegam hoje', color: 'c2', hint: 'Ex.: indicação e post impulsionado', polish: true, listen: 'Pergunta: de onde vêm os clientes novos hoje. Anote os canais que ele citar (indicação, Instagram, boca a boca, quem passa na porta).' },
  dor: { label: 'O problema, nas palavras dele', color: 'c3', hint: 'Ex.: fica com horário vago e tem que tirar do bolso pra pagar as contas', polish: true, listen: 'Pergunta: no mês em que a agenda fica mais vazia, o que pesa mais pra ele (a conta no fim do mês, os horários vagos ou ter que correr atrás de cliente). Anote a opção que ele escolher e o que ele contar junto, com as palavras dele, numa frase que caiba depois de "quando a agenda esvazia,". Se ele só disser algo vago como "tá meio parado", anote assim mesmo.' },
  whats: { label: 'O que acontece no WhatsApp', color: 'c4', hint: 'Ex.: demora horas, metade some', polish: true, listen: 'Pergunta: como costuma ser quando alguém chama no WhatsApp perguntando o preço. Anote quem responde, quanto demora e se as pessoas somem.' },
  falta: { label: 'O que está faltando', color: 'c10', hint: 'Ex.: alguém que cuide disso todo mês', polish: true, listen: 'Pergunta: o que ele acha que falta pra os clientes chegarem todo mês. Anote o que ele disser que falta.' },
  estopim: { label: 'O estopim', color: 'c5', hint: 'Ex.: abriu um estúdio novo na rua', polish: true, listen: 'Perguntas: se ele já contratou agência ou alguém pra anunciar; se sim, como foi e por que não funcionou; se não, o que fez ele querer resolver isso agora. Anote o fato que ele contar: o que deu errado na tentativa anterior ou o que aconteceu pra ele agir agora (aperto no caixa, mês ruim, conta que não fechou, concorrente novo). Se ele só disser que nunca contratou, sem motivo, anote "nunca contratou agência".' },
  crit: { label: 'O que o trabalho precisa ter', color: 'c8', hint: 'Ex.: ver os números, não ter que cuidar', polish: true, listen: 'O que um trabalho desses precisa ter pra valer a pena pra ele.' },
  numHoje: { label: 'Clientes novos por mês hoje', color: 'c6', hint: 'Ex.: 8', short: true, listen: 'Pergunta: quantos clientes novos por mês ele tem hoje. Só o número.' },
  numMeta: { label: 'Clientes novos por mês que ele quer', color: 'c6', hint: 'Ex.: 25', short: true, listen: 'Pergunta: quantos clientes novos por mês ele gostaria de ter. Só o número.' },
  custo: { label: 'O que acontece se nada mudar', color: 'c7', hint: 'Ex.: vou ter que fechar a turma da manhã', polish: true, listen: 'Pergunta: imaginando daqui a seis meses com o movimento igual ao de hoje, o que acontece com o negócio dele. Anote a consequência que ele disser.' },
  ticket: { label: 'Quanto um cliente paga', color: 'c8', hint: 'Ex.: uns R$ 300', short: true, listen: 'Pergunta: quanto um cliente costuma pagar, em média (se for mensalidade, quanto por mês). Anote só o valor em reais, do jeito que ele falar (ex.: "uns 300", "R$ 1.200", "2 mil"). Se ele tiver vários serviços ou pacotes, anote o que mais vende.' },
  meses: { label: 'Quantos meses um cliente fica', color: 'c8', hint: 'Ex.: uns 8', short: true, listen: 'Pergunta: quantos meses um cliente costuma ficar com ele. Anote só o número de meses (ex.: "8", "1 ano"). Vazio se ele não souber.' },
  virada: { label: 'O que mais chamou atenção', color: 'c9', hint: 'Ex.: o WhatsApp responder sozinho', polish: true, listen: 'Pergunta: o que mais chamou atenção no plano. Anote a parte que ele citar.' },
}

export const SCRIPT_PARTS = ['Conversa', 'Plano', 'Fechamento'] as const

export interface ScriptCard {
  part: 0 | 1 | 2
  title: string
  goal: string
  slides?: string
  tone?: string
  say?: string[]
  beats?: [string, string][]
  /** falas que a IA personaliza com as respostas dele; sem resposta, vale a genérica */
  adapt?: ScriptAdapt[]
  /** plano: uma ficha por slide, em três momentos */
  /** `etapas`: falas extras do "Fale", uma por parte do slide ([nome da parte, fala]) */
  /** `pergunte`: uma pergunta ou várias em sequência; `@chave ` no início marca a pergunta-chave, como nas falas */
  steps?: { fale: string; etapas?: [string, string][]; mostre: string[]; pergunte?: string | string[] }
  branch?: [string, string][]
  expect?: string
  capture?: string[]
  silence?: boolean
  objections?: boolean
}

export interface ScriptAdapt {
  /** índice da fala em `say`, ou 'fale' na ficha de slide */
  target: number | 'fale'
  /** respostas obrigatórias: sem elas, fica a genérica */
  from: string[]
  /** respostas que entram se existirem */
  also?: string[]
  /** o que a fala precisa fazer */
  brief: string
}

export interface ScriptPrices {
  /** plano de um canal (Instagram ou Google): "R$ 5.000" */
  list: string
  /** plano de um canal, fechando na reunião: "R$ 3.000" */
  deal: string
  /** Completo (dois canais): "R$ 6.000" */
  completoList: string
  /** Completo fechando na reunião: "R$ 4.000" */
  completoDeal: string
  /** parcela do Completo: "R$ 470,92" */
  completoInstallment: string
  /** desconto do Completo ("R$ 2.000"); vazio = sem desconto */
  completoSavings: string
  /** "R$ 1.000" */
  adBudget: string
  /** parcela do plano de um canal: "R$ 353,19" */
  installment: string
  installments: number
  /** desconto do plano de um canal ("R$ 2.000"); vazio = sem desconto */
  savings: string
  /** o desconto do Completo cobre os anúncios dos dois canais */
  savingsCoversAds: boolean
  /** data aproximada do dia 16 fechando hoje ("16/10") */
  adsStart: string
}

function slide(
  number: number,
  title: string,
  steps: NonNullable<ScriptCard['steps']>,
  adapt?: Omit<ScriptAdapt, 'target'>,
): ScriptCard {
  return {
    part: 1,
    title,
    slides: 'Slide ' + number,
    goal: 'Fale, mostre o slide e pergunte.',
    steps,
    adapt: adapt ? [{ ...adapt, target: 'fale' }] : undefined,
  }
}

/** Textos que a IA escreveu para a apresentação deste lead e que o roteiro reaproveita. */
export interface ScriptDeck {
  /** frase de cada etapa do slide do caminho: atrair, qualificar, vender */
  funnel: [string, string, string]
  /** ângulos dos três vídeos do slide de criativos; `spoken` = a descrição reescrita pela IA em tom de conversa */
  angles: { title: string; description: string; spoken?: string }[]
  /** nicho e cidade do lead, para a fala da vaga por ramo no investimento */
  niche: string
  city: string
  /** o cliente do lead paga todo mês (marcado no cadastro do piloto) */
  recurring: boolean
  /** quantos clientes novos pagam o Completo (trabalho + anúncios), pelo que um cliente deixa; sem valor, não entra */
  payback?: {
    /** o que o cliente paga ("R$ 280"; por mês, quando recorrente) */
    ticket: string
    clients: number
    hasMeta: boolean
    /**
     * Serviço recorrente: quanto cada cliente deixa no tempo que fica (`assumed` = ele não disse os meses)
     * e o acúmulo, entrando `clients` por mês, depois de `stackMonths` meses.
     */
    monthly?: { months: number; assumed: boolean; lifetime: string; stackMonths: number; stackClients: number; stackRevenue: string }
  }
}

/** Meses que um cliente fica, se for mensal: padrão quando ele não sabe dizer. */
export const DEFAULT_CLIENT_MONTHS = 6

/** Lê quantos meses ("8", "uns 10 meses", "1 ano", "um ano e meio" vira 18). Devolve 0 se não der pra ler. */
export function parseMonths(text: string): number {
  const lower = text.toLowerCase()
  const number = Number(lower.match(/\d+/)?.[0] ?? (/\bum ano\b/.test(lower) ? 1 : 0))
  if (!number) return 0
  const years = /\bano/.test(lower)
  const half = /e meio/.test(lower) ? 6 : 0
  return years ? number * 12 + half : number
}

/** Lê um valor em reais do jeito que se fala ("uns 300", "R$ 1.200", "2 mil", "250,50"). Devolve centavos, ou 0. */
export function parseMoneyCents(text: string): number {
  const match = text
    .toLowerCase()
    .match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*(mil\b|k\b)?/)
  if (!match) return 0
  const reais = Number(match[1].replace(/\./g, '')) + (match[2] ? Number(match[2].padEnd(2, '0')) / 100 : 0)
  const total = match[3] ? reais * 1000 : reais
  return Number.isFinite(total) && total > 0 ? Math.round(total * 100) : 0
}

/** "de odontologia" / "em Ilhabela", com volta genérica quando o piloto não tem o dado. */
function leadPlace(deck?: ScriptDeck): { nicheOf: string; cityIn: string } {
  const niche = deckPhrase(deck?.niche ?? '')
  const city = deckPhrase(deck?.city ?? '')
  const nicheLower = /^\p{Lu}\p{Ll}/u.test(niche) ? niche[0].toLowerCase() + niche.slice(1) : niche
  return {
    nicheOf: nicheLower ? `de ${nicheLower}` : 'do seu ramo',
    cityIn: city ? `em ${city}` : 'na sua região',
  }
}

/** O que a IA recebe pra reescrever a descrição de um vídeo como fala. */
export const ANGLE_SPOKEN_BRIEF =
  'Transformar a descrição deste vídeo de anúncio numa fala de conversa, explicando com quem o vídeo fala e o que ele mostra. ' +
  'Comece com "O primeiro", "O segundo" ou "O terceiro", conforme a posição do vídeo, e não repita o título. Sem pergunta. Até 25 palavras. ' +
  'Ex.: "Foco em pessoas que sofrem com dores na coluna e buscam fortalecimento com acompanhamento guiado" → ' +
  '"O primeiro fala com quem tem dor nas costas e quer se fortalecer com alguém do lado, acompanhando."'

/** Fala de cada vídeo: a versão de conversa, ou a descrição do slide enquanto ela não chega. Sem ângulo escrito, não entra. */
function angleBeats(deck?: ScriptDeck): [string, string][] {
  return (deck?.angles ?? [])
    .slice(0, 3)
    .map((angle, index): [string, string] | null => {
      const title = deckPhrase(angle.title)
      const text = deckPhrase(angle.spoken ?? '') || deckPhrase(angle.description) || title
      if (!text) return null
      return [title ? `Vídeo ${index + 1} · ${title}` : `Vídeo ${index + 1}`, `${text}.`]
    })
    .filter((beat): beat is [string, string] => beat !== null)
}

/** Frase do slide pronta pra abrir uma fala: sem os caracteres de marcação do roteiro e sem ponto final. */
function deckPhrase(text: string): string {
  return text.replace(/[{}[\]#@]/g, '').replace(/\s+/g, ' ').trim().replace(/[.;:]+$/, '')
}

/** Fala de cada etapa do caminho: o que o slide diz deste lead + o que a gente faz ali. */
function funnelBeats(deck?: ScriptDeck): [string, string][] {
  const [top, middle, bottom] = (deck?.funnel ?? ['', '', '']).map(deckPhrase)
  const lead = (phrase: string) => (phrase ? `${phrase}. ` : '')
  return [
    [
      'Atrair',
      lead(top) +
        'A gente coloca anúncios no Google e no Instagram, e arruma o seu perfil no Google e no Instagram. Assim, quem procura pelo que você vende encontra você.',
    ],
    [
      'Qualificar',
      lead(middle) +
        'Quando essa pessoa chama no WhatsApp, o nosso sistema, a RouteLab, responde na hora. Ele tira as dúvidas dela e entende o que ela precisa.',
    ],
    ['Vender', lead(bottom) + 'Aí a conversa passa pra você ou pra alguém da sua equipe, com o cliente já pronto pra fechar.'],
  ]
}

export function buildScriptCards(prices: ScriptPrices, deck?: ScriptDeck): ScriptCard[] {
  const hasDeal = Boolean(prices.savings || prices.completoSavings)
  const place = leadPlace(deck)
  return [
    {
      part: 0,
      title: 'Abertura',
      goal: 'Combinar o formato e ouvir o objetivo.',
      say: [
        'Oi, {nome}! Aqui é o Bira. Tudo bem? Tá me ouvindo bem?',
        ...(hasDeal
          ? [
              'O objetivo desta reunião é entender melhor o seu momento e, se fizer sentido, te mostrar um plano.\nNo final tem uma condição que só vale para quem decide aqui na reunião. Combinado?#Espere o "combinado". No preço, ele já sabe a regra.',
            ]
          : []),
        'Antes de te mostrar o plano, vou te fazer umas perguntas rápidas pra entender o seu cenário. Pode ser?#Com isso combinado, as perguntas viram parte do plano, não interrogatório.',
        '@obj Pelo que a gente conversou, você quer trazer mais clientes pela internet. O que você quer conseguir com isso? Encher horário vago, parar de depender de indicação, crescer e contratar mais funcionarios?',
      ],
      expect: 'O objetivo e o porquê.',
      capture: ['nome', 'empresa', 'obj'],
    },
    {
      part: 0,
      title: 'Como é hoje',
      goal: 'De onde vêm os clientes e o que pesa quando não vêm.',
      say: [
        '@hoje Pra chegar nisso, quero entender como é hoje. De onde vêm os seus clientes novos?',
        '@dor Imagino que tem mês em que a agenda fica mais vazia. Nesse mês, o que pesa mais pra você? A conta no fim do mês, os horários vagos ou ter que correr atrás de cliente?#Deixe ele escolher e completar. Se vier curto, puxe: "Como assim?"',
        'Então quando a agenda esvazia, {dor}. É isso?#Repita em voz alta. Ele precisa ouvir o próprio problema.',
      ],
      expect: 'O canal de hoje e um exemplo concreto do mês fraco.',
      capture: ['hoje', 'dor'],
      adapt: [
        {
          target: 0,
          from: ['obj'],
          brief:
            'Retomar em poucas palavras o objetivo que ele acabou de contar, com as palavras dele, e emendar na pergunta de onde vêm os clientes novos hoje. Uma pergunta só. Ex.: "Pra parar de depender de indicação, quero entender o hoje: de onde vêm os seus clientes novos?"',
        },
        {
          target: 1,
          from: ['hoje'],
          brief:
            'Duas frases. Primeira: retomar o canal que ele acabou de citar pelo nome simples (as indicações, o Instagram, o boca a boca) e supor, com naturalidade, que tem mês em que a agenda fica mais vazia. ' +
            'Segunda: perguntar o que pesa mais pra ele nesse mês, dando as três opções: a conta no fim do mês, os horários vagos ou ter que correr atrás de cliente (troque "cliente" pela palavra do negócio dele: aluno, paciente). ' +
            'A pergunta tem que ser entendida por alguém que ouve devagar: nada de "da última vez", "isso", "dia a dia" ou palavras abstratas (cenário, impacto, situação). ' +
            'Ex.: "Com as indicações, imagino que tem mês em que a agenda fica mais vazia. Nesse mês, o que pesa mais? A conta, os horários vagos ou correr atrás de aluno?"',
        },
      ],
    },
    {
      part: 0,
      title: 'O WhatsApp',
      goal: 'Achar a falha do atendimento.',
      say: [
        '@whats Num mês fraco, cada contato conta. Quando alguém chama no WhatsApp perguntando o preço, como costuma ser?#Escute: quem responde, quanto demora, quantos somem.',
      ],
      expect: '"Demora", "eu mesmo respondo quando dá", "muita gente some".',
      capture: ['whats'],
      adapt: [
        {
          target: 0,
          from: ['dor'],
          brief:
            'Ligar o problema que ele acabou de contar ao valor de cada contato que chega e perguntar como costuma ser quando alguém chama no WhatsApp perguntando o preço. Uma pergunta só. Ex.: "Se no mês fraco você fica correndo atrás de cliente, quem chama já vale muito. Como costuma ser quando alguém pergunta o preço no WhatsApp?"',
        },
      ],
    },
    {
      part: 0,
      title: 'O que está faltando',
      goal: 'Ele mesmo diz o que falta, sem culpar a crise.',
      say: [
        '@falta Então tem movimento, só que ele não se sustenta sozinho. Hoje os clientes chegam por {hoje}. O que você acha que falta pra eles chegarem todo mês, e não só de vez em quando?',
      ],
      expect: '"Falta alguém cuidando disso", "não tenho tempo", "não sei mexer com anúncio".',
      capture: ['falta'],
      adapt: [
        {
          target: 0,
          from: ['whats'],
          also: ['hoje'],
          brief:
            'Retomar em poucas palavras o que ele acabou de contar do WhatsApp (demora, gente que some) e perguntar o que ele acha que falta pra os clientes chegarem todo mês, e não só de vez em quando. Uma pergunta só.',
        },
      ],
    },
    {
      part: 0,
      title: 'O que já tentou',
      goal: 'Tirar a objeção antes do preço e achar o estopim.',
      say: ['Faz sentido. E pra resolver isso, antes de falar comigo, você já contratou agência ou alguém pra anunciar?'],
      branch: [
        ['Se sim', '@estopim Como foi? Por que você acha que não funcionou?'],
        ['Se não', '@estopim E o que fez você querer resolver isso agora?'],
      ],
      expect: 'O motivo da última tentativa ter falhado, ou o momento que fez ele agir.',
      capture: ['estopim'],
      adapt: [
        {
          target: 0,
          from: ['falta'],
          brief:
            'Retomar o que ele acabou de dizer que falta e perguntar se, antes de falar com você, ele já contratou agência ou alguém pra anunciar. Uma pergunta só. Ex.: "E pra ter alguém cuidando disso, você já contratou agência ou alguém pra anunciar antes?"',
        },
      ],
    },
    {
      part: 0,
      title: 'Os números',
      goal: 'Escancarar a distância entre hoje e o que ele quer.',
      say: [
        '@numMeta Maravilha! Estou quase terminando as perguntas, {nome}.\nSe tudo desse certo do jeito que você quer, quantos clientes novos por mês você gostaria de ter?',
        '@numHoje E hoje, quantos são, mais ou menos?',
        'Então de {numHoje} pra {numMeta}. É uma diferença considerável, né?',
        ...(deck?.recurring
          ? [
              '@ticket E me fala uma coisa, quanto um cliente seu costuma pagar por mês, mais ou menos?#Se ele tiver vários planos, peça o que mais vende. Esse valor volta no investimento.',
              '@meses E um cliente costuma ficar quantos meses com você?#Se ele não souber, a conta usa 6 meses.',
            ]
          : [
              '@ticket E me fala uma coisa, um cliente seu costuma pagar quanto, mais ou menos?#Se ele tiver vários serviços ou pacotes, peça o que mais vende. Esse valor volta no investimento.',
            ]),
      ],
      expect: 'Os dois números e quanto vale um cliente novo.',
      capture: ['numHoje', 'numMeta', 'ticket', ...(deck?.recurring ? ['meses'] : [])],
      adapt: [
        {
          target: 0,
          from: ['estopim'],
          brief:
            'Começar com "Maravilha! Estou quase terminando as perguntas, {nome}.", retomar em poucas palavras o que ele acabou de contar (a última tentativa ou o motivo de agir agora) e perguntar quantos clientes novos por mês ele gostaria de ter, se tudo desse certo do jeito que ele quer. ' +
              'Nunca diga "imagina tudo isso rodando" nem fale de plano, sistema ou trabalho, porque nada foi apresentado ainda. Uma pergunta só.',
        },
      ],
    },
    {
      part: 0,
      title: 'Custo de não agir',
      goal: 'É aqui que ele decide. Mude o tom.',
      tone: 'Mais devagar. Mais sério.',
      say: [
        'Última pergunta, {nome}, e essa é mais direta.',
        '@custo Imagina daqui a seis meses, com o movimento igual ao de hoje. O que acontece com o seu negócio?#Concreto: ele precisa se ver no cenário. Espere ele responder.',
        'E faz sentido continuar desse jeito?#Ele precisa dizer o "não" em voz alta.',
      ],
      expect: '"Não, é por isso que estou aqui."',
      capture: ['custo'],
      adapt: [
        {
          target: 1,
          from: ['obj'],
          also: ['dor'],
          brief:
            'Duas frases curtas. Primeira: pintar o cenário de daqui a seis meses com tudo igual a hoje, usando as palavras dele (o objetivo ainda não alcançado e, se houver, o problema continuando). Segunda: a pergunta "O que acontece com o seu negócio?". ' +
            'Nunca ponha o objetivo depois de "como fica" e não use palavras abstratas (estagnado, cenário, situação). Calma, sem drama. ' +
            'Ex.: objetivo "encher a agenda", problema "fica estressado correndo atrás de cliente" → "Imagina daqui a seis meses, a agenda ainda com horário vago e você correndo atrás de cliente. O que acontece com o seu negócio?"',
        },
      ],
    },
    {
      part: 0,
      title: 'Resumo',
      goal: 'Ele confirma e sabe que não vai sozinho. Só então você abre a tela.',
      say: [
        'Perfeito, {nome}. Pelo que você me contou, eu consigo te ajudar.',
        'Você quer {obj}. Hoje os clientes vêm de {hoje}, e {dor}. E o que falta é {falta}.',
        'Se continuar assim, {custo}. Você até comentou que {estopim}. É isso?',
        'E o melhor é que você não vai ter que cuidar disso sozinho. A parte pesada fica com a gente. A gente monta tudo, cuida dos anúncios e acompanha os resultados junto com você. Você só vai precisar gravar alguns vídeos e atender quem chegar já querendo comprar.',
        'Montei um plano pra {empresa}. Posso compartilhar a tela pra te mostrar?#Só agora abra o slide 1.',
      ],
      expect: '"É isso mesmo."',
      adapt: [
        {
          target: 1,
          from: ['obj', 'hoje', 'dor'],
          also: ['falta'],
          brief: 'Resumir em uma ou duas frases o que ele quer, como os clientes chegam hoje, o problema e o que falta, com as palavras dele.',
        },
        {
          target: 2,
          from: ['custo'],
          also: ['estopim'],
          brief: 'Dizer o que acontece se continuar assim e lembrar o estopim que ele contou, se houver. Terminar com a pergunta "É isso?".',
        },
      ],
    },
    slide(1, 'Capa', {
      fale: 'Então, {nome}, montei esse plano pensando no que você me contou. Eu chamei ele de Piloto 45.',
      mostre: ['Leia a promessa: 45 dias pra descobrir de onde vêm os clientes da {empresa}.'],
    }),
    slide(2, 'Diagnóstico', {
      fale: 'Antes da nossa conversa, eu estudei o mercado da {empresa}: como as pessoas procuram o que você vende aí na sua região.',
      mostre: ['Leia a frase principal.', 'Passe pelas 3 linhas, uma por uma.'],
      pergunte: 'Isso bate com o que você vive aí no dia a dia?',
    }),
    slide(3, 'Onde o cliente se perde', {
      fale: 'Pelo que você me contou, cliente existe. O problema é que ele se perde no caminho até chegar em você. E ele se perde em três pontos.#Aponte cada ponto do slide enquanto fala.',
      etapas: [
        ['1. Quem procura não te encontra', 'A pessoa procura no Google o que você vende, não acha a {empresa} e acaba indo no concorrente.'],
        ['2. Quem encontra não confia', 'A pessoa acha você, olha o Instagram ou o site, não sente confiança e desiste antes de chamar.'],
        ['3. Quem chama espera demais', 'A pessoa manda mensagem no WhatsApp, demora pra ter resposta e vai comprar com quem respondeu primeiro.'],
      ],
      mostre: [],
      pergunte: 'Desses três, qual você sente mais aí na {empresa}?',
    }, {
      from: ['dor'],
      brief:
        'Duas frases curtas. Primeira: retomar o problema que ele contou, reescrito na gramática da frase (nunca colado como está). ' +
        'Segunda: virar a chave, dizendo que cliente existe, mas se perde no caminho até chegar nele, em três pontos (os três aparecem no slide). ' +
        'Ex.: problema "você tem que correr atrás de novos clientes" → "Você me contou que vive correndo atrás de cliente novo. Só que cliente existe: ele se perde no caminho até chegar em você, em três pontos."',
    }),
    slide(4, 'O caminho', {
      fale: 'Pra resolver esses três pontos, a gente monta um caminho com três etapas. Vou te mostrar uma por uma.',
      etapas: funnelBeats(deck),
      mostre: ['Aponte cada coluna do slide enquanto fala a etapa dela.'],
    }),
    slide(5, 'As duas fases', {
      fale: 'E tudo isso fica pronto em 45 dias, divididos em duas fases.',
      etapas: [
        [
          'Fundação · dias 1 a 15',
          'Nos primeiros 15 dias, a gente arruma a casa. O seu Google, o seu Instagram, as contas de anúncio, os vídeos e o WhatsApp. Assim, nenhum real vai pra anúncio antes de tudo estar pronto pra receber o cliente.',
        ],
        [
          'Tráfego · dias 16 a 45',
          'No dia 16, os anúncios começam a aparecer no Instagram e no Google. Durante 30 dias, a gente acompanha todo dia e vai ajustando, pra trazer mais clientes gastando menos.',
        ],
        [
          'Dia 45',
          'No dia 45, você recebe um relatório mostrando o que trouxe cliente e onde vale a pena colocar dinheiro. Aí você decide se continua, já com os números na mão.#Emende: "Agora deixa eu te mostrar cada fase."',
        ],
      ],
      mostre: ['Aponte a barra preta, depois a azul, e termine no Dia 45, à direita.'],
    }),
    slide(6, 'Fundação', {
      fale: 'Vamos começar pela primeira fase, a fundação. Ela tem três partes, e tudo fica pronto nos primeiros 15 dias.',
      etapas: [
        [
          'Presença',
          'A gente cria uma página de vendas, deixa o seu Instagram mais profissional e arruma o seu perfil no Google. Isso resolve os dois primeiros pontos. Quem procura passa a te encontrar, e quem encontra passa a confiar.',
        ],
        [
          'Anúncios',
          'A gente cria as contas de anúncio do Instagram e do Google no nome da {empresa}, e faz três vídeos pros anúncios. Tudo fica no seu nome, e já pronto pra contar quantas pessoas chamaram.',
        ],
        [
          'Atendimento',
          'E a gente liga o seu WhatsApp ao nosso sistema, com um roteiro de venda e uma mensagem automática pra quem parou de responder.#Não detalhe aqui: o atendimento tem um slide só dele mais à frente.',
        ],
      ],
      mostre: ['Uma coluna por vez, da esquerda pra direita. Não leia os itens: o slide já mostra.'],
      pergunte: 'Como você acha que isso ajudaria a {empresa} hoje?',
    }),
    slide(7, 'Os vídeos', {
      // O "mostre" vai na dica da abertura: apontar os vídeos acontece antes do "Por que três".
      fale: 'Lembra dos três vídeos que eu falei agora há pouco? Deixa eu te mostrar quais são. Cada vídeo mostra a {empresa} de um jeito diferente.#Agora aponte cada vídeo do slide enquanto fala o dele.',
      etapas: [
        ...(angleBeats(deck).length
          ? angleBeats(deck)
          : ([['Os três vídeos', 'Leia o ângulo de cada vídeo no slide, um por um.']] as [string, string][])),
        [
          'Por que três',
          'A gente coloca os três vídeos no ar ao mesmo tempo, e o relatório mostra qual deles traz mais cliente. A gente escreve o roteiro e edita os vídeos, já incluso. E se precisar de vídeo novo durante os anúncios, a gente grava sem custo extra.',
        ],
      ],
      mostre: [],
      pergunte: 'Qual desses três vídeos você acha que mais combina com os seus clientes?',
    }),
    slide(8, 'Tráfego', {
      fale: 'E é com esses vídeos que, no dia 16, os anúncios começam a rodar. A partir daí, são 30 dias de trabalho, num ciclo que se repete todo dia.#Aponte o círculo à esquerda.',
      etapas: [
        [
          'O ciclo',
          'Todo dia a gente faz três coisas. Deixa o anúncio no ar, vê quantas pessoas chamaram e ajusta o que não funcionou. Assim, a cada semana, você traz mais clientes gastando menos.#Agora desça pela lista à direita.',
        ],
        [
          'O dinheiro dos anúncios',
          `São ${prices.adBudget} pro Google e ${prices.adBudget} pro Instagram. Você paga direto pra eles, no cartão da empresa, aos poucos, durante os 30 dias. Esse dinheiro não passa pela gente.`,
        ],
        [
          'Vídeos e atendimento',
          'Se o relatório mostrar que precisa de vídeo novo, a gente grava, já incluso. E a gente também lê as conversas do seu WhatsApp pra melhorar o atendimento e vender mais.',
        ],
        ['Relatórios', 'E você acompanha tudo. Quanto dinheiro foi investido, quantas pessoas chamaram e quanto custou cada uma. Tudo em número, sem chute.'],
      ],
      mostre: [],
      pergunte: 'Faz sentido pra você até aqui?',
    }),
    slide(9, 'Atendimento', {
      fale: 'Só que, {nome}, não adianta o anúncio trazer gente se a conversa trava no WhatsApp. Esse é o terceiro ponto, e foi o que você me contou.',
      etapas: [
        [
          'A conversa',
          'Quando alguém chama no seu WhatsApp, o nosso sistema, a RouteLab, responde em segundos, até de madrugada, do jeito que a {empresa} fala. Ele conversa com a pessoa, entende o que ela precisa e deixa ela pronta pra comprar.#Aponte o celular no meio do slide.',
        ],
        [
          'Os três caminhos',
          'Depois, cada conversa vai pra um caminho. Quem já quer comprar passa direto pra você ou pra alguém da sua equipe fechar. Quem parou de responder recebe uma mensagem automática, na hora certa. E quem perdeu o interesse sai da fila, e a gente tenta de novo mais pra frente.#Aponte Quente, Morno e Frio, à direita.',
        ],
        ['Fechando', 'Ou seja, ninguém que te chama fica sem resposta.'],
      ],
      mostre: [],
    }),
    {
      part: 1,
      title: 'Demonstração',
      slides: 'RouteLab',
      goal: 'Mostrar o sistema rodando em até 3 minutos. Cada parte abaixo diz quando falar; o resto você comenta com suas palavras.',
      steps: {
        fale: 'Deixa eu te mostrar o sistema onde isso tudo funciona.#Antes: conta de demonstração logada, com Automações, Atendimento e Kanban abertos nesta ordem. Não mostre a Agenda nem as configurações.',
        etapas: [
          [
            'Ao abrir o sistema',
            'Essa é a RouteLab, o sistema que vai atender o seu WhatsApp. A gente criou aqui na Artnaweb, ele é 100% nosso. Então, se a {empresa} precisar de algum ajuste, a gente muda direto.',
          ],
          [
            'Na tela de Automações',
            'Esse desenho é o caminho que cada conversa faz, do "oi" do cliente até chegar em você ou em alguém da sua equipe.#Siga as setas com o mouse e diga o que acontece em cada caixa. Depois abra o Simulador: "aqui eu testo como se fosse um cliente."',
          ],
          [
            'Na tela de Atendimento',
            'Aqui você ou alguém da sua equipe vê e responde todas as conversas do WhatsApp num lugar só.#Abra uma conversa e mostre as anotações, as tags e o lembrete. Use as suas palavras.',
          ],
          [
            'Na tela do Kanban',
            'Aqui cada cliente vira um cartão, na etapa em que ele está. Chegou, conversando, agendou, fechou. Você bate o olho e sabe como está o mês.#Passe pelas colunas, da esquerda pra direita.',
          ],
          ['Ao voltar pros slides', 'Tudo isso que você viu, a gente monta pra {empresa} na primeira fase, a fundação.'],
        ],
        mostre: [],
        pergunte: 'Imagina isso rodando aí. O que mudaria no seu dia?#Opcional: pule se a conversa já estiver longa.',
      },
    },
    slide(10, 'Comparação', {
      fale: 'Pra fechar essa parte, olha a diferença entre o atendimento de hoje e o atendimento com a RouteLab.#Aponte a coluna escura, à direita.',
      etapas: [
        [
          'Resposta',
          'Hoje, a resposta pra quem te procura sai quando alguém vê a mensagem no WhatsApp, e só no horário comercial. Com o nosso sistema, a RouteLab, ela sai em segundos, 24 horas por dia.',
        ],
        [
          'Ninguém esquecido',
          'Hoje, quem para de responder costuma ficar esquecido. Com a RouteLab, essa pessoa recebe uma mensagem de volta, na hora certa.#Se ele contou que gente some no WhatsApp, lembre disso aqui.',
        ],
        [
          'Quem vende',
          'E quem fecha a venda continua sendo você ou alguém da sua equipe. A automação só esquenta a conversa antes.#Aponte a frase em destaque, embaixo.',
        ],
      ],
      mostre: [],
      pergunte: 'Ficou alguma dúvida até aqui?',
    }),
    {
      ...slide(11, 'Dia 45', {
        fale: 'E aí, no dia 45, você vai ter tudo na mão pra decidir o que fazer.#Aponte o relatório, à esquerda.',
        etapas: [
          [
            'O relatório',
            'A gente te entrega um relatório mostrando o que deu certo. Quanto você pagou por cada pessoa que chamou, no Instagram e no Google. Quem tinha interesse de verdade. Qual vídeo foi melhor. E onde vale a pena colocar mais dinheiro.',
          ],
          [
            'Fica com você',
            'E tem uma coisa importante. Mesmo que você não continue com a gente, muita coisa fica com você. O Instagram arrumado, o perfil no Google, os três vídeos, as contas de anúncio no nome da {empresa} e o próprio relatório.#Aponte a coluna do meio.',
          ],
          [
            'Continua se você quiser',
            'Agora, a página de vendas, o WhatsApp com automação e os anúncios só continuam se você quiser seguir com a gente. Nada renova sozinho. Você decide depois de ver o relatório.#Aponte a coluna da direita.',
          ],
          ['Fechando', 'Então, resumindo, esse é o plano pra você sair de {numHoje} pra {numMeta} clientes por mês.'],
        ],
        mostre: [],
        pergunte: [
          '{nome}, você acha que esse plano resolve o que você tá precisando?#Espere o sim antes da próxima.',
          '@virada E o que mais te chamou atenção em tudo isso?#Repita isso no preço, na próxima ficha.',
          'Se estiver tudo certo pra você, o próximo passo é a gente falar do investimento. Pode ser?#Espere o sim. O slide do investimento só abre depois da próxima ficha.',
        ],
      }),
      goal: 'Ele diz sim ao plano antes do preço.',
      expect: 'A parte que mais pesou pra ele. Você repete no preço.',
      capture: ['virada'],
    },
    {
      part: 2,
      title: 'Antes do preço',
      slides: 'Antes do slide 12',
      goal: 'Explicar como funciona antes de mostrar os valores. Ainda não abra o slide do investimento.',
      steps: {
        fale: 'Antes de eu te mostrar os valores, deixa eu te explicar rapidinho como funciona.',
        etapas: [
          ...(hasDeal
            ? ([
                [
                  'A condição de hoje',
                  'Quem decide aqui na reunião tem um valor menor. Porque, fechando agora, eu não preciso mandar proposta, ficar esperando retorno, marcar outra reunião. Essa economia eu passo pra você.',
                ],
              ] as [string, string][])
            : []),
          [
            'A vaga',
            `${hasDeal ? 'E tem um detalhe importante, {nome}' : 'Tem um detalhe importante, {nome}'}. Hoje eu ainda não tenho nenhum cliente ${place.nicheOf} ${place.cityIn}. ` +
              'E eu só trabalho com um por ramo em cada cidade, justamente pra não atender dois concorrentes. ' +
              'Então, se você fechar, essa vaga fica com você.#Tom de regra, não de pressão.',
          ],
          [
            'Os anúncios',
            'E o dinheiro dos anúncios é à parte. Você paga direto pro Instagram e pro Google, no seu cartão, aos poucos durante os 30 dias. Esse dinheiro não passa pela gente.',
          ],
        ],
        mostre: [],
        pergunte: 'Tudo certo até aqui? Ficou alguma dúvida?#Depois da resposta, abra o slide do investimento.',
      },
    },
    {
      ...slide(12, 'Investimento', {
        fale: 'Eu tenho três planos pra você.#Passe pelos cards da esquerda pra direita.',
        etapas: [
          [
            'Os dois primeiros',
            `O primeiro anuncia só no Instagram, e o segundo só no Google. ${prices.savings ? 'Fechando hoje, o' : 'O'} nosso trabalho em cada um sai por ${prices.deal}.`,
          ],
          [
            'O que eu recomendo',
            `Mas o que eu mais recomendo é o terceiro, o Completo. Ele cuida do Instagram e do Google juntos, e no fim você sabe qual dos dois traz mais cliente. ` +
              `${prices.completoSavings ? 'Fechando hoje, o' : 'O'} nosso trabalho nele sai por ${prices.completoDeal}.#Aponte o último card, o escuro.`,
          ],
          [
            'Pagamento',
            `Dá pra pagar à vista no Pix, ou parcelar em ${prices.installments}x no cartão. No Completo, fica ${prices.installments}x de ${prices.completoInstallment}.#Se ele perguntar de um canal só: ${prices.installments}x de ${prices.installment}.`,
          ],
          ...(deck?.payback
            ? ([
                [
                  'A conta',
                  'E pensa comigo, {nome}. ' +
                    (deck.payback.monthly
                      ? `Se cada cliente paga uns {{ticket|${deck.payback.ticket}}} por mês e fica${deck.payback.monthly.assumed ? ', digamos,' : ''} uns ` +
                        (deck.payback.monthly.assumed ? `${deck.payback.monthly.months} meses` : `{{meses|${deck.payback.monthly.months} meses}}`) +
                        ` com você, cada cliente novo deixa uns ${deck.payback.monthly.lifetime}. Então `
                      : `Se um cliente novo paga uns {{ticket|${deck.payback.ticket}}} com você, `) +
                    (deck.payback.clients === 1
                      ? 'basta 1 cliente novo pra pagar tudo, o nosso trabalho e os anúncios.'
                      : `bastam ${deck.payback.clients} clientes novos pra pagar tudo, o nosso trabalho e os anúncios.`) +
                    (!deck.payback.monthly && deck.payback.hasMeta ? ' E você me disse que quer chegar em {numMeta} por mês.' : '') +
                    (deck.payback.monthly?.assumed
                      ? '#Ele não disse quantos meses um cliente fica, então a conta usa 6. Fale como estimativa. Não prometa resultado.'
                      : '#Não prometa resultado. Mostre só a conta e deixe ele tirar a conclusão.'),
                ],
                ...(deck.payback.monthly && deck.payback.monthly.stackMonths >= 2
                  ? ([
                      [
                        'Mês a mês',
                        `E o melhor é que quem entra continua pagando. Se entrarem uns ${deck.payback.clients} clientes novos por mês, ` +
                          `no ${deck.payback.monthly.stackMonths === 2 ? 'segundo' : 'terceiro'} mês você já tem ${deck.payback.monthly.stackClients} clientes a mais pagando, ` +
                          `uns ${deck.payback.monthly.stackRevenue} entrando todo mês.#É a constância que faz a diferença. Fale como conta, não como promessa.`,
                      ],
                    ] as [string, string][])
                  : []),
              ] as [string, string][])
            : []),
        ],
        mostre: [],
        pergunte: `Então, {nome}, se a gente fechar hoje, seus anúncios já começam a rodar por volta do dia ${prices.adsStart}. Como você prefere seguir?`,
      }),
      part: 2,
      goal: 'Fale o preço e espere. Sem se justificar.',
      silence: true,
    },
    {
      ...slide(13, 'Depois do sim', {
        fale: 'Perfeito, {nome}! Então deixa eu te mostrar como a gente começa.#Aponte a lista à direita, de cima pra baixo.',
        etapas: [
          ['Hoje', 'Hoje você escolhe o plano, e eu já te mando o link de pagamento aqui, enquanto a gente conversa.'],
          [
            'Em até 24 horas',
            'Depois do pagamento, eu te mando um formulário rápido sobre a {empresa}: o que você vende, pra quem, e o seu jeito de falar com os clientes. É só preencher.',
          ],
          ['Dia 1', 'Assim que você me devolver o formulário, começa a fundação, com o Instagram, o Google, a página, os vídeos e o WhatsApp.'],
          ['Dia 16', 'No dia 16, os anúncios entram no ar, e a gente acompanha e ajusta até o fim.'],
          [
            'Dia 45',
            'E no dia 45 você recebe o relatório e decide se segue com tudo, só com uma parte, ou se para por ali. Nada renova sozinho.',
          ],
        ],
        mostre: [],
        pergunte: [
          'Posso te mandar o link pra você fazer o pagamento?#Se ele ainda não disse qual plano, pergunte antes. Mande o link assim que ele disser sim.',
          'E o formulário eu te mando logo depois do pagamento. Consegue me devolver até amanhã?#Combine o prazo antes de desligar.',
        ],
      }),
      part: 2,
      goal: 'Ele já disse sim. Saia da chamada com o pagamento enviado e o prazo do formulário combinado.',
    },
    {
      part: 2,
      title: 'Se ele travar',
      goal: 'Responda com pergunta. Ele mesmo desfaz.',
      objections: true,
    },
  ]
}

/** "Tá caro" com a conta dele: quantos clientes novos pagam tudo, pelo valor que ele disse na conversa. */
function expensiveReply(payback: NonNullable<ScriptDeck['payback']>): string {
  const many = payback.clients === 1 ? '1 cliente novo' : `${payback.clients} clientes novos`
  const monthly = payback.monthly
  const perClient = monthly
    ? `Cada cliente seu paga uns {{ticket|${payback.ticket}}} por mês e fica${monthly.assumed ? ', digamos,' : ''} uns ` +
      (monthly.assumed ? `${monthly.months} meses` : `{{meses|${monthly.months} meses}}`) +
      `, então cada um deixa uns ${monthly.lifetime}. `
    : `Cada cliente novo seu paga uns {{ticket|${payback.ticket}}}. `
  return (
    'Entendo, {nome}. Mas vamos fazer a conta junto. ' +
    perClient +
    `${payback.clients === 1 ? 'Basta' : 'Bastam'} ${many} pra pagar tudo, o nosso trabalho e os anúncios. ` +
    (monthly ? 'E quem entra continua pagando depois disso. ' : '') +
    `Você acha difícil conseguir ${many} com tudo isso funcionando?` +
    '#Deixe ele responder. Se ele disser que não é difícil, volte pro "Como você prefere seguir?". Não ofereça desconto.'
  )
}

export const buildScriptObjections = (prices: ScriptPrices, deck?: ScriptDeck): [string, string][] => {
  const place = leadPlace(deck)
  const hasDeal = Boolean(prices.savings || prices.completoSavings)
  const vaga = `se outro negócio ${place.nicheOf} ${place.cityIn} fechar comigo antes, eu não consigo mais te atender, porque eu só trabalho com um por ramo em cada cidade.`
  return [
    [
      'Vou pensar.',
      'Claro, {nome}, faz sentido. Me conta, o que ficou pesando? O plano ou o valor? … Só pra ser transparente com você. ' +
        (hasDeal ? `O valor de hoje vale até o fim da nossa conversa. E ${vaga}` : vaga[0].toUpperCase() + vaga.slice(1)) +
        ' Não é pressão, é só pra você decidir sabendo disso.#Primeiro resolva a dúvida dele. Só depois fale do prazo e da vaga.',
    ],
    [
      'Tá caro.',
      deck?.payback ? expensiveReply(deck.payback) : 'Entendo. Mas caro comparado com o quê? Pensa comigo, quanto vale um cliente novo pra você? E quantos você acha que somem hoje no WhatsApp sem resposta? Se o plano recuperar só alguns desses, a conta já muda.#Deixe ele fazer a conta. Não ofereça desconto aqui.',
    ],
    [
      'Falar com sócio / esposa.',
      'Faz todo sentido. Me deixa te perguntar uma coisa. Se dependesse só de você, você fechava hoje?#Se ele disser que sim, proponha 15 minutos essa semana com os dois juntos, e já marque o horário.',
    ],
    [
      'E se não der resultado?',
      'É uma dúvida justa. Me fala, o que seria um bom resultado pra você nesses 45 dias?#Não prometa número. Lembre que no dia 45 ele sabe quanto custou cada contato em cada canal.',
    ],
    [
      'Só quero o Instagram.',
      'Dá pra começar só com ele, sim. Só que aí você descobre se o Instagram funciona, mas fica sem saber se o Google traria mais cliente. Com os dois, no dia 45 você sabe onde vale colocar o dinheiro.#Se ele mantiver, feche o Piloto Instagram. Não force.',
    ],
    [
      'Já tentei agência.',
      'Entendo, muita gente já passou por isso. E o que você acha que faltou daquela vez?#Escute e ligue ao que é diferente aqui. O relatório, o atendimento no WhatsApp ou a fundação antes dos anúncios.',
    ],
    [
      'Não tenho gente pra dar conta do serviço.',
      'Entendo, {nome}, isso é mais comum do que parece. Me deixa te perguntar uma coisa. A sua agenda fica cheia o ano todo, ou tem mês bom e mês fraco? … ' +
        '[Se tem mês fraco] Então o plano não é pra te encher no mês cheio. É pra não deixar o mês fraco vazio. E pensa comigo, hoje fica difícil contratar alguém porque você não sabe se vai ter serviço no mês que vem. Com procura todo mês, contratar deixa de ser um risco. ' +
        'E quando a procura passa do que você consegue fazer, você escolhe os melhores serviços e consegue cobrar melhor. … ' +
        '[Se vive lotado] Então, sendo sincero, o seu momento agora não é de trazer mais clientes, é de cobrar melhor pelo que você já faz. Se um dia você quiser crescer, eu tô aqui.#Não discuta, é uma limitação real. Se ele vive lotado o ano todo, não force a venda.',
    ],
  ]
}

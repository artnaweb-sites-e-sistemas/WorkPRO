/**
 * Roteiro da reunião do Piloto 45 (adaptado do Master Script).
 * Nas falas, `{chave}` é a anotação do lead (aparece colorida, na cor da chave) e
 * `[texto]` é uma pista para você adaptar na hora. `#` separa a fala de uma dica curta.
 * `@chave ` no início marca a pergunta-chave: espere a resposta e anote no campo daquela chave.
 */

/** Separa a marca de pergunta-chave (`@chave `) do texto da fala. */
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
}

export const SCRIPT_CAPTURES: Record<string, ScriptCapture> = {
  nome: { label: 'Nome dele', color: null, hint: 'Ex.: Carla', short: true },
  empresa: { label: 'Empresa', color: null, hint: 'Ex.: Studio Carla Carrion', short: true },
  obj: { label: 'Objetivo', color: 'c1', hint: 'Ex.: encher os horários da manhã', polish: true },
  hoje: { label: 'Como os clientes chegam hoje', color: 'c2', hint: 'Ex.: indicação e post impulsionado', polish: true },
  dor: { label: 'O problema, nas palavras dele', color: 'c3', hint: 'Ex.: tem mês que não entra ninguém', polish: true },
  whats: { label: 'O que acontece no WhatsApp', color: 'c4', hint: 'Ex.: demora horas, metade some', polish: true },
  falta: { label: 'O que está faltando', color: 'c10', hint: 'Ex.: alguém que cuide disso todo mês', polish: true },
  estopim: { label: 'O estopim', color: 'c5', hint: 'Ex.: abriu um estúdio novo na rua', polish: true },
  crit: { label: 'O que o trabalho precisa ter', color: 'c8', hint: 'Ex.: ver os números, não ter que cuidar', polish: true },
  numHoje: { label: 'Clientes novos por mês hoje', color: 'c6', hint: 'Ex.: 8', short: true },
  numMeta: { label: 'Clientes novos por mês que ele quer', color: 'c6', hint: 'Ex.: 25', short: true },
  custo: { label: 'O que acontece se nada mudar', color: 'c7', hint: 'Ex.: vou ter que fechar a turma da manhã', polish: true },
  virada: { label: 'O que mais chamou atenção', color: 'c9', hint: 'Ex.: o WhatsApp responder sozinho', polish: true },
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
  steps?: { fale: string; mostre: string[]; pergunte?: string }
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
  /** "R$ 5.000" */
  list: string
  /** "R$ 3.000" */
  deal: string
  /** "R$ 1.000" */
  adBudget: string
  /** "R$ 353,19" */
  installment: string
  installments: number
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

export function buildScriptCards(prices: ScriptPrices): ScriptCard[] {
  return [
    {
      part: 0,
      title: 'Abertura',
      goal: 'Assumir a conversa e ouvir o objetivo.',
      say: [
        'Oi, {nome}! Aqui é o Bira. Tudo bem?',
        'Você me ouve bem?',
        'Pelo que a gente conversou, você quer trazer mais clientes pela internet, com mais constância. É isso mesmo?',
        '@obj E qual é a intenção por trás? Encher horário vago, parar de depender de indicação ou crescer?',
        'Me conta um pouco mais: como seria isso na prática pra você?#Pergunta pra ganhar tempo enquanto você anota.',
      ],
      expect: 'O objetivo e o porquê.',
      capture: ['nome', 'empresa', 'obj'],
    },
    {
      part: 0,
      title: 'Como é hoje',
      goal: 'Entender o que ele faz e plantar uma dúvida.',
      say: [
        '@hoje Hoje, de onde vêm os seus clientes novos?',
        'Há quanto tempo é assim?',
        'Uma curiosidade: o que te fez escolher {hoje}?#Tom de curiosidade, não de crítica.',
      ],
      expect: 'Indicação, post impulsionado, boca a boca.',
      capture: ['hoje'],
      adapt: [
        {
          target: 2,
          from: ['hoje'],
          brief:
            'Perguntar, com curiosidade e sem crítica, como esse canal (o que ele respondeu) virou o principal caminho de clientes dele: foi uma escolha ou foi acontecendo? ' +
            'Trate a resposta como o canal pelo nome simples (ex.: "as indicações", "o Instagram", "o boca a boca") e faça dele o sujeito da frase. ' +
            'Nunca use "trazer clientes por", "principalmente por" nem "o que te levou a". Uma pergunta só, curta (até 18 palavras), começando com "Uma curiosidade:". ' +
            'Ex.: "Uma curiosidade: as indicações das alunas antigas viraram o principal caminho por escolha ou foi acontecendo?"',
        },
      ],
    },
    {
      part: 0,
      title: 'O problema',
      goal: 'Descer do genérico até o pessoal.',
      say: [
        'Me conta como tá o movimento hoje. Tem mês bom e mês fraco?',
        'Num mês fraco, quantos clientes novos entram, mais ou menos? E num bom?',
        '@dor E quando o mês é fraco, o que isso muda no seu dia a dia?',
        'E o que você costuma fazer quando percebe que o mês vai ser fraco?#Pergunta pra ganhar tempo enquanto você anota.',
        'Então hoje depende muito do mês, e quando é fraco, {dor}. É isso?#Repita em voz alta. Ele precisa ouvir o próprio problema.',
      ],
      expect: 'Um exemplo concreto e um número.',
      capture: ['dor'],
    },
    {
      part: 0,
      title: 'O WhatsApp',
      goal: 'Achar o buraco do atendimento.',
      say: [
        'Quando alguém chama perguntando o preço, quanto tempo leva pra responder?',
        '@whats Quem responde? E quantos somem depois do preço?',
        'E quem some, alguém chega a chamar de volta depois?#Pergunta pra ganhar tempo enquanto você anota.',
      ],
      expect: '"Demora", "eu mesmo respondo quando dá", "muita gente some".',
      capture: ['whats'],
    },
    {
      part: 0,
      title: 'O que está faltando',
      goal: 'Ele mesmo diz o que falta, sem culpar a crise.',
      say: [
        '@falta Hoje os clientes chegam por {hoje}. O que você acha que falta pra eles chegarem todo mês, e não só de vez em quando?',
        'E isso é algo que você consegue fazer sozinho, no dia a dia, ou falta tempo pra isso?',
      ],
      expect: '"Falta alguém cuidando disso", "não tenho tempo", "não sei mexer com anúncio".',
      capture: ['falta'],
      adapt: [
        {
          target: 0,
          from: ['hoje'],
          brief: 'Lembrar como os clientes chegam hoje e perguntar o que ele acha que falta pra eles chegarem todo mês, com constância.',
        },
      ],
    },
    {
      part: 0,
      title: 'O que já tentou',
      goal: 'Tirar a objeção antes do preço e achar o estopim.',
      say: ['Antes de falar comigo, você já contratou agência ou alguém pra anunciar?'],
      branch: [
        ['Se sim', '@estopim Como foi? Que resultado teve? Por que você acha que não funcionou?'],
        ['Se não', '@estopim O que te impediu? … E o que mudou de lá pra cá? … Qual foi o estopim pra agir agora?'],
        ['Enquanto anota', 'E o que você faria diferente agora?'],
      ],
      expect: 'O motivo da última tentativa ter falhado, ou o momento que fez ele agir.',
      capture: ['estopim'],
    },
    {
      part: 0,
      title: 'O que precisa ter',
      goal: 'As palavras dele viram as palavras da oferta.',
      say: [
        '@crit Na sua opinião, o que um trabalho desses precisa ter pra valer a pena pra você?',
        'Por que isso é importante pra você?#Pergunta pra ganhar tempo enquanto você anota.',
        'Só pra ficar claro: você quer {crit}, é isso?',
      ],
      expect: '"Ver resultado em número", "não ter que cuidar de tudo", "alguém que responda rápido".',
      capture: ['crit'],
    },
    {
      part: 0,
      title: 'Os números',
      goal: 'Escancarar a distância entre hoje e o que ele quer.',
      say: [
        '@numMeta Imagina tudo isso rodando. Quantos clientes novos por mês você gostaria de ter?',
        '@numHoje E hoje, quantos são, exatamente?',
        'Então de {numHoje} pra {numMeta}. É uma diferença considerável, né?',
        'Se entrassem esses {numMeta} por mês, o que você faria de diferente? Isso te deixa mais perto de {obj}?',
      ],
      expect: 'Dois números e o que eles significam na vida dele.',
      capture: ['numHoje', 'numMeta'],
      adapt: [
        {
          target: 3,
          from: ['numMeta', 'obj'],
          brief: 'Perguntar o que ele faria de diferente se entrassem essa quantidade de clientes por mês, ligando ao objetivo dele.',
        },
      ],
    },
    {
      part: 0,
      title: 'Custo de não agir',
      goal: 'É aqui que ele decide. Mude o tom.',
      tone: 'Mais devagar. Mais sério.',
      say: [
        'Deixa eu te fazer uma pergunta mais direta, {nome}.',
        '@custo Se nada mudar e daqui a seis meses estiver igual a hoje, como fica {obj}?',
        'Faz sentido continuar desse jeito?#Ele precisa dizer o "não" em voz alta.',
        'E por que é importante resolver isso agora, e não mais pra frente?',
      ],
      expect: '"Não, é por isso que estou aqui."',
      capture: ['custo'],
      adapt: [
        {
          target: 1,
          from: ['obj'],
          also: ['dor'],
          brief:
            'Uma pergunta só: se daqui a seis meses nada tiver mudado, como fica a situação dele longe do objetivo (ex.: objetivo "sair do operacional" → "você continuar preso no operacional"). Calma, sem drama.',
        },
      ],
    },
    {
      part: 0,
      title: 'Suporte',
      goal: 'Aliviar a pressão: ele não vai sozinho.',
      say: [
        'Faz sentido. A gente monta tudo, roda os anúncios e acompanha os números junto com você.',
        'Da sua parte, é gravar os vídeos e atender quem chegar pronto pra comprar. Você topa trabalhar assim?',
      ],
      expect: '"Sim."',
    },
    {
      part: 0,
      title: 'Resumo',
      goal: 'Ele confirma. Só então você abre a tela.',
      say: [
        'Perfeito. Pelo que você me contou, dá pra te ajudar, sim.',
        'Você quer {obj}. Hoje os clientes vêm de {hoje}, e {dor}. E o que falta é {falta}.',
        'Se continuar assim, {custo}. Você até comentou que {estopim}. É isso?',
        'Se estiver ok, eu montei um plano pra {empresa}. Vou compartilhar a tela.#Só agora abra o slide 1.',
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
      fale: 'Montei isso pensando no que você me contou. Chamei de Piloto 45.',
      mostre: ['A promessa: 45 dias pra descobrir de onde vêm os clientes da {empresa}.'],
    }),
    slide(2, 'Diagnóstico', {
      fale: 'Antes da nossa conversa eu estudei o seu mercado.',
      mostre: ['Leia a frase principal.', 'Passe pelas 3 linhas, uma por uma.', 'No quadro ao lado: o que já tem e o que falta.'],
      pergunte: 'Isso bate com o que você vive aí?',
    }),
    slide(3, 'Onde o cliente se perde', {
      fale: 'Juntando com o que você me falou, {dor}, o cliente se perde em três pontos.',
      mostre: ['1. Quem procura não te encontra.', '2. Quem encontra não confia.', '3. Quem chama espera demais.'],
      pergunte: 'Qual desses você sente mais?',
    }, {
      from: ['dor'],
      brief: 'Ligar o problema que ele contou aos três pontos onde o cliente se perde, que aparecem no slide.',
    }),
    slide(4, 'O caminho', {
      fale: 'Pra fechar esses três buracos, a gente monta um caminho.',
      mostre: ['Atrair: Google, Meta, Google Meu Negócio, Instagram.', 'Qualificar: o WhatsApp com IA.', 'Vender: a sua equipe, com o cliente pronto.'],
    }),
    slide(5, 'As duas fases', {
      fale: 'E faz isso em 45 dias, em duas fases.',
      mostre: ['Dias 1 a 15: tudo pronto antes do primeiro anúncio.', 'Dia 16: anúncios no ar.', 'Dia 45: relatório do que funcionou e onde vale investir.'],
    }),
    slide(6, 'Fundação', {
      fale: 'Os dois primeiros buracos, ser encontrado e passar confiança, a gente fecha nos primeiros 15 dias.',
      mostre: ['Presença: página de vendas, Instagram, Google Meu Negócio.', 'Anúncios: contas no nome da empresa e três vídeos.', 'Atendimento: WhatsApp conectado, roteiro de venda, retorno automático.'],
      pergunte: 'Como você vê isso ajudando a {empresa} hoje?',
    }),
    slide(7, 'Os vídeos', {
      fale: 'Parte disso são três vídeos pros anúncios.',
      mostre: ['Os 3 ângulos, um por um.', 'Ligue um deles ao que ele contou: {dor}.', 'Roteiro e edição inclusos; novos vídeos se o dado pedir.'],
    }),
    slide(8, 'Tráfego', {
      fale: 'Com tudo pronto, no dia 16 a gente liga os anúncios. É aqui que você para de depender só de {hoje}.',
      mostre: ['O ciclo: anunciar, medir, ajustar, todo dia.', 'A verba vai direto pras plataformas, no cartão da empresa.', 'Relatórios: quanto entrou e quanto custou cada contato.'],
      pergunte: 'Faz sentido pra você?',
    }, {
      from: ['hoje'],
      brief: 'Dizer que no dia 16 os anúncios entram no ar e que é aqui que ele deixa de depender só do jeito como os clientes chegam hoje.',
    }),
    slide(9, 'Atendimento', {
      fale: 'E o terceiro buraco é o que você me contou do WhatsApp: {whats}.',
      mostre: ['A IA responde na hora e conversa sobre o que a pessoa precisa.', 'Quente: passa pra sua equipe.', 'Morno: recebe retorno. Frio: encerra e retoma depois.'],
    }, {
      from: ['whats'],
      brief: 'Apresentar o terceiro buraco lembrando o que ele contou sobre o WhatsApp.',
    }),
    slide(10, 'Comparação', {
      fale: 'A diferença pro atendimento de hoje é essa.',
      mostre: ['Leia só as 2 linhas mais ligadas a ele.', 'Feche com: "A IA aquece. A sua equipe fecha."'],
      pergunte: 'Ficou alguma dúvida até aqui?',
    }),
    {
      part: 1,
      title: 'Dia 45',
      slides: 'Slide 11',
      goal: 'Ele diz sim ao plano antes do preço.',
      beats: [
        ['Fechar', 'Esse é o plano pra você sair de {numHoje} pra {numMeta} clientes por mês.'],
        ['Pergunta', 'Você sente que ele pode ser a solução que você estava procurando?'],
        ['Depois do sim', '@virada O que mais te chamou atenção em tudo isso?'],
        ['Enquanto anota', 'E como você imagina isso funcionando aí no seu dia a dia?'],
      ],
      expect: 'A parte que mais pesou pra ele. Você repete no preço.',
      capture: ['virada'],
    },
    {
      part: 2,
      title: 'Investimento',
      slides: 'Slide 12',
      goal: 'Uma fala só. Sem se justificar.',
      say: [
        'Se estiver ok, o próximo passo é falar do investimento.#Espere o sim.',
        'Pra você chegar em {numMeta} por mês, com {virada}:',
        `A agência é ${prices.list}. Fechando hoje, fica ${prices.deal}.`,
        'Eu recomendo o Completo: é o único que coloca Meta e Google lado a lado.',
        `A verba, ${prices.adBudget} por canal, você paga direto pras plataformas, no seu cartão, ao longo dos 30 dias.`,
        `A maioria paga à vista no Pix, mas dá pra fazer em ${prices.installments}x de ${prices.installment}.`,
        'Como você gostaria de seguir?',
      ],
      silence: true,
      adapt: [
        {
          target: 1,
          from: ['numMeta'],
          also: ['virada', 'obj'],
          brief: 'Abrir o preço ligando à meta de clientes por mês e ao que mais chamou atenção dele no plano. Terminar com dois-pontos.',
        },
      ],
    },
    {
      part: 2,
      title: 'Depois do sim',
      slides: 'Slide 13',
      goal: 'Já sai da chamada com tudo marcado.',
      say: [
        'Hoje: escolhe o plano.',
        'Mando o link de pagamento agora, na chamada.',
        'Em até 24 horas: briefing de 30 minutos. Tenho [dia] ou [dia], qual fica melhor?',
        'Dia 1: começa a fundação.',
      ],
      branch: [['Se perguntar do depois', 'Planos de continuidade: você decide com os números na mesa. Nada renova sozinho.']],
    },
    {
      part: 2,
      title: 'Se ele travar',
      goal: 'Responda com pergunta. Ele mesmo desfaz.',
      objections: true,
    },
  ]
}

export const SCRIPT_OBJECTIONS: [string, string][] = [
  ['"Vou pensar."', 'Claro. Pensar em qual parte: o plano ou o investimento?'],
  ['"Tá caro."', 'Caro comparado com o quê? Quanto vale um cliente novo pra você? E quantos somem no WhatsApp?'],
  ['"Falar com sócio / esposa."', 'Faz sentido. Se dependesse só de você, fechava hoje? Então marcamos 15 minutos com os dois essa semana.'],
  ['"E se não der resultado?"', 'O que seria resultado pra você em 45 dias?#Não prometa número. No dia 45 ele sabe o custo de cada canal.'],
  ['"Só quero o Meta."', 'Dá pra começar por um. Só que aí você descobre se aquele funciona, não qual é o melhor. Você disse que quer {crit}.'],
  ['"Já tentei agência."', 'O que faltou naquela vez?#Ligue ao passo que resolve: relatório, atendimento ou estrutura.'],
]

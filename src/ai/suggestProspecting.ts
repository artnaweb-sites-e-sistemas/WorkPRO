import { SchemaType } from '@google/generative-ai'
import { getGeminiModel, getSearchModel } from '../lib/ai'

/**
 * "Onde prospectar" em duas etapas:
 * 1. pesquisa: a IA busca no Google o que está acontecendo na região agora (economia, obras, clima);
 * 2. estratégia: com a pesquisa em mãos, dá nota de 1 a 5 em seis critérios para cada nicho.
 * A chance final é calculada aqui, com pesos fixos: a ordem não depende do humor do modelo.
 */

const RESEARCH_INSTRUCTION = `Você é um analista de mercado local no Brasil. Pesquise no Google e traga fatos curtos e verificáveis que ajudem a escolher nichos de negócios locais para prospectar por telefone.
Sem opinião, sem recomendação, sem números inventados: se não achar um dado, não escreva sobre ele. Português do Brasil.`

function researchPrompt(regiao: string, nicho: string, today: string): string {
  return [
    `Hoje é ${today}. Pesquise sobre ${regiao} (Brasil) e responda em até 12 tópicos curtos:`,
    '- porte e perfil de renda; cidades vizinhas relevantes;',
    '- setores fortes da economia e o que está crescendo (obras, condomínios e loteamentos novos, indústria, agro, turismo, saúde, educação);',
    '- clima e época do ano que mexem com a procura por serviços nas próximas semanas (calor, chuva, temporada);',
    '- bairros ou polos com mais comércio e serviços;',
    nicho ? `- como está o mercado de ${nicho} ali: muita ou pouca concorrência, presença de redes e franquias.` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

const STRATEGY_INSTRUCTION = `Você é o melhor estrategista de prospecção por telefone para negócios locais do Brasil. Seu trabalho: dizer a uma agência pequena QUAIS NICHOS ligar, ONDE, e COMO achar os melhores contatos no Google Locais, para falar com o DONO e marcar 20 minutos por vídeo.

O QUE A AGÊNCIA VENDE ("Piloto 45")
- Em 45 dias: página de vendas, Instagram arrumado, Google Meu Negócio, contas de anúncio, 3 vídeos e um WhatsApp com IA que responde na hora e passa para a equipe quem está pronto para comprar. Depois, 30 dias de anúncios no Google e na Meta.
- Investimento: R$ 3.000 da agência + R$ 1.000 de verba por canal (perto de R$ 5.000 no completo). Depois, planos mensais de R$ 250 a R$ 3.000.
- Resolve: cliente novo que não chega pelo Google, orçamento que esfria no WhatsApp porque ninguém responde rápido, dependência de indicação, agenda com buracos.

COMO VOCÊ AVALIA CADA NICHO (notas de 1 a 5, honestas; 3 é o meio, não dê 5 para tudo)
- dono: dá para falar com quem decide por telefone? 5 = o dono atende o telefone da empresa ou está sempre no balcão (oficina, vidraçaria, marmoraria, serralheria, estúdio pequeno). 3 = tem recepção, mas o dono fica no local. 1 = central, recepção que filtra, rede ou franquia, dono ausente.
- valor: quanto vale um cliente novo (ticket x recompra)? 5 = um cliente paga boa parte do investimento (obra, planejados, energia solar, piscina, implante, mensalidade alta). 1 = ticket baixo e sem volta.
- busca: as pessoas procuram isso no Google na hora da necessidade? 5 = urgência ou "perto de mim" (desentupidora, chaveiro, guincho, conserto). 3 = pesquisa planejada. 1 = compra por impulso ou só por indicação.
- dor: o problema que o Piloto resolve é forte ali? 5 = vive de orçamento pelo WhatsApp e perde venda por demorar, ou depende só de indicação.
- bolso: tem margem para R$ 4 a 5 mil agora e R$ 1 a 3 mil por mês depois?
- assedio: quantas agências já ligam para eles? 5 = quase nenhuma (nicho fora do radar). 1 = recebe ligação de agência toda semana (dentistas, advogados, estética em capital, imobiliárias, restaurantes).

TÉCNICAS QUE VOCÊ USA
1. Fora do radar: as melhores chances costumam estar em serviços sem glamour e de ticket alto, que as agências ignoram. Obra e acabamento (vidraçaria, marmoraria, serralheria, gesso e drywall, impermeabilização, calhas, pisos, portões automáticos, toldos, cortinas e persianas, móveis planejados, marcenaria); casa e manutenção (climatização, energia solar, aquecedor solar, piscinas, dedetização, desentupidora, poço artesiano, paisagismo); automotivo (funilaria, martelinho de ouro, auto elétrica, retífica, estética automotiva, guincho); serviços de bairro com dono presente (autoescola, escola de idiomas, clínica veterinária, pilates, fisioterapia, buffet). É ponto de partida, não lista fechada: a pesquisa da região manda.
2. Economia local: cruze com a pesquisa. Obras e condomínios novos pedem acabamento e planejados; agro pede serviços para o produtor; litoral e turismo pedem manutenção de casas e piscinas; polo de saúde pede clínicas pequenas; calor pede climatização.
3. Momento: considere a data e antecipe a procura das próximas 4 a 8 semanas (antes do verão: climatização, piscinas, energia solar; antes das chuvas: calhas, impermeabilização; fim de ano: buffet e festas).
4. Recorte: em cidade grande, divida por bairros ou zonas; sugira cidades vizinhas menores, onde quase ninguém liga. Use termos específicos do nicho nas buscas ("box de vidro", "envidraçamento de sacada"): cada termo mostra empresas diferentes no Google Locais.
5. Diversidade: nada de dois nichos quase iguais. Pelo menos 3 dos 8 devem ser fora do radar (assedio 4 ou 5).

CAMPOS
- nicho: como a pessoa digita no Cold call, 1 a 3 palavras, minúsculas (ex.: "vidraçaria", "energia solar").
- regiao: cidade com UF (ex.: "Campinas - SP"). Se o pedido for um estado ou região, escolha cidades dentro dela. Pode ser uma cidade vizinha quando isso aumentar a chance.
- porque: uma frase concreta, até 20 palavras: por que esse nicho, ali, agora. Cite o fato da pesquisa quando houver.
- quemAtende: quem costuma atender o telefone e como chegar no dono, até 10 palavras (ex.: "o próprio dono, quase sempre na loja").
- melhorHorario: janelas para ligar, fugindo do pico de trabalho do nicho (ex.: "8h–9h30 e 13h30–15h").
- ticket: faixa típica de um serviço ou cliente (ex.: "R$ 3 mil a 15 mil por obra"). É estimativa de mercado.
- sinais: como escolher os melhores daquele nicho na lista do Google Locais, até 22 palavras. Bons sinais típicos: nota 4,3 ou mais com poucas avaliações (menos de 60), sem site, fotos antigas, perfil pouco cuidado, celular do dono no perfil. Fuja de anúncios patrocinados, redes e franquias, e de quem já tem site profissional e centenas de avaliações.
- buscas: 3 a 5 buscas como a pessoa digitaria no Google, minúsculas, com acentos, sem aspas, com a cidade ou o bairro (ex.: "vidraçaria em campinas", "box de vidro taquaral campinas").
- notas: as seis notas de 1 a 5.
- leitura: 1 ou 2 frases com a leitura da região e a estratégia geral (ex.: "Campinas cresce em condomínios fechados e indústria: o caminho é obra e acabamento, que quase nenhuma agência aborda.").
- evitar: 2 a 4 nichos que parecem bons mas não valem agora ali, cada um com o motivo em até 14 palavras.

REGRAS
- Português do Brasil, direto, sem jargão de marketing (nada de lead, funil, persona, ICP).
- Não invente números exatos da região (população, quantidade de empresas, faturamento). Fatos da pesquisa podem ser citados.
- Nada de órgãos públicos, nichos sem margem ou com publicidade restrita (apostas, armas, bebidas).
- Devolva 8 sugestões.`

const STRING = { type: SchemaType.STRING }
const SCORE = { type: SchemaType.INTEGER }

const SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    leitura: STRING,
    sugestoes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          nicho: STRING,
          regiao: STRING,
          porque: STRING,
          quemAtende: STRING,
          melhorHorario: STRING,
          ticket: STRING,
          sinais: STRING,
          buscas: { type: SchemaType.ARRAY, items: STRING },
          notas: {
            type: SchemaType.OBJECT,
            properties: { dono: SCORE, valor: SCORE, busca: SCORE, dor: SCORE, bolso: SCORE, assedio: SCORE },
            required: ['dono', 'valor', 'busca', 'dor', 'bolso', 'assedio'],
          },
        },
        required: ['nicho', 'regiao', 'porque', 'quemAtende', 'melhorHorario', 'ticket', 'sinais', 'buscas', 'notas'],
      },
    },
    evitar: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: { nicho: STRING, motivo: STRING },
        required: ['nicho', 'motivo'],
      },
    },
  },
  required: ['leitura', 'sugestoes', 'evitar'],
}

export interface ProspectScores {
  /** dá para falar com o dono por telefone */
  dono: number
  /** quanto vale um cliente novo */
  valor: number
  /** procura no Google na hora da necessidade */
  busca: number
  /** a dor que o Piloto resolve */
  dor: number
  /** margem para o investimento */
  bolso: number
  /** 5 = quase nenhuma agência liga */
  assedio: number
}

export const SCORE_LABELS: Record<keyof ProspectScores, string> = {
  dono: 'Acesso ao dono',
  valor: 'Valor do cliente',
  busca: 'Procura no Google',
  dor: 'Dor que o Piloto resolve',
  bolso: 'Margem para investir',
  assedio: 'Poucas agências ligando',
}

/** Falar com o dono pesa mais: sem ele, nenhum outro critério importa. */
const WEIGHTS: Record<keyof ProspectScores, number> = {
  dono: 0.28,
  valor: 0.2,
  busca: 0.16,
  dor: 0.14,
  bolso: 0.12,
  assedio: 0.1,
}

export interface ProspectSuggestion {
  nicho: string
  regiao: string
  porque: string
  quemAtende: string
  melhorHorario: string
  ticket: string
  sinais: string
  buscas: string[]
  notas: ProspectScores
  /** 0 a 100, das notas com os pesos acima */
  chance: number
}

export interface ProspectAvoid {
  nicho: string
  motivo: string
}

export interface ProspectResult {
  leitura: string
  sugestoes: ProspectSuggestion[]
  evitar: ProspectAvoid[]
  /** a pesquisa no Google deu certo (senão, só o conhecimento do modelo) */
  pesquisou: boolean
}

export type ProspectStage = 'pesquisando' | 'comparando'

export function chanceOf(notas: ProspectScores): number {
  let total = 0
  for (const key of Object.keys(WEIGHTS) as (keyof ProspectScores)[]) {
    total += ((notas[key] - 1) / 4) * WEIGHTS[key]
  }
  return Math.round(total * 100)
}

export function chanceTier(chance: number): 'alta' | 'boa' | 'media' {
  if (chance >= 75) return 'alta'
  if (chance >= 58) return 'boa'
  return 'media'
}

function text(value: unknown, max = 300): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function score(value: unknown): number {
  const n = typeof value === 'number' ? Math.round(value) : Number.parseInt(String(value), 10)
  return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 3
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/** Pesquisa a região no Google. Falhou ou demorou: segue sem, com o conhecimento do modelo. */
async function research(regiao: string, nicho: string, today: string): Promise<string> {
  try {
    const model = getSearchModel(RESEARCH_INSTRUCTION)
    const result = await withTimeout(model.generateContent(researchPrompt(regiao, nicho, today)), 35000)
    return result.response.text().trim().slice(0, 4000)
  } catch (error) {
    console.warn('[suggestProspecting] pesquisa', error)
    return ''
  }
}

function requestFor(nicho: string, regiao: string): string {
  if (nicho && regiao) {
    return `Quero ligar para "${nicho}" em "${regiao}". Avalie esse nicho com nota honesta (inclua ele na lista) e traga os sub-nichos e nichos vizinhos que valem mais ali, além de bairros ou cidades vizinhas quando valer.`
  }
  if (regiao) {
    return `Quero prospectar em "${regiao}". Quais nichos têm mais chance de eu falar com o dono e fechar o Piloto 45 ali?`
  }
  return `Quero ligar para "${nicho}". Em quais cidades isso tem mais chance? Prefira cidades médias e do interior, com renda para o investimento. Pode variar o termo do nicho quando um sub-nicho valer mais.`
}

/** Sugestões de nicho, região e buscas, da maior chance para a menor. Lança erro se a IA falhar. */
export async function suggestProspecting(params: {
  nicho: string
  regiao: string
  onStage?: (stage: ProspectStage) => void
}): Promise<ProspectResult> {
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  let pesquisa = ''
  if (params.regiao) {
    params.onStage?.('pesquisando')
    pesquisa = await research(params.regiao, params.nicho, today)
  }
  params.onStage?.('comparando')

  const prompt = [
    `HOJE: ${today}`,
    `PEDIDO: ${requestFor(params.nicho, params.regiao)}`,
    pesquisa
      ? `PESQUISA DA REGIÃO (Google, agora):\n${pesquisa}`
      : 'PESQUISA DA REGIÃO: indisponível. Use o que você sabe, sem inventar números.',
  ].join('\n\n')

  const model = getGeminiModel(STRATEGY_INSTRUCTION, SCHEMA)
  const result = await model.generateContent(prompt)
  const parsed = JSON.parse(result.response.text()) as Record<string, unknown>

  const seen = new Set<string>()
  const sugestoes = (Array.isArray(parsed.sugestoes) ? parsed.sugestoes : [])
    .map((item): ProspectSuggestion => {
      const record = (item ?? {}) as Record<string, unknown>
      const rawNotas = (record.notas ?? {}) as Record<string, unknown>
      const notas: ProspectScores = {
        dono: score(rawNotas.dono),
        valor: score(rawNotas.valor),
        busca: score(rawNotas.busca),
        dor: score(rawNotas.dor),
        bolso: score(rawNotas.bolso),
        assedio: score(rawNotas.assedio),
      }
      const buscas = [
        ...new Set(
          (Array.isArray(record.buscas) ? record.buscas : [])
            .map((busca) => text(busca, 80).replace(/["'#]/g, '').toLowerCase())
            .filter(Boolean),
        ),
      ].slice(0, 5)
      return {
        nicho: text(record.nicho, 60).toLowerCase(),
        regiao: text(record.regiao, 80),
        porque: text(record.porque, 220),
        quemAtende: text(record.quemAtende, 90),
        melhorHorario: text(record.melhorHorario, 60),
        ticket: text(record.ticket, 60),
        sinais: text(record.sinais, 220),
        buscas,
        notas,
        chance: chanceOf(notas),
      }
    })
    .filter((item) => {
      const key = `${item.nicho}|${item.regiao.toLowerCase()}`
      if (!item.nicho || !item.buscas.length || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => b.chance - a.chance)
    .slice(0, 8)
  if (!sugestoes.length) throw new Error('A IA não devolveu sugestões. Tente de novo.')

  const evitar = (Array.isArray(parsed.evitar) ? parsed.evitar : [])
    .map((item): ProspectAvoid => {
      const record = (item ?? {}) as Record<string, unknown>
      return { nicho: text(record.nicho, 60), motivo: text(record.motivo, 160) }
    })
    .filter((item) => item.nicho && item.motivo)
    .slice(0, 4)

  return { leitura: text(parsed.leitura, 320), sugestoes, evitar, pesquisou: Boolean(pesquisa) }
}

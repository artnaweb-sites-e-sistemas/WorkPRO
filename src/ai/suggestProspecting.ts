import { SchemaType } from '@google/generative-ai'
import { getGeminiModel } from '../lib/ai'

const SYSTEM_INSTRUCTION = `Você é um estrategista de prospecção de negócios locais no Brasil. Ajuda uma agência pequena a escolher ONDE e PARA QUEM ligar (ligação fria para números achados no Google Locais).

O QUE A AGÊNCIA VENDE ("Piloto 45"):
- 45 dias: página de vendas, Instagram, Google Meu Negócio, contas de anúncio, 3 vídeos e um WhatsApp com IA que atende na hora e passa para a equipe quem está pronto para comprar; depois 30 dias de anúncios no Google e na Meta.
- Investimento: agência R$ 3.000 + verba de R$ 1.000 por canal (plano completo perto de R$ 5.000). Depois, planos mensais de R$ 250 a R$ 3.000.

O QUE FAZ UM NICHO SER BOM PARA ESSA OFERTA (pese todos):
1. Um cliente novo vale muito (ticket alto ou cliente que volta todo mês): poucos clientes pagam o investimento.
2. As pessoas procuram esse serviço no Google ("perto de mim", "na cidade").
3. Quem decide é o dono, e dá para falar com ele por telefone: negócio pequeno ou médio, 1 a 3 unidades, dono no dia a dia. Evite franquias grandes, redes e empresas com departamento de marketing.
4. Depende de agenda ou de clientes novos todo mês, e atende pelo WhatsApp (a IA do WhatsApp faz diferença).
5. Tem margem para investir R$ 3.000 a R$ 5.000.
Evite: órgãos públicos, negócios sem margem, nichos com restrição forte de publicidade, e o que o histórico mostra que só recusa.

O QUE FAZ UMA REGIÃO SER BOA:
- Cidades com renda e tamanho para o nicho, de preferência médias e do interior ou regiões metropolitanas, onde há menos agências ligando.
- Cidades vizinhas a onde já deu resultado (reunião marcada).
- Não repita cidades já muito abordadas para o mesmo nicho; aponte quando valer voltar.

USE O HISTÓRICO:
- Nicho ou cidade com reunião marcada: sugira expandir (cidades vizinhas, nichos parecidos).
- Muitas recusas ou ninguém atende: evite ou mude o ângulo (outro nicho próximo, outro horário).
- Sem histórico: siga só os critérios.

BUSCAS PARA O GOOGLE LOCAIS:
- 3 a 5 por sugestão, como a pessoa digitaria: "{termo do nicho} em {cidade}" e variações reais do nicho (ex.: "harmonização facial", "clínica de estética", "estética avançada"), bairros grandes quando fizer sentido.
- Minúsculas, sem aspas, sem hashtags.

REGRAS:
- Português do Brasil, direto, sem jargão de marketing (nada de lead, funil, persona).
- "porque": uma frase concreta ligando aos critérios. "abordagem": uma dica prática para falar com o dono daquele nicho (melhor horário, como chamar o cliente dele, o que costuma doer).
- Não invente números exatos (população, quantidade de empresas, faturamento).
- regiao: cidade com UF (ex.: "Ribeirão Preto - SP"). Se o pedido for um estado ou região, escolha cidades dentro dela.
- Devolva 6 sugestões, da mais promissora para a menos.`

const SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    leitura: { type: SchemaType.STRING },
    sugestoes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          nicho: { type: SchemaType.STRING },
          regiao: { type: SchemaType.STRING },
          prioridade: { type: SchemaType.STRING, enum: ['alta', 'media'], format: 'enum' },
          porque: { type: SchemaType.STRING },
          abordagem: { type: SchemaType.STRING },
          buscas: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ['nicho', 'regiao', 'prioridade', 'porque', 'abordagem', 'buscas'],
      },
    },
  },
  required: ['leitura', 'sugestoes'],
}

export interface ProspectSuggestion {
  nicho: string
  regiao: string
  prioridade: 'alta' | 'media'
  porque: string
  abordagem: string
  buscas: string[]
}

export interface ProspectResult {
  leitura: string
  sugestoes: ProspectSuggestion[]
}

function text(value: unknown, max = 300): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/** Sugestões de nicho, região e buscas. Lança erro se a IA falhar (a tela mostra a mensagem). */
export async function suggestProspecting(params: {
  nicho: string
  regiao: string
  /** uma linha por nicho + cidade já trabalhados, com os resultados */
  historico: string[]
}): Promise<ProspectResult> {
  const pedido =
    params.nicho && params.regiao
      ? `Quero abordar "${params.nicho}" em "${params.regiao}". Sugira os melhores recortes (cidades e variações do nicho, incluindo nichos vizinhos se valerem mais) e as buscas.`
      : params.nicho
        ? `Quero abordar o nicho "${params.nicho}". Sugira as regiões (cidades) com mais chance, priorizando as que eu ainda não abordei.`
        : params.regiao
          ? `Quero prospectar em "${params.regiao}". Sugira os nichos com mais chance de fechar o Piloto 45 ali, com dono fácil de alcançar.`
          : 'Não tenho nicho nem região em mente. Olhe meu histórico e sugira as melhores combinações de nicho e região para eu abordar agora.'

  const prompt = [
    `DATA: ${new Date().toLocaleDateString('pt-BR')}`,
    `PEDIDO: ${pedido}`,
    'HISTÓRICO DE LIGAÇÕES (nicho | cidade: resultados):',
    ...(params.historico.length ? params.historico.map((line) => `- ${line}`) : ['- (nenhuma ligação ainda)']),
  ].join('\n')

  const model = getGeminiModel(SYSTEM_INSTRUCTION, SCHEMA)
  const result = await model.generateContent(prompt)
  const parsed = JSON.parse(result.response.text()) as Record<string, unknown>
  const raw = Array.isArray(parsed.sugestoes) ? parsed.sugestoes : []
  const sugestoes = raw
    .map((item): ProspectSuggestion => {
      const record = (item ?? {}) as Record<string, unknown>
      return {
        nicho: text(record.nicho, 80),
        regiao: text(record.regiao, 80),
        prioridade: record.prioridade === 'alta' ? 'alta' : 'media',
        porque: text(record.porque),
        abordagem: text(record.abordagem),
        buscas: (Array.isArray(record.buscas) ? record.buscas : [])
          .map((busca) => text(busca, 80).replace(/^["']|["']$/g, ''))
          .filter(Boolean)
          .slice(0, 5),
      }
    })
    .filter((item) => item.nicho && item.buscas.length)
  if (!sugestoes.length) throw new Error('A IA não devolveu sugestões. Tente de novo.')
  return { leitura: text(parsed.leitura, 500), sugestoes }
}

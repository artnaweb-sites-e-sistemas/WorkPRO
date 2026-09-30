import { SchemaType } from '@google/generative-ai'
import { getGeminiModel } from '../lib/ai'

const SYSTEM_INSTRUCTION = `Você adapta o roteiro de uma ligação fria para um nicho de negócio local. Português do Brasil, tom de conversa falada.

Quem liga ajuda negócios locais a trazer clientes novos pelo Google, pelo Instagram e pelo WhatsApp. Você devolve quatro trechos que entram nas frases do roteiro:

A frase final é: "Falando com {grupo}, eu sempre ouço duas coisas: {dor1}, e {dor2}." Ela é FALADA ao telefone: tem que ser curta, direta e fácil de absorver de primeira.

- grupo: como chamar os DONOS desse tipo de negócio, no plural.
  Ex.: pilates → "donos de estúdio de pilates"; odontologia → "dentistas"; pet shop → "donos de pet shop"; estética → "donas de clínica de estética".
- clientes: a palavra que esse negócio usa para os próprios clientes, no plural, minúscula. Ex.: pilates → "alunos"; odontologia → "pacientes"; restaurante → "clientes".
- dor1: a falta de constância de clientes novos, com a palavra do nicho. Ex. (pilates): "tem mês cheio e mês com horário sobrando"; (odontologia): "tem mês com agenda cheia e mês parado".
- dor2: gente que chama no WhatsApp e desaparece. Ex. (pilates): "muita gente pede o preço e some"; (pet shop): "muita gente pergunta o valor do banho e some".

REGRAS:
- dor1 e dor2: no MÁXIMO 8 palavras cada, uma ideia só, sem explicar nem detalhar. Começam com letra minúscula, sem ponto final.
- Linguagem de dono de negócio, sem jargão de marketing (nada de lead, funil, conversão, tráfego, engajamento).
- Não invente número, prazo ou promessa.
- Sem aspas, sem emoji.`

const SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    grupo: { type: SchemaType.STRING },
    clientes: { type: SchemaType.STRING },
    dor1: { type: SchemaType.STRING },
    dor2: { type: SchemaType.STRING },
  },
  required: ['grupo', 'clientes', 'dor1', 'dor2'],
}

export interface ColdCallNiche {
  grupo: string
  clientes: string
  dor1: string
  dor2: string
}

function clean(value: unknown, maxWords: number): string {
  if (typeof value !== 'string') return ''
  const text = value.trim().replace(/^["“]|["”]$/g, '').replace(/[.]+$/, '')
  return text && text.split(/\s+/).length <= maxWords ? text : ''
}

/** Trechos do roteiro para o nicho; null em qualquer falha (aí valem os genéricos). */
export async function adaptColdCallNiche(params: { nicho: string }): Promise<ColdCallNiche | null> {
  const prompt = `NICHO: ${params.nicho}`
  try {
    const model = getGeminiModel(SYSTEM_INSTRUCTION, SCHEMA)
    const result = await model.generateContent(prompt)
    const parsed = JSON.parse(result.response.text()) as Record<string, unknown>
    const niche = {
      grupo: clean(parsed.grupo, 8),
      clientes: clean(parsed.clientes, 3).toLowerCase(),
      dor1: clean(parsed.dor1, 11),
      dor2: clean(parsed.dor2, 11),
    }
    return niche.grupo && niche.clientes && niche.dor1 && niche.dor2 ? niche : null
  } catch (error) {
    console.error('[adaptColdCallNiche]', error)
    return null
  }
}

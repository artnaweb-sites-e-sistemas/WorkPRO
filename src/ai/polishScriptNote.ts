import { SchemaType } from '@google/generative-ai'
import { getGeminiModel } from '../lib/ai'

const SYSTEM_INSTRUCTION = `Você corrige anotações rápidas que um vendedor digitou durante uma reunião, com as palavras do cliente.

A anotação vai ser encaixada em frases do roteiro, no lugar de {campo}. Devolva a anotação corrigida para caber de forma natural nessas frases.

REGRAS:
- Corrija ortografia, acentos, pontuação e concordância.
- Ajuste o começo da frase só o necessário para encaixar (ex.: tirar "que" repetido, trocar "eu" por "você" quando a frase do roteiro fala com o cliente).
- MANTENHA as palavras e o sentido do cliente. Não resuma, não troque por termos de marketing, não acrescente informação.
- Sem ponto final, sem aspas, sem letra maiúscula no início (exceto nomes próprios).
- Se a anotação já estiver boa, devolva igual.`

const SCHEMA = {
  type: SchemaType.OBJECT,
  properties: { text: { type: SchemaType.STRING } },
  required: ['text'],
}

/** Devolve a anotação corrigida; em qualquer falha, devolve a original. */
export async function polishScriptNote(params: {
  label: string
  text: string
  /** frases do roteiro onde a anotação entra, com o marcador {campo} */
  usages: string[]
}): Promise<string> {
  const original = params.text.trim()
  if (!original) {
    return params.text
  }
  const prompt = [
    `CAMPO: ${params.label}`,
    `ANOTAÇÃO: ${original}`,
    'FRASES ONDE ENTRA:',
    ...params.usages.map((usage) => `- ${usage}`),
  ].join('\n')

  try {
    const model = getGeminiModel(SYSTEM_INSTRUCTION, SCHEMA)
    const result = await model.generateContent(prompt)
    const parsed = JSON.parse(result.response.text()) as { text?: unknown }
    const text = typeof parsed.text === 'string' ? parsed.text.trim().replace(/[.]+$/, '') : ''
    // Resposta vazia ou longa demais = a IA reescreveu; fica o que ele digitou.
    if (!text || text.length > original.length * 2 + 20) {
      return original
    }
    return text
  } catch (error) {
    console.error('[polishScriptNote]', error)
    return original
  }
}

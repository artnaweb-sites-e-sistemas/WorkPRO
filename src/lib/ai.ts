import { GoogleGenerativeAI, type Schema, type Tool } from '@google/generative-ai'

const apiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim()

if (!apiKey) {
  throw new Error('Defina VITE_GEMINI_API_KEY no .env')
}

const genAI = new GoogleGenerativeAI(apiKey)

export function getGeminiModel(systemInstruction: string, jsonSchema?: object) {
  return genAI.getGenerativeModel({
    model: 'gemini-flash-latest',
    systemInstruction,
    ...(jsonSchema && {
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: jsonSchema as Schema,
      },
    }),
  })
}

/**
 * Modelo com pesquisa no Google (resposta em texto, com fatos de agora).
 * O SDK ainda não tipa a ferramenta `googleSearch`, mas repassa para a API como está.
 */
export function getSearchModel(systemInstruction: string) {
  return genAI.getGenerativeModel({
    model: 'gemini-flash-latest',
    systemInstruction,
    tools: [{ googleSearch: {} } as unknown as Tool],
  })
}

import { GoogleGenerativeAI, type Schema } from '@google/generative-ai'

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

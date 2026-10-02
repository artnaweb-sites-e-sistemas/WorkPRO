import { SchemaType } from '@google/generative-ai'
import { getGeminiModel } from '../lib/ai'
import { SCRIPT_CAPTURES } from '../lib/pilotoScript'
import type { ScriptCapture } from '../lib/pilotoScript'

const SYSTEM_INSTRUCTION = `Você escuta o áudio de uma reunião de vendas (vendedor + dono de um negócio local) e extrai SÓ o que o LEAD/cliente respondeu, para preencher anotações do roteiro.

REGRAS:
- Foque na voz/respostas do cliente (dono), não no discurso do vendedor.
- Preencha apenas os campos pedidos. Se não houver resposta clara para um campo, deixe string vazia.
- Anotação curta, nas palavras do cliente, pronta para caber no roteiro (sem aspas, sem markdown).
- Números (clientes/mês): só o número ou a quantidade falada de forma curta (ex.: "8", "uns 20").
- Não invente. Na dúvida, deixe vazio.
- Português do Brasil.`

function buildSchema(keys: string[]) {
  return {
    type: SchemaType.OBJECT,
    properties: Object.fromEntries(keys.map((key) => [key, { type: SchemaType.STRING }])),
    required: keys,
  }
}

export type ScriptAudioField = {
  key: string
  label: string
  hint: string
}

/** Converte o Blob do microfone em base64 (sem prefixo data:). */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function pickRecorderMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }
  return ''
}

/**
 * Transcreve/interpreta o áudio e devolve valores para os campos da ficha atual.
 * Campos sem resposta clara vêm como string vazia.
 */
export async function extractScriptNotesFromAudio(params: {
  audioBase64: string
  mimeType: string
  fields: ScriptAudioField[]
  cardTitle: string
  cardGoal: string
  company: string
  leadName: string
}): Promise<Record<string, string>> {
  const keys = params.fields.map((field) => field.key)
  if (!keys.length) return {}

  const fieldLines = params.fields.map((field) => `- ${field.key} (${field.label}): ${field.hint}`)
  const prompt = [
    `FICHA DO ROTEIRO: ${params.cardTitle}`,
    `OBJETIVO DA FICHA: ${params.cardGoal}`,
    params.leadName ? `NOME DO LEAD: ${params.leadName}` : '',
    params.company ? `EMPRESA: ${params.company}` : '',
    'CAMPOS PARA PREENCHER (chave → o que anotar):',
    ...fieldLines,
    'Ouça o áudio e devolva JSON com essas chaves. Vazio se não houver resposta clara do lead.',
  ]
    .filter(Boolean)
    .join('\n')

  const model = getGeminiModel(SYSTEM_INSTRUCTION, buildSchema(keys))
  const result = await model.generateContent([
    { text: prompt },
    {
      inlineData: {
        mimeType: params.mimeType.includes('webm')
          ? 'audio/webm'
          : params.mimeType.includes('mp4')
            ? 'audio/mp4'
            : params.mimeType.includes('ogg')
              ? 'audio/ogg'
              : 'audio/webm',
        data: params.audioBase64,
      },
    },
  ])

  const parsed = JSON.parse(result.response.text()) as Record<string, unknown>
  const out: Record<string, string> = {}
  for (const key of keys) {
    const value = parsed[key]
    out[key] = typeof value === 'string' ? value.trim() : ''
  }
  return out
}

export function fieldsFromCaptureKeys(keys: string[]): ScriptAudioField[] {
  return keys
    .map((key) => {
      const capture: ScriptCapture | undefined = SCRIPT_CAPTURES[key]
      if (!capture) return null
      return { key, label: capture.label, hint: capture.hint }
    })
    .filter((item): item is ScriptAudioField => item != null)
}

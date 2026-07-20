import { SchemaType } from '@google/generative-ai'
import { getGeminiModel } from '../lib/ai'
import type { Message, Sender } from '../types/models'

export type ReconcileAction = 'kept' | 'updated' | 'added'

export interface ReconciledThreadItem {
  sender: Sender
  text: string
  action: ReconcileAction
  matchedMessageId: string | null
  createdAt?: Date
  timeLabel?: string | null
}

const IMPORT_JSON_SCHEMA_FLAT = {
  type: SchemaType.OBJECT,
  properties: {
    thread: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          sender: { type: SchemaType.STRING },
          text: { type: SchemaType.STRING },
          action: { type: SchemaType.STRING },
          matchedMessageId: { type: SchemaType.STRING, nullable: true },
        },
        required: ['sender', 'text', 'action', 'matchedMessageId'],
      },
    },
  },
  required: ['thread'],
}

function buildImportInstruction(clientName: string): string {
  return `Você reconcilia uma conversa copiada da Workana com as mensagens JÁ cadastradas no sistema.

CONTEXTO:
- EU = freelancer/prestador. CLIENTE = lead (${clientName || 'nome desconhecido'}).
- Ordem na Workana: de cima para baixo = do mais antigo ao mais recente. NÃO reordene por datas/horários ("há 3 anos", etc.) — só separam blocos.

MENSAGENS EXISTENTES NO SISTEMA:
- São a VERDADE sobre o remetente (sender). Use como ÂNCORA.
- Se um trecho da Workana corresponde (igual ou muito parecido) a uma mensagem existente, use o MESMO sender e o id em matchedMessageId.
- Só inferir remetente do zero quando não houver correspondência (action: added).

REGRAS DE RECONCILIAÇÃO (a Workana é a verdade do que foi REALMENTE enviado):

R1. CORRESPONDÊNCIA TOTAL: mensagem existente aparece igual na Workana -> action "kept", text igual, matchedMessageId = id.

R2. APARAR (trim) CONTEÚDO NÃO ENVIADO: Workana tem só PARTE do texto de uma mensagem existente -> action "updated", text = só o que está na Workana (remover partes não enviadas), matchedMessageId = id.

R3. MANTER NÃO ENVIADA: mensagem existente NÃO aparece na Workana (gerada/salva mas não enviada) -> action "kept", text original intacto, matchedMessageId = id, na posição correta da thread.

R4. ADICIONAR NOVA: Workana tem mensagem que não existe no sistema -> action "added", matchedMessageId = null, sender inferido (âncoras quando possível).

R5. ORDEM: thread final em ordem cronológica (Workana top-to-bottom), intercalando mantidas/atualizadas/novas corretamente.

IMPORTANTE: inclua TODAS as mensagens existentes na saída (kept ou updated). Nada se perde.

Retorne JSON: { "thread": [ { "sender": "eu"|"cliente", "text": "...", "action": "kept"|"updated"|"added", "matchedMessageId": "id ou null" } ] }`
}

function parseSender(value: unknown): Sender | null {
  if (value === 'eu' || value === 'cliente') {
    return value
  }
  return null
}

function parseAction(value: unknown): ReconcileAction | null {
  if (value === 'kept' || value === 'updated' || value === 'added') {
    return value
  }
  return null
}

function parseImportResponse(raw: string): ReconciledThreadItem[] {
  try {
    const parsed = JSON.parse(raw) as { thread?: unknown }
    const threadRaw = parsed.thread

    const items = Array.isArray(threadRaw)
      ? threadRaw
      : typeof threadRaw === 'object' &&
          threadRaw !== null &&
          Array.isArray((threadRaw as { items?: unknown }).items)
        ? (threadRaw as { items: unknown[] }).items
        : []

    const result: ReconciledThreadItem[] = []

    for (const item of items) {
      if (typeof item !== 'object' || item === null) {
        continue
      }

      const record = item as Record<string, unknown>
      const sender = parseSender(record.sender)
      const action = parseAction(record.action)
      const text = typeof record.text === 'string' ? record.text.trim() : ''
      const matchedMessageId =
        typeof record.matchedMessageId === 'string' && record.matchedMessageId.trim()
          ? record.matchedMessageId.trim()
          : null

      if (sender && action && text) {
        result.push({ sender, text, action, matchedMessageId })
      }
    }

    return result
  } catch {
    return []
  }
}

function ensureAllExistingIncluded(
  thread: ReconciledThreadItem[],
  existingMessages: Message[],
): ReconciledThreadItem[] {
  const includedIds = new Set(
    thread
      .map((item) => item.matchedMessageId)
      .filter((id): id is string => id !== null),
  )

  const missing = existingMessages.filter((message) => !includedIds.has(message.id))
  if (missing.length === 0) {
    return thread
  }

  return [
    ...thread,
    ...missing.map((message) => ({
      sender: message.sender,
      text: message.text,
      action: 'kept' as const,
      matchedMessageId: message.id,
    })),
  ]
}

function buildImportUserContent(rawText: string, existingMessages: Message[]): string {
  const existingJson =
    existingMessages.length === 0
      ? '(nenhuma mensagem cadastrada ainda)'
      : JSON.stringify(
          existingMessages.map((message) => ({
            id: message.id,
            sender: message.sender,
            text: message.text,
          })),
          null,
          2,
        )

  return [
    'TEXTO COLADO DA WORKANA:',
    rawText.trim(),
    '',
    'MENSAGENS JÁ CADASTRADAS NO SISTEMA (ordem cronológica — use como âncora de remetente):',
    existingJson,
  ].join('\n')
}

export async function parseConversationImport(
  rawText: string,
  clientName: string,
  existingMessages: Message[],
): Promise<ReconciledThreadItem[]> {
  const model = getGeminiModel(buildImportInstruction(clientName), IMPORT_JSON_SCHEMA_FLAT)
  const userContent = buildImportUserContent(rawText, existingMessages)
  const result = await model.generateContent(userContent)
  const thread = parseImportResponse(result.response.text())
  return ensureAllExistingIncluded(thread, existingMessages)
}

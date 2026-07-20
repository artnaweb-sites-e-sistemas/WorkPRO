import type { ReconciledThreadItem } from '../ai/importParser'
import type { Message, Sender } from '../types/models'
import { messageTextsMatch, normalizeMessageText } from './messageText'
import { parseWorkanaRelativeTime } from './parseWorkanaRelativeTime'

/**
 * Cabeçalho de mensagem: "#<identificador> (<tempo>):".
 * O bloco de tempo entre parênteses é OBRIGATÓRIO — assim um "#" solto no meio
 * do texto (ex: "#promo") não é confundido com início de mensagem/remetente.
 * O identificador aceita nomes e telefones com espaços ("#+55 21 99669-0103").
 */
const TAG_HEADER_REGEX = /#\s*([^#\n(]+?)\s*\(([^)]*)\)\s*:\s*/g

export interface TaggedImportMessage {
  sender: Sender
  text: string
  timeLabel: string | null
  createdAt: Date
}

export function isTaggedConversationImport(text: string): boolean {
  return /#\s*[^#\n(]+?\s*\([^)]*\)\s*:/m.test(text.trim())
}

function normalizeLeadIdentifier(raw: string): string {
  const trimmed = raw.trim()

  if (trimmed.startsWith('+')) {
    return trimmed.slice(1).trim()
  }

  return trimmed
}

function resolveSender(tagName: string): Sender | null {
  const kind = tagName.trim().toLowerCase()

  if (kind === 'sistema') {
    return null
  }

  if (kind === 'eu') {
    return 'eu'
  }

  return 'cliente'
}

function isLeadIdentifierTag(tagName: string): boolean {
  const kind = tagName.trim().toLowerCase()
  return kind !== 'eu' && kind !== 'cliente' && kind !== 'sistema'
}

export function extractLeadNameFromTaggedText(rawText: string): string | null {
  const text = rawText.trim()

  if (!text) {
    return null
  }

  const matches = [...text.matchAll(TAG_HEADER_REGEX)]

  for (const match of matches) {
    const tagName = match[1]?.trim()

    if (!tagName || !isLeadIdentifierTag(tagName)) {
      continue
    }

    return normalizeLeadIdentifier(tagName)
  }

  return null
}

function applySequentialOffsets(messages: TaggedImportMessage[]): TaggedImportMessage[] {
  if (messages.length === 0) {
    return messages
  }

  const result = messages.map((message) => ({ ...message }))

  let start = 0
  while (start < result.length) {
    let end = start + 1

    while (
      end < result.length &&
      result[end].createdAt.getTime() === result[start].createdAt.getTime()
    ) {
      end += 1
    }

    for (let index = start; index < end; index += 1) {
      result[index] = {
        ...result[index],
        createdAt: new Date(result[start].createdAt.getTime() + (index - start) * 1000),
      }
    }

    start = end
  }

  return result
}

export function parseTaggedConversation(
  rawText: string,
  now = new Date(),
): TaggedImportMessage[] {
  const text = rawText.trim()

  if (!text) {
    return []
  }

  const matches = [...text.matchAll(TAG_HEADER_REGEX)]

  if (matches.length === 0) {
    return []
  }

  // 1ª passada: extrai cada mensagem NA ORDEM DO TEXTO, com o horário efetivo.
  // O horário efetivo é a data/hora parseada; quando não há tempo parseável,
  // usa a mensagem anterior (no texto colado) + 1s como fallback.
  const entries: (TaggedImportMessage & { order: number })[] = []
  let lastTime: Date | null = null

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]
    const tagName = match[1]?.trim() ?? ''
    const sender = resolveSender(tagName)

    if (!sender) {
      continue
    }

    const timeLabel = match[2]?.trim() || null
    const bodyStart = match.index! + match[0].length
    const bodyEnd = index + 1 < matches.length ? matches[index + 1].index! : text.length
    const body = text.slice(bodyStart, bodyEnd).trim()

    if (!body) {
      continue
    }

    const parsed = timeLabel ? parseWorkanaRelativeTime(timeLabel, now) : null
    const createdAt =
      parsed ?? (lastTime ? new Date(lastTime.getTime() + 1000) : new Date(now))

    lastTime = createdAt

    entries.push({
      sender,
      text: body,
      timeLabel,
      createdAt,
      order: entries.length,
    })
  }

  // Ordena pela data/hora real (crescente). Empate -> mantém a ordem original
  // do texto colado (desempate estável via `order`).
  entries.sort((a, b) => {
    const diff = a.createdAt.getTime() - b.createdAt.getTime()
    return diff !== 0 ? diff : a.order - b.order
  })

  const messages = entries.map(({ order: _order, ...message }) => message)

  // Garante ordenação determinística no Firestore (createdAt asc): horários
  // iguais recebem incremento de 1s preservando a ordem já resolvida acima.
  return applySequentialOffsets(messages)
}

function findPartialMatch(
  parsedText: string,
  existingMessages: Message[],
  usedIds: Set<string>,
): Message | undefined {
  const normalizedParsed = normalizeMessageText(parsedText)

  return existingMessages.find((message) => {
    if (usedIds.has(message.id)) {
      return false
    }

    const normalizedExisting = normalizeMessageText(message.text)
    return (
      normalizedExisting.includes(normalizedParsed) || normalizedParsed.includes(normalizedExisting)
    )
  })
}

export function reconcileTaggedImport(
  parsed: TaggedImportMessage[],
  existingMessages: Message[],
): ReconciledThreadItem[] {
  const usedIds = new Set<string>()
  const thread: ReconciledThreadItem[] = []

  for (const message of parsed) {
    const exactMatch = existingMessages.find(
      (existing) => !usedIds.has(existing.id) && messageTextsMatch(existing.text, message.text),
    )

    if (exactMatch) {
      usedIds.add(exactMatch.id)
      thread.push({
        sender: message.sender,
        text: message.text,
        action: 'kept',
        matchedMessageId: exactMatch.id,
        createdAt: message.createdAt,
        timeLabel: message.timeLabel,
      })
      continue
    }

    const partialMatch = findPartialMatch(message.text, existingMessages, usedIds)

    if (partialMatch) {
      usedIds.add(partialMatch.id)
      thread.push({
        sender: message.sender,
        text: message.text,
        action: messageTextsMatch(partialMatch.text, message.text) ? 'kept' : 'updated',
        matchedMessageId: partialMatch.id,
        createdAt: message.createdAt,
        timeLabel: message.timeLabel,
      })
      continue
    }

    thread.push({
      sender: message.sender,
      text: message.text,
      action: 'added',
      matchedMessageId: null,
      createdAt: message.createdAt,
      timeLabel: message.timeLabel,
    })
  }

  for (const existing of existingMessages) {
    if (usedIds.has(existing.id)) {
      continue
    }

    thread.push({
      sender: existing.sender,
      text: existing.text,
      action: 'kept',
      matchedMessageId: existing.id,
      createdAt: existing.createdAt?.toDate?.() ?? new Date(),
      timeLabel: null,
    })
  }

  return thread
}

export function parseTaggedConversationImport(
  rawText: string,
  existingMessages: Message[],
  now = new Date(),
): ReconciledThreadItem[] {
  const parsed = parseTaggedConversation(rawText, now)
  return reconcileTaggedImport(parsed, existingMessages)
}

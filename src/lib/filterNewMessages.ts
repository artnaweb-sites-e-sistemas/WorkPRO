import type { Message, Sender } from '../types/models'
import { messageTextsMatch } from './messageText'

export interface ParsedImportMessage {
  sender: Sender
  text: string
}

export function filterNewImportMessages(
  parsed: ParsedImportMessage[],
  existingMessages: Message[],
): ParsedImportMessage[] {
  return parsed.filter(
    (candidate) =>
      candidate.text.trim() !== '' &&
      !existingMessages.some((existing) => messageTextsMatch(existing.text, candidate.text)),
  )
}

export function countDuplicateImportMessages(
  parsed: ParsedImportMessage[],
  existingMessages: Message[],
): number {
  return parsed.filter(
    (candidate) =>
      candidate.text.trim() !== '' &&
      existingMessages.some((existing) => messageTextsMatch(existing.text, candidate.text)),
  ).length
}

/** Normaliza texto para comparação de duplicatas (trim, minúsculas, espaços colapsados). */
export function normalizeMessageText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function messageTextsMatch(a: string, b: string): boolean {
  return normalizeMessageText(a) === normalizeMessageText(b)
}

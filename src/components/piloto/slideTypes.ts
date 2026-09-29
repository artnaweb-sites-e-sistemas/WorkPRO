import type { PilotoAiContent, PilotoInput } from '../../types/piloto'

export interface SlideProps {
  input: PilotoInput
  content: PilotoAiContent
  accent: string
}

export const AI_FALLBACK = 'Texto ainda não gerado'

export function aiText(value: string): string {
  return value.trim() || AI_FALLBACK
}

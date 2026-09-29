import type { PilotoAiContent, PilotoInput } from '../../types/piloto'

export interface SlideProps {
  input: PilotoInput
  content: PilotoAiContent
  accent: string
  /** posição do slide (0-based) e total, para o rodapé */
  index: number
  total: number
}

export const AI_FALLBACK = 'Texto ainda não gerado'

export function aiText(value: string): string {
  return value.trim() || AI_FALLBACK
}

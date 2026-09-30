import type { ComponentType } from 'react'
import { SlideCapa } from './SlideCapa'
import { SlideDiagnostico } from './SlideDiagnostico'
import { SlideProblema } from './SlideProblema'
import { SlideFunil } from './SlideFunil'
import { SlideDuasFases } from './SlideDuasFases'
import { SlideFundacao } from './SlideFundacao'
import { SlideVideos } from './SlideVideos'
import { SlideTrafego } from './SlideTrafego'
import { SlideQualificacao } from './SlideQualificacao'
import { SlideComparacao } from './SlideComparacao'
import { SlideDia45 } from './SlideDia45'
import { SlideInvestimento } from './SlideInvestimento'
import { SlideProximosPassos } from './SlideProximosPassos'
import { SlideContinuidade } from './SlideContinuidade'
import type { SlideProps } from './slideTypes'

export type { SlideProps } from './slideTypes'

const CORE_SLIDES: ComponentType<SlideProps>[] = [
  SlideCapa,
  SlideDiagnostico,
  SlideProblema,
  SlideFunil,
  SlideDuasFases,
  SlideFundacao,
  SlideVideos,
  SlideTrafego,
  SlideQualificacao,
  SlideComparacao,
  SlideDia45,
  SlideInvestimento,
  SlideProximosPassos,
]

/**
 * Ordem da reunião: reconhecer o problema, entender o método, ver o plano, ver o preço.
 * O preço e o fechamento vêm no fim. A continuidade (opcional) é o último slide.
 */
export function getPilotoSlides(showContinuation = false): ComponentType<SlideProps>[] {
  if (!showContinuation) {
    return CORE_SLIDES
  }
  return [...CORE_SLIDES, SlideContinuidade]
}

/** Lista completa (com continuidade) — útil para índices fixos do editor. */
export const SLIDES = getPilotoSlides(true)

/**
 * Índice base sem o slide de continuidade.
 * Com continuidade ligada, o fechamento permanece no mesmo índice (continuidade vai depois).
 */
export const SLIDE_INDEX = {
  diagnostico: 1,
  funil: 3,
  videos: 6,
  conversa: 8,
  fechamento: CORE_SLIDES.length - 1,
} as const

export function getPilotoSlideIndex(
  section: keyof typeof SLIDE_INDEX,
  _showContinuation: boolean,
): number {
  return SLIDE_INDEX[section]
}

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
 * O preço vem só no fim. A continuidade (opcional) fica imediatamente antes do fechamento.
 */
export function getPilotoSlides(showContinuation = false): ComponentType<SlideProps>[] {
  if (!showContinuation) {
    return CORE_SLIDES
  }
  const closing = CORE_SLIDES[CORE_SLIDES.length - 1]
  return [...CORE_SLIDES.slice(0, -1), SlideContinuidade, closing]
}

/** Lista completa (com continuidade) — útil para índices fixos do editor. */
export const SLIDES = getPilotoSlides(true)

/**
 * Índice base sem o slide de continuidade.
 * Com continuidade ligada, o fechamento sobe 1 (continuidade entra antes dele).
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
  showContinuation: boolean,
): number {
  const base = SLIDE_INDEX[section]
  if (section === 'fechamento' && showContinuation) {
    return base + 1
  }
  return base
}

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
import { SlideDia45 } from './SlideDia45'
import { SlideInvestimento } from './SlideInvestimento'
import { SlideProximosPassos } from './SlideProximosPassos'
import type { SlideProps } from './slideTypes'

export type { SlideProps } from './slideTypes'

/**
 * Ordem da reunião: reconhecer o problema, entender o método, ver o plano, ver o preço.
 * O preço vem só no fim, depois que o valor já foi construído.
 */
export const SLIDES: ComponentType<SlideProps>[] = [
  SlideCapa,
  SlideDiagnostico,
  SlideProblema,
  SlideFunil,
  SlideDuasFases,
  SlideFundacao,
  SlideVideos,
  SlideTrafego,
  SlideQualificacao,
  SlideDia45,
  SlideInvestimento,
  SlideProximosPassos,
]

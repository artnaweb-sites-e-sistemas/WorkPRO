import type { ComponentType } from 'react'
import { SlideCapa } from './SlideCapa'
import { SlideDiagnostico } from './SlideDiagnostico'
import { SlideProblema } from './SlideProblema'
import { SlideFunil } from './SlideFunil'
import { SlideDuasFases } from './SlideDuasFases'
import { SlideFundacao } from './SlideFundacao'
import { SlideTrafego } from './SlideTrafego'
import { SlideQualificacao } from './SlideQualificacao'
import { SlideDia45 } from './SlideDia45'
import { SlideInvestimento } from './SlideInvestimento'
import { SlideProximosPassos } from './SlideProximosPassos'
import type { SlideProps } from './slideTypes'

export type { SlideProps } from './slideTypes'

export const SLIDES: ComponentType<SlideProps>[] = [
  SlideCapa,
  SlideDiagnostico,
  SlideProblema,
  SlideFunil,
  SlideDuasFases,
  SlideFundacao,
  SlideTrafego,
  SlideQualificacao,
  SlideDia45,
  SlideInvestimento,
  SlideProximosPassos,
]

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

/**
 * Ordem da reunião: reconhecer o problema, entender o método, ver o plano, ver o preço.
 * O preço vem só no fim, depois que o valor já foi construído. O último slide é de apoio:
 * fica depois do fechamento e só aparece se o cliente perguntar sobre a continuidade.
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
  SlideComparacao,
  SlideDia45,
  SlideInvestimento,
  SlideProximosPassos,
  SlideContinuidade,
]

/** Índice do slide de cada bloco de texto da IA, para o editor pular a prévia até ele. */
export const SLIDE_INDEX = {
  diagnostico: 1,
  funil: 3,
  videos: 6,
  conversa: 8,
  fechamento: 12,
} as const

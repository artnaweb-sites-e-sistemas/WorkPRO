import { Fragment } from 'react'

import { motion, useReducedMotion } from 'framer-motion'

import type { Conversation, Stage } from '../types/models'

import { resolveStepperStage } from '../ai/stageEngine'

import { cn } from '../lib/cn'



interface StepDef {

  id: Stage

  label: string

  sublabel?: string

}



function buildSteps(conversation: Conversation): StepDef[] {

  const steps: StepDef[] = [{ id: 'abordagem', label: 'Abordagem' }]



  if (conversation.videoCallEnabled) {

    steps.push({ id: 'videocall', label: 'Vídeo chamada' })

  } else {

    steps.push({
      id: 'relacionamento',
      label: 'Relacionamento',
    })

  }



  steps.push({ id: 'orcamento', label: 'Orçamento' })

  steps.push({ id: 'fechamento', label: 'Fechamento' })

  return steps

}



function getStepIndex(steps: StepDef[], stage: Stage): number {

  const index = steps.findIndex((step) => step.id === stage)

  return index === -1 ? 0 : index

}



interface StageStepperProps {

  conversation: Conversation

}



export function StageStepper({ conversation }: StageStepperProps) {

  const steps = buildSteps(conversation)

  const displayStage = resolveStepperStage(conversation)

  const currentIndex = getStepIndex(steps, displayStage)

  const reduceMotion = useReducedMotion()



  return (

    <div className="w-full">

      <div className="flex w-full items-start">

        {steps.map((step, index) => {

          const isCompleted = index < currentIndex

          const isCurrent = index === currentIndex

          const isFuture = index > currentIndex

          const isLast = index === steps.length - 1

          const isFirst = index === 0

          const lineCompleted = index < currentIndex



          return (

            <Fragment key={step.id}>

              <div

                className={cn(

                  'flex shrink-0 flex-col',

                  isFirst && 'items-start',

                  isLast && 'items-end',

                  !isFirst && !isLast && 'items-center',

                )}

              >

                <motion.div

                  className={cn(

                    'relative flex h-8 w-8 shrink-0 items-center justify-center text-xs font-bold transition-colors',

                    isCompleted && 'border-2 border-accent bg-accent text-accent-foreground',

                    isCurrent && 'border-2 border-accent bg-surface text-accent',

                    isFuture && 'border border-border bg-surface-2 text-muted-foreground',

                  )}

                  animate={

                    isCurrent && !reduceMotion ? { opacity: [1, 0.75, 1] } : undefined

                  }

                  transition={

                    isCurrent && !reduceMotion

                      ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }

                      : undefined

                  }

                >

                  {isCompleted ? (

                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>

                      <path

                        fillRule="evenodd"

                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"

                        clipRule="evenodd"

                      />

                    </svg>

                  ) : (

                    <span>{index + 1}</span>

                  )}

                </motion.div>



                <div

                  className={cn(

                    'mt-2',

                    isFirst && 'text-left',

                    isLast && 'text-right',

                    !isFirst && !isLast && 'text-center',

                  )}

                >

                  <p

                    className={cn(

                      'text-[10px] font-bold uppercase tracking-wide leading-tight sm:text-xs',

                      isCurrent && 'text-accent',

                      isCompleted && 'text-muted-foreground',

                      isFuture && 'text-muted-foreground/70',

                    )}

                  >

                    {step.label}
                  </p>
                </div>

              </div>



              {!isLast && (

                <div className="flex min-w-4 flex-1 items-start px-1 pt-4 sm:px-2">

                  <div className="relative h-px w-full bg-border">

                    <div

                      className={cn(

                        'absolute left-0 top-0 h-full bg-accent transition-all duration-500',

                        lineCompleted ? 'w-full' : 'w-0',

                      )}

                    />

                  </div>

                </div>

              )}

            </Fragment>

          )

        })}

      </div>

    </div>

  )

}


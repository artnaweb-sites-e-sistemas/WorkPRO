import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { motion } from 'framer-motion'

import { computeNextStage, hasBudgetBeenSent } from '../ai/stageEngine'

import { generateFollowUp, generateReply } from '../ai/generate'

import { setSuggestedPrice, setSuggestedRecurringPrice, updateConversation } from '../services/conversations'

import {

  addMessage,

  incrementRelationshipCountOnOutboundMessage,

} from '../services/messages'

import type { Conversation, Message, Sender } from '../types/models'

import { cn } from '../lib/cn'

import { normalizeCurrencyBRL } from '../lib/currencyBRL'

import { BudgetPriceFields } from './SuggestedPriceField'

import { Button, Switch, Textarea } from './ui'



interface GeneratePanelProps {

  conversation: Conversation

  messages: Message[]

  onToggleVideoCall: (enabled: boolean) => void

  onToggleInduceQuote: (enabled: boolean) => void

  autoGenerate?: boolean

}



function getLastSender(messages: Message[]): Sender | null {

  return messages.at(-1)?.sender ?? null

}



function hasLeadInteracted(messages: Message[], conversation: Conversation): boolean {
  return messages.some((message) => message.sender === 'cliente') || conversation.stage !== 'abordagem'
}

function adjustTextareaHeight(textarea: HTMLTextAreaElement | null) {
  if (!textarea) {
    return
  }

  textarea.style.height = 'auto'
  textarea.style.height = `${textarea.scrollHeight}px`
}



export function GeneratePanel({

  conversation,

  messages,

  onToggleVideoCall,

  onToggleInduceQuote,

  autoGenerate = false,

}: GeneratePanelProps) {

  const lastSender = getLastSender(messages)

  const nextStage = useMemo(

    () => computeNextStage(conversation, lastSender),

    [conversation, lastSender],

  )



  const [targetStage, setTargetStage] = useState(nextStage.stage)

  const [generatedText, setGeneratedText] = useState<string | null>(null)

  const [generatedPrice, setGeneratedPrice] = useState<string | null>(null)

  const [generatedRecurringPrice, setGeneratedRecurringPrice] = useState<string | null>(null)

  const [isFollowUp, setIsFollowUp] = useState(false)

  const [isBudgetGeneration, setIsBudgetGeneration] = useState(false)

  const [extraContext, setExtraContext] = useState('')

  const [showExtraContext, setShowExtraContext] = useState(false)

  const [loading, setLoading] = useState(false)

  const [budgetLoading, setBudgetLoading] = useState(false)

  const [followUpLoading, setFollowUpLoading] = useState(false)

  const [error, setError] = useState('')

  const [copySavedFeedback, setCopySavedFeedback] = useState(false)

  const [savingSent, setSavingSent] = useState(false)

  const autoGenerateAttempted = useRef(false)
  const generatedTextareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setTargetStage(nextStage.stage)
  }, [nextStage.stage])

  useEffect(() => {
    adjustTextareaHeight(generatedTextareaRef.current)
  }, [generatedText])

  const budgetSent = useMemo(
    () => hasBudgetBeenSent(conversation, messages),
    [conversation, messages],
  )



  const showGenerateBudget =

    hasLeadInteracted(messages, conversation) && !budgetSent



  const awaitingClientAfterBudget =
    conversation.stage === 'orcamento' && lastSender === 'eu'

  const showFollowUp = messages.length > 0 && lastSender === 'eu'



  const relateStage = nextStage.stage === 'orcamento' ? 'fechamento' : nextStage.stage



  const handleGenerate = useCallback(async () => {

    if (awaitingClientAfterBudget) {

      return

    }



    setLoading(true)

    setError('')

    setIsFollowUp(false)

    setIsBudgetGeneration(false)

    setTargetStage(relateStage)



    try {

      const result = await generateReply(

        conversation,

        messages,

        relateStage,

        extraContext,

      )



      setGeneratedText(result.message)

      setGeneratedPrice(

        result.suggestedPrice ? normalizeCurrencyBRL(result.suggestedPrice) : null,

      )

      setGeneratedRecurringPrice(

        conversation.isRecurring && result.suggestedRecurringPrice

          ? normalizeCurrencyBRL(result.suggestedRecurringPrice)

          : null,

      )



      await updateConversation(conversation.id, {

        collectedInfo: result.collectedInfo,

      })



      if (result.suggestedPrice !== null && !conversation.suggestedPrice) {
        const formattedPrice = normalizeCurrencyBRL(result.suggestedPrice)
        await setSuggestedPrice(conversation.id, formattedPrice)
      }

      if (
        conversation.isRecurring &&
        result.suggestedRecurringPrice !== null &&
        !conversation.suggestedRecurringPrice
      ) {
        const formattedRecurringPrice = normalizeCurrencyBRL(result.suggestedRecurringPrice)
        await setSuggestedRecurringPrice(conversation.id, formattedRecurringPrice)
      }
    } catch {
      setError('Erro ao gerar mensagem. Verifique sua conexão e tente novamente.')

    } finally {

      setLoading(false)

    }

  }, [awaitingClientAfterBudget, conversation, extraContext, messages, relateStage])



  const handleGenerateBudget = useCallback(async () => {

    setBudgetLoading(true)

    setError('')

    setIsFollowUp(false)

    setIsBudgetGeneration(true)

    setTargetStage('orcamento')



    try {

      const result = await generateReply(

        conversation,

        messages,

        'orcamento',

        extraContext,

      )



      setGeneratedText(result.message)

      setGeneratedPrice(

        result.suggestedPrice ? normalizeCurrencyBRL(result.suggestedPrice) : null,

      )

      setGeneratedRecurringPrice(

        conversation.isRecurring && result.suggestedRecurringPrice

          ? normalizeCurrencyBRL(result.suggestedRecurringPrice)

          : null,

      )



      await updateConversation(conversation.id, {

        collectedInfo: result.collectedInfo,

      })



      if (result.suggestedPrice !== null && !conversation.suggestedPrice) {
        const formattedPrice = normalizeCurrencyBRL(result.suggestedPrice)
        await setSuggestedPrice(conversation.id, formattedPrice)
      }

      if (
        conversation.isRecurring &&
        result.suggestedRecurringPrice !== null &&
        !conversation.suggestedRecurringPrice
      ) {
        const formattedRecurringPrice = normalizeCurrencyBRL(result.suggestedRecurringPrice)
        await setSuggestedRecurringPrice(conversation.id, formattedRecurringPrice)
      }
    } catch {
      setError('Erro ao gerar orçamento. Verifique sua conexão e tente novamente.')

    } finally {

      setBudgetLoading(false)

    }

  }, [conversation, extraContext, messages])



  useEffect(() => {

    if (

      !autoGenerate ||

      autoGenerateAttempted.current ||

      messages.length > 0 ||

      conversation.stage !== 'abordagem' ||

      loading

    ) {

      return

    }



    autoGenerateAttempted.current = true

    void handleGenerate()

  }, [autoGenerate, conversation.stage, handleGenerate, loading, messages.length])



  async function handleFollowUp() {

    setFollowUpLoading(true)

    setError('')

    setIsFollowUp(true)

    setIsBudgetGeneration(false)

    setGeneratedPrice(null)

    setGeneratedRecurringPrice(null)



    try {

      const result = await generateFollowUp(conversation, messages, extraContext)

      setGeneratedText(result.message)

    } catch {

      setError('Erro ao gerar follow-up. Verifique sua conexão e tente novamente.')

    } finally {

      setFollowUpLoading(false)

    }

  }



  async function handleCopyAndMarkAsSent() {

    if (!generatedText) {

      return

    }



    setSavingSent(true)

    setError('')



    try {

      await navigator.clipboard.writeText(generatedText)

      setCopySavedFeedback(true)

      setTimeout(() => setCopySavedFeedback(false), 1500)



      if (isFollowUp) {

        await addMessage(conversation.id, {

          sender: 'eu',

          stage: conversation.stage,

          text: generatedText,

        })

      } else {

        await addMessage(conversation.id, {

          sender: 'eu',

          stage: targetStage,

          text: generatedText,

        })



        const updates: Parameters<typeof updateConversation>[1] = {

          stage: targetStage,

        }



        if (targetStage === 'videocall') {

          updates.videoCallDone = true

        }



        await updateConversation(conversation.id, updates)



        if (targetStage === 'relacionamento') {

          await incrementRelationshipCountOnOutboundMessage(conversation.id)

        }

      }



      setGeneratedText(null)

      setGeneratedPrice(null)

      setGeneratedRecurringPrice(null)

      setIsFollowUp(false)

      setIsBudgetGeneration(false)

    } catch {

      setError('Erro ao copiar e salvar mensagem.')

      setCopySavedFeedback(false)

    } finally {

      setSavingSent(false)

    }

  }



  const relateButtonLabel = loading

    ? 'Relacionando...'

    : generatedText && !isFollowUp && !isBudgetGeneration

      ? 'Relacionar novamente'

      : 'Relacionar'



  const budgetButtonLabel = budgetLoading

    ? 'Gerando orçamento...'

    : generatedText && isBudgetGeneration

      ? 'Gerar orçamento novamente'

      : 'Gerar Orçamento'



  const showInduceQuote =
    conversation.stage !== 'orcamento' && conversation.stage !== 'fechamento'

  return (

    <div className="space-y-6">

      <div className="space-y-6 border border-border bg-surface p-6">

        <Switch

          checked={conversation.videoCallEnabled}

          onChange={onToggleVideoCall}

          label="Induzir vídeo chamada"

        />

        {showInduceQuote && (
          <Switch
            checked={conversation.induceQuote}
            onChange={onToggleInduceQuote}
            label="Induzir orçamento"
          />
        )}



        <p className="text-xs normal-case text-muted-foreground">

          Próxima etapa:{' '}

          <span className="font-medium text-foreground">{nextStage.label}</span>

        </p>



        <div className="space-y-2">

          <button

            type="button"

            onClick={() => setShowExtraContext((open) => !open)}

            className={cn(

              'inline-flex items-center gap-1 text-xs normal-case text-muted-foreground',

              'transition-colors hover:text-foreground',

            )}

          >

            {showExtraContext ? '− Ocultar contexto' : '+ Adicionar contexto'}

          </button>



          {showExtraContext && (

            <Textarea

              label="Contexto adicional (opcional)"

              rows={3}

              value={extraContext}

              onChange={(event) => setExtraContext(event.target.value)}

              placeholder="Algo que a IA deve focar nesta mensagem..."

              className="min-h-0 resize-none py-2 text-sm leading-relaxed"

            />

          )}

        </div>



        <Button

          onClick={handleGenerate}

          loading={loading}

          disabled={awaitingClientAfterBudget || budgetLoading || followUpLoading}

          className="w-full"

        >

          {relateButtonLabel}

        </Button>



        {showGenerateBudget && (

          <Button

            variant="success"

            onClick={handleGenerateBudget}

            loading={budgetLoading}

            disabled={loading || followUpLoading}

            className="w-full"

          >

            {budgetButtonLabel}

          </Button>

        )}



        {awaitingClientAfterBudget && (

          <p className="text-xs normal-case text-muted-foreground">

            Orçamento enviado — aguardando resposta do cliente para seguir com o fechamento.

          </p>

        )}



        {showFollowUp && (

          <Button

            variant="secondary"

            onClick={handleFollowUp}

            loading={followUpLoading}

            disabled={loading || budgetLoading}

            className="w-full"

          >

            {followUpLoading ? 'Gerando follow-up...' : 'Fazer follow-up'}

          </Button>

        )}



        {error && (

          <p className="border border-status-error px-3 py-2 text-sm normal-case text-status-error">

            {error}

          </p>

        )}



        {generatedText && (

          <motion.div

            initial={{ opacity: 0, y: 10 }}

            animate={{ opacity: 1, y: 0 }}

            className="space-y-4"

          >

            <div className="border border-border bg-surface-2 p-2">

              <Textarea

                ref={generatedTextareaRef}

                value={generatedText}

                onChange={(event) => setGeneratedText(event.target.value)}

                rows={1}

                className="min-h-0 resize-none overflow-hidden border-0 bg-transparent py-2 text-base normal-case leading-relaxed shadow-none focus:border-transparent"

              />

            </div>



            <Button

              size="sm"

              copied={copySavedFeedback}

              onClick={handleCopyAndMarkAsSent}

              loading={savingSent}

              className="w-full"

            >

              {copySavedFeedback ? 'Copiado e salvo!' : 'Copiar e marcar como enviada'}

            </Button>



            {generatedPrice && (

              <p className="text-xs normal-case text-muted-foreground">

                Preço sugerido pela IA:{' '}

                <span className="font-medium text-foreground">{generatedPrice}</span>

              </p>

            )}

            {conversation.isRecurring && generatedRecurringPrice && (

              <p className="text-xs normal-case text-muted-foreground">

                Recorrente sugerido pela IA:{' '}

                <span className="font-medium text-foreground">{generatedRecurringPrice}/mês</span>

              </p>

            )}

          </motion.div>

        )}

      </div>



      <div
        className={cn(
          'space-y-4 border border-border bg-surface p-6',
          conversation.stage === 'orcamento' && 'border-status-success',
        )}
      >
        <div>
          <p className="kinetic-label mb-1">Orçamento</p>
          <p className="text-sm normal-case text-muted-foreground">
            Preencha manualmente a qualquer momento ou deixe a IA sugerir ao gerar o orçamento.
          </p>
        </div>
        <BudgetPriceFields
          conversationId={conversation.id}
          suggestedPrice={conversation.suggestedPrice}
          suggestedRecurringPrice={conversation.suggestedRecurringPrice}
          isRecurring={conversation.isRecurring}
          showSwitch
          autoSave
        />
      </div>



      {conversation.collectedInfo && (

        <div className="border border-border bg-surface p-6">

          <p className="kinetic-label mb-3">Info coletada</p>

          <p className="whitespace-pre-wrap text-sm normal-case leading-relaxed text-muted-foreground">

            {conversation.collectedInfo}

          </p>

        </div>

      )}

    </div>

  )

}



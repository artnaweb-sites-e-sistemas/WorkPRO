import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ImportConversationPanel } from '../components/ImportConversationPanel'
import { ProposalChannelSelector } from '../components/ProposalChannelSelector'
import { SuggestedPriceField } from '../components/SuggestedPriceField'
import { GeneratePanel } from '../components/GeneratePanel'
import { MeetingScriptContent } from '../components/MeetingScriptContent'
import { MessageThread } from '../components/MessageThread'
import { StageStepper } from '../components/StageStepper'
import { StageBadge } from '../components/StageBadge'
import { ChannelBadge } from '../components/ChannelBadge'
import { StatusSelector } from '../components/StatusSelector'
import { generateMeetingScript, generateProposal } from '../ai/generate'
import { useAlert, useConfirm } from '../context/ConfirmContext'
import {
  deleteConversation,
  getConversation,
  saveMeetingScript,
  saveProposalContent,
  setSuggestedPrice,
  setSuggestedRecurringPrice,
  toggleVideoCall,
  toggleInduceQuote,
  updateConversation,
} from '../services/conversations'
import { getProfile } from '../services/profile'
import { deleteMessage, listMessages } from '../services/messages'
import type { Conversation, Message } from '../types/models'
import type { ProposalChannel, ProposalContent } from '../types/proposal'
import { buildProposalText, resolveProposalNetReais, resolveProposalRecurringNetReais } from '../lib/buildProposalText'
import { normalizeCurrencyBRL } from '../lib/currencyBRL'
import {
  prepareMeetingScriptForCopy,
  resolveMeetingScriptForDisplay,
  serializeMeetingScriptSlots,
} from '../lib/meetingScript'
import { cn } from '../lib/cn'
import { Button, Dialog } from '../components/ui'
import { badgeBaseClassName } from '../components/ui/Badge'

const headerIconClass = 'h-4 w-4 shrink-0'

function EyeIcon() {
  return (
    <svg className={headerIconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg className={headerIconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function VideoCameraIcon() {
  return (
    <svg className={headerIconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className={headerIconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

export default function ConversationView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [shouldAutoGenerate] = useState(
    () => (location.state as { autoGenerate?: boolean } | null)?.autoGenerate === true,
  )
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [showProjectDetails, setShowProjectDetails] = useState(false)
  const [showProposalDialog, setShowProposalDialog] = useState(false)
  const [proposalContent, setProposalContent] = useState<ProposalContent | null>(null)
  const [proposalLegacyText, setProposalLegacyText] = useState<string | null>(null)
  const [proposalChannel, setProposalChannel] = useState<ProposalChannel>('workana')
  const [proposalLoading, setProposalLoading] = useState(false)
  const [proposalError, setProposalError] = useState('')
  const [proposalCopyFeedback, setProposalCopyFeedback] = useState(false)
  const [showMeetingDialog, setShowMeetingDialog] = useState(false)
  const [meetingScript, setMeetingScript] = useState<string | null>(null)
  const [meetingLoading, setMeetingLoading] = useState(false)
  const [meetingError, setMeetingError] = useState('')
  const [meetingCopyFeedback, setMeetingCopyFeedback] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editingClientName, setEditingClientName] = useState(false)
  const [clientNameDraft, setClientNameDraft] = useState('')
  const [savingClientName, setSavingClientName] = useState(false)
  const [clientNameError, setClientNameError] = useState('')
  const confirm = useConfirm()
  const alert = useAlert()

  useEffect(() => {
    if (!id) {
      return
    }

    const unsubConv = getConversation(id, (data) => {
      setConversation(data)
      setLoading(false)
    })

    const unsubMsg = listMessages(id, setMessages)

    return () => {
      unsubConv()
      unsubMsg()
    }
  }, [id])

  useEffect(() => {
    if (shouldAutoGenerate) {
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [shouldAutoGenerate, navigate, location.pathname])

  async function handleToggleVideoCall(enabled: boolean) {
    if (!id) {
      return
    }

    await toggleVideoCall(id, enabled)
  }

  async function handleToggleInduceQuote(enabled: boolean) {
    if (!id) {
      return
    }

    await toggleInduceQuote(id, enabled)
  }

  const proposalDisplayText = useMemo(() => {
    if (proposalContent && conversation) {
      return buildProposalText(
        {
          intro: proposalContent.intro,
          topics: proposalContent.topics,
          reassurance: proposalContent.reassurance,
          netReais: resolveProposalNetReais(conversation.suggestedPrice, proposalContent),
          recurringNetReais: resolveProposalRecurringNetReais(
            conversation.isRecurring,
            conversation.suggestedRecurringPrice,
            proposalContent,
          ),
          isRecurring: conversation.isRecurring,
          prazo: proposalContent.prazo,
        },
        proposalChannel,
      )
    }

    return proposalLegacyText
  }, [conversation, proposalContent, proposalChannel, proposalLegacyText])

  async function generateAndSaveProposal() {
    if (!conversation) {
      return
    }

    setProposalLoading(true)
    setProposalError('')
    setProposalCopyFeedback(false)

    try {
      const result = await generateProposal(conversation, messages)
      setProposalContent(result.content)
      setProposalLegacyText(null)
      setProposalChannel(conversation.channel)
      await saveProposalContent(conversation.id, result.content)

      if (result.suggestedPrice && !conversation.suggestedPrice) {
        const formattedPrice = normalizeCurrencyBRL(result.suggestedPrice)
        await setSuggestedPrice(conversation.id, formattedPrice)
      }

      if (conversation.isRecurring && result.suggestedRecurringPrice && !conversation.suggestedRecurringPrice) {
        const formattedRecurringPrice = normalizeCurrencyBRL(result.suggestedRecurringPrice)
        await setSuggestedRecurringPrice(conversation.id, formattedRecurringPrice)
      }
    } catch {
      setProposalError('Erro ao gerar proposta. Verifique sua conexão e tente novamente.')
      setProposalContent(null)
      setProposalLegacyText(null)
    } finally {
      setProposalLoading(false)
    }
  }

  async function handleOpenProposal() {
    if (!conversation) {
      return
    }

    setShowProposalDialog(true)
    setProposalError('')
    setProposalCopyFeedback(false)
    setProposalChannel(conversation.channel)

    if (conversation.proposalContent) {
      setProposalContent(conversation.proposalContent)
      setProposalLegacyText(null)
      return
    }

    const saved = conversation.proposalText?.trim()
    if (saved) {
      setProposalContent(null)
      setProposalLegacyText(saved)
      return
    }

    setProposalContent(null)
    setProposalLegacyText(null)
    await generateAndSaveProposal()
  }

  async function handleRegenerateProposal() {
    await generateAndSaveProposal()
  }

  async function handleCopyProposal() {
    if (!proposalDisplayText) {
      return
    }

    await navigator.clipboard.writeText(proposalDisplayText)
    setProposalCopyFeedback(true)
    setTimeout(() => setProposalCopyFeedback(false), 1800)
  }

  function handleCloseProposalDialog() {
    if (proposalLoading) {
      return
    }

    setShowProposalDialog(false)
    setProposalError('')
  }

  async function generateAndSaveMeetingScript() {
    if (!conversation) {
      return
    }

    setMeetingLoading(true)
    setMeetingError('')
    setMeetingCopyFeedback(false)

    try {
      const profile = await getProfile()
      const result = await generateMeetingScript(conversation, messages, profile)
      const serialized = serializeMeetingScriptSlots(result.slots)
      setMeetingScript(serialized)
      await saveMeetingScript(conversation.id, serialized)

      if (result.suggestedPrice && !conversation.suggestedPrice) {
        const formattedPrice = normalizeCurrencyBRL(result.suggestedPrice)
        await setSuggestedPrice(conversation.id, formattedPrice)
      }

      if (conversation.isRecurring && result.suggestedRecurringPrice && !conversation.suggestedRecurringPrice) {
        const formattedRecurringPrice = normalizeCurrencyBRL(result.suggestedRecurringPrice)
        await setSuggestedRecurringPrice(conversation.id, formattedRecurringPrice)
      }
    } catch (error) {
      console.error('[ConversationView] generateAndSaveMeetingScript error:', error)
      setMeetingError('Erro ao gerar roteiro. Verifique sua conexão e tente novamente.')
      setMeetingScript(null)
    } finally {
      setMeetingLoading(false)
    }
  }

  async function handleOpenMeeting() {
    if (!conversation) {
      return
    }

    setShowMeetingDialog(true)
    setMeetingError('')
    setMeetingCopyFeedback(false)

    const saved = conversation.meetingScript?.trim()
    if (saved) {
      setMeetingScript(saved)
      return
    }

    await generateAndSaveMeetingScript()
  }

  async function handleRegenerateMeeting() {
    await generateAndSaveMeetingScript()
  }

  async function handleCopyMeeting() {
    if (!meetingScript || !conversation) {
      return
    }

    const text = prepareMeetingScriptForCopy(
      meetingScript,
      conversation.clientName,
      conversation.suggestedPrice,
      conversation.suggestedRecurringPrice,
      conversation.isRecurring,
      conversation.channel,
    )
    if (!text) {
      return
    }

    await navigator.clipboard.writeText(text)
    setMeetingCopyFeedback(true)
    setTimeout(() => setMeetingCopyFeedback(false), 1800)
  }

  function handleCloseMeetingDialog() {
    if (meetingLoading) {
      return
    }

    setShowMeetingDialog(false)
    setMeetingError('')
  }

  async function handleDeleteMessage(message: Message) {
    if (!id || !conversation) {
      return
    }

    const confirmed = await confirm({
      title: 'Remover mensagem',
      message: 'Remover esta mensagem da conversa?',
      confirmLabel: 'Remover',
      variant: 'danger',
    })
    if (!confirmed) {
      return
    }

    try {
      await deleteMessage(id, message.id)

      if (message.sender === 'eu' && message.stage === 'relacionamento') {
        await updateConversation(id, {
          relationshipCount: Math.max(0, conversation.relationshipCount - 1),
        })
      } else if (message.sender === 'eu' && message.stage === 'videocall') {
        await updateConversation(id, { videoCallDone: false })
      }
    } catch {
      await alert({
        title: 'Erro',
        message: 'Erro ao remover mensagem. Tente novamente.',
      })
    }
  }

  async function handleDelete() {
    if (!id || !conversation) {
      return
    }

    const confirmed = await confirm({
      title: 'Excluir conversa',
      message: `Excluir a conversa com ${conversation.clientName.trim() || conversation.projectTitle}? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      variant: 'danger',
    })

    if (!confirmed) {
      return
    }

    setDeleting(true)

    try {
      await deleteConversation(id)
      navigate('/')
    } catch {
      setDeleting(false)
      await alert({
        title: 'Erro',
        message: 'Erro ao excluir conversa.',
      })
    }
  }

  function handleStartEditClientName() {
    setClientNameDraft(conversation?.clientName ?? '')
    setClientNameError('')
    setEditingClientName(true)
  }

  async function handleSaveClientName() {
    if (!id || !clientNameDraft.trim()) {
      setClientNameError('Informe um nome para salvar.')
      return
    }

    setSavingClientName(true)
    setClientNameError('')

    try {
      await updateConversation(id, { clientName: clientNameDraft.trim() })
      setEditingClientName(false)
    } catch {
      setClientNameError('Não foi possível salvar o nome.')
    } finally {
      setSavingClientName(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="inline-block h-8 w-8 animate-spin border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  if (!conversation || !id) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-sm normal-case text-muted-foreground">Conversa não encontrada.</p>
        <Link to="/" className="text-sm font-bold uppercase tracking-tight text-accent hover:underline">
          Voltar ao início
        </Link>
      </div>
    )
  }

  const hasClientName = conversation.clientName.trim().length > 0
  const parsedMeetingScript =
    meetingScript && conversation
      ? resolveMeetingScriptForDisplay(
          meetingScript,
          conversation.clientName,
          conversation.suggestedPrice,
          conversation.suggestedRecurringPrice,
          conversation.isRecurring,
          conversation.channel,
        )
      : null

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <Link
                to="/"
                className="text-xs font-bold uppercase tracking-tight text-muted-foreground transition-colors hover:text-accent"
              >
                ← Voltar
              </Link>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {editingClientName ? (
                  <div className="flex w-full max-w-md flex-wrap items-stretch gap-2">
                    <input
                      type="text"
                      value={clientNameDraft}
                      onChange={(event) => setClientNameDraft(event.target.value)}
                      placeholder="Nome do cliente"
                      autoFocus
                      className="kinetic-input h-12 min-h-0 min-w-[200px] flex-1 py-0"
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveClientName}
                      loading={savingClientName}
                      className="h-12 shrink-0 px-4"
                    >
                      Salvar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingClientName(false)}
                      disabled={savingClientName}
                      className="h-12 shrink-0 px-4"
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : hasClientName ? (
                  <button
                    type="button"
                    onClick={handleStartEditClientName}
                    className="truncate text-left text-3xl font-bold uppercase tracking-tighter text-foreground transition-colors hover:text-accent"
                    title="Clique para editar o nome"
                  >
                    {conversation.clientName}
                  </button>
                ) : (
                  <>
                    <h1 className="truncate text-3xl font-bold uppercase tracking-tighter text-muted-foreground">
                      Lead sem nome
                    </h1>
                    <button
                      type="button"
                      onClick={handleStartEditClientName}
                      className={cn(
                        badgeBaseClassName,
                        'cursor-pointer border-accent bg-accent text-accent-foreground transition-opacity hover:opacity-90',
                      )}
                    >
                      + Adicionar nome
                    </button>
                  </>
                )}
              </div>
              {clientNameError && (
                <p className="mt-2 text-xs normal-case text-status-error">{clientNameError}</p>
              )}
              <p className="mt-1.5 truncate text-base normal-case text-muted-foreground">
                {conversation.projectTitle}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <ChannelBadge channel={conversation.channel} />
                <StageBadge stage={conversation.stage} />
                <StatusSelector
                  conversationId={id}
                  status={conversation.status}
                  stage={conversation.stage}
                  previousStage={conversation.previousStage}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" size="sm" onClick={() => setShowProjectDetails(true)}>
                <EyeIcon />
                Ver projeto
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleOpenProposal}
                loading={proposalLoading && !showProposalDialog}
              >
                <DocumentIcon />
                Proposta
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleOpenMeeting()}
                loading={meetingLoading && !showMeetingDialog}
              >
                <VideoCameraIcon />
                Reunião
              </Button>

              <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>
                <TrashIcon />
                Excluir
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <main className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
          <aside className="w-full shrink-0 lg:w-[400px]">
            <GeneratePanel
              conversation={conversation}
              messages={messages}
              onToggleVideoCall={handleToggleVideoCall}
              onToggleInduceQuote={handleToggleInduceQuote}
              autoGenerate={shouldAutoGenerate}
            />
          </aside>

          <div className="flex flex-1 flex-col gap-8">
            <div className="border-b border-border pb-8">
              <StageStepper conversation={conversation} />
            </div>

            <MessageThread
              conversationId={id}
              messages={messages}
              onDeleteMessage={handleDeleteMessage}
            />

            <ImportConversationPanel
              conversationId={id}
              conversation={conversation}
              messages={messages}
            />
          </div>
        </main>
      </div>

      <Dialog
        open={showProjectDetails}
        onClose={() => setShowProjectDetails(false)}
        title="Detalhes do projeto"
        className="max-w-2xl"
        footer={
          <Button variant="ghost" onClick={() => setShowProjectDetails(false)}>
            Fechar
          </Button>
        }
      >
        <p className="whitespace-pre-wrap text-base normal-case leading-relaxed text-muted-foreground">
          {conversation.projectDetails}
        </p>
      </Dialog>

      <Dialog
        open={showProposalDialog}
        onClose={handleCloseProposalDialog}
        title="Proposta formal"
        description="Texto para enviar ao cliente — escolha o canal e copie no formato certo."
        className="max-w-2xl"
        footer={
          proposalDisplayText ? (
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <ProposalChannelSelector
                value={proposalChannel}
                onChange={setProposalChannel}
                disabled={!proposalContent || proposalLoading}
              />
              <div className="flex flex-wrap items-center justify-end gap-2 sm:shrink-0 sm:gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseProposalDialog}
                  disabled={proposalLoading}
                >
                  Fechar
                </Button>
                <Button
                  size="sm"
                  copied={proposalCopyFeedback}
                  onClick={handleCopyProposal}
                  disabled={proposalLoading}
                >
                  {proposalCopyFeedback ? 'Copiado!' : 'Copiar'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRegenerateProposal}
                  loading={proposalLoading}
                >
                  Gerar novamente
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={handleCloseProposalDialog} disabled={proposalLoading}>
              Fechar
            </Button>
          )
        }
      >
        {conversation && !proposalLoading && proposalDisplayText && (
          <SuggestedPriceField
            conversationId={conversation.id}
            suggestedPrice={conversation.suggestedPrice}
            suggestedRecurringPrice={conversation.suggestedRecurringPrice}
            isRecurring={conversation.isRecurring}
            autoSave
            className="mb-4"
          />
        )}

        {proposalLoading && (
          <div className="flex items-center justify-center py-12">
            <span className="inline-block h-8 w-8 animate-spin border-2 border-accent border-t-transparent" />
          </div>
        )}

        {proposalError && (
          <p className="border border-status-error px-3 py-2 text-sm normal-case text-status-error">
            {proposalError}
          </p>
        )}

        {!proposalLoading && proposalDisplayText && (
          <div className="border border-border bg-surface-2 p-6">
            <p className="whitespace-pre-wrap break-words text-sm normal-case leading-relaxed text-foreground">
              {proposalDisplayText}
            </p>
          </div>
        )}
      </Dialog>

      <Dialog
        open={showMeetingDialog}
        onClose={handleCloseMeetingDialog}
        title="Roteiro de reunião"
        description="Script interno para usar durante a vídeo chamada (não enviar ao cliente)."
        className="max-w-2xl"
        footer={
          meetingScript ? (
            <div className="flex w-full items-stretch justify-end gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCloseMeetingDialog}
                disabled={meetingLoading}
              >
                Fechar
              </Button>
              <Button
                size="sm"
                copied={meetingCopyFeedback}
                onClick={handleCopyMeeting}
                disabled={meetingLoading}
              >
                {meetingCopyFeedback ? 'Copiado!' : 'Copiar'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleRegenerateMeeting()}
                loading={meetingLoading}
              >
                Gerar novamente
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCloseMeetingDialog}
              disabled={meetingLoading}
            >
              Fechar
            </Button>
          )
        }
      >
        {conversation && !meetingLoading && meetingScript && (
          <SuggestedPriceField
            conversationId={conversation.id}
            suggestedPrice={conversation.suggestedPrice}
            suggestedRecurringPrice={conversation.suggestedRecurringPrice}
            isRecurring={conversation.isRecurring}
            autoSave
            className="mb-4"
          />
        )}

        {meetingLoading && (
          <div className="flex items-center justify-center py-12">
            <span className="inline-block h-8 w-8 animate-spin border-2 border-accent border-t-transparent" />
          </div>
        )}

        {meetingError && (
          <p className="border border-status-error px-3 py-2 text-sm normal-case text-status-error">
            {meetingError}
          </p>
        )}

        {!meetingLoading && meetingScript && parsedMeetingScript && (
          <div className="border border-border bg-surface-2 p-6">
            <MeetingScriptContent
              document={parsedMeetingScript}
              suggestedPrice={conversation.suggestedPrice}
              suggestedRecurringPrice={conversation.suggestedRecurringPrice}
              isRecurring={conversation.isRecurring}
              channel={conversation.channel}
            />
          </div>
        )}

        {!meetingLoading && meetingScript && !parsedMeetingScript && (
          <p className="text-sm normal-case text-muted-foreground">
            Não foi possível carregar o roteiro. Use &ldquo;Gerar novamente&rdquo;.
          </p>
        )}
      </Dialog>
    </div>
  )
}

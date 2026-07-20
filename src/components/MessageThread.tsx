import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useAlert } from '../context/ConfirmContext'
import type { Message, Stage } from '../types/models'
import { updateMessage } from '../services/messages'
import { formatMessageTimestamp } from '../lib/formatRelativeTime'
import { staggerItem } from '../lib/motion'
import { cn } from '../lib/cn'

const STAGE_LABELS: Record<Stage, string> = {
  abordagem: 'Abordagem',
  relacionamento: 'Relacionamento',
  videocall: 'Vídeo chamada',
  orcamento: 'Orçamento',
  fechamento: 'Fechamento',
}

const threadContainerClass =
  'max-h-[40vh] overflow-y-auto border border-border bg-surface p-6 sm:max-h-[50vh] lg:max-h-[60vh]'

const actionButtonClass = cn(
  'flex h-6 w-6 items-center justify-center',
  'border border-border bg-surface text-muted-foreground',
  'opacity-0 transition-opacity duration-150 group-hover:opacity-100',
)

const textContentClass = 'text-base normal-case leading-relaxed whitespace-pre-wrap'

const editActionBaseClass =
  'inline-flex h-8 items-center justify-center px-2.5 text-[10px] font-bold uppercase tracking-tight transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50'

interface MessageThreadProps {
  conversationId: string
  messages: Message[]
  onDeleteMessage?: (message: Message) => void
}

interface MessageBubbleProps {
  conversationId: string
  message: Message
  onDeleteMessage?: (message: Message) => void
}

function PencilIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      className="h-3 w-3"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

function resizeTextareaToContent(textarea: HTMLTextAreaElement) {
  textarea.style.height = '0px'
  textarea.style.height = `${textarea.scrollHeight}px`
}

function MessageBubble({ conversationId, message, onDeleteMessage }: MessageBubbleProps) {
  const isClient = message.sender === 'cliente'
  const alert = useAlert()
  const [editing, setEditing] = useState(false)
  const [draftText, setDraftText] = useState(message.text)
  const [saving, setSaving] = useState(false)
  const [editWidth, setEditWidth] = useState<number | null>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const syncTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      resizeTextareaToContent(textarea)
    }
  }, [])

  useEffect(() => {
    if (!editing) {
      setDraftText(message.text)
    }
  }, [message.text, editing])

  useEffect(() => {
    if (!editing) {
      return
    }

    syncTextareaHeight()
    const textarea = textareaRef.current
    textarea?.focus()
    textarea?.setSelectionRange(draftText.length, draftText.length)
  }, [editing, draftText.length, syncTextareaHeight])

  function exitEditMode() {
    setEditing(false)
    setEditWidth(null)
  }

  function handleStartEdit() {
    const width = bubbleRef.current?.offsetWidth
    if (width) {
      setEditWidth(width)
    }
    setDraftText(message.text)
    setEditing(true)
  }

  function handleCancel() {
    setDraftText(message.text)
    exitEditMode()
  }

  function handleDraftChange(value: string) {
    setDraftText(value)
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        resizeTextareaToContent(textareaRef.current)
      }
    })
  }

  async function handleSave() {
    if (!draftText.trim()) {
      await alert({
        title: 'Mensagem vazia',
        message: 'A mensagem não pode ficar vazia.',
      })
      return
    }

    if (draftText === message.text) {
      exitEditMode()
      return
    }

    setSaving(true)

    try {
      await updateMessage(conversationId, message.id, { text: draftText })
      exitEditMode()
    } catch {
      await alert({
        title: 'Erro',
        message: 'Erro ao salvar mensagem. Tente novamente.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      ref={bubbleRef}
      style={editing && editWidth ? { width: editWidth, minWidth: editWidth } : undefined}
      className={cn(
        'group relative max-w-[85%] px-4 py-3',
        isClient
          ? 'border border-border bg-surface-2 text-foreground'
          : 'border-2 border-accent bg-accent text-accent-foreground',
      )}
    >
      {!editing && (
        <div className="absolute -right-2 -top-2 flex gap-1">
          <button
            type="button"
            aria-label="Editar mensagem"
            onClick={handleStartEdit}
            className={cn(actionButtonClass, 'hover:border-accent hover:text-accent')}
          >
            <PencilIcon />
          </button>
          {onDeleteMessage && (
            <button
              type="button"
              aria-label="Remover mensagem"
              onClick={() => onDeleteMessage(message)}
              className={cn(
                actionButtonClass,
                'text-xs font-bold hover:border-status-error hover:text-status-error',
              )}
            >
              ×
            </button>
          )}
        </div>
      )}

      <div className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            'text-[10px] font-bold uppercase tracking-wide',
            isClient ? 'text-muted-foreground' : 'text-accent-foreground/70',
          )}
        >
          {isClient ? 'Cliente' : 'Eu'}
        </span>
        <span
          className={cn(
            'text-[10px] font-bold uppercase tracking-wide',
            isClient ? 'text-muted-foreground/70' : 'text-accent-foreground/60',
          )}
        >
          {STAGE_LABELS[message.stage]}
        </span>
        <span
          className={cn(
            'ml-auto text-[10px] font-bold uppercase tracking-wide',
            isClient ? 'text-muted-foreground/70' : 'text-accent-foreground/60',
          )}
        >
          {formatMessageTimestamp(message.createdAt)}
        </span>
      </div>

      {editing ? (
        <>
          <textarea
            ref={textareaRef}
            value={draftText}
            rows={1}
            onChange={(event) => handleDraftChange(event.target.value)}
            className={cn(
              'block w-full resize-none overflow-hidden bg-transparent p-0',
              textContentClass,
              'border-0 shadow-none outline-none',
              'focus:border-0 focus:shadow-none focus:outline-none focus:ring-0',
              'focus-visible:border-0 focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0',
              isClient ? 'text-foreground' : 'text-accent-foreground',
            )}
          />
          <div className="mt-2 flex justify-end gap-1.5">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className={cn(
                editActionBaseClass,
                isClient
                  ? 'border-2 border-border bg-muted/40 text-foreground hover:border-foreground/40 hover:bg-muted hover:text-foreground'
                  : 'border-2 border-accent-foreground/50 bg-accent-foreground/10 text-accent-foreground hover:border-accent-foreground hover:bg-accent-foreground/25 hover:text-accent-foreground',
              )}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={cn(
                editActionBaseClass,
                isClient
                  ? 'border-2 border-accent bg-accent text-accent-foreground hover:bg-accent/90'
                  : 'border-2 border-background bg-background text-foreground hover:bg-foreground hover:text-background',
              )}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </>
      ) : (
        <p className={textContentClass}>{message.text}</p>
      )}
    </div>
  )
}

export function MessageThread({ conversationId, messages, onDeleteMessage }: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = scrollRef.current
    if (!container || messages.length === 0) {
      return
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    container.scrollTo({
      top: container.scrollHeight,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div
        className={cn(
          threadContainerClass,
          'flex items-center justify-center border-dashed p-12',
        )}
      >
        <p className="max-w-sm text-center text-base normal-case leading-relaxed text-muted-foreground">
          Nenhuma mensagem ainda. Gere a abordagem inicial no painel de ações.
        </p>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className={cn(threadContainerClass, 'flex flex-col gap-5')}>
      {messages.map((message) => {
        const isClient = message.sender === 'cliente'

        return (
          <motion.div
            key={message.id}
            variants={staggerItem}
            initial="hidden"
            animate="visible"
            className={`flex ${isClient ? 'justify-start' : 'justify-end'}`}
          >
            <MessageBubble
              conversationId={conversationId}
              message={message}
              onDeleteMessage={onDeleteMessage}
            />
          </motion.div>
        )
      })}
    </div>
  )
}

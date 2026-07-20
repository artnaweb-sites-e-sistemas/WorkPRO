import { useEffect, useId, useRef, useState } from 'react'
import { useAlert } from '../context/ConfirmContext'
import { updateConversationStatus } from '../services/conversations'
import type { ConversationStatus, Stage } from '../types/models'
import { cn } from '../lib/cn'
import { badgeBaseClassName } from './ui/Badge'

const OPTIONS: { value: ConversationStatus; label: string }[] = [
  { value: 'ativo', label: 'Ativa' },
  { value: 'fechado', label: 'Fechada' },
  { value: 'perdido', label: 'Perdida' },
]

const STATUS_LABELS: Record<ConversationStatus, string> = {
  ativo: 'Ativa',
  fechado: 'Fechada',
  perdido: 'Perdida',
}

const TRIGGER_VARIANTS: Record<ConversationStatus, string> = {
  ativo: 'border-accent bg-accent text-accent-foreground',
  fechado: 'border-status-success bg-status-success text-black',
  perdido: 'border-status-error bg-status-error text-white',
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={cn('h-3 w-3 shrink-0 transition-transform duration-150', open && 'rotate-180')}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

interface StatusDropdownProps {
  conversationId: string
  status: ConversationStatus
  stage: Stage
  previousStage: Stage | null
  className?: string
}

export function StatusDropdown({
  conversationId,
  status,
  stage,
  previousStage,
  className,
}: StatusDropdownProps) {
  const [open, setOpen] = useState(false)
  const [updating, setUpdating] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const alert = useAlert()

  useEffect(() => {
    if (!open) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  async function handleSelect(next: ConversationStatus) {
    setOpen(false)

    if (next === status || updating) {
      return
    }

    setUpdating(true)

    try {
      await updateConversationStatus(
        conversationId,
        { status, stage, previousStage },
        next,
      )
    } catch {
      await alert({
        title: 'Erro',
        message: 'Não foi possível atualizar o status.',
      })
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        data-status-trigger
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={updating}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
        className={cn(
          badgeBaseClassName,
          'cursor-pointer gap-1 transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-60',
          TRIGGER_VARIANTS[status],
        )}
      >
        {STATUS_LABELS[status]}
        <ChevronIcon open={open} />
      </button>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Status da conversa"
          className="absolute right-0 top-full z-30 mt-1 min-w-[9rem] border-2 border-border bg-surface py-1"
        >
          {OPTIONS.map((option) => {
            const isSelected = option.value === status

            return (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={(event) => {
                    event.stopPropagation()
                    void handleSelect(option.value)
                  }}
                  className={cn(
                    'flex w-full items-center px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide transition-colors duration-150',
                    isSelected
                      ? TRIGGER_VARIANTS[option.value]
                      : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
                  )}
                >
                  {option.label}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

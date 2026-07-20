import { useState } from 'react'
import { useAlert } from '../context/ConfirmContext'
import { updateConversationStatus } from '../services/conversations'
import type { ConversationStatus, Stage } from '../types/models'
import { cn } from '../lib/cn'
import { badgeBaseClassName } from './ui/Badge'

const OPTIONS: { value: ConversationStatus; label: string }[] = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'fechado', label: 'Fechado' },
  { value: 'perdido', label: 'Perdido' },
]

const SELECTED_VARIANTS: Record<ConversationStatus, string> = {
  ativo: 'border-accent bg-accent text-accent-foreground',
  fechado: 'border-status-success bg-status-success text-black',
  perdido: 'border-status-error bg-status-error text-white',
}

interface StatusSelectorProps {
  conversationId: string
  status: ConversationStatus
  stage: Stage
  previousStage: Stage | null
}

export function StatusSelector({
  conversationId,
  status,
  stage,
  previousStage,
}: StatusSelectorProps) {
  const [updating, setUpdating] = useState(false)
  const alert = useAlert()

  async function handleSelect(next: ConversationStatus) {
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
    <div role="radiogroup" aria-label="Status da conversa" className="flex flex-wrap items-center gap-2">
      {OPTIONS.map((option) => {
        const isSelected = status === option.value

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={updating}
            onClick={() => handleSelect(option.value)}
            className={cn(
              badgeBaseClassName,
              'cursor-pointer transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              'disabled:cursor-not-allowed disabled:opacity-60',
              isSelected
                ? SELECTED_VARIANTS[option.value]
                : 'border-border bg-transparent text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

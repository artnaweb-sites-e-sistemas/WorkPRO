import { useState } from 'react'
import { Link } from 'react-router-dom'
import { StageBadge } from './StageBadge'
import { ChannelBadge } from './ChannelBadge'
import { StatusDropdown } from './StatusDropdown'
import type { Conversation } from '../types/models'
import { formatRelativeTime } from '../lib/formatRelativeTime'
import { cn } from '../lib/cn'

function CopyIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

interface ConversationCardProps {
  conversation: Conversation
}

export function ConversationCard({ conversation }: ConversationCardProps) {
  const [copied, setCopied] = useState(false)
  const conversationPath = `/conversa/${conversation.id}`
  const displayClientName = conversation.clientName.trim() || conversation.projectTitle
  const showProjectTitle = Boolean(conversation.clientName.trim())
  const isClosed = conversation.status === 'fechado'
  const isActive = conversation.status === 'ativo'

  async function handleCopyProjectTitle(event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()

    if (!conversation.projectTitle.trim()) {
      return
    }

    try {
      await navigator.clipboard.writeText(conversation.projectTitle)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable — ignore silently
    }
  }

  return (
    <div
      className={cn(
        'group border-2 bg-surface transition-colors duration-300',
        isClosed
          ? 'border-status-success bg-status-success/5 hover:bg-status-success/10 group-hover:[&_[data-status-trigger]]:border-black'
          : isActive
            ? 'border-border hover:bg-accent/10 group-hover:[&_[data-status-trigger]]:border-black'
            : 'border-border hover:bg-status-error/10 group-hover:[&_[data-status-trigger]]:border-black',
      )}
    >
      <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <Link
            to={conversationPath}
            className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <p className="text-base font-bold uppercase tracking-tight text-foreground transition-colors duration-300">
              {displayClientName}
            </p>
          </Link>

          <div className="mt-1 flex min-w-0 items-center gap-1.5">
            {conversation.projectTitle.trim() && (
              <button
                type="button"
                aria-label={copied ? 'Nome do projeto copiado' : 'Copiar nome do projeto'}
                onClick={(event) => void handleCopyProjectTitle(event)}
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center transition-colors duration-300',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  copied ? 'text-status-success' : 'text-muted-foreground',
                )}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </button>
            )}

            <Link
              to={conversationPath}
              className="min-w-0 flex-1 truncate text-sm normal-case text-muted-foreground transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {showProjectTitle ? conversation.projectTitle : 'Sem nome'}
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end [&_[data-badge-tag]]:transition-colors [&_[data-badge-tag]]:duration-300">
          <ChannelBadge channel={conversation.channel} />
          <StageBadge stage={conversation.stage} />
          <StatusDropdown
            conversationId={conversation.id}
            status={conversation.status}
            stage={conversation.stage}
            previousStage={conversation.previousStage}
          />
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors duration-300">
            {formatRelativeTime(conversation.updatedAt)}
          </span>
        </div>
      </div>
    </div>
  )
}

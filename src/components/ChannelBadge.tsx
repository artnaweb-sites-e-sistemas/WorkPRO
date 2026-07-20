import type { ConversationChannel } from '../types/models'
import { cn } from '../lib/cn'

function BriefcaseIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  )
}

function ChatBubbleIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  )
}

interface ChannelBadgeProps {
  channel: ConversationChannel
  className?: string
}

/** Estilo discreto: borda sutil, fundo transparente, texto muted. A cor do canal fica só no ícone. */
const channelBadgeClassName =
  'inline-flex items-center gap-1 border border-border bg-transparent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground'

export function ChannelBadge({ channel, className }: ChannelBadgeProps) {
  const isWhatsApp = channel === 'whatsapp'

  return (
    <span className={cn(channelBadgeClassName, className)}>
      <span className={isWhatsApp ? 'text-status-success' : 'text-accent/70'}>
        {isWhatsApp ? <ChatBubbleIcon /> : <BriefcaseIcon />}
      </span>
      {isWhatsApp ? 'WhatsApp' : 'Workana'}
    </span>
  )
}

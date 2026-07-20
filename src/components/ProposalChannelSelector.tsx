import type { ProposalChannel } from '../types/proposal'
import { cn } from '../lib/cn'

interface ProposalChannelSelectorProps {
  value: ProposalChannel
  onChange: (channel: ProposalChannel) => void
  disabled?: boolean
  className?: string
  ariaLabel?: string
}

const CHANNELS: { id: ProposalChannel; label: string }[] = [
  { id: 'workana', label: 'Workana' },
  { id: 'whatsapp', label: 'WhatsApp' },
]

export function ProposalChannelSelector({
  value,
  onChange,
  disabled = false,
  className,
  ariaLabel = 'Canal da proposta',
}: ProposalChannelSelectorProps) {
  return (
    <div
      className={cn(
        'inline-flex h-8 shrink-0 self-center rounded border border-border bg-surface-2 p-px',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
      role="group"
      aria-label={ariaLabel}
    >
      {CHANNELS.map((channel) => {
        const isSelected = value === channel.id

        return (
          <button
            key={channel.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(channel.id)}
            className={cn(
              'h-full rounded-[3px] px-2 text-[10px] font-bold uppercase tracking-wide transition-colors',
              isSelected
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {channel.label}
          </button>
        )
      })}
    </div>
  )
}

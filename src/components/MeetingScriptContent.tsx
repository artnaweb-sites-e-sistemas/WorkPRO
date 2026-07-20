import { useMemo } from 'react'
import type { ConversationChannel } from '../types/models'
import { resolveMeetingScriptDocument } from '../lib/meetingScript'
import type { MeetingScriptDocument } from '../types/meetingScript'
import { cn } from '../lib/cn'

interface MeetingScriptContentProps {
  document: MeetingScriptDocument
  suggestedPrice: string | null | undefined
  suggestedRecurringPrice?: string | null | undefined
  isRecurring: boolean
  channel?: ConversationChannel
  className?: string
}

export function MeetingScriptContent({
  document,
  suggestedPrice,
  suggestedRecurringPrice,
  isRecurring,
  channel = 'workana',
  className,
}: MeetingScriptContentProps) {
  const resolved = useMemo(
    () =>
      resolveMeetingScriptDocument(
        document,
        suggestedPrice,
        suggestedRecurringPrice,
        isRecurring,
        channel,
      ),
    [channel, document, isRecurring, suggestedPrice, suggestedRecurringPrice],
  )

  return (
    <div className={cn('space-y-6 text-sm normal-case leading-relaxed', className)}>
      {resolved.sections.map((section, sectionIndex) => (
        <section key={`${section.title}-${sectionIndex}`}>
          <h3 className="text-xs font-bold uppercase tracking-wide text-foreground">
            {section.title}
          </h3>
          <div className="mt-3 space-y-4">
            {section.blocks.map((block, blockIndex) => (
              <p
                key={`${sectionIndex}-${blockIndex}`}
                className="whitespace-pre-wrap break-words leading-relaxed"
              >
                {block.runs.map((run, runIndex) => (
                  <span
                    key={`${sectionIndex}-${blockIndex}-${runIndex}`}
                    className={run.personalized ? 'text-accent' : 'text-foreground'}
                  >
                    {run.text}
                  </span>
                ))}
              </p>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

import { isOverdue, quickSlots, spokenWhen } from '../lib/callbackTime'

/** Mini calendário do retorno: data e hora, com atalhos para os horários mais comuns. */
export function CallbackPicker({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  const overdue = value ? isOverdue(value) : false
  return (
    <div className="grid gap-2">
      <input
        id={id}
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-border bg-surface-2 px-3 py-2.5 text-base tabular-nums text-foreground focus:border-accent focus:outline-none"
        style={{ colorScheme: 'dark' }}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {quickSlots().map((slot) => (
          <button
            key={slot.label}
            type="button"
            onClick={() => onChange(slot.value)}
            aria-pressed={value === slot.value}
            className="whitespace-nowrap underline decoration-[color:var(--rt-rule)] underline-offset-4 transition-colors hover:text-foreground"
            style={{ color: value === slot.value ? 'var(--rt-ink)' : 'var(--rt-muted)' }}
          >
            {slot.label}
          </button>
        ))}
        {value ? (
          <span className="ml-auto text-xs" style={{ color: overdue ? 'var(--c3-fg)' : 'var(--rt-faint)' }}>
            {overdue ? 'Horário já passou' : `Na fala: ${spokenWhen(value)}`}
          </span>
        ) : null}
      </div>
    </div>
  )
}

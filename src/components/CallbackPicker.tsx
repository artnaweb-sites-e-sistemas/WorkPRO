import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  displayWhen,
  isOverdue,
  quickSlots,
  spokenWhen,
  toLocalDateTimeInput,
} from '../lib/callbackTime'

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
const MINUTES = [0, 30]

function parseValue(value: string): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function buildMonthCells(month: Date): (Date | null)[] {
  const first = startOfMonth(month)
  const startPad = first.getDay()
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < startPad; i += 1) cells.push(null)
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function withTime(day: Date, hours: number, minutes: number): string {
  const next = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes, 0, 0)
  return toLocalDateTimeInput(next)
}

function hourChip(h: number, m: number): string {
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

/**
 * Seletor de data/hora no padrão do Cold Call (dd/mm/aaaa · Hh).
 * Valor interno continua AAAA-MM-DDTHH:mm (mesmo do antigo datetime-local).
 */
export function CallbackPicker({
  id,
  value,
  onChange,
  compact,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  /** lateral estreita: painel abre alinhado à esquerda e um pouco mais compacto */
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const selected = parseValue(value)
  const [cursor, setCursor] = useState(() => startOfMonth(selected ?? new Date()))
  const [draftDay, setDraftDay] = useState<Date | null>(selected)
  const [draftHour, setDraftHour] = useState(selected?.getHours() ?? 14)
  const [draftMinute, setDraftMinute] = useState(selected && selected.getMinutes() >= 30 ? 30 : 0)

  useEffect(() => {
    if (!open) return
    const parsed = parseValue(value)
    setCursor(startOfMonth(parsed ?? new Date()))
    setDraftDay(parsed)
    setDraftHour(parsed?.getHours() ?? 14)
    setDraftMinute(parsed && parsed.getMinutes() >= 30 ? 30 : 0)
  }, [open, value])

  useEffect(() => {
    if (!open) return

    function onPointer(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const cells = useMemo(() => buildMonthCells(cursor), [cursor])
  const overdue = value ? isOverdue(value) : false
  const today = new Date()
  const monthLabel = cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase())

  function commit(day: Date, hours: number, minutes: number) {
    onChange(withTime(day, hours, minutes))
    setOpen(false)
  }

  function pickDay(day: Date) {
    setDraftDay(day)
    commit(day, draftHour, draftMinute)
  }

  function pickHour(hours: number, minutes: number) {
    setDraftHour(hours)
    setDraftMinute(minutes)
    if (draftDay) commit(draftDay, hours, minutes)
  }

  return (
    <div ref={containerRef} className="relative grid min-w-0 gap-2">
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full min-w-0 items-center justify-between gap-3 rounded-md border border-border bg-surface-2 px-3 py-2.5 text-left transition-colors hover:border-accent/50 focus:border-accent focus:outline-none"
      >
        <span className="min-w-0">
          {value ? (
            <>
              <span className="block truncate text-base tabular-nums text-foreground">{displayWhen(value)}</span>
              <span className="mt-0.5 block truncate text-xs" style={{ color: overdue ? 'var(--c3-fg)' : 'var(--rt-faint)' }}>
                {overdue ? 'Horário já passou' : `Na fala: ${spokenWhen(value)}`}
              </span>
            </>
          ) : (
            <span className="text-base" style={{ color: 'var(--rt-faint)' }}>
              dd/mm/aaaa · horário
            </span>
          )}
        </span>
        <CalendarIcon />
      </button>

      {open ? (
        <div
          id={listboxId}
          role="dialog"
          aria-label="Escolher data e hora"
          className={`absolute z-40 mt-1.5 overflow-hidden rounded-lg border border-border bg-surface shadow-xl shadow-black/50 ${
            compact ? 'left-0 right-0 w-full' : 'left-0 w-[min(100%,20.5rem)]'
          }`}
        >
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5" style={{ borderColor: 'var(--rt-rule)' }}>
            <button
              type="button"
              aria-label="Mês anterior"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <Chevron dir="left" />
            </button>
            <p className="text-sm font-semibold capitalize text-foreground">{monthLabel}</p>
            <button
              type="button"
              aria-label="Próximo mês"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <Chevron dir="right" />
            </button>
          </div>

          <div className="px-3 pt-3">
            <div className="mb-1.5 grid grid-cols-7 gap-0.5">
              {WEEKDAYS.map((label, index) => (
                <span key={`${label}-${index}`} className="py-1 text-center text-[10px] font-semibold uppercase" style={{ color: 'var(--rt-faint)' }}>
                  {label}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((day, index) => {
                if (!day) return <span key={`e-${index}`} />
                const isSelected = draftDay ? sameDay(day, draftDay) : false
                const isToday = sameDay(day, today)
                const past =
                  new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime() <
                  new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => pickDay(day)}
                    className={`flex h-8 items-center justify-center rounded-md text-sm tabular-nums transition-colors ${
                      isSelected
                        ? 'bg-accent font-semibold text-accent-foreground'
                        : isToday
                          ? 'bg-accent/15 font-semibold text-foreground hover:bg-accent/25'
                          : past
                            ? 'text-muted-foreground/50 hover:bg-surface-2 hover:text-foreground'
                            : 'text-foreground hover:bg-surface-2'
                    }`}
                  >
                    {day.getDate()}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-3 border-t px-3 py-3" style={{ borderColor: 'var(--rt-rule)' }}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--rt-faint)' }}>
              Horário
            </p>
            <div className="grid max-h-28 grid-cols-4 gap-1.5 overflow-y-auto pr-0.5">
              {HOURS.flatMap((hour) =>
                MINUTES.map((minute) => {
                  const active = draftHour === hour && draftMinute === minute
                  const label = hourChip(hour, minute)
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => pickHour(hour, minute)}
                      className={`rounded-md border px-1.5 py-1.5 text-xs tabular-nums transition-colors ${
                        active
                          ? 'border-accent bg-accent text-accent-foreground'
                          : 'border-border text-foreground hover:border-accent/40 hover:bg-surface-2'
                      }`}
                    >
                      {label}
                    </button>
                  )
                }),
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 border-t px-3 py-2.5" style={{ borderColor: 'var(--rt-rule)' }}>
            {quickSlots().map((slot) => (
              <button
                key={slot.label}
                type="button"
                onClick={() => {
                  onChange(slot.value)
                  setOpen(false)
                }}
                className="text-xs underline decoration-[color:var(--rt-rule)] underline-offset-4 transition-colors hover:text-foreground"
                style={{ color: value === slot.value ? 'var(--rt-ink)' : 'var(--rt-muted)' }}
              >
                {slot.label}
              </button>
            ))}
            {value ? (
              <button
                type="button"
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
                className="ml-auto text-xs underline decoration-[color:var(--rt-rule)] underline-offset-4 transition-colors hover:text-foreground"
                style={{ color: 'var(--rt-faint)' }}
              >
                Limpar
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d={dir === 'left' ? 'M10 3.5 5.5 8 10 12.5' : 'M6 3.5 10.5 8 6 12.5'}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

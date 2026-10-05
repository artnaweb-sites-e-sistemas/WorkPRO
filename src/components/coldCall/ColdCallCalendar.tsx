import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  WEEKDAY_FULL,
  WEEKDAY_LABELS,
  addDays,
  agendaEventTitle,
  buildDaySlots,
  carveBlocks,
  dateToHm,
  formatWeekRange,
  mergeWeeklyWindow,
  newBlockId,
  sameDay,
  startOfWeek,
  toLocalInput,
  type AttendWindow,
  type CalendarMeeting,
  type ColdCallCalendarSettings,
  type WeeklyWindow,
} from '../../lib/coldCallCalendar'
import { spokenWhen } from '../../lib/callbackTime'
import { getColdCallCalendarSettings, saveColdCallCalendarSettings } from '../../services/coldCallCalendar'
import type { ColdCall } from '../../types/coldCall'
import { companyKeyOf } from '../../types/coldCall'

const MEETING_MINUTES = 30
const SLOT_ROW_H = 52

type GridSelection = {
  dayMin: number
  dayMax: number
  rowMin: number
  rowMax: number
}

type ActionMenu = {
  x: number
  y: number
  selection: GridSelection
}

function pilotoIdForCall(call: ColdCall, pilotosByCompany: Map<string, string>): string | null {
  const linked = (call.notes.pilotoId ?? '').trim()
  if (linked) return linked
  const key = companyKeyOf(call.notes.empresa ?? '')
  return key ? pilotosByCompany.get(key) ?? null : null
}

function meetingsFromCalls(calls: ColdCall[]): CalendarMeeting[] {
  return calls
    .filter((item) => item.outcome === 'agendou')
    .map((item) => {
      const raw = (item.notes.reuniaoAt ?? '').trim()
      if (!raw) return null
      const start = new Date(raw)
      if (Number.isNaN(start.getTime())) return null
      return {
        id: item.id,
        start,
        end: new Date(start.getTime() + MEETING_MINUTES * 60_000),
        company: (item.notes.empresa ?? '').trim() || 'Sem nome',
        responsavel: (item.notes.responsavel ?? '').trim(),
        whatsapp: (item.notes.whatsapp ?? '').trim(),
        notes: item.notes,
      } satisfies CalendarMeeting
    })
    .filter((item): item is CalendarMeeting => item != null)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
}

function rowToDate(day: Date, row: number, settings: ColdCallCalendarSettings): Date {
  const slotsPerHour = 60 / settings.slotMinutes
  const hour = settings.dayStartHour + Math.floor(row / slotsPerHour)
  const minute = (row % slotsPerHour) * settings.slotMinutes
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute)
}

function normalizeSelection(day: number, row: number, anchor: { day: number; row: number }): GridSelection {
  return {
    dayMin: Math.min(anchor.day, day),
    dayMax: Math.max(anchor.day, day),
    rowMin: Math.min(anchor.row, row),
    rowMax: Math.max(anchor.row, row),
  }
}

function cellInSelection(dayIndex: number, row: number, selection: GridSelection | null): boolean {
  if (!selection) return false
  return (
    dayIndex >= selection.dayMin &&
    dayIndex <= selection.dayMax &&
    row >= selection.rowMin &&
    row <= selection.rowMax
  )
}

function windowsForDay(day: WeeklyWindow['day'], windows: AttendWindow[]): WeeklyWindow[] {
  return windows
    .filter((window) => window.start < window.end)
    .map((window) => ({ day, start: window.start, end: window.end }))
}

function padHm(n: number): string {
  return String(n).padStart(2, '0')
}

function timeOptions(fromHour: number, toHour: number): string[] {
  const out: string[] = []
  for (let h = fromHour; h <= toHour; h++) {
    out.push(`${padHm(h)}:00`)
    if (h < toHour) out.push(`${padHm(h)}:30`)
  }
  return out
}

export function ColdCallCalendar({
  calls,
  pilotosByCompany,
  onOpenCall,
  onOpenPresentation,
  onCreatePresentation,
}: {
  calls: ColdCall[]
  pilotosByCompany: Map<string, string>
  onOpenCall: (call: ColdCall) => void
  onOpenPresentation: (pilotoId: string) => void
  onCreatePresentation: (call: ColdCall) => void
}) {
  const [settings, setSettings] = useState<ColdCallCalendarSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [weekAnchor, setWeekAnchor] = useState(() => new Date())
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null)
  const [panel, setPanel] = useState<'none' | 'hours'>('none')
  const [copiedSlot, setCopiedSlot] = useState('')
  const [selection, setSelection] = useState<GridSelection | null>(null)
  const [actionMenu, setActionMenu] = useState<ActionMenu | null>(null)

  const dragging = useRef(false)
  const dragAnchor = useRef<{ day: number; row: number } | null>(null)
  const selectionRef = useRef<GridSelection | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  function setGridSelection(next: GridSelection | null) {
    selectionRef.current = next
    setSelection(next)
  }

  const weekStart = useMemo(() => startOfWeek(weekAnchor), [weekAnchor])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const meetings = useMemo(() => meetingsFromCalls(calls), [calls])
  const weekMeetings = useMemo(() => {
    const from = weekStart.getTime()
    const to = addDays(weekStart, 7).getTime()
    return meetings.filter((item) => item.start.getTime() >= from && item.start.getTime() < to)
  }, [meetings, weekStart])

  useEffect(() => {
    let cancelled = false
    void getColdCallCalendarSettings().then((next) => {
      if (!cancelled) setSettings(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function persist(next: ColdCallCalendarSettings) {
    setSettings(next)
    setSaving(true)
    try {
      await saveColdCallCalendarSettings(next)
    } catch (error) {
      console.error('[ColdCallCalendar]', error)
    } finally {
      setSaving(false)
    }
  }

  function toggleWeekday(day: WeeklyWindow['day']) {
    if (!settings) return
    const has = settings.weeklyHours.some((window) => window.day === day)
    const weeklyHours = has
      ? settings.weeklyHours.filter((window) => window.day !== day)
      : [...settings.weeklyHours, ...windowsForDay(day, settings.defaultWindows)]
    void persist({ ...settings, weeklyHours })
  }

  function updateDefaultWindow(index: number, patch: Partial<AttendWindow>) {
    if (!settings) return
    const defaultWindows = settings.defaultWindows.map((window, i) => (i === index ? { ...window, ...patch } : window))
    void persist({ ...settings, defaultWindows })
  }

  function addDefaultWindow() {
    if (!settings) return
    void persist({
      ...settings,
      defaultWindows: [...settings.defaultWindows, { start: '10:00', end: '11:00' }],
    })
  }

  function removeDefaultWindow(index: number) {
    if (!settings || settings.defaultWindows.length <= 1) return
    void persist({
      ...settings,
      defaultWindows: settings.defaultWindows.filter((_, i) => i !== index),
    })
  }

  /** Reaplica as janelas padrão em todos os dias já ligados. */
  function applyDefaultsToActiveDays() {
    if (!settings) return
    const activeDays = [...new Set(settings.weeklyHours.map((window) => window.day))]
    const weeklyHours = activeDays.flatMap((day) => windowsForDay(day, settings.defaultWindows))
    void persist({ ...settings, weeklyHours })
  }

  const applyBlock = useCallback(
    (sel: GridSelection) => {
      if (!settings) return
      const blocks = [...settings.blocks]
      for (let dayIndex = sel.dayMin; dayIndex <= sel.dayMax; dayIndex++) {
        const day = days[dayIndex]
        const start = rowToDate(day, sel.rowMin, settings)
        const end = rowToDate(day, sel.rowMax + 1, settings)
        blocks.push({
          id: newBlockId(),
          start: toLocalInput(start),
          end: toLocalInput(end),
          label: 'Bloqueado',
        })
      }
      void persist({ ...settings, blocks })
    },
    [days, settings],
  )

  const applyLiberate = useCallback(
    (sel: GridSelection) => {
      if (!settings) return
      const startHm = dateToHm(rowToDate(days[0], sel.rowMin, settings))
      const endHm = dateToHm(rowToDate(days[0], sel.rowMax + 1, settings))
      let weeklyHours = settings.weeklyHours
      let blocks = settings.blocks
      for (let dayIndex = sel.dayMin; dayIndex <= sel.dayMax; dayIndex++) {
        const day = days[dayIndex]
        const weekday = day.getDay() as WeeklyWindow['day']
        const rangeStart = rowToDate(day, sel.rowMin, settings)
        const rangeEnd = rowToDate(day, sel.rowMax + 1, settings)
        // Só libera o intervalo selecionado neste dia.
        weeklyHours = mergeWeeklyWindow(weeklyHours, weekday, startHm, endHm)
        blocks = carveBlocks(blocks, rangeStart, rangeEnd)
      }
      void persist({ ...settings, weeklyHours, blocks })
    },
    [days, settings],
  )

  async function copyFreeSlot(start: Date) {
    const value = toLocalInput(start)
    const spoken = spokenWhen(value)
    const text = spoken || value
    try {
      await navigator.clipboard.writeText(text)
      setCopiedSlot(value)
      window.setTimeout(() => setCopiedSlot(''), 1600)
    } catch {
      /* ignore */
    }
  }

  function closeActionMenu() {
    setActionMenu(null)
    setGridSelection(null)
  }

  const finishDrag = useCallback((clientX: number, clientY: number) => {
    if (!dragging.current) return
    const current = selectionRef.current
    dragging.current = false
    dragAnchor.current = null
    if (!current) {
      setGridSelection(null)
      return
    }
    // Clique simples ou arraste: menu para o intervalo selecionado.
    setActionMenu({ x: clientX, y: clientY, selection: current })
  }, [])

  useEffect(() => {
    function onMouseUp(event: MouseEvent) {
      if (!dragging.current) return
      finishDrag(event.clientX, event.clientY)
    }
    document.addEventListener('mouseup', onMouseUp)
    return () => document.removeEventListener('mouseup', onMouseUp)
  }, [finishDrag])

  useEffect(() => {
    if (!actionMenu) return
    function onPointerDown(event: MouseEvent) {
      if (menuRef.current?.contains(event.target as Node)) return
      setActionMenu(null)
      setGridSelection(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [actionMenu])

  function onCellMouseDown(dayIndex: number, row: number, event: React.MouseEvent) {
    if (event.button !== 0) return
    event.preventDefault()
    setActionMenu(null)
    dragging.current = true
    dragAnchor.current = { day: dayIndex, row }
    setGridSelection(normalizeSelection(dayIndex, row, { day: dayIndex, row }))
  }

  function onCellMouseEnter(dayIndex: number, row: number) {
    if (!dragging.current || !dragAnchor.current) return
    setGridSelection(normalizeSelection(dayIndex, row, dragAnchor.current))
  }

  const selectedMeeting = weekMeetings.find((item) => item.id === selectedMeetingId) ?? null
  const selectedCall = selectedMeeting ? calls.find((item) => item.id === selectedMeeting.id) : null
  const today = new Date()

  if (!settings) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-16 text-center text-sm" style={{ color: 'var(--rt-faint)' }}>
        Carregando agenda…
      </div>
    )
  }

  const slotsPerHour = 60 / settings.slotMinutes
  const totalRows = (settings.dayEndHour - settings.dayStartHour) * slotsPerHour
  const bodyHeight = totalRows * SLOT_ROW_H
  const hmOptions = timeOptions(settings.dayStartHour, settings.dayEndHour)

  return (
    <div className="mx-auto max-w-6xl px-6 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-5" style={{ borderColor: 'var(--rt-rule)' }}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--rt-faint)' }}>
            Agenda
          </p>
          <h1 className="mt-1 text-[28px] font-bold leading-tight text-foreground">Sua semana comercial</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs tabular-nums" style={{ color: saving ? 'var(--rt-muted)' : 'var(--rt-faint)' }}>
            {saving ? 'Salvando…' : 'Sincronizado'}
          </span>
          <button
            type="button"
            onClick={() => setPanel((current) => (current === 'hours' ? 'none' : 'hours'))}
            className={`rounded-md border px-3 py-2 text-sm transition-colors ${
              panel === 'hours' ? 'border-accent bg-accent/15 text-foreground' : 'border-border text-foreground hover:bg-surface-2'
            }`}
          >
            Horários de atendimento
          </button>
        </div>
      </header>

      {panel === 'hours' ? (
        <section className="mt-5 rounded-lg border border-border bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Quando você atende</h2>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              Slot
              <select
                value={settings.slotMinutes}
                onChange={(event) => void persist({ ...settings, slotMinutes: Number(event.target.value) })}
                className="rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
                style={{ colorScheme: 'dark' }}
              >
                {[20, 30, 45, 60].map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} min
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--rt-faint)' }}>
              Dias
            </p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_FULL.map((label, day) => {
                const active = settings.weeklyHours.some((window) => window.day === day)
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleWeekday(day as WeeklyWindow['day'])}
                    className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                      active
                        ? 'border-white/20 bg-white/[0.08] text-foreground'
                        : 'border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                    }`}
                  >
                    {label.slice(0, 3)}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--rt-faint)' }}>
                Faixas de atendimento
              </p>
              <button
                type="button"
                onClick={applyDefaultsToActiveDays}
                className="text-xs underline decoration-[color:var(--rt-rule)] underline-offset-4 transition-colors hover:text-foreground"
                style={{ color: 'var(--rt-muted)' }}
              >
                Aplicar nos dias ligados
              </button>
            </div>
            <div className="space-y-2">
              {settings.defaultWindows.map((window, index) => (
                <div key={index} className="flex flex-wrap items-center gap-2">
                  <select
                    value={window.start}
                    onChange={(event) => updateDefaultWindow(index, { start: event.target.value })}
                    className="rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-sm tabular-nums focus:border-accent focus:outline-none"
                    style={{ colorScheme: 'dark' }}
                  >
                    {hmOptions.map((value) => (
                      <option key={`s-${value}`} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm" style={{ color: 'var(--rt-faint)' }}>
                    até
                  </span>
                  <select
                    value={window.end}
                    onChange={(event) => updateDefaultWindow(index, { end: event.target.value })}
                    className="rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-sm tabular-nums focus:border-accent focus:outline-none"
                    style={{ colorScheme: 'dark' }}
                  >
                    {hmOptions.map((value) => (
                      <option key={`e-${value}`} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                  {settings.defaultWindows.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeDefaultWindow(index)}
                      className="rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                    >
                      Remover
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addDefaultWindow}
              className="mt-2 text-xs font-medium text-foreground/80 underline decoration-[color:var(--rt-rule)] underline-offset-4 hover:text-foreground"
            >
              + Outra faixa
            </button>
          </div>
        </section>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 overflow-hidden rounded-md border border-border bg-surface">
          <button
            type="button"
            aria-label="Semana anterior"
            onClick={() => setWeekAnchor(addDays(weekStart, -7))}
            className="flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <Chevron dir="left" />
          </button>
          <button
            type="button"
            onClick={() => setWeekAnchor(new Date())}
            className="h-9 border-x border-border px-3 text-sm text-foreground transition-colors hover:bg-surface-2"
          >
            Hoje
          </button>
          <button
            type="button"
            aria-label="Próxima semana"
            onClick={() => setWeekAnchor(addDays(weekStart, 7))}
            className="flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <Chevron dir="right" />
          </button>
        </div>
        <p className="text-sm font-medium tabular-nums text-foreground">{formatWeekRange(weekStart)}</p>
        <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: 'var(--rt-muted)' }}>
          <Legend kind="free" label="Livre" />
          <Legend kind="busy" label="Reunião" />
          <Legend kind="blocked" label="Indisponível" />
          <span className="tabular-nums">{weekMeetings.length} esta semana</span>
        </div>
      </div>

      <div className="relative mt-4 overflow-x-auto rounded-xl border border-border bg-surface shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="min-w-[720px] select-none">
          <div
            className="grid border-b"
            style={{
              gridTemplateColumns: `3.25rem repeat(7, minmax(0, 1fr))`,
              borderColor: 'var(--rt-rule)',
            }}
          >
            <div className="border-r" style={{ borderColor: 'var(--rt-rule)' }} />
            {days.map((day) => {
              const isToday = sameDay(day, today)
              return (
                <div
                  key={day.toISOString()}
                  className="border-r px-2 py-3 text-center last:border-r-0"
                  style={{ borderColor: 'var(--rt-rule)', background: isToday ? 'rgb(var(--color-accent-rgb) / 0.08)' : undefined }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: isToday ? 'var(--rt-ink)' : 'var(--rt-faint)' }}>
                    {WEEKDAY_LABELS[day.getDay()]}
                  </p>
                  <p className={`mt-0.5 text-lg font-semibold tabular-nums ${isToday ? 'text-accent' : 'text-foreground'}`}>
                    {day.getDate()}
                  </p>
                </div>
              )
            })}
          </div>

          <div
            className="grid"
            style={{
              gridTemplateColumns: `3.25rem repeat(7, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${totalRows}, ${SLOT_ROW_H}px)`,
              height: bodyHeight,
            }}
          >
            {Array.from({ length: totalRows }, (_, row) => {
              const hour = settings.dayStartHour + Math.floor(row / slotsPerHour)
              const showLabel = row % slotsPerHour === 0
              return (
                <div
                  key={`time-${row}`}
                  className="relative border-b border-r pr-1.5 text-right text-[10px] tabular-nums"
                  style={{ gridColumn: 1, gridRow: row + 1, borderColor: 'var(--rt-rule)', color: 'var(--rt-faint)' }}
                >
                  {showLabel ? <span className="absolute -top-2 right-1.5">{hour}h</span> : null}
                </div>
              )
            })}

            {days.map((day, dayIndex) => {
              const slots = buildDaySlots(day, settings, weekMeetings)
              const dayMeetings = weekMeetings.filter((meeting) => sameDay(meeting.start, day))
              return (
                <div
                  key={day.toISOString()}
                  className="relative border-r last:border-r-0"
                  style={{ gridColumn: dayIndex + 2, gridRow: `1 / ${totalRows + 1}`, borderColor: 'var(--rt-rule)' }}
                >
                  <div className="absolute inset-0 grid" style={{ gridTemplateRows: `repeat(${totalRows}, ${SLOT_ROW_H}px)` }}>
                    {slots.map((slot, row) => {
                      const key = slot.start.toISOString()
                      const selected = cellInSelection(dayIndex, row, selection)
                      const copied = copiedSlot === toLocalInput(slot.start)
                      const visual = slot.kind === 'outside' || slot.kind === 'blocked' ? 'blocked' : slot.kind

                      return (
                        <div
                          key={key}
                          role="button"
                          tabIndex={-1}
                          title={
                            visual === 'free'
                              ? 'Arraste para selecionar · clique para copiar'
                              : slot.block?.label || 'Indisponível'
                          }
                          onMouseDown={(event) => onCellMouseDown(dayIndex, row, event)}
                          onMouseEnter={() => onCellMouseEnter(dayIndex, row)}
                          className={`relative flex items-center justify-center border-b cursor-cell transition-colors ${
                            selected ? 'z-[1] ring-1 ring-inset ring-accent/50' : ''
                          }`}
                          style={{
                            gridRow: row + 1,
                            borderColor: 'var(--rt-rule)',
                            background: slotBackground(visual, selected, copied),
                          }}
                        >
                          {visual === 'free' && !selected ? (
                            <IconCheck className={`h-3.5 w-3.5 ${copied ? 'text-emerald-300/90' : 'text-emerald-400/55'}`} />
                          ) : null}
                          {visual === 'blocked' && !selected ? (
                            <IconBan className="h-3.5 w-3.5 text-rose-400/40" />
                          ) : null}
                        </div>
                      )
                    })}
                  </div>

                  {dayMeetings.map((meeting) => {
                    const call = calls.find((item) => item.id === meeting.id)
                    const pilotoId = call ? pilotoIdForCall(call, pilotosByCompany) : null
                    const span = Math.max(1, Math.round(MEETING_MINUTES / settings.slotMinutes))
                    const top = (minutesSinceStart(meeting.start, settings) / settings.slotMinutes) * SLOT_ROW_H
                    const height = span * SLOT_ROW_H - 6
                    return (
                      <div
                        key={meeting.id}
                        className="absolute inset-x-1.5 z-10 overflow-hidden rounded-md border border-accent/40 bg-accent/[0.12]"
                        style={{ top: top + 3, height }}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedMeetingId(meeting.id)}
                          className="flex w-full items-start gap-1.5 px-2 py-1.5 text-left transition-colors hover:bg-accent/10"
                        >
                          <IconCalendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent opacity-80" />
                          <span className="min-w-0">
                            <p className="truncate text-xs font-semibold text-foreground">{meeting.company}</p>
                            <p className="truncate text-[11px] tabular-nums" style={{ color: 'var(--rt-muted)' }}>
                              {padTime(meeting.start)}
                              {meeting.responsavel ? ` · ${meeting.responsavel}` : ''}
                            </p>
                          </span>
                        </button>
                        <div className="border-t border-accent/20 px-2 py-1">
                          {pilotoId ? (
                            <button
                              type="button"
                              onClick={() => onOpenPresentation(pilotoId)}
                              className="w-full rounded bg-accent px-2 py-1 text-[11px] font-semibold text-accent-foreground transition-colors hover:brightness-110"
                            >
                              Apresentação
                            </button>
                          ) : call ? (
                            <button
                              type="button"
                              onClick={() => onCreatePresentation(call)}
                              className="w-full rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-foreground transition-colors hover:bg-surface-2"
                            >
                              Criar apresentação
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>

        {actionMenu ? (
          <div
            ref={menuRef}
            className="fixed z-50 min-w-[200px] overflow-hidden rounded-lg border border-border bg-surface shadow-xl"
            style={{ left: actionMenu.x, top: actionMenu.y, transform: 'translate(-50%, 8px)' }}
          >
            <p className="border-b border-border px-3 py-2 text-xs font-semibold text-foreground">O que fazer?</p>
            {(() => {
              const sel = actionMenu.selection
              const single =
                sel.dayMin === sel.dayMax && sel.rowMin === sel.rowMax && settings != null
              const slotStart = single ? rowToDate(days[sel.dayMin], sel.rowMin, settings) : null
              const slot =
                single && settings
                  ? buildDaySlots(days[sel.dayMin], settings, weekMeetings)[sel.rowMin]
                  : null
              return slot?.kind === 'free' && slotStart ? (
                <button
                  type="button"
                  onClick={() => {
                    void copyFreeSlot(slotStart)
                    closeActionMenu()
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-surface-2"
                >
                  <IconCheck className="h-4 w-4 text-emerald-400/80" />
                  Copiar horário
                </button>
              ) : null
            })()}
            <button
              type="button"
              onClick={() => {
                applyBlock(actionMenu.selection)
                closeActionMenu()
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-surface-2"
            >
              <IconBan className="h-4 w-4 text-rose-400/70" />
              Bloquear
            </button>
            <button
              type="button"
              onClick={() => {
                applyLiberate(actionMenu.selection)
                closeActionMenu()
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-surface-2"
            >
              <IconCheck className="h-4 w-4 text-emerald-400/80" />
              Liberar agenda
            </button>
          </div>
        ) : null}
      </div>

      {selectedMeeting && selectedCall ? (
        <aside className="mt-5 rounded-lg border border-border bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--c4-fg)' }}>
                Reunião
              </p>
              <h2 className="mt-1 truncate text-lg font-semibold text-foreground">{selectedMeeting.company}</h2>
              <p className="mt-1 text-sm text-foreground">
                {selectedMeeting.responsavel ? (
                  <>
                    Com <span className="font-semibold">{selectedMeeting.responsavel}</span>
                  </>
                ) : (
                  <span style={{ color: 'var(--rt-faint)' }}>Sem responsável anotado</span>
                )}
              </p>
              <p className="mt-1 text-sm tabular-nums" style={{ color: 'var(--rt-muted)' }}>
                {spokenWhen(toLocalInput(selectedMeeting.start))}
              </p>
              <p className="mt-2 text-sm text-foreground">{agendaEventTitle(selectedMeeting.notes)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(agendaEventTitle(selectedMeeting.notes))}
                className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-surface-2"
              >
                Copiar título
              </button>
              {(() => {
                const pilotoId = pilotoIdForCall(selectedCall, pilotosByCompany)
                return pilotoId ? (
                  <button
                    type="button"
                    onClick={() => onOpenPresentation(pilotoId)}
                    className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground transition-colors hover:brightness-110"
                  >
                    Apresentação
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onCreatePresentation(selectedCall)}
                    className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-2"
                  >
                    Criar apresentação
                  </button>
                )
              })()}
              <button
                type="button"
                onClick={() => onOpenCall(selectedCall)}
                className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-surface-2"
              >
                Abrir ligação
              </button>
              <button
                type="button"
                onClick={() => setSelectedMeetingId(null)}
                className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              >
                Fechar
              </button>
            </div>
          </div>
        </aside>
      ) : weekMeetings.length === 0 ? (
        <p className="mt-4 text-sm" style={{ color: 'var(--rt-faint)' }}>
          Nenhuma reunião com horário nesta semana.
        </p>
      ) : null}
    </div>
  )
}

function slotBackground(kind: 'free' | 'busy' | 'blocked', selected: boolean, copied: boolean): string {
  if (selected) return 'rgb(var(--color-accent-rgb) / 0.14)'
  if (copied) return 'rgb(52 211 153 / 0.22)'
  switch (kind) {
    case 'free':
      return 'rgb(52 211 153 / 0.09)'
    case 'busy':
      return 'rgb(var(--color-accent-rgb) / 0.06)'
    case 'blocked':
      return 'repeating-linear-gradient(-45deg, rgb(251 113 133 / 0.07), rgb(251 113 133 / 0.07) 5px, rgb(251 113 133 / 0.03) 5px, rgb(251 113 133 / 0.03) 10px)'
    default:
      return 'transparent'
  }
}

function minutesSinceStart(date: Date, settings: ColdCallCalendarSettings): number {
  return date.getHours() * 60 + date.getMinutes() - settings.dayStartHour * 60
}

function padTime(date: Date): string {
  const h = date.getHours()
  const m = date.getMinutes()
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
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

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3.5 8.2 6.4 11l6.1-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconBan({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="5.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4.3 4.3 11.7 11.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function Legend({ kind, label }: { kind: 'free' | 'busy' | 'blocked'; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="flex h-5 w-5 items-center justify-center rounded border"
        style={{
          borderColor:
            kind === 'busy'
              ? 'rgb(var(--color-accent-rgb) / 0.35)'
              : kind === 'blocked'
                ? 'rgb(251 113 133 / 0.3)'
                : 'rgb(52 211 153 / 0.3)',
          background:
            kind === 'busy'
              ? 'rgb(var(--color-accent-rgb) / 0.14)'
              : kind === 'blocked'
                ? 'rgb(251 113 133 / 0.1)'
                : 'rgb(52 211 153 / 0.1)',
        }}
      >
        {kind === 'free' ? <IconCheck className="h-3 w-3 text-emerald-400/80" /> : null}
        {kind === 'blocked' ? <IconBan className="h-3 w-3 text-rose-400/70" /> : null}
        {kind === 'busy' ? <IconCalendar className="h-3 w-3 text-accent" /> : null}
      </span>
      {label}
    </span>
  )
}

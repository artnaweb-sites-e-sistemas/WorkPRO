/**
 * Agenda do Cold Call: reuniões marcadas + janelas livres / bloqueadas.
 * Horários locais no formato datetime-local (AAAA-MM-DDTHH:mm).
 */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface WeeklyWindow {
  /** 0 = domingo … 6 = sábado */
  day: Weekday
  /** "09:00" */
  start: string
  /** "18:00" */
  end: string
}

export interface CalendarBlock {
  id: string
  start: string
  end: string
  label: string
}

export interface AttendWindow {
  start: string
  end: string
}

export interface ColdCallCalendarSettings {
  weeklyHours: WeeklyWindow[]
  blocks: CalendarBlock[]
  /** Janelas padrão ao ligar um dia da semana (ex.: manhã + tarde). */
  defaultWindows: AttendWindow[]
  /** duração padrão de um slot livre (minutos) */
  slotMinutes: number
  /** hora inicial / final da grade do dia */
  dayStartHour: number
  dayEndHour: number
}

export const DEFAULT_ATTEND_WINDOWS: AttendWindow[] = [
  { start: '09:00', end: '12:00' },
  { start: '14:00', end: '18:00' },
]

export const DEFAULT_CALENDAR_SETTINGS: ColdCallCalendarSettings = {
  weeklyHours: [
    { day: 1, start: '09:00', end: '12:00' },
    { day: 1, start: '14:00', end: '18:00' },
    { day: 2, start: '09:00', end: '12:00' },
    { day: 2, start: '14:00', end: '18:00' },
    { day: 3, start: '09:00', end: '12:00' },
    { day: 3, start: '14:00', end: '18:00' },
    { day: 4, start: '09:00', end: '12:00' },
    { day: 4, start: '14:00', end: '18:00' },
    { day: 5, start: '09:00', end: '12:00' },
    { day: 5, start: '14:00', end: '18:00' },
  ],
  blocks: [],
  defaultWindows: [...DEFAULT_ATTEND_WINDOWS],
  slotMinutes: 30,
  dayStartHour: 8,
  dayEndHour: 20,
}

export const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const
export const WEEKDAY_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function toLocalInput(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

export function parseLocalInput(value: string): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function startOfWeek(anchor: Date): Date {
  const date = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
  const day = date.getDay()
  // Semana começa na segunda
  const offset = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + offset)
  date.setHours(0, 0, 0, 0)
  return date
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

function parseHm(hm: string): number {
  const [h, m] = hm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
}

/** Título padrão para a agenda do vendedor (copiar e colar no Google Calendar / Outlook). */
export function agendaEventTitle(notes: Record<string, string>): string {
  const empresa = (notes.empresa ?? '').trim() || 'Empresa'
  const responsavel = (notes.responsavel ?? '').trim()
  const reuniao = (notes.reuniao ?? '').trim()
  const parts = ['Piloto 45', empresa]
  if (responsavel) parts.push(responsavel)
  if (reuniao) parts.push(reuniao)
  return parts.join(' — ')
}

export type SlotKind = 'free' | 'busy' | 'blocked' | 'outside'

export interface CalendarMeeting {
  id: string
  start: Date
  end: Date
  company: string
  responsavel: string
  whatsapp: string
  notes: Record<string, string>
}

export interface DaySlot {
  start: Date
  end: Date
  kind: SlotKind
  meeting?: CalendarMeeting
  block?: CalendarBlock
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

export function isWithinWeeklyHours(date: Date, settings: ColdCallCalendarSettings): boolean {
  const day = date.getDay() as Weekday
  const minute = minutesOfDay(date)
  return settings.weeklyHours.some((window) => {
    if (window.day !== day) return false
    const start = parseHm(window.start)
    const end = parseHm(window.end)
    return minute >= start && minute < end
  })
}

export function findBlockAt(date: Date, settings: ColdCallCalendarSettings): CalendarBlock | undefined {
  const ms = date.getTime()
  return settings.blocks.find((block) => {
    const start = parseLocalInput(block.start)?.getTime()
    const end = parseLocalInput(block.end)?.getTime()
    return start != null && end != null && ms >= start && ms < end
  })
}

export function meetingAt(date: Date, meetings: CalendarMeeting[], durationMs: number): CalendarMeeting | undefined {
  const ms = date.getTime()
  return meetings.find((meeting) => ms >= meeting.start.getTime() && ms < meeting.start.getTime() + durationMs)
}

/** Grade de slots de um dia (para a coluna da semana). */
export function buildDaySlots(
  day: Date,
  settings: ColdCallCalendarSettings,
  meetings: CalendarMeeting[],
): DaySlot[] {
  const slots: DaySlot[] = []
  const step = Math.max(15, settings.slotMinutes)
  const startMin = settings.dayStartHour * 60
  const endMin = settings.dayEndHour * 60

  for (let minute = startMin; minute < endMin; minute += step) {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minute / 60), minute % 60)
    const end = new Date(start.getTime() + step * 60_000)
    const meeting = meetings.find((item) =>
      overlaps(start.getTime(), end.getTime(), item.start.getTime(), item.end.getTime()),
    )
    if (meeting) {
      // Só o primeiro slot que toca a reunião carrega o evento (evita duplicar o card).
      const isHead = start.getTime() <= meeting.start.getTime() && end.getTime() > meeting.start.getTime()
      slots.push({
        start,
        end,
        kind: 'busy',
        meeting: isHead ? meeting : undefined,
      })
      continue
    }

    const block = findBlockAt(start, settings)
    if (block) {
      slots.push({ start, end, kind: 'blocked', block })
      continue
    }

    if (!isWithinWeeklyHours(start, settings)) {
      slots.push({ start, end, kind: 'outside' })
      continue
    }

    slots.push({ start, end, kind: 'free' })
  }

  return slots
}

export function formatWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 6)
  const sameMonth = weekStart.getMonth() === end.getMonth()
  const startLabel = weekStart.toLocaleDateString('pt-BR', { day: 'numeric', month: sameMonth ? undefined : 'short' })
  const endLabel = end.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${startLabel} – ${endLabel}`
}

export function newBlockId(): string {
  return `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export function dateToHm(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/**
 * Remove o intervalo [rangeStart, rangeEnd) dos bloqueios.
 * Bloqueios maiores são fatiados — só a seleção some.
 */
export function carveBlocks(
  blocks: CalendarBlock[],
  rangeStart: Date,
  rangeEnd: Date,
): CalendarBlock[] {
  const from = rangeStart.getTime()
  const to = rangeEnd.getTime()
  if (!(to > from)) return blocks

  const next: CalendarBlock[] = []
  for (const block of blocks) {
    const blockStart = parseLocalInput(block.start)?.getTime()
    const blockEnd = parseLocalInput(block.end)?.getTime()
    if (blockStart == null || blockEnd == null) {
      next.push(block)
      continue
    }
    // Sem sobreposição
    if (blockEnd <= from || blockStart >= to) {
      next.push(block)
      continue
    }
    // Trecho à esquerda do intervalo liberado
    if (blockStart < from) {
      next.push({
        ...block,
        id: newBlockId(),
        end: toLocalInput(new Date(from)),
      })
    }
    // Trecho à direita do intervalo liberado
    if (blockEnd > to) {
      next.push({
        ...block,
        id: newBlockId(),
        start: toLocalInput(new Date(to)),
      })
    }
  }
  return next
}

/** Une janelas sobrepostas ou adjacentes no mesmo dia. */
export function mergeWeeklyWindow(
  windows: WeeklyWindow[],
  day: Weekday,
  start: string,
  end: string,
): WeeklyWindow[] {
  const startMin = parseHm(start)
  const endMin = parseHm(end)
  if (endMin <= startMin) return windows

  const sameDay = windows.filter((window) => window.day === day)
  const otherDays = windows.filter((window) => window.day !== day)
  const merged = [{ day, start, end }, ...sameDay]
    .map((window) => ({ day: window.day, start: parseHm(window.start), end: parseHm(window.end) }))
    .sort((a, b) => a.start - b.start)

  const out: { day: Weekday; start: number; end: number }[] = []
  for (const window of merged) {
    const last = out[out.length - 1]
    if (!last || window.start > last.end) {
      out.push({ day, start: window.start, end: window.end })
    } else {
      last.end = Math.max(last.end, window.end)
    }
  }

  return [
    ...otherDays,
    ...out.map((window) => ({
      day: window.day,
      start: `${pad2(Math.floor(window.start / 60))}:${pad2(window.start % 60)}`,
      end: `${pad2(Math.floor(window.end / 60))}:${pad2(window.end % 60)}`,
    })),
  ]
}

export function normalizeCalendarSettings(data: Partial<ColdCallCalendarSettings> | null | undefined): ColdCallCalendarSettings {
  const base = DEFAULT_CALENDAR_SETTINGS
  if (!data) {
    return {
      ...base,
      weeklyHours: [...base.weeklyHours],
      blocks: [],
      defaultWindows: base.defaultWindows.map((window) => ({ ...window })),
    }
  }

  const weeklyHours = Array.isArray(data.weeklyHours)
    ? data.weeklyHours
        .filter(
          (item): item is WeeklyWindow =>
            item != null &&
            typeof item.day === 'number' &&
            item.day >= 0 &&
            item.day <= 6 &&
            typeof item.start === 'string' &&
            typeof item.end === 'string',
        )
        .map((item) => ({ day: item.day as Weekday, start: item.start, end: item.end }))
    : [...base.weeklyHours]

  const blocks = Array.isArray(data.blocks)
    ? data.blocks
        .filter(
          (item): item is CalendarBlock =>
            item != null &&
            typeof item.id === 'string' &&
            typeof item.start === 'string' &&
            typeof item.end === 'string',
        )
        .map((item) => ({
          id: item.id,
          start: item.start,
          end: item.end,
          label: typeof item.label === 'string' ? item.label : 'Bloqueado',
        }))
    : []

  const defaultWindows = Array.isArray(data.defaultWindows)
    ? data.defaultWindows
        .filter(
          (item): item is AttendWindow =>
            item != null && typeof item.start === 'string' && typeof item.end === 'string' && item.start < item.end,
        )
        .map((item) => ({ start: item.start, end: item.end }))
    : base.defaultWindows.map((window) => ({ ...window }))

  return {
    weeklyHours,
    blocks,
    defaultWindows: defaultWindows.length ? defaultWindows : base.defaultWindows.map((window) => ({ ...window })),
    slotMinutes:
      typeof data.slotMinutes === 'number' && data.slotMinutes >= 15 && data.slotMinutes <= 120
        ? data.slotMinutes
        : base.slotMinutes,
    dayStartHour:
      typeof data.dayStartHour === 'number' && data.dayStartHour >= 0 && data.dayStartHour <= 12
        ? data.dayStartHour
        : base.dayStartHour,
    dayEndHour:
      typeof data.dayEndHour === 'number' && data.dayEndHour > 12 && data.dayEndHour <= 24
        ? data.dayEndHour
        : base.dayEndHour,
  }
}

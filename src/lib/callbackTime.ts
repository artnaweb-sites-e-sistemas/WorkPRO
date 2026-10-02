/**
 * Horário de retorno do Cold call. Guardado como "AAAA-MM-DDTHH:mm" (hora local, formato do
 * input datetime-local) e mostrado de dois jeitos: falado ("amanhã às 14h") e em lista ("01/10 14h").
 */

function parse(value: string): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function hourLabel(date: Date): string {
  const h = date.getHours()
  const m = date.getMinutes()
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

function dayDiff(date: Date, now = new Date()): number {
  const a = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((a - b) / 86400000)
}

/** Para a fala: "hoje às 17h", "amanhã às 9h30", "quinta às 14h", "dia 12/10 às 14h". */
export function spokenWhen(value: string): string {
  const date = parse(value)
  if (!date) return ''
  const diff = dayDiff(date)
  const hour = hourLabel(date)
  if (diff === 0) return `hoje às ${hour}`
  if (diff === 1) return `amanhã às ${hour}`
  if (diff > 1 && diff < 7) return `${date.toLocaleDateString('pt-BR', { weekday: 'long' }).replace('-feira', '')} às ${hour}`
  return `dia ${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${hour}`
}

function shortOf(date: Date): string {
  const diff = dayDiff(date)
  const hour = hourLabel(date)
  if (diff === 0) return `hoje ${hour}`
  if (diff === 1) return `amanhã ${hour}`
  if (diff === -1) return `ontem ${hour}`
  return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hour}`
}

/** Para listas: "hoje 17h", "amanhã 9h30", "12/10 14h". */
export function shortWhen(value: string): string {
  const date = parse(value)
  return date ? shortOf(date) : ''
}

/** O mesmo formato curto, a partir de um instante (ex.: a última tentativa). */
export function shortWhenMs(ms: number): string {
  return shortOf(new Date(ms))
}

/** Só a hora: "14h", "9h30". */
export function hourOf(value: string): string {
  const date = parse(value)
  return date ? hourLabel(date) : ''
}

/** 0 = hoje, 1 = amanhã, -1 = ontem; null sem data. */
export function daysFromToday(value: string): number | null {
  const date = parse(value)
  return date ? dayDiff(date) : null
}

export function isOverdue(value: string): boolean {
  const date = parse(value)
  return Boolean(date && date.getTime() < Date.now())
}

function toInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Atalhos: hoje no fim da tarde (se ainda der), amanhã de manhã e amanhã à tarde. */
export function quickSlots(now = new Date()): { label: string; value: string }[] {
  const at = (days: number, hour: number) => {
    const date = new Date(now)
    date.setDate(date.getDate() + days)
    date.setHours(hour, 0, 0, 0)
    return toInput(date)
  }
  const slots = [
    { label: 'Amanhã 9h', value: at(1, 9) },
    { label: 'Amanhã 14h', value: at(1, 14) },
  ]
  if (now.getHours() < 16) slots.unshift({ label: 'Hoje 17h', value: at(0, 17) })
  return slots
}

/**
 * Converte um rótulo de tempo (relativo ou absoluto) em data real.
 * Retorna `null` quando o rótulo não é reconhecível, para que o chamador
 * possa aplicar um fallback sequencial sem embaralhar a ordem.
 *
 * Formatos suportados:
 * - Relativo Workana: "há 2 dias", "há 3 h", "agora", "hoje", "ontem".
 * - Com horário: "ontem 14:03", "hoje 09:15".
 * - Absoluto brasileiro: "15:04, 06/07/2026", "06/07/2026 15:04", "06/07/2026".
 */
export function parseWorkanaRelativeTime(label: string, now = new Date()): Date | null {
  const normalized = label.trim().toLowerCase()

  if (!normalized) {
    return null
  }

  const time = matchTime(normalized)

  // Palavras-chave relativas com horário opcional têm prioridade sobre o parser
  // absoluto, para que "ontem 14:03" caia em ontem (e não em hoje).
  if (/^ontem\b/.test(normalized)) {
    const date = new Date(now)
    date.setDate(date.getDate() - 1)
    applyTime(date, time)
    return date
  }

  if (/^hoje\b/.test(normalized)) {
    const date = new Date(now)
    applyTime(date, time)
    return date
  }

  if (normalized === 'agora') {
    return new Date(now)
  }

  const absolute = matchDate(normalized)
  if (absolute) {
    const date = new Date(now)
    date.setFullYear(absolute.year, absolute.month, absolute.day)
    if (time) {
      applyTime(date, time)
    } else {
      date.setHours(0, 0, 0, 0)
    }
    return date
  }

  // Sem data mas com horário absoluto ("15:04") -> hoje nesse horário.
  if (time && !/há|atrás/.test(normalized)) {
    const date = new Date(now)
    applyTime(date, time)
    return date
  }

  const relative = normalized.match(
    /(?:há|ha)\s+(\d+)\s*(minuto|minutos|min|hora|horas|h|dia|dias|d|semana|semanas|sem|mes|meses|mês|ano|anos)/,
  )

  if (relative) {
    const amount = Number.parseInt(relative[1], 10)
    const unit = relative[2]
    const date = new Date(now)

    if (unit.startsWith('min')) {
      date.setMinutes(date.getMinutes() - amount)
    } else if (unit === 'h' || unit.startsWith('hora')) {
      date.setHours(date.getHours() - amount)
    } else if (unit === 'd' || unit.startsWith('dia')) {
      date.setDate(date.getDate() - amount)
    } else if (unit.startsWith('sem')) {
      date.setDate(date.getDate() - amount * 7)
    } else if (unit.startsWith('mes') || unit.startsWith('mês')) {
      date.setMonth(date.getMonth() - amount)
    } else if (unit.startsWith('ano')) {
      date.setFullYear(date.getFullYear() - amount)
    }

    return date
  }

  return null
}

interface TimeParts {
  hours: number
  minutes: number
}

function matchTime(normalized: string): TimeParts | null {
  const match = normalized.match(/(\d{1,2}):(\d{2})/)
  if (!match) {
    return null
  }

  const hours = Number.parseInt(match[1], 10)
  const minutes = Number.parseInt(match[2], 10)

  if (hours > 23 || minutes > 59) {
    return null
  }

  return { hours, minutes }
}

function matchDate(normalized: string): { day: number; month: number; year: number } | null {
  const match = normalized.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (!match) {
    return null
  }

  const day = Number.parseInt(match[1], 10)
  const month = Number.parseInt(match[2], 10) - 1
  let year = Number.parseInt(match[3], 10)

  if (year < 100) {
    year += 2000
  }

  if (day < 1 || day > 31 || month < 0 || month > 11) {
    return null
  }

  return { day, month, year }
}

function applyTime(date: Date, time: TimeParts | null): void {
  if (time) {
    date.setHours(time.hours, time.minutes, 0, 0)
  }
}

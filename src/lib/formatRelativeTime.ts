import type { Timestamp } from 'firebase/firestore'

export function formatRelativeTime(timestamp: Timestamp | undefined): string {
  if (!timestamp?.toDate) {
    return '—'
  }

  const date = timestamp.toDate()
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) {
    return 'agora'
  }
  if (diffMin < 60) {
    return `há ${diffMin}min`
  }
  if (diffHour < 24) {
    return `há ${diffHour}h`
  }
  if (diffDay < 7) {
    return `há ${diffDay}d`
  }

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
}

/**
 * Exibe a data/hora REAL da mensagem (não relativa). Mostra sempre o horário e
 * um rótulo de dia contextual: "hoje 15:18", "ontem 09:04", "06/07 15:18" (mesmo
 * ano) ou "06/07/2026 15:18" (ano diferente).
 */
export function formatMessageTimestamp(timestamp: Timestamp | undefined): string {
  if (!timestamp?.toDate) {
    return '—'
  }

  const date = timestamp.toDate()
  const now = new Date()

  const time = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()

  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)

  if (dayDiff === 0) {
    return `hoje ${time}`
  }
  if (dayDiff === 1) {
    return `ontem ${time}`
  }

  const sameYear = date.getFullYear() === now.getFullYear()
  const datePart = date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    ...(sameYear ? {} : { year: 'numeric' }),
  })

  return `${datePart} ${time}`
}

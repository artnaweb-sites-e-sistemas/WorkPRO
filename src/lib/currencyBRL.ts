const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

/** Formata centavos (inteiro) para "R$ 14.000,00". */
export function formatCurrencyBRL(cents: number): string {
  return brlFormatter.format(cents / 100)
}

/**
 * Extrai o valor em centavos a partir de strings variadas
 * ("14500.00", "R$ 14.500,00", "14.500", dígitos puros, etc.).
 */
export function parseCurrencyBRL(value: string): number {
  const trimmed = value.trim()
  if (!trimmed) {
    return 0
  }

  let normalized = trimmed.replace(/R\$\s?/gi, '').trim()

  if (normalized.includes(',')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.')
    const amount = Number.parseFloat(normalized)
    return Number.isFinite(amount) ? Math.round(amount * 100) : 0
  }

  if (normalized.includes('.')) {
    const parts = normalized.split('.')
    const lastPart = parts.at(-1) ?? ''

    if (parts.length === 2 && lastPart.length <= 2) {
      const amount = Number.parseFloat(normalized.replace(/[^\d.-]/g, ''))
      return Number.isFinite(amount) ? Math.round(amount * 100) : 0
    }

    const digits = normalized.replace(/\D/g, '')
    return digits ? Number.parseInt(digits, 10) * 100 : 0
  }

  const digits = normalized.replace(/\D/g, '')
  if (!digits) {
    return 0
  }

  return Number.parseInt(digits, 10) * 100
}

/** Normaliza qualquer representação para "R$ X.XXX,XX" ou string vazia. */
export function normalizeCurrencyBRL(value: string | null | undefined): string {
  if (!value?.trim()) {
    return ''
  }

  const cents = parseCurrencyBRL(value)
  if (cents === 0 && !value.replace(/\D/g, '')) {
    return ''
  }

  return formatCurrencyBRL(cents)
}

/** Máscara ao vivo: apenas dígitos, os 2 últimos são centavos (estilo banco). */
export function maskCurrencyBRLInput(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits === '') {
    return ''
  }

  return formatCurrencyBRL(Number.parseInt(digits, 10))
}

import { formatCurrencyBRL } from './currencyBRL'
import type {
  ProposalAiContent,
  ProposalContentDoc,
  ProposalExtraItem,
  ProposalFormInput,
  ProposalPageBreaks,
  RecurrenceStartTiming,
} from '../types/proposalDoc'
import { formatRecurrenceStartTiming, normalizePageBreaks } from '../types/proposalDoc'

function installmentChannelLabel(kind: 'boleto' | 'cartao' | null): string {
  return kind === 'cartao' ? 'no cartão de crédito' : 'no boleto'
}

function formatRecurrenceStartPhrase(timing: RecurrenceStartTiming): string {
  switch (timing) {
    case 'ato_contratacao':
      return 'a partir da contratação'
    case 'logo_apos_entrega':
      return 'a partir da entrega'
    case '30_dias_apos_entrega':
      return 'a partir de 30 dias após a entrega'
  }
}

export function buildPaymentNote(input: ProposalFormInput): string {
  const { amountCents, payment } = input
  const total = formatCurrencyBRL(amountCents)

  if (payment.method === 'avista') {
    return `${total} à vista, na contratação.`
  }

  if (payment.method === 'metade' || payment.method === 'metade_conclusao') {
    const first = Math.round(amountCents / 2)
    const second = amountCents - first
    const secondWhen =
      payment.method === 'metade_conclusao' ? 'após a conclusão' : 'em 30 dias'
    return `${formatCurrencyBRL(first)} na contratação e ${formatCurrencyBRL(second)} ${secondWhen}.`
  }

  const n = payment.installments ?? 3
  const parcela = Math.floor(amountCents / n)
  return `${n}x de ${formatCurrencyBRL(parcela)} ${installmentChannelLabel(payment.installmentKind)}.`
}

export function buildRecurrenceDetail(
  input: ProposalFormInput,
  ai: ProposalAiContent,
): { title: string; amountLine: string; description: string } | null {
  const { recurrence } = input
  if (!recurrence.enabled || recurrence.amountCents == null || !recurrence.startTiming) {
    return null
  }

  return {
    title: recurrence.title?.trim() || ai.recurringLabel,
    amountLine: `${formatCurrencyBRL(recurrence.amountCents)}/mês, ${formatRecurrenceStartPhrase(recurrence.startTiming)}.`,
    description: recurrence.description?.trim() || ai.recurringDescription?.trim() || '',
  }
}

/**
 * Passos de execução escritos pelo usuário: descarta linhas vazias (o editor permite
 * linhas em branco enquanto ele digita) sem impor limite de quantidade.
 */
function normalizeProjectSteps(steps: string[]): string[] {
  return steps.map((step) => step.trim()).filter(Boolean)
}

export function buildInvestmentRows(
  input: ProposalFormInput,
  ai: ProposalAiContent,
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [
    { label: ai.setupLabel, value: formatCurrencyBRL(input.amountCents) },
  ]

  if (input.recurrence.enabled && input.recurrence.amountCents != null) {
    const label = input.recurrence.title?.trim() || ai.recurringLabel
    rows.push({
      label,
      value: `${formatCurrencyBRL(input.recurrence.amountCents)} / mês`,
    })
  }

  return rows
}

export function buildNextSteps(input: ProposalFormInput, ai: ProposalAiContent): string[] {
  const { payment, recurrence } = input
  const n = payment.installments ?? 3

  let paymentStep: string
  if (payment.method === 'avista') {
    paymentStep = 'Pagamento integral no início do projeto'
  } else if (payment.method === 'metade' || payment.method === 'metade_conclusao') {
    paymentStep = 'Pagamento da 1ª parcela (50%)'
  } else {
    paymentStep = `Pagamento da 1ª de ${n} parcelas ${installmentChannelLabel(payment.installmentKind)}`
  }

  const projectSteps = normalizeProjectSteps(ai.projectSteps)
  const trailing: string[] = []

  if (payment.method === 'metade') {
    trailing.push('Pagamento da 2ª parcela (50%) em 30 dias')
  } else if (payment.method === 'metade_conclusao') {
    trailing.push('Pagamento da 2ª parcela (50%) após a conclusão')
  }

  if (recurrence.enabled && recurrence.startTiming) {
    trailing.push(
      `Início da recorrência mensal (${formatRecurrenceStartTiming(recurrence.startTiming).toLowerCase()})`,
    )
  }

  return [paymentStep, ...projectSteps, ...trailing]
}

export function buildProposalContent(
  input: ProposalFormInput,
  ai: ProposalAiContent,
  pageBreaks: ProposalPageBreaks = {},
): ProposalContentDoc {
  const normalized: ProposalAiContent = {
    ...ai,
    projectSteps: normalizeProjectSteps(ai.projectSteps),
  }

  return {
    ...normalized,
    investmentRows: buildInvestmentRows(input, normalized),
    paymentNote: buildPaymentNote(input),
    nextSteps: buildNextSteps(input, normalized),
    pageBreaks: normalizePageBreaks(pageBreaks),
  }
}

/** Frase de contexto para o prompt da IA (não vai para o PDF). */
export function describePaymentForAi(input: ProposalFormInput): string {
  return buildPaymentNote(input)
}

export function describeRecurrenceForAi(input: ProposalFormInput): string {
  const { recurrence } = input
  if (!recurrence.enabled || recurrence.amountCents == null || !recurrence.startTiming) {
    return 'desativada'
  }

  const service = recurrence.title?.trim()
  const amount = `${formatCurrencyBRL(recurrence.amountCents)} por mês ${formatRecurrenceStartPhrase(recurrence.startTiming)}`
  const head = service ? `${service}: ${amount}` : amount
  const description = recurrence.description?.trim()
  return description ? `${head}. ${description}` : head
}

/** Adicionais válidos para impressão: precisam de título; valor 0 vira "Sob consulta". */
export function resolveExtraItems(input: ProposalFormInput): ProposalExtraItem[] {
  if (!input.extras?.enabled) {
    return []
  }

  return input.extras.items
    .map((item) => ({
      title: item.title.trim(),
      amountCents: item.amountCents,
      source: item.source === 'ai' ? ('ai' as const) : ('manual' as const),
      recurring: item.recurring === true,
    }))
    .filter((item) => item.title.length > 0)
}

export function formatExtraValue(amountCents: number, recurring = false): string {
  if (amountCents <= 0) {
    return 'Sob consulta'
  }

  const amount = formatCurrencyBRL(amountCents)
  return recurring ? `${amount}/mês` : amount
}

/** Frase de contexto dos adicionais para o prompt da IA (não vai para o PDF). */
export function describeExtrasForAi(input: ProposalFormInput): string {
  const items = resolveExtraItems(input)
  if (items.length === 0) {
    return 'nenhum'
  }

  return items
    .map((item) => `${item.title} (${formatExtraValue(item.amountCents, item.recurring)})`)
    .join('; ')
}

export function formatValidityLabel(days: number): string {
  return days === 1 ? '1 dia' : `${days} dias`
}

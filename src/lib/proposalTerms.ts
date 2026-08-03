import { formatCurrencyBRL } from './currencyBRL'
import type {
  ProposalAiContent,
  ProposalContentDoc,
  ProposalFormInput,
  RecurrenceStartTiming,
} from '../types/proposalDoc'
import { formatRecurrenceStartTiming } from '../types/proposalDoc'

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
  const { amountCents, payment, recurrence } = input
  const total = formatCurrencyBRL(amountCents)

  let note: string

  if (payment.method === 'avista') {
    note = `${total} à vista, na contratação.`
  } else if (payment.method === 'metade') {
    const first = Math.round(amountCents / 2)
    const second = amountCents - first
    note = `${formatCurrencyBRL(first)} na contratação e ${formatCurrencyBRL(second)} em 30 dias.`
  } else {
    const n = payment.installments ?? 3
    const parcela = Math.floor(amountCents / n)
    note = `${n}x de ${formatCurrencyBRL(parcela)} ${installmentChannelLabel(payment.installmentKind)}.`
  }

  if (recurrence.enabled && recurrence.amountCents != null && recurrence.startTiming) {
    note += `\n${formatCurrencyBRL(recurrence.amountCents)}/mês, ${formatRecurrenceStartPhrase(recurrence.startTiming)}.`
  }

  return note
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
    rows.push({
      label: ai.recurringLabel,
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
  } else if (payment.method === 'metade') {
    paymentStep = 'Pagamento da 1ª parcela (50%)'
  } else {
    paymentStep = `Pagamento da 1ª de ${n} parcelas ${installmentChannelLabel(payment.installmentKind)}`
  }

  const projectSteps = normalizeProjectSteps(ai.projectSteps)
  const trailing: string[] = []

  if (payment.method === 'metade') {
    trailing.push('Pagamento da 2ª parcela (50%) na entrega')
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

  return `${formatCurrencyBRL(recurrence.amountCents)} por mês ${formatRecurrenceStartPhrase(recurrence.startTiming)}`
}

export function formatValidityLabel(days: number): string {
  return days === 1 ? '1 dia' : `${days} dias`
}

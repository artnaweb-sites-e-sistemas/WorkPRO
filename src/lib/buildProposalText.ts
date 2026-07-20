import type { ProposalChannel, ProposalContent } from '../types/proposal'
import { formatCurrencyBRL, parseCurrencyBRL } from './currencyBRL'
import { calculateWorkanaPricing, WORKANA_FEE } from './workanaFee'

const SEPARATOR = '------------------------------------------------------------'

export const WHATSAPP_PIX_KEY = 'nubank@artnaweb.com.br'

const WORKANA_PAYMENT =
  'FORMA DE PAGAMENTO: aqui pela Workana, você consegue pagar via Pix ou cartão parcelado.'

const WORKANA_NEXT_STEPS = [
  '1. Aceitar o projeto',
  '2. Realizar o pagamento',
  '3. Preencher nosso formulário de briefing',
  '4. Enviar os dados necessários para o início',
  '5. Aguardar o prazo previsto de entrega',
] as const

export interface BuildProposalTextInput {
  intro: string
  topics: string[]
  reassurance: string
  netReais: number
  recurringNetReais?: number | null
  isRecurring: boolean
  prazo: string
}

/** Usa suggestedPrice salvo na conversa quando existir; senão o netPrice da proposta gerada. */
export function resolveProposalNetReais(
  suggestedPrice: string | null | undefined,
  proposalContent: ProposalContent,
): number {
  if (suggestedPrice?.trim()) {
    const cents = parseCurrencyBRL(suggestedPrice)
    if (cents > 0) {
      return cents / 100
    }
  }

  return proposalContent.netPrice
}

export function resolveProposalRecurringNetReais(
  isRecurring: boolean,
  suggestedRecurringPrice: string | null | undefined,
  proposalContent: ProposalContent,
): number | null {
  if (!isRecurring) {
    return null
  }

  if (suggestedRecurringPrice?.trim()) {
    const cents = parseCurrencyBRL(suggestedRecurringPrice)
    if (cents > 0) {
      return cents / 100
    }
  }

  if (proposalContent.recurringNetPrice && proposalContent.recurringNetPrice > 0) {
    return proposalContent.recurringNetPrice
  }

  return null
}

function buildRecurringLine(
  isRecurring: boolean,
  recurringNetReais: number | null | undefined,
): string[] {
  if (!isRecurring || !recurringNetReais || recurringNetReais <= 0) {
    return []
  }

  return ['', `MANUTENÇÃO RECORRENTE: ${formatCurrencyBRL(Math.round(recurringNetReais * 100))}/mês`]
}

function buildTopicsBlock(topics: string[]): string {
  return topics.map((topic) => `• ${topic.trim()}`).join('\n')
}

function buildWorkanaProposalText(input: BuildProposalTextInput): string {
  const { netFmt, commissionFmt, totalFmt } = calculateWorkanaPricing(input.netReais)
  const feePercent = Math.round(WORKANA_FEE * 100)
  const topics =
    input.topics.length > 0 ? input.topics : ['Escopo conforme alinhado no projeto']

  return [
    input.intro.trim(),
    '',
    'O que está incluso no projeto:',
    '',
    buildTopicsBlock(topics),
    '',
    input.reassurance.trim(),
    '',
    SEPARATOR,
    '',
    `CUSTO DO SERVIÇO: ${netFmt}`,
    `COMISSÃO WORKANA (${feePercent}%): ${commissionFmt}`,
    '',
    `TOTAL: ${totalFmt}`,
    ...buildRecurringLine(input.isRecurring, input.recurringNetReais),
    '',
    `PRAZO: ${input.prazo.trim()}`,
    '',
    WORKANA_PAYMENT,
    '',
    'PRÓXIMOS PASSOS:',
    ...WORKANA_NEXT_STEPS,
    '',
    SEPARATOR,
  ].join('\n')
}

function formatInstallmentHalf(netReais: number): string {
  return formatCurrencyBRL(Math.round((netReais * 100) / 2))
}

function buildWhatsAppNextSteps(halfFmt: string): string[] {
  return [
    '1. Confirmar o projeto e o valor',
    `2. Realizar o Pix da 1ª parcela (50% - ${halfFmt})`,
    '3. Preencher nosso formulário de briefing',
    '4. Aguardar o desenvolvimento e a entrega no prazo',
    `5. Realizar o Pix da 2ª parcela (50% - ${halfFmt}) na entrega`,
  ]
}

function buildWhatsAppProposalText(input: BuildProposalTextInput): string {
  const { netFmt } = calculateWorkanaPricing(input.netReais)
  const halfFmt = formatInstallmentHalf(input.netReais)
  const topics =
    input.topics.length > 0 ? input.topics : ['Escopo conforme alinhado no projeto']

  return [
    input.intro.trim(),
    '',
    '*O que está incluso no projeto:*',
    '',
    buildTopicsBlock(topics),
    '',
    input.reassurance.trim(),
    '',
    SEPARATOR,
    '',
    `*Investimento:* ${netFmt}`,
    ...(input.isRecurring && input.recurringNetReais && input.recurringNetReais > 0
      ? [
          '',
          `*Manutenção recorrente:* ${formatCurrencyBRL(Math.round(input.recurringNetReais * 100))}/mês`,
        ]
      : []),
    '',
    `*Prazo:* ${input.prazo.trim()}`,
    '',
    `*Forma de pagamento:* 50% no ato (${halfFmt}) via Pix e 50% (${halfFmt}) após a entrega.`,
    '',
    `*Chave Pix:* ${WHATSAPP_PIX_KEY}`,
    '',
    '*Próximos passos:*',
    ...buildWhatsAppNextSteps(halfFmt),
    '',
    SEPARATOR,
  ].join('\n')
}

export function buildProposalText(
  input: BuildProposalTextInput,
  channel: ProposalChannel = 'workana',
): string {
  if (channel === 'whatsapp') {
    return buildWhatsAppProposalText(input)
  }

  return buildWorkanaProposalText(input)
}

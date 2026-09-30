export const DEFAULT_INSTALLMENT_FEE_RATE = 0.1506
export const INSTALLMENT_COUNT = 10

export type PilotoPlanId = 'meta' | 'google' | 'completo'

export interface PilotoPlan {
  id: PilotoPlanId
  name: string
  channels: string[]
  adBudgetCents: number
  totalCents: number
  highlighted: boolean
  pitch: string
}

type PilotoPlanTemplate = Omit<PilotoPlan, 'adBudgetCents' | 'totalCents'>

/** Ordem de exibição: o recomendado fica no centro. Valores vêm do orçamento do piloto. */
const PILOTO_PLAN_TEMPLATES: PilotoPlanTemplate[] = [
  {
    id: 'meta',
    name: 'Piloto Meta',
    channels: ['Meta Ads'],
    highlighted: false,
    pitch: 'Para testar vídeo e alcance no Instagram e no Facebook.',
  },
  {
    id: 'completo',
    name: 'Piloto Completo',
    channels: ['Meta Ads', 'Google Ads'],
    highlighted: true,
    pitch: 'Os dois canais lado a lado. O único que mostra onde vale investir.',
  },
  {
    id: 'google',
    name: 'Piloto Google',
    channels: ['Google Ads'],
    highlighted: false,
    pitch: 'Para capturar quem já está procurando o que você vende.',
  },
]

export type ContinuationPlanId = 'site' | 'site-whatsapp' | 'completo'

/** Orçamento de cada piloto: muda aqui, muda nos slides, no PDF e no roteiro. */
export interface PilotoPricing {
  /** agência sem desconto (o preço "de") */
  agencyListCents: number
  /** agência fechando na reunião */
  agencyDealCents: number
  adBudgetPerChannelCents: number
  /** mensalidade de cada plano de continuidade */
  continuationMonthlyCents: Record<ContinuationPlanId, number>
}

export const DEFAULT_PILOTO_PRICING: PilotoPricing = {
  agencyListCents: 500000,
  agencyDealCents: 300000,
  adBudgetPerChannelCents: 100000,
  continuationMonthlyCents: { site: 25000, 'site-whatsapp': 99700, completo: 300000 },
}

/** Zero é aceito: é o campo vazio enquanto ele digita outro valor. */
function centsOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : fallback
}

/** Piloto antigo (sem orçamento) ou campo inválido fica com o valor padrão. */
export function normalizePilotoPricing(raw: unknown): PilotoPricing {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const monthly =
    record.continuationMonthlyCents && typeof record.continuationMonthlyCents === 'object'
      ? (record.continuationMonthlyCents as Record<string, unknown>)
      : {}
  const defaults = DEFAULT_PILOTO_PRICING
  return {
    agencyListCents: centsOr(record.agencyListCents, defaults.agencyListCents),
    agencyDealCents: centsOr(record.agencyDealCents, defaults.agencyDealCents),
    adBudgetPerChannelCents: centsOr(record.adBudgetPerChannelCents, defaults.adBudgetPerChannelCents),
    continuationMonthlyCents: {
      site: centsOr(monthly.site, defaults.continuationMonthlyCents.site),
      'site-whatsapp': centsOr(monthly['site-whatsapp'], defaults.continuationMonthlyCents['site-whatsapp']),
      completo: centsOr(monthly.completo, defaults.continuationMonthlyCents.completo),
    },
  }
}

/** Planos com os valores do orçamento: agência + verba de cada canal. */
export function getPilotoPlans(pricing: PilotoPricing): PilotoPlan[] {
  return PILOTO_PLAN_TEMPLATES.map((plan) => {
    const adBudgetCents = pricing.adBudgetPerChannelCents * plan.channels.length
    return { ...plan, adBudgetCents, totalCents: pricing.agencyDealCents + adBudgetCents }
  })
}

/** Desconto de fechar na reunião; zero quando o preço "de" não é maior. */
export function dealSavingsCents(pricing: PilotoPricing): number {
  return Math.max(0, pricing.agencyListCents - pricing.agencyDealCents)
}

export interface InstallmentBreakdown {
  count: number
  feeRate: number
  installmentCents: number
  totalCents: number
}

export function calcInstallments(
  dealCents: number,
  feeRate: number,
  count = INSTALLMENT_COUNT,
): InstallmentBreakdown {
  if (!Number.isFinite(dealCents) || dealCents <= 0) {
    return { count, feeRate: 0, installmentCents: 0, totalCents: 0 }
  }

  const safeRate =
    Number.isFinite(feeRate) && feeRate < 1 ? feeRate : DEFAULT_INSTALLMENT_FEE_RATE
  const grossed = Math.round(dealCents / (1 - safeRate))
  const installmentCents = Math.round(grossed / count)
  const totalCents = installmentCents * count

  return {
    count,
    feeRate: safeRate,
    installmentCents,
    totalCents,
  }
}

/**
 * Continuidade depois do piloto. Não entra no preço da proposta: aparece só como
 * "a partir de" no dia 45 e, completa, no slide de apoio que fica depois do fechamento.
 */
export interface ContinuationPlan {
  id: ContinuationPlanId
  name: string
  includes: string[]
  monthlyCents: number
  note: string | null
  /** para quem esse plano faz sentido, em uma frase */
  fit: string
  highlighted: boolean
}

const CONTINUATION_PLAN_TEMPLATES: Omit<ContinuationPlan, 'monthlyCents'>[] = [
  {
    id: 'site',
    name: 'Site',
    includes: ['Página de vendas no ar', 'Hospedagem e manutenção'],
    note: null,
    fit: 'Para manter a página no ar e seguir recebendo contatos por ela.',
    highlighted: false,
  },
  {
    id: 'site-whatsapp',
    name: 'Site + WhatsApp',
    includes: ['Tudo do plano Site', 'WhatsApp com IA e gestão dos contatos'],
    note: null,
    fit: 'Para seguir atendendo com a IA e sem perder nenhum contato.',
    highlighted: false,
  },
  {
    id: 'completo',
    name: 'Completo',
    includes: ['Tudo do Site + WhatsApp', 'Gestão e otimização dos anúncios'],
    note: 'verba de anúncio à parte',
    fit: 'Para continuar crescendo com os anúncios que deram resultado.',
    highlighted: true,
  },
]

export function getContinuationPlans(pricing: PilotoPricing): ContinuationPlan[] {
  return CONTINUATION_PLAN_TEMPLATES.map((plan) => ({
    ...plan,
    monthlyCents: pricing.continuationMonthlyCents[plan.id],
  }))
}

export function continuationFromCents(pricing: PilotoPricing): number {
  return Math.min(...Object.values(pricing.continuationMonthlyCents))
}

export const DEFAULT_INSTALLMENT_FEE_RATE = 0.1506
export const INSTALLMENT_COUNT = 10

export type PilotoPlanId = 'meta' | 'google' | 'completo'

export interface PilotoPlan {
  id: PilotoPlanId
  name: string
  channels: string[]
  /** trabalho da agência neste plano: preço "de" e fechando na reunião */
  agencyListCents: number
  agencyDealCents: number
  adBudgetCents: number
  totalCents: number
  highlighted: boolean
  pitch: string
}

type PilotoPlanTemplate = Omit<PilotoPlan, 'agencyListCents' | 'agencyDealCents' | 'adBudgetCents' | 'totalCents'>

/** Ordem de exibição: escada do menor pro maior, com o recomendado (Completo) por último. Valores vêm do orçamento do piloto. */
const PILOTO_PLAN_TEMPLATES: PilotoPlanTemplate[] = [
  {
    id: 'meta',
    name: 'Piloto Instagram',
    channels: ['Meta Ads'],
    highlighted: false,
    pitch: 'Para testar vídeo e alcance no Instagram.',
  },
  {
    id: 'google',
    name: 'Piloto Google',
    channels: ['Google Ads'],
    highlighted: false,
    pitch: 'Para capturar quem já está procurando o que você vende.',
  },
  {
    id: 'completo',
    name: 'Piloto Completo',
    channels: ['Meta Ads', 'Google Ads'],
    highlighted: true,
    pitch: 'Os dois canais lado a lado. O único que mostra onde vale investir.',
  },
]

export type ContinuationPlanId = 'site' | 'site-whatsapp' | 'completo'

/** Orçamento de cada piloto: muda aqui, muda nos slides, no PDF e no roteiro. */
export interface PilotoPricing {
  /** agência sem desconto (o preço "de") nos planos de um canal */
  agencyListCents: number
  /** agência fechando na reunião nos planos de um canal */
  agencyDealCents: number
  /** agência no Completo (dois canais pra gerir): sem desconto e fechando na reunião */
  completoListCents: number
  completoDealCents: number
  adBudgetPerChannelCents: number
  /** mensalidade de cada plano de continuidade */
  continuationMonthlyCents: Record<ContinuationPlanId, number>
}

export const DEFAULT_PILOTO_PRICING: PilotoPricing = {
  agencyListCents: 500000,
  agencyDealCents: 300000,
  completoListCents: 600000,
  completoDealCents: 400000,
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
  const agencyListCents = centsOr(record.agencyListCents, defaults.agencyListCents)
  const agencyDealCents = centsOr(record.agencyDealCents, defaults.agencyDealCents)
  // Piloto de antes do preço próprio do Completo: R$ 1.000 a mais que o de um canal, mantendo o mesmo desconto.
  const completoGap = defaults.completoDealCents - defaults.agencyDealCents
  return {
    agencyListCents,
    agencyDealCents,
    completoListCents: centsOr(record.completoListCents, agencyListCents + completoGap),
    completoDealCents: centsOr(record.completoDealCents, agencyDealCents + completoGap),
    adBudgetPerChannelCents: centsOr(record.adBudgetPerChannelCents, defaults.adBudgetPerChannelCents),
    continuationMonthlyCents: {
      site: centsOr(monthly.site, defaults.continuationMonthlyCents.site),
      'site-whatsapp': centsOr(monthly['site-whatsapp'], defaults.continuationMonthlyCents['site-whatsapp']),
      completo: centsOr(monthly.completo, defaults.continuationMonthlyCents.completo),
    },
  }
}

/** Nome do canal como o dono do negócio fala. A apresentação fala só de Instagram e Google (o Facebook roda junto, sem ser citado). */
export function channelLabel(channel: string): string {
  if (channel === 'Meta Ads') return 'Instagram'
  if (channel === 'Google Ads') return 'Google'
  return channel
}

/** Planos com os valores do orçamento: agência do plano + verba de cada canal. */
export function getPilotoPlans(pricing: PilotoPricing): PilotoPlan[] {
  return PILOTO_PLAN_TEMPLATES.map((plan) => {
    const completo = plan.id === 'completo'
    const agencyListCents = completo ? pricing.completoListCents : pricing.agencyListCents
    const agencyDealCents = completo ? pricing.completoDealCents : pricing.agencyDealCents
    const adBudgetCents = pricing.adBudgetPerChannelCents * plan.channels.length
    return { ...plan, agencyListCents, agencyDealCents, adBudgetCents, totalCents: agencyDealCents + adBudgetCents }
  })
}

/** Desconto de fechar na reunião nos planos de um canal; zero quando o preço "de" não é maior. */
export function dealSavingsCents(pricing: PilotoPricing): number {
  return Math.max(0, pricing.agencyListCents - pricing.agencyDealCents)
}

/** Desconto de fechar na reunião no Completo. */
export function completoSavingsCents(pricing: PilotoPricing): number {
  return Math.max(0, pricing.completoListCents - pricing.completoDealCents)
}

/** Desconto de um plano: o que ele economiza fechando na reunião. */
export function planSavingsCents(plan: PilotoPlan): number {
  return Math.max(0, plan.agencyListCents - plan.agencyDealCents)
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
    includes: ['Tudo do plano Site', 'WhatsApp com automação e gestão dos contatos'],
    note: null,
    fit: 'Para seguir atendendo com a automação e sem perder nenhum contato.',
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

export const AGENCY_LIST_CENTS = 500000
export const AGENCY_DEAL_CENTS = 300000
export const AD_BUDGET_PER_CHANNEL_CENTS = 100000
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

/** Ordem de exibição: o recomendado fica no centro. */
export const PILOTO_PLANS: PilotoPlan[] = [
  {
    id: 'meta',
    name: 'Piloto Meta',
    channels: ['Meta Ads'],
    adBudgetCents: 100000,
    totalCents: 400000,
    highlighted: false,
    pitch: 'Para testar vídeo e alcance no Instagram e no Facebook.',
  },
  {
    id: 'completo',
    name: 'Piloto Completo',
    channels: ['Meta Ads', 'Google Ads'],
    adBudgetCents: 200000,
    totalCents: 500000,
    highlighted: true,
    pitch: 'Os dois canais lado a lado. O único que mostra onde vale investir.',
  },
  {
    id: 'google',
    name: 'Piloto Google',
    channels: ['Google Ads'],
    adBudgetCents: 100000,
    totalCents: 400000,
    highlighted: false,
    pitch: 'Para capturar quem já está procurando o que você vende.',
  },
]

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
  id: 'site' | 'site-whatsapp' | 'completo'
  name: string
  includes: string[]
  monthlyCents: number
  note: string | null
  /** para quem esse plano faz sentido, em uma frase */
  fit: string
  highlighted: boolean
}

export const CONTINUATION_PLANS: ContinuationPlan[] = [
  {
    id: 'site',
    name: 'Site',
    includes: ['Página de vendas no ar', 'Hospedagem e manutenção'],
    monthlyCents: 25000,
    note: null,
    fit: 'Para manter a página no ar e seguir recebendo contatos por ela.',
    highlighted: false,
  },
  {
    id: 'site-whatsapp',
    name: 'Site + WhatsApp',
    includes: ['Tudo do plano Site', 'WhatsApp com IA e gestão dos contatos'],
    monthlyCents: 99700,
    note: null,
    fit: 'Para seguir atendendo com a IA e sem perder nenhum contato.',
    highlighted: false,
  },
  {
    id: 'completo',
    name: 'Completo',
    includes: ['Tudo do Site + WhatsApp', 'Gestão e otimização dos anúncios'],
    monthlyCents: 300000,
    note: 'verba de anúncio à parte',
    fit: 'Para continuar crescendo com os anúncios que deram resultado.',
    highlighted: true,
  },
]

export const CONTINUATION_FROM_CENTS = Math.min(...CONTINUATION_PLANS.map((plan) => plan.monthlyCents))

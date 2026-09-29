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

export const PILOTO_PLANS: PilotoPlan[] = [
  {
    id: 'meta',
    name: 'Piloto Meta',
    channels: ['Meta Ads'],
    adBudgetCents: 100000,
    totalCents: 400000,
    highlighted: false,
    pitch: 'Testa um canal e valida o criativo em vídeo.',
  },
  {
    id: 'google',
    name: 'Piloto Google',
    channels: ['Google Ads'],
    adBudgetCents: 100000,
    totalCents: 400000,
    highlighted: false,
    pitch: 'Testa um canal e captura quem já está procurando.',
  },
  {
    id: 'completo',
    name: 'Piloto Completo',
    channels: ['Meta Ads', 'Google Ads'],
    adBudgetCents: 200000,
    totalCents: 500000,
    highlighted: true,
    pitch: 'O único que responde qual canal traz cliente mais barato.',
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

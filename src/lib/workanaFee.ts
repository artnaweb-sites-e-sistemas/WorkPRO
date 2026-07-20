import { formatCurrencyBRL } from './currencyBRL'

/** Taxa de comissão da Workana sobre o total (20% do total = comissão). */
export const WORKANA_FEE = 0.20

export interface WorkanaPricing {
  netReais: number
  totalReais: number
  commissionReais: number
  netFmt: string
  commissionFmt: string
  totalFmt: string
}

/** Calcula total e comissão a partir do valor líquido (net = o que o freelancer recebe). */
export function calculateWorkanaPricing(netReais: number): WorkanaPricing {
  const totalReais = netReais / (1 - WORKANA_FEE)
  const commissionReais = totalReais - netReais

  return {
    netReais,
    totalReais,
    commissionReais,
    netFmt: formatCurrencyBRL(Math.round(netReais * 100)),
    commissionFmt: formatCurrencyBRL(Math.round(commissionReais * 100)),
    totalFmt: formatCurrencyBRL(Math.round(totalReais * 100)),
  }
}

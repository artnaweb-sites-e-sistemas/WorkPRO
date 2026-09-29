import { AD_BUDGET_NOTE } from '../../lib/pilotoContent'
import { formatCurrencyBRL } from '../../lib/currencyBRL'
import {
  AGENCY_DEAL_CENTS,
  AGENCY_LIST_CENTS,
  PILOTO_PLANS,
  calcInstallments,
} from '../../lib/pilotoPricing'
import type { SlideProps } from './slideTypes'

export function SlideInvestimento({ input, accent }: SlideProps) {
  const installments = calcInstallments(AGENCY_DEAL_CENTS, input.installmentFeeRate)

  return (
    <div className="flex h-full w-full flex-col px-[64px] py-[48px] text-white">
      <div className="grid flex-1 grid-cols-3 gap-5">
        {PILOTO_PLANS.map((plan) => {
          const highlighted = plan.highlighted
          return (
            <div
              key={plan.id}
              className="relative flex flex-col p-6"
              style={
                highlighted
                  ? { border: `2px solid ${accent}` }
                  : { border: '1px solid #3F3F46' }
              }
            >
              {highlighted ? (
                <span className="mb-3 text-[13px] font-semibold" style={{ color: accent }}>
                  Recomendado
                </span>
              ) : (
                <span className="mb-3 text-[13px] font-semibold text-transparent">.</span>
              )}
              <p
                className={`text-[22px] font-semibold ${
                  highlighted ? 'text-white' : 'text-[#A1A1AA]'
                }`}
              >
                {plan.name}
              </p>
              <p className="mt-2 text-[15px] font-medium text-[#71717A]">
                {plan.channels.join(' · ')}
              </p>
              <p
                className={`mt-8 text-[44px] font-bold tabular-nums leading-none ${
                  highlighted ? 'text-white' : 'text-[#D4D4D8]'
                }`}
              >
                {formatCurrencyBRL(plan.totalCents)}
              </p>
              <p
                className={`mt-auto pt-8 text-[16px] font-medium leading-snug ${
                  highlighted ? 'text-[#E4E4E7]' : 'text-[#71717A]'
                }`}
              >
                {plan.pitch}
              </p>
            </div>
          )
        })}
      </div>

      <p className="mt-8 text-[18px] font-medium text-[#D4D4D8]">
        Agência{' '}
        <span className="line-through text-[#71717A]">{formatCurrencyBRL(AGENCY_LIST_CENTS)}</span>{' '}
        <span className="tabular-nums">{formatCurrencyBRL(AGENCY_DEAL_CENTS)}</span> na condição de
        fechamento · à vista no Pix ou 10x de{' '}
        <span className="tabular-nums">{formatCurrencyBRL(installments.installmentCents)}</span>
      </p>
      <p className="mt-3 text-[15px] font-medium text-[#71717A]">{AD_BUDGET_NOTE}</p>
    </div>
  )
}

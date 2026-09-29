import { AD_BUDGET_NOTE } from '../../lib/pilotoContent'
import {
  AD_BUDGET_PER_CHANNEL_CENTS,
  AGENCY_DEAL_CENTS,
  AGENCY_LIST_CENTS,
  PILOTO_PLANS,
  calcInstallments,
} from '../../lib/pilotoPricing'
import type { PilotoPlan } from '../../lib/pilotoPricing'
import { BODY, FAINT, INK, LightSlide, MUTED, RULE, brl, onAccent } from './deck'
import type { SlideProps } from './slideTypes'

function PlanCard({ plan, accent }: { plan: PilotoPlan; accent: string }) {
  const featured = plan.highlighted
  const text = featured ? '#FFFFFF' : INK
  const soft = featured ? 'rgba(255,255,255,0.62)' : MUTED
  const rule = featured ? 'rgba(255,255,255,0.14)' : '#EDEDEF'
  const rows = [
    { label: 'Agência', value: AGENCY_DEAL_CENTS },
    ...plan.channels.map((channel) => ({ label: `Verba ${channel}`, value: AD_BUDGET_PER_CHANNEL_CENTS })),
  ]

  return (
    <div
      className="relative flex flex-col px-7 pb-6 pt-7"
      style={featured ? { backgroundColor: INK, color: text } : { border: `1px solid ${RULE}`, color: text }}
    >
      {featured ? (
        <span
          className="absolute -top-3 left-7 px-2.5 py-1 text-[12px] font-bold"
          style={{ backgroundColor: accent, color: onAccent(accent) }}
        >
          Recomendado
        </span>
      ) : null}
      <p className="text-[22px] font-bold tracking-[-0.015em]">{plan.name}</p>
      <p className="mt-1 text-[14px] font-medium" style={{ color: soft }}>
        {plan.channels.join(' + ')}
      </p>

      <p className="mt-5 text-[44px] font-bold leading-none tracking-[-0.03em] tabular-nums">
        {brl(plan.totalCents)}
      </p>
      <p className="mt-2 text-[13px] font-medium" style={{ color: soft }}>
        investimento total no piloto
      </p>

      <div className="mt-4">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between border-t py-[7px] text-[14px] font-medium"
            style={{ borderColor: rule }}
          >
            <span style={{ color: soft }}>{row.label}</span>
            <span className="tabular-nums">{brl(row.value)}</span>
          </div>
        ))}
      </div>

      <p className="mt-auto pt-4 text-[15px] font-medium leading-[1.45]" style={{ color: featured ? 'rgba(255,255,255,0.85)' : BODY }}>
        {plan.pitch}
      </p>
    </div>
  )
}

export function SlideInvestimento({ input, content, accent, index, total }: SlideProps) {
  void content
  const installments = calcInstallments(AGENCY_DEAL_CENTS, input.installmentFeeRate)

  return (
    <LightSlide
      input={input}
      accent={accent}
      index={index}
      total={total}
      kicker="Investimento"
      title="Escolha como começar"
    >
      <div className="flex h-full flex-col">
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-6 pt-2">
          {PILOTO_PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} accent={accent} />
          ))}
        </div>

        <div className="mt-6 flex shrink-0 items-end justify-between gap-10">
          <p className="text-[17px] font-medium" style={{ color: INK }}>
            Agência de{' '}
            <span className="line-through tabular-nums" style={{ color: FAINT }}>
              {brl(AGENCY_LIST_CENTS)}
            </span>{' '}
            por <span className="font-bold tabular-nums">{brl(AGENCY_DEAL_CENTS)}</span> fechando nesta
            reunião · à vista no Pix ou 10x de{' '}
            <span className="font-bold tabular-nums">{brl(installments.installmentCents)}</span>
          </p>
        </div>
        <p className="mt-1.5 shrink-0 text-[14px] font-medium" style={{ color: MUTED }}>
          {AD_BUDGET_NOTE}
        </p>
      </div>
    </LightSlide>
  )
}

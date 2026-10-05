import { AD_BUDGET_NOTE } from '../../lib/pilotoContent'
import { calcInstallments, channelLabel, getPilotoPlans } from '../../lib/pilotoPricing'
import type { PilotoPlan, PilotoPricing } from '../../lib/pilotoPricing'
import { BODY, INK, LightSlide, MUTED, RULE, brl, onAccent } from './deck'
import type { SlideProps } from './slideTypes'

/** Preço cheio riscado: vermelho pra ler de longe que ele não vale mais. */
const STRIKE_RED = '#DC2626'

function PlanCard({ plan, pricing, accent }: { plan: PilotoPlan; pricing: PilotoPricing; accent: string }) {
  const featured = plan.highlighted
  const text = featured ? '#FFFFFF' : INK
  const soft = featured ? 'rgba(255,255,255,0.62)' : MUTED
  const rule = featured ? 'rgba(255,255,255,0.14)' : '#EDEDEF'
  // O número grande é o trabalho da agência (o que se fala no roteiro); os anúncios somam embaixo.
  const rows = plan.channels.map((channel) => ({
    label: `+ Anúncios no ${channelLabel(channel)}`,
    value: pricing.adBudgetPerChannelCents,
  }))

  return (
    <div
      className="relative flex flex-col px-7 pb-5 pt-6"
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
        {plan.channels.map(channelLabel).join(' + ')}
      </p>

      {plan.agencyListCents > plan.agencyDealCents ? (
        <p className="mt-4 text-[17px] font-semibold line-through tabular-nums" style={{ color: STRIKE_RED }}>
          {brl(plan.agencyListCents)}
        </p>
      ) : null}
      <p
        className={`${plan.agencyListCents > plan.agencyDealCents ? 'mt-1' : 'mt-5'} text-[40px] font-bold leading-none tracking-[-0.03em] tabular-nums`}
      >
        {brl(plan.agencyDealCents)}
      </p>
      <p className="mt-1.5 text-[13px] font-medium" style={{ color: soft }}>
        nosso trabalho, fechando nesta reunião
      </p>

      <div className="mt-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between border-t py-[5px] text-[14px] font-medium"
            style={{ borderColor: rule }}
          >
            <span style={{ color: soft }}>{row.label}</span>
            <span className="tabular-nums">{brl(row.value)}</span>
          </div>
        ))}
        <div
          className="flex items-center justify-between border-t py-[5px] text-[14px] font-semibold"
          style={{ borderColor: rule }}
        >
          <span>Total no piloto</span>
          <span className="tabular-nums">{brl(plan.totalCents)}</span>
        </div>
      </div>

      <p className="mt-auto pt-3 text-[15px] font-medium leading-[1.45]" style={{ color: featured ? 'rgba(255,255,255,0.85)' : BODY }}>
        {plan.pitch}
      </p>
    </div>
  )
}

export function SlideInvestimento({ input, content, accent, index, total }: SlideProps) {
  void content
  const { pricing } = input
  const plans = getPilotoPlans(pricing)
  const completo = plans.find((plan) => plan.id === 'completo')
  const single = plans.find((plan) => plan.id !== 'completo')
  const completoInstallment = calcInstallments(completo?.agencyDealCents ?? 0, input.installmentFeeRate).installmentCents
  const singleInstallment = calcInstallments(single?.agencyDealCents ?? 0, input.installmentFeeRate).installmentCents

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
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} pricing={pricing} accent={accent} />
          ))}
        </div>

        <div className="mt-10 flex shrink-0 items-end justify-between gap-10">
          {/* Cada card já mostra o próprio preço; aqui fica só como pagar o nosso trabalho. */}
          <p className="text-[17px] font-medium" style={{ color: INK }}>
            Nosso trabalho à vista no Pix ou em 10x no cartão:{' '}
            <span className="font-bold tabular-nums">{brl(completoInstallment)}</span> no Completo e{' '}
            <span className="font-bold tabular-nums">{brl(singleInstallment)}</span> nos outros
          </p>
        </div>
        <p className="mt-1.5 shrink-0 text-[14px] font-medium" style={{ color: MUTED }}>
          {AD_BUDGET_NOTE}
        </p>
      </div>
    </LightSlide>
  )
}

import { RECURRENCE_NOTE } from '../../lib/pilotoContent'
import { CONTINUATION_PLANS } from '../../lib/pilotoPricing'
import type { ContinuationPlan } from '../../lib/pilotoPricing'
import { BODY, CheckIcon, INK, LightSlide, MUTED, RULE, brl } from './deck'
import type { SlideProps } from './slideTypes'

function ContinuationCard({ plan, accent }: { plan: ContinuationPlan; accent: string }) {
  const featured = plan.highlighted
  const soft = featured ? 'rgba(255,255,255,0.62)' : MUTED

  return (
    <div
      className="flex flex-col px-7 pb-7 pt-7"
      style={featured ? { backgroundColor: INK, color: '#FFFFFF' } : { border: `1px solid ${RULE}`, color: INK }}
    >
      <p className="text-[21px] font-bold tracking-[-0.015em]">{plan.name}</p>
      <p className="mt-5 flex items-baseline gap-1.5">
        <span className="text-[42px] font-bold leading-none tracking-[-0.03em] tabular-nums">
          {brl(plan.monthlyCents)}
        </span>
        <span className="text-[15px] font-medium" style={{ color: soft }}>
          /mês
        </span>
      </p>
      <p className="mt-2 h-[18px] text-[13px] font-medium" style={{ color: soft }}>
        {plan.note ?? ''}
      </p>
      <ul className="mb-6 mt-5 space-y-2.5">
        {plan.includes.map((item) => (
          <li key={item} className="flex items-center gap-2.5 text-[15px] font-medium">
            <CheckIcon size={15} color={featured ? accent : INK} />
            <span style={{ color: featured ? 'rgba(255,255,255,0.9)' : BODY }}>{item}</span>
          </li>
        ))}
      </ul>
      <p
        className="mt-auto border-t pt-4 text-[15px] font-medium leading-[1.45]"
        style={{ borderColor: featured ? 'rgba(255,255,255,0.14)' : '#EDEDEF', color: featured ? 'rgba(255,255,255,0.85)' : BODY }}
      >
        {plan.fit}
      </p>
    </div>
  )
}

/**
 * Slide de continuidade: fica imediatamente antes do fechamento (próximos passos).
 * Pode ser omitido pelo toggle "Exibir planos recorrentes".
 */
export function SlideContinuidade({ input, content, accent, index, total }: SlideProps) {
  void content

  return (
    <LightSlide
      input={input}
      accent={accent}
      index={index}
      total={total}
      kicker="Depois do piloto"
      title="Se fizer sentido continuar"
    >
      <div className="flex h-full flex-col">
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-6">
          {CONTINUATION_PLANS.map((plan) => (
            <ContinuationCard key={plan.id} plan={plan} accent={accent} />
          ))}
        </div>
        <p className="mt-6 shrink-0 text-[15px] font-medium" style={{ color: MUTED }}>
          {RECURRENCE_NOTE}
        </p>
      </div>
    </LightSlide>
  )
}

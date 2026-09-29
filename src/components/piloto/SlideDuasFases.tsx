import { MILESTONES, PHASES } from '../../lib/pilotoContent'
import { BODY, CheckIcon, INK, LightSlide, MUTED, onAccent } from './deck'
import type { SlideProps } from './slideTypes'

function Milestone({ day, label, align }: { day: string; label: string; align: 'left' | 'right' }) {
  return (
    <div className={align === 'right' ? 'text-right' : 'text-left'}>
      <p className="text-[16px] font-bold tabular-nums">{day}</p>
      <p className="mt-0.5 text-[14px] font-medium" style={{ color: MUTED }}>
        {label}
      </p>
    </div>
  )
}

export function SlideDuasFases({ input, content, accent, index, total }: SlideProps) {
  void content
  const phases = [PHASES.foundation, PHASES.traffic]

  return (
    <LightSlide
      input={input}
      accent={accent}
      index={index}
      total={total}
      kicker="Como funciona"
      title="45 dias, duas fases"
    >
      <div className="flex h-full flex-col justify-center">
        <div className="flex">
          <div className="w-1/3">
            <Milestone day={MILESTONES[0].day} label={MILESTONES[0].label} align="left" />
          </div>
          <div className="flex w-2/3 justify-between">
            <Milestone day={MILESTONES[1].day} label={MILESTONES[1].label} align="left" />
            <Milestone day={MILESTONES[2].day} label={MILESTONES[2].label} align="right" />
          </div>
        </div>

        <div className="relative mt-3 flex h-[10px]" aria-hidden>
          <span className="absolute left-0 top-0 h-full w-px" style={{ backgroundColor: INK }} />
          <span className="absolute left-1/3 top-0 h-full w-px" style={{ backgroundColor: INK }} />
          <span className="absolute right-0 top-0 h-full w-px" style={{ backgroundColor: INK }} />
        </div>
        <div className="relative flex h-[68px]">
          <div className="flex w-1/3 items-center px-7" style={{ backgroundColor: INK }}>
            <span className="text-[21px] font-semibold text-white">
              {PHASES.foundation.name} · {PHASES.foundation.days}
            </span>
          </div>
          <div className="flex w-2/3 items-center px-7" style={{ backgroundColor: accent }}>
            <span className="text-[21px] font-semibold" style={{ color: onAccent(accent) }}>
              {PHASES.traffic.name} · {PHASES.traffic.days}
            </span>
          </div>
        </div>

        <div className="mt-10 flex">
          {phases.map((phase, phaseIndex) => (
            <div
              key={phase.name}
              className={phaseIndex === 0 ? 'w-1/3 pr-10' : 'w-2/3 border-l pl-10'}
              style={phaseIndex === 1 ? { borderColor: '#E4E4E7' } : undefined}
            >
              <p className="text-[21px] font-semibold leading-[1.3] tracking-[-0.01em]">{phase.summary}</p>
              <ul className="mt-5 space-y-3">
                {phase.highlights.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-[17px] font-medium" style={{ color: BODY }}>
                    <CheckIcon size={17} color={INK} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </LightSlide>
  )
}

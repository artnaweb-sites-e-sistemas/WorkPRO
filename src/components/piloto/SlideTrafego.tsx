import { TRAFFIC_LOOP, trafficItems } from '../../lib/pilotoContent'
import { BODY, INK, LightSlide, MUTED, SOFT } from './deck'
import type { SlideProps } from './slideTypes'

const SIZE = 340
const C = SIZE / 2
const R = 118
/** Topo, direita-baixo, esquerda-baixo (graus, sentido horário a partir das 3h). */
const ANGLES = [-90, 30, 150]
const ARC_GAP = 22

function point(angle: number, radius = R) {
  const rad = (angle * Math.PI) / 180
  return { x: C + radius * Math.cos(rad), y: C + radius * Math.sin(rad) }
}

function arcPath(from: number, to: number): string {
  const start = point(from + ARC_GAP)
  const end = point(to - ARC_GAP)
  return `M${start.x},${start.y} A${R},${R} 0 0 1 ${end.x},${end.y}`
}

/** Posição do rótulo de cada etapa, por fora do círculo. */
const LABEL_POSITION = [
  { left: C, top: C - R - 46, transform: 'translateX(-50%)' },
  { left: C + R * 0.87 + 18, top: C + R * 0.5 + 8, transform: 'none' },
  { left: C - R * 0.87 - 18, top: C + R * 0.5 + 8, transform: 'translateX(-100%)' },
]

function OptimizationLoop({ accent, halo = '#FFFFFF' }: { accent: string; halo?: string }) {
  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
        <defs>
          <marker id="loop-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 Z" fill={INK} />
          </marker>
        </defs>
        <circle cx={C} cy={C} r={R} fill="none" stroke="#D4D4D8" strokeWidth={1} />
        {ANGLES.map((angle, angleIndex) => {
          const next = ANGLES[(angleIndex + 1) % ANGLES.length]
          const to = next <= angle ? next + 360 : next
          return (
            <path
              key={angle}
              d={arcPath(angle, to)}
              fill="none"
              stroke={INK}
              strokeWidth={2}
              markerEnd="url(#loop-arrow)"
            />
          )
        })}
        {ANGLES.map((angle) => {
          const node = point(angle)
          return (
            <g key={`node-${angle}`}>
              <circle cx={node.x} cy={node.y} r={13} fill={halo} />
              <circle cx={node.x} cy={node.y} r={9} fill={accent} stroke={INK} strokeWidth={2} />
            </g>
          )
        })}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[40px] font-bold leading-none tracking-[-0.03em] tabular-nums">30</p>
        <p className="mt-1 text-[14px] font-semibold" style={{ color: MUTED }}>
          dias em ciclo
        </p>
      </div>

      {TRAFFIC_LOOP.map((label, labelIndex) => (
        <span
          key={label}
          className="absolute whitespace-nowrap text-[18px] font-bold"
          style={LABEL_POSITION[labelIndex]}
        >
          {label}
        </span>
      ))}
    </div>
  )
}

export function SlideTrafego({ input, content, accent, index, total }: SlideProps) {
  void content

  return (
    <LightSlide
      input={input}
      accent={accent}
      index={index}
      total={total}
      kicker="Tráfego · dias 16 a 45"
      title="Anúncios no ar, ajustados pra gastar menos"
    >
      {/* Duas metades iguais: o ciclo num painel suave, os itens alinhados ao centro dele */}
      <div className="grid h-full grid-cols-2 gap-10">
        <div className="flex items-center justify-center" style={{ backgroundColor: SOFT }}>
          <OptimizationLoop accent={accent} halo={SOFT} />
        </div>
        <div className="flex min-w-0 flex-col justify-center">
          {trafficItems(input.pricing.adBudgetPerChannelCents).map((item) => (
            <div key={item.title} className="border-t py-[12px] first:border-t-0" style={{ borderColor: '#EDEDEF' }}>
              <p className="text-[18px] font-semibold">{item.title}</p>
              <p className="mt-0.5 text-[15px] font-medium leading-[1.45]" style={{ color: BODY }}>
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </LightSlide>
  )
}

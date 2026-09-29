import { FUNNEL_STAGES } from '../../lib/pilotoContent'
import { BODY, FAINT, INK, LightSlide, MUTED, PilotoIcon, onAccent, pad2 } from './deck'
import { AI_FALLBACK, type SlideProps } from './slideTypes'

const W = 1136
const H = 196
const GAP = 10
const SEGMENT_W = (W - GAP * 2) / 3
/** Cinza claro → cinza médio → destaque: só a venda ganha cor. */
const NEUTRAL_FILLS = ['#F1F1F3', '#DDDDE1']

/** Altura do funil na posição x: afunila de H até 30% de H, da esquerda para a direita. */
function heightAt(x: number): number {
  return H - (H * 0.7 * x) / W
}

function segmentPath(index: number): string {
  const start = index * (SEGMENT_W + GAP)
  const end = start + SEGMENT_W
  const mid = H / 2
  const hs = heightAt(start) / 2
  const he = heightAt(end) / 2
  return `M${start},${mid - hs} L${end},${mid - he} L${end},${mid + he} L${start},${mid + hs} Z`
}

export function SlideFunil({ input, content, accent, index, total }: SlideProps) {
  const labels = [content.funnelTopLabel, content.funnelMiddleLabel, content.funnelBottomLabel]

  return (
    <LightSlide
      input={input}
      accent={accent}
      index={index}
      total={total}
      kicker="O método"
      title="O caminho que vamos construir"
    >
      <div className="flex h-full flex-col">
        <div className="relative shrink-0" style={{ width: W, height: H }}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0" aria-hidden>
            {FUNNEL_STAGES.map((stage, stageIndex) => (
              <path
                key={stage.name}
                d={segmentPath(stageIndex)}
                fill={stageIndex === 2 ? accent : NEUTRAL_FILLS[stageIndex]}
              />
            ))}
          </svg>
          <div className="absolute inset-0 grid grid-cols-3" style={{ columnGap: GAP }}>
            {FUNNEL_STAGES.map((stage, stageIndex) => {
              const color = stageIndex === 2 ? onAccent(accent) : INK
              return (
                <div key={stage.name} className="flex items-center gap-3 pl-8">
                  <span className="text-[14px] font-semibold tabular-nums" style={{ color, opacity: 0.6 }}>
                    {pad2(stageIndex + 1)}
                  </span>
                  <span className="text-[28px] font-bold tracking-[-0.02em]" style={{ color }}>
                    {stage.name}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-8 grid flex-1 grid-cols-3" style={{ columnGap: GAP }}>
          {FUNNEL_STAGES.map((stage, stageIndex) => {
            const label = labels[stageIndex].trim()
            return (
              <div key={stage.name} className="pl-8 pr-6">
                <p className="text-[19px] font-medium leading-[1.4]" style={{ color: label ? BODY : FAINT }}>
                  {label || AI_FALLBACK}
                </p>
                <ul className="mt-5 space-y-2.5">
                  {stage.channels.map((channel) => (
                    <li key={channel.label} className="flex items-center gap-2.5 text-[15px] font-medium" style={{ color: MUTED }}>
                      <PilotoIcon name={channel.icon} size={16} color={INK} />
                      {channel.label}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </LightSlide>
  )
}

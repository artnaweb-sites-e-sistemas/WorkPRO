import { LEAKS } from '../../lib/pilotoContent'
import { BODY, Highlight, INK, LightSlide, LineIcon, MUTED, pad2 } from './deck'
import type { SlideProps } from './slideTypes'

const ICONS = ['search', 'eye', 'clock'] as const

export function SlideProblema({ input, content, accent, index, total }: SlideProps) {
  void content

  return (
    <LightSlide
      input={input}
      accent={accent}
      index={index}
      total={total}
      kicker="Onde o cliente se perde"
      title={
        <span className="block max-w-[980px] text-[50px] leading-[1.08] tracking-[-0.03em]">
          O problema não é falta de cliente. É que o caminho até você tem{' '}
          <Highlight accent={accent}>buracos</Highlight>.
        </span>
      }
    >
      <div className="grid h-full grid-cols-3 content-end gap-10">
        {LEAKS.map((leak, leakIndex) => (
          <div key={leak.title} className="border-t-2 pt-6" style={{ borderColor: INK }}>
            <div className="flex items-center justify-between">
              <LineIcon name={ICONS[leakIndex]} size={30} />
              <span className="text-[14px] font-semibold tabular-nums" style={{ color: MUTED }}>
                {pad2(leakIndex + 1)}
              </span>
            </div>
            <p className="mt-5 text-[24px] font-bold leading-[1.2] tracking-[-0.015em]">{leak.title}</p>
            <p className="mt-2.5 text-[17px] font-medium leading-[1.45]" style={{ color: BODY }}>
              {leak.description}
            </p>
          </div>
        ))}
      </div>
    </LightSlide>
  )
}

import { FOUNDATION_GROUPS } from '../../lib/pilotoContent'
import { BODY, INK, IconTile, LightSlide, MUTED } from './deck'
import type { SlideProps } from './slideTypes'

export function SlideFundacao({ input, content, accent, index, total }: SlideProps) {
  void content

  return (
    <LightSlide
      input={input}
      accent={accent}
      index={index}
      total={total}
      kicker="Fundação · dias 1 a 15"
      title="Tudo pronto antes do primeiro anúncio"
    >
      <div className="grid h-full grid-cols-3 gap-10">
        {FOUNDATION_GROUPS.map((group) => (
          <div key={group.name}>
            <div className="flex items-baseline justify-between border-b-2 pb-3" style={{ borderColor: INK }}>
              <p className="text-[20px] font-bold tracking-[-0.01em]">{group.name}</p>
              <span className="text-[14px] font-semibold tabular-nums" style={{ color: MUTED }}>
                {group.items.length} entregas
              </span>
            </div>
            <div>
              {group.items.map((item) => (
                <div
                  key={item.title}
                  className="flex gap-4 border-t py-[18px] first:border-t-0"
                  style={{ borderColor: '#EDEDEF' }}
                >
                  {item.icon ? <IconTile name={item.icon} size={40} /> : null}
                  <div className="min-w-0">
                    <p className="text-[18px] font-semibold leading-tight tracking-[-0.01em]">{item.title}</p>
                    <p className="mt-1 text-[14.5px] font-medium leading-[1.45]" style={{ color: BODY }}>
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </LightSlide>
  )
}

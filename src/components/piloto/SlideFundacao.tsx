import { FOUNDATION_ITEMS } from '../../lib/pilotoContent'
import type { SlideProps } from './slideTypes'

export function SlideFundacao(_props: SlideProps) {
  const left = FOUNDATION_ITEMS.slice(0, 4)
  const right = FOUNDATION_ITEMS.slice(4)

  return (
    <div className="flex h-full w-full flex-col px-[80px] py-[56px] text-white">
      <h2 className="text-[40px] font-bold tracking-tight">Fundação · dias 1 a 15</h2>

      <div className="mt-10 grid flex-1 grid-cols-2 gap-x-16">
        {[left, right].map((column, columnIndex) => (
          <div key={columnIndex}>
            {column.map((item, index) => (
              <div key={item.title}>
                {index > 0 ? <div className="h-px bg-white/10" /> : null}
                <div className="py-4">
                  <p className="text-[22px] font-semibold">{item.title}</p>
                  <p className="mt-1 text-[16px] font-medium text-[#A1A1AA]">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

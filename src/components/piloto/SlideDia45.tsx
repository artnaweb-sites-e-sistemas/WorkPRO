import { DAY45_ITEMS } from '../../lib/pilotoContent'
import type { SlideProps } from './slideTypes'

export function SlideDia45(_props: SlideProps) {
  return (
    <div className="flex h-full w-full flex-col px-[80px] py-[56px] text-white">
      <h2 className="text-[40px] font-bold tracking-tight">O que você tem no dia 45</h2>

      <div className="mt-12 flex-1">
        {DAY45_ITEMS.map((item, index) => (
          <div key={item.title}>
            {index > 0 ? <div className="h-px bg-white/10" /> : null}
            <div className="py-6">
              <p className="text-[24px] font-semibold">{item.title}</p>
              <p className="mt-2 text-[18px] font-medium text-[#A1A1AA]">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

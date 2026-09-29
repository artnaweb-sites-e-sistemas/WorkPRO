import { AD_BUDGET_NOTE, TRAFFIC_ITEMS } from '../../lib/pilotoContent'
import type { SlideProps } from './slideTypes'

export function SlideTrafego(_props: SlideProps) {
  return (
    <div className="flex h-full w-full flex-col px-[80px] py-[56px] text-white">
      <h2 className="text-[40px] font-bold tracking-tight">Tráfego · dias 16 a 45</h2>

      <div className="mt-10 flex-1">
        {TRAFFIC_ITEMS.map((item, index) => (
          <div key={item.title}>
            {index > 0 ? <div className="h-px bg-white/10" /> : null}
            <div className="py-5">
              <p className="text-[22px] font-semibold">{item.title}</p>
              <p className="mt-1 text-[16px] font-medium text-[#A1A1AA]">{item.description}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[16px] font-medium text-[#71717A]">{AD_BUDGET_NOTE}</p>
    </div>
  )
}

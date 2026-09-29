import type { SlideProps } from './slideTypes'

export function SlideDuasFases({ accent }: SlideProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-[80px]">
      <div className="flex h-[72px] w-[1000px] overflow-hidden">
        <div className="flex w-1/3 items-center justify-center bg-[#27272A]">
          <span className="text-[22px] font-semibold text-white">Fundação · 15 dias</span>
        </div>
        <div className="flex w-2/3 items-center justify-center" style={{ backgroundColor: accent }}>
          <span className="text-[22px] font-semibold text-black">Tráfego · 30 dias</span>
        </div>
      </div>

      <div className="mt-10 flex w-[1000px]">
        <p className="w-1/3 pr-6 text-[20px] font-medium leading-snug text-[#A1A1AA]">
          Montagem da estrutura completa antes de ligar o tráfego.
        </p>
        <p className="w-2/3 pl-6 text-[20px] font-medium leading-snug text-[#A1A1AA]">
          Anúncio no ar com verba real e otimização contínua.
        </p>
      </div>
    </div>
  )
}

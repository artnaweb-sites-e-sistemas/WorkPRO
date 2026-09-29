import type { SlideProps } from './slideTypes'

export function SlideCapa({ input }: SlideProps) {
  const today = new Date().toLocaleDateString('pt-BR')

  return (
    <div className="relative flex h-full w-full flex-col px-[80px] py-[56px] text-white">
      <div className="h-[56px]">
        {input.logoDataUrl ? (
          <img
            src={input.logoDataUrl}
            alt=""
            className="h-[56px] max-w-[280px] object-contain object-left"
          />
        ) : (
          <p className="text-[28px] font-semibold text-white">{input.companyName || 'WorkPRO'}</p>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-center">
        <h1 className="text-[96px] font-bold leading-none tracking-tight">Piloto 45</h1>
        <p className="mt-6 text-[28px] font-medium text-[#A1A1AA]">
          Uma proposta para {input.leadCompanyName.trim() || 'seu negócio'}
        </p>
      </div>

      <div className="flex items-end justify-between text-[16px] font-medium text-[#A1A1AA]">
        <span>{input.professionalName}</span>
        <span className="tabular-nums">{today}</span>
      </div>
    </div>
  )
}

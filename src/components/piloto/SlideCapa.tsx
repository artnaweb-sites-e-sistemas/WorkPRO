import { pilotoPromise } from '../../lib/pilotoContent'
import { BrandLogo, DarkSlide, FAINT, Kicker, monthYear } from './deck'
import type { SlideProps } from './slideTypes'

export function SlideCapa({ input, accent }: SlideProps) {
  const lead = input.leadCompanyName.trim()
  const city = input.leadCity.trim()
  const kicker = [lead ? `Proposta para ${lead}` : 'Proposta comercial', city]
    .filter(Boolean)
    .join(' · ')

  return (
    <DarkSlide input={input}>
      <div className="flex h-full flex-col px-[80px] pb-[40px] pt-[56px]">
        <BrandLogo input={input} height={54} />

        <div className="flex flex-1 flex-col justify-center">
          <Kicker accent={accent} tone="dark">
            {kicker}
          </Kicker>
          <h1 className="mt-7 text-[120px] font-bold leading-[0.95] tracking-[-0.04em]">
            Piloto <span style={{ color: accent }}>45</span>
          </h1>
          <p className="mt-8 max-w-[680px] text-[28px] font-medium leading-[1.3] text-[#D4D4D8]">
            {pilotoPromise(lead)}
          </p>
        </div>

        <div
          className="flex items-center justify-between border-t pt-5 text-[15px] font-medium"
          style={{ borderColor: '#3F3F46', color: FAINT }}
        >
          <span>{input.professionalName.trim() || input.companyName.trim()}</span>
          <span className="tabular-nums">{monthYear()}</span>
        </div>
      </div>
    </DarkSlide>
  )
}

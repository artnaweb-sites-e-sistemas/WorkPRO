import { CLOSING_FALLBACK, NEXT_STEPS, RECURRENCE_NOTE } from '../../lib/pilotoContent'
import { BrandLogo, DarkSlide, FAINT, Kicker, monthYear } from './deck'
import type { SlideProps } from './slideTypes'

export function SlideProximosPassos({ input, content, accent }: SlideProps) {
  const closing = content.closingParagraph.trim() || CLOSING_FALLBACK
  const days = input.validityDays > 0 ? input.validityDays : 15

  return (
    <DarkSlide input={input}>
      <div className="flex h-full flex-col px-[80px] pb-[40px] pt-[56px]">
        <BrandLogo input={input} height={40} />
        <div className="flex flex-1 items-center gap-24">
          <div className="max-w-[560px]">
            <Kicker accent={accent} tone="dark">
              Próximo passo
            </Kicker>
            <h2 className="mt-7 text-[76px] font-bold leading-[1] tracking-[-0.035em]">Vamos começar?</h2>
            <p className="mt-7 text-[21px] font-medium leading-[1.5] text-[#A1A1AA]">{closing}</p>
            <div className="mt-9 h-[2px] w-[120px]" style={{ backgroundColor: accent }} aria-hidden />
            <p className="mt-5 text-[21px] font-semibold" style={{ color: accent }}>
              {input.professionalName.trim() || input.companyName.trim()}
            </p>
          </div>

          <div className="flex-1">
            <ol className="relative">
              <span className="absolute bottom-[42px] left-[21px] top-[42px] w-px bg-white/15" aria-hidden />
              {NEXT_STEPS.map((step, stepIndex) => (
                <li key={step.what} className="relative flex items-start gap-6 py-5">
                  <span
                    className="flex h-[44px] w-[44px] shrink-0 items-center justify-center text-[17px] font-bold tabular-nums"
                    style={{ backgroundColor: '#18181B', border: '1px solid #3F3F46', borderRadius: 999, color: accent }}
                  >
                    {stepIndex + 1}
                  </span>
                  <div className="pt-0.5">
                    <p className="text-[14px] font-semibold" style={{ color: FAINT }}>
                      {step.when}
                    </p>
                    <p className="mt-1 text-[22px] font-semibold text-white">{step.what}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 pl-[68px] text-[15px] font-medium leading-[1.5] text-[#71717A]">{RECURRENCE_NOTE}</p>
          </div>
        </div>

        <div
          className="flex items-center justify-between border-t pt-5 text-[15px] font-medium"
          style={{ borderColor: '#3F3F46', color: FAINT }}
        >
          <span>
            Proposta válida por <span style={{ color: accent }}>{days} dias</span>
          </span>
          <span className="tabular-nums">{monthYear()}</span>
        </div>
      </div>
    </DarkSlide>
  )
}

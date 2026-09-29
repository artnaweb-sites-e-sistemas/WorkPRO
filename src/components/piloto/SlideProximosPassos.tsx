import { CLOSING_FALLBACK, NEXT_STEPS } from '../../lib/pilotoContent'
import { BrandLogo, DarkSlide, FAINT, Kicker, monthYear } from './deck'
import type { SlideProps } from './slideTypes'

export function SlideProximosPassos({ input, content, accent }: SlideProps) {
  const closing = content.closingParagraph.trim() || CLOSING_FALLBACK
  const days = input.validityDays > 0 ? input.validityDays : 15

  return (
    <DarkSlide input={input}>
      <div className="flex h-full flex-col px-[80px] pb-[40px] pt-[56px]">
        <BrandLogo input={input} height={40} />
        <div className="flex flex-1 items-center gap-20">
          <div className="max-w-[560px]">
            <Kicker accent={accent} tone="dark">
              Próximos passos
            </Kicker>
            <h2 className="mt-7 text-[76px] font-bold leading-[1] tracking-[-0.035em]">Vamos começar?</h2>
            <p className="mt-7 text-[21px] font-medium leading-[1.5] text-[#A1A1AA]">{closing}</p>
            <div className="mt-9 h-[2px] w-[120px]" style={{ backgroundColor: accent }} aria-hidden />
            <p className="mt-5 text-[21px] font-semibold" style={{ color: accent }}>
              {input.professionalName.trim() || input.companyName.trim()}
            </p>
          </div>

          <ol className="flex-1">
            {NEXT_STEPS.map((step, stepIndex) => {
              const last = stepIndex === NEXT_STEPS.length - 1
              return (
                <li key={step.what} className="relative flex items-start gap-5 py-2.5">
                  {!last ? (
                    <span className="absolute bottom-[-10px] left-[19px] top-[50px] w-px bg-white/15" aria-hidden />
                  ) : null}
                  <span
                    className="flex h-[40px] w-[40px] shrink-0 items-center justify-center text-[16px] font-bold tabular-nums"
                    style={{ backgroundColor: '#18181B', border: '1px solid #3F3F46', borderRadius: 999, color: accent }}
                  >
                    {stepIndex + 1}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[13px] font-semibold tabular-nums" style={{ color: FAINT }}>
                      {step.when}
                    </p>
                    <p className="mt-0.5 text-[19px] font-semibold leading-[1.3] text-white">{step.what}</p>
                    {step.detail ? (
                      <p className="mt-1 text-[14px] font-medium leading-[1.4] text-[#A1A1AA]">{step.detail}</p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>
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

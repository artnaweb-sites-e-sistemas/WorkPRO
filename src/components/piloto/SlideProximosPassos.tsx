import { NEXT_STEPS, RECURRENCE_NOTE } from '../../lib/pilotoContent'
import { aiText, type SlideProps } from './slideTypes'

export function SlideProximosPassos({ input, content }: SlideProps) {
  return (
    <div className="flex h-full w-full flex-col justify-center px-[100px] py-[56px] text-white">
      <div className="space-y-6">
        {NEXT_STEPS.map((step, index) => (
          <p key={step} className="text-[26px] font-semibold leading-snug">
            <span className="tabular-nums text-[#A1A1AA]">{index + 1}.</span> {step}
          </p>
        ))}
      </div>

      <p className="mt-12 text-[18px] font-medium leading-snug text-[#A1A1AA]">{RECURRENCE_NOTE}</p>

      <p
        className={`mt-10 text-[20px] font-medium leading-snug ${
          content.closingParagraph.trim() ? 'text-white' : 'text-[#71717A]'
        }`}
      >
        {aiText(content.closingParagraph)}
      </p>
      <p className="mt-4 text-[18px] font-semibold text-[#D4D4D8]">{input.professionalName}</p>
    </div>
  )
}

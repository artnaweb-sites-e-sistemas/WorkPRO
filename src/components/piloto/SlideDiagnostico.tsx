import { aiText, type SlideProps } from './slideTypes'

export function SlideDiagnostico({ content }: SlideProps) {
  const lines = content.diagnosisLines.filter((line) => line.trim().length > 0)

  return (
    <div className="flex h-full w-full flex-col justify-center px-[80px] py-[56px] text-white">
      <h2
        className={`text-[56px] font-bold leading-tight tracking-tight ${
          content.diagnosisHeadline.trim() ? 'text-white' : 'text-[#71717A]'
        }`}
      >
        {aiText(content.diagnosisHeadline)}
      </h2>

      <div className="mt-12 space-y-0">
        {(lines.length > 0 ? lines : ['']).map((line, index) => (
          <div key={`${index}-${line}`}>
            {index > 0 ? <div className="h-px bg-white/15" /> : null}
            <p
              className={`py-5 text-[24px] font-medium leading-snug ${
                line.trim() ? 'text-[#D4D4D8]' : 'text-[#71717A]'
              }`}
            >
              {line.trim() || 'Texto ainda não gerado'}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

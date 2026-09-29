import type { PilotoInput, SituationAnswer } from '../../types/piloto'
import { BODY, CheckIcon, FAINT, Highlight, INK, LightSlide, MUTED, SOFT, pad2 } from './deck'
import { AI_FALLBACK, type SlideProps } from './slideTypes'

interface SituationRow {
  label: string
  value: string
  gap: boolean
}

const SITUATION_COPY: {
  key: keyof Pick<PilotoInput, 'hasWebsite' | 'runsAds' | 'whatsappOrganized'>
  label: string
  yes: string
  no: string
}[] = [
  { key: 'hasWebsite', label: 'Site', yes: 'Tem site', no: 'Não tem' },
  { key: 'runsAds', label: 'Anúncios', yes: 'Já anuncia', no: 'Não anuncia' },
  { key: 'whatsappOrganized', label: 'WhatsApp', yes: 'Organizado', no: 'Sem processo' },
]

/** Só entra o que foi respondido: "não sei" some, para não parecer despreparo. */
function situationRows(input: PilotoInput): SituationRow[] {
  return SITUATION_COPY.flatMap((item) => {
    const answer: SituationAnswer = input[item.key]
    if (answer === 'nao_sei') {
      return []
    }
    return [{ label: item.label, value: answer === 'sim' ? item.yes : item.no, gap: answer === 'nao' }]
  })
}

export function SlideDiagnostico({ input, content, accent, index, total }: SlideProps) {
  const headline = content.diagnosisHeadline.trim()
  const lines = content.diagnosisLines.filter((line) => line.trim().length > 0)
  const rows = situationRows(input)

  return (
    <LightSlide
      input={input}
      accent={accent}
      index={index}
      total={total}
      kicker="O cenário hoje"
      compactTitle
      title={headline || <span style={{ color: FAINT }}>{AI_FALLBACK}</span>}
    >
      <div className="flex h-full items-center gap-14">
        <div className="min-w-0 flex-1">
          {(lines.length > 0 ? lines : ['']).map((line, lineIndex) => (
            <div
              key={`${lineIndex}-${line}`}
              className="flex gap-6 border-t py-6 first:border-t-0 first:pt-0 last:pb-0"
              style={{ borderColor: '#EDEDEF' }}
            >
              <span className="w-8 shrink-0 pt-1.5 text-[15px] font-semibold tabular-nums" style={{ color: FAINT }}>
                {pad2(lineIndex + 1)}
              </span>
              <p
                className="text-[24px] font-medium leading-[1.4] tracking-[-0.01em]"
                style={{ color: line.trim() ? BODY : FAINT }}
              >
                {line.trim() || AI_FALLBACK}
              </p>
            </div>
          ))}
        </div>

        {rows.length > 0 ? (
          <aside className="w-[330px] shrink-0 px-7 py-6" style={{ backgroundColor: SOFT }}>
            <p className="text-[14px] font-semibold" style={{ color: MUTED }}>
              Onde a empresa está
            </p>
            <div className="mt-4">
              {rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between border-t py-3.5 first:border-t-0"
                  style={{ borderColor: '#E4E4E7' }}
                >
                  <span className="text-[16px] font-medium" style={{ color: MUTED }}>
                    {row.label}
                  </span>
                  {row.gap ? (
                    <span className="text-[16px] font-semibold" style={{ color: INK }}>
                      <Highlight accent={accent}>{row.value}</Highlight>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-[16px] font-medium" style={{ color: MUTED }}>
                      <CheckIcon size={15} color={MUTED} />
                      {row.value}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {rows.some((row) => row.gap) ? (
              <p className="mt-4 text-[13px] font-medium" style={{ color: MUTED }}>
                <Highlight accent={accent}>Destacado</Highlight>: o que o Piloto 45 resolve
              </p>
            ) : null}
          </aside>
        ) : null}
      </div>
    </LightSlide>
  )
}

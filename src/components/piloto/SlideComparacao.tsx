import { COMPARISON_ROWS, COMPARISON_TAGLINE } from '../../lib/pilotoContent'
import { CheckIcon, FAINT, Highlight, INK, LightSlide, MUTED } from './deck'
import type { SlideProps } from './slideTypes'

const ROW_RULE = '#EDEDEF'

/**
 * Por que a automação aquece melhor. A coluna da automação é o único bloco escuro do slide.
 * A equipe do cliente não é criticada: é ela quem fecha a venda no fim.
 */
export function SlideComparacao({ input, content, accent, index, total }: SlideProps) {
  void content

  return (
    <LightSlide
      input={input}
      accent={accent}
      index={index}
      total={total}
      kicker="Por que funciona"
      title="Um atendimento automático, pensado para vender"
    >
      <div className="flex h-full flex-col">
        <div className="grid grid-cols-[1fr_1fr_1.15fr]">
          <div />
          <div className="flex items-end px-6 pb-4 text-[15px] font-semibold" style={{ color: MUTED }}>
            Atendimento comum
          </div>
          <div className="px-7 pb-4 pt-5 text-[16px] font-bold text-white" style={{ backgroundColor: INK }}>
            Com a automação
          </div>

          {COMPARISON_ROWS.map((row, rowIndex) => {
            const last = rowIndex === COMPARISON_ROWS.length - 1
            return (
              <div key={row.topic} className="contents">
                <div
                  className="border-t py-[15px] pr-6 text-[16px] font-semibold"
                  style={{ borderColor: ROW_RULE, color: INK }}
                >
                  {row.topic}
                </div>
                <div
                  className="border-t px-6 py-[15px] text-[16px] font-medium"
                  style={{ borderColor: ROW_RULE, color: FAINT }}
                >
                  {row.common}
                </div>
                <div
                  className="flex items-center gap-3 px-7 py-[15px] text-[16px] font-semibold text-white"
                  style={{
                    backgroundColor: INK,
                    borderTop: '1px solid rgba(255,255,255,0.12)',
                    paddingBottom: last ? 22 : undefined,
                  }}
                >
                  <CheckIcon size={16} color={accent} />
                  {row.ai}
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-auto text-[26px] font-bold tracking-[-0.02em]" style={{ color: INK }}>
          <Highlight accent={accent}>{COMPARISON_TAGLINE}</Highlight>
        </p>
      </div>
    </LightSlide>
  )
}

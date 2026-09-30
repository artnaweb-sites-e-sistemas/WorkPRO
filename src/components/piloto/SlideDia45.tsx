import {
  ASSETS_THAT_STAY,
  CONTINUES_IF_YOU_WANT,
  PILOT_GOAL,
  REPORT_METRICS,
} from '../../lib/pilotoContent'
import { continuationFromCents } from '../../lib/pilotoPricing'
import { BODY, CheckIcon, FAINT, INK, LightSlide, MUTED, RULE, SOFT, brl } from './deck'
import type { SlideProps } from './slideTypes'

/** Larguras das barras que simulam o valor ainda desconhecido de cada métrica. */
const PLACEHOLDER_WIDTHS = [64, 56, 40, 80, 68]

/**
 * Três colunas de mesma largura e altura: o relatório, o que é dele (fundo cheio)
 * e o que é opcional (borda tracejada). Mesma leitura do PDF.
 */
export function SlideDia45({ input, content, accent, index, total }: SlideProps) {
  void content
  const lead = input.leadCompanyName.trim()

  return (
    <LightSlide
      input={input}
      accent={accent}
      index={index}
      total={total}
      kicker="Dia 45"
      title="Você decide com números, não com achismo"
    >
      <div className="flex h-full flex-col">
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-6">
          <div className="flex flex-col bg-white" style={{ border: `1px solid ${RULE}` }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ backgroundColor: INK }}>
              <div className="min-w-0">
                <p className="text-[16px] font-bold text-white">Relatório final</p>
                <p className="mt-0.5 truncate text-[12px] font-medium text-white/55">
                  Piloto 45{lead ? ` · ${lead}` : ''}
                </p>
              </div>
              <span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: accent }} aria-hidden />
            </div>
            <div className="flex flex-1 flex-col justify-around px-6 py-2">
              {REPORT_METRICS.map((metric, metricIndex) => (
                <div
                  key={metric}
                  className="flex items-center justify-between gap-3 border-t py-2 first:border-t-0"
                  style={{ borderColor: '#EDEDEF' }}
                >
                  <span className="text-[14.5px] font-medium" style={{ color: BODY }}>
                    {metric}
                  </span>
                  <span
                    className="h-[9px] shrink-0"
                    style={{ width: PLACEHOLDER_WIDTHS[metricIndex], backgroundColor: RULE, borderRadius: 2 }}
                    aria-hidden
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col px-6 py-5" style={{ backgroundColor: SOFT }}>
            <p className="text-[16px] font-bold">Fica com você</p>
            <ul className="mt-3 flex flex-1 flex-col justify-around">
              {ASSETS_THAT_STAY.map((asset) => (
                <li key={asset} className="flex items-center gap-3 text-[15.5px] font-medium" style={{ color: INK }}>
                  <CheckIcon size={16} />
                  {asset}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col px-6 py-5" style={{ border: '1.5px dashed #C9C9CE' }}>
            <p className="text-[16px] font-bold">Continua se você quiser</p>
            <ul className="mt-3 flex flex-1 flex-col justify-around">
              {CONTINUES_IF_YOU_WANT.map((item) => (
                <li key={item.title}>
                  <p className="text-[15.5px] font-medium" style={{ color: BODY }}>
                    {item.title}
                  </p>
                  <p className="text-[13px] font-medium" style={{ color: FAINT }}>
                    {item.description}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t pt-3 text-[13.5px] font-semibold" style={{ borderColor: RULE, color: MUTED }}>
              Planos a partir de {brl(continuationFromCents(input.pricing))}/mês
            </p>
          </div>
        </div>

        <p className="mt-5 shrink-0 text-[15px] font-medium" style={{ color: MUTED }}>
          {PILOT_GOAL}
        </p>
      </div>
    </LightSlide>
  )
}

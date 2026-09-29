import { ASSETS_THAT_STAY, REPORT_METRICS } from '../../lib/pilotoContent'
import { BODY, CheckIcon, INK, LightSlide, MUTED, RULE } from './deck'
import type { SlideProps } from './slideTypes'

/** Larguras das barras que simulam o valor ainda desconhecido de cada métrica. */
const PLACEHOLDER_WIDTHS = [72, 64, 44, 96, 80]

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
      <div className="flex h-full gap-16">
        <div className="w-[560px] shrink-0">
          <div className="bg-white" style={{ border: `1px solid ${RULE}` }}>
            <div className="flex items-center justify-between px-7 py-5" style={{ backgroundColor: INK }}>
              <div>
                <p className="text-[17px] font-bold text-white">Relatório final</p>
                <p className="mt-0.5 text-[13px] font-medium text-white/55">
                  Piloto 45{lead ? ` · ${lead}` : ''}
                </p>
              </div>
              <span className="h-2.5 w-2.5" style={{ backgroundColor: accent }} aria-hidden />
            </div>
            <div className="px-7 py-2">
              {REPORT_METRICS.map((metric, metricIndex) => (
                <div
                  key={metric}
                  className="flex items-center justify-between border-t py-[14px] first:border-t-0"
                  style={{ borderColor: '#EDEDEF' }}
                >
                  <span className="text-[16px] font-medium" style={{ color: BODY }}>
                    {metric}
                  </span>
                  <span
                    className="h-[10px]"
                    style={{ width: PLACEHOLDER_WIDTHS[metricIndex], backgroundColor: RULE, borderRadius: 2 }}
                    aria-hidden
                  />
                </div>
              ))}
            </div>
          </div>
          <p className="mt-4 text-[14px] font-medium" style={{ color: MUTED }}>
            Números reais, medidos no seu negócio durante o piloto.
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[20px] font-bold tracking-[-0.01em]">Tudo o que foi construído fica com você</p>
          <ul className="mt-6">
            {ASSETS_THAT_STAY.map((asset) => (
              <li
                key={asset}
                className="flex items-center gap-3 border-t py-3 text-[17px] font-medium first:border-t-0"
                style={{ borderColor: '#EDEDEF', color: INK }}
              >
                <CheckIcon size={17} />
                {asset}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </LightSlide>
  )
}

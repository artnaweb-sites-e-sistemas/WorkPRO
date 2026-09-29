import { aiText, type SlideProps } from './slideTypes'

const BANDS = [
  { label: 'Atrair', top: 0, width: 720, opacity: 0.18, field: 'funnelTopLabel' as const },
  { label: 'Qualificar', top: 144, width: 500, opacity: 0.34, field: 'funnelMiddleLabel' as const },
  { label: 'Vender', top: 288, width: 280, opacity: 1, field: 'funnelBottomLabel' as const },
]

export function SlideFunil({ content, accent }: SlideProps) {
  const labels = {
    funnelTopLabel: content.funnelTopLabel,
    funnelMiddleLabel: content.funnelMiddleLabel,
    funnelBottomLabel: content.funnelBottomLabel,
  }

  return (
    <div className="flex h-full w-full items-center justify-center gap-16 px-[80px]">
      <svg width="720" height="420" viewBox="0 0 720 420" aria-hidden>
        {BANDS.map((band) => {
          const x = (720 - band.width) / 2
          const nextWidth = BANDS.find((item) => item.top === band.top + 144)?.width ?? band.width - 80
          const nextX = (720 - nextWidth) / 2
          const y = band.top
          const h = 132
          const points =
            band.top === 288
              ? `${x},${y} ${x + band.width},${y} ${x + band.width - 40},${y + h} ${x + 40},${y + h}`
              : `${x},${y} ${x + band.width},${y} ${nextX + nextWidth},${y + h} ${nextX},${y + h}`

          return (
            <g key={band.label}>
              <polygon points={points} fill={accent} fillOpacity={band.opacity} />
              <text
                x="360"
                y={y + 76}
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="22"
                fontWeight="600"
                fontFamily="inherit"
              >
                {band.label}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="flex h-[420px] w-[360px] flex-col justify-between py-4">
        {BANDS.map((band) => {
          const value = labels[band.field]
          return (
            <p
              key={band.field}
              className={`text-[20px] font-medium leading-snug ${
                value.trim() ? 'text-[#E4E4E7]' : 'text-[#71717A]'
              }`}
            >
              {aiText(value)}
            </p>
          )
        })}
      </div>
    </div>
  )
}

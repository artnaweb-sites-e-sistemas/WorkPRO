import { VIDEOS_NOTE } from '../../lib/pilotoContent'
import { BODY, FAINT, INK, LightSlide, MUTED, onAccent, pad2 } from './deck'
import type { SlideProps } from './slideTypes'

/** Tela de Reels/Stories estilizada, com o ângulo escrito como legenda do vídeo. */
function ReelFrame({ number, title, accent }: { number: number; title: string; accent: string }) {
  return (
    <div
      className="relative flex h-[292px] w-[166px] shrink-0 flex-col justify-between overflow-hidden px-4 pb-4 pt-3"
      style={{ backgroundColor: INK, borderRadius: 22 }}
      aria-hidden
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold tabular-nums text-white/60">Vídeo {pad2(number)}</span>
        <span className="h-1 w-7 bg-white/20" style={{ borderRadius: 4 }} />
      </div>

      <span
        className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
        style={{ backgroundColor: accent, borderRadius: 999 }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden>
          <path d="M8 5.5v13l11-6.5-11-6.5Z" fill={onAccent(accent)} />
        </svg>
      </span>

      <div>
        <p className="text-[16px] font-bold leading-[1.25] text-white">{title}</p>
        <span className="mt-3 block h-[3px] w-full bg-white/15">
          <span className="block h-full w-2/5" style={{ backgroundColor: accent }} />
        </span>
      </div>
    </div>
  )
}

export function SlideVideos({ input, content, accent, index, total }: SlideProps) {
  const angles = [0, 1, 2].map((angleIndex) => content.adAngles[angleIndex] ?? { title: '', description: '' })

  return (
    <LightSlide
      input={input}
      accent={accent}
      index={index}
      total={total}
      kicker="Criativos"
      title="Três vídeos, três ângulos para testar"
    >
      <div className="flex h-full flex-col">
        <div className="grid flex-1 grid-cols-3 content-center gap-10">
          {angles.map((angle, angleIndex) => {
            const title = angle.title.trim()
            const description = angle.description.trim()
            return (
              <div key={angleIndex} className="flex flex-col">
                <ReelFrame number={angleIndex + 1} title={title || 'Ângulo a definir'} accent={accent} />
                <p className="mt-5 text-[13px] font-semibold" style={{ color: MUTED }}>
                  Ângulo {pad2(angleIndex + 1)}
                </p>
                <p className="mt-1.5 text-[15.5px] font-medium leading-[1.5]" style={{ color: description ? BODY : FAINT }}>
                  {description || 'Definido no briefing, com base no que o seu cliente mais pergunta.'}
                </p>
              </div>
            )
          })}
        </div>
        <p className="mt-6 shrink-0 text-[15px] font-medium" style={{ color: MUTED }}>
          {VIDEOS_NOTE}
        </p>
      </div>
    </LightSlide>
  )
}

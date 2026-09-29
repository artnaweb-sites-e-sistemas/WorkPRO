import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import type { PilotoAiContent, PilotoInput } from '../../types/piloto'
import { SLIDES } from './index'

const STAGE_W = 1280
const STAGE_H = 720
const THUMB_W = 112
const THUMB_SCALE = THUMB_W / STAGE_W

interface SlidePreviewProps {
  input: PilotoInput
  content: PilotoAiContent
  accent: string
  index: number
  onIndexChange: (index: number) => void
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={direction === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
      />
    </svg>
  )
}

/** Prévia da apresentação: slide atual em escala + miniaturas para pular direto. */
export function SlidePreview({ input, content, accent, index, onIndexChange }: SlidePreviewProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const thumbsRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)
  const total = SLIDES.length
  const Slide = SLIDES[index]

  useEffect(() => {
    const node = frameRef.current
    if (!node) {
      return
    }
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0
      if (width > 0) {
        setScale(width / STAGE_W)
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const strip = thumbsRef.current
    const active = strip?.querySelector<HTMLElement>(`[data-thumb="${index}"]`)
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [index])

  function go(next: number) {
    onIndexChange(Math.max(0, Math.min(total - 1, next)))
  }

  return (
    <div>
      <div
        ref={frameRef}
        className="relative w-full overflow-hidden border border-border bg-black"
        style={{ height: STAGE_H * scale }}
      >
        <div style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <Slide input={input} content={content} accent={accent} index={index} total={total} />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Slide anterior"
            disabled={index === 0}
            onClick={() => go(index - 1)}
            className="flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
          >
            <ChevronIcon direction="left" />
          </button>
          <span className="min-w-[56px] text-center text-sm font-medium tabular-nums text-muted-foreground">
            {index + 1} / {total}
          </span>
          <button
            type="button"
            aria-label="Próximo slide"
            disabled={index === total - 1}
            onClick={() => go(index + 1)}
            className="flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
          >
            <ChevronIcon direction="right" />
          </button>
        </div>
        {index === total - 1 ? (
          <span className="text-xs text-muted-foreground">Slide de apoio: só se o cliente perguntar</span>
        ) : null}
      </div>

      <div ref={thumbsRef} className="mt-2 flex gap-2 overflow-x-auto pb-2">
        {SLIDES.map((Thumb, thumbIndex) => (
          <button
            key={thumbIndex}
            type="button"
            data-thumb={thumbIndex}
            aria-label={`Ir para o slide ${thumbIndex + 1}`}
            aria-current={thumbIndex === index ? 'true' : undefined}
            onClick={() => go(thumbIndex)}
            className={cn(
              'relative shrink-0 overflow-hidden border-2 transition-colors',
              thumbIndex === index ? 'border-accent' : 'border-transparent opacity-70 hover:opacity-100',
            )}
            style={{ width: THUMB_W + 4, height: STAGE_H * THUMB_SCALE + 4 }}
          >
            <span
              className="pointer-events-none block"
              style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${THUMB_SCALE})`, transformOrigin: 'top left' }}
              aria-hidden
            >
              <Thumb input={input} content={content} accent={accent} index={thumbIndex} total={total} />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

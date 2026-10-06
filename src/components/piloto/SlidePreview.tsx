import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import type { PilotoAiContent, PilotoInput } from '../../types/piloto'
import { getPilotoSlides } from './index'

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
  /** Quando false, omite o slide "Se fizer sentido continuar". */
  showContinuation?: boolean
  /** Status à direita do contador (ex.: Salvo / Alterações não salvas). */
  status?: ReactNode
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
export function SlidePreview({
  input,
  content,
  accent,
  index,
  onIndexChange,
  showContinuation = false,
  status,
}: SlidePreviewProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const thumbsRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)
  const slides = useMemo(() => getPilotoSlides(showContinuation), [showContinuation])
  const total = slides.length
  const safeIndex = Math.min(index, Math.max(0, total - 1))
  const Slide = slides[safeIndex]
  const isContinuation = showContinuation && safeIndex === total - 1

  useEffect(() => {
    if (index > total - 1) {
      onIndexChange(Math.max(0, total - 1))
    }
  }, [index, total, onIndexChange])

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
    const active = strip?.querySelector<HTMLElement>(`[data-thumb="${safeIndex}"]`)
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [safeIndex])

  function go(next: number) {
    onIndexChange(Math.max(0, Math.min(total - 1, next)))
  }

  if (!Slide) {
    return null
  }

  return (
    <div>
      <div
        ref={frameRef}
        className="relative w-full overflow-hidden border border-border bg-black"
        style={{ height: STAGE_H * scale }}
      >
        <div style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <Slide input={input} content={content} accent={accent} index={safeIndex} total={total} />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Slide anterior"
            disabled={safeIndex === 0}
            onClick={() => go(safeIndex - 1)}
            className="flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
          >
            <ChevronIcon direction="left" />
          </button>
          <span className="min-w-[56px] text-center text-sm font-medium tabular-nums text-muted-foreground">
            {safeIndex + 1} / {total}
          </span>
          <button
            type="button"
            aria-label="Próximo slide"
            disabled={safeIndex === total - 1}
            onClick={() => go(safeIndex + 1)}
            className="flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
          >
            <ChevronIcon direction="right" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          {isContinuation ? (
            <span className="text-xs text-muted-foreground">Slide de continuidade</span>
          ) : null}
          {status}
        </div>
      </div>

      <div ref={thumbsRef} className="mt-2 flex gap-2 overflow-x-auto pb-2">
        {slides.map((Thumb, thumbIndex) => (
          <button
            key={thumbIndex}
            type="button"
            data-thumb={thumbIndex}
            aria-label={`Ir para o slide ${thumbIndex + 1}`}
            aria-current={thumbIndex === safeIndex ? 'true' : undefined}
            onClick={() => go(thumbIndex)}
            className={cn(
              'relative shrink-0 overflow-hidden border-2 transition-colors',
              thumbIndex === safeIndex ? 'border-accent' : 'border-transparent opacity-70 hover:opacity-100',
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

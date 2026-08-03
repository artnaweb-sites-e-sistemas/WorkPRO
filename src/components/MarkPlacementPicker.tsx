import { cn } from '../lib/cn'
import {
  MARK_ANCHOR_GRID,
  MARK_SCALE_MAX,
  MARK_SCALE_MIN,
  type MarkAnchor,
} from '../types/proposalDoc'

interface MarkAnchorGridProps {
  anchor: MarkAnchor
  onChange: (anchor: MarkAnchor) => void
}

/** Grade 3x3 compacta com a posição da marca d'água na página. */
export function MarkAnchorGrid({ anchor, onChange }: MarkAnchorGridProps) {
  return (
    <div
      role="group"
      aria-label="Posição da marca d'água"
      className="grid w-max shrink-0 grid-cols-3 gap-0.5"
    >
      {MARK_ANCHOR_GRID.map((option) => {
        const selected = option.value === anchor

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-label={option.label}
            aria-pressed={selected}
            title={option.label}
            className={cn(
              'h-3.5 w-3.5 transition-colors duration-150',
              selected ? 'bg-accent' : 'bg-muted hover:bg-muted-foreground',
            )}
          />
        )
      })}
    </div>
  )
}

interface MarkScaleSliderProps {
  scale: number
  onChange: (scale: number) => void
}

/** Tamanho da marca d'água, em % da largura da página. */
export function MarkScaleSlider({ scale, onChange }: MarkScaleSliderProps) {
  return (
    <div className="flex items-center gap-3">
      <label htmlFor="mark-scale" className="kinetic-label shrink-0">
        Tamanho
      </label>
      <input
        id="mark-scale"
        type="range"
        min={MARK_SCALE_MIN}
        max={MARK_SCALE_MAX}
        step={1}
        value={scale}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-8 min-w-0 flex-1 cursor-pointer accent-accent"
      />
      <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">
        {scale}%
      </span>
    </div>
  )
}

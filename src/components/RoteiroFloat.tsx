import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { SCRIPT_THEME_CSS } from './scriptTheme'
import { ScriptAudioCapture } from './ScriptAudioCapture'
import {
  SCRIPT_CAPTURES,
  SCRIPT_PARTS,
  parseKeyQuestion,
  type ScriptCard,
} from '../lib/pilotoScript'

const SIZE_KEY = 'workpro-roteiro-float-size'

type FloatSize = { width: number; height: number }

function loadSize(): FloatSize {
  try {
    const parsed = JSON.parse(localStorage.getItem(SIZE_KEY) || '') as FloatSize
    if (parsed?.width >= 280 && parsed?.height >= 320) return parsed
  } catch {
    /* ignore */
  }
  return { width: 420, height: 720 }
}

function copyStylesTo(target: Document) {
  document.head.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    target.head.appendChild(node.cloneNode(true))
  })
  const theme = target.createElement('style')
  theme.setAttribute('data-roteiro-float', '1')
  theme.textContent = `${SCRIPT_THEME_CSS}
    html, body {
      margin: 0 !important;
      width: 100% !important;
      height: 100% !important;
      background: #09090B !important;
      overflow: hidden !important;
    }
  `
  target.head.appendChild(theme)
  target.body.style.margin = '0'
  target.body.style.overflow = 'hidden'
}

function supportsDocumentPip(): boolean {
  return typeof window !== 'undefined' && 'documentPictureInPicture' in window
}

type PipApi = {
  requestWindow: (options?: { width?: number; height?: number; preferInitialWindowPlacement?: boolean }) => Promise<Window>
  window: Window | null
}

function getPipApi(): PipApi | null {
  if (!supportsDocumentPip()) return null
  return (window as unknown as { documentPictureInPicture: PipApi }).documentPictureInPicture
}

/** Abre janela flutuante (PiP do Chrome, ou popup). */
export async function openRoteiroFloatWindow(): Promise<Window | null> {
  const size = loadSize()
  const pip = getPipApi()
  if (pip) {
    try {
      const win = await pip.requestWindow({
        width: size.width,
        height: size.height,
        preferInitialWindowPlacement: false,
      })
      copyStylesTo(win.document)
      win.document.title = 'WorkPRO — Roteiro'
      return win
    } catch (error) {
      console.error('[RoteiroFloat] pip', error)
    }
  }

  const win = window.open(
    '',
    'workpro-roteiro-float',
    `popup=yes,width=${size.width},height=${size.height},left=64,top=64`,
  )
  if (!win) return null
  copyStylesTo(win.document)
  win.document.title = 'WorkPRO — Roteiro'
  return win
}

function fillLine(text: string, notes: Record<string, string>): ReactNode[] {
  return text.split(/(\{\w+\}|\[[^\]]+\])/g).map((piece, index) => {
    const key = piece.match(/^\{(\w+)\}$/)?.[1]
    if (key) {
      const capture = SCRIPT_CAPTURES[key]
      if (!capture) return null
      const value = (notes[key] ?? '').trim()
      if (!capture.color) {
        return value ? (
          <strong key={index} className="font-semibold text-foreground">
            {value}
          </strong>
        ) : (
          <span key={index} className="pill empty c2">
            {capture.label.toLowerCase()}
          </span>
        )
      }
      return (
        <span key={index} className={`pill ${capture.color}${value ? '' : ' empty'}`}>
          {value || capture.label.toLowerCase()}
        </span>
      )
    }
    if (/^\[[^\]]+\]$/.test(piece)) {
      return (
        <span key={index} style={{ color: 'var(--rt-faint)' }}>
          {piece}
        </span>
      )
    }
    return <span key={index}>{piece}</span>
  })
}

function FloatLine({ text, notes }: { text: string; notes: Record<string, string> }) {
  const [main, tip] = text.split('#')
  return (
    <>
      <span>{fillLine(main, notes)}</span>
      {tip ? (
        <span className="mt-1 block text-[12px]" style={{ color: 'var(--rt-muted)' }}>
          {tip}
        </span>
      ) : null}
    </>
  )
}

export function RoteiroFloatPortal({
  host,
  card,
  index,
  total,
  notes,
  company,
  leadName,
  onPrev,
  onNext,
  onClose,
  onNoteChange,
  onExtracted,
}: {
  host: Window
  card: ScriptCard
  index: number
  total: number
  notes: Record<string, string>
  company: string
  leadName: string
  onPrev: () => void
  onNext: () => void
  onClose: () => void
  onNoteChange: (key: string, value: string) => void
  onExtracted: (notes: Record<string, string>) => void
}) {
  useEffect(() => {
    function persistSize() {
      try {
        localStorage.setItem(
          SIZE_KEY,
          JSON.stringify({ width: host.innerWidth, height: host.innerHeight }),
        )
      } catch {
        /* ignore */
      }
    }
    host.addEventListener('resize', persistSize)
    return () => host.removeEventListener('resize', persistSize)
  }, [host])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      if (target.closest('input, textarea')) return
      if (event.key === 'ArrowRight') onNext()
      if (event.key === 'ArrowLeft') onPrev()
      if (event.key === 'Escape') onClose()
    }
    host.document.addEventListener('keydown', onKey)
    return () => host.document.removeEventListener('keydown', onKey)
  }, [host, onNext, onPrev, onClose])

  const captureKeys = card.capture ?? []

  const panel = (
    <div className="rt flex h-screen flex-col text-foreground" style={{ background: '#09090B', color: 'var(--rt-ink)' }}>
      <header
        className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2.5"
        style={{ borderColor: 'var(--rt-rule)' }}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--rt-faint)' }}>
            {SCRIPT_PARTS[card.part]}
            {card.slides ? ` · ${card.slides}` : ''}
          </p>
          <p className="truncate text-sm font-bold">{card.title}</p>
        </div>
        <span className="tabular-nums text-xs" style={{ color: 'var(--rt-muted)' }}>
          {index + 1}/{total}
        </span>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {card.tone ? (
          <p className="pill c5 inline-block px-2 py-0.5 text-xs">{card.tone}</p>
        ) : null}

        {card.say ? (
          <ul className="grid gap-3">
            {card.say.map((line) => {
              const parsed = parseKeyQuestion(line)
              return (
                <li
                  key={line}
                  className="border-l-[3px] pl-3 text-[15px] leading-snug"
                  style={{
                    borderColor:
                      parsed.key && SCRIPT_CAPTURES[parsed.key]?.color
                        ? `var(--${SCRIPT_CAPTURES[parsed.key]!.color}-fg)`
                        : 'var(--rt-rule)',
                  }}
                >
                  <FloatLine text={parsed.text} notes={notes} />
                </li>
              )
            })}
          </ul>
        ) : null}

        {card.steps ? (
          <div className="grid gap-4">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase" style={{ color: 'var(--rt-faint)' }}>
                Fale
              </p>
              <p className="border-l-[3px] border-accent pl-3 text-[15px] leading-snug">
                <FloatLine text={card.steps.fale} notes={notes} />
              </p>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase" style={{ color: 'var(--rt-faint)' }}>
                Mostre
              </p>
              <ul className="grid gap-1 pl-3 text-[13px]" style={{ color: 'var(--rt-muted)' }}>
                {card.steps.mostre.map((item) => (
                  <li key={item}>
                    <FloatLine text={item} notes={notes} />
                  </li>
                ))}
              </ul>
            </div>
            {card.steps.pergunte ? (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase" style={{ color: 'var(--rt-faint)' }}>
                  Pergunte
                </p>
                <p className="border-l-[3px] border-accent pl-3 text-[15px] leading-snug">
                  <FloatLine text={card.steps.pergunte} notes={notes} />
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {card.beats ? (
          <ul className="grid gap-2.5">
            {card.beats.map(([label, raw]) => {
              const parsed = parseKeyQuestion(raw)
              return (
                <li key={label} className="text-[14px] leading-snug">
                  <span className="mb-0.5 block text-[10px] uppercase" style={{ color: 'var(--rt-faint)' }}>
                    {label}
                  </span>
                  <FloatLine text={parsed.text} notes={notes} />
                </li>
              )
            })}
          </ul>
        ) : null}

        {card.objections ? (
          <p className="text-[13px]" style={{ color: 'var(--rt-muted)' }}>
            Se travar: use as objeções na tela principal.
          </p>
        ) : null}

        {captureKeys.length ? (
          <div className="space-y-3 border-t pt-3" style={{ borderColor: 'var(--rt-rule)' }}>
            <ScriptAudioCapture
              compact
              stageKey={`card-${index}`}
              captureKeys={captureKeys}
              cardTitle={card.title}
              cardGoal={card.goal}
              company={company}
              leadName={leadName}
              onExtracted={onExtracted}
            />
            <div className="grid gap-2.5">
              {captureKeys.map((key) => {
                const capture = SCRIPT_CAPTURES[key]
                if (!capture) return null
                const fieldId = `float-${key}`
                const common =
                  'w-full rounded-md border border-border bg-surface-2 px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none'
                return (
                  <div key={key} className="grid gap-1">
                    <label htmlFor={fieldId} className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
                      {capture.color ? <span className={`${capture.color} h-2.5 w-2.5 rounded-sm`} aria-hidden /> : null}
                      {capture.label}
                    </label>
                    {capture.short ? (
                      <input
                        id={fieldId}
                        value={notes[key] ?? ''}
                        placeholder={capture.hint}
                        onChange={(event) => onNoteChange(key, event.target.value)}
                        className={common}
                      />
                    ) : (
                      <textarea
                        id={fieldId}
                        value={notes[key] ?? ''}
                        placeholder={capture.hint}
                        rows={2}
                        onChange={(event) => onNoteChange(key, event.target.value)}
                        className={`${common} resize-y`}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>

      <footer className="shrink-0 border-t px-3 py-2.5" style={{ borderColor: 'var(--rt-rule)' }}>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={index <= 0}
            className="flex-1 rounded-md border border-border px-2 py-2 text-sm text-foreground transition-colors hover:bg-white/5 disabled:opacity-40"
          >
            ← Anterior
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={index >= total - 1}
            className="flex-1 rounded-md bg-accent px-2 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-40"
          >
            Próxima →
          </button>
        </div>
      </footer>
    </div>
  )

  return createPortal(panel, host.document.body)
}

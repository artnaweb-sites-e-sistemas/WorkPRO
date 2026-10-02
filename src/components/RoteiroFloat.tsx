import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { SCRIPT_THEME_CSS } from './scriptTheme'
import {
  SCRIPT_CAPTURES,
  SCRIPT_PARTS,
  parseKeyQuestion,
  type ScriptCard,
} from '../lib/pilotoScript'

const OPACITY_KEY = 'workpro-roteiro-float-opacity'
const SIZE_KEY = 'workpro-roteiro-float-size'

type FloatSize = { width: number; height: number }

function loadOpacity(): number {
  const raw = Number(localStorage.getItem(OPACITY_KEY))
  if (Number.isFinite(raw) && raw >= 0.15 && raw <= 1) return raw
  return 0.72
}

function loadSize(): FloatSize {
  try {
    const parsed = JSON.parse(localStorage.getItem(SIZE_KEY) || '') as FloatSize
    if (parsed?.width >= 280 && parsed?.height >= 320) return parsed
  } catch {
    /* ignore */
  }
  return { width: 400, height: 620 }
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
      min-height: 100% !important;
      background: transparent !important;
      background-color: transparent !important;
      overflow: hidden !important;
    }
    @media (display-mode: picture-in-picture) {
      html, body { background: transparent !important; background-color: transparent !important; }
    }
  `
  target.head.appendChild(theme)
  target.documentElement.style.background = 'transparent'
  target.documentElement.style.backgroundColor = 'transparent'
  target.body.style.background = 'transparent'
  target.body.style.backgroundColor = 'transparent'
  target.body.style.margin = '0'
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
      win.document.title = 'Roteiro'
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
  win.document.title = 'Roteiro · WorkPro'
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
  onPrev,
  onNext,
  onClose,
}: {
  host: Window
  card: ScriptCard
  index: number
  total: number
  notes: Record<string, string>
  onPrev: () => void
  onNext: () => void
  onClose: () => void
}) {
  const [opacity, setOpacity] = useState(loadOpacity)

  useEffect(() => {
    localStorage.setItem(OPACITY_KEY, String(opacity))
  }, [opacity])

  // Garante fundo transparente da janela (senão o CSS clonado do app pinta #09090B sólido).
  useEffect(() => {
    const root = host.document.documentElement
    const body = host.document.body
    root.style.setProperty('background', 'transparent', 'important')
    root.style.setProperty('background-color', 'transparent', 'important')
    body.style.setProperty('background', 'transparent', 'important')
    body.style.setProperty('background-color', 'transparent', 'important')
    body.style.margin = '0'
    body.style.overflow = 'hidden'
  }, [host, opacity])

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
      if (event.key === 'ArrowRight') onNext()
      if (event.key === 'ArrowLeft') onPrev()
      if (event.key === 'Escape') onClose()
    }
    host.document.addEventListener('keydown', onKey)
    return () => host.document.removeEventListener('keydown', onKey)
  }, [host, onNext, onPrev, onClose])

  const panel = (
    <div
      className="rt flex h-screen flex-col text-foreground"
      style={{
        background: `rgb(9 9 11 / ${opacity})`,
        color: 'var(--rt-ink)',
        textShadow: opacity < 0.55 ? '0 1px 3px rgb(0 0 0 / 0.85)' : undefined,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <header
        className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2.5"
        style={{ borderColor: 'rgb(255 255 255 / 0.08)' }}
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

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {card.tone ? (
          <p className="pill c5 mb-3 inline-block px-2 py-0.5 text-xs">{card.tone}</p>
        ) : null}

        {card.say ? (
          <ul className="grid gap-3">
            {card.say.map((line) => {
              const parsed = parseKeyQuestion(line)
              return (
                <li
                  key={line}
                  className="border-l-[3px] pl-3 text-[16px] leading-snug"
                  style={{ borderColor: parsed.key && SCRIPT_CAPTURES[parsed.key]?.color ? `var(--${SCRIPT_CAPTURES[parsed.key]!.color}-fg)` : 'var(--rt-rule)' }}
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
              <p className="border-l-[3px] border-accent pl-3 text-[16px] leading-snug">
                <FloatLine text={card.steps.fale} notes={notes} />
              </p>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase" style={{ color: 'var(--rt-faint)' }}>
                Mostre
              </p>
              <ul className="grid gap-1 pl-3 text-[14px]" style={{ color: 'var(--rt-muted)' }}>
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
                <p className="border-l-[3px] border-accent pl-3 text-[16px] leading-snug">
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
                <li key={label} className="text-[15px] leading-snug">
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
          <p className="text-[14px]" style={{ color: 'var(--rt-muted)' }}>
            Se travar: use as objeções na tela principal.
          </p>
        ) : null}

        {card.expect ? (
          <p className="mt-4 border-t border-dashed pt-3 text-[13px]" style={{ borderColor: 'var(--rt-rule)', color: 'var(--rt-muted)' }}>
            Espere: {card.expect}
          </p>
        ) : null}
      </div>

      <footer
        className="shrink-0 space-y-2 border-t px-3 py-2.5"
        style={{ borderColor: 'rgb(255 255 255 / 0.08)' }}
      >
        <label className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--rt-muted)' }}>
          Opacidade
          <input
            type="range"
            min={15}
            max={100}
            value={Math.round(opacity * 100)}
            onChange={(event) => setOpacity(Number(event.target.value) / 100)}
            className="min-w-0 flex-1 accent-[rgb(var(--color-accent-rgb))]"
          />
          <span className="w-8 tabular-nums text-right">{Math.round(opacity * 100)}</span>
        </label>
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

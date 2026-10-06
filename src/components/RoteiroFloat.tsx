import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { SCRIPT_THEME_CSS } from './scriptTheme'
import { ScriptAudioCapture } from './ScriptAudioCapture'
import {
  SCRIPT_CAPTURES,
  SCRIPT_PARTS,
  parseKeyQuestion,
  questionList,
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
  return text.split(/(\{\{\w+\|[^}]*\}\}|\{\w+\}|\[[^\]]+\])/g).map((piece, index) => {
    const mark = piece.match(/^\{\{(\w+)\|([^}]*)\}\}$/)
    if (mark) {
      const color = SCRIPT_CAPTURES[mark[1]]?.color
      return color ? (
        <span key={index} className={`pill ${color}`}>
          {mark[2]}
        </span>
      ) : (
        <span key={index}>{mark[2]}</span>
      )
    }
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

export type AdaptState = 'ready' | 'generic' | 'adapting' | null

/** Aviso da fala personalizada, igual ao da tela principal. */
function AdaptNote({ state, onToggle }: { state: AdaptState; onToggle: () => void }) {
  if (!state) return null
  return (
    <span className="mt-1 block text-[11px]" style={{ color: 'var(--rt-faint)' }}>
      {state === 'adapting' ? (
        'Personalizando…'
      ) : state === 'ready' ? (
        <>
          Personalizado ·{' '}
          <button type="button" className="underline transition-colors hover:text-foreground" onClick={onToggle}>
            usar a genérica
          </button>
        </>
      ) : (
        <button type="button" className="underline transition-colors hover:text-foreground" onClick={onToggle}>
          usar a personalizada
        </button>
      )}
    </span>
  )
}

/** "Se ele disser": uma objeção aberta por vez, igual à tela principal. */
function FloatObjections({ objections, notes }: { objections: [string, string][]; notes: Record<string, string> }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section className="min-w-0">
      <p className="mb-1 flex items-baseline gap-2 text-[13px] font-semibold text-foreground">
        Se ele disser
        <span className="tabular-nums font-normal" style={{ color: 'var(--rt-faint)' }}>
          {objections.length}
        </span>
      </p>
      <ul>
        {objections.map(([said, reply], objectionIndex) => {
          const isOpen = open === objectionIndex
          return (
            <li key={said} className="border-t py-2.5 first:border-t-0" style={{ borderColor: 'var(--rt-rule)' }}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : objectionIndex)}
                className="flex w-full min-w-0 items-center justify-between gap-3 text-left text-[14px] font-semibold text-foreground transition-colors hover:text-accent"
              >
                <span className="min-w-0 flex-1">{said}</span>
                <span aria-hidden className="shrink-0" style={{ color: 'var(--rt-faint)' }}>
                  {isOpen ? '−' : '+'}
                </span>
              </button>
              {isOpen ? (
                <p className="mt-2 text-[15px] leading-snug text-foreground">
                  <FloatLine text={reply} notes={notes} />
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Troca a fala pela personalizada, mantendo a dica depois do #. */
function withAdapted(text: string, adapted: string | null): string {
  if (!adapted) return text
  const tip = text.split('#')[1]
  return tip ? `${adapted}#${tip}` : adapted
}

function FloatLine({ text, notes }: { text: string; notes: Record<string, string> }) {
  const [main, tip] = text.split('#')
  return (
    <>
      <span className="whitespace-pre-wrap">{fillLine(main, notes)}</span>
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
  clock,
  timerRunning,
  onToggleTimer,
  onPrev,
  onNext,
  onClose,
  onNoteChange,
  onExtracted,
  adaptedLine,
  adaptState,
  onToggleGeneric,
  objections,
}: {
  host: Window
  card: ScriptCard
  index: number
  total: number
  notes: Record<string, string>
  company: string
  leadName: string
  /** cronômetro da reunião, sincronizado com a tela principal */
  clock: string
  timerRunning: boolean
  onToggleTimer: () => void
  onPrev: () => void
  onNext: () => void
  onClose: () => void
  onNoteChange: (key: string, value: string) => void
  onExtracted: (notes: Record<string, string>, opts: { overwrite: boolean }) => void
  /** fala personalizada pela IA (a mesma da tela principal); null = vale a genérica */
  adaptedLine: (card: ScriptCard, target: number | 'fale') => string | null
  /** situação da fala personalizada, para o aviso abaixo dela */
  adaptState: (card: ScriptCard, target: number | 'fale') => AdaptState
  onToggleGeneric: (card: ScriptCard, target: number | 'fale') => void
  /** respostas pras objeções ("Se ele disser"), as mesmas da tela principal */
  objections: [string, string][]
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
        <div className="flex shrink-0 items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--rt-muted)' }}>
            <strong className="tabular-nums font-semibold text-foreground">{clock}</strong>
            <button
              type="button"
              onClick={onToggleTimer}
              className="rounded border border-border px-2 py-0.5 text-[11px] text-foreground transition-colors hover:bg-white/5"
            >
              {timerRunning ? 'Zerar' : 'Iniciar'}
            </button>
          </span>
          <span className="tabular-nums text-xs" style={{ color: 'var(--rt-muted)' }}>
            {index + 1}/{total}
          </span>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {card.tone ? (
          <p className="pill c5 inline-block px-2 py-0.5 text-xs">{card.tone}</p>
        ) : null}

        {card.say ? (
          <ul className="grid gap-3">
            {card.say.map((line, lineIndex) => {
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
                  <FloatLine text={withAdapted(parsed.text, adaptedLine(card, lineIndex))} notes={notes} />
                  <AdaptNote state={adaptState(card, lineIndex)} onToggle={() => onToggleGeneric(card, lineIndex)} />
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
              <p className="border-l-[3px] pl-3 text-[15px] leading-snug" style={{ borderColor: 'var(--rt-rule)' }}>
                <FloatLine text={withAdapted(card.steps.fale, adaptedLine(card, 'fale'))} notes={notes} />
                <AdaptNote state={adaptState(card, 'fale')} onToggle={() => onToggleGeneric(card, 'fale')} />
              </p>
              {card.steps.etapas ? (
                <ul className="mt-2.5 grid gap-2.5">
                  {card.steps.etapas.map(([label, text]) => (
                    <li key={label} className="border-l-[3px] pl-3 text-[15px] leading-snug" style={{ borderColor: 'var(--rt-rule)' }}>
                      <span className="mb-0.5 block text-[11px] font-semibold" style={{ color: 'var(--rt-faint)' }}>
                        {label}
                      </span>
                      <FloatLine text={text} notes={notes} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {card.steps.mostre.length ? (
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
            ) : null}
            {card.steps.pergunte ? (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase" style={{ color: 'var(--rt-faint)' }}>
                  Pergunte
                </p>
                <div className="grid gap-2.5">
                  {questionList(card.steps.pergunte).map((line) => {
                    const parsed = parseKeyQuestion(line)
                    const color = parsed.key ? SCRIPT_CAPTURES[parsed.key]?.color : null
                    return (
                      <p
                        key={line}
                        className="border-l-[3px] pl-3 text-[15px] leading-snug"
                        style={{ borderColor: color ? `var(--${color}-fg)` : 'rgb(var(--color-accent-rgb))' }}
                      >
                        <FloatLine text={parsed.text} notes={notes} />
                      </p>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {card.beats ? (
          <ul className="grid gap-2.5">
            {card.beats.map(([label, raw]) => {
              const parsed = parseKeyQuestion(raw)
              return (
                <li key={label} className="border-l-[3px] pl-3 text-[15px] leading-snug" style={{ borderColor: 'var(--rt-rule)' }}>
                  <span className="mb-0.5 block text-[11px] font-semibold" style={{ color: 'var(--rt-faint)' }}>
                    {label}
                  </span>
                  <FloatLine text={parsed.text} notes={notes} />
                </li>
              )
            })}
          </ul>
        ) : null}

        {card.branch ? (
          <ul className="grid gap-2.5">
            {card.branch.map(([label, raw]) => {
              const parsed = parseKeyQuestion(raw)
              return (
                <li
                  key={label}
                  className="border-l-[3px] pl-3 text-[14px] leading-snug"
                  style={{
                    borderColor:
                      parsed.key && SCRIPT_CAPTURES[parsed.key]?.color
                        ? `var(--${SCRIPT_CAPTURES[parsed.key]!.color}-fg)`
                        : 'var(--rt-rule)',
                  }}
                >
                  <strong className="font-semibold text-foreground">{label}:</strong>{' '}
                  <span style={{ color: 'var(--rt-muted)' }}>
                    <FloatLine text={parsed.text} notes={notes} />
                  </span>
                </li>
              )
            })}
          </ul>
        ) : null}

        {card.objections ? <FloatObjections objections={objections} notes={notes} /> : null}

        {captureKeys.length ? (
          <div className="space-y-3 border-t pt-3" style={{ borderColor: 'var(--rt-rule)' }}>
            <ScriptAudioCapture
              compact
              stageKey={`card-${index}`}
              stageIndex={index}
              captureKeys={captureKeys}
              cardTitle={card.title}
              cardGoal={card.goal}
              company={company}
              leadName={leadName}
              notes={notes}
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

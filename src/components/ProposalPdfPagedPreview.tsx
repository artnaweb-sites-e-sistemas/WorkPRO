import { useEffect, useRef, useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { ProposalPdfDocument } from '../pdf/ProposalPdfDocument'
import type { ProposalContentDoc, ProposalFormInput } from '../types/proposalDoc'
import { cn } from '../lib/cn'
import { Spinner } from './ui'

/** Polyfill: Chrome / Edge / Firefox ainda sem Map.getOrInsertComputed (pdf.js 6). */
const mapProto = Map.prototype as Map<unknown, unknown> & {
  getOrInsertComputed?: (key: unknown, callbackFn: (key: unknown) => unknown) => unknown
}
if (typeof mapProto.getOrInsertComputed !== 'function') {
  Object.defineProperty(Map.prototype, 'getOrInsertComputed', {
    value(this: Map<unknown, unknown>, key: unknown, callbackFn: (key: unknown) => unknown) {
      if (this.has(key)) {
        return this.get(key)
      }
      const value = callbackFn(key)
      this.set(key, value)
      return value
    },
    writable: true,
    configurable: true,
  })
}

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

/** Proporção do template da proposta (retrato 810×1440). */
const PAGE_ASPECT = '810 / 1440'

interface ProposalPdfPagedPreviewProps {
  input: ProposalFormInput
  content: ProposalContentDoc
}

function ChevronUpIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function isCancelledError(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name
  return name === 'RenderingCancelledException' || name === 'AbortException'
}

async function cancelRenderTask(task: RenderTask | null) {
  if (!task) {
    return
  }
  task.cancel()
  try {
    await task.promise
  } catch {
    // cancelamento esperado
  }
}

export function ProposalPdfPagedPreview({ input, content }: ProposalPdfPagedPreviewProps) {
  const pageBoxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null)
  const renderTaskRef = useRef<RenderTask | null>(null)
  const loadIdRef = useRef(0)

  const [pageNumber, setPageNumber] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [loadingDoc, setLoadingDoc] = useState(true)
  const [rendering, setRendering] = useState(false)
  const [error, setError] = useState('')
  const [boxWidth, setBoxWidth] = useState(0)

  useEffect(() => {
    const box = pageBoxRef.current
    if (!box) {
      return
    }

    const measure = () => setBoxWidth(box.clientWidth)
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadId = ++loadIdRef.current

    const timer = window.setTimeout(() => {
      void (async () => {
        setLoadingDoc(true)
        setError('')
        setPageNumber(1)

        try {
          await cancelRenderTask(renderTaskRef.current)
          renderTaskRef.current = null

          if (pdfDocRef.current) {
            await pdfDocRef.current.cleanup()
            pdfDocRef.current = null
          }

          const blob = await pdf(
            <ProposalPdfDocument input={input} content={content} />,
          ).toBlob()
          const buffer = await blob.arrayBuffer()
          const data = new Uint8Array(buffer.slice(0))
          const doc = await getDocument({ data }).promise

          if (cancelled || loadId !== loadIdRef.current) {
            await doc.cleanup()
            return
          }

          pdfDocRef.current = doc
          setNumPages(doc.numPages)
          setLoadingDoc(false)
        } catch (err) {
          console.error('[ProposalPdfPagedPreview] load', err)
          if (!cancelled && loadId === loadIdRef.current) {
            const message = err instanceof Error ? err.message : 'Erro desconhecido'
            setError(`Não foi possível montar o preview do PDF. ${message}`)
            setLoadingDoc(false)
            setNumPages(0)
          }
        }
      })()
    }, 350)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [input, content])

  useEffect(() => {
    return () => {
      void cancelRenderTask(renderTaskRef.current)
      renderTaskRef.current = null
      if (pdfDocRef.current) {
        void pdfDocRef.current.cleanup()
        pdfDocRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const doc = pdfDocRef.current
    const canvas = canvasRef.current

    if (!doc || !canvas || loadingDoc || numPages === 0 || boxWidth < 40) {
      return
    }

    let cancelled = false

    void (async () => {
      setRendering(true)

      try {
        await cancelRenderTask(renderTaskRef.current)
        renderTaskRef.current = null
        if (cancelled) {
          return
        }

        const page = await doc.getPage(pageNumber)
        if (cancelled) {
          return
        }

        const baseViewport = page.getViewport({ scale: 1 })
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
        const cssScale = boxWidth / baseViewport.width
        const viewport = page.getViewport({ scale: cssScale * pixelRatio })

        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        canvas.style.width = `${Math.floor(viewport.width / pixelRatio)}px`
        canvas.style.height = `${Math.floor(viewport.height / pixelRatio)}px`

        const task = page.render({ canvas, viewport })
        renderTaskRef.current = task
        await task.promise

        if (!cancelled) {
          setError('')
          setRendering(false)
        }
      } catch (err) {
        if (isCancelledError(err) || cancelled) {
          return
        }
        console.error('[ProposalPdfPagedPreview] render', err)
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Erro desconhecido'
          setError(`Não foi possível renderizar esta página. ${message}`)
          setRendering(false)
        }
      }
    })()

    return () => {
      cancelled = true
      void cancelRenderTask(renderTaskRef.current)
      renderTaskRef.current = null
    }
  }, [pageNumber, numPages, loadingDoc, boxWidth])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return
      }

      if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault()
        setPageNumber((current) => Math.max(1, current - 1))
      }
      if (event.key === 'ArrowDown' || event.key === 'PageDown') {
        event.preventDefault()
        setPageNumber((current) => Math.min(numPages || 1, current + 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [numPages])

  const canGoPrev = pageNumber > 1 && !loadingDoc
  const canGoNext = pageNumber < numPages && !loadingDoc
  const pageLabel = String(numPages > 0 ? pageNumber : 0).padStart(2, '0')
  const totalLabel = String(numPages).padStart(2, '0')

  return (
    <div
      ref={pageBoxRef}
      className="relative w-full overflow-hidden border-2 border-border bg-white"
      style={{ aspectRatio: PAGE_ASPECT }}
    >
      {(loadingDoc || rendering) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
            <Spinner size="md" />
        </div>
      )}

      {error ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-surface px-6 text-center">
          <p className="text-sm normal-case text-status-error">{error}</p>
        </div>
      ) : null}

      <canvas ref={canvasRef} className="absolute left-0 top-0 bg-white" />

      <aside
        className="absolute right-3 top-1/2 z-30 flex w-11 -translate-y-1/2 flex-col border-2 border-border bg-surface/95"
        aria-label="Navegação de páginas"
      >
        <button
          type="button"
          aria-label="Página anterior"
          disabled={!canGoPrev}
          onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
          className={cn(
            'flex h-10 w-full items-center justify-center text-foreground transition-colors duration-150',
            'border-b-2 border-border',
            'hover:bg-background hover:text-accent',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
            'disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-foreground',
          )}
        >
          <ChevronUpIcon />
        </button>

        <div className="flex flex-col items-center gap-3 px-1 py-3.5">
          <div className="flex flex-col items-center gap-1">
            <span className="text-sm font-bold tabular-nums leading-none text-foreground">
              {pageLabel}
            </span>
            <span className="block h-px w-4 bg-border" aria-hidden />
            <span className="text-[11px] font-bold tabular-nums leading-none text-muted-foreground">
              {totalLabel}
            </span>
          </div>

          {numPages > 1 ? (
            <div className="flex flex-col items-center gap-1.5" role="tablist" aria-label="Páginas">
              {Array.from({ length: numPages }, (_, index) => {
                const page = index + 1
                const active = page === pageNumber
                return (
                  <button
                    key={page}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={`Página ${page}`}
                    onClick={() => setPageNumber(page)}
                    className={cn(
                      'w-1 transition-all duration-150',
                      active ? 'h-3.5 bg-accent' : 'h-1.5 bg-border hover:bg-muted-foreground',
                    )}
                  />
                )
              })}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          aria-label="Próxima página"
          disabled={!canGoNext}
          onClick={() => setPageNumber((current) => Math.min(numPages, current + 1))}
          className={cn(
            'flex h-10 w-full items-center justify-center text-foreground transition-colors duration-150',
            'border-t-2 border-border',
            'hover:bg-background hover:text-accent',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
            'disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-foreground',
          )}
        >
          <ChevronDownIcon />
        </button>
      </aside>
    </div>
  )
}

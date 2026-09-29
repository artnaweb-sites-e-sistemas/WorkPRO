import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getPilotoSlides } from '../components/piloto'
import { Spinner } from '../components/ui'
import { getPiloto } from '../services/pilotos'
import { getProposalDefaults } from '../services/proposalDefaults'
import type { PilotoAiContent, PilotoInput } from '../types/piloto'
import { EMPTY_PILOTO_AI_CONTENT } from '../types/piloto'
import {
  accentColorRgbChannels,
  normalizeAccentColor,
} from '../types/proposalDoc'

const STAGE_W = 1280
const STAGE_H = 720

/** Cursor customizado: círculo escuro + seta para a esquerda / direita. */
function navCursor(direction: 'left' | 'right'): string {
  const points = direction === 'left' ? '14,7 8,12 14,17' : '10,7 16,12 10,17'
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
      `<circle cx="16" cy="16" r="14" fill="#0B0B0B" fill-opacity="0.88"/>` +
      `<polyline points="${points}" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` +
      `</svg>`,
  )
  return `url("data:image/svg+xml,${svg}") 16 16, ${direction === 'left' ? 'w-resize' : 'e-resize'}`
}

const CURSOR_PREV = navCursor('left')
const CURSOR_NEXT = navCursor('right')

function FullscreenIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
    </svg>
  )
}

export default function PilotoPresent() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const wrapperRef = useRef<HTMLDivElement>(null)

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [input, setInput] = useState<PilotoInput | null>(null)
  const [content, setContent] = useState<PilotoAiContent>(EMPTY_PILOTO_AI_CONTENT)
  const [showContinuation, setShowContinuation] = useState(false)
  const [slideIndex, setSlideIndex] = useState(0)
  const [scale, setScale] = useState(1)
  const [fadeKey, setFadeKey] = useState(0)

  const slides = useMemo(() => getPilotoSlides(showContinuation), [showContinuation])

  useEffect(() => {
    if (!id) {
      setNotFound(true)
      setLoading(false)
      return
    }

    let cancelled = false
    void Promise.all([getPiloto(id), getProposalDefaults()])
      .then(([doc, defaults]) => {
        if (cancelled) {
          return
        }
        if (!doc) {
          setNotFound(true)
          return
        }
        setInput(doc.input)
        setContent(doc.content)
        setShowContinuation(defaults.pilotoShowContinuation === true)
      })
      .catch((error) => {
        console.error('[PilotoPresent]', error)
        if (!cancelled) {
          setNotFound(true)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    function updateScale() {
      const vw = window.innerWidth
      const vh = window.innerHeight
      setScale(Math.min(vw / STAGE_W, vh / STAGE_H))
    }

    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  useEffect(() => {
    wrapperRef.current?.focus()
  }, [loading, notFound])

  useEffect(() => {
    if (slideIndex > slides.length - 1) {
      setSlideIndex(Math.max(0, slides.length - 1))
    }
  }, [slides.length, slideIndex])

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(slides.length - 1, next))
    if (clamped === slideIndex) {
      return
    }
    setSlideIndex(clamped)
    setFadeKey((value) => value + 1)
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault()
        goTo(slideIndex + 1)
      }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault()
        goTo(slideIndex - 1)
      }
      if (event.key === 'Home') {
        event.preventDefault()
        goTo(0)
      }
      if (event.key === 'End') {
        event.preventDefault()
        goTo(slides.length - 1)
      }
      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault()
        void handleFullscreen()
      }
      if (event.key === 'Escape' && id && !document.fullscreenElement) {
        event.preventDefault()
        navigate(`/piloto/${id}`)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  async function handleFullscreen() {
    const node = wrapperRef.current
    if (!node) {
      return
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }
    await node.requestFullscreen()
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090B]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (notFound || !input) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#09090B] px-6 text-center">
        <p className="text-lg font-medium text-white">Apresentação não encontrada</p>
        <Link to="/?tab=pilotos" className="text-sm text-[#A1A1AA] underline">
          Voltar para Piloto 45
        </Link>
      </div>
    )
  }

  const accent = normalizeAccentColor(input.accentColor)
  const Slide = slides[slideIndex]
  const progress = ((slideIndex + 1) / slides.length) * 100

  return (
    <div
      ref={wrapperRef}
      tabIndex={0}
      className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[#09090B] outline-none"
      style={{ ['--piloto-accent' as string]: accentColorRgbChannels(accent) }}
    >
      <div
        className="absolute left-0 top-0 z-30 h-[2px] transition-[width] duration-150"
        style={{ width: `${progress}%`, backgroundColor: accent }}
        aria-hidden
      />

      <div
        className="relative shrink-0 overflow-hidden bg-[#09090B]"
        style={{
          width: STAGE_W,
          height: STAGE_H,
          transform: `scale(${scale})`,
          transformOrigin: 'center',
        }}
      >
        {Slide ? (
          <div
            key={fadeKey}
            className="h-full w-full animate-[pilotoFade_150ms_ease-out]"
            style={{ animation: 'pilotoFade 150ms ease-out' }}
          >
            <Slide
              input={input}
              content={content}
              accent={accent}
              index={slideIndex}
              total={slides.length}
            />
          </div>
        ) : null}

        <button
          type="button"
          aria-label="Slide anterior"
          className="absolute inset-y-0 left-0 z-20 w-[30%] bg-transparent"
          style={{ cursor: CURSOR_PREV }}
          onClick={() => goTo(slideIndex - 1)}
        />
        <button
          type="button"
          aria-label="Próximo slide"
          className="absolute inset-y-0 right-0 z-20 w-[30%] bg-transparent"
          style={{ cursor: CURSOR_NEXT }}
          onClick={() => goTo(slideIndex + 1)}
        />
      </div>

      <button
        type="button"
        aria-label="Tela cheia"
        title="Tela cheia (F)"
        onClick={() => void handleFullscreen()}
        className="absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center bg-black/40 text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <FullscreenIcon />
      </button>

      <style>{`
        @keyframes pilotoFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

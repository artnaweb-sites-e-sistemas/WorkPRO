import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { SLIDES } from '../components/piloto'
import { Spinner } from '../components/ui'
import { getPiloto } from '../services/pilotos'
import type { PilotoAiContent, PilotoInput } from '../types/piloto'
import { EMPTY_PILOTO_AI_CONTENT } from '../types/piloto'
import {
  accentColorRgbChannels,
  normalizeAccentColor,
} from '../types/proposalDoc'

const STAGE_W = 1280
const STAGE_H = 720

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
  const [slideIndex, setSlideIndex] = useState(0)
  const [scale, setScale] = useState(1)
  const [fadeKey, setFadeKey] = useState(0)

  useEffect(() => {
    if (!id) {
      setNotFound(true)
      setLoading(false)
      return
    }

    let cancelled = false
    void getPiloto(id)
      .then((doc) => {
        if (cancelled) {
          return
        }
        if (!doc) {
          setNotFound(true)
          return
        }
        setInput(doc.input)
        setContent(doc.content)
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

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, next))
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
        goTo(SLIDES.length - 1)
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
  const Slide = SLIDES[slideIndex]
  const progress = ((slideIndex + 1) / SLIDES.length) * 100

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
            total={SLIDES.length}
          />
        </div>

        <button
          type="button"
          aria-label="Slide anterior"
          className="absolute inset-y-0 left-0 z-20 w-[30%] cursor-w-resize bg-transparent"
          onClick={() => goTo(slideIndex - 1)}
        />
        <button
          type="button"
          aria-label="Próximo slide"
          className="absolute inset-y-0 right-0 z-20 w-[30%] cursor-e-resize bg-transparent"
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

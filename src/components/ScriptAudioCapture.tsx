import { useEffect, useRef, useState } from 'react'
import {
  blobToBase64,
  extractScriptNotesFromAudio,
  fieldsFromCaptureKeys,
  pickRecorderMimeType,
} from '../ai/extractScriptNotesFromAudio'

type Phase = 'idle' | 'recording' | 'processing'

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Junta áudio do PC (aba/janela) + microfone num único stream pra gravar os dois lados da call.
 */
async function mixAudioStreams(streams: MediaStream[]): Promise<{ stream: MediaStream; stop: () => void }> {
  const audioTracks = streams.flatMap((stream) => stream.getAudioTracks())
  if (!audioTracks.length) {
    throw new Error('no-audio')
  }

  const Context = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const context = new Context()
  const destination = context.createMediaStreamDestination()

  for (const stream of streams) {
    if (!stream.getAudioTracks().length) continue
    const source = context.createMediaStreamSource(stream)
    source.connect(destination)
  }

  // Mantém as tracks originais vivas até parar (senão o mix seca).
  const stop = () => {
    streams.forEach((stream) => stream.getTracks().forEach((track) => track.stop()))
    void context.close().catch(() => undefined)
  }

  return { stream: destination.stream, stop }
}

export function ScriptAudioCapture({
  captureKeys,
  cardTitle,
  cardGoal,
  company,
  leadName,
  onExtracted,
}: {
  captureKeys: string[]
  cardTitle: string
  cardGoal: string
  company: string
  leadName: string
  onExtracted: (notes: Record<string, string>) => void
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')

  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const stopCaptureRef = useRef<(() => void) | null>(null)
  const startedAt = useRef(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      stopCapture()
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [])

  function stopCapture() {
    stopCaptureRef.current?.()
    stopCaptureRef.current = null
    mediaRef.current = null
  }

  async function startRecording() {
    setError('')
    setHint('')
    if (!captureKeys.length) {
      setError('Esta ficha não tem campos para anotar.')
      return
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError('Este navegador não permite capturar o áudio do computador.')
      return
    }

    let displayStream: MediaStream | null = null
    let micStream: MediaStream | null = null

    try {
      // Chrome: escolha a aba do Meet/Zoom e marque "Compartilhar áudio da aba".
      // Chrome/Edge: escolha a aba do Meet/Zoom e marque “Compartilhar áudio”.
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })

      // Só precisamos do áudio; o vídeo é exigido pela API pra abrir o seletor.
      displayStream.getVideoTracks().forEach((track) => track.stop())

      if (!displayStream.getAudioTracks().length) {
        displayStream.getTracks().forEach((track) => track.stop())
        setError('Marque “Compartilhar áudio” na aba/janela da call e tente de novo.')
        return
      }

      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
        // Sem mic ainda dá pra pegar o áudio da aba (voz do lead).
        micStream = null
      }

      const sources = micStream ? [displayStream, micStream] : [displayStream]
      const mixed = await mixAudioStreams(sources)
      stopCaptureRef.current = mixed.stop

      const mimeType = pickRecorderMimeType()
      const recorder = mimeType
        ? new MediaRecorder(mixed.stream, { mimeType })
        : new MediaRecorder(mixed.stream)
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      mediaRef.current = recorder
      startedAt.current = Date.now()
      setElapsed(0)
      tickRef.current = setInterval(() => setElapsed(Date.now() - startedAt.current), 250)
      recorder.start(1000)
      setPhase('recording')

      // Se o usuário parar o compartilhamento pelo Chrome, encerra a gravação.
      displayStream.getAudioTracks()[0]?.addEventListener('ended', () => {
        if (mediaRef.current?.state === 'recording') {
          void stopAndExtract()
        }
      })
    } catch (err) {
      console.error('[ScriptAudioCapture] capture', err)
      displayStream?.getTracks().forEach((track) => track.stop())
      micStream?.getTracks().forEach((track) => track.stop())
      stopCapture()
      const name = err instanceof Error ? err.name : ''
      if (name === 'NotAllowedError') {
        setError('Compartilhamento cancelado. Escolha a aba da call com áudio ligado.')
      } else {
        setError('Não consegui capturar o áudio do PC. Use Chrome/Edge e compartilhe a aba com áudio.')
      }
      setPhase('idle')
    }
  }

  function cancelRecording() {
    if (tickRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
    const recorder = mediaRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.ondataavailable = null
      try {
        recorder.stop()
      } catch {
        /* ignore */
      }
    }
    stopCapture()
    chunksRef.current = []
    setPhase('idle')
    setElapsed(0)
    setHint('')
  }

  async function stopAndExtract() {
    const recorder = mediaRef.current
    if (!recorder || (phase !== 'recording' && recorder.state !== 'recording')) return

    if (tickRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }

    setPhase('processing')
    setError('')
    setHint('Ouvindo e preenchendo…')

    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm'
        resolve(new Blob(chunksRef.current, { type }))
      }
      recorder.onerror = () => reject(new Error('Falha ao gravar'))
      try {
        recorder.stop()
      } catch (err) {
        reject(err)
      }
    }).catch((err) => {
      console.error('[ScriptAudioCapture] stop', err)
      return null
    })

    stopCapture()

    if (!blob || blob.size < 800) {
      setPhase('idle')
      setElapsed(0)
      setHint('')
      setError('Gravação muito curta. Grave de novo o trecho da resposta.')
      return
    }

    try {
      const audioBase64 = await blobToBase64(blob)
      const fields = fieldsFromCaptureKeys(captureKeys)
      const notes = await extractScriptNotesFromAudio({
        audioBase64,
        mimeType: blob.type || 'audio/webm',
        fields,
        cardTitle,
        cardGoal,
        company,
        leadName,
      })
      const filled = Object.entries(notes).filter(([, value]) => value.trim())
      onExtracted(notes)
      setHint(
        filled.length
          ? `Preencheu ${filled.length} campo${filled.length > 1 ? 's' : ''}. Ajuste se precisar.`
          : 'Não achei resposta clara do lead. Grave de novo o trecho.',
      )
    } catch (err) {
      console.error('[ScriptAudioCapture] extract', err)
      setError('Não deu pra extrair agora. Tente de novo em alguns segundos.')
      setHint('')
    } finally {
      setPhase('idle')
      setElapsed(0)
      chunksRef.current = []
    }
  }

  if (!captureKeys.length) return null

  return (
    <div className="rounded-lg border border-border px-4 py-3" style={{ backgroundColor: 'var(--rt-paper)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Anotar por áudio</p>
        {phase === 'recording' ? (
          <span className="inline-flex items-center gap-1.5 text-sm tabular-nums text-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-status-error" aria-hidden />
            {formatElapsed(elapsed)}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {phase === 'idle' ? (
          <button
            type="button"
            onClick={() => void startRecording()}
            className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground transition-colors hover:brightness-110"
          >
            Gravar
          </button>
        ) : null}
        {phase === 'recording' ? (
          <>
            <button
              type="button"
              onClick={() => void stopAndExtract()}
              className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground transition-colors hover:brightness-110"
            >
              Enviar e preencher
            </button>
            <button
              type="button"
              onClick={cancelRecording}
              className="rounded-md border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-2"
            >
              Cancelar
            </button>
          </>
        ) : null}
        {phase === 'processing' ? (
          <button
            type="button"
            disabled
            className="cursor-wait rounded-md border border-border px-3 py-2 text-sm text-muted-foreground opacity-70"
          >
            Processando…
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-2 text-sm text-status-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-2 text-sm" style={{ color: 'var(--rt-muted)' }} role="status">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

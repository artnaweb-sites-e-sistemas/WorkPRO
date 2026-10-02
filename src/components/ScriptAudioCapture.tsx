import { useEffect, useRef, useState } from 'react'
import {
  blobToBase64,
  extractScriptNotesFromAudio,
  fieldsFromCaptureKeys,
  pickRecorderMimeType,
} from '../ai/extractScriptNotesFromAudio'

type Phase = 'idle' | 'recording' | 'processing'

/** Conexão compartilhada entre a sidebar e a janela flutuante. */
let sharedCapture: {
  stream: MediaStream
  release: () => void
} | null = null

const connectedListeners = new Set<(on: boolean) => void>()

function notifyConnected(on: boolean) {
  connectedListeners.forEach((listener) => listener(on))
}

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

async function mixAudioStreams(streams: MediaStream[]): Promise<{ stream: MediaStream; stop: () => void }> {
  const audioTracks = streams.flatMap((stream) => stream.getAudioTracks())
  if (!audioTracks.length) {
    throw new Error('no-audio')
  }

  const Context = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const context = new Context()
  if (context.state === 'suspended') {
    await context.resume()
  }
  const destination = context.createMediaStreamDestination()

  for (const stream of streams) {
    if (!stream.getAudioTracks().length) continue
    const source = context.createMediaStreamSource(stream)
    source.connect(destination)
  }

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
  compact = false,
}: {
  captureKeys: string[]
  cardTitle: string
  cardGoal: string
  company: string
  leadName: string
  onExtracted: (notes: Record<string, string>) => void
  /** Layout mais apertado pra janela flutuante */
  compact?: boolean
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [connected, setConnected] = useState(() => Boolean(sharedCapture?.stream.getAudioTracks().some((t) => t.readyState === 'live')))
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')

  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAt = useRef(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const phaseRef = useRef<Phase>('idle')
  phaseRef.current = phase

  useEffect(() => {
    const listener = (on: boolean) => setConnected(on)
    connectedListeners.add(listener)
    setConnected(Boolean(sharedCapture?.stream.getAudioTracks().some((t) => t.readyState === 'live')))
    return () => {
      connectedListeners.delete(listener)
      stopRecorderOnly()
      if (tickRef.current) clearInterval(tickRef.current)
      // Não desconecta o áudio no unmount — a outra UI (sidebar/float) pode continuar usando.
    }
  }, [])

  function stopRecorderOnly() {
    const recorder = mediaRef.current
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop()
      } catch {
        /* ignore */
      }
    }
    mediaRef.current = null
  }

  function disconnectStream() {
    sharedCapture?.release()
    sharedCapture = null
    notifyConnected(false)
  }

  async function ensureConnected(): Promise<MediaStream | null> {
    if (sharedCapture?.stream.getAudioTracks().some((track) => track.readyState === 'live')) {
      return sharedCapture.stream
    }
    disconnectStream()

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError('Este navegador não permite capturar o áudio do computador.')
      return null
    }

    let displayStream: MediaStream | null = null
    let micStream: MediaStream | null = null

    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })
      displayStream.getVideoTracks().forEach((track) => track.stop())

      if (!displayStream.getAudioTracks().length) {
        displayStream.getTracks().forEach((track) => track.stop())
        setError('Marque “Compartilhar áudio” na aba da call e tente de novo.')
        return null
      }

      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
        micStream = null
      }

      const sources = micStream ? [displayStream, micStream] : [displayStream]
      const mixed = await mixAudioStreams(sources)
      sharedCapture = { stream: mixed.stream, release: mixed.stop }
      notifyConnected(true)
      setError('')

      displayStream.getAudioTracks().forEach((track) =>
        track.addEventListener('ended', () => {
          if (phaseRef.current === 'recording') {
            void finishAndExtract()
          } else {
            disconnectStream()
            setHint('Áudio da call desconectado.')
          }
        }),
      )

      return mixed.stream
    } catch (err) {
      console.error('[ScriptAudioCapture] connect', err)
      displayStream?.getTracks().forEach((track) => track.stop())
      micStream?.getTracks().forEach((track) => track.stop())
      disconnectStream()
      const name = err instanceof Error ? err.name : ''
      if (name === 'NotAllowedError') {
        setError('Compartilhamento cancelado.')
      } else {
        setError('Não deu pra conectar o áudio. Use Chrome/Edge e compartilhe a aba com áudio.')
      }
      return null
    }
  }

  async function startRecording() {
    setError('')
    setHint('')
    if (!captureKeys.length) {
      setError('Esta ficha não tem campos para anotar.')
      return
    }

    const stream = await ensureConnected()
    if (!stream) return

    try {
      const mimeType = pickRecorderMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
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
    } catch (err) {
      console.error('[ScriptAudioCapture] record', err)
      setError('Não consegui iniciar a gravação.')
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
    mediaRef.current = null
    chunksRef.current = []
    setPhase('idle')
    setElapsed(0)
  }

  async function finishAndExtract() {
    const recorder = mediaRef.current
    if (!recorder) return
    if (recorder.state !== 'recording' && phaseRef.current !== 'recording') return

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

    mediaRef.current = null

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
          ? `Preencheu ${filled.length} campo${filled.length > 1 ? 's' : ''}.`
          : 'Não achei resposta clara. Grave de novo o trecho.',
      )
    } catch (err) {
      console.error('[ScriptAudioCapture] extract', err)
      setError('Não deu pra extrair agora. Tente de novo.')
      setHint('')
    } finally {
      setPhase('idle')
      setElapsed(0)
      chunksRef.current = []
    }
  }

  if (!captureKeys.length && !connected) return null

  const pad = compact ? 'px-3 py-2.5' : 'px-4 py-3'
  const gap = compact ? 'mt-2' : 'mt-3'

  return (
    <div className={`rounded-lg border border-border ${pad}`} style={{ backgroundColor: 'var(--rt-paper)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className={`font-semibold text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>Anotar por áudio</p>
          {connected ? (
            <p className="mt-0.5 text-[11px]" style={{ color: 'var(--rt-faint)' }}>
              Call conectada
            </p>
          ) : null}
        </div>
        {phase === 'recording' ? (
          <span className="inline-flex items-center gap-1.5 text-sm tabular-nums text-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-status-error" aria-hidden />
            {formatElapsed(elapsed)}
          </span>
        ) : null}
      </div>

      <div className={`${gap} flex flex-wrap gap-2`}>
        {phase === 'idle' ? (
          <>
            {captureKeys.length ? (
              <button
                type="button"
                onClick={() => void startRecording()}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground transition-colors hover:brightness-110"
              >
                {connected ? 'Gravar' : 'Conectar e gravar'}
              </button>
            ) : null}
            {connected ? (
              <button
                type="button"
                onClick={() => {
                  disconnectStream()
                  setHint('')
                  setError('')
                }}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                Desconectar
              </button>
            ) : null}
          </>
        ) : null}
        {phase === 'recording' ? (
          <>
            <button
              type="button"
              onClick={() => void finishAndExtract()}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground transition-colors hover:brightness-110"
            >
              Enviar e preencher
            </button>
            <button
              type="button"
              onClick={cancelRecording}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-2"
            >
              Cancelar
            </button>
          </>
        ) : null}
        {phase === 'processing' ? (
          <button
            type="button"
            disabled
            className="cursor-wait rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground opacity-70"
          >
            Processando…
          </button>
        ) : null}
      </div>

      {error ? (
        <p className={`${gap} text-sm text-status-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className={`${gap} text-sm`} style={{ color: 'var(--rt-muted)' }} role="status">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import {
  blobToBase64,
  extractScriptNotesFromAudio,
  fieldsFromCaptureKeys,
  pickRecorderMimeType,
} from '../ai/extractScriptNotesFromAudio'

type Phase = 'idle' | 'recording' | 'processing'

const BAR_COUNT = 14

/** Conexão compartilhada entre a sidebar e a janela flutuante. */
let sharedCapture: {
  stream: MediaStream
  release: () => void
  hasMic: boolean
} | null = null

const connectedListeners = new Set<(on: boolean) => void>()

function notifyConnected(on: boolean) {
  connectedListeners.forEach((listener) => listener(on))
}

/** Gravação/transcrição por ficha do roteiro (sidebar + float compartilham). */
type StageRecording = { url: string; transcript: string }
const recordingsByStage = new Map<string, StageRecording>()
const recordingListeners = new Set<() => void>()

function notifyRecordings() {
  recordingListeners.forEach((listener) => listener())
}

function setStageRecording(stageKey: string, blob: Blob, transcript = '') {
  const prev = recordingsByStage.get(stageKey)
  if (prev?.url) URL.revokeObjectURL(prev.url)
  const url = URL.createObjectURL(blob)
  recordingsByStage.set(stageKey, { url, transcript })
  notifyRecordings()
  return url
}

function patchStageTranscript(stageKey: string, transcript: string) {
  const prev = recordingsByStage.get(stageKey)
  if (!prev) {
    recordingsByStage.set(stageKey, { url: '', transcript })
  } else {
    recordingsByStage.set(stageKey, { ...prev, transcript })
  }
  notifyRecordings()
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

function AudioLevelMeter({ stream, active }: { stream: MediaStream | null; active: boolean }) {
  const [levels, setLevels] = useState<number[]>(() => Array.from({ length: BAR_COUNT }, () => 0.08))
  const rafRef = useRef(0)

  useEffect(() => {
    if (!active || !stream?.getAudioTracks().some((track) => track.readyState === 'live')) {
      setLevels(Array.from({ length: BAR_COUNT }, () => 0.08))
      return
    }

    const Context = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const context = new Context()
    const source = context.createMediaStreamSource(stream)
    const analyser = context.createAnalyser()
    analyser.fftSize = 64
    analyser.smoothingTimeConstant = 0.65
    source.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)

    void context.resume()

    const tick = () => {
      analyser.getByteFrequencyData(data)
      const next: number[] = []
      const step = Math.max(1, Math.floor(data.length / BAR_COUNT))
      for (let i = 0; i < BAR_COUNT; i++) {
        let sum = 0
        const from = i * step
        for (let j = from; j < from + step && j < data.length; j++) sum += data[j]
        const avg = sum / step / 255
        // Curva leve pra ficar mais responsivo em voz baixa.
        next.push(Math.min(1, 0.08 + Math.pow(avg, 0.7) * 0.92))
      }
      setLevels(next)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafRef.current)
      try {
        source.disconnect()
        analyser.disconnect()
      } catch {
        /* ignore */
      }
      void context.close().catch(() => undefined)
    }
  }, [active, stream])

  return (
    <div className="flex h-8 items-end gap-[3px]" aria-hidden>
      {levels.map((level, index) => (
        <span
          key={index}
          className="w-[3px] rounded-sm transition-[height] duration-75"
          style={{
            height: `${Math.max(12, level * 100)}%`,
            background:
              level > 0.72
                ? 'rgb(var(--color-accent-rgb))'
                : level > 0.28
                  ? 'rgb(52 211 153 / 0.85)'
                  : 'rgb(255 255 255 / 0.2)',
          }}
        />
      ))}
    </div>
  )
}

export function ScriptAudioCapture({
  stageKey,
  captureKeys,
  cardTitle,
  cardGoal,
  company,
  leadName,
  onExtracted,
  compact = false,
}: {
  stageKey: string
  captureKeys: string[]
  cardTitle: string
  cardGoal: string
  company: string
  leadName: string
  onExtracted: (notes: Record<string, string>) => void
  compact?: boolean
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [connected, setConnected] = useState(() =>
    Boolean(sharedCapture?.stream.getAudioTracks().some((t) => t.readyState === 'live')),
  )
  const [hasMic, setHasMic] = useState(() => Boolean(sharedCapture?.hasMic))
  const [meterStream, setMeterStream] = useState<MediaStream | null>(() => sharedCapture?.stream ?? null)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const [lastRecordingUrl, setLastRecordingUrl] = useState<string | null>(
    () => recordingsByStage.get(stageKey)?.url || null,
  )
  const [lastTranscript, setLastTranscript] = useState(() => recordingsByStage.get(stageKey)?.transcript ?? '')
  const [showRecordingModal, setShowRecordingModal] = useState(false)

  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAt = useRef(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const phaseRef = useRef<Phase>('idle')
  const stageKeyRef = useRef(stageKey)
  phaseRef.current = phase
  stageKeyRef.current = stageKey

  useEffect(() => {
    const listener = (on: boolean) => {
      setConnected(on)
      setMeterStream(on ? sharedCapture?.stream ?? null : null)
      setHasMic(Boolean(sharedCapture?.hasMic))
    }
    connectedListeners.add(listener)
    setConnected(Boolean(sharedCapture?.stream.getAudioTracks().some((t) => t.readyState === 'live')))
    setMeterStream(sharedCapture?.stream ?? null)
    setHasMic(Boolean(sharedCapture?.hasMic))
    return () => {
      connectedListeners.delete(listener)
      stopRecorderOnly()
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [])

  useEffect(() => {
    const sync = () => {
      const saved = recordingsByStage.get(stageKey)
      setLastRecordingUrl(saved?.url || null)
      setLastTranscript(saved?.transcript ?? '')
    }
    recordingListeners.add(sync)
    sync()
    setHint('')
    setError('')
    setShowRecordingModal(false)
    return () => {
      recordingListeners.delete(sync)
    }
  }, [stageKey])

  function storeRecording(blob: Blob) {
    setStageRecording(stageKeyRef.current, blob, '')
  }

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
    setMeterStream(null)
    setHasMic(false)
    notifyConnected(false)
  }

  async function ensureConnected(): Promise<MediaStream | null> {
    if (sharedCapture?.stream.getAudioTracks().some((track) => track.readyState === 'live')) {
      setMeterStream(sharedCapture.stream)
      setHasMic(sharedCapture.hasMic)
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
      sharedCapture = { stream: mixed.stream, release: mixed.stop, hasMic: Boolean(micStream) }
      setMeterStream(mixed.stream)
      setHasMic(Boolean(micStream))
      notifyConnected(true)
      setError('')
      if (!micStream) {
        setHint('Áudio da call ok. Microfone sem permissão — só o cliente entra na captura.')
      }

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

    storeRecording(blob)

    try {
      const audioBase64 = await blobToBase64(blob)
      const fields = fieldsFromCaptureKeys(captureKeys)
      const { notes, transcript } = await extractScriptNotesFromAudio({
        audioBase64,
        mimeType: blob.type || 'audio/webm',
        fields,
        cardTitle,
        cardGoal,
        company,
        leadName,
      })
      setLastTranscript(transcript)
      patchStageTranscript(stageKeyRef.current, transcript)
      const filled = Object.entries(notes).filter(([, value]) => value.trim())
      onExtracted(notes)
      setHint(
        filled.length
          ? `Preencheu ${filled.length} campo${filled.length > 1 ? 's' : ''}.`
          : 'Sem resposta clara do lead neste trecho.',
      )
    } catch (err) {
      console.error('[ScriptAudioCapture] extract', err)
      setError('Não deu pra extrair agora. Tente de novo — a gravação ficou salva.')
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
  const showMeter = connected || phase === 'recording'
  const statusRight =
    phase === 'recording'
      ? { label: formatElapsed(elapsed), live: true }
      : showMeter
        ? { label: 'Ouvindo', live: false }
        : null

  return (
    <div className={`rounded-lg border border-border ${pad}`} style={{ backgroundColor: 'var(--rt-paper)' }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`font-semibold text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>Anotar por áudio</p>
          {connected ? (
            <p className="mt-0.5 text-[11px]" style={{ color: 'var(--rt-faint)' }}>
              {hasMic ? 'Mic + áudio da call' : 'Só áudio da call'}
            </p>
          ) : null}
        </div>
        {statusRight ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] tabular-nums" style={{ color: 'var(--rt-faint)' }}>
            {statusRight.live ? <span className="h-2 w-2 animate-pulse rounded-full bg-status-error" aria-hidden /> : null}
            {statusRight.label}
          </span>
        ) : null}
      </div>

      {showMeter ? (
        <div className={gap}>
          <AudioLevelMeter stream={meterStream} active={showMeter} />
        </div>
      ) : null}

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
            {lastRecordingUrl || lastTranscript ? (
              <button
                type="button"
                onClick={() => setShowRecordingModal(true)}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-2"
              >
                Acessar gravação
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

      {showRecordingModal && (lastRecordingUrl || lastTranscript) ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal aria-labelledby="rec-modal-title">
          <div className="w-full max-w-lg rounded-lg border border-border bg-surface p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="rec-modal-title" className="text-base font-semibold text-foreground">
                  O que a IA ouviu
                </h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--rt-muted)' }}>
                  Transcrição do trecho enviado pra IA.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRecordingModal(false)}
                className="rounded-md border border-border px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                Fechar
              </button>
            </div>
            <div
              className="mt-4 max-h-56 overflow-y-auto rounded-md border border-border p-3 text-sm leading-relaxed text-foreground"
              style={{ backgroundColor: 'var(--rt-paper)' }}
            >
              {lastTranscript ? (
                <p className="whitespace-pre-wrap">{lastTranscript}</p>
              ) : (
                <p style={{ color: 'var(--rt-faint)' }}>Sem transcrição neste envio.</p>
              )}
            </div>
            {lastRecordingUrl ? (
              <audio className="mt-4 w-full" controls src={lastRecordingUrl} autoPlay>
                Seu navegador não reproduz este áudio.
              </audio>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

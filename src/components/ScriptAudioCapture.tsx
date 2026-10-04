import { useEffect, useState } from 'react'
import {
  blobToBase64,
  extractScriptNotesFromAudio,
  fieldsFromCaptureKeys,
  pickRecorderMimeType,
} from '../ai/extractScriptNotesFromAudio'

type Phase = 'idle' | 'recording' | 'processing'

const BAR_COUNT = 14
/** Intervalo entre tentativas de auto-preencher enquanto grava. */
const LIVE_EXTRACT_MS = 7500
/** Janela máxima de áudio enviada em cada tentativa (segundos de chunks ~1s). */
const LIVE_WINDOW_SECONDS = 12
const MIN_LIVE_BYTES = 2800
const MIN_FINAL_BYTES = 800

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

type CardCtx = {
  stageKey: string
  captureKeys: string[]
  cardTitle: string
  cardGoal: string
  company: string
  leadName: string
}

/**
 * Sessão de gravação global: sobrevive a Próxima/Anterior e às duas UIs (sidebar + float).
 * O áudio da call continua; só o “alvo” (ficha/campos) muda.
 */
const session = {
  phase: 'idle' as Phase,
  recorder: null as MediaRecorder | null,
  chunks: [] as Blob[],
  startedAt: 0,
  elapsed: 0,
  stageFilled: false,
  extracting: false,
  hint: '',
  error: '',
  ctx: null as CardCtx | null,
  tickTimer: null as ReturnType<typeof setInterval> | null,
  liveTimer: null as ReturnType<typeof setInterval> | null,
}

const sessionListeners = new Set<() => void>()
let notesCallback: ((notes: Record<string, string>) => void) | null = null

function bumpSession() {
  sessionListeners.forEach((listener) => listener())
}

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function clearTimers() {
  if (session.tickTimer) {
    clearInterval(session.tickTimer)
    session.tickTimer = null
  }
  if (session.liveTimer) {
    clearInterval(session.liveTimer)
    session.liveTimer = null
  }
}

/** Blob completo da ficha (para salvar / modal). */
function snapshotBlob(): Blob | null {
  if (!session.chunks.length) return null
  const type = session.recorder?.mimeType || 'audio/webm'
  return new Blob(session.chunks, { type })
}

/**
 * Janela curta pro live extract: 1º chunk (header WebM) + últimos N segundos.
 * Evita reenviar o áudio inteiro da ficha a cada tentativa.
 */
function snapshotLiveWindowBlob(): Blob | null {
  const chunks = session.chunks
  if (!chunks.length) return null
  const type = session.recorder?.mimeType || 'audio/webm'
  if (chunks.length <= LIVE_WINDOW_SECONDS + 1) {
    return new Blob(chunks, { type })
  }
  const header = chunks[0]
  const tail = chunks.slice(-LIVE_WINDOW_SECONDS)
  return new Blob([header, ...tail], { type })
}

async function stopRecorderToBlob(recorder: MediaRecorder): Promise<Blob | null> {
  return new Promise((resolve) => {
    recorder.onstop = () => {
      const type = recorder.mimeType || 'audio/webm'
      const blob = new Blob(session.chunks, { type })
      resolve(blob.size ? blob : null)
    }
    recorder.onerror = () => resolve(null)
    try {
      if (recorder.state !== 'inactive') recorder.stop()
      else resolve(session.chunks.length ? new Blob(session.chunks, { type: recorder.mimeType || 'audio/webm' }) : null)
    } catch {
      resolve(null)
    }
  })
}

function startTimers() {
  clearTimers()
  session.tickTimer = setInterval(() => {
    session.elapsed = Date.now() - session.startedAt
    bumpSession()
  }, 250)
  session.liveTimer = setInterval(() => {
    void tryLiveExtract()
  }, LIVE_EXTRACT_MS)
}

function beginRecorder(stream: MediaStream) {
  const mimeType = pickRecorderMimeType()
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
  session.chunks = []
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) session.chunks.push(event.data)
  }
  session.recorder = recorder
  recorder.start(1000)
}

async function rotateToStage(next: CardCtx) {
  const prev = session.ctx
  const stageChanged = !prev || prev.stageKey !== next.stageKey
  const wasRecording = session.phase === 'recording' && session.recorder

  if (wasRecording && stageChanged && prev) {
    const recorder = session.recorder!
    const blob = await stopRecorderToBlob(recorder)
    session.recorder = null
    if (blob && blob.size >= MIN_FINAL_BYTES) {
      const prevTranscript = recordingsByStage.get(prev.stageKey)?.transcript ?? ''
      setStageRecording(prev.stageKey, blob, prevTranscript)
    }
    if (sharedCapture?.stream) {
      beginRecorder(sharedCapture.stream)
    }
  }

  session.ctx = next
  if (stageChanged) {
    session.stageFilled = false
    if (session.phase === 'recording') {
      session.hint = next.captureKeys.length
        ? 'Gravando — preenche sozinho quando o lead responder.'
        : 'Gravando (esta ficha não tem campo pra anotar).'
      session.error = ''
    }
  }
  bumpSession()
}

async function tryLiveExtract(force = false) {
  const ctx = session.ctx
  if (session.phase !== 'recording' || !ctx) return
  if (!force && session.stageFilled) return
  if (session.extracting) return
  if (!ctx.captureKeys.length) return

  const blob = force ? snapshotBlob() : snapshotLiveWindowBlob()
  if (!blob || blob.size < (force ? MIN_FINAL_BYTES : MIN_LIVE_BYTES)) return

  session.extracting = true
  if (!session.stageFilled) session.hint = 'Ouvindo e preenchendo…'
  bumpSession()

  const stageKey = ctx.stageKey
  try {
    const audioBase64 = await blobToBase64(blob)
    const fields = fieldsFromCaptureKeys(ctx.captureKeys)
    const { notes, transcript } = await extractScriptNotesFromAudio({
      audioBase64,
      mimeType: blob.type || 'audio/webm',
      fields,
      cardTitle: ctx.cardTitle,
      cardGoal: ctx.cardGoal,
      company: ctx.company,
      leadName: ctx.leadName,
    })

    // Só aplica se ainda estamos na mesma ficha (evita corrida com Próxima).
    if (session.ctx?.stageKey !== stageKey) return

    // Modal/gravação: guarda o trecho completo da ficha (não só a janela).
    const fullBlob = snapshotBlob() || blob
    setStageRecording(stageKey, fullBlob, transcript)
    patchStageTranscript(stageKey, transcript)

    const filled = Object.entries(notes).filter(([, value]) => value.trim())
    if (filled.length) {
      notesCallback?.(notes)
      session.stageFilled = true
      session.hint = `Preencheu ${filled.length} campo${filled.length > 1 ? 's' : ''}. Pode ir pra próxima.`
      session.error = ''
    } else if (force) {
      session.hint = 'Sem resposta clara do lead neste trecho.'
    } else {
      session.hint = 'Ouvindo o lead…'
    }
  } catch (err) {
    console.error('[ScriptAudioCapture] live extract', err)
    if (force) {
      session.error = 'Não deu pra extrair agora. Continua gravando — tente de novo.'
      session.hint = ''
    }
  } finally {
    session.extracting = false
    bumpSession()
  }
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
    let frame = 0

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
        next.push(Math.min(1, 0.08 + Math.pow(avg, 0.7) * 0.92))
      }
      setLevels(next)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
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
  const [, setTick] = useState(0)
  const [connected, setConnected] = useState(() =>
    Boolean(sharedCapture?.stream.getAudioTracks().some((t) => t.readyState === 'live')),
  )
  const [hasMic, setHasMic] = useState(() => Boolean(sharedCapture?.hasMic))
  const [meterStream, setMeterStream] = useState<MediaStream | null>(() => sharedCapture?.stream ?? null)
  const [lastRecordingUrl, setLastRecordingUrl] = useState<string | null>(
    () => recordingsByStage.get(stageKey)?.url || null,
  )
  const [lastTranscript, setLastTranscript] = useState(() => recordingsByStage.get(stageKey)?.transcript ?? '')
  const [showRecordingModal, setShowRecordingModal] = useState(false)

  useEffect(() => {
    const onSession = () => setTick((n) => n + 1)
    sessionListeners.add(onSession)
    notesCallback = onExtracted
    return () => {
      sessionListeners.delete(onSession)
      if (notesCallback === onExtracted) notesCallback = null
    }
  }, [onExtracted])

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
      // Não para a gravação no unmount — a sessão é global (Próxima / float).
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
    setShowRecordingModal(false)
    return () => {
      recordingListeners.delete(sync)
    }
  }, [stageKey])

  const captureKeysKey = captureKeys.join(',')

  useEffect(() => {
    void rotateToStage({
      stageKey,
      captureKeys,
      cardTitle,
      cardGoal,
      company,
      leadName,
    })
    // captureKeysKey evita re-rodar quando o pai passa `?? []` novo a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- captura estabilizada por join
  }, [stageKey, captureKeysKey, cardTitle, cardGoal, company, leadName])

  function disconnectStream() {
    void stopRecordingSession({ save: false })
    sharedCapture?.release()
    sharedCapture = null
    setMeterStream(null)
    setHasMic(false)
    notifyConnected(false)
    session.hint = ''
    session.error = ''
    bumpSession()
  }

  async function ensureConnected(): Promise<MediaStream | null> {
    if (sharedCapture?.stream.getAudioTracks().some((track) => track.readyState === 'live')) {
      setMeterStream(sharedCapture.stream)
      setHasMic(sharedCapture.hasMic)
      return sharedCapture.stream
    }
    disconnectStream()

    if (!navigator.mediaDevices?.getDisplayMedia) {
      session.error = 'Este navegador não permite capturar o áudio do computador.'
      bumpSession()
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
        session.error = 'Marque “Compartilhar áudio” na aba da call e tente de novo.'
        bumpSession()
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
      session.error = ''
      if (!micStream) {
        session.hint = 'Áudio da call ok. Microfone sem permissão — só o cliente entra na captura.'
      }
      bumpSession()

      displayStream.getAudioTracks().forEach((track) =>
        track.addEventListener('ended', () => {
          if (session.phase === 'recording') {
            void stopRecordingSession({ save: true, extract: true })
          } else {
            disconnectStream()
            session.hint = 'Áudio da call desconectado.'
            bumpSession()
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
      session.error = name === 'NotAllowedError'
        ? 'Compartilhamento cancelado.'
        : 'Não deu pra conectar o áudio. Use Chrome/Edge e compartilhe a aba com áudio.'
      bumpSession()
      return null
    }
  }

  async function startRecording() {
    session.error = ''
    session.hint = ''
    bumpSession()

    if (!captureKeys.length) {
      session.error = 'Esta ficha não tem campos para anotar.'
      bumpSession()
      return
    }
    if (session.phase === 'recording') return

    const stream = await ensureConnected()
    if (!stream) return

    try {
      session.ctx = {
        stageKey,
        captureKeys,
        cardTitle,
        cardGoal,
        company,
        leadName,
      }
      session.stageFilled = false
      session.startedAt = Date.now()
      session.elapsed = 0
      beginRecorder(stream)
      startTimers()
      session.phase = 'recording'
      session.hint = 'Gravando — preenche sozinho quando o lead responder.'
      bumpSession()
      // Primeira tentativa um pouco antes do intervalo cheio.
      window.setTimeout(() => void tryLiveExtract(), 3200)
    } catch (err) {
      console.error('[ScriptAudioCapture] record', err)
      session.error = 'Não consegui iniciar a gravação.'
      session.phase = 'idle'
      bumpSession()
    }
  }

  async function stopRecordingSession(opts: { save: boolean; extract?: boolean }) {
    clearTimers()
    const recorder = session.recorder
    const ctx = session.ctx
    session.recorder = null

    if (!recorder) {
      session.phase = 'idle'
      session.elapsed = 0
      session.chunks = []
      bumpSession()
      return
    }

    if (opts.extract && ctx?.captureKeys.length && !session.stageFilled) {
      session.phase = 'processing'
      session.hint = 'Ouvindo e preenchendo…'
      bumpSession()
    }

    const blob = await stopRecorderToBlob(recorder)
    session.chunks = []

    if (opts.save && blob && blob.size >= MIN_FINAL_BYTES && ctx) {
      setStageRecording(ctx.stageKey, blob, recordingsByStage.get(ctx.stageKey)?.transcript ?? '')
    }

    if (opts.extract && blob && blob.size >= MIN_FINAL_BYTES && ctx?.captureKeys.length && !session.stageFilled) {
      try {
        const audioBase64 = await blobToBase64(blob)
        const fields = fieldsFromCaptureKeys(ctx.captureKeys)
        const { notes, transcript } = await extractScriptNotesFromAudio({
          audioBase64,
          mimeType: blob.type || 'audio/webm',
          fields,
          cardTitle: ctx.cardTitle,
          cardGoal: ctx.cardGoal,
          company: ctx.company,
          leadName: ctx.leadName,
        })
        setStageRecording(ctx.stageKey, blob, transcript)
        notesCallback?.(notes)
        const filled = Object.entries(notes).filter(([, value]) => value.trim())
        session.hint = filled.length
          ? `Preencheu ${filled.length} campo${filled.length > 1 ? 's' : ''}.`
          : 'Sem resposta clara do lead neste trecho.'
        session.stageFilled = filled.length > 0
      } catch (err) {
        console.error('[ScriptAudioCapture] final extract', err)
        session.error = 'Não deu pra extrair agora. A gravação ficou salva.'
        session.hint = ''
      }
    } else if (opts.save && !opts.extract) {
      session.hint = ''
    }

    session.phase = 'idle'
    session.elapsed = 0
    session.extracting = false
    bumpSession()
  }

  const phase = session.phase
  const elapsed = session.elapsed
  const hint = session.hint
  const error = session.error
  const stageFilled = session.stageFilled
  const extracting = session.extracting

  if (!captureKeys.length && !connected && phase === 'idle') return null

  const pad = compact ? 'px-3 py-2.5' : 'px-4 py-3'
  const gap = compact ? 'mt-2' : 'mt-3'
  const showMeter = connected || phase === 'recording'
  const statusRight =
    phase === 'recording'
      ? {
          label: stageFilled ? 'Preenchido' : extracting ? 'Extraindo…' : formatElapsed(elapsed),
          live: !stageFilled,
        }
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
              {hasMic ? 'Mic + áudio da call · gravação contínua' : 'Só áudio da call · gravação contínua'}
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
            {!stageFilled ? (
              <button
                type="button"
                disabled={extracting}
                onClick={() => void tryLiveExtract(true)}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground transition-colors hover:brightness-110 disabled:opacity-60"
              >
                {extracting ? 'Preenchendo…' : 'Enviar agora'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void stopRecordingSession({ save: true, extract: false })}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-2"
            >
              Parar gravação
            </button>
            {lastRecordingUrl || lastTranscript || stageFilled ? (
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
                  Transcrição do trecho desta ficha.
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
              <audio className="mt-4 w-full" controls src={lastRecordingUrl}>
                Seu navegador não reproduz este áudio.
              </audio>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

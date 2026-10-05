import { useEffect, useState } from 'react'
import {
  blobToBase64,
  extractScriptNotesFromAudio,
  fieldsFromCaptureKeys,
  pickRecorderMimeType,
} from '../ai/extractScriptNotesFromAudio'

type Phase = 'idle' | 'recording' | 'processing'

const BAR_COUNT = 14
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

type CardCtx = {
  stageKey: string
  stageIndex: number
  captureKeys: string[]
  cardTitle: string
  cardGoal: string
  company: string
  leadName: string
}

type ExtractOpts = { overwrite: boolean }
type NotesCallback = (notes: Record<string, string>, opts: ExtractOpts) => void

/**
 * Sessão global: sobrevive a Próxima/Anterior e às duas UIs.
 * Extract só no envio manual ou ao sair da ficha (segundo plano, sem sobrescrever).
 */
const session = {
  phase: 'idle' as Phase,
  recorder: null as MediaRecorder | null,
  /** Chunks do gravador ativo (array local do beginRecorder). */
  recorderChunks: null as Blob[] | null,
  startedAt: 0,
  elapsed: 0,
  /** Depois de um envio (ou gravação ativa), avançar pode auto-iniciar gravação. */
  continueOnNext: false,
  hint: '',
  error: '',
  ctx: null as CardCtx | null,
  tickTimer: null as ReturnType<typeof setInterval> | null,
}

const sessionListeners = new Set<() => void>()
let notesCallback: NotesCallback | null = null
let latestNotes: Record<string, string> = {}
let rotateSeq = 0

function bumpSession() {
  sessionListeners.forEach((listener) => listener())
}

function isAnswered(keys: string[]): boolean {
  return keys.length > 0 && keys.every((k) => (latestNotes[k] ?? '').trim() !== '')
}

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function clearTickTimer() {
  if (session.tickTimer) {
    clearInterval(session.tickTimer)
    session.tickTimer = null
  }
}

async function stopRecorderToBlob(recorder: MediaRecorder, chunks: Blob[]): Promise<Blob | null> {
  return new Promise((resolve) => {
    recorder.onstop = () => {
      const type = recorder.mimeType || 'audio/webm'
      const blob = new Blob(chunks, { type })
      resolve(blob.size ? blob : null)
    }
    recorder.onerror = () => resolve(null)
    try {
      if (recorder.state !== 'inactive') recorder.stop()
      else {
        resolve(chunks.length ? new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }) : null)
      }
    } catch {
      resolve(null)
    }
  })
}

function startTickTimer() {
  clearTickTimer()
  session.tickTimer = setInterval(() => {
    session.elapsed = Date.now() - session.startedAt
    bumpSession()
  }, 250)
}

function beginRecorder(stream: MediaStream): { recorder: MediaRecorder; chunks: Blob[] } {
  const mimeType = pickRecorderMimeType()
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
  const chunks: Blob[] = []
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }
  session.recorder = recorder
  session.recorderChunks = chunks
  recorder.start(1000)
  return { recorder, chunks }
}

function startRecordingWithStream(stream: MediaStream, ctx: CardCtx, hint: string) {
  session.ctx = ctx
  session.startedAt = Date.now()
  session.elapsed = 0
  session.error = ''
  beginRecorder(stream)
  startTickTimer()
  session.phase = 'recording'
  session.continueOnNext = true
  session.hint = hint
  bumpSession()
}

async function extractBlobForCtx(
  ctx: CardCtx,
  blob: Blob,
  source: 'manual' | 'leave' | 'ended',
): Promise<void> {
  const background = source === 'leave' || source === 'ended'
  const overwrite = source === 'manual'

  if (!ctx.captureKeys.length || blob.size < MIN_FINAL_BYTES) {
    if (blob.size >= MIN_FINAL_BYTES) {
      setStageRecording(ctx.stageKey, blob, recordingsByStage.get(ctx.stageKey)?.transcript ?? '')
    }
    if (!ctx.captureKeys.length && source === 'manual') {
      session.hint = 'Sem campos nesta ficha.'
      if (!background) bumpSession()
    }
    return
  }

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

    const filtered: Record<string, string> = {}
    for (const key of ctx.captureKeys) {
      const value = (notes[key] ?? '').trim()
      if (!value) continue
      if (!overwrite && (latestNotes[key] ?? '').trim() !== '') continue
      filtered[key] = value
    }

    const aiHadAnswer = ctx.captureKeys.some((key) => (notes[key] ?? '').trim() !== '')
    const filledCount = Object.keys(filtered).length
    notesCallback?.(filtered, { overwrite })

    let hint = ''
    if (source === 'manual') {
      hint = filledCount
        ? `Preencheu ${filledCount} campo${filledCount > 1 ? 's' : ''}. Próxima já grava sozinha.`
        : 'Sem resposta clara do lead. Próxima ainda assim pode gravar de novo.'
    } else if (filledCount > 0) {
      hint = `Preencheu ${filledCount} campo${filledCount > 1 ? 's' : ''} em "${ctx.cardTitle}".`
    } else if (aiHadAnswer) {
      hint = `"${ctx.cardTitle}" já tinha resposta; nada foi trocado.`
    } else {
      hint = `"${ctx.cardTitle}": sem resposta clara do lead.`
    }
    if (source === 'ended') {
      hint = `Áudio da call desconectado. ${hint}`
    }

    session.hint = hint
    session.error = ''
    bumpSession()
  } catch (err) {
    console.error('[ScriptAudioCapture] extract', err)
    setStageRecording(ctx.stageKey, blob, '')
    session.error =
      source === 'manual'
        ? 'Não deu pra extrair agora. A gravação ficou salva.'
        : `Não deu pra extrair "${ctx.cardTitle}". A gravação ficou salva.`
    session.hint = ''
    bumpSession()
  }
}

async function rotateToStage(next: CardCtx) {
  const prev = session.ctx
  const stageChanged = !prev || prev.stageKey !== next.stageKey
  if (!stageChanged) {
    session.ctx = next
    bumpSession()
    return
  }

  const seq = ++rotateSeq
  const forward = !prev || next.stageIndex > prev.stageIndex
  const wasRecording = session.phase === 'recording' && session.recorder
  const shouldAutoStart =
    forward &&
    Boolean(sharedCapture?.stream) &&
    next.captureKeys.length > 0 &&
    (wasRecording || session.continueOnNext) &&
    !isAnswered(next.captureKeys)

  if (wasRecording && prev) {
    const recorder = session.recorder!
    const chunks = session.recorderChunks ?? []
    session.recorder = null
    session.recorderChunks = null
    clearTickTimer()
    const blob = await stopRecorderToBlob(recorder, chunks)
    if (blob && blob.size >= MIN_FINAL_BYTES) {
      void extractBlobForCtx(prev, blob, 'leave')
    }
  }

  if (seq !== rotateSeq) return

  session.ctx = next

  if (shouldAutoStart && sharedCapture?.stream) {
    startRecordingWithStream(
      sharedCapture.stream,
      next,
      'Gravando esta ficha — envie quando o lead responder.',
    )
    return
  }

  session.phase = 'idle'
  session.elapsed = 0

  const connected = Boolean(sharedCapture?.stream?.getAudioTracks().some((t) => t.readyState === 'live'))
  if (connected && next.captureKeys.length && isAnswered(next.captureKeys)) {
    session.hint = 'Esta ficha já tem resposta. Para regravar, clique em Gravar: só os campos dela mudam.'
  } else if (connected && !forward && next.captureKeys.length) {
    session.hint = 'Voltou uma ficha: a gravação fica parada. Clique em Gravar se quiser regravar.'
  } else if (session.continueOnNext && next.captureKeys.length) {
    session.hint = 'Áudio conectado. Clique em Gravar ou avance com a sessão ativa.'
  } else {
    session.hint = ''
  }
  bumpSession()
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
  stageIndex,
  captureKeys,
  cardTitle,
  cardGoal,
  company,
  leadName,
  notes,
  onExtracted,
  compact = false,
}: {
  stageKey: string
  stageIndex: number
  captureKeys: string[]
  cardTitle: string
  cardGoal: string
  company: string
  leadName: string
  notes: Record<string, string>
  onExtracted: NotesCallback
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

  useEffect(() => {
    latestNotes = notes
  }, [notes])

  const captureKeysKey = captureKeys.join(',')

  useEffect(() => {
    void rotateToStage({
      stageKey,
      stageIndex,
      captureKeys,
      cardTitle,
      cardGoal,
      company,
      leadName,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- captura estabilizada por join
  }, [stageKey, stageIndex, captureKeysKey, cardTitle, cardGoal, company, leadName])

  function disconnectStream() {
    void stopRecordingSession({ mode: 'discard' })
    session.continueOnNext = false
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
          void (async () => {
            if (session.phase === 'recording' && session.recorder) {
              const recorder = session.recorder
              const chunks = session.recorderChunks ?? []
              const ctx = session.ctx
              session.recorder = null
              session.recorderChunks = null
              clearTickTimer()
              const blob = await stopRecorderToBlob(recorder, chunks)
              if (ctx && blob && blob.size >= MIN_FINAL_BYTES) {
                void extractBlobForCtx(ctx, blob, 'ended')
              }
            }
            disconnectStream()
            if (!session.hint) {
              session.hint = 'Áudio da call desconectado.'
              bumpSession()
            }
          })()
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
    if (session.phase === 'recording' || session.phase === 'processing') return

    const stream = await ensureConnected()
    if (!stream) return

    try {
      startRecordingWithStream(
        stream,
        { stageKey, stageIndex, captureKeys, cardTitle, cardGoal, company, leadName },
        'Gravando — envie quando o lead responder.',
      )
    } catch (err) {
      console.error('[ScriptAudioCapture] record', err)
      session.error = 'Não consegui iniciar a gravação.'
      session.phase = 'idle'
      bumpSession()
    }
  }

  async function stopRecordingSession(opts: { mode: 'send' | 'stop' | 'discard' }) {
    clearTickTimer()
    const recorder = session.recorder
    const chunks = session.recorderChunks ?? []
    const ctx = session.ctx
    session.recorder = null
    session.recorderChunks = null

    if (!recorder) {
      if (opts.mode === 'stop' || opts.mode === 'discard') {
        session.continueOnNext = opts.mode === 'stop' ? false : session.continueOnNext
        if (opts.mode === 'discard') session.continueOnNext = false
      }
      session.phase = 'idle'
      session.elapsed = 0
      bumpSession()
      return
    }

    if (opts.mode === 'send') {
      session.phase = 'processing'
      session.hint = 'Ouvindo e preenchendo…'
      bumpSession()
    }

    const blob = await stopRecorderToBlob(recorder, chunks)

    if (opts.mode === 'discard') {
      session.phase = 'idle'
      session.elapsed = 0
      session.continueOnNext = false
      session.hint = ''
      bumpSession()
      return
    }

    if (opts.mode === 'stop') {
      if (blob && blob.size >= MIN_FINAL_BYTES && ctx) {
        setStageRecording(ctx.stageKey, blob, recordingsByStage.get(ctx.stageKey)?.transcript ?? '')
      }
      session.phase = 'idle'
      session.elapsed = 0
      session.continueOnNext = false
      session.hint = 'Gravação parada.'
      bumpSession()
      return
    }

    if (!blob || blob.size < MIN_FINAL_BYTES) {
      session.phase = 'idle'
      session.elapsed = 0
      session.error = 'Gravação muito curta. Grave de novo o trecho da resposta.'
      session.hint = ''
      bumpSession()
      return
    }

    if (!ctx) {
      session.phase = 'idle'
      session.elapsed = 0
      session.hint = ''
      bumpSession()
      return
    }

    await extractBlobForCtx(ctx, blob, 'manual')
    session.continueOnNext = true
    session.phase = 'idle'
    session.elapsed = 0
    bumpSession()
  }

  const phase = session.phase
  const elapsed = session.elapsed
  const hint = session.hint
  const error = session.error

  if (!captureKeys.length && !connected && phase === 'idle') return null

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
              {session.continueOnNext ? ' · Próxima grava sozinha' : ''}
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
            <button
              type="button"
              onClick={() => void stopRecordingSession({ mode: 'send' })}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground transition-colors hover:brightness-110"
            >
              Enviar e preencher
            </button>
            <button
              type="button"
              onClick={() => void stopRecordingSession({ mode: 'stop' })}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-2"
            >
              Parar
            </button>
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
                  Transcrição do trecho enviado nesta ficha.
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

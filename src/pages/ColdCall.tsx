import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SCRIPT_THEME_CSS } from '../components/scriptTheme'
import { Spinner } from '../components/ui'
import {
  AFTER_MEETING_STEPS,
  CALL_FIELDS,
  CALL_MESSAGES,
  CALL_NODES,
  CALL_OBJECTIONS,
  CALL_RECEPTION_OBJECTIONS,
  CALL_OUTCOMES,
  CALL_START,
  fillCallText,
} from '../lib/coldCallScript'
import type { CallChoice, CallLine, CallNode, CallOutcome } from '../lib/coldCallScript'
import { parseKeyQuestion } from '../lib/pilotoScript'
import { ColdCallIdeas } from '../components/ColdCallIdeas'
import type { ProspectSuggestion } from '../ai/suggestProspecting'
import { announceColdCallReady, readExtensionLead, syncColdCallsToExtension } from '../lib/coldCallExtension'
import type { ExtensionLead } from '../lib/coldCallExtension'
import { adaptColdCallNiche } from '../ai/adaptColdCallNiche'
import {
  createColdCall,
  findColdCallDuplicates,
  getCachedNiche,
  listCallbacks,
  listColdCalls,
  saveCachedNiche,
  updateColdCall,
} from '../services/coldCalls'
import type { ColdCallNiche } from '../ai/adaptColdCallNiche'
import { getProposalDefaults } from '../services/proposalDefaults'
import type { ColdCall, ColdCallData } from '../types/coldCall'
import { companyKeyOf, phoneKeyOf, reachedOwner } from '../types/coldCall'

const SAVE_DELAY = 800
/** Suba quando mudar a instrução em adaptColdCallNiche. */
const NICHE_VERSION = 2

/** "Pilates " e "pilates" são o mesmo nicho: sem acento, minúscula, com a versão da instrução. */
function nicheKeyOf(nicho: string): string {
  const slug = nicho
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug ? `v${NICHE_VERSION}-${slug}` : ''
}

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

const EMPTY_CALL: ColdCallData = {
  notes: {},
  nodeId: CALL_START,
  path: [],
  outcome: null,
  done: [],
  startedAtMs: 0,
  attempts: 1,
}

/** Passam de uma ligação para a próxima: normalmente você liga para vários do mesmo nicho. */
const CARRIED_NOTES = ['nicho', 'cidade', 'nichoSig', 'grupo', 'clientes', 'dor1', 'dor2']

type Mode = 'call' | 'history' | 'ideas'
type HistoryFilter = 'todas' | 'pendentes' | CallOutcome

const SIDE_LIST_MAX = 5

/** Mais recente primeiro, sem repetir (a versão que veio por último vale). */
function mergeCalls(current: ColdCall[], incoming: ColdCall[]): ColdCall[] {
  const byId = new Map(current.map((item) => [item.id, item]))
  for (const item of incoming) byId.set(item.id, item)
  return [...byId.values()].sort((a, b) => b.startedAtMs - a.startedAtMs)
}

function dayLabel(ms: number): string {
  const date = new Date(ms)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Hoje'
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem'
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }).replace(/^./, (c) => c.toUpperCase())
}

const OUTCOME_COLOR: Record<'good' | 'warn' | 'muted', string> = {
  good: 'var(--c4-fg)',
  warn: 'var(--c5-fg)',
  muted: 'var(--rt-faint)',
}

/** Troca {chave} pela anotação colorida e [pista] por texto apagado. */
function renderFilled(text: string, notes: Record<string, string>): ReactNode[] {
  return text.split(/(\{\w+\}|\[[^\]]+\])/g).map((piece, index) => {
    const key = piece.match(/^\{(\w+)\}$/)?.[1]
    if (key) {
      const field = CALL_FIELDS[key]
      if (!field) {
        return null
      }
      const value = (notes[key] ?? '').trim()
      // Trecho escrito pela IA: é roteiro, não anotação.
      if (field.fallback !== undefined) {
        return value || field.fallback
      }
      if (!field.color) {
        return value ? (
          <strong key={index} className="font-semibold text-foreground">
            {value}
          </strong>
        ) : (
          <span key={index} className="pill empty c2">
            {field.label.toLowerCase()}
          </span>
        )
      }
      return (
        <span key={index} className={`pill ${field.color}${value ? '' : ' empty'}`}>
          {value || field.label.toLowerCase()}
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
    return piece
  })
}

function Line({ text, notes }: { text: string; notes: Record<string, string> }) {
  const [main, tip] = text.split('#')
  return (
    <>
      <span>{renderFilled(main, notes)}</span>
      {tip ? (
        <span className="mt-1 block text-sm" style={{ color: 'var(--rt-muted)' }}>
          {tip}
        </span>
      ) : null}
    </>
  )
}

const keyBorder = (key: string | null) =>
  key && CALL_FIELDS[key]?.color ? `var(--${CALL_FIELDS[key].color}-fg)` : key ? 'var(--rt-ink)' : 'var(--rt-rule)'

function KeyTag({ fieldKey }: { fieldKey: string }) {
  const field = CALL_FIELDS[fieldKey]
  if (!field) return null
  return (
    <span className={`pill ${field.color ?? 'c2'} mt-1.5 inline-block text-xs`}>Espere e anote: {field.label.toLowerCase()}</span>
  )
}

function lineText(line: CallLine): string {
  return typeof line === 'string' ? line : line.text
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1800)
          })
          .catch(() => setCopied(false))
      }}
      className="whitespace-nowrap rounded border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-surface-2"
    >
      {copied ? 'Copiado' : 'Copiar mensagem'}
    </button>
  )
}

function MessageBlock({ template, notes }: { template: string; notes: Record<string, string> }) {
  const text = fillCallText(template, notes)
  return (
    <div className="mt-2 grid gap-2">
      <p className="border-l-2 pl-3 text-sm leading-relaxed" style={{ borderColor: 'var(--rt-rule)', color: 'var(--rt-muted)' }}>
        {renderFilled(template, notes)}
      </p>
      <div>
        <CopyButton text={text} />
      </div>
    </div>
  )
}

/** Link tel: com DDI do Brasil quando o número vem só com DDD. */
function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 8) return ''
  if (digits.startsWith('55') && digits.length >= 12) return `tel:+${digits}`
  if (digits.length === 10 || digits.length === 11) return `tel:+55${digits}`
  return `tel:${digits}`
}

/** Botão de discar: só habilita com um número completo o bastante. */
function CallLink({ phone }: { phone: string }) {
  const href = telHref(phone)
  const base = 'flex shrink-0 items-center whitespace-nowrap rounded-md px-4 text-sm font-semibold transition-colors'
  return href ? (
    <a href={href} className={`${base} border border-border text-foreground hover:bg-surface-2`} aria-label={`Ligar para ${phone}`}>
      Ligar
    </a>
  ) : (
    <span className={`${base} border border-border text-muted-foreground opacity-50`} aria-disabled="true" title="Digite o telefone para ligar">
      Ligar
    </span>
  )
}

/** Telefone no gancho: recusou e desligou. */
function HangUpIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
    </svg>
  )
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function ColdCall() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [calls, setCalls] = useState<ColdCall[]>([])
  const [call, setCall] = useState<ColdCallData>(EMPTY_CALL)
  const [callId, setCallId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [seller, setSeller] = useState({ eu: '', agencia: '' })
  const [openObjection, setOpenObjection] = useState<number | null>(null)
  const [triedToStart, setTriedToStart] = useState(false)
  const [adaptingNiche, setAdaptingNiche] = useState(false)
  const [mode, setMode] = useState<Mode>('call')
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('todas')
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  /** data da mais antiga já carregada pela paginação */
  const cursorMs = useRef<number | undefined>(undefined)
  const [duplicates, setDuplicates] = useState<ColdCall[]>([])
  /** abriu uma ligação existente: não grava só por ter aberto */
  const skipSave = useRef(false)
  /** nichos já resolvidos nesta sessão: nem o Firestore é consultado de novo */
  const nicheMemory = useRef(new Map<string, ColdCallNiche>())

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const creating = useRef<Promise<string> | null>(null)
  /** muda a cada ligação nova: gravação atrasada da anterior não mexe na atual */
  const session = useRef(0)
  const latest = useRef({ call, callId })
  latest.current = { call, callId }

  useEffect(() => {
    let cancelled = false
    Promise.all([listColdCalls(), listCallbacks(), getProposalDefaults()])
      .then(([page, callbacksList, defaults]) => {
        if (cancelled) return
        setCalls(mergeCalls(page.items, callbacksList))
        setHasMore(page.hasMore)
        cursorMs.current = page.items[page.items.length - 1]?.startedAtMs
        setSeller({ eu: defaults.professionalName.trim(), agencia: defaults.companyName.trim() })
      })
      .catch((error) => console.error('[ColdCall] load', error))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  /** Grava a ligação; a primeira gravação cria o documento. */
  async function persist(data: ColdCallData, id: string | null) {
    const token = session.current
    const current = () => session.current === token
    setSaveState('saving')
    try {
      let savedId = id
      let saved = data
      if (!savedId) {
        if (!creating.current) {
          creating.current = createColdCall(data)
        }
        savedId = await creating.current
        creating.current = null
        if (current()) {
          setCallId(savedId)
          latest.current = { ...latest.current, callId: savedId }
          // Mudou algo enquanto criava: grava o mais recente.
          if (latest.current.call !== data) {
            saved = latest.current.call
            await updateColdCall(savedId, saved)
          }
        }
      } else {
        await updateColdCall(savedId, data)
      }
      const doneId = savedId
      setCalls((list) => mergeCalls(list, [{ id: doneId, ...saved }]))
      if (current()) setSaveState('saved')
    } catch (error) {
      console.error('[ColdCall] save', error)
      if (current()) setSaveState('error')
    }
  }

  // Salva sozinho: só depois que a ligação começou (saiu do preparo).
  useEffect(() => {
    const started = call.nodeId !== CALL_START || call.outcome !== null
    if (!started) {
      return
    }
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    setSaveState('pending')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void persist(latest.current.call, latest.current.callId)
    }, SAVE_DELAY)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
    // persist lê refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call])

  // Definiu o nicho: a IA escreve como chamar o grupo, os clientes e as duas dores.
  // Cada nicho é gerado uma vez e fica guardado; as próximas ligações reaproveitam.
  const nicheKey = nicheKeyOf(call.notes.nicho ?? '')
  const nicheSig = call.notes.nichoSig ?? ''

  async function resolveNiche(nicho: string, key: string, force: boolean): Promise<ColdCallNiche | null> {
    if (!force) {
      const remembered = nicheMemory.current.get(key)
      if (remembered) return remembered
      const cached = await getCachedNiche(key).catch((error) => {
        console.error('[ColdCall] niche cache', error)
        return null
      })
      if (cached) {
        nicheMemory.current.set(key, cached)
        return cached
      }
    }
    const fresh = await adaptColdCallNiche({ nicho })
    if (fresh) {
      nicheMemory.current.set(key, fresh)
      void saveCachedNiche(key, fresh).catch((error) => console.error('[ColdCall] niche save', error))
    }
    return fresh
  }

  function loadNiche(force: boolean) {
    const token = session.current
    const nicho = (latest.current.call.notes.nicho ?? '').trim()
    const key = nicheKeyOf(nicho)
    if (!key) return
    setAdaptingNiche(true)
    resolveNiche(nicho, key, force)
      .then((niche) => {
        if (session.current !== token) return
        setCall((current) => {
          // Mudou o nicho enquanto buscava: esta resposta não vale mais.
          if (nicheKeyOf(current.notes.nicho ?? '') !== key) return current
          return {
            ...current,
            notes: {
              ...current.notes,
              nichoSig: key,
              grupo: niche?.grupo ?? '',
              clientes: niche?.clientes ?? '',
              dor1: niche?.dor1 ?? '',
              dor2: niche?.dor2 ?? '',
            },
          }
        })
      })
      .finally(() => {
        if (session.current === token) setAdaptingNiche(false)
      })
  }

  useEffect(() => {
    if (!nicheKey) {
      if (nicheSig) {
        setCall((current) => ({
          ...current,
          notes: { ...current.notes, nichoSig: '', grupo: '', clientes: '', dor1: '', dor2: '' },
        }))
      }
      return
    }
    if (nicheSig === nicheKey) {
      return
    }
    // Nicho já resolvido nesta sessão entra na hora; o resto espera ele parar de digitar.
    const timer = setTimeout(() => loadNiche(false), nicheMemory.current.has(nicheKey) ? 0 : 1200)
    return () => clearTimeout(timer)
    // loadNiche lê refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nicheKey, nicheSig])

  const view = useMemo(() => ({ ...call.notes, ...seller }), [call.notes, seller])
  const node: CallNode = CALL_NODES[call.nodeId] ?? CALL_NODES[CALL_START]
  const owner = reachedOwner(call)
  // Recepção e responsável fazem perguntas diferentes: cada um tem a sua lista.
  const objections = owner ? CALL_OBJECTIONS : node.stage === 'Recepção' ? CALL_RECEPTION_OBJECTIONS : null
  const company = (call.notes.empresa ?? '').trim()

  const today = new Date().toDateString()
  const todayCalls = calls.filter((item) => new Date(item.startedAtMs).toDateString() === today)
  const stats = {
    total: todayCalls.length,
    owner: todayCalls.filter((item) => reachedOwner(item)).length,
    booked: todayCalls.filter((item) => item.outcome === 'agendou').length,
  }
  const callbacks = calls.filter((item) => item.outcome === 'retorno' && item.id !== callId)

  // Antes de ligar: essa empresa já está no histórico? (pelo nome ou pelo telefone)
  const dupCompany = call.nodeId === CALL_START && !callId ? companyKeyOf(call.notes.empresa ?? '') : ''
  const dupPhone = call.nodeId === CALL_START && !callId ? phoneKeyOf(call.notes.telefone ?? '') : ''
  useEffect(() => {
    if (!dupCompany && !dupPhone) {
      setDuplicates([])
      return
    }
    const matchesLocal = (item: ColdCall) =>
      (dupCompany && companyKeyOf(item.notes.empresa ?? '') === dupCompany) ||
      (dupPhone && phoneKeyOf(item.notes.telefone ?? '') === dupPhone)
    let cancelled = false
    const timer = setTimeout(() => {
      const { empresa = '', telefone = '' } = latest.current.call.notes
      findColdCallDuplicates(empresa, telefone)
        .catch((error) => {
          console.error('[ColdCall] duplicates', error)
          return [] as ColdCall[]
        })
        .then((remote) => {
          if (cancelled) return
          setDuplicates(mergeCalls(calls.filter(matchesLocal), remote.filter(matchesLocal)).slice(0, 3))
        })
    }, 700)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // calls só serve para achar na hora o que já está carregado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dupCompany, dupPhone])

  function setNote(key: string, value: string) {
    setCall((current) => ({ ...current, notes: { ...current.notes, [key]: value } }))
  }

  function choose(choice: CallChoice) {
    if (call.nodeId === CALL_START && !company) {
      setTriedToStart(true)
      return
    }
    setOpenObjection(null)
    setForward([])
    setCall((current) => {
      const startedAtMs = current.startedAtMs || Date.now()
      const notes = { ...current.notes }
      // Ex.: quem atendeu já é o responsável: o nome vale para os dois.
      if (choice.carry && !(notes[choice.carry.to] ?? '').trim()) {
        notes[choice.carry.to] = notes[choice.carry.from] ?? ''
      }
      if (typeof choice.to === 'string') {
        return { ...current, notes, startedAtMs, path: [...current.path, current.nodeId], nodeId: choice.to }
      }
      return { ...current, notes, startedAtMs, outcome: choice.to.outcome }
    })
  }

  /** Fichas de onde você voltou: a seta → leva de volta, sem refazer as escolhas. */
  const [forward, setForward] = useState<Pick<ColdCallData, 'nodeId' | 'path' | 'outcome'>[]>([])

  function back() {
    setOpenObjection(null)
    setForward((stack) => [...stack, { nodeId: call.nodeId, path: call.path, outcome: call.outcome }])
    setCall((current) => {
      if (current.outcome) {
        return { ...current, outcome: null }
      }
      const previous = current.path[current.path.length - 1]
      return previous ? { ...current, nodeId: previous, path: current.path.slice(0, -1) } : current
    })
  }

  function goForward() {
    const target = forward[forward.length - 1]
    if (!target) return
    setOpenObjection(null)
    setForward((stack) => stack.slice(0, -1))
    setCall((current) => ({ ...current, ...target }))
  }

  /** Grava o que falta e começa uma ligação nova. */
  function nextCall() {
    setForward([])
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
      const started = call.nodeId !== CALL_START || call.outcome !== null
      if (started) void persist(call, callId)
    }
    session.current += 1
    creating.current = null
    const carried: Record<string, string> = {}
    for (const key of CARRIED_NOTES) {
      if ((call.notes[key] ?? '').trim()) carried[key] = call.notes[key]
    }
    setCall({ ...EMPTY_CALL, notes: carried })
    setCallId(null)
    setDuplicates([])
    setSaveState('idle')
    setTriedToStart(false)
    setOpenObjection(null)
  }

  /** Abre uma ligação do histórico como ela ficou, sem mudar nada. */
  function openCall(item: ColdCall) {
    nextCall()
    const { id, ...data } = item
    skipSave.current = true
    setCallId(id)
    setCall(data)
    setMode('call')
  }

  /** Liga de novo para a mesma empresa: volta para "quem atendeu", com as anotações. */
  function resume(item: ColdCall) {
    nextCall()
    const { id, ...data } = item
    setCallId(id)
    setCall({ ...data, outcome: null, nodeId: 'quem', path: [CALL_START], startedAtMs: Date.now(), attempts: data.attempts + 1 })
    setMode('call')
  }

  function resumeCurrent() {
    setOpenObjection(null)
    setForward([])
    setCall((current) => ({
      ...current,
      outcome: null,
      nodeId: 'quem',
      path: [CALL_START],
      startedAtMs: Date.now(),
      attempts: current.attempts + 1,
    }))
  }

  async function loadMore() {
    setLoadingMore(true)
    try {
      const page = await listColdCalls(cursorMs.current)
      setCalls((list) => mergeCalls(list, page.items))
      setHasMore(page.hasMore)
      cursorMs.current = page.items[page.items.length - 1]?.startedAtMs ?? cursorMs.current
    } catch (error) {
      console.error('[ColdCall] more', error)
    } finally {
      setLoadingMore(false)
    }
  }

  /** Sugestão da aba "Onde prospectar": nicho e cidade viram os da próxima ligação. */
  function applySuggestion(suggestion: ProspectSuggestion) {
    const cidade = suggestion.regiao.replace(/\s*[-–,]\s*[A-Z]{2}$/, '').trim()
    const inProgress = call.nodeId !== CALL_START || call.outcome !== null || callId !== null
    if (inProgress) nextCall()
    setCall((current) => ({ ...current, notes: { ...current.notes, nicho: suggestion.nicho, cidade } }))
    setMode('call')
  }

  function showHistory(filter: HistoryFilter) {
    setHistoryFilter(filter)
    setMode('history')
  }

  /**
   * Empresa enviada pela extensão (Google Maps / Locais). Já ligou antes: abre aquela ligação.
   * Senão, começa uma nova com nome e telefone. Nicho e cidade ficam os da ligação anterior:
   * a categoria do Google varia de empresa para empresa e faria a IA adaptar o roteiro de novo à toa.
   */
  function receiveLead(lead: ExtensionLead) {
    const companyKey = companyKeyOf(lead.empresa)
    const phoneKey = phoneKeyOf(lead.telefone)
    const match =
      (lead.placeId && calls.find((item) => item.notes.googlePlace === lead.placeId)) ||
      calls.find(
        (item) =>
          (phoneKey && phoneKeyOf(item.notes.telefone ?? '') === phoneKey) ||
          (companyKey && companyKeyOf(item.notes.empresa ?? '') === companyKey),
      )
    if (match) {
      if (!lead.placeId || match.notes.googlePlace === lead.placeId) {
        openCall(match)
        return
      }
      // Ligação antiga, sem o lugar do Google: guarda agora, para o card da lista ser reconhecido.
      nextCall()
      const { id, ...data } = match
      setCallId(id)
      setCall({ ...data, notes: { ...data.notes, googlePlace: lead.placeId } })
      setMode('call')
      return
    }
    nextCall()
    setCall((current) => {
      const notes: Record<string, string> = { ...current.notes, empresa: lead.empresa, telefone: lead.telefone }
      if (lead.placeId) notes.googlePlace = lead.placeId
      // A cidade fica a que você já definiu (a prospecção do dia costuma ser numa cidade só).
      if (!(notes.cidade ?? '').trim() && lead.cidade) notes.cidade = lead.cidade
      return { ...current, notes }
    })
    setMode('call')
  }

  // Extensão do Chrome: recebe a empresa do Google e manda o histórico para marcar os resultados.
  const receiveLeadRef = useRef(receiveLead)
  receiveLeadRef.current = receiveLead
  const queuedLead = useRef<ExtensionLead | null>(null)
  const loadingRef = useRef(loading)
  loadingRef.current = loading
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const lead = readExtensionLead(event)
      if (!lead) return
      // Ainda carregando o histórico: espera, para achar a ligação antiga se houver.
      if (loadingRef.current) queuedLead.current = lead
      else receiveLeadRef.current(lead)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])
  useEffect(() => {
    if (loading) return
    announceColdCallReady()
    if (queuedLead.current) {
      receiveLeadRef.current(queuedLead.current)
      queuedLead.current = null
    }
  }, [loading])
  useEffect(() => {
    if (!loading) syncColdCallsToExtension(calls)
  }, [calls, loading])

  function toggleDone(stepId: string) {
    setCall((current) => ({
      ...current,
      done: current.done.includes(stepId) ? current.done.filter((id) => id !== stepId) : [...current.done, stepId],
    }))
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner />
      </div>
    )
  }

  const saveLabel: Record<SaveState, string> = {
    idle: '',
    pending: 'Não salvo',
    saving: 'Salvando…',
    saved: 'Salvo',
    error: 'Erro ao salvar',
  }
  const canGoBack = call.outcome !== null || call.path.length > 0
  const visibleLines = (node.say ?? []).filter(
    (line) => typeof line === 'string' || [...call.path].includes(line.onlyAfter),
  )
  const fieldClass =
    'w-full rounded-md border border-border bg-surface-2 px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none'

  return (
    <div className="rt min-h-screen bg-background pb-16">
      <style>{SCRIPT_THEME_CSS}</style>

      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-3">
          <Link to="/" className="text-sm text-muted-foreground transition-colors hover:text-accent" aria-label="Voltar para o início">
            ←
          </Link>
          <p className="text-base font-bold text-foreground">Cold call</p>
          <nav className="flex items-center gap-1" aria-label="Visão">
            {(
              [
                ['call', company ? `Ligação · ${company}` : 'Ligação'],
                ['history', 'Histórico'],
                ['ideas', 'Onde prospectar'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-current={mode === value ? 'page' : undefined}
                onClick={() => setMode(value)}
                className={`max-w-[260px] truncate whitespace-nowrap rounded px-2.5 py-1 text-sm transition-colors ${
                  mode === value ? 'bg-surface-2 font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
          <span className="flex-1" />
          <span className="text-xs text-muted-foreground" role="status">
            {saveLabel[saveState]}
          </span>
          <span className="text-sm tabular-nums text-muted-foreground">
            Hoje: <strong className="text-foreground">{stats.total}</strong> ligações ·{' '}
            <strong className="text-foreground">{stats.owner}</strong> com o responsável ·{' '}
            <strong style={{ color: stats.booked ? OUTCOME_COLOR.good : undefined }} className="text-foreground">
              {stats.booked}
            </strong>{' '}
            {stats.booked === 1 ? 'agendada' : 'agendadas'}
          </span>
          {mode === 'call' && (call.nodeId !== CALL_START || call.outcome) ? (
            <button
              type="button"
              onClick={nextCall}
              className="whitespace-nowrap rounded border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-surface-2"
            >
              Nova ligação
            </button>
          ) : null}
        </div>
      </header>

      {mode === 'ideas' ? (
        <ColdCallIdeas calls={calls} onUse={applySuggestion} />
      ) : mode === 'history' ? (
        <History
          calls={calls}
          filter={historyFilter}
          onFilter={setHistoryFilter}
          onOpen={openCall}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={() => void loadMore()}
        />
      ) : (
      <div className="mx-auto mt-6 grid max-w-6xl items-start gap-7 px-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {call.outcome ? (
          <OutcomeCard
            outcome={call.outcome}
            notes={view}
            done={call.done}
            onToggle={toggleDone}
            attempts={call.attempts}
            onBack={back}
            onNext={nextCall}
            onCallAgain={resumeCurrent}
            onCreatePiloto={() =>
              navigate('/piloto', {
                state: {
                  prefill: {
                    leadCompanyName: company,
                    leadNiche: (call.notes.nicho ?? '').trim(),
                    leadCity: (call.notes.cidade ?? '').trim(),
                  },
                },
              })
            }
          />
        ) : (
          <article className="min-w-0 rounded-lg px-7 py-7" style={{ backgroundColor: 'var(--rt-paper)' }} aria-live="polite">
            <div className="flex items-center gap-3 text-[13px]" style={{ color: 'var(--rt-muted)' }}>
              {canGoBack ? (
                <button
                  type="button"
                  onClick={back}
                  aria-label="Voltar para a ficha anterior"
                  className="rounded px-1 text-base text-muted-foreground transition-colors hover:text-foreground"
                >
                  ←
                </button>
              ) : null}
              {forward.length ? (
                <button
                  type="button"
                  onClick={goForward}
                  aria-label="Voltar para onde você estava"
                  title="Voltar para onde você estava"
                  className="rounded px-1 text-base text-muted-foreground transition-colors hover:text-foreground"
                >
                  →
                </button>
              ) : null}
              <span>{node.stage}</span>
            </div>
            <h1 className="mt-2 text-[30px] font-bold leading-tight text-foreground">{node.title}</h1>
            <p className="mt-1 text-[15px]" style={{ color: 'var(--rt-muted)' }}>
              {node.goal}
            </p>

            {node.tips ? (
              <ul className="mt-6 grid gap-2.5">
                {node.tips.map((tip) => (
                  <li key={tip} className="border-l-[3px] pl-4 text-[18px] leading-[1.45] text-foreground" style={{ borderColor: 'var(--rt-rule)' }}>
                    {tip}
                  </li>
                ))}
              </ul>
            ) : null}

            {visibleLines.length ? (
              <ol className="mt-6 grid gap-4">
                {visibleLines.map((line) => {
                  const parsed = parseKeyQuestion(lineText(line))
                  return (
                    <li
                      key={lineText(line)}
                      className="border-l-[3px] pl-4 text-[21px] leading-[1.45] text-foreground"
                      style={{ borderColor: keyBorder(parsed.key) }}
                    >
                      <Line text={parsed.text} notes={view} />
                      {parsed.key ? (
                        <span className="block">
                          <KeyTag fieldKey={parsed.key} />
                        </span>
                      ) : null}
                    </li>
                  )
                })}
              </ol>
            ) : null}

            {node.branch ? (
              <div className="mt-5 grid gap-2 border-t border-dashed pt-4" style={{ borderColor: 'var(--rt-rule)' }}>
                {node.branch.map(([said, reply]) => (
                  <p key={said} className="text-[15px]" style={{ color: 'var(--rt-muted)' }}>
                    <strong className="font-semibold text-foreground">Se perguntar {said}</strong> {renderFilled(reply, view)}
                  </p>
                ))}
              </div>
            ) : null}

            <div className="mt-7 border-t pt-5" style={{ borderColor: 'var(--rt-rule)' }}>
              <p className="mb-3 text-sm" style={{ color: 'var(--rt-muted)' }}>
                {call.nodeId === CALL_START && triedToStart && !company
                  ? 'Anote o nome da empresa antes de ligar: é por ele que você acha a ligação depois.'
                  : 'O que aconteceu?'}
              </p>
              <div className="flex flex-wrap gap-2.5">
                {node.choices.map((choice) => (
                  <button
                    key={choice.label}
                    type="button"
                    onClick={() => choose(choice)}
                    aria-label={choice.iconOnly ? choice.label : undefined}
                    title={choice.iconOnly ? choice.label : undefined}
                    className={
                      choice.primary
                        ? 'whitespace-nowrap rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-colors'
                        : choice.danger
                          ? `flex items-center justify-center whitespace-nowrap rounded-md bg-status-error text-sm font-semibold text-white transition-colors hover:bg-status-error/85 ${
                              choice.iconOnly ? 'h-[42px] w-[42px]' : 'px-4 py-2.5'
                            }`
                          : 'whitespace-nowrap rounded-md border border-border px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-surface-2'
                    }
                  >
                    {choice.iconOnly ? <HangUpIcon /> : choice.label}
                  </button>
                ))}
              </div>
            </div>
          </article>
        )}

        <aside className="grid min-w-0 gap-6 lg:sticky lg:top-20">
          {!call.outcome && node.capture?.length ? (
            <div className="grid gap-3.5">
              <p className="text-sm" style={{ color: 'var(--rt-muted)' }}>
                {call.nodeId === CALL_START ? 'Quem você vai ligar' : 'Anote'}
              </p>
              {node.capture.map((key) => {
                const field = CALL_FIELDS[key]
                const fieldId = `cc-${key}`
                const missing = key === 'empresa' && triedToStart && !company
                return (
                  <div key={key} className="grid gap-1.5">
                    <label htmlFor={fieldId} className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                      {field.color ? <span className={`${field.color} h-3 w-3 rounded-sm`} aria-hidden /> : null}
                      {field.label}
                    </label>
                    {key === 'telefone' ? (
                      <div className="flex gap-2">
                        <input
                          id={fieldId}
                          type="tel"
                          value={call.notes[key] ?? ''}
                          placeholder={field.hint}
                          onChange={(event) => setNote(key, event.target.value)}
                          className={`${fieldClass} min-w-0 flex-1`}
                        />
                        <CallLink phone={call.notes[key] ?? ''} />
                      </div>
                    ) : field.short ? (
                      <input
                        id={fieldId}
                        value={call.notes[key] ?? ''}
                        placeholder={field.hint}
                        aria-invalid={missing || undefined}
                        onChange={(event) => setNote(key, event.target.value)}
                        className={`${fieldClass}${missing ? ' border-status-error' : ''}`}
                      />
                    ) : (
                      <textarea
                        id={fieldId}
                        value={call.notes[key] ?? ''}
                        placeholder={field.hint}
                        rows={2}
                        onChange={(event) => setNote(key, event.target.value)}
                        className={`${fieldClass} resize-y`}
                      />
                    )}
                    {missing ? <p className="text-xs text-status-error">Falta o nome da empresa.</p> : null}
                    {key === 'nicho' && nicheKey ? (
                      <p className="text-xs" style={{ color: 'var(--rt-faint)' }}>
                        {adaptingNiche || nicheSig !== nicheKey
                          ? 'Adaptando o roteiro ao nicho…'
                          : call.notes.grupo
                            ? `Roteiro adaptado: fala com ${call.notes.grupo} e chama os clientes de ${call.notes.clientes}. `
                            : 'Não deu pra adaptar agora. O roteiro segue com as falas gerais. '}
                        {!adaptingNiche && nicheSig === nicheKey ? (
                          <button
                            type="button"
                            onClick={() => loadNiche(true)}
                            className="underline transition-colors hover:text-foreground"
                          >
                            {call.notes.grupo ? 'gerar de novo' : 'tentar de novo'}
                          </button>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : null}

          {!call.outcome && objections ? (
            <div>
              <p className="mb-1 text-sm" style={{ color: 'var(--rt-muted)' }}>
                Se ele disser
              </p>
              <ul className="divide-y" style={{ borderColor: 'var(--rt-rule)' }}>
                {objections.map(([said, reply], objectionIndex) => {
                  const open = openObjection === objectionIndex
                  return (
                    <li key={said} className="py-2.5" style={{ borderColor: 'var(--rt-rule)' }}>
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setOpenObjection(open ? null : objectionIndex)}
                        className="flex w-full items-center justify-between gap-3 text-left text-[15px] font-semibold text-foreground transition-colors hover:text-accent"
                      >
                        {said}
                        <span aria-hidden style={{ color: 'var(--rt-faint)' }}>
                          {open ? '−' : '+'}
                        </span>
                      </button>
                      {open ? (
                        <p className="mt-2 text-[16px] leading-relaxed text-foreground">
                          <Line text={reply} notes={view} />
                        </p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}

          {call.nodeId === CALL_START && !call.outcome && duplicates.length ? (
            <div className="border-l-[3px] pl-4" style={{ borderColor: 'var(--c5-fg)' }} role="status">
              <p className="text-sm font-semibold text-foreground">Você já ligou pra essa empresa</p>
              <ul className="mt-1">
                {duplicates.map((item) => {
                  const outcome = item.outcome ? CALL_OUTCOMES[item.outcome] : null
                  return (
                    <li key={item.id} className="flex items-center gap-3 py-1.5 text-sm">
                      <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--rt-muted)' }}>
                        {dayLabel(item.startedAtMs)} ·{' '}
                        <span style={{ color: outcome ? OUTCOME_COLOR[outcome.tone] : undefined }}>
                          {outcome ? outcome.label : 'Em andamento'}
                        </span>
                        {item.notes.responsavel ? ` · ${item.notes.responsavel}` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => openCall(item)}
                        className="whitespace-nowrap rounded border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-surface-2"
                      >
                        Abrir
                      </button>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-1 text-xs" style={{ color: 'var(--rt-faint)' }}>
                Abrindo, você continua a mesma ligação, com tudo o que já foi anotado.
              </p>
            </div>
          ) : null}

          {call.nodeId === CALL_START && !call.outcome ? (
            <CallLists
              callbacks={callbacks}
              todayCalls={todayCalls}
              onResume={resume}
              onOpen={openCall}
              onShowAll={showHistory}
            />
          ) : null}
        </aside>
      </div>
      )}
    </div>
  )
}

function ShowAll({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mt-1 text-sm underline transition-colors hover:text-foreground" style={{ color: 'var(--rt-muted)' }}>
      Ver todas ({count})
    </button>
  )
}

function CallLists({
  callbacks,
  todayCalls,
  onResume,
  onOpen,
  onShowAll,
}: {
  callbacks: ColdCall[]
  todayCalls: ColdCall[]
  onResume: (call: ColdCall) => void
  onOpen: (call: ColdCall) => void
  onShowAll: (filter: HistoryFilter) => void
}) {
  return (
    <>
      <div>
        <p className="mb-1 flex items-center gap-2 text-sm" style={{ color: 'var(--rt-muted)' }}>
          Ligar de novo
          {callbacks.length ? (
            <span className="rounded px-1.5 text-xs tabular-nums c5">{callbacks.length}</span>
          ) : null}
        </p>
        {callbacks.length ? (
          <ul>
            {callbacks.slice(0, SIDE_LIST_MAX).map((item) => (
              <li key={item.id} className="flex items-center gap-3 border-t py-2.5 first:border-t-0" style={{ borderColor: 'var(--rt-rule)' }}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-foreground">{item.notes.empresa || 'Sem nome'}</p>
                  <p className="truncate text-xs" style={{ color: 'var(--rt-faint)' }}>
                    {[item.notes.responsavel, item.notes.horario || 'sem horário', item.notes.telefone].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onResume(item)}
                  className="whitespace-nowrap rounded border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-surface-2"
                >
                  Ligar
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm" style={{ color: 'var(--rt-faint)' }}>
            Quem pedir pra ligar depois aparece aqui, com o horário combinado.
          </p>
        )}
        {callbacks.length > SIDE_LIST_MAX ? <ShowAll count={callbacks.length} onClick={() => onShowAll('retorno')} /> : null}
      </div>

      <div>
        <p className="mb-1 flex items-center gap-2 text-sm" style={{ color: 'var(--rt-muted)' }}>
          Ligações de hoje
          {todayCalls.length ? (
            <span className="rounded px-1.5 text-xs tabular-nums c2">{todayCalls.length}</span>
          ) : null}
        </p>
        {todayCalls.length ? (
          <ul>
            {todayCalls.slice(0, SIDE_LIST_MAX).map((item) => {
              const outcome = item.outcome ? CALL_OUTCOMES[item.outcome] : null
              return (
                <li key={item.id} className="border-t first:border-t-0" style={{ borderColor: 'var(--rt-rule)' }}>
                  <button
                    type="button"
                    onClick={() => onOpen(item)}
                    className="flex w-full items-baseline gap-3 py-2 text-left text-sm transition-colors hover:bg-surface-2"
                  >
                    <span className="tabular-nums" style={{ color: 'var(--rt-faint)' }}>
                      {formatTime(item.startedAtMs)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-foreground">{item.notes.empresa || 'Sem nome'}</span>
                    <span className="whitespace-nowrap" style={{ color: outcome ? OUTCOME_COLOR[outcome.tone] : 'var(--rt-faint)' }}>
                      {outcome ? outcome.label : 'Em andamento'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm" style={{ color: 'var(--rt-faint)' }}>
            Nenhuma ainda. A primeira é a mais difícil.
          </p>
        )}
        {todayCalls.length > SIDE_LIST_MAX ? <ShowAll count={todayCalls.length} onClick={() => onShowAll('todas')} /> : null}
      </div>
    </>
  )
}

function OutcomeCard({
  outcome,
  notes,
  done,
  attempts,
  onToggle,
  onBack,
  onNext,
  onCallAgain,
  onCreatePiloto,
}: {
  outcome: CallOutcome
  notes: Record<string, string>
  done: string[]
  attempts: number
  onToggle: (stepId: string) => void
  onBack: () => void
  onNext: () => void
  onCallAgain: () => void
  onCreatePiloto: () => void
}) {
  const info = CALL_OUTCOMES[outcome]
  const hasWhatsapp = Boolean((notes.whatsapp ?? '').trim())

  const summary: Record<CallOutcome, ReactNode> = {
    agendou: <>Reunião com {renderFilled('{responsavel}', notes)}: {renderFilled('{reuniao}', notes)}. Agora é garantir que ela aconteça.</>,
    retorno: <>Ligar de novo {renderFilled('{horario}', notes)}, e falar com {renderFilled('{responsavel}', notes)}. Ela fica em "Ligar de novo".</>,
    'sem-interesse': <>Sem insistir. Porta aberta vale mais que uma ligação forçada.</>,
    'nao-atendeu': <>Tente em outro horário, até três vezes. Começo da manhã e fim da tarde costumam funcionar melhor.</>,
  }

  return (
    <article className="min-w-0 rounded-lg px-7 py-7" style={{ backgroundColor: 'var(--rt-paper)' }} aria-live="polite">
      <div className="flex items-center gap-3 text-[13px]" style={{ color: 'var(--rt-muted)' }}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar para a última ficha"
          className="rounded px-1 text-base text-muted-foreground transition-colors hover:text-foreground"
        >
          ←
        </button>
        <span>
          Fim da ligação{attempts > 1 ? <span className="tabular-nums"> · {attempts}ª tentativa</span> : null}
        </span>
      </div>
      <h1
        className="mt-2 text-[30px] font-bold leading-tight text-foreground"
        style={info.tone === 'muted' ? undefined : { color: OUTCOME_COLOR[info.tone] }}
      >
        {info.label}
      </h1>
      <p className="mt-2 text-[17px] leading-relaxed text-foreground">{summary[outcome]}</p>

      {outcome === 'agendou' ? (
        <ol className="mt-6">
          {AFTER_MEETING_STEPS.map((step, stepIndex) => {
            const checked = done.includes(step.id)
            return (
              <li key={step.id} className="border-t py-3.5 first:border-t-0" style={{ borderColor: 'var(--rt-rule)' }}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(step.id)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[rgb(var(--color-accent-rgb))]"
                  />
                  <span className="text-[16px] leading-snug" style={{ color: checked ? 'var(--rt-faint)' : undefined }}>
                    <span className="mr-2 tabular-nums" style={{ color: 'var(--rt-faint)' }}>
                      {stepIndex + 1}.
                    </span>
                    <span className={checked ? 'line-through' : 'text-foreground'}>{step.text}</span>
                  </span>
                </label>
                {step.message && !checked ? (
                  <div className="pl-7">
                    <MessageBlock template={CALL_MESSAGES[step.message]} notes={notes} />
                  </div>
                ) : null}
                {step.action === 'piloto' && !checked ? (
                  <div className="mt-2 pl-7">
                    <button
                      type="button"
                      onClick={() => {
                        onToggle(step.id)
                        onCreatePiloto()
                      }}
                      className="whitespace-nowrap rounded border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-surface-2"
                    >
                      Criar apresentação
                    </button>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ol>
      ) : null}

      {outcome === 'retorno' && hasWhatsapp ? (
        <div className="mt-6">
          <p className="text-sm" style={{ color: 'var(--rt-muted)' }}>
            Mande agora, pra ele esperar a sua ligação:
          </p>
          <MessageBlock template={CALL_MESSAGES.retorno} notes={notes} />
        </div>
      ) : null}

      {outcome === 'sem-interesse' && hasWhatsapp ? (
        <div className="mt-6">
          <p className="text-sm" style={{ color: 'var(--rt-muted)' }}>
            Deixe seu contato:
          </p>
          <MessageBlock template={CALL_MESSAGES.contato} notes={notes} />
        </div>
      ) : null}

      <div className="mt-7 border-t pt-5" style={{ borderColor: 'var(--rt-rule)' }}>
        <p className="mb-3 text-sm" style={{ color: 'var(--rt-muted)' }}>
          A ligação já está salva. A próxima mantém o nicho e a cidade.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={onNext}
            className="whitespace-nowrap rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-colors"
          >
            Próxima ligação
          </button>
          {outcome !== 'agendou' ? (
            <button
              type="button"
              onClick={onCallAgain}
              className="whitespace-nowrap rounded-md border border-border px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-surface-2"
            >
              Ligar de novo agora
            </button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

const HISTORY_FILTERS: { value: HistoryFilter; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'agendou', label: 'Agendou' },
  { value: 'retorno', label: 'Ligar de novo' },
  { value: 'nao-atendeu', label: 'Não atendeu' },
  { value: 'sem-interesse', label: 'Sem interesse' },
  { value: 'pendentes', label: 'Em andamento' },
]

type Period = 'hoje' | '7d' | '30d' | 'tudo'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'tudo', label: 'Tudo' },
]

function inPeriod(item: ColdCall, period: Period): boolean {
  if (period === 'tudo') return true
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  if (period === '7d') start.setDate(start.getDate() - 6)
  if (period === '30d') start.setDate(start.getDate() - 29)
  return item.startedAtMs >= start.getTime()
}

/** Atendeu: saiu do preparo pelo "Atendeu" (passou por "Quem atendeu"). */
function wasAnswered(item: ColdCall): boolean {
  return [...item.path, item.nodeId].includes('quem')
}

function percent(part: number, total: number): string {
  return total ? `${Math.round((part / total) * 100)}%` : '–'
}

function matchesFilter(item: ColdCall, filter: HistoryFilter): boolean {
  if (filter === 'todas') return true
  if (filter === 'pendentes') return item.outcome === null
  return item.outcome === filter
}

/** Todas as ligações, por dia, com busca e filtro. Clicar abre a ligação. */
function History({
  calls,
  filter,
  onFilter,
  onOpen,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  calls: ColdCall[]
  filter: HistoryFilter
  onFilter: (filter: HistoryFilter) => void
  onOpen: (call: ColdCall) => void
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
}) {
  const [search, setSearch] = useState('')
  // Veio de "Ver todas" de um resultado (ex.: ligar de novo): mostra tudo, não só hoje.
  const [period, setPeriod] = useState<Period>(() => (filter === 'todas' ? 'hoje' : 'tudo'))
  const term = companyKeyOf(search)
  const digits = search.replace(/\D/g, '')
  const found = calls.filter((item) => {
    if (!inPeriod(item, period)) return false
    if (!term) return true
    const haystack = companyKeyOf(
      [item.notes.empresa, item.notes.responsavel, item.notes.nicho, item.notes.cidade].filter(Boolean).join(' '),
    )
    const phone = (item.notes.telefone ?? '').replace(/\D/g, '')
    return haystack.includes(term) || (digits.length >= 4 && phone.includes(digits))
  })
  const visible = found.filter((item) => matchesFilter(item, filter))
  const counts = Object.fromEntries(
    HISTORY_FILTERS.map((option) => [option.value, found.filter((item) => matchesFilter(item, option.value)).length]),
  ) as Record<HistoryFilter, number>

  // Números do período (e da busca), sem o filtro de resultado.
  const total = found.length
  const answered = found.filter(wasAnswered).length
  const withOwner = found.filter((item) => reachedOwner(item)).length
  const refused = found.filter((item) => item.outcome === 'sem-interesse').length
  const booked = found.filter((item) => item.outcome === 'agendou').length
  const stats: { label: string; value: number; detail: string; color?: string }[] = [
    { label: 'Ligações', value: total, detail: '' },
    { label: 'Atenderam', value: answered, detail: percent(answered, total) },
    { label: 'Com o responsável', value: withOwner, detail: percent(withOwner, total) },
    { label: 'Recusaram', value: refused, detail: percent(refused, total), color: refused ? 'var(--c3-fg)' : undefined },
    { label: 'Reuniões', value: booked, detail: percent(booked, total), color: booked ? OUTCOME_COLOR.good : undefined },
  ]

  const groups: { label: string; items: ColdCall[] }[] = []
  for (const item of visible) {
    const label = dayLabel(item.startedAtMs)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(item)
    else groups.push({ label, items: [item] })
  }

  return (
    <div className="mx-auto mt-6 max-w-6xl px-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-5" style={{ borderColor: 'var(--rt-rule)' }}>
        <dl className="flex flex-wrap gap-x-10 gap-y-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-xs" style={{ color: 'var(--rt-muted)' }}>
                {stat.label}
              </dt>
              <dd className="mt-1 flex items-baseline gap-1.5">
                <span className="text-[26px] font-bold leading-none tabular-nums text-foreground" style={stat.color ? { color: stat.color } : undefined}>
                  {stat.value}
                </span>
                {stat.detail ? (
                  <span className="text-xs tabular-nums" style={{ color: 'var(--rt-faint)' }}>
                    {stat.detail}
                  </span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex gap-1" role="group" aria-label="Período">
          {PERIODS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={period === option.value}
              onClick={() => setPeriod(option.value)}
              className={`whitespace-nowrap rounded px-2.5 py-1 text-sm transition-colors ${
                period === option.value ? 'bg-surface-2 font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por empresa, responsável, nicho ou telefone"
          aria-label="Buscar ligações"
          className="w-full max-w-md rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
        />
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar por resultado">
          {HISTORY_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filter === option.value}
              onClick={() => onFilter(option.value)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded px-2.5 py-1 text-sm transition-colors ${
                filter === option.value ? 'bg-surface-2 font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {option.label}
              <span className="tabular-nums text-xs" style={{ color: 'var(--rt-faint)' }}>
                {counts[option.value]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {groups.length ? (
        <div className="mt-6 grid gap-6">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                {group.label}
                <span className="rounded px-1.5 text-xs font-normal tabular-nums c2">{group.items.length}</span>
              </h2>
              <ul>
                {group.items.map((item) => {
                  const outcome = item.outcome ? CALL_OUTCOMES[item.outcome] : null
                  const detail = [item.notes.responsavel, item.notes.nicho, item.notes.cidade, item.notes.telefone]
                    .map((value) => (value ?? '').trim())
                    .filter(Boolean)
                    .join(' · ')
                  return (
                    <li key={item.id} className="border-t first:border-t-0" style={{ borderColor: 'var(--rt-rule)' }}>
                      <button
                        type="button"
                        onClick={() => onOpen(item)}
                        className="grid w-full grid-cols-[3.5rem_minmax(0,1fr)_auto] items-baseline gap-4 py-2.5 text-left text-sm transition-colors hover:bg-surface-2"
                      >
                        <span className="tabular-nums" style={{ color: 'var(--rt-faint)' }}>
                          {formatTime(item.startedAtMs)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-foreground">{item.notes.empresa || 'Sem nome'}</span>
                          {detail ? (
                            <span className="block truncate text-xs" style={{ color: 'var(--rt-faint)' }}>
                              {detail}
                            </span>
                          ) : null}
                        </span>
                        <span className="whitespace-nowrap text-right">
                          <span style={{ color: outcome ? OUTCOME_COLOR[outcome.tone] : 'var(--rt-faint)' }}>
                            {outcome ? outcome.label : 'Em andamento'}
                          </span>
                          {item.attempts > 1 ? (
                            <span className="block text-xs tabular-nums" style={{ color: 'var(--rt-faint)' }}>
                              {item.attempts}ª tentativa
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="mt-8 text-sm" style={{ color: 'var(--rt-faint)' }}>
          {calls.length ? 'Nenhuma ligação com esse filtro.' : 'Nenhuma ligação ainda.'}
        </p>
      )}

      {hasMore ? (
        <div className="mt-6">
          <p className="mb-2 text-xs" style={{ color: 'var(--rt-faint)' }}>
            A busca e o filtro olham só as ligações carregadas.
          </p>
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="whitespace-nowrap rounded border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            {loadingMore ? 'Carregando…' : 'Carregar mais antigas'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

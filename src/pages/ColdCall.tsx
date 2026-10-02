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
import { CallbackPicker } from '../components/CallbackPicker'
import { NicheCombobox } from '../components/NicheCombobox'
import type { NicheOption } from '../components/NicheCombobox'
import type { SavedNiche } from '../services/coldCalls'
import { daysFromToday, hourOf, isOverdue, shortWhen, shortWhenMs, spokenWhen } from '../lib/callbackTime'
import type { ProspectSuggestion } from '../ai/suggestProspecting'
import { announceColdCallReady, readExtensionLead, syncColdCallsToExtension } from '../lib/coldCallExtension'
import type { ExtensionLead } from '../lib/coldCallExtension'
import { adaptColdCallNiche } from '../ai/adaptColdCallNiche'
import {
  createColdCall,
  findColdCallDuplicates,
  deleteCachedNiche,
  getCachedNiche,
  listCachedNiches,
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

type Mode = 'call' | 'callbacks' | 'history' | 'ideas'
type HistoryFilter = 'todas' | 'pendentes' | CallOutcome

const TABS: { value: Mode; label: string }[] = [
  { value: 'call', label: 'Ligação' },
  { value: 'callbacks', label: 'Retornos' },
  { value: 'history', label: 'Histórico' },
  { value: 'ideas', label: 'Onde prospectar' },
]

const SIDE_LIST_MAX = 5
/** "Não atendeu": tenta até três vezes, em horários diferentes. */
const RETRY_MAX = 3
/** quem não atendeu há mais tempo que isso sai da fila de tentar de novo */
const RETRY_WINDOW_MS = 14 * 86400000
/** retorno que vence nos próximos 30 minutos já conta como "na hora" */
const DUE_SOON_MS = 30 * 60000

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
  const whatsapp = (notes.whatsapp ?? '').replace(/\D/g, '')
  return (
    <div className="mt-2 grid gap-2">
      <p className="border-l-2 pl-3 text-sm leading-relaxed" style={{ borderColor: 'var(--rt-rule)', color: 'var(--rt-muted)' }}>
        {renderFilled(template, notes)}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <CopyButton text={text} />
        {/* Com o WhatsApp anotado, a conversa já abre com a mensagem escrita. */}
        {whatsapp.length >= 10 ? (
          <a
            href={`${whatsappHref(whatsapp)}?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline decoration-[color:var(--rt-rule)] underline-offset-4 transition-colors hover:text-foreground"
            style={{ color: 'var(--c4-fg)' }}
          >
            Abrir no WhatsApp com a mensagem ↗
          </a>
        ) : (
          <span className="text-xs" style={{ color: 'var(--rt-faint)' }}>
            Anote o WhatsApp para abrir a conversa direto.
          </span>
        )}
      </div>
    </div>
  )
}

/** Conversa no WhatsApp (wa.me), com DDI do Brasil quando o número vem só com DDD. */
function whatsappHref(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const full = digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`
  return `https://wa.me/${full}`
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
function CallLink({ phone, className = '' }: { phone: string; className?: string }) {
  const href = telHref(phone)
  const base = `flex shrink-0 items-center whitespace-nowrap rounded-md px-4 text-sm font-semibold transition-colors ${className}`
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
  /** digitando o nicho: a IA espera você sair do campo */
  const [nicheEditing, setNicheEditing] = useState(false)
  const [savedNiches, setSavedNiches] = useState<SavedNiche[]>([])
  /** Resultado que a ligação tinha antes de ligar de novo (ex.: "Ligar de novo"). */
  const [redialFrom, setRedialFrom] = useState<CallOutcome | null>(null)
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
    listCachedNiches()
      .then((list) => {
        if (!cancelled) setSavedNiches(list)
      })
      .catch((error) => console.error('[ColdCall] niches', error))
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
      void saveCachedNiche(key, fresh, nicho).catch((error) => console.error('[ColdCall] niche save', error))
      setSavedNiches((list) => (list.some((item) => item.key === key) ? list : [...list, { key, nicho }]))
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
    if (nicheEditing) return
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
    // Só depois de sair do campo (ou escolher da lista): uma chamada por nicho, não uma por letra.
    loadNiche(false)
    // loadNiche lê refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nicheKey, nicheSig, nicheEditing])

  // Lista do campo Nicho: os já adaptados nesta versão, com o nome como foi digitado.
  const nicheOptions = useMemo((): NicheOption[] => {
    const prefix = `v${NICHE_VERSION}-`
    const typed = new Map<string, string>()
    for (const item of calls) {
      const name = (item.notes.nicho ?? '').trim()
      if (name) typed.set(nicheKeyOf(name), name)
    }
    return savedNiches
      .filter((item) => item.key.startsWith(prefix))
      .map((item) => ({
        key: item.key,
        label: item.nicho || typed.get(item.key) || item.key.slice(prefix.length).replace(/-/g, ' '),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }, [savedNiches, calls])

  function deleteNiche(key: string) {
    setSavedNiches((list) => list.filter((item) => item.key !== key))
    nicheMemory.current.delete(key)
    deleteCachedNiche(key).catch((error) => console.error('[ColdCall] niche delete', error))
  }

  // O horário do retorno é falado sempre em relação a hoje ("amanhã às 14h"), então é calculado na hora.
  const view = useMemo(() => {
    const horarioAt = call.notes.horarioAt ?? ''
    const hour = new Date().getHours()
    const saudacao = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
    return { ...call.notes, ...seller, saudacao, ...(horarioAt ? { horario: spokenWhen(horarioAt) } : {}) }
  }, [call.notes, seller])
  const node: CallNode = CALL_NODES[call.nodeId] ?? CALL_NODES[CALL_START]
  const owner = reachedOwner(call)
  // Ligando de novo (retomada): começa em "Quem atendeu", então ali entram o telefone e o "Não atendeu".
  const isRedial = !call.outcome && call.nodeId === 'quem' && call.attempts > 1
  const choices: CallChoice[] = isRedial
    ? [
        ...node.choices.filter((choice) => !choice.danger),
        // Tinha horário combinado (estava em "Ligar de novo"): continua lá, com mais uma tentativa.
        { label: 'Não atendeu', to: { outcome: redialFrom === 'retorno' || (call.notes.horarioAt ?? call.notes.horario ?? '').trim() ? 'retorno' : 'nao-atendeu' } },
        ...node.choices.filter((choice) => choice.danger),
      ]
    : node.choices
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
  // Retornos: o horário mais próximo (ou atrasado) primeiro; sem horário vai para o fim.
  const allCallbacks = calls
    .filter((item) => item.outcome === 'retorno')
    .sort((a, b) => (a.notes.horarioAt || '9999').localeCompare(b.notes.horarioAt || '9999'))
  /** na lateral: sem a ligação aberta agora */
  const callbacks = allCallbacks.filter((item) => item.id !== callId)
  // Não atenderam: quem ainda vale tentar de novo, o que espera há mais tempo primeiro.
  const retryFrom = Date.now() - RETRY_WINDOW_MS
  const retries = calls
    .filter((item) => item.outcome === 'nao-atendeu' && item.attempts < RETRY_MAX && item.startedAtMs >= retryFrom)
    .sort((a, b) => a.startedAtMs - b.startedAtMs)

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

  /** Retorno marcado no calendário: guarda a data e a versão falada, para a lista e para a extensão. */
  function setCallback(value: string) {
    setCall((current) => ({
      ...current,
      notes: { ...current.notes, horarioAt: value, horario: value ? spokenWhen(value) : '' },
    }))
  }

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
    setRedialFrom(null)
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
    setRedialFrom(item.outcome)
    const { id, ...data } = item
    setCallId(id)
    setCall({ ...data, outcome: null, nodeId: 'quem', path: [CALL_START], startedAtMs: Date.now(), attempts: data.attempts + 1 })
    setMode('call')
  }

  function resumeCurrent() {
    setOpenObjection(null)
    setForward([])
    setRedialFrom(call.outcome)
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

  /** Das listas: a ligação aberta agora continua daqui, sem recarregar a versão salva. */
  function resumeFromList(item: ColdCall) {
    if (item.id === callId) {
      resumeCurrent()
      setMode('call')
      return
    }
    resume(item)
  }

  function openFromList(item: ColdCall) {
    if (item.id === callId) setMode('call')
    else openCall(item)
  }

  /** Do cabeçalho, em qualquer aba: grava a atual (se começou) e abre o preparo com o cursor na empresa. */
  function startNewCall() {
    if (call.nodeId !== CALL_START || call.outcome !== null || callId !== null) nextCall()
    setMode('call')
    requestAnimationFrame(() => document.getElementById('cc-empresa')?.focus())
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
  const started = call.nodeId !== CALL_START || call.outcome !== null
  const atPrep = call.nodeId === CALL_START && !call.outcome
  const canGoBack = call.outcome !== null || call.path.length > 0
  const phase = call.outcome ? PHASES.length - 1 : Math.max(0, (PHASES as readonly string[]).indexOf(node.stage))
  const visibleLines = (node.say ?? []).filter(
    (line) => typeof line === 'string' || [...call.path].includes(line.onlyAfter),
  )
  const missingCompany = atPrep && triedToStart && !company
  // Um lembrete por ligação, em rodízio: a lista inteira vira ruído depois da terceira vez.
  const prepTip = atPrep && node.tips?.length ? node.tips[todayCalls.length % node.tips.length] : ''
  const overdueCount = allCallbacks.filter((item) => item.notes.horarioAt && isOverdue(item.notes.horarioAt)).length
  // Terminou uma ligação e tem retorno vencendo: sugere ligar já.
  const dueCallback =
    callbacks.find((item) => {
      const at = item.notes.horarioAt ?? ''
      return at !== '' && new Date(at).getTime() <= Date.now() + DUE_SOON_MS
    }) ?? null
  const fieldClass =
    'w-full rounded-md border border-border bg-surface-2 px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none'

  const nicheStatus = (
    <p className="text-xs" style={{ color: 'var(--rt-faint)' }}>
      {nicheEditing && nicheSig !== nicheKey
        ? 'O roteiro se adapta quando você sair do campo.'
        : adaptingNiche || nicheSig !== nicheKey
          ? 'Adaptando o roteiro ao nicho…'
          : call.notes.grupo
            ? `Roteiro adaptado: fala com ${call.notes.grupo} e chama os clientes de ${call.notes.clientes}. `
            : 'Não deu pra adaptar agora. O roteiro segue com as falas gerais. '}
      {!adaptingNiche && nicheSig === nicheKey ? (
        <button type="button" onClick={() => loadNiche(true)} className="underline transition-colors hover:text-foreground">
          {call.notes.grupo ? 'gerar de novo' : 'tentar de novo'}
        </button>
      ) : null}
    </p>
  )

  /** Campo de anotação: o mesmo no preparo (no cartão) e durante a ligação (na lateral). */
  function renderField(key: string) {
    const field = CALL_FIELDS[key]
    if (!field) return null
    const fieldId = `cc-${key}`
    const missing = key === 'empresa' && missingCompany
    const phoneLike = key === 'telefone' || key === 'whatsapp'
    let control: ReactNode
    if (key === 'nicho') {
      control = (
        <NicheCombobox
          id={fieldId}
          value={call.notes.nicho ?? ''}
          placeholder={field.hint}
          className={fieldClass}
          options={nicheOptions}
          onChange={(value) => setNote('nicho', value)}
          onFocus={() => setNicheEditing(true)}
          onCommit={() => setNicheEditing(false)}
          onDelete={deleteNiche}
        />
      )
    } else if (key === 'horario') {
      control = <CallbackPicker id={fieldId} value={call.notes.horarioAt ?? ''} onChange={setCallback} />
    } else if (key === 'telefone') {
      control = (
        <div className="flex gap-2">
          <input
            id={fieldId}
            type="tel"
            value={call.notes.telefone ?? ''}
            placeholder={field.hint}
            onChange={(event) => setNote('telefone', event.target.value)}
            className={`${fieldClass} min-w-0 flex-1 tabular-nums`}
          />
          <CallLink phone={call.notes.telefone ?? ''} />
        </div>
      )
    } else if (field.short) {
      control = (
        <input
          id={fieldId}
          type={phoneLike ? 'tel' : 'text'}
          value={call.notes[key] ?? ''}
          placeholder={field.hint}
          aria-invalid={missing || undefined}
          aria-describedby={missing ? `${fieldId}-erro` : undefined}
          onChange={(event) => setNote(key, event.target.value)}
          className={`${fieldClass}${phoneLike ? ' tabular-nums' : ''}${missing ? ' border-status-error' : ''}`}
        />
      )
    } else {
      control = (
        <textarea
          id={fieldId}
          value={call.notes[key] ?? ''}
          placeholder={field.hint}
          rows={2}
          onChange={(event) => setNote(key, event.target.value)}
          className={`${fieldClass} resize-y`}
        />
      )
    }
    return (
      <div key={key} className="grid content-start gap-1.5">
        <label htmlFor={fieldId} className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
          {field.color ? <span className={`${field.color} h-3 w-3 rounded-sm`} aria-hidden /> : null}
          {field.label}
        </label>
        {control}
        {missing ? (
          <p id={`${fieldId}-erro`} className="text-xs text-status-error">
            Falta o nome da empresa.
          </p>
        ) : null}
        {key === 'nicho' && nicheKey ? nicheStatus : null}
      </div>
    )
  }

  return (
    <div className="rt min-h-screen bg-background pb-16">
      <style>{SCRIPT_THEME_CSS}</style>

      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-stretch gap-x-8 px-6">
          <div className="flex h-14 items-center gap-2">
            <Link
              to="/"
              aria-label="Voltar para o início"
              className="-ml-2 flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              ←
            </Link>
            <p className="whitespace-nowrap text-base font-bold text-foreground">Cold call</p>
          </div>
          <nav className="order-last flex w-full gap-1 overflow-x-auto md:order-none md:w-auto" aria-label="Visão">
            {TABS.map((tab) => {
              const active = mode === tab.value
              return (
                <button
                  key={tab.value}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setMode(tab.value)}
                  className={`flex h-11 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm transition-colors md:h-14 ${
                    active ? 'border-accent font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                  {tab.value === 'callbacks' && allCallbacks.length ? (
                    <span
                      className={`rounded px-1.5 text-xs font-normal tabular-nums ${overdueCount ? 'c3' : 'c5'}`}
                      title={overdueCount ? `${overdueCount} ${overdueCount === 1 ? 'atrasado' : 'atrasados'}` : undefined}
                    >
                      {allCallbacks.length}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </nav>
          <div className="ml-auto flex h-14 items-center gap-5">
            <p className="hidden whitespace-nowrap text-sm tabular-nums text-muted-foreground lg:block">
              Hoje <strong className="ml-1 font-semibold text-foreground">{stats.total}</strong> {stats.total === 1 ? 'ligação' : 'ligações'}
              <span className="mx-2" style={{ color: 'var(--rt-faint)' }}>
                ·
              </span>
              <strong className="font-semibold text-foreground">{stats.owner}</strong> com o responsável
              <span className="mx-2" style={{ color: 'var(--rt-faint)' }}>
                ·
              </span>
              <strong className="font-semibold text-foreground" style={{ color: stats.booked ? OUTCOME_COLOR.good : undefined }}>
                {stats.booked}
              </strong>{' '}
              {stats.booked === 1 ? 'reunião' : 'reuniões'}
            </p>
            <button
              type="button"
              onClick={startNewCall}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-2"
            >
              <span aria-hidden className="text-base leading-none">
                +
              </span>
              Nova ligação
            </button>
          </div>
        </div>
      </header>

      {mode === 'ideas' ? (
        <ColdCallIdeas onUse={applySuggestion} />
      ) : mode === 'history' ? (
        <History
          calls={calls}
          filter={historyFilter}
          onFilter={setHistoryFilter}
          onOpen={openFromList}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={() => void loadMore()}
        />
      ) : mode === 'callbacks' ? (
        <CallbackAgenda callbacks={allCallbacks} retries={retries} onOpen={openFromList} onResume={resumeFromList} />
      ) : (
        <div className="mx-auto max-w-6xl px-6">
          {started ? (
            <CallContext notes={call.notes} attempts={call.attempts} status={saveLabel[saveState]} statusError={saveState === 'error'} />
          ) : null}

          <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
            {call.outcome ? (
              <OutcomeCard
                outcome={call.outcome}
                notes={view}
                done={call.done}
                attempts={call.attempts}
                callbackAt={call.notes.horarioAt ?? ''}
                dueCallback={dueCallback}
                onCallback={setCallback}
                onToggle={toggleDone}
                onBack={back}
                onForward={forward.length ? goForward : undefined}
                onNext={nextCall}
                onCallAgain={resumeCurrent}
                onCallDue={() => {
                  if (dueCallback) resume(dueCallback)
                }}
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
                <CardTop
                  phase={phase}
                  onBack={canGoBack ? back : undefined}
                  onForward={forward.length ? goForward : undefined}
                />
                <h1 className="mt-4 text-[30px] font-bold leading-tight text-foreground">{node.title}</h1>
                <p className="mt-1 text-[15px]" style={{ color: 'var(--rt-muted)' }}>
                  {node.goal}
                </p>
                {prepTip ? (
                  <p className="mt-1 text-sm" style={{ color: 'var(--rt-faint)' }}>
                    Lembrete: {prepTip}
                  </p>
                ) : null}

                {atPrep ? (
                  <>
                    {/* Quem e o número em cima; nicho e cidade costumam vir da ligação anterior. */}
                    <div className="mt-6 grid gap-x-5 gap-y-4 sm:grid-cols-2">{PREP_FIELDS.map(renderField)}</div>

                    {duplicates.length ? (
                      <div className="mt-5 border-l-[3px] pl-4" style={{ borderColor: 'var(--c5-fg)' }} role="status">
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
                  </>
                ) : null}

                {!atPrep && node.tips ? (
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

                {node.message ? (
                  <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--rt-rule)' }}>
                    <p className="text-sm font-semibold text-foreground">Mensagem para mandar no WhatsApp</p>
                    <MessageBlock template={CALL_MESSAGES[node.message]} notes={view} />
                  </div>
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
                  <p
                    className={`mb-3 text-sm${missingCompany ? ' text-status-error' : ''}`}
                    style={missingCompany ? undefined : { color: 'var(--rt-muted)' }}
                  >
                    {missingCompany
                      ? 'Falta o nome da empresa: é por ele que você acha a ligação depois.'
                      : atPrep
                        ? 'Ligue e marque como foi. Daqui pra frente, tudo é salvo sozinho.'
                        : 'O que aconteceu?'}
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    {choices.map((choice) => (
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

            <aside className="grid w-full min-w-0 gap-8 overflow-hidden lg:sticky lg:top-20">
              {!call.outcome && !atPrep && node.capture?.length ? (
                <section>
                  <SectionLabel>Anote</SectionLabel>
                  <div className="grid gap-4">{node.capture.map(renderField)}</div>
                </section>
              ) : null}

              {!call.outcome && objections ? (
                <section>
                  <SectionLabel count={objections.length}>{owner ? 'Se ele disser' : 'Se a recepção disser'}</SectionLabel>
                  <ul>
                    {objections.map(([said, reply], objectionIndex) => {
                      const open = openObjection === objectionIndex
                      return (
                        <li key={said} className="border-t py-2.5 first:border-t-0" style={{ borderColor: 'var(--rt-rule)' }}>
                          <button
                            type="button"
                            aria-expanded={open}
                            onClick={() => setOpenObjection(open ? null : objectionIndex)}
                            className="flex w-full min-w-0 items-center justify-between gap-3 text-left text-[15px] font-semibold text-foreground transition-colors hover:text-accent"
                          >
                            <span className="min-w-0 flex-1 truncate">{said}</span>
                            <span aria-hidden className="shrink-0" style={{ color: 'var(--rt-faint)' }}>
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
                </section>
              ) : null}

              {started || callId ? (
                <section>
                  <SectionLabel htmlFor="cc-obs">Observações</SectionLabel>
                  <textarea
                    id="cc-obs"
                    value={call.notes.obs ?? ''}
                    placeholder={CALL_FIELDS.obs.hint}
                    rows={2}
                    onChange={(event) => setNote('obs', event.target.value)}
                    className={`${fieldClass} resize-y`}
                  />
                </section>
              ) : null}

              {atPrep || call.outcome ? (
                <CallLists
                  callbacks={callbacks}
                  todayCalls={todayCalls}
                  onResume={resumeFromList}
                  onOpen={openFromList}
                  onShowCallbacks={() => setMode('callbacks')}
                  onShowToday={() => showHistory('todas')}
                />
              ) : null}
            </aside>
          </div>
        </div>
      )}
    </div>
  )
}

/** Fases da ligação: onde você está e o que vem depois. */
const PHASES = ['Preparo', 'Recepção', 'Responsável', 'Agendamento', 'Resultado'] as const

/** Ordem do preparo: quem e o número primeiro; nicho e cidade costumam vir da ligação anterior. */
const PREP_FIELDS = ['empresa', 'telefone', 'nicho', 'cidade']

/** Topo do cartão: as fases à esquerda, sempre no mesmo lugar; as setas à direita. */
function CardTop({ phase, onBack, onForward }: { phase: number; onBack?: () => void; onForward?: () => void }) {
  const arrow =
    'flex h-8 w-8 items-center justify-center rounded text-base text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground'
  return (
    <div className="flex min-h-8 flex-wrap items-center gap-x-4 gap-y-1">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]" aria-label="Fases da ligação">
        {PHASES.map((label, index) => (
          <li key={label} className="flex items-center gap-2" aria-current={index === phase ? 'step' : undefined}>
            {index ? (
              <span aria-hidden style={{ color: 'var(--rt-faint)' }}>
                ›
              </span>
            ) : null}
            <span
              className={index === phase ? 'font-semibold text-foreground' : undefined}
              style={index === phase ? undefined : { color: index < phase ? 'var(--rt-muted)' : 'var(--rt-faint)' }}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>
      {onBack || onForward ? (
        <div className="ml-auto flex items-center gap-0.5">
          {onBack ? (
            <button type="button" onClick={onBack} aria-label="Voltar para a ficha anterior" title="Voltar" className={arrow}>
              ←
            </button>
          ) : null}
          {onForward ? (
            <button type="button" onClick={onForward} aria-label="Voltar para onde você estava" title="Avançar" className={arrow}>
              →
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** Com quem você está falando: fica em cima do roteiro a ligação inteira. */
function CallContext({
  notes,
  attempts,
  status,
  statusError,
}: {
  notes: Record<string, string>
  attempts: number
  /** salvando / salvo: é desta ligação, então fica ao lado do nome */
  status: string
  statusError: boolean
}) {
  const company = (notes.empresa ?? '').trim()
  const responsavel = (notes.responsavel ?? '').trim()
  const whatsapp = (notes.whatsapp ?? '').trim()
  const telefone = (notes.telefone ?? '').trim()
  // Com o WhatsApp do responsável, ele vem primeiro: cai direto em quem decide, não na recepção.
  const primary = whatsapp || telefone
  const meta = [notes.nicho, notes.cidade, responsavel ? `${responsavel} (responsável)` : '', attempts > 1 ? `${attempts}ª tentativa` : '']
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b py-4" style={{ borderColor: 'var(--rt-rule)' }}>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-baseline gap-3">
          <span className="truncate text-[17px] font-semibold text-foreground">{company || 'Empresa sem nome'}</span>
          <span
            role="status"
            className={`shrink-0 text-xs${statusError ? ' text-status-error' : ''}`}
            style={statusError ? undefined : { color: 'var(--rt-faint)' }}
          >
            {status}
          </span>
        </p>
        {meta.length ? (
          <p className="truncate text-sm" style={{ color: 'var(--rt-muted)' }}>
            {meta.join(' · ')}
          </p>
        ) : null}
      </div>
      {primary ? (
        <div className="flex items-center gap-3">
          <div className="text-right text-sm leading-snug">
            <p style={{ color: 'var(--rt-faint)' }}>
              {whatsapp ? `WhatsApp ${responsavel ? `de ${responsavel}` : 'do responsável'}` : 'Telefone da empresa'}
            </p>
            <p className="tabular-nums text-foreground">{primary}</p>
            {whatsapp && telefone ? (
              <p className="text-xs tabular-nums" style={{ color: 'var(--rt-faint)' }}>
                Empresa:{' '}
                <a
                  href={telHref(telefone) || undefined}
                  className="underline decoration-[color:var(--rt-rule)] underline-offset-4 transition-colors hover:text-foreground"
                >
                  {telefone}
                </a>
              </p>
            ) : null}
          </div>
          <CallLink phone={primary} className="py-2.5" />
        </div>
      ) : (
        <p className="text-sm" style={{ color: 'var(--rt-faint)' }}>
          Sem telefone anotado.
        </p>
      )}
    </div>
  )
}

function Badge({ count, tone = 'c2' }: { count: number; tone?: string }) {
  return <span className={`rounded px-1.5 text-xs font-normal tabular-nums ${tone}`}>{count}</span>
}

/** Título de seção da lateral: rótulo pequeno, contagem ao lado e um extra à direita. */
function SectionLabel({
  children,
  count,
  tone,
  htmlFor,
  right,
}: {
  children: ReactNode
  count?: number
  tone?: string
  htmlFor?: string
  right?: ReactNode
}) {
  const className = 'text-[13px] font-semibold'
  const style = { color: 'var(--rt-muted)' }
  return (
    <div className="mb-2 flex items-center gap-2">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={className} style={style}>
          {children}
        </label>
      ) : (
        <p className={className} style={style}>
          {children}
        </p>
      )}
      {count ? <Badge count={count} tone={tone} /> : null}
      {right ? <span className="ml-auto">{right}</span> : null}
    </div>
  )
}

/** Título de cada aba (Retornos, Histórico): nome, uma linha do que tem ali e um controle à direita. */
function ViewHeading({ title, text, right }: { title: string; text?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 max-w-3xl">
        <h1 className="text-[26px] font-bold leading-tight text-foreground">{title}</h1>
        {text ? (
          <p className="mt-1 text-[15px]" style={{ color: 'var(--rt-muted)' }}>
            {text}
          </p>
        ) : null}
      </div>
      {right}
    </div>
  )
}

function ShowAll({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mt-1 text-sm underline transition-colors hover:text-foreground" style={{ color: 'var(--rt-muted)' }}>
      {label}
    </button>
  )
}

/** Quando ligar de novo, curto, e se já passou. */
function callbackWhen(item: ColdCall): { text: string; overdue: boolean } {
  const at = item.notes.horarioAt ?? ''
  if (!at) return { text: (item.notes.horario ?? '').trim() || 'sem horário', overdue: false }
  const overdue = isOverdue(at)
  return { text: overdue ? `atrasado · ${shortWhen(at)}` : shortWhen(at), overdue }
}

/** WhatsApp do responsável primeiro (cai em quem decide); senão o telefone da empresa. */
function contactOf(item: ColdCall): string {
  const whatsapp = (item.notes.whatsapp ?? '').trim()
  return whatsapp ? `WhatsApp ${whatsapp}` : (item.notes.telefone ?? '').trim()
}

/** Lateral do preparo e do fim da ligação: o que vem a seguir. */
function CallLists({
  callbacks,
  todayCalls,
  onResume,
  onOpen,
  onShowCallbacks,
  onShowToday,
}: {
  callbacks: ColdCall[]
  todayCalls: ColdCall[]
  onResume: (call: ColdCall) => void
  onOpen: (call: ColdCall) => void
  onShowCallbacks: () => void
  onShowToday: () => void
}) {
  const overdue = callbacks.filter((item) => item.notes.horarioAt && isOverdue(item.notes.horarioAt)).length
  return (
    <>
      <section className="min-w-0 overflow-hidden">
        <SectionLabel
          count={callbacks.length}
          tone="c5"
          right={
            overdue ? (
              <span className="text-xs tabular-nums" style={{ color: 'var(--c3-fg)' }}>
                {overdue === 1 ? '1 atrasado' : `${overdue} atrasados`}
              </span>
            ) : null
          }
        >
          Retornos
        </SectionLabel>
        {callbacks.length ? (
          <ul className="min-w-0">
            {callbacks.slice(0, SIDE_LIST_MAX).map((item) => {
              const when = callbackWhen(item)
              const responsavel = (item.notes.responsavel ?? '').trim()
              return (
                <li key={item.id} className="flex min-w-0 items-center gap-3 border-t first:border-t-0" style={{ borderColor: 'var(--rt-rule)' }}>
                  <button type="button" onClick={() => onOpen(item)} title={item.notes.obs || undefined} className="group min-w-0 flex-1 py-2.5 text-left">
                    <span className="block truncate text-[15px] font-semibold text-foreground transition-colors group-hover:text-accent">
                      {item.notes.empresa || 'Sem nome'}
                    </span>
                    <span className="block truncate text-xs" style={{ color: 'var(--rt-faint)' }}>
                      <span className="tabular-nums" style={{ color: when.overdue ? 'var(--c3-fg)' : 'var(--rt-muted)' }}>
                        {when.text}
                      </span>
                      {responsavel ? ` · ${responsavel}` : ''}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onResume(item)}
                    aria-label={`Ligar de novo para ${item.notes.empresa || 'essa empresa'}`}
                    className="shrink-0 whitespace-nowrap rounded border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-surface-2"
                  >
                    Ligar
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm" style={{ color: 'var(--rt-faint)' }}>
            Quem pedir pra ligar depois aparece aqui, na ordem do horário.
          </p>
        )}
        {callbacks.length > SIDE_LIST_MAX ? <ShowAll label={`Ver todos (${callbacks.length})`} onClick={onShowCallbacks} /> : null}
      </section>

      <section className="min-w-0 overflow-hidden">
        <SectionLabel count={todayCalls.length}>Hoje</SectionLabel>
        {todayCalls.length ? (
          <ul className="min-w-0">
            {todayCalls.slice(0, SIDE_LIST_MAX).map((item) => {
              const outcome = item.outcome ? CALL_OUTCOMES[item.outcome] : null
              return (
                <li key={item.id} className="min-w-0 border-t first:border-t-0" style={{ borderColor: 'var(--rt-rule)' }}>
                  <button type="button" onClick={() => onOpen(item)} className="group flex w-full min-w-0 items-baseline gap-3 py-2 text-left text-sm">
                    <span className="shrink-0 tabular-nums" style={{ color: 'var(--rt-faint)' }}>
                      {formatTime(item.startedAtMs)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-foreground transition-colors group-hover:text-accent">
                      {item.notes.empresa || 'Sem nome'}
                    </span>
                    <span className="shrink-0 whitespace-nowrap" style={{ color: outcome ? OUTCOME_COLOR[outcome.tone] : 'var(--rt-faint)' }}>
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
        {todayCalls.length > SIDE_LIST_MAX ? <ShowAll label={`Ver todas (${todayCalls.length})`} onClick={onShowToday} /> : null}
      </section>
    </>
  )
}

const AGENDA_GROUPS = ['Atrasados', 'Hoje', 'Amanhã', 'Próximos dias', 'Sem horário'] as const
type AgendaGroup = (typeof AGENDA_GROUPS)[number]

function agendaGroupOf(item: ColdCall): AgendaGroup {
  const at = item.notes.horarioAt ?? ''
  const days = at ? daysFromToday(at) : null
  if (days === null) return 'Sem horário'
  if (isOverdue(at)) return 'Atrasados'
  if (days === 0) return 'Hoje'
  if (days === 1) return 'Amanhã'
  return 'Próximos dias'
}

/** Hoje e amanhã já estão no título do grupo: na linha, só a hora. */
function agendaWhen(item: ColdCall, group: AgendaGroup): string {
  const at = item.notes.horarioAt ?? ''
  if (group === 'Sem horário') return '—'
  if (group === 'Hoje' || group === 'Amanhã') return hourOf(at)
  return shortWhen(at)
}

/** responsável · contato · extras · observação */
function callMeta(item: ColdCall, extra: string[] = []): string {
  return [item.notes.responsavel, contactOf(item), ...extra, item.notes.obs]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' · ')
}

function AgendaRow({
  item,
  when,
  whenTitle,
  overdue,
  meta,
  onOpen,
  onResume,
}: {
  item: ColdCall
  when: string
  whenTitle?: string
  overdue: boolean
  meta: string
  onOpen: (call: ColdCall) => void
  onResume: (call: ColdCall) => void
}) {
  return (
    <li className="flex items-center gap-4 border-b" style={{ borderColor: 'var(--rt-rule)' }}>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="group grid min-w-0 flex-1 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-4 py-3 text-left text-sm"
      >
        <span className="whitespace-nowrap tabular-nums" style={{ color: overdue ? 'var(--c3-fg)' : 'var(--rt-muted)' }} title={whenTitle}>
          {when}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-foreground transition-colors group-hover:text-accent">
            {item.notes.empresa || 'Sem nome'}
          </span>
          {meta ? (
            <span className="block truncate text-xs" style={{ color: 'var(--rt-faint)' }} title={meta}>
              {meta}
            </span>
          ) : null}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onResume(item)}
        aria-label={`Ligar para ${item.notes.empresa || 'essa empresa'}`}
        className="whitespace-nowrap rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-2"
      >
        Ligar
      </button>
    </li>
  )
}

/** Aba Retornos: a fila do dia, na ordem do horário, e quem não atendeu e ainda vale tentar. */
function CallbackAgenda({
  callbacks,
  retries,
  onOpen,
  onResume,
}: {
  callbacks: ColdCall[]
  retries: ColdCall[]
  onOpen: (call: ColdCall) => void
  onResume: (call: ColdCall) => void
}) {
  const [showRetries, setShowRetries] = useState(false)
  const groups = AGENDA_GROUPS.map((label) => ({ label, items: callbacks.filter((item) => agendaGroupOf(item) === label) })).filter(
    (group) => group.items.length > 0,
  )

  return (
    <div className="mx-auto mt-8 max-w-6xl px-6">
      <ViewHeading
        title="Retornos"
        text="Na ordem do horário. Ligar abre a ligação em “Quem atendeu”, com tudo o que já foi anotado."
      />

      {groups.length ? (
        groups.map((group) => {
          const late = group.label === 'Atrasados'
          return (
            <section key={group.label} className="mt-8">
              <h2
                className="flex items-center gap-2 border-b pb-2 text-sm font-semibold"
                style={{ borderColor: 'var(--rt-rule)', color: late ? 'var(--c3-fg)' : 'var(--rt-ink)' }}
              >
                {group.label}
                <Badge count={group.items.length} tone={late ? 'c3' : 'c2'} />
              </h2>
              <ul>
                {group.items.map((item) => (
                  <AgendaRow
                    key={item.id}
                    item={item}
                    when={agendaWhen(item, group.label)}
                    overdue={late}
                    meta={callMeta(item, [
                      group.label === 'Sem horário' ? item.notes.horario ?? '' : '',
                      item.attempts > 1 ? `${item.attempts}ª tentativa` : '',
                    ])}
                    onOpen={onOpen}
                    onResume={onResume}
                  />
                ))}
              </ul>
            </section>
          )
        })
      ) : (
        <p className="mt-8 text-sm" style={{ color: 'var(--rt-faint)' }}>
          Nenhum retorno marcado. Quem pedir pra ligar depois aparece aqui, com o horário combinado.
        </p>
      )}

      {retries.length ? (
        <section className="mt-12">
          <button
            type="button"
            aria-expanded={showRetries}
            onClick={() => setShowRetries((open) => !open)}
            className="group flex w-full items-center gap-2 border-b pb-2 text-left"
            style={{ borderColor: 'var(--rt-rule)' }}
          >
            <span className="whitespace-nowrap text-sm font-semibold text-foreground transition-colors group-hover:text-accent">Não atenderam</span>
            <Badge count={retries.length} />
            <span className="hidden min-w-0 truncate text-xs sm:inline" style={{ color: 'var(--rt-faint)' }}>
              Últimos 14 dias, menos de três tentativas. Tente em outro horário.
            </span>
            <span className="ml-auto" aria-hidden style={{ color: 'var(--rt-faint)' }}>
              {showRetries ? '−' : '+'}
            </span>
          </button>
          {showRetries ? (
            <ul>
              {retries.map((item) => (
                <AgendaRow
                  key={item.id}
                  item={item}
                  when={`${item.attempts} de ${RETRY_MAX}`}
                  whenTitle="Tentativas feitas"
                  overdue={false}
                  meta={callMeta(item, [`tentou ${shortWhenMs(item.startedAtMs)}`])}
                  onOpen={onOpen}
                  onResume={onResume}
                />
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

function OutcomeCard({
  outcome,
  notes,
  done,
  attempts,
  callbackAt,
  dueCallback,
  onCallback,
  onToggle,
  onBack,
  onForward,
  onNext,
  onCallAgain,
  onCallDue,
  onCreatePiloto,
}: {
  outcome: CallOutcome
  notes: Record<string, string>
  done: string[]
  attempts: number
  callbackAt: string
  dueCallback: ColdCall | null
  onCallback: (value: string) => void
  onToggle: (stepId: string) => void
  onBack: () => void
  onForward?: () => void
  onNext: () => void
  onCallAgain: () => void
  onCallDue: () => void
  onCreatePiloto: () => void
}) {
  const info = CALL_OUTCOMES[outcome]
  const hasWhatsapp = Boolean((notes.whatsapp ?? '').trim())
  const due = dueCallback ? callbackWhen(dueCallback) : null

  const summary: Record<CallOutcome, ReactNode> = {
    agendou: <>Reunião com {renderFilled('{responsavel}', notes)}: {renderFilled('{reuniao}', notes)}. Agora é garantir que ela aconteça.</>,
    retorno: (
      <>
        Ligar de novo {renderFilled('{horario}', notes)} e falar com {renderFilled('{responsavel}', notes)}. Fica na aba Retornos, na ordem do
        horário.
      </>
    ),
    'sem-interesse': <>Sem insistir. Porta aberta vale mais que uma ligação forçada.</>,
    barrado: <>A recepção não passou. Não conta como recusa do dono: vale tentar de novo daqui a um tempo, em outro horário.</>,
    'nao-atendeu':
      attempts >= RETRY_MAX ? (
        <>Foram {attempts} tentativas sem resposta. Deixe essa de lado por umas semanas.</>
      ) : (
        <>
          Tente em outro horário, até três vezes (esta foi a {attempts}ª). Começo da manhã e fim da tarde costumam funcionar melhor. Ela fica em
          Retornos, em “Não atenderam”.
        </>
      ),
  }

  return (
    <article className="min-w-0 rounded-lg px-7 py-7" style={{ backgroundColor: 'var(--rt-paper)' }} aria-live="polite">
      <CardTop phase={PHASES.length - 1} onBack={onBack} onForward={onForward} />
      <h1
        className="mt-4 text-[30px] font-bold leading-tight text-foreground"
        style={info.tone === 'muted' ? undefined : { color: OUTCOME_COLOR[info.tone] }}
      >
        {info.label}
      </h1>
      <p className="mt-2 text-[17px] leading-relaxed text-foreground">{summary[outcome]}</p>

      {outcome === 'retorno' ? (
        <div className="mt-6 grid max-w-md gap-1.5">
          <label htmlFor="cc-retorno" className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
            <span className="c5 h-3 w-3 rounded-sm" aria-hidden />
            Quando ligar de novo
          </label>
          <CallbackPicker id="cc-retorno" value={callbackAt} onChange={onCallback} />
        </div>
      ) : null}

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
          {dueCallback && due ? (
            <>
              Retorno na hora: <strong className="font-semibold text-foreground">{dueCallback.notes.empresa || 'Sem nome'}</strong>,{' '}
              <span className="tabular-nums" style={{ color: due.overdue ? 'var(--c3-fg)' : undefined }}>
                {due.text}
              </span>
              .{' '}
            </>
          ) : null}
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
          {dueCallback ? (
            <button
              type="button"
              onClick={onCallDue}
              className="whitespace-nowrap rounded-md border border-border px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-surface-2"
            >
              Ligar pro retorno
            </button>
          ) : null}
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
  { value: 'todas', label: 'Todos os resultados' },
  { value: 'agendou', label: 'Agendou' },
  { value: 'retorno', label: 'Ligar de novo' },
  { value: 'nao-atendeu', label: 'Não atendeu' },
  { value: 'sem-interesse', label: 'Sem interesse' },
  { value: 'barrado', label: 'Recepção barrou' },
  { value: 'pendentes', label: 'Em andamento' },
]

/** hora · empresa · resultado */
const HISTORY_GRID = 'grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-4'

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
  return total ? `${Math.round((part / total) * 100)}%` : ''
}

function matchesFilter(item: ColdCall, filter: HistoryFilter): boolean {
  if (filter === 'todas') return true
  if (filter === 'pendentes') return item.outcome === null
  return item.outcome === filter
}

/** Todas as ligações, por dia, com o funil do período, busca e filtro. Clicar abre a ligação. */
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
  // Veio de "Ver todas" de um resultado: mostra tudo, não só hoje.
  const [period, setPeriod] = useState<Period>(() => (filter === 'todas' ? 'hoje' : 'tudo'))
  const term = companyKeyOf(search)
  const digits = search.replace(/\D/g, '')
  const found = calls.filter((item) => {
    if (!inPeriod(item, period)) return false
    if (!term) return true
    const haystack = companyKeyOf(
      [item.notes.empresa, item.notes.responsavel, item.notes.nicho, item.notes.cidade, item.notes.obs].filter(Boolean).join(' '),
    )
    const phone = `${item.notes.telefone ?? ''} ${item.notes.whatsapp ?? ''}`.replace(/\D/g, '')
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
  // Recusa é só do dono; a recepção que barrou fica num número à parte.
  const refused = found.filter((item) => item.outcome === 'sem-interesse').length
  const blocked = found.filter((item) => item.outcome === 'barrado').length
  const booked = found.filter((item) => item.outcome === 'agendou').length
  const funnel: { label: string; value: number; detail: string; color?: string }[] = [
    { label: total === 1 ? 'ligação' : 'ligações', value: total, detail: '' },
    { label: 'atenderam', value: answered, detail: percent(answered, total) },
    { label: 'com o responsável', value: withOwner, detail: percent(withOwner, total) },
    { label: booked === 1 ? 'reunião' : 'reuniões', value: booked, detail: percent(booked, total), color: booked ? OUTCOME_COLOR.good : undefined },
  ]

  const groups: { label: string; date: string; items: ColdCall[] }[] = []
  for (const item of visible) {
    const label = dayLabel(item.startedAtMs)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(item)
    else {
      const date = new Date(item.startedAtMs).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      // "Segunda-feira, 28/09" já traz a data; só Hoje e Ontem ganham a data ao lado.
      groups.push({ label, date: label === 'Hoje' || label === 'Ontem' ? date : '', items: [item] })
    }
  }
  const filtering = filter !== 'todas' || search.trim() !== ''

  return (
    <div className="mx-auto mt-8 max-w-6xl px-6">
      <ViewHeading
        title="Histórico"
        right={
          <div className="flex rounded-md border border-border p-0.5" role="group" aria-label="Período">
            {PERIODS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={period === option.value}
                onClick={() => setPeriod(option.value)}
                className={`whitespace-nowrap rounded px-3 py-1 text-sm transition-colors ${
                  period === option.value ? 'bg-surface-2 font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Funil do período: de quantas ligações saíram quantas reuniões. */}
      <div className="mt-6 flex flex-wrap items-end gap-x-10 gap-y-4 border-b pb-5" style={{ borderColor: 'var(--rt-rule)' }}>
        <ol className="flex flex-wrap items-end gap-x-4 gap-y-3" aria-label="Funil do período">
          {funnel.map((step, index) => (
            <li key={step.label} className="flex items-end gap-4">
              {index ? (
                <span aria-hidden className="pb-5 text-sm" style={{ color: 'var(--rt-faint)' }}>
                  ›
                </span>
              ) : null}
              <span>
                <span
                  className="block text-[24px] font-semibold leading-none tabular-nums text-foreground"
                  style={step.color ? { color: step.color } : undefined}
                >
                  {step.value}
                </span>
                <span className="mt-1.5 block whitespace-nowrap text-xs" style={{ color: 'var(--rt-muted)' }}>
                  {step.label}
                  {step.detail ? (
                    <span className="tabular-nums" style={{ color: 'var(--rt-faint)' }}>
                      {' '}
                      · {step.detail}
                    </span>
                  ) : null}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <p className="text-xs tabular-nums sm:ml-auto" style={{ color: 'var(--rt-muted)' }}>
          Dono recusou <strong className="font-semibold text-foreground">{refused}</strong>
          <span style={{ color: 'var(--rt-faint)' }}> · </span>
          Recepção barrou <strong className="font-semibold text-foreground">{blocked}</strong>
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar empresa, responsável, nicho, telefone…"
          aria-label="Buscar ligações"
          className="min-w-0 flex-1 basis-64 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none sm:max-w-md"
        />
        <select
          value={filter}
          onChange={(event) => onFilter(event.target.value as HistoryFilter)}
          aria-label="Filtrar por resultado"
          className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
          style={{ colorScheme: 'dark' }}
        >
          {HISTORY_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} ({counts[option.value]})
            </option>
          ))}
        </select>
        {filtering ? (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              onFilter('todas')
            }}
            className="whitespace-nowrap text-sm underline underline-offset-4 transition-colors hover:text-foreground"
            style={{ color: 'var(--rt-muted)' }}
          >
            Limpar
          </button>
        ) : null}
      </div>

      {groups.length ? (
        groups.map((group) => (
          <section key={group.label} className="mt-8">
            <h2 className="flex items-center gap-2 border-b pb-2 text-sm font-semibold text-foreground" style={{ borderColor: 'var(--rt-rule)' }}>
              {group.label}
              {group.date ? (
                <span className="font-normal tabular-nums" style={{ color: 'var(--rt-faint)' }}>
                  {group.date}
                </span>
              ) : null}
              <Badge count={group.items.length} />
            </h2>
            <ul>
              {group.items.map((item) => {
                const outcome = item.outcome ? CALL_OUTCOMES[item.outcome] : null
                const detail = [item.notes.responsavel, contactOf(item), item.notes.nicho]
                  .map((value) => (value ?? '').trim())
                  .filter(Boolean)
                  .join(' · ')
                const callbackAt = item.outcome === 'retorno' ? item.notes.horarioAt ?? '' : ''
                const overdue = callbackAt ? isOverdue(callbackAt) : false
                return (
                  <li key={item.id} className="border-b" style={{ borderColor: 'var(--rt-rule)' }}>
                    <button
                      type="button"
                      onClick={() => onOpen(item)}
                      title={item.notes.obs || undefined}
                      className={`${HISTORY_GRID} group w-full py-3 text-left text-sm`}
                    >
                      <span className="tabular-nums" style={{ color: 'var(--rt-faint)' }}>
                        {formatTime(item.startedAtMs)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold text-foreground transition-colors group-hover:text-accent">
                          {item.notes.empresa || 'Sem nome'}
                        </span>
                        {detail ? (
                          <span className="block truncate text-xs" style={{ color: 'var(--rt-faint)' }}>
                            {detail}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-right">
                        <span className="block whitespace-nowrap" style={{ color: outcome ? OUTCOME_COLOR[outcome.tone] : 'var(--rt-faint)' }}>
                          {outcome ? outcome.label : 'Em andamento'}
                          {item.attempts > 1 ? (
                            <span className="text-xs tabular-nums" style={{ color: 'var(--rt-faint)' }} title={`${item.attempts} tentativas`}>
                              {' '}
                              · {item.attempts}x
                            </span>
                          ) : null}
                        </span>
                        {callbackAt ? (
                          <span className="block whitespace-nowrap text-xs tabular-nums" style={{ color: overdue ? 'var(--c3-fg)' : 'var(--rt-faint)' }}>
                            {overdue ? `atrasado · ${shortWhen(callbackAt)}` : shortWhen(callbackAt)}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      ) : (
        <p className="mt-8 text-sm" style={{ color: 'var(--rt-faint)' }}>
          {calls.length
            ? filtering
              ? 'Nenhuma ligação com essa busca ou filtro.'
              : 'Nenhuma ligação nesse período.'
            : 'Nenhuma ligação ainda.'}
        </p>
      )}

      {hasMore ? (
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="whitespace-nowrap rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            {loadingMore ? 'Carregando…' : 'Carregar mais antigas'}
          </button>
          <span className="text-xs" style={{ color: 'var(--rt-faint)' }}>
            A busca e o filtro olham só as ligações carregadas.
          </span>
        </div>
      ) : null}
    </div>
  )
}

import type { CallOutcome } from '../lib/coldCallScript'
import { CALL_NODES, CALL_OUTCOMES, CALL_START } from '../lib/coldCallScript'

/** Uma ligação fria: anotações, por onde passou e como terminou. */
export interface ColdCall {
  id: string
  notes: Record<string, string>
  nodeId: string
  /** fichas anteriores, para voltar */
  path: string[]
  outcome: CallOutcome | null
  /** passos feitos depois de agendar */
  done: string[]
  /** última vez que ligou, no relógio do navegador (para "hoje" e ordenação) */
  startedAtMs: number
  /** quantas vezes já ligou para essa empresa */
  attempts: number
}

export type ColdCallData = Omit<ColdCall, 'id'>

function stringRecord(value: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (typeof item === 'string') {
        out[key] = item
      }
    }
  }
  return out
}

function nodeIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && id in CALL_NODES) : []
}

export function normalizeColdCall(raw: unknown): ColdCallData {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const outcome = typeof record.outcome === 'string' && record.outcome in CALL_OUTCOMES ? (record.outcome as CallOutcome) : null
  const nodeId = typeof record.nodeId === 'string' && record.nodeId in CALL_NODES ? record.nodeId : CALL_START
  const startedAtMs =
    typeof record.startedAtMs === 'number' && Number.isFinite(record.startedAtMs) ? record.startedAtMs : Date.now()
  return {
    notes: stringRecord(record.notes),
    nodeId,
    path: nodeIds(record.path),
    outcome,
    done: Array.isArray(record.done) ? record.done.filter((item): item is string => typeof item === 'string') : [],
    startedAtMs,
    attempts:
      typeof record.attempts === 'number' && Number.isFinite(record.attempts) && record.attempts >= 1
        ? Math.round(record.attempts)
        : 1,
  }
}

function plain(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** "Estúdio Carla Carrion" e "estudio  carla carrion" são a mesma empresa. */
export function companyKeyOf(name: string): string {
  return plain(name).replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Últimos 8 dígitos: pega o mesmo número com ou sem DDD, com ou sem máscara. */
export function phoneKeyOf(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 8 ? digits.slice(-8) : ''
}

/** Falou com quem decide: passou pela abertura com o responsável. */
export function reachedOwner(call: Pick<ColdCall, 'nodeId' | 'path'>): boolean {
  return [...call.path, call.nodeId].includes('abertura')
}

/**
 * Conversa com a extensão "WorkPRO Cold call" (pasta extensao-workpro), por window.postMessage.
 * - O app manda o histórico resumido: a extensão marca no Google quem já recebeu ligação.
 * - A extensão manda a empresa que você achou no Google Maps / Locais: o app abre a ligação.
 * Nada passa por servidor; a extensão guarda o resumo no próprio Chrome.
 */

import type { ColdCall } from '../types/coldCall'
import { companyKeyOf, phoneKeyOf } from '../types/coldCall'

const APP_SOURCE = 'workpro-app'
const EXTENSION_SOURCE = 'workpro-extension'

export interface ExtensionLead {
  empresa: string
  telefone: string
  cidade: string
  /** categoria do Google (ex.: "Estúdio de pilates"): vira o nicho se ele estiver vazio */
  categoria: string
}

function post(type: string, payload: Record<string, unknown> = {}) {
  window.postMessage({ source: APP_SOURCE, type, ...payload }, window.location.origin)
}

/** Avisa a extensão que o Cold call está aberto e pronto para receber uma empresa. */
export function announceColdCallReady() {
  post('ready')
}

/** Resumo do histórico: só o necessário para reconhecer a empresa e mostrar o status. */
export function syncColdCallsToExtension(calls: ColdCall[]) {
  post('coldcalls', {
    items: calls.map((item) => ({
      id: item.id,
      name: (item.notes.empresa ?? '').trim(),
      companyKey: companyKeyOf(item.notes.empresa ?? ''),
      phoneKey: phoneKeyOf(item.notes.telefone ?? ''),
      outcome: item.outcome,
      attempts: item.attempts,
      lastMs: item.startedAtMs,
      responsavel: (item.notes.responsavel ?? '').trim(),
      horario: (item.notes.horario ?? '').trim(),
    })),
  })
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/** Lê uma mensagem da extensão; qualquer coisa fora do formato é ignorada. */
export function readExtensionLead(event: MessageEvent): ExtensionLead | null {
  if (event.source !== window || event.origin !== window.location.origin) return null
  const data = event.data as Record<string, unknown> | null
  if (!data || data.source !== EXTENSION_SOURCE || data.type !== 'lead') return null
  const lead = (data.lead ?? {}) as Record<string, unknown>
  const empresa = text(lead.empresa, 120)
  if (!empresa) return null
  return {
    empresa,
    telefone: text(lead.telefone, 40),
    cidade: text(lead.cidade, 80),
    categoria: text(lead.categoria, 80),
  }
}

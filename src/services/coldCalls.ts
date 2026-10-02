import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
} from 'firebase/firestore'
import type { ColdCallNiche } from '../ai/adaptColdCallNiche'
import { auth, db } from '../lib/firebase'
import type { ColdCall, ColdCallData } from '../types/coldCall'
import { companyKeyOf, normalizeColdCall, phoneKeyOf } from '../types/coldCall'

function requireUserUid(): string {
  const uid = auth.currentUser?.uid
  if (!uid) {
    throw new Error('Usuário não autenticado')
  }
  return uid
}

function coldCallsCollection(uid: string) {
  return collection(db, 'users', uid, 'coldCalls')
}

/** Campos de busca: acham a mesma empresa pelo nome ou pelo telefone. */
function searchKeys(data: ColdCallData) {
  return {
    companyKey: companyKeyOf(data.notes.empresa ?? ''),
    phoneKey: phoneKeyOf(data.notes.telefone ?? ''),
  }
}

function toCall(id: string, data: Record<string, unknown>): ColdCall {
  return { id, ...normalizeColdCall(data) }
}

export async function createColdCall(data: ColdCallData): Promise<string> {
  const uid = requireUserUid()
  const ref = await addDoc(coldCallsCollection(uid), {
    ...normalizeColdCall(data),
    ...searchKeys(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateColdCall(id: string, data: ColdCallData): Promise<void> {
  const uid = requireUserUid()
  await updateDoc(doc(db, 'users', uid, 'coldCalls', id), {
    ...normalizeColdCall(data),
    ...searchKeys(data),
    updatedAt: serverTimestamp(),
  })
}

export async function getColdCall(id: string): Promise<ColdCall | null> {
  const uid = requireUserUid()
  const snapshot = await getDoc(doc(db, 'users', uid, 'coldCalls', id))
  if (!snapshot.exists()) return null
  return toCall(snapshot.id, snapshot.data())
}

export const COLD_CALL_PAGE = 50

/** Uma página do histórico, da mais recente para a mais antiga. */
export async function listColdCalls(beforeMs?: number): Promise<{ items: ColdCall[]; hasMore: boolean }> {
  const uid = requireUserUid()
  const constraints = [orderBy('startedAtMs', 'desc'), ...(beforeMs ? [startAfter(beforeMs)] : []), limit(COLD_CALL_PAGE)]
  const snapshot = await getDocs(query(coldCallsCollection(uid), ...constraints))
  return {
    items: snapshot.docs.map((document) => toCall(document.id, document.data())),
    hasMore: snapshot.docs.length === COLD_CALL_PAGE,
  }
}

/** Todas as marcadas para ligar de novo, mesmo as antigas que não estão na página. */
export async function listCallbacks(): Promise<ColdCall[]> {
  const uid = requireUserUid()
  const snapshot = await getDocs(query(coldCallsCollection(uid), where('outcome', '==', 'retorno'), limit(100)))
  return snapshot.docs.map((document) => toCall(document.id, document.data()))
}

/** Ligações já feitas para a mesma empresa (pelo nome ou pelo telefone). */
export async function findColdCallDuplicates(company: string, phone: string): Promise<ColdCall[]> {
  const uid = requireUserUid()
  const companyKey = companyKeyOf(company)
  const phoneKey = phoneKeyOf(phone)
  const queries = [
    ...(companyKey ? [query(coldCallsCollection(uid), where('companyKey', '==', companyKey), limit(5))] : []),
    ...(phoneKey ? [query(coldCallsCollection(uid), where('phoneKey', '==', phoneKey), limit(5))] : []),
  ]
  const snapshots = await Promise.all(queries.map((q) => getDocs(q)))
  const byId = new Map<string, ColdCall>()
  for (const snapshot of snapshots) {
    for (const document of snapshot.docs) {
      byId.set(document.id, toCall(document.id, document.data()))
    }
  }
  return [...byId.values()]
}

/**
 * Roteiro adaptado por nicho, guardado para não chamar a IA a cada ligação.
 * `key` já vem normalizada (sem acento, minúscula) e com a versão da instrução.
 */
export async function getCachedNiche(key: string): Promise<ColdCallNiche | null> {
  const uid = requireUserUid()
  const snapshot = await getDoc(doc(db, 'users', uid, 'coldCallNiches', key))
  if (!snapshot.exists()) return null
  const data = snapshot.data()
  const niche = {
    grupo: typeof data.grupo === 'string' ? data.grupo : '',
    clientes: typeof data.clientes === 'string' ? data.clientes : '',
    dor1: typeof data.dor1 === 'string' ? data.dor1 : '',
    dor2: typeof data.dor2 === 'string' ? data.dor2 : '',
  }
  return niche.grupo && niche.clientes && niche.dor1 && niche.dor2 ? niche : null
}

/** `nicho`: como você digitou, para aparecer na lista de nichos já usados. */
export async function saveCachedNiche(key: string, niche: ColdCallNiche, nicho: string): Promise<void> {
  const uid = requireUserUid()
  await setDoc(doc(db, 'users', uid, 'coldCallNiches', key), { ...niche, nicho, updatedAt: serverTimestamp() })
}

export interface SavedNiche {
  key: string
  /** vazio em nichos salvos antes de guardarmos o nome */
  nicho: string
}

/** Nichos já adaptados (a lista do campo Nicho). */
export async function listCachedNiches(): Promise<SavedNiche[]> {
  const uid = requireUserUid()
  const snapshot = await getDocs(collection(db, 'users', uid, 'coldCallNiches'))
  return snapshot.docs.map((document) => {
    const data = document.data()
    return { key: document.id, nicho: typeof data.nicho === 'string' ? data.nicho : '' }
  })
}

/** Tira o nicho da lista; se ele for usado de novo, a IA adapta outra vez. */
export async function deleteCachedNiche(key: string): Promise<void> {
  const uid = requireUserUid()
  await deleteDoc(doc(db, 'users', uid, 'coldCallNiches', key))
}

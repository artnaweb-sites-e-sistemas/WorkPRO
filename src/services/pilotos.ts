import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import type { ProposalStatus } from '../types/proposalDoc'
import type { PilotoAiContent, PilotoDoc, PilotoInput, PilotoScript } from '../types/piloto'
import { normalizePilotoAiContent, normalizePilotoInput, normalizePilotoScript } from '../types/piloto'

function requireUserUid(): string {
  const uid = auth.currentUser?.uid
  if (!uid) {
    throw new Error('Usuário não autenticado')
  }
  return uid
}

function pilotosCollection(uid: string) {
  return collection(db, 'users', uid, 'pilotos')
}

function pilotoRef(uid: string, id: string) {
  return doc(db, 'users', uid, 'pilotos', id)
}

function parseStatus(value: unknown): ProposalStatus {
  if (value === 'fechado' || value === 'perdido' || value === 'ativo') {
    return value
  }
  return 'ativo'
}

function docToPiloto(id: string, data: Record<string, unknown>): PilotoDoc {
  return {
    id,
    ownerUid: data.ownerUid as string,
    input: normalizePilotoInput(data.input),
    content: normalizePilotoAiContent(data.content),
    script: normalizePilotoScript(data.script),
    status: parseStatus(data.status),
    createdAt: data.createdAt as PilotoDoc['createdAt'],
    updatedAt: data.updatedAt as PilotoDoc['updatedAt'],
  }
}

export async function createPiloto(
  input: PilotoInput,
  content: PilotoAiContent,
): Promise<string> {
  const ownerUid = requireUserUid()

  const docRef = await addDoc(pilotosCollection(ownerUid), {
    ownerUid,
    input: normalizePilotoInput(input),
    content: normalizePilotoAiContent(content),
    status: 'ativo' satisfies ProposalStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return docRef.id
}

export async function updatePiloto(
  id: string,
  partial: {
    input?: PilotoInput
    content?: PilotoAiContent
    status?: ProposalStatus
  },
): Promise<void> {
  const uid = requireUserUid()

  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  }

  if (partial.input) {
    payload.input = normalizePilotoInput(partial.input)
  }
  if (partial.content) {
    payload.content = normalizePilotoAiContent(partial.content)
  }
  if (partial.status) {
    payload.status = partial.status
  }

  await updateDoc(pilotoRef(uid, id), payload)
}

/** Grava só as anotações do roteiro, sem tocar em input e conteúdo (que o editor salva sozinho). */
export async function updatePilotoScript(id: string, script: PilotoScript): Promise<void> {
  const uid = requireUserUid()
  await updateDoc(pilotoRef(uid, id), {
    script: normalizePilotoScript(script),
    updatedAt: serverTimestamp(),
  })
}

export async function updatePilotoStatus(id: string, status: ProposalStatus): Promise<void> {
  await updatePiloto(id, { status })
}

export async function getPiloto(id: string): Promise<PilotoDoc | null> {
  const uid = requireUserUid()
  const snapshot = await getDoc(pilotoRef(uid, id))

  if (!snapshot.exists()) {
    return null
  }

  return docToPiloto(snapshot.id, snapshot.data())
}

export async function listPilotos(): Promise<PilotoDoc[]> {
  const uid = requireUserUid()
  const q = query(pilotosCollection(uid), orderBy('createdAt', 'desc'), limit(30))
  const snapshot = await getDocs(q)

  return snapshot.docs.map((document) => docToPiloto(document.id, document.data()))
}

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
import type {
  ProposalContentDoc,
  ProposalDoc,
  ProposalFormInput,
} from '../types/proposalDoc'

function requireUserUid(): string {
  const uid = auth.currentUser?.uid
  if (!uid) {
    throw new Error('Usuário não autenticado')
  }
  return uid
}

function proposalsCollection(uid: string) {
  return collection(db, 'users', uid, 'proposals')
}

function proposalRef(uid: string, id: string) {
  return doc(db, 'users', uid, 'proposals', id)
}

function docToProposal(id: string, data: Record<string, unknown>): ProposalDoc {
  return {
    id,
    ownerUid: data.ownerUid as string,
    input: data.input as ProposalFormInput,
    content: data.content as ProposalContentDoc,
    createdAt: data.createdAt as ProposalDoc['createdAt'],
    updatedAt: data.updatedAt as ProposalDoc['updatedAt'],
  }
}

export async function createProposal(
  input: ProposalFormInput,
  content: ProposalContentDoc,
): Promise<string> {
  const ownerUid = requireUserUid()

  const docRef = await addDoc(proposalsCollection(ownerUid), {
    ownerUid,
    input,
    content,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return docRef.id
}

export async function updateProposal(
  id: string,
  partial: { input?: ProposalFormInput; content?: ProposalContentDoc },
): Promise<void> {
  const uid = requireUserUid()

  await updateDoc(proposalRef(uid, id), {
    ...partial,
    updatedAt: serverTimestamp(),
  })
}

export async function getProposal(id: string): Promise<ProposalDoc | null> {
  const uid = requireUserUid()
  const snapshot = await getDoc(proposalRef(uid, id))

  if (!snapshot.exists()) {
    return null
  }

  return docToProposal(snapshot.id, snapshot.data())
}

export async function listProposals(): Promise<ProposalDoc[]> {
  const uid = requireUserUid()
  const q = query(proposalsCollection(uid), orderBy('createdAt', 'desc'), limit(30))
  const snapshot = await getDocs(q)

  return snapshot.docs.map((document) => docToProposal(document.id, document.data()))
}

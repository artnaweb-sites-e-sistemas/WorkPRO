import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { Unsubscribe } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import type { Conversation, ConversationChannel, ConversationServiceSnapshot, ConversationStatus, ConversationUpdate, Stage } from '../types/models'
import type { ProposalContent } from '../types/proposal'
import { parseStoredProposalContent } from '../types/proposal'

const COLLECTION = 'conversations'

function requireUserUid(): string {
  const uid = auth.currentUser?.uid
  if (!uid) {
    throw new Error('Usuário não autenticado')
  }
  return uid
}

function parseConversationServices(data: unknown): ConversationServiceSnapshot[] {
  if (!Array.isArray(data)) {
    return []
  }

  return data
    .filter((item): item is ConversationServiceSnapshot => {
      if (!item || typeof item !== 'object') {
        return false
      }

      const record = item as Partial<ConversationServiceSnapshot>
      return typeof record.name === 'string' && typeof record.description === 'string'
    })
    .map((item) => ({
      name: item.name,
      description: item.description,
    }))
}

function docToConversation(id: string, data: Record<string, unknown>): Conversation {
  return {
    id,
    ownerUid: data.ownerUid as string,
    clientName: data.clientName as string,
    projectTitle: data.projectTitle as string,
    projectDetails: data.projectDetails as string,
    channel: (data.channel as ConversationChannel) ?? 'workana',
    services: parseConversationServices(data.services),
    stage: data.stage as Conversation['stage'],
    previousStage: (data.previousStage as Stage | null) ?? null,
    relationshipCount: data.relationshipCount as number,
    videoCallEnabled: data.videoCallEnabled as boolean,
    videoCallDone: (data.videoCallDone as boolean) ?? false,
    induceQuote: (data.induceQuote as boolean) ?? false,
    suggestedPrice: (data.suggestedPrice as string | null) ?? null,
    suggestedRecurringPrice: (data.suggestedRecurringPrice as string | null) ?? null,
    isRecurring: (data.isRecurring as boolean) ?? false,
    collectedInfo: (data.collectedInfo as string) ?? '',
    proposalContent: parseStoredProposalContent(data.proposalContent),
    proposalText: (data.proposalText as string | null) ?? null,
    proposalUpdatedAt: (data.proposalUpdatedAt as Conversation['proposalUpdatedAt']) ?? null,
    meetingScript: (data.meetingScript as string | null) ?? null,
    meetingScriptUpdatedAt:
      (data.meetingScriptUpdatedAt as Conversation['meetingScriptUpdatedAt']) ?? null,
    status: data.status as Conversation['status'],
    createdAt: data.createdAt as Conversation['createdAt'],
    updatedAt: data.updatedAt as Conversation['updatedAt'],
  }
}

export async function createConversation(data: {
  clientName: string
  projectTitle: string
  projectDetails: string
  videoCallEnabled: boolean
  channel?: ConversationChannel
  services?: ConversationServiceSnapshot[]
  stage?: Stage
}): Promise<string> {
  const ownerUid = requireUserUid()

  try {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ownerUid,
      clientName: data.clientName,
      projectTitle: data.projectTitle,
      projectDetails: data.projectDetails,
      channel: data.channel ?? 'workana',
      services: data.services ?? [],
      videoCallEnabled: data.videoCallEnabled,
      videoCallDone: false,
      induceQuote: false,
      stage: data.stage ?? 'abordagem',
      previousStage: null,
      relationshipCount: 0,
      suggestedPrice: null,
      suggestedRecurringPrice: null,
      isRecurring: false,
      collectedInfo: '',
      proposalContent: null,
      proposalText: null,
      proposalUpdatedAt: null,
      meetingScript: null,
      meetingScriptUpdatedAt: null,
      status: 'ativo',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    return docRef.id
  } catch (error) {
    console.error('[createConversation]', error)
    throw error
  }
}

export function listConversations(
  callback: (conversations: Conversation[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const ownerUid = requireUserUid()

  const q = query(
    collection(db, COLLECTION),
    where('ownerUid', '==', ownerUid),
    orderBy('updatedAt', 'desc'),
  )

  return onSnapshot(
    q,
    (snapshot) => {
      const conversations = snapshot.docs.map((document) =>
        docToConversation(document.id, document.data()),
      )
      callback(conversations)
    },
    (error) => {
      console.error('[listConversations]', error)
      onError?.(error)
    },
  )
}

export function getConversation(
  id: string,
  callback: (conversation: Conversation | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  requireUserUid()

  const ref = doc(db, COLLECTION, id)

  return onSnapshot(
    ref,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback(null)
        return
      }

      callback(docToConversation(snapshot.id, snapshot.data()))
    },
    (error) => {
      console.error('[getConversation]', error)
      onError?.(error)
    },
  )
}

export async function updateConversation(
  id: string,
  partial: ConversationUpdate,
): Promise<void> {
  requireUserUid()

  await updateDoc(doc(db, COLLECTION, id), {
    ...partial,
    updatedAt: serverTimestamp(),
  })
}

export async function updateConversationStatus(
  id: string,
  current: Pick<Conversation, 'status' | 'stage' | 'previousStage'>,
  nextStatus: ConversationStatus,
): Promise<void> {
  const partial: ConversationUpdate = { status: nextStatus }

  if (nextStatus === 'fechado' || nextStatus === 'perdido') {
    if (current.status === 'ativo') {
      partial.stage = 'fechamento'
      partial.previousStage = current.stage
    }
  } else if (nextStatus === 'ativo' && current.previousStage !== null) {
    partial.stage = current.previousStage
    partial.previousStage = null
  }

  await updateConversation(id, partial)
}

export async function deleteConversation(id: string): Promise<void> {
  requireUserUid()

  const conversationRef = doc(db, COLLECTION, id)
  const messagesSnapshot = await getDocs(collection(db, COLLECTION, id, 'messages'))

  const batch = writeBatch(db)
  messagesSnapshot.docs.forEach((messageDoc) => batch.delete(messageDoc.ref))
  batch.delete(conversationRef)
  await batch.commit()
}

export async function toggleVideoCall(id: string, enabled: boolean): Promise<void> {
  await updateConversation(id, { videoCallEnabled: enabled })
}

export async function toggleInduceQuote(id: string, enabled: boolean): Promise<void> {
  await updateConversation(id, { induceQuote: enabled })
}

export async function setSuggestedPrice(id: string, price: string | null): Promise<void> {
  await updateConversation(id, { suggestedPrice: price })
}

export async function setSuggestedRecurringPrice(
  id: string,
  price: string | null,
): Promise<void> {
  await updateConversation(id, { suggestedRecurringPrice: price })
}

export async function saveProposalContent(id: string, content: ProposalContent): Promise<void> {
  requireUserUid()

  await updateDoc(doc(db, COLLECTION, id), {
    proposalContent: content,
    proposalText: null,
    proposalUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

/** @deprecated Use saveProposalContent — mantido para compatibilidade. */
export async function saveProposalText(id: string, text: string): Promise<void> {
  requireUserUid()

  await updateDoc(doc(db, COLLECTION, id), {
    proposalText: text,
    proposalUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function saveMeetingScript(id: string, text: string): Promise<void> {
  requireUserUid()

  await updateDoc(doc(db, COLLECTION, id), {
    meetingScript: text,
    meetingScriptUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

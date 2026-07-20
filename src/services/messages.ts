import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import type { Unsubscribe } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import type { ReconcileAction } from '../ai/importParser'
import type { Message, Sender, Stage } from '../types/models'

function requireUserUid(): string {
  const uid = auth.currentUser?.uid
  if (!uid) {
    throw new Error('Usuário não autenticado')
  }
  return uid
}

function docToMessage(id: string, data: Record<string, unknown>): Message {
  return {
    id,
    sender: data.sender as Sender,
    stage: data.stage as Stage,
    text: data.text as string,
    createdAt: data.createdAt as Message['createdAt'],
  }
}

export async function addMessage(
  convId: string,
  data: { sender: Sender; stage: Stage; text: string },
): Promise<string> {
  requireUserUid()

  const docRef = await addDoc(collection(db, 'conversations', convId, 'messages'), {
    sender: data.sender,
    stage: data.stage,
    text: data.text,
    createdAt: serverTimestamp(),
  })

  return docRef.id
}

export async function deleteMessage(convId: string, messageId: string): Promise<void> {
  requireUserUid()

  await deleteDoc(doc(db, 'conversations', convId, 'messages', messageId))
}

export async function updateMessage(
  convId: string,
  messageId: string,
  data: { text: string },
): Promise<void> {
  requireUserUid()

  await updateDoc(doc(db, 'conversations', convId, 'messages', messageId), {
    text: data.text,
  })
}

export function listMessages(
  convId: string,
  callback: (messages: Message[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  requireUserUid()

  const q = query(
    collection(db, 'conversations', convId, 'messages'),
    orderBy('createdAt', 'asc'),
  )

  return onSnapshot(
    q,
    (snapshot) => {
      const messages = snapshot.docs.map((document) =>
        docToMessage(document.id, document.data()),
      )
      callback(messages)
    },
    (error) => onError?.(error),
  )
}

/** Incrementa relationshipCount ao enviar mensagem "eu" na etapa relacionamento. Não é chamado automaticamente. */
export async function incrementRelationshipCountOnOutboundMessage(
  convId: string,
): Promise<void> {
  requireUserUid()

  await updateDoc(doc(db, 'conversations', convId), {
    relationshipCount: increment(1),
    updatedAt: serverTimestamp(),
  })
}

/** Aplica thread reconciliada: kept/updated reutilizam docs existentes; added cria novos; createdAt sequencial. */
export async function applyReconciledThread(
  convId: string,
  stage: Stage,
  thread: {
    sender: Sender
    text: string
    action: ReconcileAction
    matchedMessageId: string | null
    createdAt?: Date
  }[],
): Promise<void> {
  requireUserUid()

  const messagesRef = collection(db, 'conversations', convId, 'messages')
  const snapshot = await getDocs(messagesRef)
  const existingById = new Map(snapshot.docs.map((messageDoc) => [messageDoc.id, messageDoc]))

  const batch = writeBatch(db)
  const baseMs = Date.now() - thread.length * 1000

  thread.forEach((item, index) => {
    const createdAt = item.createdAt
      ? Timestamp.fromDate(item.createdAt)
      : Timestamp.fromMillis(baseMs + index * 1000)

    if (item.matchedMessageId && existingById.has(item.matchedMessageId)) {
      const existing = existingById.get(item.matchedMessageId)!
      const existingData = existing.data()

      batch.update(existing.ref, {
        sender: item.sender,
        text: item.text,
        createdAt,
        stage: (existingData.stage as Stage) ?? stage,
      })
    } else {
      const newRef = doc(messagesRef)
      batch.set(newRef, {
        sender: item.sender,
        stage,
        text: item.text,
        createdAt,
      })
    }
  })

  batch.update(doc(db, 'conversations', convId), {
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
}

export async function addImportedMessages(
  convId: string,
  stage: Stage,
  messages: { sender: Sender; text: string; createdAt: Date }[],
): Promise<void> {
  requireUserUid()

  if (messages.length === 0) {
    return
  }

  const messagesRef = collection(db, 'conversations', convId, 'messages')
  const batch = writeBatch(db)

  messages.forEach((message) => {
    const newRef = doc(messagesRef)
    batch.set(newRef, {
      sender: message.sender,
      stage,
      text: message.text,
      createdAt: Timestamp.fromDate(message.createdAt),
    })
  })

  batch.update(doc(db, 'conversations', convId), {
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
}

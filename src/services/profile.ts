import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore'
import type { Unsubscribe } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import {
  DEFAULT_PRESENTER_PROFILE,
  type PresenterProfile,
} from '../types/models'

function requireUserUid(): string {
  const uid = auth.currentUser?.uid
  if (!uid) {
    throw new Error('Usuário não autenticado')
  }
  return uid
}

function profileRef(uid: string) {
  return doc(db, 'users', uid, 'settings', 'profile')
}

function mergeWithDefaults(data: Record<string, unknown>): PresenterProfile {
  const legacyProfissao = typeof data.profissao === 'string' ? data.profissao : null

  return {
    nome: typeof data.nome === 'string' ? data.nome : DEFAULT_PRESENTER_PROFILE.nome,
    empresa: typeof data.empresa === 'string' ? data.empresa : DEFAULT_PRESENTER_PROFILE.empresa,
    areas:
      typeof data.areas === 'string'
        ? data.areas
        : legacyProfissao ?? DEFAULT_PRESENTER_PROFILE.areas,
    desde: typeof data.desde === 'string' ? data.desde : DEFAULT_PRESENTER_PROFILE.desde,
    provaSocial:
      typeof data.provaSocial === 'string'
        ? data.provaSocial
        : DEFAULT_PRESENTER_PROFILE.provaSocial,
    tom: typeof data.tom === 'string' ? data.tom : DEFAULT_PRESENTER_PROFILE.tom,
    temBriefing:
      typeof data.temBriefing === 'boolean'
        ? data.temBriefing
        : DEFAULT_PRESENTER_PROFILE.temBriefing,
    briefingInfo:
      typeof data.briefingInfo === 'string'
        ? data.briefingInfo
        : DEFAULT_PRESENTER_PROFILE.briefingInfo,
  }
}

export function subscribeProfile(
  callback: (profile: PresenterProfile) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const uid = requireUserUid()

  return onSnapshot(
    profileRef(uid),
    (snapshot) => {
      if (snapshot.exists()) {
        callback(mergeWithDefaults(snapshot.data()))
        return
      }

      callback(DEFAULT_PRESENTER_PROFILE)
    },
    (error) => onError?.(error),
  )
}

export async function getProfile(): Promise<PresenterProfile> {
  try {
    const uid = requireUserUid()
    const snapshot = await getDoc(profileRef(uid))

    if (!snapshot.exists()) {
      return DEFAULT_PRESENTER_PROFILE
    }

    return mergeWithDefaults(snapshot.data())
  } catch (error) {
    console.error('[getProfile]', error)
    return DEFAULT_PRESENTER_PROFILE
  }
}

export async function saveProfile(profile: PresenterProfile): Promise<void> {
  const uid = requireUserUid()

  await setDoc(profileRef(uid), profile, { merge: true })
}

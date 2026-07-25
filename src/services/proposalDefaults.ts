import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore'
import type { Unsubscribe } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import type { ProposalDefaults } from '../types/proposalDoc'

const DEFAULT_PROPOSAL_DEFAULTS: ProposalDefaults = {
  logoDataUrl: '',
  markDataUrl: '',
  companyName: '',
  companyAbout: '',
  professionalName: '',
  websiteUrl: '',
  tagline: 'Desenvolvimento web & sistemas',
}

function requireUserUid(): string {
  const uid = auth.currentUser?.uid
  if (!uid) {
    throw new Error('Usuário não autenticado')
  }
  return uid
}

function proposalDefaultsRef(uid: string) {
  return doc(db, 'users', uid, 'settings', 'proposalDefaults')
}

function mergeWithDefaults(data: Record<string, unknown>): ProposalDefaults {
  return {
    logoDataUrl:
      typeof data.logoDataUrl === 'string' ? data.logoDataUrl : DEFAULT_PROPOSAL_DEFAULTS.logoDataUrl,
    markDataUrl:
      typeof data.markDataUrl === 'string' ? data.markDataUrl : DEFAULT_PROPOSAL_DEFAULTS.markDataUrl,
    companyName:
      typeof data.companyName === 'string' ? data.companyName : DEFAULT_PROPOSAL_DEFAULTS.companyName,
    companyAbout:
      typeof data.companyAbout === 'string'
        ? data.companyAbout
        : DEFAULT_PROPOSAL_DEFAULTS.companyAbout,
    professionalName:
      typeof data.professionalName === 'string'
        ? data.professionalName
        : DEFAULT_PROPOSAL_DEFAULTS.professionalName,
    websiteUrl:
      typeof data.websiteUrl === 'string' ? data.websiteUrl : DEFAULT_PROPOSAL_DEFAULTS.websiteUrl,
    tagline:
      typeof data.tagline === 'string' && data.tagline.trim()
        ? data.tagline
        : DEFAULT_PROPOSAL_DEFAULTS.tagline,
  }
}

export function subscribeProposalDefaults(
  callback: (defaults: ProposalDefaults) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const uid = requireUserUid()

  return onSnapshot(
    proposalDefaultsRef(uid),
    (snapshot) => {
      if (snapshot.exists()) {
        callback(mergeWithDefaults(snapshot.data()))
        return
      }

      callback(DEFAULT_PROPOSAL_DEFAULTS)
    },
    (error) => onError?.(error),
  )
}

export async function getProposalDefaults(): Promise<ProposalDefaults> {
  try {
    const uid = requireUserUid()
    const snapshot = await getDoc(proposalDefaultsRef(uid))

    if (!snapshot.exists()) {
      return DEFAULT_PROPOSAL_DEFAULTS
    }

    return mergeWithDefaults(snapshot.data())
  } catch (error) {
    console.error('[getProposalDefaults]', error)
    return DEFAULT_PROPOSAL_DEFAULTS
  }
}

export async function saveProposalDefaults(defaults: ProposalDefaults): Promise<void> {
  const uid = requireUserUid()

  await setDoc(proposalDefaultsRef(uid), defaults, { merge: true })
}

export { DEFAULT_PROPOSAL_DEFAULTS }

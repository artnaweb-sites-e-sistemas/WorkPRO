import { doc, getDoc, setDoc } from 'firebase/firestore'
import {
  DEFAULT_CALENDAR_SETTINGS,
  normalizeCalendarSettings,
  type ColdCallCalendarSettings,
} from '../lib/coldCallCalendar'
import { auth, db } from '../lib/firebase'

function requireUserUid(): string {
  const uid = auth.currentUser?.uid
  if (!uid) {
    throw new Error('Usuário não autenticado')
  }
  return uid
}

function calendarSettingsRef(uid: string) {
  return doc(db, 'users', uid, 'settings', 'coldCallCalendar')
}

export async function getColdCallCalendarSettings(): Promise<ColdCallCalendarSettings> {
  try {
    const uid = requireUserUid()
    const snapshot = await getDoc(calendarSettingsRef(uid))
    if (!snapshot.exists()) {
      return normalizeCalendarSettings(DEFAULT_CALENDAR_SETTINGS)
    }
    return normalizeCalendarSettings(snapshot.data() as Partial<ColdCallCalendarSettings>)
  } catch (error) {
    console.error('[getColdCallCalendarSettings]', error)
    return normalizeCalendarSettings(DEFAULT_CALENDAR_SETTINGS)
  }
}

export async function saveColdCallCalendarSettings(settings: ColdCallCalendarSettings): Promise<void> {
  const uid = requireUserUid()
  await setDoc(calendarSettingsRef(uid), normalizeCalendarSettings(settings), { merge: true })
}

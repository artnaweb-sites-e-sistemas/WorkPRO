import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore'
import type { Unsubscribe } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { DEFAULT_PRESENTER_PROFILE, type Service } from '../types/models'

export interface ServicesSnapshot {
  list: Service[]
  isNewDocument: boolean
}

function requireUserUid(): string {
  const uid = auth.currentUser?.uid
  if (!uid) {
    throw new Error('Usuário não autenticado')
  }
  return uid
}

function servicesRef(uid: string) {
  return doc(db, 'users', uid, 'settings', 'services')
}

function isValidService(value: unknown): value is Service {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Partial<Service>
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    typeof record.description === 'string'
  )
}

function parseServicesList(data: Record<string, unknown> | undefined): Service[] {
  if (!data || !Array.isArray(data.list)) {
    return []
  }

  return data.list.filter(isValidService)
}

function parseServicesSnapshot(
  data: Record<string, unknown> | undefined,
  exists: boolean,
): ServicesSnapshot {
  if (!exists) {
    return { list: [], isNewDocument: true }
  }

  return {
    list: parseServicesList(data),
    isNewDocument: false,
  }
}

export function createService(name = '', description = ''): Service {
  return {
    id: crypto.randomUUID(),
    name,
    description,
  }
}

export function buildDefaultServicesFromAreas(areas: string): Service[] {
  return areas
    .split(',')
    .map((area) => area.trim())
    .filter(Boolean)
    .map((name) => createService(name, ''))
}

export function addServiceToList(
  list: Service[],
  service: Omit<Service, 'id'> = { name: '', description: '' },
): Service[] {
  return [...list, createService(service.name, service.description)]
}

export function updateServiceInList(
  list: Service[],
  id: string,
  partial: Partial<Omit<Service, 'id'>>,
): Service[] {
  return list.map((service) =>
    service.id === id ? { ...service, ...partial } : service,
  )
}

export function removeServiceFromList(list: Service[], id: string): Service[] {
  return list.filter((service) => service.id !== id)
}

export async function getServices(): Promise<ServicesSnapshot> {
  const uid = requireUserUid()
  const snapshot = await getDoc(servicesRef(uid))
  return parseServicesSnapshot(snapshot.data(), snapshot.exists())
}

export function subscribeServices(
  callback: (snapshot: ServicesSnapshot) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const uid = requireUserUid()

  return onSnapshot(
    servicesRef(uid),
    (snapshot) => {
      callback(parseServicesSnapshot(snapshot.data(), snapshot.exists()))
    },
    (error) => onError?.(error),
  )
}

export async function saveServices(list: Service[]): Promise<void> {
  const uid = requireUserUid()
  await setDoc(servicesRef(uid), { list }, { merge: true })
}

async function loadServicesList(): Promise<Service[]> {
  const snapshot = await getServices()
  return snapshot.list
}

export async function addService(
  service: Omit<Service, 'id'> = { name: '', description: '' },
): Promise<Service[]> {
  const list = await loadServicesList()
  const next = addServiceToList(list, service)
  await saveServices(next)
  return next
}

/** Persiste um serviço já criado (com id conhecido), útil para selecioná-lo em seguida. */
export async function appendService(service: Service): Promise<Service[]> {
  const list = await loadServicesList()
  const next = [...list, service]
  await saveServices(next)
  return next
}

export async function updateService(
  id: string,
  partial: Partial<Omit<Service, 'id'>>,
): Promise<Service[]> {
  const list = await loadServicesList()
  const next = updateServiceInList(list, id, partial)
  await saveServices(next)
  return next
}

export async function removeService(id: string): Promise<Service[]> {
  const list = await loadServicesList()
  const next = removeServiceFromList(list, id)
  await saveServices(next)
  return next
}

export function getDefaultServicesSeed(): Service[] {
  return buildDefaultServicesFromAreas(DEFAULT_PRESENTER_PROFILE.areas)
}

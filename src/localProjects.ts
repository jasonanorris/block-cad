import { parseLibrary, serializeLibrary } from './libraryFile'
import type { CadObject } from './cadModel'
import { parseProject, serializeProject } from './projectFile'

export type SavedKind = 'part' | 'snapshot'
export type SavedProject = { id: string; kind: SavedKind; name: string; createdAt: number; objectCount: number }
let database: Promise<IDBDatabase> | undefined

function openDatabase(): Promise<IDBDatabase> {
  if (!database) {
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('block-cad-library', 1)
      let abandoned = false
      request.onupgradeneeded = () => {
        request.result.createObjectStore('items', { keyPath: 'id' }).createIndex('kind', 'kind')
        request.result.createObjectStore('projects')
      }
      request.onsuccess = () => {
        const db = request.result
        if (abandoned) { db.close(); return }
        db.onversionchange = () => { db.close(); database = undefined }
        resolve(db)
      }
      request.onerror = () => reject(request.error)
      request.onblocked = () => { abandoned = true; reject(new Error('Close other Block CAD tabs and try again.')) }
    }).catch((error) => { database = undefined; throw error })
  }
  return database
}

export function savedName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 80) throw new Error('Enter a name from 1 to 80 characters.')
  return trimmed
}

function validMetadata(value: unknown, kind: SavedKind): value is SavedProject {
  if (!value || typeof value !== 'object') return false
  const item = value as SavedProject
  return typeof item.id === 'string' && !!item.id && item.kind === kind &&
    typeof item.name === 'string' && !!item.name.trim() && item.name.length <= 80 &&
    Number.isFinite(item.createdAt) && Number.isInteger(item.objectCount) && item.objectCount >= 0
}

export async function listLocalProjects(kind: SavedKind): Promise<SavedProject[]> {
  const db = await openDatabase()
  const items = await new Promise<unknown[]>((resolve, reject) => {
    const tx = db.transaction('items', 'readonly')
    const request = tx.objectStore('items').index('kind').getAll(kind)
    tx.oncomplete = () => resolve(request.result)
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Could not read saved items.'))
  })
  if (!items.every((item) => validMetadata(item, kind))) throw new Error('The saved item list is damaged. Stored projects were left untouched.')
  return (items as SavedProject[]).sort((a, b) => b.createdAt - a.createdAt || a.name.localeCompare(b.name))
}

export async function saveLocalProject(kind: SavedKind, name: string, objects: CadObject[]): Promise<SavedProject> {
  const label = savedName(name)
  const project = serializeProject(objects)
  const validated = parseProject(project)
  if (kind === 'part' && !validated.length) throw new Error('A part must contain at least one shape.')
  const item: SavedProject = { id: crypto.randomUUID(), kind, name: label, createdAt: Date.now(), objectCount: validated.length }
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['items', 'projects'], 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Could not save locally. Browser storage may be full or unavailable.'))
    try {
      tx.objectStore('items').add(item)
      tx.objectStore('projects').add(project, item.id)
    } catch (error) {
      tx.abort()
      reject(error)
    }
  })
  return item
}

export async function readLocalProject(id: string, kind: SavedKind): Promise<CadObject[]> {
  const db = await openDatabase()
  const stored = await new Promise<{ item: unknown; project: unknown }>((resolve, reject) => {
    const tx = db.transaction(['items', 'projects'], 'readonly')
    const item = tx.objectStore('items').get(id), project = tx.objectStore('projects').get(id)
    tx.oncomplete = () => resolve({ item: item.result, project: project.result })
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Could not read the saved project.'))
  })
  if (!validMetadata(stored.item, kind) || typeof stored.project !== 'string') throw new Error('This saved item is missing or damaged. Refresh the list and try again.')
  const objects = parseProject(stored.project)
  if (objects.length !== stored.item.objectCount || kind === 'part' && !objects.length) {
    throw new Error('The saved item is damaged. The current project was left unchanged.')
  }
  return objects
}

export async function deleteLocalProject(id: string, kind: SavedKind): Promise<void> {
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['items', 'projects'], 'readwrite')
    const request = tx.objectStore('items').get(id)
    request.onsuccess = () => {
      if (!validMetadata(request.result, kind)) { tx.abort(); return }
      tx.objectStore('items').delete(id)
      tx.objectStore('projects').delete(id)
    }
    tx.oncomplete = () => resolve()
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Could not delete that saved item. Refresh the list and try again.'))
  })
}

// Read both stores in one transaction so a concurrent tab cannot produce a
// backup containing metadata from one revision and model data from another.
export async function exportLocalLibrary(): Promise<string> {
  const db = await openDatabase()
  const records = await new Promise<{ items: unknown[]; projects: Map<IDBValidKey, unknown> }>((resolve, reject) => {
    const tx = db.transaction(['items', 'projects'], 'readonly')
    const items = tx.objectStore('items').getAll(), projects = tx.objectStore('projects').getAll(), keys = tx.objectStore('projects').getAllKeys()
    tx.oncomplete = () => resolve({ items: items.result, projects: new Map(keys.result.map((key, i) => [key, projects.result[i]])) })
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Could not read the library for backup.'))
  })
  return serializeLibrary(records.items.map((raw) => {
    if (!validMetadata(raw, 'part') && !validMetadata(raw, 'snapshot')) throw new Error('The library contains damaged metadata. No backup was created.')
    const item = raw as SavedProject, project = records.projects.get(item.id)
    if (typeof project !== 'string') throw new Error('A saved project is missing. No backup was created.')
    const objects = parseProject(project)
    if (objects.length !== item.objectCount) throw new Error('A saved project is damaged. No backup was created.')
    return { kind: item.kind, name: item.name, createdAt: item.createdAt, objects }
  }))
}

export async function importLocalLibrary(text: string): Promise<SavedProject[]> {
  // Validate the entire file before opening a write transaction. Fresh storage
  // IDs make repeated imports additive and never overwrite existing records.
  const entries = parseLibrary(text)
  const records = entries.map((entry) => ({ item: { id: crypto.randomUUID(), kind: entry.kind,
    name: entry.name, createdAt: entry.createdAt, objectCount: entry.objects.length }, project: serializeProject(entry.objects) }))
  if (!records.length) return []
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['items', 'projects'], 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Could not import the library. No items were added.'))
    try {
      for (const record of records) {
        tx.objectStore('items').add(record.item)
        tx.objectStore('projects').add(record.project, record.item.id)
      }
    } catch (error) { tx.abort(); reject(error) }
  })
  return records.map((record) => record.item)
}

import type { CadObject } from './cadModel'
import { parseProject, serializeProject } from './projectFile'

type Draft = { project: string; savedAt: number }
let database: Promise<IDBDatabase> | undefined

function openDatabase(): Promise<IDBDatabase> {
  if (!database) {
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('block-cad-recovery', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('drafts')
      request.onsuccess = () => {
        const db = request.result
        db.onversionchange = () => { db.close(); database = undefined }
        resolve(db)
      }
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('Close other Block CAD tabs to enable recovery.'))
    }).catch((error) => { database = undefined; throw error })
  }
  return database
}

export async function readAutosave(): Promise<{ objects: CadObject[]; savedAt: number } | null> {
  const db = await openDatabase()
  const draft = await new Promise<Draft | undefined>((resolve, reject) => {
    const transaction = db.transaction('drafts', 'readonly')
    const request = transaction.objectStore('drafts').get('current')
    transaction.oncomplete = () => resolve(request.result)
    transaction.onabort = () => reject(transaction.error)
    transaction.onerror = () => reject(transaction.error)
  })
  if (!draft) return null
  if (typeof draft.project !== 'string' || !Number.isFinite(draft.savedAt)) throw new Error('The saved draft is damaged.')
  return { objects: parseProject(draft.project), savedAt: draft.savedAt }
}

export async function writeAutosave(objects: CadObject[]): Promise<number> {
  // A name can temporarily be blank while its input is focused.
  const project = serializeProject(objects.map((object) => ({ ...object, name: object.name?.trim() || undefined })))
  const db = await openDatabase()
  const savedAt = Date.now()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('drafts', 'readwrite')
    transaction.objectStore('drafts').put({ project, savedAt } satisfies Draft, 'current')
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error)
    transaction.onerror = () => reject(transaction.error)
  })
  return savedAt
}

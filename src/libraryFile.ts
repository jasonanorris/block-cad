import { parseProject, serializeProject } from './projectFile'
import type { CadObject } from './cadModel'
import type { SavedKind } from './localProjects'

export const MAX_LIBRARY_BYTES = 50_000_000
export const MAX_LIBRARY_ITEMS = 250
export type LibraryEntry = { kind: SavedKind; name: string; createdAt: number; objects: CadObject[] }

export function parseLibrary(text: string): LibraryEntry[] {
  if (new TextEncoder().encode(text).length > MAX_LIBRARY_BYTES) throw new Error('Library backups must be under 50 MB.')
  let value: unknown
  try { value = JSON.parse(text) } catch { throw new Error('This library backup is not valid JSON.') }
  if (!value || typeof value !== 'object') throw new Error('This is not a Block CAD library backup.')
  const data = value as Record<string, unknown>
  if (data.format !== 'block-cad-library' || data.version !== 1 || !Array.isArray(data.items)) throw new Error('Unsupported Block CAD library backup format.')
  if (data.items.length > MAX_LIBRARY_ITEMS) throw new Error('A backup can contain at most 250 saved items.')
  let objectCount = 0
  return data.items.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`Library item ${index + 1} is invalid.`)
    const item = raw as Record<string, unknown>
    if (item.kind !== 'part' && item.kind !== 'snapshot') throw new Error(`Library item ${index + 1} has an invalid kind.`)
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.trim().length > 80) throw new Error(`Library item ${index + 1} has an invalid name.`)
    if (typeof item.createdAt !== 'number' || !Number.isSafeInteger(item.createdAt) || item.createdAt < 0 || item.createdAt > 8.64e15) throw new Error(`Library item ${index + 1} has an invalid date.`)
    const objects = parseProject(JSON.stringify(item.project))
    if (item.kind === 'part' && !objects.length) throw new Error('A saved part cannot be empty.')
    objectCount += objects.length
    if (objectCount > 10_000) throw new Error('A backup can contain at most 10,000 source shapes.')
    return { kind: item.kind, name: item.name.trim(), createdAt: item.createdAt, objects }
  })
}

export function serializeLibrary(entries: LibraryEntry[]): string {
  const text = JSON.stringify({ format: 'block-cad-library', version: 1,
    items: entries.map(({ kind, name, createdAt, objects }) => ({ kind, name, createdAt, project: JSON.parse(serializeProject(objects)) })) }, null, 2) + '\n'
  parseLibrary(text)
  return text
}

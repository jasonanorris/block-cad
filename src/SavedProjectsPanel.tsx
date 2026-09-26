import { useEffect, useState } from 'react'
import { deleteLocalProject, listLocalProjects, savedName, type SavedKind, type SavedProject } from './localProjects'

export default function SavedProjectsPanel({ kind, canSave, onSave, onUse }: {
  kind: SavedKind
  canSave: boolean
  onSave: (name: string) => Promise<void>
  onUse: (id: string) => Promise<void>
}) {
  const [items, setItems] = useState<SavedProject[]>([])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const title = kind === 'part' ? 'Parts library' : 'Project snapshots'
  useEffect(() => {
    let cancelled = false
    listLocalProjects(kind).then((saved) => { if (!cancelled) setItems(saved) })
      .catch((error) => { if (!cancelled) setError(error instanceof Error ? error.message : 'Local storage is unavailable.') })
    return () => { cancelled = true }
  }, [kind])
  async function run(action: () => Promise<void>, message: string) {
    if (busy) return
    setBusy(true); setError(null); setStatus('')
    try {
      await action()
      setStatus(message)
      setItems(await listLocalProjects(kind))
    } catch (error) { setError(error instanceof Error ? error.message : 'Local storage is unavailable.') }
    finally { setBusy(false) }
  }
  return <details className={`saved-projects ${kind}-library`}>
    <summary>{title}</summary>
    <label>Name<input aria-label={`${kind === 'part' ? 'Part' : 'Snapshot'} name`} maxLength={80} value={name} disabled={busy} onChange={(event) => setName(event.target.value)} /></label>
    <div className="saved-actions">
      <button type="button" disabled={!canSave || busy} onClick={() => void run(async () => {
        await onSave(savedName(name)); setName('')
      }, kind === 'part' ? 'Part saved locally.' : 'Snapshot saved locally.')}>
        {kind === 'part' ? 'Save selection as part' : 'Save snapshot'}</button>
      <button type="button" disabled={busy} onClick={() => void run(async () => {}, 'List refreshed.')}>Refresh list</button>
    </div>
    <p className="selection-hint">{kind === 'part' ? 'Saved parts include joined members and all linked holes. Insert places independent copies at the current workplane origin; move them afterward if they overlap.' : 'A snapshot saves the entire project. Restore replaces the current model as one undoable edit.'}</p>
    <p className="selection-hint">Stored only in this browser and site address. Use project Save for a portable backup. Each save creates a new entry.</p>
    {busy && <p role="status">Working…</p>}
    {error && <p className="position-error" role="alert">{error}</p>}
    {status && <p role="status">{status}</p>}
    {!items.length && !error && <p className="selection-hint">No saved {kind === 'part' ? 'parts' : 'snapshots'} yet.</p>}
    <ul>{items.map((item) => <li key={item.id} data-saved-id={item.id}>
      <strong>{item.name}</strong><span>{item.objectCount} source shapes · {new Date(item.createdAt).toLocaleString()}</span>
      <div className="saved-actions">
        <button type="button" disabled={busy} onClick={() => void run(() => onUse(item.id), kind === 'part' ? 'Part inserted. Undo removes it.' : 'Snapshot restored. Undo returns to your previous model.')}>{kind === 'part' ? 'Insert part' : 'Restore snapshot'}</button>
        <button type="button" disabled={busy} onClick={() => setConfirmDelete(item.id)}>Delete saved item</button>
      </div>
      {confirmDelete === item.id && <div className="saved-delete">
        <p>Delete “{item.name}” from this browser? This cannot be undone.</p>
        <button type="button" disabled={busy} onClick={() => void run(async () => { await deleteLocalProject(item.id, kind); setConfirmDelete(null) }, 'Saved item deleted.')}>Confirm delete</button>
        <button type="button" disabled={busy} onClick={() => setConfirmDelete(null)}>Cancel</button>
      </div>}
    </li>)}</ul>
  </details>
}

import { useRef, useState } from 'react'
import { exportLocalLibrary, importLocalLibrary } from './localProjects'
import { MAX_LIBRARY_BYTES } from './libraryFile'

export default function LibraryTransfer({ onImported }: { onImported: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('')
  async function run(action: () => Promise<string>) {
    if (busy) return
    setBusy(true); setError(''); setStatus('')
    try { setStatus(await action()) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not transfer the library.') }
    finally { setBusy(false) }
  }
  return <details className="saved-projects library-transfer"><summary>Library backup / transfer</summary>
    <p className="selection-hint">Download all saved parts and snapshots to move them to another browser. Import adds independent saved items; existing items and the open model stay unchanged. Reimporting creates duplicates.</p>
    <div className="saved-actions">
      <button type="button" disabled={busy} onClick={() => void run(async () => {
        const text = await exportLocalLibrary()
        const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
        const link = document.createElement('a'); link.href = url; link.download = 'block-cad-library.json'
        document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
        return 'Library backup downloaded.'
      })}>Export library backup</button>
      <button type="button" disabled={busy} onClick={() => input.current?.click()}>Import library backup</button>
    </div>
    <input ref={input} type="file" accept=".json,application/json" hidden aria-label="Choose a library backup" onChange={(event) => {
      const file = event.target.files?.[0]; event.target.value = ''
      if (!file) return
      void run(async () => {
        if (file.size > MAX_LIBRARY_BYTES) throw new Error('Library backups must be under 50 MB.')
        const imported = await importLocalLibrary(await file.text())
        onImported(); return `Imported ${imported.length} saved item${imported.length === 1 ? '' : 's'}.`
      })
    }} />
    {busy && <p role="status">Transferring library…</p>}
    {status && <p role="status">{status}</p>}
    {error && <p role="alert" className="position-error">{error}</p>}
    <p className="selection-hint">Maximum 50 MB, 250 saved items, and 10,000 source shapes per backup. Import is all-or-nothing and separate from model Undo.</p>
  </details>
}

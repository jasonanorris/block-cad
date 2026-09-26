import { useState } from 'react'
import type { CadObject } from './cadModel'
import { parseProject } from './projectFile'

export default function ExampleProjects({ onLoad }: { onLoad: (objects: CadObject[]) => void }) {
  const [example, setExample] = useState('nameplate')
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  return <details className="repeat-tools example-projects">
    <summary>Example projects</summary>
    <label>Example<select aria-label="Example project" value={example} disabled={busy} onChange={(event) => setExample(event.target.value)}>
      <option value="nameplate">Text nameplate</option><option value="section-demo">Section demo</option><option value="flange">Eight-hole flange</option>
    </select></label>
    <button type="button" className="cut-example-button" disabled={busy} onClick={async () => {
      setBusy(true); setError(null)
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}samples/${example}.json`)
        if (!response.ok) throw new Error('The example could not be loaded. Try again.')
        onLoad(parseProject(await response.text()))
      } catch (error) { setError(error instanceof Error ? error.message : 'Could not load the example.') }
      finally { setBusy(false) }
    }}>{busy ? 'Loading example…' : 'Load example'}</button>
    <p className="selection-hint">Replaces the model as one undoable edit. For the section demo, enable Section view on Y at 15 mm to inspect the enclosed cavity.</p>
    {error && <p className="position-error" role="alert">{error}</p>}
  </details>
}

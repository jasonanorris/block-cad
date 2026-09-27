import { useState } from 'react'
import { CURVE_QUALITIES } from './curveQuality'
import { EDGE_PRESETS_KEY, parseEdgePresets, saveEdgePreset, type EdgePreset } from './edgePresets'
import type { EdgeFeatureController } from './useEdgeFeature'
export default function EdgePresets({ tools }: { tools: EdgeFeatureController }) {
  const [initial] = useState(() => {
    try { return { presets: parseEdgePresets(localStorage.getItem(EDGE_PRESETS_KEY)), error: '' } }
    catch { return { presets: [] as EdgePreset[], error: 'Saved presets could not be loaded. Saving a new preset replaces this browser’s preset list.' } }
  })
  const [presets, setPresets] = useState(initial.presets), [error, setError] = useState(initial.error)
  const [name, setName] = useState(''), [selected, setSelected] = useState('')
  const preset = presets.find(p => p.name === selected)
  function persist(next: EdgePreset[]) {
    localStorage.setItem(EDGE_PRESETS_KEY, JSON.stringify(next)); setPresets(next); setError('')
  }
  return <details><summary>Size and quality presets</summary>
    <p className="selection-hint">Stored in this browser. Presets set operation, common size, and quality, and clear individual size overrides. Preview before applying.</p>
    <label>Saved preset<select aria-label="Saved edge preset" disabled={tools.busy} value={selected} onChange={e => setSelected(e.target.value)}>
      <option value="">Choose a preset</option>
      {presets.map(p => <option key={p.name} value={p.name}>{p.name} · {p.operation} {p.size} mm · {CURVE_QUALITIES[p.quality].label}</option>)}
    </select></label>
    <button type="button" disabled={!preset || tools.busy} onClick={() => preset && tools.applyPreset(preset)}>Use preset</button>
    <button type="button" disabled={!preset || tools.busy} onClick={() => {
      try { persist(presets.filter(p => p.name !== selected)); setSelected('') } catch { setError('Could not save presets in this browser.') }
    }}>Delete preset</button>
    <label>Preset name<input aria-label="Edge preset name" maxLength={60} value={name} disabled={tools.busy} onChange={e => setName(e.target.value)} /></label>
    <button type="button" disabled={tools.busy || !name.trim()} onClick={() => {
      try {
        const next = saveEdgePreset(presets, { name, operation: tools.operation, size: Number(tools.size), quality: tools.quality })
        persist(next); setSelected(name.trim())
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save preset.') }
    }}>Save / replace preset</button>
    <p className="selection-hint">Saving an existing name replaces it. Up to 20 presets; presets are separate from project files.</p>
    {error && <p role="alert">{error}</p>}
  </details>
}

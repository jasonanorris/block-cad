import type { SectionView } from './sectionView'

export default function SectionTools({ section, onChange, activePosition }: {
  section: SectionView; onChange: (section: SectionView) => void; activePosition?: { x: number; y: number; z: number }
}) {
  return <details className="repeat-tools section-tools">
    <summary>Section view{section.enabled ? ' · On' : ''}</summary>
    <label>Enable section<input aria-label="Enable section view" type="checkbox" checked={section.enabled} onChange={(event) => onChange({ ...section, enabled: event.target.checked })} /></label>
    <label>Axis<select aria-label="Section axis" value={section.axis} onChange={(event) => onChange({ ...section, axis: event.target.value as SectionView['axis'] })}>
      {(['x', 'y', 'z'] as const).map((axis) => <option key={axis} value={axis}>{axis.toUpperCase()}</option>)}
    </select></label>
    <label>Position (mm)<input aria-label="Section position" type="number" step="1" value={section.position} onChange={(event) => {
      if (event.target.value.trim() && Number.isFinite(event.target.valueAsNumber)) onChange({ ...section, position: event.target.valueAsNumber })
    }} /></label>
    <label>Flip side<input aria-label="Flip section side" type="checkbox" checked={section.flipped} onChange={(event) => onChange({ ...section, flipped: event.target.checked })} /></label>
    <button type="button" className="cut-example-button" disabled={!activePosition} onClick={() => activePosition && onChange({ ...section, position: activePosition[section.axis] })}>Section through active center</button>
    <p className="selection-hint">Keeps the {section.flipped ? 'lower' : 'higher'} coordinate side. This is an open cutaway without a filled cut face. View only: models, measurements, and exports stay whole.</p>
  </details>
}

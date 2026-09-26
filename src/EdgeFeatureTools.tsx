import type { EdgeFeatureController } from './useEdgeFeature'
import type { EdgeOperation } from './edgeFeatures'

export default function EdgeFeatureTools({ tools, disabled }: { tools: EdgeFeatureController; disabled: boolean }) {
  const picking = tools.edges.length > 0
  return <details className="repeat-tools edge-feature-tools"><summary>Fillet / chamfer edges</summary>
    <p className="selection-hint">Select one solid, then click highlighted edges to toggle them on or off. Each feature applies one size to separate straight 90° outside edges. Meeting corners and overlapping cuts are not supported.</p>
    <button type="button" disabled={disabled || tools.busy} onClick={() => void tools.start()}>{picking ? 'Pick edges again' : 'Select edges'}</button>
    {tools.features.length > 0 && <ol className="edge-feature-list" aria-label="Edge feature history">
      {tools.features.map((feature, index) => <li key={feature.id}>
        <span>{index + 1}. {feature.operation === 'fillet' ? 'Fillet' : 'Chamfer'} · {feature.size} mm · {feature.edges.length} edge{feature.edges.length === 1 ? '' : 's'}</span>
        <div><button type="button" aria-label={`Edit edge feature ${index + 1}`} disabled={disabled || tools.busy} onClick={() => tools.edit(feature)}>Edit</button>
          <button type="button" aria-label={`Remove edge feature ${index + 1}`} disabled={disabled || tools.busy} onClick={() => tools.edit(feature, true)}>Remove</button></div>
      </li>)}
    </ol>}
    {(picking || tools.editing) && <>
      {picking ? <>
        <p role="status">{tools.selected.length ? `${tools.selected.length} edges selected. Maximum size ${Number(Math.min(...tools.selected.map((index) => tools.edges[index].maxSize)).toFixed(4))} mm.` : `${tools.edges.length} eligible edges. Hover to highlight, then click to select.`}</p>
        <button type="button" onClick={tools.clearSelection} disabled={!tools.selected.length || tools.busy}>Clear edges</button>
      </> : <p role="status">{tools.removing ? 'Remove' : 'Edit'} feature {tools.features.findIndex((feature) => feature.id === tools.editing) + 1}. Preview to rebuild the remaining feature history.</p>}
      {!tools.removing && <>
        <label>Operation<select aria-label="Edge operation" value={tools.operation} onChange={(e) => tools.setOperation(e.target.value as EdgeOperation)}>
          <option value="fillet">Fillet</option><option value="chamfer">Chamfer</option>
        </select></label>
        <label>{tools.operation === 'fillet' ? 'Radius' : 'Distance along each face'} (mm)
          <input aria-label="Edge feature size" type="number" step="any" min="0.01" value={tools.size} onChange={(e) => tools.setSize(e.target.value)} /></label>
      </>}
      <button type="button" disabled={(!tools.editing && !tools.selected.length) || tools.busy} onClick={() => void tools.calculate()}>{tools.removing ? 'Preview removal' : 'Preview edges'}</button>
      <button type="button" disabled={!tools.preview || tools.busy} onClick={tools.apply}>{tools.removing ? 'Apply removal' : 'Apply edges'}</button>
      {tools.preview && <p role="status">Preview only. Apply to keep it, or Cancel to restore the original.</p>}
    </>}
    {tools.active && <button type="button" onClick={tools.cancel}>Cancel edge</button>}
    {tools.busy && <p role="status">Calculating edge geometry…</p>}
    {tools.error && <p role="alert" className="position-error">{tools.error}</p>}
    <p className="selection-hint">Features remain editable after Save/Load. Sizes are measured before subsequent object scaling. Removing all features restores the starting mesh. The initial application bakes joined sources and cuts into that starting mesh; Undo restores their original parameters. Escape cancels.</p>
  </details>
}

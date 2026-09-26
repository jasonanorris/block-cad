import type { EdgeFeatureController } from './useEdgeFeature'
import type { EdgeOperation } from './edgeFeatures'

export default function EdgeFeatureTools({ tools, disabled }: { tools: EdgeFeatureController; disabled: boolean }) {
  const active = tools.edges.length > 0
  return <details className="repeat-tools edge-feature-tools"><summary>Fillet / chamfer edge</summary>
    <p className="selection-hint">Select one solid, then pick a highlighted edge in the canvas. Supports straight 90° outside edges on simple convex bodies with flat, square ends.</p>
    <button type="button" disabled={disabled || tools.busy} onClick={() => void tools.start()}>{active ? 'Pick edges again' : 'Select edge'}</button>
    {active && <>
      <p role="status">{tools.selected === null ? `${tools.edges.length} eligible edges. Hover to highlight, then click one.` : `Edge ${tools.selected + 1} selected. Maximum size ${Number(tools.edges[tools.selected].maxSize.toFixed(4))} mm.`}</p>
      <label>Operation<select aria-label="Edge operation" value={tools.operation} onChange={(e) => tools.setOperation(e.target.value as EdgeOperation)}>
        <option value="fillet">Fillet</option><option value="chamfer">Chamfer</option>
      </select></label>
      <label>{tools.operation === 'fillet' ? 'Radius' : 'Distance along each face'} (mm)
        <input aria-label="Edge feature size" type="number" step="any" min="0.01" value={tools.size} onChange={(e) => tools.setSize(e.target.value)} /></label>
      <button type="button" disabled={tools.selected === null || tools.busy} onClick={() => void tools.calculate()}>Preview edge</button>
      <button type="button" disabled={!tools.preview || tools.busy} onClick={tools.apply}>Apply edge</button>
      {tools.preview && <p role="status">Preview only. Apply to keep it, or Cancel to restore the original.</p>}
    </>}
    {(active || tools.busy) && <button type="button" onClick={tools.cancel}>Cancel edge</button>}
    {tools.busy && <p role="status">Calculating edge geometry…</p>}
    {tools.error && <p role="alert" className="position-error">{tools.error}</p>}
    <p className="selection-hint">Apply replaces the finished body and linked shapes with a mesh solid. Undo restores the editable sources. Curved edges, inside corners, and intersecting corner blends are not supported. Escape cancels.</p>
  </details>
}

import type { EdgeFeatureController } from './useEdgeFeature'
import type { EdgeOperation } from './edgeFeatures'

export default function EdgeFeatureTools({ tools, disabled }: { tools: EdgeFeatureController; disabled: boolean }) {
  const picking = tools.edges.length > 0
  return <details className="repeat-tools edge-feature-tools"><summary>Fillet / chamfer edges</summary>
    <label>Edge tools<select aria-label="Edge tool engine" value={tools.advanced ? 'advanced' : 'mesh'} disabled={tools.busy || tools.analyticBody} onChange={e => tools.setAdvanced(e.target.value === 'advanced')}>
      <option value="mesh">Mesh tools</option><option value="advanced">Advanced CAD</option>
    </select></label>
    {tools.advanced ? <p className="selection-hint">Advanced CAD supports prism corners, curved terminations, inside edges, and individual radii on native boxes, wedges, prisms, cylinders, and their joins/cuts. Select edges, preview, then apply. Outside edges are blue, inside edges purple, and transitions gray. Selected edges turn green. The first use loads the CAD engine. Invalid radii leave the model unchanged.</p> : <p className="selection-hint">Select one solid, then click highlighted edges to toggle them on or off. Each feature applies one size to straight outside edges with 15°–165° interior angles and square ends. Chamfers may meet at corners. Select two or three perpendicular edges together to blend a fillet corner. Two-edge corners use a variable-radius transition and keep the third edge sharp; use Select all edges for a fully rounded box. After Apply, select edges again to work on remaining straight edges.</p>}
    <button type="button" disabled={disabled || tools.busy} onClick={() => void tools.start()}>{picking ? 'Pick edges again' : 'Select edges'}</button>
    {tools.features.length > 0 && <ol className="edge-feature-list" aria-label="Edge feature history">
      {tools.features.map((feature, index) => <li key={feature.id}>
        <span>{index + 1}. {feature.operation === 'fillet' ? 'Fillet' : 'Chamfer'} · {feature.size} mm · {feature.edges.length} edge{feature.edges.length === 1 ? '' : 's'}{feature.edges.some(edge => edge.size !== undefined) ? ' · individual sizes' : ''}</span>
        <div><button type="button" aria-label={`Edit edge feature ${index + 1}`} disabled={disabled || tools.busy} onClick={() => tools.edit(feature)}>Edit</button>
          <button type="button" aria-label={`Remove edge feature ${index + 1}`} disabled={disabled || tools.busy} onClick={() => tools.edit(feature, true)}>Remove</button></div>
      </li>)}
    </ol>}
    {(picking || tools.editing) && <>
      {picking ? <>
        <p role="status">{tools.selected.length ? tools.advanced ? `${tools.selected.length} edges selected. Preview checks radius compatibility.` : `${tools.selected.length} edges selected (${[...new Set(tools.selected.map((index) => `${Number(tools.edges[index].angle.toFixed(1))}°`))].join(', ')}). Maximum ${tools.operation === 'fillet' ? 'radius' : 'distance'} ${Number(Math.min(...tools.selected.map((index) => tools.operation === 'fillet' ? tools.edges[index].maxRadius : tools.edges[index].maxSize)).toFixed(4))} mm.` : `${tools.edges.length} eligible edges. Hover to highlight, then click to select.`}</p>
        <button type="button" onClick={tools.selectAll} disabled={tools.busy}>Select all edges</button>
        <button type="button" onClick={tools.clearSelection} disabled={!tools.selected.length || tools.busy}>Clear edges</button>
      </> : <p role="status">{tools.removing ? 'Remove' : 'Edit'} feature {tools.features.findIndex((feature) => feature.id === tools.editing) + 1}. Preview to rebuild the remaining feature history.</p>}
      {!tools.removing && <>
        <label>Operation<select aria-label="Edge operation" disabled={tools.busy} value={tools.operation} onChange={(e) => tools.setOperation(e.target.value as EdgeOperation)}>
          <option value="fillet">Fillet</option><option value="chamfer">Chamfer</option>
        </select></label>
        <label>{tools.operation === 'fillet' ? 'Radius' : 'Distance along each face'} (mm)
          <input aria-label="Edge feature size" type="number" step="any" min="0.01" value={tools.size} onChange={(e) => tools.setSize(e.target.value)} /></label>
        {tools.advanced && <details><summary>Selected edges and individual sizes</summary>
          <p className="selection-hint">Hover or focus a row to highlight its edge orange. Failed edges reported by the kernel are red. Inside/outside labels are geometric hints; transitions may be smooth or ambiguous. Leave sizes blank to use the common size.</p>
          {(picking ? tools.selected : tools.features.find(f => f.id === tools.editing)?.edges.map((_, i) => i) ?? []).map((index, ordinal) => {
            const edge = tools.displayEdges[index], failed = !!edge?.key && tools.failedKeys.includes(edge.key)
            return <label key={index} className={failed ? 'position-error' : ''} onMouseEnter={() => tools.setFocusedEdge(index)} onMouseLeave={() => tools.setFocusedEdge(null)} onFocus={() => tools.setFocusedEdge(index)} onBlur={() => tools.setFocusedEdge(null)}>
              Selected edge {ordinal + 1}{edge ? ` · ${edge.edgeType ?? 'outside'} · ${edge.curveType ?? 'straight'}` : ''}{failed ? ' · failed' : ''}
              <input type="number" min="0.01" max="10000" step="any" aria-label={`Size for edge ${ordinal + 1}`} disabled={tools.busy} aria-invalid={failed || undefined} placeholder="Common size" value={tools.edgeSizes[index] ?? ''} onChange={e => tools.setEdgeSize(index, e.target.value)} />
            </label>
          })}
        </details>}
      </>}
      <button type="button" disabled={(!tools.editing && !tools.selected.length) || tools.busy} onClick={() => void tools.calculate()}>{tools.removing ? 'Preview removal' : 'Preview edges'}</button>
      <button type="button" disabled={!tools.preview || tools.busy} onClick={tools.apply}>{tools.removing ? 'Apply removal' : 'Apply edges'}</button>
      {tools.preview && <p role="status">Preview only. Apply to keep it, or Cancel to restore the original.</p>}
    </>}
    {tools.active && <button type="button" onClick={tools.cancel}>Cancel edge</button>}
    {tools.busy && <p role="status">Calculating edge geometry…</p>}
    {tools.error && <p role="alert" className="position-error">{tools.error}</p>}
    <p className="selection-hint">Features remain editable after Save/Load. Angles and sizes are measured before subsequent object scaling. Removing all features restores the starting mesh. The initial application bakes joined sources and cuts into that starting mesh; Undo restores their original parameters. Escape cancels.</p>
  </details>
}

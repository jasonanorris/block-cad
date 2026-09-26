import { useState } from 'react'
import type { SurfacePick } from './surfaceTools'

export default function FaceAlignmentTools({ disabled, source, target, picking, onStart, onCancel, onApply, error }: {
  disabled: boolean; source: SurfacePick | null; target: SurfacePick | null; picking: boolean; error: string | null
  onStart: () => void; onCancel: () => void; onApply: (offset: number) => void
}) {
  const [offset, setOffset] = useState('0')
  return <details className="repeat-tools face-alignment-tools"><summary>Align faces</summary>
    <button type="button" disabled={disabled} onClick={onStart}>Pick alignment faces</button>
    {(picking || source || target) && <button type="button" onClick={onCancel}>Clear face alignment</button>}
    <p role="status">{!source ? 'Select one body, then pick its moving face.' : !target ? 'Source picked. Pick a face on another body.' : 'Both faces picked. Set an offset and apply.'}</p>
    <label>Face offset (mm)<input aria-label="Face alignment offset" type="number" step="any" value={offset} onChange={(event) => setOffset(event.target.value)} /></label>
    <button type="button" disabled={disabled || !source || !target || !offset.trim() || !Number.isFinite(Number(offset))} onClick={() => onApply(Number(offset))}>Apply face alignment</button>
    <p className="selection-hint">The picked points line up and outward normals face each other. Positive offset leaves a gap along the target normal. Moves and rotates the whole assembly with every linked cutter in one Undo step. Mesh facets define the planes; other collisions are not checked.</p>
    {error && <p role="alert" className="position-error">{error}</p>}
  </details>
}

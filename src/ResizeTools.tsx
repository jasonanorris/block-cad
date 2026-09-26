import { useState } from 'react'
import type { Vector3 } from './cadModel'

export default function ResizeTools({ disabled, onResize }: {
  disabled: boolean
  onResize: (axis: keyof Vector3, size: number) => void
}) {
  const [axis, setAxis] = useState<keyof Vector3>('x')
  const [size, setSize] = useState('50')
  return <details className="repeat-tools resize-tools">
    <summary>Resize selection</summary>
    <label>Finished dimension <select aria-label="Resize dimension" value={axis} onChange={(event) => setAxis(event.target.value as keyof Vector3)}>
      <option value="x">Width (X)</option><option value="y">Height (Y)</option><option value="z">Depth (Z)</option>
    </select></label>
    <label>Target size (mm) <input aria-label="Resize target size" type="number" min="0.001" step="any" value={size} onChange={(event) => setSize(event.target.value)} /></label>
    <button type="button" className="cut-example-button" disabled={disabled}
      onClick={() => onResize(axis, size.trim() ? Number(size) : NaN)}>Resize proportionally</button>
    <p className="selection-hint">Sets the selection's total finished size on one world axis. All axes scale together around the shared center, including spacing and linked holes. Use Drop to workplane afterward if needed. One Undo restores the size.</p>
  </details>
}

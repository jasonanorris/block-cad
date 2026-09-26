import { useState } from 'react'
import type { Vector3 } from './cadModel'

export default function RepeatTools({ disabled, onRepeat }: {
  disabled: boolean
  onRepeat: (axis: keyof Vector3, count: number, spacing: number) => void
}) {
  const [axis, setAxis] = useState<keyof Vector3>('x')
  const [count, setCount] = useState('3')
  const [spacing, setSpacing] = useState('25')
  const [error, setError] = useState<string | null>(null)
  return (
    <details className="repeat-tools">
      <summary>Repeat / array</summary>
      <label>Axis <select value={axis} onChange={(event) => setAxis(event.target.value as keyof Vector3)}>
        {(['x', 'y', 'z'] as const).map((value) => <option key={value} value={value}>{value.toUpperCase()}</option>)}
      </select></label>
      <label>Count (including original) <input type="number" min="2" max="100" step="1" value={count} onChange={(event) => setCount(event.target.value)} /></label>
      <label>Spacing (mm) <input type="number" step="any" value={spacing} onChange={(event) => setSpacing(event.target.value)} /></label>
      <button type="button" className="cut-example-button" disabled={disabled} onClick={() => {
        try { onRepeat(axis, Number(count), Number(spacing)); setError(null) }
        catch (error) { setError(error instanceof Error ? error.message : 'Could not repeat the selection.') }
      }}>Create array</button>
      <p className="selection-hint">Copies the selection and its linked holes at equal offsets. Negative spacing reverses direction. One Undo removes the array.</p>
      {error && <p className="position-error" role="alert">{error}</p>}
    </details>
  )
}

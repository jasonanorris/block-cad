import { useState } from 'react'
import type { Vector3 } from './cadModel'

export default function RadialArrayTools({ disabled, onRepeat }: {
  disabled: boolean
  onRepeat: (axis: keyof Vector3, count: number, angle: number, center: Vector3) => void
}) {
  const [axis, setAxis] = useState<keyof Vector3>('y')
  const [count, setCount] = useState('8')
  const [angle, setAngle] = useState('45')
  const [center, setCenter] = useState({ x: '0', y: '0', z: '0' })
  const [error, setError] = useState<string | null>(null)
  return <details className="repeat-tools radial-array-tools">
    <summary>Radial array</summary>
    <label>Rotation axis <select value={axis} onChange={(event) => setAxis(event.target.value as keyof Vector3)}>
      {(['x', 'y', 'z'] as const).map((value) => <option key={value} value={value}>{value.toUpperCase()}</option>)}
    </select></label>
    <label>Count (including original) <input aria-label="Radial count" type="number" min="2" max="100" step="1" value={count} onChange={(event) => setCount(event.target.value)} /></label>
    <label>Angle per copy (°) <input aria-label="Radial angle" type="number" step="any" value={angle} onChange={(event) => setAngle(event.target.value)} /></label>
    {(['x', 'y', 'z'] as const).map((coordinate) => <label key={coordinate}>Pivot {coordinate.toUpperCase()} (mm)
      <input aria-label={`Radial pivot ${coordinate.toUpperCase()}`} type="number" step="any" value={center[coordinate]}
        onChange={(event) => setCenter((current) => ({ ...current, [coordinate]: event.target.value }))} />
    </label>)}
    <button type="button" className="cut-example-button" disabled={disabled} onClick={() => {
      try {
        if ([count, angle, ...Object.values(center)].some((value) => !value.trim())) throw new Error('Fill in the count, angle, and all pivot coordinates.')
        onRepeat(axis, Number(count), Number(angle), { x: Number(center.x), y: Number(center.y), z: Number(center.z) })
        setError(null)
      } catch (error) { setError(error instanceof Error ? error.message : 'Could not create the radial array.') }
    }}>Create radial array</button>
    <p className="selection-hint">Copies and rotates the selection with its linked holes around the pivot. For a full circle, use 360 ÷ count degrees. Negative angles reverse direction. Place shapes away from the axis to spread copies out. One Undo removes the array.</p>
    {error && <p className="position-error" role="alert">{error}</p>}
  </details>
}

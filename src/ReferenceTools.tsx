import { useEffect, useState } from 'react'
import type { CadObject, Vector3 } from './cadModel'
import type { AlignmentEdge } from './placement'
import { selectionReference } from './referenceOrigin'

const axes = ['x', 'y', 'z'] as const
export default function ReferenceTools({ objects, selectedIds, origin, onOrigin, disabled, onPosition }: {
  objects: CadObject[]; selectedIds: string[]; origin: Vector3; onOrigin: (point: Vector3) => void; disabled: boolean
  onPosition: (edge: AlignmentEdge, offset: Vector3) => void
}) {
  const [originDraft, setOriginDraft] = useState({ x: String(origin.x), y: String(origin.y), z: String(origin.z) })
  useEffect(() => { setOriginDraft({ x: String(origin.x), y: String(origin.y), z: String(origin.z) }) }, [origin])
  const [edge, setEdge] = useState<AlignmentEdge>('min')
  const [point, setPoint] = useState<Vector3 | null>(null)
  const [offset, setOffset] = useState({ x: '0', y: '0', z: '0' })
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    setPoint(null); setError('')
    if (selectedIds.length) void selectionReference(objects, new Set(selectedIds), edge).then((value) => {
      if (!live) return
      setPoint(value)
      setOffset({ x: String(Number((value.x - origin.x).toFixed(3))), y: String(Number((value.y - origin.y).toFixed(3))), z: String(Number((value.z - origin.z).toFixed(3))) })
    }).catch((reason: Error) => { if (live) setError(reason.message) })
    return () => { live = false }
  }, [objects, selectedIds, edge, origin])
  return <details className="reference-tools"><summary>Ruler / reference origin</summary>
    <p className="selection-hint">Coordinates in world axes, relative to the origin below. Minimum, center, and maximum use the finished selection bounds.</p>
    <div className="coordinate-fields">{axes.map((axis) => <label key={axis}>Origin {axis.toUpperCase()}
      <input aria-label={`Reference origin ${axis.toUpperCase()}`} type="number" step="any" value={originDraft[axis]}
        onChange={(event) => setOriginDraft({ ...originDraft, [axis]: event.target.value })} />
    </label>)}</div>
    <button type="button" disabled={Object.values(originDraft).some((value) => !value.trim() || !Number.isFinite(Number(value)))}
      onClick={() => onOrigin({ x: Number(originDraft.x), y: Number(originDraft.y), z: Number(originDraft.z) })}>Set reference origin</button>
    <div className="workplane-actions">
      <button type="button" disabled={!point} onClick={() => point && onOrigin(point)}>Origin at selection</button>
      <button type="button" onClick={() => onOrigin({ x: 0, y: 0, z: 0 })}>Reset origin</button>
    </div>
    <label>Selection reference<select aria-label="Selection reference" value={edge} onChange={(event) => setEdge(event.target.value as AlignmentEdge)}>
      <option value="min">Minimum</option><option value="center">Center</option><option value="max">Maximum</option>
    </select></label>
    <div className="coordinate-fields">{axes.map((axis) => <label key={axis}>{axis.toUpperCase()} offset (mm)
      <input aria-label={`Reference offset ${axis.toUpperCase()}`} type="number" step="any" value={offset[axis]} disabled={!point}
        onChange={(event) => setOffset({ ...offset, [axis]: event.target.value })} />
    </label>)}</div>
    <button type="button" disabled={disabled || !point || Object.values(offset).some((value) => !value.trim() || !Number.isFinite(Number(value)))}
      onClick={() => onPosition(edge, { x: Number(offset.x), y: Number(offset.y), z: Number(offset.z) })}>Apply reference position</button>
    {error && <p role="alert">{error}</p>}
    <p className="selection-hint">Apply moves the selection together, including linked holes. The reference origin is a workspace aid and is not exported.</p>
  </details>
}

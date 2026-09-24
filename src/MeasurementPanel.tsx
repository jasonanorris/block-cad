import { getObjectDimensions, type CadObject, type Vector3 } from './cadModel'

const format = (value: number) => `${Number(value.toFixed(2))} mm`

export default function MeasurementPanel({ objects, selectedObjectIds, activeObjectId }: {
  objects: CadObject[]
  selectedObjectIds: string[]
  activeObjectId: string | null
}) {
  const ids = new Set(selectedObjectIds)
  const selected = objects.filter((object) => ids.has(object.id))
  const active = selected.find((object) => object.id === activeObjectId)
  const dimensions = active ? getObjectDimensions(active) : null
  const other = selected.find((object) => object.id !== activeObjectId)
  const distance = active && other ? Math.hypot(...(['x', 'y', 'z'] as (keyof Vector3)[])
    .map((axis) => active.position[axis] - other.position[axis])) : null
  const span = selected.length > 1 ? (['x', 'y', 'z'] as (keyof Vector3)[]).map((axis) => {
    const values = selected.map((object) => object.position[axis])
    return Math.max(...values) - Math.min(...values)
  }) : null

  return (
    <div className="measurement-panel" aria-live="polite">
      <h3>Measurements</h3>
      {!active && <p className="selection-hint">Select a shape to see its size and position.</p>}
      {active && dimensions && (
        <>
          <div className="measurement-row"><span>Active size</span><strong>{format(dimensions.x)} × {format(dimensions.y)} × {format(dimensions.z)}</strong></div>
          <div className="measurement-row"><span>Center height</span><strong>{format(active.position.y)}</strong></div>
        </>
      )}
      {distance !== null && <div className="measurement-row"><span>Center distance to #{objects.indexOf(other!) + 1}</span><strong>{format(distance)}</strong></div>}
      {span && <div className="measurement-row"><span>Selected center span</span><strong>{span.map(format).join(' × ')}</strong></div>}
      {active && <p className="selection-hint">Size follows the shape’s local axes. Distance and span use shape centers.</p>}
    </div>
  )
}

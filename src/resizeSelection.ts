import { Box3, Vector3 as ThreeVector3 } from 'three'
import type { CadObject, Vector3 } from './cadModel'
import { canPositionUnits, getPlacementBounds, getPlacementUnits } from './placement'

export async function resizeSelection(objects: CadObject[], ids: Set<string>, axis: keyof Vector3,
  size: number): Promise<CadObject[]> {
  if (!Number.isFinite(size) || size <= 0) throw new Error('Target size must be a positive number in millimeters.')
  const units = getPlacementUnits(objects, ids)
  if (!canPositionUnits(objects, units)) throw new Error('Select, show, and unlock the shapes and their linked holes before resizing.')
  const affected = new Set(units.flatMap((unit) => [...unit.ids]))
  if (objects.some((object) => affected.has(object.id) && Object.values(object.scale).some((value) => Math.abs(value) < 1e-6))) {
    throw new Error('Resizing requires nonzero scale on every axis.')
  }
  const bounds = new Box3()
  for (const box of await Promise.all(units.map(getPlacementBounds))) bounds.union(box)
  const extent = bounds.max[axis] - bounds.min[axis]
  if (!Number.isFinite(extent) || extent <= 1e-6) throw new Error('The selection has no measurable size on this axis.')
  const factor = size / extent
  if (Math.abs(factor - 1) < 1e-12) return objects
  const center = bounds.getCenter(new ThreeVector3())
  // A uniform world scale commutes with every source rotation, preserving editable
  // position/rotation/scale data exactly, including reflected shapes and cutters.
  return objects.map((object) => {
    if (!affected.has(object.id)) return object
    const position = { ...object.position }, scale = { ...object.scale }
    for (const coordinate of ['x', 'y', 'z'] as const) {
      position[coordinate] = center[coordinate] + (position[coordinate] - center[coordinate]) * factor
      scale[coordinate] *= factor
      if (!Number.isFinite(position[coordinate]) || !Number.isFinite(scale[coordinate]) || Math.abs(scale[coordinate]) < 1e-6) {
        throw new Error('That size produces coordinates or scales outside the supported range.')
      }
    }
    return { ...object, position, scale }
  })
}

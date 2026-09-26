import { Box3, Vector3 } from 'three'
import type { CadObject, Vector3 as Coordinates } from './cadModel'
import { canPositionUnits, getPlacementBounds, getPlacementUnits, type AlignmentEdge } from './placement'

export async function selectionReference(objects: CadObject[], ids: Set<string>, edge: AlignmentEdge): Promise<Coordinates> {
  const units = getPlacementUnits(objects, ids)
  if (!units.length) throw new Error('Select a shape to measure its reference position.')
  const bounds = new Box3()
  for (const box of await Promise.all(units.map(getPlacementBounds))) bounds.union(box)
  const point = edge === 'center' ? bounds.getCenter(new Vector3()) : bounds[edge]
  return { x: point.x, y: point.y, z: point.z }
}

export async function positionFromReference(objects: CadObject[], ids: Set<string>, edge: AlignmentEdge,
  origin: Coordinates, offset: Coordinates): Promise<CadObject[]> {
  if (![...Object.values(origin), ...Object.values(offset)].every(Number.isFinite)) throw new Error('Reference coordinates must be finite numbers.')
  const units = getPlacementUnits(objects, ids)
  if (!canPositionUnits(objects, units)) throw new Error('Show and unlock the selected shapes and their linked holes before positioning.')
  const point = await selectionReference(objects, ids, edge)
  const delta = { x: origin.x + offset.x - point.x, y: origin.y + offset.y - point.y, z: origin.z + offset.z - point.z }
  if (!Object.values(delta).every(Number.isFinite)) throw new Error('The reference position is outside the supported coordinate range.')
  const moved = new Set(units.flatMap((unit) => [...unit.ids]))
  return objects.map((object) => moved.has(object.id) ? { ...object, position: {
    x: object.position.x + delta.x, y: object.position.y + delta.y, z: object.position.z + delta.z,
  } } : object)
}

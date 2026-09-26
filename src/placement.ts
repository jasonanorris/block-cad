import { Box3, Euler, Matrix4, Quaternion, Vector3 as ThreeVector3 } from 'three'
import { getSolidBodies, isHoleObject, type CadObject, type SolidBody, type Vector3 } from './cadModel'
import { createSourceGeometry } from './sourceGeometry'
import { buildSolidGeometry } from './booleanGeometry'
import { loadManifold } from './manifoldRuntime'

export type AlignmentEdge = 'min' | 'center' | 'max'
type PlacementUnit = { body: SolidBody; ids: Set<string> }

// Position a finished body together with every linked cutter, keeping its shape intact.
// A separately selected hole can still be positioned on its own.
export function getPlacementUnits(objects: CadObject[], selectedIds: Set<string>): PlacementUnit[] {
  const units: PlacementUnit[] = []
  const included = new Set<string>()
  for (const body of getSolidBodies(objects)) {
    if (!body.members.some((object) => selectedIds.has(object.id)) &&
      !body.holes.some((object) => object.groupedWithTarget && selectedIds.has(object.id))) continue
    const ids = new Set([...body.members, ...body.holes].map((object) => object.id))
    ids.forEach((id) => included.add(id))
    units.push({ body, ids })
  }
  for (const hole of objects.filter(isHoleObject)) {
    if (selectedIds.has(hole.id) && !included.has(hole.id)) {
      units.push({ body: { anchor: hole, members: [hole], holes: [] }, ids: new Set([hole.id]) })
    }
  }
  return units
}

export function canPositionUnits(objects: CadObject[], units: PlacementUnit[]): boolean {
  return units.length > 0 && units.every((unit) => objects.every((object) =>
    !unit.ids.has(object.id) || (!object.hidden && !object.locked)))
}

export async function getPlacementBounds(unit: PlacementUnit): Promise<Box3> {
  const { body } = unit
  const derived = body.members.length > 1 || body.holes.length > 0
  const geometry = derived ? buildSolidGeometry(body, await loadManifold()) : createSourceGeometry(body.anchor)
  try {
    const { position, rotation, scale } = body.anchor
    const matrix = new Matrix4().compose(
      new ThreeVector3(position.x, position.y, position.z),
      new Quaternion().setFromEuler(new Euler(rotation.x, rotation.y, rotation.z)),
      new ThreeVector3(scale.x, scale.y, scale.z),
    )
    const bounds = new Box3()
    const point = new ThreeVector3()
    const positions = geometry.getAttribute('position')
    for (let index = 0; index < positions.count; index++) {
      point.fromBufferAttribute(positions, index).applyMatrix4(matrix)
      if (![point.x, point.y, point.z].every(Number.isFinite)) throw new Error('A selected shape has invalid dimensions.')
      bounds.expandByPoint(point)
    }
    if (bounds.isEmpty()) throw new Error('A selected shape is empty. Separate or edit it before positioning.')
    return bounds
  } finally {
    geometry.dispose()
  }
}

function translateUnits(objects: CadObject[], units: PlacementUnit[], offsets: number[], axis: keyof Vector3): CadObject[] {
  const moves = new Map<string, number>()
  units.forEach((unit, index) => unit.ids.forEach((id) => moves.set(id, offsets[index])))
  return objects.map((object) => {
    const offset = moves.get(object.id) ?? 0
    return Math.abs(offset) < 1e-9 ? object : { ...object, position: { ...object.position, [axis]: object.position[axis] + offset } }
  })
}

export async function alignByBounds(objects: CadObject[], ids: Set<string>, activeId: string | null,
  axis: keyof Vector3, edge: AlignmentEdge): Promise<CadObject[]> {
  const units = getPlacementUnits(objects, ids)
  const activeIndex = units.findIndex((unit) => activeId !== null && unit.ids.has(activeId))
  if (units.length < 2 || activeIndex < 0) return objects
  if (!canPositionUnits(objects, units)) throw new Error('Show and unlock the selected shapes and their linked holes before positioning.')
  const bounds = await Promise.all(units.map(getPlacementBounds))
  const coordinate = (box: Box3) => edge === 'center' ? (box.min[axis] + box.max[axis]) / 2 : box[edge][axis]
  const target = coordinate(bounds[activeIndex])
  return translateUnits(objects, units, bounds.map((box) => target - coordinate(box)), axis)
}

import { Euler, Quaternion, Vector3 } from 'three'
import { getSolidBodies, isHoleObject, type CadObject, type Vector3 as Coordinates } from './cadModel'
import { canPositionUnits, getPlacementUnits } from './placement'

export type SurfacePick = { objectId: string; point: Coordinates; normal: Coordinates }
export type SurfacePickMode = 'workplane' | 'align-source' | 'align-target' | 'measure-first' | 'measure-second' | null
export const vector = (p: Coordinates) => new Vector3(p.x, p.y, p.z)
const coordinates = (p: Vector3): Coordinates => ({ x: p.x, y: p.y, z: p.z })

export function pointDistance(a: Coordinates, b: Coordinates) {
  if (![...Object.values(a), ...Object.values(b)].every(Number.isFinite)) throw new Error('Measurement points must be finite.')
  const delta = vector(b).sub(vector(a)), distance = delta.length()
  if (!Number.isFinite(distance)) throw new Error('These points are outside the measurable range.')
  return { delta: coordinates(delta), distance }
}

export function alignPickedFaces(objects: CadObject[], ids: Set<string>, source: SurfacePick, target: SurfacePick, offset: number): CadObject[] {
  if (!Number.isFinite(offset) || Math.abs(offset) > 10000) throw new Error('Face offset must be between -10,000 and 10,000 mm.')
  for (const pick of [source, target]) {
    if (![...Object.values(pick.point), ...Object.values(pick.normal)].every(Number.isFinite) || vector(pick.normal).lengthSq() < 1e-10) throw new Error('Pick two valid solid faces.')
  }
  const units = getPlacementUnits(objects, ids)
  if (units.length !== 1 || !canPositionUnits(objects, units) || isHoleObject(units[0].body.anchor)) throw new Error('Select one visible, unlocked solid assembly, including unlocked linked holes.')
  const unit = units[0]
  if (!unit.body.members.some((member) => member.id === source.objectId)) throw new Error('The source face must belong to the selected body.')
  const targetBody = getSolidBodies(objects).find((body) => body.members.some((member) => member.id === target.objectId))
  if (!targetBody || targetBody.members.some((member) => member.hidden) || [...targetBody.members, ...targetBody.holes].some((object) => unit.ids.has(object.id))) throw new Error('Pick a visible face on a separate target body.')
  const normal = vector(target.normal).normalize()
  const rotation = new Quaternion().setFromUnitVectors(vector(source.normal).normalize(), normal.clone().negate())
  const destination = vector(target.point).addScaledVector(normal, offset)
  return objects.map((object) => {
    if (!unit.ids.has(object.id)) return object
    const position = vector(object.position).sub(vector(source.point)).applyQuaternion(rotation).add(destination)
    const orientation = new Euler().setFromQuaternion(rotation.clone().multiply(new Quaternion().setFromEuler(
      new Euler(object.rotation.x, object.rotation.y, object.rotation.z))))
    if (!position.toArray().every(Number.isFinite)) throw new Error('Alignment exceeds the supported coordinate range.')
    return { ...object, position: coordinates(position), rotation: { x: orientation.x, y: orientation.y, z: orientation.z } }
  })
}

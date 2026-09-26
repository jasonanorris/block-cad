import { Euler, Quaternion, Vector3 as ThreeVector3 } from 'three'
import type { CadObject, Vector3 } from './cadModel'
import { copyCadObjects, expandAssemblyIds } from './selectionOperations'

export function radialArray(objects: CadObject[], ids: Set<string>, axis: keyof Vector3,
  count: number, angle: number, center: Vector3) {
  if (!Number.isInteger(count) || count < 2 || count > 100) throw new Error('Count must be a whole number from 2 to 100, including the original.')
  if (!Number.isFinite(angle) || angle === 0 || Math.abs(angle) >= 360) throw new Error('Angle per copy must be nonzero and between −360° and 360°.')
  if (!Object.values(center).every(Number.isFinite)) throw new Error('Pivot coordinates must be finite numbers.')
  const expanded = expandAssemblyIds(objects, ids, true)
  const sources = objects.filter((object) => expanded.has(object.id))
  if (sources.length * (count - 1) > 1000) throw new Error('An array can add up to 1,000 source shapes. Reduce the count or selection.')
  const pivot = new ThreeVector3(center.x, center.y, center.z)
  const direction = new ThreeVector3(); direction[axis] = 1
  const copies: CadObject[] = []
  let lastCopiedIds = new Map<string, string>()
  for (let step = 1; step < count; step++) {
    const turn = new Quaternion().setFromAxisAngle(direction, angle * step * Math.PI / 180)
    const result = copyCadObjects(sources, 0, objects)
    for (const object of result.copies) {
      const position = new ThreeVector3(object.position.x, object.position.y, object.position.z).sub(pivot).applyQuaternion(turn).add(pivot)
      if (!position.toArray().every(Number.isFinite)) throw new Error('This pivot produces coordinates that are too large.')
      const rotation = new Euler().setFromQuaternion(turn.clone().multiply(
        new Quaternion().setFromEuler(new Euler(object.rotation.x, object.rotation.y, object.rotation.z))))
      object.position = { x: position.x, y: position.y, z: position.z }
      object.rotation = { x: rotation.x, y: rotation.y, z: rotation.z }
    }
    copies.push(...result.copies)
    lastCopiedIds = result.copiedIds
  }
  return { copies, lastCopiedIds }
}

import { Box3, Euler, Matrix4, Quaternion, Vector3 as ThreeVector3 } from 'three'
import type { CadObject, Vector3 } from './cadModel'
import { canPositionUnits, getPlacementBounds, getPlacementUnits } from './placement'

export async function mirrorSelection(objects: CadObject[], ids: Set<string>, axis: keyof Vector3): Promise<CadObject[]> {
  const units = getPlacementUnits(objects, ids)
  if (!units.length) return objects
  if (!canPositionUnits(objects, units)) throw new Error('Show and unlock the selection and its linked holes before mirroring.')
  const affected = new Set(units.flatMap((unit) => [...unit.ids]))
  if (objects.some((object) => affected.has(object.id) && Object.values(object.scale).some((value) => Math.abs(value) < 1e-6))) {
    throw new Error('Mirroring requires nonzero scale on every axis.')
  }
  const bounds = new Box3()
  for (const box of await Promise.all(units.map(getPlacementBounds))) bounds.union(box)
  const center = bounds.getCenter(new ThreeVector3())
  const reflectionScale = new ThreeVector3(1, 1, 1)
  reflectionScale[axis] = -1
  const reflection = new Matrix4().makeTranslation(center.x, center.y, center.z)
    .multiply(new Matrix4().makeScale(reflectionScale.x, reflectionScale.y, reflectionScale.z))
    .multiply(new Matrix4().makeTranslation(-center.x, -center.y, -center.z))
  return objects.map((object) => {
    if (!affected.has(object.id)) return object
    const { position, rotation, scale } = object
    const matrix = new Matrix4().compose(new ThreeVector3(position.x, position.y, position.z),
      new Quaternion().setFromEuler(new Euler(rotation.x, rotation.y, rotation.z)),
      new ThreeVector3(scale.x, scale.y, scale.z))
    const mirroredPosition = new ThreeVector3()
    const mirroredRotation = new Quaternion()
    const mirroredScale = new ThreeVector3()
    reflection.clone().multiply(matrix).decompose(mirroredPosition, mirroredRotation, mirroredScale)
    const angles = new Euler().setFromQuaternion(mirroredRotation)
    return { ...object,
      position: { x: mirroredPosition.x, y: mirroredPosition.y, z: mirroredPosition.z },
      rotation: { x: angles.x, y: angles.y, z: angles.z },
      scale: { x: mirroredScale.x, y: mirroredScale.y, z: mirroredScale.z },
    }
  })
}

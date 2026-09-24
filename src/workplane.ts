import { Euler, Matrix4 } from 'three'
import { getObjectDimensions, type CadObject } from './cadModel'

// Height of the source shape's top in world coordinates. The formulas use the
// support radius along world Y, so rotated boxes, cylinders, and spheres work.
export function getObjectTopHeight(object: CadObject): number {
  const size = getObjectDimensions(object)
  const rotation = new Matrix4().makeRotationFromEuler(new Euler(
    object.rotation.x, object.rotation.y, object.rotation.z,
  )).elements
  const [x, y, z] = [rotation[1], rotation[5], rotation[9]]
  let radius: number

  if (object.type === 'box' || object.type === 'svg' || object.type === 'stl') {
    radius = (Math.abs(x) * size.x + Math.abs(y) * size.y + Math.abs(z) * size.z) / 2
  } else if (object.type === 'cylinder') {
    radius = (Math.hypot(x * size.x, z * size.z) + Math.abs(y) * size.y) / 2
  } else {
    radius = Math.hypot(x * size.x, y * size.y, z * size.z) / 2
  }

  return object.position.y + radius
}

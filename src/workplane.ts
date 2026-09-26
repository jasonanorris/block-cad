import { Euler, Matrix4 } from 'three'
import { getObjectDimensions, type CadObject } from './cadModel'
import { createSourceGeometry } from './sourceGeometry'

// Height of the source shape's top in world coordinates. The formulas use the
// support radius along world Y, so rotated boxes, cylinders, and spheres work.
export function getObjectTopHeight(object: CadObject): number {
  const size = getObjectDimensions(object)
  const rotation = new Matrix4().makeRotationFromEuler(new Euler(
    object.rotation.x, object.rotation.y, object.rotation.z,
  )).elements
  const [x, y, z] = [rotation[1], rotation[5], rotation[9]]
  if (object.type === 'cone' || object.type === 'wedge' || object.type === 'prism' || object.type === 'text') {
    const geometry = createSourceGeometry(object)
    try {
      const positions = geometry.getAttribute('position')
      let top = -Infinity
      for (let i = 0; i < positions.count; i++) top = Math.max(top,
        positions.getX(i) * object.scale.x * x + positions.getY(i) * object.scale.y * y + positions.getZ(i) * object.scale.z * z)
      return object.position.y + top
    } finally { geometry.dispose() }
  }
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

import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { getObjectDimensions, type CadObject } from './cadModel'
import type { Vector3 as Coordinates } from './cadModel'
import { canPositionUnits, getPlacementUnits, placementGeometry } from './placement'
import { createSourceGeometry } from './sourceGeometry'

// Height of the source shape's top in world coordinates. The formulas use the
// support radius along world Y, so rotated boxes, cylinders, and spheres work.
export function getObjectTopHeight(object: CadObject): number {
  const size = getObjectDimensions(object)
  const rotation = new Matrix4().makeRotationFromEuler(new Euler(
    object.rotation.x, object.rotation.y, object.rotation.z,
  )).elements
  const [x, y, z] = [rotation[1], rotation[5], rotation[9]]
  if (object.type === 'custom' || object.type === 'cone' || object.type === 'wedge' || object.type === 'prism' || object.type === 'text') {
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

// A fixed workspace frame: changing its source shape later does not move it.
export type WorkplaneFrame = { origin: Coordinates; rotation: Coordinates }

export function faceWorkplane(point: Coordinates, normal: Coordinates): WorkplaneFrame {
  const up = new Vector3(normal.x, normal.y, normal.z)
  if (![...Object.values(point), ...Object.values(normal)].every(Number.isFinite) || up.lengthSq() < 1e-12) {
    throw new Error('This face has no usable workplane normal.')
  }
  up.normalize()
  const right = new Vector3(1, 0, 0).addScaledVector(up, -up.x)
  if (right.lengthSq() < 1e-8) right.set(0, 0, 1).addScaledVector(up, -up.z)
  right.normalize()
  const forward = right.clone().cross(up).normalize()
  const rotation = new Euler().setFromRotationMatrix(new Matrix4().makeBasis(right, up, forward))
  return { origin: { ...point }, rotation: { x: rotation.x, y: rotation.y, z: rotation.z } }
}

export function onFaceWorkplane(objects: CadObject[], frame: WorkplaneFrame | null): CadObject[] {
  if (!frame) return objects
  const rotation = new Quaternion().setFromEuler(new Euler(frame.rotation.x, frame.rotation.y, frame.rotation.z))
  const origin = new Vector3(frame.origin.x, frame.origin.y, frame.origin.z)
  return objects.map((object) => {
    const point = new Vector3(object.position.x, object.position.y, object.position.z).applyQuaternion(rotation).add(origin)
    const orientation = new Euler().setFromQuaternion(rotation.clone().multiply(
      new Quaternion().setFromEuler(new Euler(object.rotation.x, object.rotation.y, object.rotation.z))))
    return { ...object, position: { x: point.x, y: point.y, z: point.z },
      rotation: { x: orientation.x, y: orientation.y, z: orientation.z } }
  })
}

export async function dropToFaceWorkplane(objects: CadObject[], ids: Set<string>, frame: WorkplaneFrame): Promise<CadObject[]> {
  const units = getPlacementUnits(objects, ids)
  if (!canPositionUnits(objects, units)) throw new Error('Show and unlock the selected shapes and their linked holes before positioning.')
  const normal = new Vector3(0, 1, 0).applyEuler(new Euler(frame.rotation.x, frame.rotation.y, frame.rotation.z))
  const distance = normal.dot(new Vector3(frame.origin.x, frame.origin.y, frame.origin.z))
  const offsets = new Map<string, number>()
  for (const unit of units) {
    const geometry = await placementGeometry(unit.body)
    try {
      const positions = geometry.getAttribute('position')
      let minimum = Infinity
      const point = new Vector3()
      for (let i = 0; i < positions.count; i++) minimum = Math.min(minimum, point.fromBufferAttribute(positions, i).dot(normal))
      if (!Number.isFinite(minimum)) throw new Error('A selected shape is empty or invalid.')
      unit.ids.forEach((id) => offsets.set(id, distance - minimum))
    } finally { geometry.dispose() }
  }
  return objects.map((object) => {
    const offset = offsets.get(object.id)
    return offset === undefined ? object : { ...object, position: {
      x: object.position.x + normal.x * offset, y: object.position.y + normal.y * offset, z: object.position.z + normal.z * offset,
    } }
  })
}

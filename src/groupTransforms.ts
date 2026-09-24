import { Euler, Matrix4, Quaternion, Vector3 as ThreeVector3 } from 'three'
import { isHoleObject, type CadObject, type Vector3 } from './cadModel'

function point(value: Vector3): ThreeVector3 {
  return new ThreeVector3(value.x, value.y, value.z)
}

function coordinates(value: ThreeVector3): Vector3 {
  return { x: value.x, y: value.y, z: value.z }
}

function orientation(object: CadObject): Quaternion {
  return new Quaternion().setFromEuler(new Euler(object.rotation.x, object.rotation.y, object.rotation.z))
}

function matrix(object: CadObject): Matrix4 {
  return new Matrix4().compose(point(object.position), orientation(object), point(object.scale))
}

function shift(object: CadObject, offset: Vector3): CadObject {
  return { ...object, position: {
    x: object.position.x + offset.x,
    y: object.position.y + offset.y,
    z: object.position.z + offset.z,
  } }
}

function transformRelative(object: CadObject, before: CadObject, after: CadObject): CadObject {
  const scaleChanged = before.scale.x !== after.scale.x || before.scale.y !== after.scale.y ||
    before.scale.z !== after.scale.z
  if (scaleChanged) {
    if ([before.scale.x, before.scale.y, before.scale.z].some((value) => Math.abs(value) < 1e-6)) {
      return shift(object, {
        x: after.position.x - before.position.x,
        y: after.position.y - before.position.y,
        z: after.position.z - before.position.z,
      })
    }
    // Apply the active solid's relative transform to another source shape.
    const transformed = matrix(after).multiply(matrix(before).invert()).multiply(matrix(object))
    const position = new ThreeVector3()
    const rotation = new Quaternion()
    const scale = new ThreeVector3()
    transformed.decompose(position, rotation, scale)
    const euler = new Euler().setFromQuaternion(rotation)
    return { ...object, position: coordinates(position),
      rotation: { x: euler.x, y: euler.y, z: euler.z }, scale: coordinates(scale) }
  }

  const turn = orientation(after).multiply(orientation(before).invert())
  const position = point(object.position).sub(point(before.position)).applyQuaternion(turn).add(point(after.position))
  const rotated = turn.multiply(orientation(object))
  const euler = new Euler().setFromQuaternion(rotated)
  return { ...object, position: coordinates(position),
    rotation: { x: euler.x, y: euler.y, z: euler.z } }
}

// Source objects remain editable. The active solid's transform also affects its
// joined members and any holes grouped with those members.
export function updateObjectWithGroups(
  objects: CadObject[], id: string, update: (object: CadObject) => CadObject,
): CadObject[] {
  const before = objects.find((object) => object.id === id)
  if (!before) return objects
  const after = update(before)
  if (isHoleObject(before)) return objects.map((object) => object.id === id ? after : object)

  const offset = {
    x: after.position.x - before.position.x,
    y: after.position.y - before.position.y,
    z: after.position.z - before.position.z,
  }
  const moved = offset.x !== 0 || offset.y !== 0 || offset.z !== 0
  const rotated = before.rotation.x !== after.rotation.x || before.rotation.y !== after.rotation.y ||
    before.rotation.z !== after.rotation.z
  const scaled = before.scale.x !== after.scale.x || before.scale.y !== after.scale.y ||
    before.scale.z !== after.scale.z
  if (!moved && !rotated && !scaled) {
    return objects.map((object) => object.id === id ? after : object)
  }
  const memberIds = new Set(objects.filter((object) => !isHoleObject(object) &&
    (object.id === id || !!(before.joinGroupId && object.joinGroupId === before.joinGroupId)))
    .map((object) => object.id))

  return objects.map((object) => {
    if (object.id === id) return after
    if (isHoleObject(object) && object.groupedWithTarget && memberIds.has(object.cutTargetId)) {
      return scaled || rotated ? transformRelative(object, before, after) : shift(object, offset)
    }
    if (memberIds.has(object.id)) return scaled || rotated ? transformRelative(object, before, after) : shift(object, offset)
    return object
  })
}

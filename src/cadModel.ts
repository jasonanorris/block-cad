export type Vector3 = { x: number; y: number; z: number }

// One scene length unit equals one millimeter. Rotation values are radians.
export const MODEL_UNIT = 'mm' as const

type BaseObject = {
  id: string
  position: Vector3
  rotation: Vector3
  scale: Vector3
}

export type ObjectTransform = Pick<BaseObject, 'position' | 'rotation' | 'scale'>

export type CadObject = BaseObject & (
  | { type: 'box'; dimensions: Vector3; cutTargetId?: string }
  | { type: 'cylinder'; dimensions: { diameter: number; height: number }; cutTargetId?: string }
  | { type: 'sphere'; dimensions: { diameter: number } }
)

export type CadObjectType = CadObject['type']

export type HoleObject = Extract<CadObject, { type: 'box' | 'cylinder' }> & { cutTargetId: string }

export function isHoleObject(object: CadObject): object is HoleObject {
  return (object.type === 'box' || object.type === 'cylinder') && !!object.cutTargetId
}

function baseDimensions(object: CadObject): Vector3 {
  switch (object.type) {
    case 'box':
      return object.dimensions
    case 'cylinder':
      return { x: object.dimensions.diameter, y: object.dimensions.height, z: object.dimensions.diameter }
    case 'sphere':
      return { x: object.dimensions.diameter, y: object.dimensions.diameter, z: object.dimensions.diameter }
  }
}

// Visible dimensions are the local shape dimensions after scaling, before rotation.
export function getObjectDimensions(object: CadObject): Vector3 {
  const base = baseDimensions(object)
  return {
    x: base.x * Math.abs(object.scale.x),
    y: base.y * Math.abs(object.scale.y),
    z: base.z * Math.abs(object.scale.z),
  }
}

export function setObjectDimension(object: CadObject, axis: keyof Vector3, value: number): CadObject {
  const base = baseDimensions(object)[axis]
  const direction = Math.sign(object.scale[axis]) || 1
  return { ...object, scale: { ...object.scale, [axis]: direction * value / base } }
}

export function duplicateCadObject(object: CadObject): CadObject {
  const duplicate = structuredClone(object)
  duplicate.id = crypto.randomUUID()
  duplicate.position.x += 25
  duplicate.position.z += 25
  return duplicate
}

export function createCadObject(type: CadObjectType, x = 0, z = 0): CadObject {
  const base = {
    id: crypto.randomUUID(),
    position: { x, y: 10, z },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  }

  switch (type) {
    case 'box':
      return { ...base, type, dimensions: { x: 20, y: 20, z: 20 } }
    case 'cylinder':
      return { ...base, type, dimensions: { diameter: 20, height: 20 } }
    case 'sphere':
      return { ...base, type, dimensions: { diameter: 20 } }
  }
}

// A small, editable subtraction example for the first Boolean milestone.
export function createCutExample(x = 0, z = 0): [CadObject, CadObject] {
  const box = createCadObject('box', x, z) as Extract<CadObject, { type: 'box' }>
  box.dimensions = { x: 30, y: 20, z: 30 }

  const cutter = createCadObject('cylinder', x, z) as Extract<CadObject, { type: 'cylinder' }>
  cutter.dimensions = { diameter: 12, height: 30 }
  cutter.cutTargetId = box.id
  return [box, cutter]
}

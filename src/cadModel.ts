import type { CustomParameters } from './customShapes'
import type { TextFont } from './textFonts'
import { regularPolygon } from './polygon'

export type Vector3 = { x: number; y: number; z: number }
export type Point2 = { x: number; y: number }
export type SvgContours = { outline: Point2[]; holes: Point2[][] }

// One scene length unit equals one millimeter. Rotation values are radians.
export const MODEL_UNIT = 'mm' as const

type BaseObject = {
  id: string
  name?: string
  color?: string
  hidden?: boolean
  locked?: boolean
  position: Vector3
  rotation: Vector3
  scale: Vector3
  cutTargetId?: string
  groupedWithTarget?: boolean
  joinGroupId?: string
  joinMode?: 'intersection'
}

export type ObjectTransform = Pick<BaseObject, 'position' | 'rotation' | 'scale'>

export type CadObject = BaseObject & (
  | { type: 'custom'; parameters: CustomParameters; dimensions: Vector3 }
  | { type: 'box'; dimensions: Vector3 }
  | { type: 'cylinder'; dimensions: { diameter: number; height: number } }
  | { type: 'sphere'; dimensions: { diameter: number } }
  | { type: 'cone'; dimensions: { diameter: number; height: number } }
  | { type: 'wedge'; dimensions: Vector3 }
  | { type: 'prism'; dimensions: { diameter: number; height: number }; sides: number }
  | { type: 'text'; fontId?: TextFont; text: string; fontSize: number; contours: SvgContours[]; dimensions: Vector3 }
  | { type: 'svg'; dimensions: Vector3; contours: SvgContours }
  | { type: 'stl'; dimensions: Vector3; meshData: string }
)

export type CadObjectType = CadObject['type']
export type PrimitiveType = Exclude<CadObjectType, 'svg' | 'stl' | 'text' | 'custom'>

export type HoleObject = CadObject & { cutTargetId: string }

export function isHoleObject(object: CadObject): object is HoleObject {
  return !!object.cutTargetId
}

export type SolidBody = {
  anchor: CadObject
  members: CadObject[]
  holes: HoleObject[]
}

// Combined solids form one derived body. A hole linked to any member cuts the whole body.
export function getSolidBodies(objects: CadObject[]): SolidBody[] {
  const bodies: SolidBody[] = []
  const joined = new Map<string, SolidBody>()
  const bodyByMemberId = new Map<string, SolidBody>()

  for (const object of objects) {
    if (isHoleObject(object)) continue
    let body = object.joinGroupId ? joined.get(object.joinGroupId) : undefined
    if (!body) {
      body = { anchor: object, members: [], holes: [] }
      bodies.push(body)
      if (object.joinGroupId) joined.set(object.joinGroupId, body)
    }
    body.members.push(object)
    bodyByMemberId.set(object.id, body)
  }

  for (const hole of objects.filter(isHoleObject)) {
    bodyByMemberId.get(hole.cutTargetId)?.holes.push(hole)
  }
  return bodies
}

export function normalizeJoinGroups(objects: CadObject[]): CadObject[] {
  const counts = new Map<string, number>()
  for (const object of objects) {
    if (object.joinGroupId && !isHoleObject(object)) {
      counts.set(object.joinGroupId, (counts.get(object.joinGroupId) ?? 0) + 1)
    }
  }
  return objects.map((object) => object.joinGroupId &&
    (isHoleObject(object) || (counts.get(object.joinGroupId) ?? 0) < 2)
    ? { ...object, joinGroupId: undefined, joinMode: undefined }
    : object)
}

function baseDimensions(object: CadObject): Vector3 {
  switch (object.type) {
    case 'box':
    case 'wedge':
      return object.dimensions
    case 'cylinder':
    case 'cone':
      return { x: object.dimensions.diameter, y: object.dimensions.height, z: object.dimensions.diameter }
    case 'prism': {
      const points = regularPolygon(object.sides, object.dimensions.diameter / 2)
      return { x: Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x)),
        y: object.dimensions.height,
        z: Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y)) }
    }
    case 'sphere':
      return { x: object.dimensions.diameter, y: object.dimensions.diameter, z: object.dimensions.diameter }
    case 'custom':
    case 'svg':
    case 'text':
    case 'stl':
      return object.dimensions
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

export function duplicateCadObject(object: CadObject, offset = 25): CadObject {
  const duplicate = structuredClone(object)
  duplicate.id = crypto.randomUUID()
  duplicate.position.x += offset
  duplicate.position.z += offset
  return duplicate
}

export function createCadObject(type: PrimitiveType, x = 0, z = 0, workplaneHeight = 0): CadObject {
  const base = {
    id: crypto.randomUUID(),
    position: { x, y: workplaneHeight + 10, z },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  }

  switch (type) {
    case 'box':
    case 'wedge':
      return { ...base, type, dimensions: { x: 20, y: 20, z: 20 } }
    case 'cylinder':
    case 'cone':
      return { ...base, type, dimensions: { diameter: 20, height: 20 } }
    case 'prism':
      return { ...base, type, dimensions: { diameter: 20, height: 20 }, sides: 6 }
    case 'sphere':
      return { ...base, type, dimensions: { diameter: 20 } }
  }
}

// A small, editable subtraction example for the first Boolean milestone.
export function createCutExample(x = 0, z = 0, workplaneHeight = 0): [CadObject, CadObject] {
  const box = createCadObject('box', x, z, workplaneHeight) as Extract<CadObject, { type: 'box' }>
  box.dimensions = { x: 30, y: 20, z: 30 }

  const cutter = createCadObject('cylinder', x, z, workplaneHeight) as Extract<CadObject, { type: 'cylinder' }>
  cutter.dimensions = { diameter: 12, height: 30 }
  cutter.cutTargetId = box.id
  return [box, cutter]
}

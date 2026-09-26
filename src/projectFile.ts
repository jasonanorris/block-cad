import { isHoleObject, MODEL_UNIT, type CadObject, type Point2, type SvgContours, type Vector3 } from './cadModel.ts'
import { validObjectColor } from './objectColor'
import { isTextFont } from './textFonts'
import { decodeStlMesh } from './stlMesh'

const PROJECT_FORMAT = 'block-cad'
const PROJECT_VERSION = 16

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number.`)
  }
  return value
}

function positiveNumber(value: unknown, field: string): number {
  const number = finiteNumber(value, field)
  if (number <= 0) throw new Error(`${field} must be greater than zero.`)
  return number
}

function vector(value: unknown, field: string): Vector3 {
  const data = record(value)
  if (!data) throw new Error(`${field} must have x, y, and z coordinates.`)
  return {
    x: finiteNumber(data.x, `${field}.x`),
    y: finiteNumber(data.y, `${field}.y`),
    z: finiteNumber(data.z, `${field}.z`),
  }
}

function contour(value: unknown, field: string): Point2[] {
  if (!Array.isArray(value) || value.length < 3 || value.length > 20_000) {
    throw new Error(`${field} must contain 3 to 20,000 points.`)
  }
  return value.map((point, index) => {
    const data = record(point)
    if (!data) throw new Error(`${field}[${index}] must have x and y coordinates.`)
    return { x: finiteNumber(data.x, `${field}[${index}].x`), y: finiteNumber(data.y, `${field}[${index}].y`) }
  })
}

function svgContours(value: unknown, field: string): SvgContours {
  const data = record(value)
  if (!data || !Array.isArray(data.holes) || data.holes.length > 100) {
    throw new Error(`${field} must have an outline and up to 100 holes.`)
  }
  const outline = contour(data.outline, `${field}.outline`)
  const holes = data.holes.map((hole, index) => contour(hole, `${field}.holes[${index}]`))
  if (outline.length + holes.reduce((count, hole) => count + hole.length, 0) > 20_000) {
    throw new Error(`${field} has too many points.`)
  }
  return { outline, holes }
}

function objectFromFile(value: unknown, index: number, version: number): CadObject {
  const data = record(value)
  const field = `objects[${index}]`
  if (!data || typeof data.id !== 'string' || !data.id.trim()) {
    throw new Error(`${field} must have a nonempty ID.`)
  }
  if (version >= 6 && data.joinGroupId !== undefined &&
    (typeof data.joinGroupId !== 'string' || !data.joinGroupId.trim())) {
    throw new Error(`${field}.joinGroupId must be a nonempty ID.`)
  }
  if (version >= 12 && data.joinMode !== undefined && data.joinMode !== 'intersection') {
    throw new Error(`${field}.joinMode must be intersection.`)
  }
  if (version >= 7 && data.name !== undefined &&
    (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 80)) {
    throw new Error(`${field}.name must be 1 to 80 characters.`)
  }
  if (version >= 8 && data.groupedWithTarget !== undefined && typeof data.groupedWithTarget !== 'boolean') {
    throw new Error(`${field}.groupedWithTarget must be a boolean.`)
  }
  if (version >= 9 && data.hidden !== undefined && typeof data.hidden !== 'boolean') {
    throw new Error(`${field}.hidden must be a boolean.`)
  }
  if (version >= 9 && data.locked !== undefined && typeof data.locked !== 'boolean') {
    throw new Error(`${field}.locked must be a boolean.`)
  }
  if (version >= 14 && data.color !== undefined && !validObjectColor(data.color)) {
    throw new Error(`${field}.color must be a six-digit hexadecimal color.`)
  }
  const base = {
    ...(version >= 14 && validObjectColor(data.color) ? { color: data.color.toLowerCase() } : {}),
    id: data.id,
    ...(version >= 7 && data.name ? { name: (data.name as string).trim() } : {}),
    ...(version >= 8 && data.groupedWithTarget ? { groupedWithTarget: true } : {}),
    ...(version >= 9 && data.hidden ? { hidden: true } : {}),
    ...(version >= 9 && data.locked ? { locked: true } : {}),
    position: vector(data.position, `${field}.position`),
    rotation: vector(data.rotation, `${field}.rotation`),
    scale: vector(data.scale, `${field}.scale`),
    ...(version >= 6 && data.joinGroupId ? { joinGroupId: data.joinGroupId as string } : {}),
    ...(version >= 12 && data.joinMode === 'intersection' ? { joinMode: 'intersection' as const } : {}),
  }
  const dimensions = record(data.dimensions)
  if (!dimensions) throw new Error(`${field}.dimensions is missing.`)

  switch (data.type) {
    case 'cone':
    case 'wedge':
    case 'prism': {
      if (version < 13) throw new Error(`${field} has an unsupported shape type.`)
      if (data.cutTargetId !== undefined && (typeof data.cutTargetId !== 'string' || !data.cutTargetId.trim())) {
        throw new Error(`${field}.cutTargetId must be a nonempty ID.`)
      }
      const linked = { ...base, ...(data.cutTargetId ? { cutTargetId: data.cutTargetId as string } : {}) }
      if (data.type === 'wedge') return { ...linked, type: 'wedge', dimensions: {
        x: positiveNumber(dimensions.x, `${field}.dimensions.x`),
        y: positiveNumber(dimensions.y, `${field}.dimensions.y`),
        z: positiveNumber(dimensions.z, `${field}.dimensions.z`),
      } }
      const roundDimensions = { diameter: positiveNumber(dimensions.diameter, `${field}.dimensions.diameter`),
        height: positiveNumber(dimensions.height, `${field}.dimensions.height`) }
      if (data.type === 'cone') return { ...linked, type: 'cone', dimensions: roundDimensions }
      if (typeof data.sides !== 'number' || !Number.isInteger(data.sides) || data.sides < 3 || data.sides > 64) {
        throw new Error(`${field}.sides must be a whole number from 3 to 64.`)
      }
      return { ...linked, type: 'prism', dimensions: roundDimensions, sides: data.sides }
    }
    case 'box': {
      if (version >= 4 && data.cutTargetId !== undefined &&
        (typeof data.cutTargetId !== 'string' || !data.cutTargetId.trim())) {
        throw new Error(`${field}.cutTargetId must be a nonempty ID.`)
      }
      return { ...base, type: 'box', dimensions: {
        x: positiveNumber(dimensions.x, `${field}.dimensions.x`),
        y: positiveNumber(dimensions.y, `${field}.dimensions.y`),
        z: positiveNumber(dimensions.z, `${field}.dimensions.z`),
      }, ...(version >= 4 && data.cutTargetId ? { cutTargetId: data.cutTargetId as string } : {}) }
    }
    case 'cylinder': {
      if (version >= 2 && data.cutTargetId !== undefined &&
        (typeof data.cutTargetId !== 'string' || !data.cutTargetId.trim())) {
        throw new Error(`${field}.cutTargetId must be a nonempty ID.`)
      }
      return { ...base, type: 'cylinder', dimensions: {
        diameter: positiveNumber(dimensions.diameter, `${field}.dimensions.diameter`),
        height: positiveNumber(dimensions.height, `${field}.dimensions.height`),
      }, ...(version >= 2 && data.cutTargetId ? { cutTargetId: data.cutTargetId as string } : {}) }
    }
    case 'sphere': {
      if (version >= 5 && data.cutTargetId !== undefined &&
        (typeof data.cutTargetId !== 'string' || !data.cutTargetId.trim())) {
        throw new Error(`${field}.cutTargetId must be a nonempty ID.`)
      }
      return { ...base, type: 'sphere', dimensions: {
        diameter: positiveNumber(dimensions.diameter, `${field}.dimensions.diameter`),
      }, ...(version >= 5 && data.cutTargetId ? { cutTargetId: data.cutTargetId as string } : {}) }
    }
    case 'text': {
      if (version < 15) throw new Error(`${field} has an unsupported shape type.`)
      if (typeof data.text !== 'string' || !data.text.trim() || data.text.length > 80) throw new Error(`${field}.text must contain 1 to 80 characters.`)
      if (typeof data.fontSize !== 'number' || !Number.isFinite(data.fontSize) || data.fontSize < 1 || data.fontSize > 200) throw new Error(`${field}.fontSize must be between 1 and 200 mm.`)
      if (!Array.isArray(data.contours) || !data.contours.length || data.contours.length > 160) throw new Error(`${field}.contours must contain 1 to 160 filled outlines.`)
      const contours = data.contours.map((value, i) => svgContours(value, `${field}.contours[${i}]`))
      if (contours.reduce((n, c) => n + c.outline.length + c.holes.reduce((m, h) => m + h.length, 0), 0) > 40000) throw new Error(`${field}.contours has too many points.`)
      if (data.cutTargetId !== undefined && (typeof data.cutTargetId !== 'string' || !data.cutTargetId.trim())) throw new Error(`${field}.cutTargetId must be a nonempty ID.`)
      if (version >= 16 && data.fontId !== undefined && !isTextFont(data.fontId)) throw new Error(`${field}.fontId is not a supported font.`)
      return { ...base, ...(version >= 16 && isTextFont(data.fontId) ? { fontId: data.fontId } : {}), type: 'text', text: data.text, fontSize: data.fontSize, contours,
        dimensions: { x: positiveNumber(dimensions.x, `${field}.dimensions.x`), y: positiveNumber(dimensions.y, `${field}.dimensions.y`), z: positiveNumber(dimensions.z, `${field}.dimensions.z`) },
        ...(data.cutTargetId ? { cutTargetId: data.cutTargetId as string } : {}) }
    }
    case 'svg': {
      if (version < 10) throw new Error(`${field} has an unsupported shape type.`)
      if (data.cutTargetId !== undefined && (typeof data.cutTargetId !== 'string' || !data.cutTargetId.trim())) {
        throw new Error(`${field}.cutTargetId must be a nonempty ID.`)
      }
      return { ...base, type: 'svg', dimensions: {
        x: positiveNumber(dimensions.x, `${field}.dimensions.x`),
        y: positiveNumber(dimensions.y, `${field}.dimensions.y`),
        z: positiveNumber(dimensions.z, `${field}.dimensions.z`),
      }, contours: svgContours(data.contours, `${field}.contours`),
      ...(data.cutTargetId ? { cutTargetId: data.cutTargetId as string } : {}) }
    }
    case 'stl': {
      if (version < 11) throw new Error(`${field} has an unsupported shape type.`)
      if (data.cutTargetId !== undefined && (typeof data.cutTargetId !== 'string' || !data.cutTargetId.trim())) {
        throw new Error(`${field}.cutTargetId must be a nonempty ID.`)
      }
      if (typeof data.meshData !== 'string') throw new Error(`${field}.meshData must contain STL triangles.`)
      try {
        decodeStlMesh(data.meshData)
      } catch (error) {
        throw new Error(`${field}.meshData: ${error instanceof Error ? error.message : 'Invalid STL data.'}`)
      }
      return { ...base, type: 'stl', dimensions: {
        x: positiveNumber(dimensions.x, `${field}.dimensions.x`),
        y: positiveNumber(dimensions.y, `${field}.dimensions.y`),
        z: positiveNumber(dimensions.z, `${field}.dimensions.z`),
      }, meshData: data.meshData,
      ...(data.cutTargetId ? { cutTargetId: data.cutTargetId as string } : {}) }
    }
    default:
      throw new Error(`${field} has an unsupported shape type.`)
  }
}

export function serializeProject(objects: CadObject[]): string {
  const normalized = objects.map((object) => ({ ...object, name: object.name?.trim() || undefined }))
  return JSON.stringify({ format: PROJECT_FORMAT, version: PROJECT_VERSION, units: MODEL_UNIT, objects: normalized }, null, 2) + '\n'
}

export function parseProject(text: string): CadObject[] {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON.')
  }

  const project = record(value)
  if (!project || project.format !== PROJECT_FORMAT) throw new Error('This is not a Block CAD project file.')
  if (typeof project.version !== 'number' || !Number.isInteger(project.version) || project.version < 1 || project.version > PROJECT_VERSION) {
    throw new Error(`Unsupported project version: ${String(project.version)}.`)
  }
  if (project.units !== MODEL_UNIT) throw new Error(`Unsupported project units: ${String(project.units)}.`)
  if (!Array.isArray(project.objects)) throw new Error('The project objects must be a list.')

  const objects = project.objects.map((object, index) => objectFromFile(object, index, project.version as number))
  const ids = new Set(objects.map((object) => object.id))
  if (ids.size !== objects.length) throw new Error('The project contains duplicate object IDs.')
  for (const object of objects) {
    if (object.groupedWithTarget && !isHoleObject(object)) {
      throw new Error(`Only a linked hole can be grouped with its target.`)
    }
    if (isHoleObject(object) &&
      !objects.some((target) => target.id === object.cutTargetId &&
        (project.version === 2 ? target.type === 'box' : !isHoleObject(target)))) {
      throw new Error(`Hole ${object.id} must cut an existing solid target.`)
    }
  }
  const joinCounts = new Map<string, number>()
  const joinModes = new Map<string, CadObject['joinMode']>()
  for (const object of objects) {
    if (!object.joinGroupId) {
      if (object.joinMode) throw new Error(`Shape ${object.id} cannot have an intersection mode without a group.`)
      continue
    }
    if (isHoleObject(object)) throw new Error(`Hole ${object.id} cannot be joined as a solid.`)
    if (joinModes.has(object.joinGroupId) && joinModes.get(object.joinGroupId) !== object.joinMode) {
      throw new Error(`Join ${object.joinGroupId} must use one combine mode.`)
    }
    joinModes.set(object.joinGroupId, object.joinMode)
    joinCounts.set(object.joinGroupId, (joinCounts.get(object.joinGroupId) ?? 0) + 1)
  }
  for (const [groupId, count] of joinCounts) {
    if (count < 2) throw new Error(`Join ${groupId} must contain at least two solids.`)
  }
  return objects
}

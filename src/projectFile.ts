import { MODEL_UNIT, type CadObject, type Vector3 } from './cadModel.ts'

const PROJECT_FORMAT = 'block-cad'
const PROJECT_VERSION = 2

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

function objectFromFile(value: unknown, index: number, version: number): CadObject {
  const data = record(value)
  const field = `objects[${index}]`
  if (!data || typeof data.id !== 'string' || !data.id.trim()) {
    throw new Error(`${field} must have a nonempty ID.`)
  }
  const base = {
    id: data.id,
    position: vector(data.position, `${field}.position`),
    rotation: vector(data.rotation, `${field}.rotation`),
    scale: vector(data.scale, `${field}.scale`),
  }
  const dimensions = record(data.dimensions)
  if (!dimensions) throw new Error(`${field}.dimensions is missing.`)

  switch (data.type) {
    case 'box':
      return { ...base, type: 'box', dimensions: {
        x: positiveNumber(dimensions.x, `${field}.dimensions.x`),
        y: positiveNumber(dimensions.y, `${field}.dimensions.y`),
        z: positiveNumber(dimensions.z, `${field}.dimensions.z`),
      } }
    case 'cylinder': {
      if (version === 2 && data.cutTargetId !== undefined &&
        (typeof data.cutTargetId !== 'string' || !data.cutTargetId.trim())) {
        throw new Error(`${field}.cutTargetId must be a nonempty ID.`)
      }
      return { ...base, type: 'cylinder', dimensions: {
        diameter: positiveNumber(dimensions.diameter, `${field}.dimensions.diameter`),
        height: positiveNumber(dimensions.height, `${field}.dimensions.height`),
      }, ...(version === 2 && data.cutTargetId ? { cutTargetId: data.cutTargetId as string } : {}) }
    }
    case 'sphere':
      return { ...base, type: 'sphere', dimensions: {
        diameter: positiveNumber(dimensions.diameter, `${field}.dimensions.diameter`),
      } }
    default:
      throw new Error(`${field} has an unsupported shape type.`)
  }
}

export function serializeProject(objects: CadObject[]): string {
  return JSON.stringify({ format: PROJECT_FORMAT, version: PROJECT_VERSION, units: MODEL_UNIT, objects }, null, 2) + '\n'
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
  if (project.version !== 1 && project.version !== PROJECT_VERSION) {
    throw new Error(`Unsupported project version: ${String(project.version)}.`)
  }
  if (project.units !== MODEL_UNIT) throw new Error(`Unsupported project units: ${String(project.units)}.`)
  if (!Array.isArray(project.objects)) throw new Error('The project objects must be a list.')

  const objects = project.objects.map((object, index) => objectFromFile(object, index, project.version as number))
  const ids = new Set(objects.map((object) => object.id))
  if (ids.size !== objects.length) throw new Error('The project contains duplicate object IDs.')
  for (const object of objects) {
    if (object.type === 'cylinder' && object.cutTargetId &&
      !objects.some((target) => target.id === object.cutTargetId && target.type === 'box')) {
      throw new Error(`Cylinder ${object.id} must cut an existing box.`)
    }
  }
  return objects
}

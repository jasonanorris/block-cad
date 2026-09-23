export type Vector3 = { x: number; y: number; z: number }

// One scene length unit equals one millimeter. Rotation values are radians.
export const MODEL_UNIT = 'mm' as const

type BaseObject = {
  id: string
  position: Vector3
  rotation: Vector3
  scale: Vector3
}

export type CadObject = BaseObject & (
  | { type: 'box'; dimensions: Vector3 }
  | { type: 'cylinder'; dimensions: { diameter: number; height: number } }
  | { type: 'sphere'; dimensions: { diameter: number } }
)

export type CadObjectType = CadObject['type']

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

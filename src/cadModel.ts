export type Vector3 = { x: number; y: number; z: number }

// One scene length unit equals one millimeter. Rotation values are radians.
export const MODEL_UNIT = 'mm' as const

export type CadObject = {
  id: string
  type: 'box'
  position: Vector3
  rotation: Vector3
  scale: Vector3
  dimensions: Vector3
}

export function createStarterBox(): CadObject {
  return {
    id: crypto.randomUUID(),
    type: 'box',
    position: { x: 0, y: 10, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    dimensions: { x: 20, y: 20, z: 20 },
  }
}

import { BufferGeometry, Float32BufferAttribute } from 'three'
import type { CadObject } from './cadModel'
import { regularPolygon } from './polygon'

// Shared indexed meshes keep preview, Boolean inputs, and exports identical.
export function basicShapeGeometry(object: Extract<CadObject, { type: 'cone' | 'wedge' | 'prism' }>): BufferGeometry {
  const vertices: number[] = []
  const indices: number[] = []
  if (object.type === 'wedge') {
    const { x, y, z } = object.dimensions
    vertices.push(-x / 2, -y / 2, -z / 2, x / 2, -y / 2, -z / 2, x / 2, y / 2, -z / 2,
      -x / 2, -y / 2, z / 2, x / 2, -y / 2, z / 2, x / 2, y / 2, z / 2)
    indices.push(0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4, 0, 3, 5, 0, 5, 2)
  } else {
    const sides = object.type === 'prism' ? object.sides : 32
    const points = regularPolygon(sides, object.dimensions.diameter / 2)
    const halfHeight = object.dimensions.height / 2
    for (const point of points) vertices.push(point.x, -halfHeight, point.y)
    if (object.type === 'cone') {
      vertices.push(0, halfHeight, 0, 0, -halfHeight, 0)
      for (let i = 0; i < sides; i++) {
        const j = (i + 1) % sides
        indices.push(sides, j, i, sides + 1, i, j)
      }
    } else {
      for (const point of points) vertices.push(point.x, halfHeight, point.y)
      for (let i = 1; i < sides - 1; i++) indices.push(0, i, i + 1, sides, sides + i + 1, sides + i)
      for (let i = 0; i < sides; i++) {
        const j = (i + 1) % sides
        indices.push(i, sides + i, sides + j, i, sides + j, j)
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

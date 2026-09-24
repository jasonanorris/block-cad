import { BufferGeometry, Float32BufferAttribute } from 'three'
import type { Manifold, ManifoldToplevel } from 'manifold-3d'

export const MAX_STL_TRIANGLES = 100_000
const FLOATS_PER_TRIANGLE = 9
const BYTES_PER_TRIANGLE = FLOATS_PER_TRIANGLE * 4

export function encodeStlMesh(positions: Float32Array): string {
  const bytes = new Uint8Array(positions.length * 4)
  const view = new DataView(bytes.buffer)
  for (let index = 0; index < positions.length; index++) view.setFloat32(index * 4, positions[index], true)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 16_384) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 16_384))
  }
  return btoa(binary)
}

export function decodeStlMesh(data: string): Float32Array {
  if (!data || data.length > MAX_STL_TRIANGLES * BYTES_PER_TRIANGLE * 4 / 3 + 4 ||
    data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    throw new Error('STL mesh data is invalid or too large.')
  }
  let binary: string
  try {
    binary = atob(data)
  } catch {
    throw new Error('STL mesh data is not valid base64.')
  }
  if (binary.length % BYTES_PER_TRIANGLE !== 0 || binary.length / BYTES_PER_TRIANGLE < 4 ||
    binary.length / BYTES_PER_TRIANGLE > MAX_STL_TRIANGLES) {
    throw new Error('STL mesh data must contain 4 to 100,000 complete triangles.')
  }
  const view = new DataView(new ArrayBuffer(binary.length))
  for (let index = 0; index < binary.length; index++) view.setUint8(index, binary.charCodeAt(index))
  const positions = new Float32Array(binary.length / 4)
  for (let index = 0; index < positions.length; index++) {
    const value = view.getFloat32(index * 4, true)
    if (!Number.isFinite(value)) throw new Error('STL mesh data contains a nonfinite coordinate.')
    positions[index] = value
  }
  return positions
}

export function stlMeshGeometry(data: string): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(decodeStlMesh(data), 3))
  geometry.computeVertexNormals()
  return geometry
}

export function stlMeshManifold(data: string, runtime: ManifoldToplevel): Manifold {
  const positions = decodeStlMesh(data)
  const indices = new Uint32Array(positions.length / 3)
  const vertices: number[] = []
  const vertexIds = new Map<string, number>()
  for (let index = 0; index < indices.length; index++) {
    const offset = index * 3
    const key = `${positions[offset]},${positions[offset + 1]},${positions[offset + 2]}`
    let id = vertexIds.get(key)
    if (id === undefined) {
      id = vertices.length / 3
      vertices.push(positions[offset], positions[offset + 1], positions[offset + 2])
      vertexIds.set(key, id)
    }
    indices[index] = id
  }

  const mesh = new runtime.Mesh({ numProp: 3, vertProperties: new Float32Array(vertices), triVerts: indices })
  const solid = runtime.Manifold.ofMesh(mesh)
  const status = solid.status()
  if (status !== 'NoError' || solid.volume() <= 0) {
    solid.delete()
    throw new Error(`STL must be a watertight solid (${status}).`)
  }
  return solid
}

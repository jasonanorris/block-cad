import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import type { BufferGeometry } from 'three'
import type { CadObject } from './cadModel'
import { loadManifold } from './manifoldRuntime'
import { encodeStlMesh, MAX_STL_TRIANGLES, stlMeshManifold } from './stlMesh'

const MAX_STL_FILE_BYTES = 15_000_000

export async function importStl(buffer: ArrayBuffer, filename: string, workplaneHeight: number, x = 0, z = 0): Promise<CadObject> {
  if (buffer.byteLength > MAX_STL_FILE_BYTES) throw new Error('STL files must be under 15 MB.')
  let geometry: BufferGeometry
  try {
    geometry = new STLLoader().parse(buffer)
  } catch {
    throw new Error('This is not a readable STL file.')
  }
  try {
    const attribute = geometry.getAttribute('position')
    const triangleCount = attribute ? attribute.count / 3 : 0
    if (!Number.isInteger(triangleCount) || triangleCount < 4 || triangleCount > MAX_STL_TRIANGLES) {
      throw new Error(`STL must contain 4 to ${MAX_STL_TRIANGLES.toLocaleString()} triangles.`)
    }
    const positions = new Float32Array(attribute.array as ArrayLike<number>)
    const min = [Infinity, Infinity, Infinity]
    const max = [-Infinity, -Infinity, -Infinity]
    for (let index = 0; index < positions.length; index++) {
      const axis = index % 3
      const value = positions[index]
      if (!Number.isFinite(value)) throw new Error('STL contains a nonfinite coordinate.')
      min[axis] = Math.min(min[axis], value)
      max[axis] = Math.max(max[axis], value)
    }
    const dimensions = { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] }
    if (Object.values(dimensions).some((value) => !Number.isFinite(value) || value <= 0)) {
      throw new Error('STL must have positive width, height, and depth.')
    }
    const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
    for (let index = 0; index < positions.length; index++) positions[index] -= center[index % 3]

    // STL facet winding is sometimes globally reversed. Normalize it before
    // validating the mesh, while preserving the same outward surface.
    let signedVolume = 0
    for (let offset = 0; offset < positions.length; offset += 9) {
      const [ax, ay, az, bx, by, bz, cx, cy, cz] = positions.subarray(offset, offset + 9)
      signedVolume += (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6
    }
    if (signedVolume < 0) {
      for (let offset = 0; offset < positions.length; offset += 9) {
        for (let axis = 0; axis < 3; axis++) {
          const second = positions[offset + 3 + axis]
          positions[offset + 3 + axis] = positions[offset + 6 + axis]
          positions[offset + 6 + axis] = second
        }
      }
    }

    const meshData = encodeStlMesh(positions)
    const runtime = await loadManifold()
    const solid = stlMeshManifold(meshData, runtime)
    solid.delete()
    return {
      id: crypto.randomUUID(),
      name: filename.replace(/\.stl$/i, '').trim().slice(0, 80) || 'Imported STL',
      type: 'stl',
      dimensions,
      meshData,
      position: { x, y: workplaneHeight + dimensions.y / 2, z },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    }
  } finally {
    geometry.dispose()
  }
}

import { BufferGeometry, BufferAttribute } from 'three'
import type { SolidBody } from './cadModel'

export type PreviewRequest = { sequence: number; body: SolidBody }
export type PreviewMesh = { positions: Float32Array; normals: Float32Array; indices: Uint32Array }
export type PreviewResponse = { sequence: number; mesh?: PreviewMesh; error?: string }

export function packPreview(geometry: BufferGeometry): PreviewMesh {
  return { positions: new Float32Array(geometry.getAttribute('position').array),
    normals: new Float32Array(geometry.getAttribute('normal').array),
    indices: new Uint32Array(geometry.getIndex()!.array) }
}
export function unpackPreview(mesh: PreviewMesh): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(mesh.positions, 3))
  geometry.setAttribute('normal', new BufferAttribute(mesh.normals, 3))
  geometry.setIndex(new BufferAttribute(mesh.indices, 1))
  return geometry
}

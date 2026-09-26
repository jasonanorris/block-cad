import type { Vector3 } from './cadModel'
import { decodeStlMesh } from './stlMesh'

export type EdgeOperation = 'fillet' | 'chamfer'
export type StoredEdge = { a: Vector3; b: Vector3 }
export type EdgeFeature = { id: string; operation: EdgeOperation; size: number; edges: StoredEdge[] }
export type EdgeHistory = { baseMeshData: string; features: EdgeFeature[] }
export const MAX_EDGE_FEATURES = 32
export const MAX_FEATURE_EDGES = 24

export function validateEdgeHistory(value: unknown, verifiedMeshes = new Set<string>()): EdgeHistory {
  const record = (v: unknown): Record<string, unknown> => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Invalid edge feature history.')
    return v as Record<string, unknown>
  }
  const point = (v: unknown): Vector3 => {
    const p = record(v)
    if (['x', 'y', 'z'].some((axis) => typeof p[axis] !== 'number' || !Number.isFinite(p[axis]))) throw new Error('Edge coordinates must be finite.')
    return { x: p.x as number, y: p.y as number, z: p.z as number }
  }
  const data = record(value)
  if (typeof data.baseMeshData !== 'string') throw new Error('Edge history needs its starting mesh.')
  if (!verifiedMeshes.has(data.baseMeshData)) { decodeStlMesh(data.baseMeshData); verifiedMeshes.add(data.baseMeshData) }
  if (!Array.isArray(data.features) || data.features.length > MAX_EDGE_FEATURES) throw new Error(`Edge history supports up to ${MAX_EDGE_FEATURES} features.`)
  const ids = new Set<string>()
  const features = data.features.map((item): EdgeFeature => {
    const f = record(item)
    if (typeof f.id !== 'string' || !f.id.trim() || f.id.length > 80 || ids.has(f.id)) throw new Error('Edge features need unique IDs.')
    ids.add(f.id)
    if (f.operation !== 'fillet' && f.operation !== 'chamfer') throw new Error('Unsupported edge operation.')
    if (typeof f.size !== 'number' || !Number.isFinite(f.size) || f.size < .01 || f.size > 10000) throw new Error('Edge size must be 0.01 to 10,000 mm.')
    if (!Array.isArray(f.edges) || !f.edges.length || f.edges.length > MAX_FEATURE_EDGES) throw new Error(`Select 1 to ${MAX_FEATURE_EDGES} edges per feature.`)
    const edges = f.edges.map((entry): StoredEdge => {
      const e = record(entry), a = point(e.a), b = point(e.b)
      if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-6) throw new Error('An edge needs distinct endpoints.')
      return { a, b }
    })
    return { id: f.id, operation: f.operation, size: f.size, edges }
  })
  return { baseMeshData: data.baseMeshData, features }
}

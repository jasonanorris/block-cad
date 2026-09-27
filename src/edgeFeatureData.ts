import { curveQuality, type CurveQuality } from './curveQuality'
import type { Vector3 } from './cadModel'
import { decodeStlMesh } from './stlMesh'

export type EdgeOperation = 'fillet' | 'chamfer'
export type StoredEdge = { a: Vector3; b: Vector3; key?: string; size?: number }
export type EdgeFeature = { id: string; operation: EdgeOperation; size: number; quality?: CurveQuality; edges: StoredEdge[] }
export type EdgeHistory = { baseMeshData: string; features: EdgeFeature[] }
export const MAX_EDGE_FEATURES = 32
export const MAX_FEATURE_EDGES = 24

export function validateEdgeHistory(value: unknown, verifiedMeshes = new Set<string>()): EdgeHistory {
  const record = (v: unknown): Record<string, unknown> => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Invalid edge feature history.')
    return v as Record<string, unknown>
  }
  const data = record(value)
  if (typeof data.baseMeshData !== 'string') throw new Error('Edge history needs its starting mesh.')
  if (!verifiedMeshes.has(data.baseMeshData)) { decodeStlMesh(data.baseMeshData); verifiedMeshes.add(data.baseMeshData) }
  const features = validateEdgeFeatures(data.features)
  return { baseMeshData: data.baseMeshData, features }
}

export function validateEdgeFeatures(value: unknown, advanced = false): EdgeFeature[] {
  const record = (v: unknown): Record<string, unknown> => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Invalid edge feature history.')
    return v as Record<string, unknown>
  }
  const point = (v: unknown): Vector3 => {
    const p = record(v)
    if (['x', 'y', 'z'].some((axis) => typeof p[axis] !== 'number' || !Number.isFinite(p[axis]))) throw new Error('Edge coordinates must be finite.')
    return { x: p.x as number, y: p.y as number, z: p.z as number }
  }
  if (!Array.isArray(value) || value.length > MAX_EDGE_FEATURES) throw new Error(`Edge history supports up to ${MAX_EDGE_FEATURES} features.`)
  const ids = new Set<string>()
  return value.map((item): EdgeFeature => {
    const f = record(item)
    if (typeof f.id !== 'string' || !f.id.trim() || f.id.length > 80 || ids.has(f.id)) throw new Error('Edge features need unique IDs.')
    ids.add(f.id)
    if (f.operation !== 'fillet' && f.operation !== 'chamfer') throw new Error('Unsupported edge operation.')
    if (typeof f.size !== 'number' || !Number.isFinite(f.size) || f.size < .01 || f.size > 10000) throw new Error('Edge size must be 0.01 to 10,000 mm.')
    if (!Array.isArray(f.edges) || !f.edges.length || f.edges.length > MAX_FEATURE_EDGES) throw new Error(`Select 1 to ${MAX_FEATURE_EDGES} edges per feature.`)
    const edges = f.edges.map((entry): StoredEdge => {
      const e = record(entry), a = point(e.a), b = point(e.b)
      if (!advanced && Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-6) throw new Error('An edge needs distinct endpoints.')
      if (advanced && (typeof e.key !== 'string' || !e.key || e.key.length > 1000)) throw new Error('Analytic edges need a geometric reference.')
      if (e.size !== undefined && (typeof e.size !== 'number' || !Number.isFinite(e.size) || e.size < .01 || e.size > 10000)) throw new Error('Edge overrides must be 0.01 to 10,000 mm.')
      return { a, b, ...(advanced ? { key: e.key as string, ...(e.size !== undefined ? { size: e.size as number } : {}) } : {}) }
    })
    return { id: f.id, operation: f.operation, size: f.size, ...(f.quality !== undefined ? { quality: curveQuality(f.quality) } : {}), edges }
  })
}

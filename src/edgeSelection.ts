import { Vector3 } from 'three'
import type { FeatureEdge } from './edgeFeatures'
import { MAX_FEATURE_EDGES } from './edgeFeatureData'
const v = (p: FeatureEdge['a']) => new Vector3(p.x, p.y, p.z)
const points = (edge: FeatureEdge) => edge.path ?? [edge.a, edge.b]
const near = (a: FeatureEdge['a'], b: FeatureEdge['a']) => v(a).distanceTo(v(b)) < 1e-5
export function edgeLength(edge: FeatureEdge) {
  const path = points(edge)
  return path.slice(1).reduce((sum, p, i) => sum + v(p).distanceTo(v(path[i])), 0)
}
// Verify the world-space samples still form a circle (nonuniform scales may not).
export function circularRadius(path: FeatureEdge['a'][]): number | undefined {
  if (path.length < 5) return
  const a = v(path[0]), u = v(path[Math.floor((path.length - 1) / 3)]).sub(a), w = v(path[Math.floor(2 * (path.length - 1) / 3)]).sub(a)
  const normal = u.clone().cross(w), denominator = 2 * normal.lengthSq()
  if (denominator < 1e-20) return
  const center = w.clone().cross(normal).multiplyScalar(u.lengthSq()).add(normal.clone().cross(u).multiplyScalar(w.lengthSq())).divideScalar(denominator).add(a)
  const radius = center.distanceTo(a), axis = normal.normalize(), tolerance = Math.max(1e-5, radius * 1e-4)
  if (!Number.isFinite(radius) || radius <= 0 || path.some(p => Math.abs(v(p).distanceTo(center) - radius) > tolerance || Math.abs(v(p).sub(center).dot(axis)) > tolerance)) return
  return radius
}
export type EdgeSelectionShortcut = 'chain' | 'length' | 'radius'
export function extendEdgeSelection(edges: FeatureEdge[], selected: number[], mode: EdgeSelectionShortcut): number[] {
  if (!selected.length) throw new Error('Select a seed edge first.')
  const chosen = new Set(selected)
  if (selected.some(i => !edges[i])) throw new Error('Select edges again.')
  if (mode === 'chain') {
    const queue = [...selected]
    for (const index of queue) for (const endpoint of [edges[index].a, edges[index].b]) {
      const incident = edges.flatMap((edge, i) => i !== index && (near(edge.a, endpoint) || near(edge.b, endpoint)) ? [i] : [])
      const tangent = (edge: FeatureEdge) => {
        const path = points(edge), atStart = near(path[0], endpoint)
        return v(atStart ? path[1] : path[path.length - 2]).sub(v(endpoint)).normalize()
      }
      const candidates = incident.length === 1 ? incident : incident.filter(i => tangent(edges[index]).dot(tangent(edges[i])) < -Math.cos(Math.PI / 36))
      if (candidates.length === 1 && !chosen.has(candidates[0])) { chosen.add(candidates[0]); queue.push(candidates[0]) }
    }
  } else {
    const value = (edge: FeatureEdge) => mode === 'length' ? edgeLength(edge) : edge.radius
    const seeds = selected.map(i => value(edges[i])).filter((n): n is number => n !== undefined)
    if (!seeds.length) throw new Error('Select a circular edge to match its radius. Straight edges and ellipses have no circular radius.')
    edges.forEach((edge, i) => { const n = value(edge); if (n !== undefined && seeds.some(seed => Math.abs(seed - n) <= Math.max(1e-4, seed * .005))) chosen.add(i) })
  }
  if (chosen.size > MAX_FEATURE_EDGES) throw new Error(`This would select ${chosen.size} edges; the limit is ${MAX_FEATURE_EDGES}. Select a smaller set manually.`)
  return [...chosen]
}

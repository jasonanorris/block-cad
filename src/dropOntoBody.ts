import { Vector3 } from 'three'
import { getSolidBodies, isHoleObject, type CadObject, type SolidBody } from './cadModel'
import { canPositionUnits, getPlacementUnits, placementGeometry } from './placement'

type Point = { x: number; z: number }
type Surface = { points: Point[]; minX: number; maxX: number; minZ: number; maxZ: number; a: number; b: number; c: number }
const cross = (a: Point, b: Point, p: Point) => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x)

async function surfaces(body: SolidBody): Promise<Surface[]> {
  const geometry = await placementGeometry(body)
  try {
    const positions = geometry.getAttribute('position'), indices = geometry.getIndex()
    const result: Surface[] = []
    const points = [new Vector3(), new Vector3(), new Vector3()]
    for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
      points.forEach((point, j) => point.fromBufferAttribute(positions, indices ? indices.getX(i + j) : i + j))
      if (points.some((point) => !point.toArray().every(Number.isFinite))) throw new Error('A body has invalid surface coordinates.')
      const [p, q, r] = points
      const det = cross(p, q, r)
      // Vertical faces have no footprint area. Their edges also belong to the
      // neighboring nonvertical triangles, which supply the limiting contact.
      if (Math.abs(det) < 1e-10) continue
      const a = ((q.y - p.y) * (r.z - p.z) - (r.y - p.y) * (q.z - p.z)) / det
      const b = ((q.x - p.x) * (r.y - p.y) - (r.x - p.x) * (q.y - p.y)) / det
      const projected = points.map(({ x, z }) => ({ x, z }))
      if (det < 0) projected.reverse()
      result.push({ points: projected, minX: Math.min(p.x, q.x, r.x), maxX: Math.max(p.x, q.x, r.x),
        minZ: Math.min(p.z, q.z, r.z), maxZ: Math.max(p.z, q.z, r.z), a, b, c: p.y - a * p.x - b * p.z })
    }
    if (!result.length) throw new Error('A body is empty or has no usable support surface.')
    return result
  } finally { geometry.dispose() }
}

function overlap(subject: Point[], clip: Point[]): Point[] {
  let polygon = subject
  for (let i = 0; i < 3 && polygon.length; i++) {
    const a = clip[i], b = clip[(i + 1) % 3]
    const input = polygon; polygon = []
    let previous = input.at(-1)!, previousSide = cross(a, b, previous)
    for (const current of input) {
      const side = cross(a, b, current)
      if ((side >= 0) !== (previousSide >= 0)) {
        const t = previousSide / (previousSide - side)
        polygon.push({ x: previous.x + t * (current.x - previous.x), z: previous.z + t * (current.z - previous.z) })
      }
      if (side >= 0) polygon.push(current)
      previous = current; previousSide = side
    }
  }
  return polygon
}

// The first contact when descending from above is the largest targetY-sourceY
// over all overlapping projected triangles. Each difference is affine, so its
// maximum is at a vertex of their intersection polygon (not just mesh vertices).
export async function dropOntoBody(objects: CadObject[], ids: Set<string>, targetId: string): Promise<CadObject[]> {
  const units = getPlacementUnits(objects, ids)
  if (!canPositionUnits(objects, units) || units.some((unit) => isHoleObject(unit.body.anchor))) {
    throw new Error('Select visible, unlocked solids to drop, including unlocked linked holes.')
  }
  const target = getSolidBodies(objects).find((body) => body.anchor.id === targetId)
  if (!target || target.members.some((member) => member.hidden)) throw new Error('Choose a visible target body.')
  const targetIds = new Set([...target.members, ...target.holes].map((object) => object.id))
  if (units.some((unit) => [...unit.ids].some((id) => targetIds.has(id)))) throw new Error('The target must be separate from the selected bodies and their holes.')
  const targetSurfaces = await surfaces(target)
  const moves = new Map<string, number>()
  let comparisons = 0
  for (const unit of units) {
    const sourceSurfaces = await surfaces(unit.body)
    if (comparisons + sourceSurfaces.length * targetSurfaces.length > 5_000_000) {
      throw new Error('These meshes are too detailed for surface drop. Use a simpler target or a face workplane.')
    }
    let delta = -Infinity
    for (const source of sourceSurfaces) {
      for (const surface of targetSurfaces) {
        comparisons++
        if (source.maxX < surface.minX || surface.maxX < source.minX || source.maxZ < surface.minZ || surface.maxZ < source.minZ) continue
        for (const point of overlap(source.points, surface.points)) {
          delta = Math.max(delta, (surface.a - source.a) * point.x + (surface.b - source.b) * point.z + surface.c - source.c)
        }
      }
      // Give the browser a chance to paint and process cancellation/model edits.
      if (comparisons % 200_000 < targetSurfaces.length) await new Promise((resolve) => setTimeout(resolve, 0))
    }
    if (!Number.isFinite(delta)) throw new Error('A selected body does not overlap the target in X/Z. Move it above the target first.')
    unit.ids.forEach((id) => moves.set(id, delta))
  }
  return objects.map((object) => moves.has(object.id) ? { ...object, position: {
    ...object.position, y: object.position.y + moves.get(object.id)!,
  } } : object)
}

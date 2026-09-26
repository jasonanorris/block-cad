import { Matrix4, Vector3 } from 'three'
import type { Manifold, Mat4 } from 'manifold-3d'
import { type CadObject, type Vector3 as Point, isHoleObject } from './cadModel'
import { canPositionUnits, getPlacementUnits } from './placement'
import { objectMatrix, readSolidManifold } from './booleanGeometry'
import { loadManifold } from './manifoldRuntime'
import { encodeStlMesh, stlMeshManifold, MAX_STL_TRIANGLES } from './stlMesh'

export type FeatureEdge = { a: Point; b: Point; normalA: Point; normalB: Point; angle: number; maxSize: number; maxRadius: number }
import { MAX_EDGE_FEATURES, MAX_FEATURE_EDGES, type EdgeHistory, type EdgeFeature, type StoredEdge, type EdgeOperation } from './edgeFeatureData'
export type { EdgeOperation } from './edgeFeatureData'
const v = (p: Point) => new Vector3(p.x, p.y, p.z)
const point = (p: Vector3): Point => ({ x: p.x, y: p.y, z: p.z })
const tolerance = 1e-5

function selectedUnit(objects: CadObject[], ids: string[]) {
  const units = getPlacementUnits(objects, new Set(ids))
  if (units.length !== 1 || !canPositionUnits(objects, units) || isHoleObject(units[0].body.anchor)) {
    throw new Error('Select one visible, unlocked solid body. Show and unlock its linked shapes too.')
  }
  return units[0]
}

// Recover planar faces from a closed finished mesh, omitting triangulation diagonals.
function solidEdges(solid: Manifold): FeatureEdge[] {
  const mesh = solid.getMesh()
  if (mesh.numTri > 5000) throw new Error('Edge tools currently support simple solids up to 5,000 triangles.')
  const vertices = Array.from({ length: mesh.numVert }, (_, i) => new Vector3(...Array.from({ length: 3 }, (_, j) => mesh.vertProperties[i * mesh.numProp + j]) as [number, number, number]))
  const faces: { normal: Vector3; offset: number; vertices: Set<number> }[] = []
  for (let i = 0; i < mesh.triVerts.length; i += 3) {
    const ids = Array.from(mesh.triVerts.slice(i, i + 3))
    const [a, b, c] = ids.map((id) => vertices[id])
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize(), offset = normal.dot(a)
    if (!normal.lengthSq()) continue
    let face = faces.find((f) => f.normal.dot(normal) > 1 - 1e-8 && Math.abs(f.offset - offset) < tolerance)
    if (!face) { face = { normal, offset, vertices: new Set() }; faces.push(face) }
    ids.forEach((id) => face!.vertices.add(id))
  }
  if (faces.length > 64 || faces.some((f) => vertices.some((p) => f.normal.dot(p) > f.offset + tolerance))) {
    throw new Error('This version supports convex solids with flat faces. Inside corners, curved edges, and concave or heavily faceted bodies are not supported.')
  }
  const edges: FeatureEdge[] = []
  for (let i = 0; i < faces.length; i++) for (let j = i + 1; j < faces.length; j++) {
    const f = faces[i], g = faces[j]
    // Interior dihedral angle. Exclude nearly flat facets and needle-like corners.
    const angle = Math.acos(Math.max(-1, Math.min(1, -f.normal.dot(g.normal))))
    const degrees = angle * 180 / Math.PI
    if (degrees < 15 - 1e-4 || degrees > 165 + 1e-4) continue
    const shared = vertices.filter((p) => Math.abs(f.normal.dot(p) - f.offset) < tolerance && Math.abs(g.normal.dot(p) - g.offset) < tolerance)
    if (shared.length < 2) continue
    const direction = f.normal.clone().cross(g.normal).normalize()
    shared.sort((a, b) => direction.dot(a) - direction.dot(b))
    const a = shared[0], b = shared.at(-1)!
    if (a.distanceTo(b) < .01) continue
    // Initial scope: square-ended straight edges. Curved/angled terminations
    // need corner blending and must not be silently approximated.
    if ([a, b].some((p) => faces.some((h) => h !== f && h !== g && Math.abs(h.normal.dot(p) - h.offset) < tolerance && Math.abs(h.normal.dot(direction)) < 1 - 1e-6))) continue
    // Measure clearance across the two adjacent planar faces. Unrelated
    // rounded surfaces must not shrink the limit to their tessellation size.
    const distances = [...f.vertices].map((id) => g.offset - g.normal.dot(vertices[id]))
      .concat([...g.vertices].map((id) => f.offset - f.normal.dot(vertices[id]))).filter((d) => d > tolerance)
    const maxSize = Math.min(...distances) / (2 * Math.sin(angle))
    const maxRadius = maxSize * Math.tan(angle / 2)
    if (Math.max(maxSize, maxRadius) >= .01) edges.push({ a: point(a), b: point(b), normalA: point(f.normal), normalB: point(g.normal), angle: degrees, maxSize, maxRadius })
  }
  if (!edges.length) throw new Error('No supported edges. Pick a simple convex solid with straight outside edges between planar faces at 15°–165°, with flat, square ends, such as a wedge or prism.')
  return edges
}

function historyObject(objects: CadObject[], ids: string[]) {
  const unit = selectedUnit(objects, ids), object = unit.body.anchor
  if (unit.body.members.some((member) => member.type === 'stl' && member.edgeHistory) && (unit.body.members.length !== 1 || unit.body.holes.length)) throw new Error('Separate this body and remove its later linked cuts before editing or adding edge features. Its existing history is preserved.')
  if (object.type !== 'stl' || !object.edgeHistory) return null
  return object
}
const sameEdge = (a: StoredEdge, b: StoredEdge) =>
  (v(a.a).distanceTo(v(b.a)) < tolerance && v(a.b).distanceTo(v(b.b)) < tolerance) ||
  (v(a.a).distanceTo(v(b.b)) < tolerance && v(a.b).distanceTo(v(b.a)) < tolerance)
const transformEdge = (edge: StoredEdge, matrix: Matrix4): StoredEdge => ({ a: point(v(edge.a).applyMatrix4(matrix)), b: point(v(edge.b).applyMatrix4(matrix)) })

export async function findFeatureEdges(objects: CadObject[], ids: string[]) {
  const editable = historyObject(objects, ids)
  const unit = selectedUnit(objects, ids), runtime = await loadManifold()
  return readSolidManifold(unit.body, runtime, (solid) => {
    if (editable) return solidEdges(solid).map((edge) => ({ ...edge, ...transformEdge(edge, objectMatrix(editable)) }))
    const world = solid.transform(objectMatrix(unit.body.anchor).elements as Mat4)
    try { return solidEdges(world) } finally { world.delete() }
  })
}

function encodeSolid(solid: Manifold, center = [0, 0, 0]) {
  const mesh = solid.getMesh()
  if (mesh.numTri > MAX_STL_TRIANGLES) throw new Error('The result exceeds the mesh triangle limit.')
  const positions = new Float32Array(mesh.triVerts.length * 3)
  for (let i = 0; i < mesh.triVerts.length; i++) for (let j = 0; j < 3; j++) positions[i * 3 + j] = mesh.vertProperties[mesh.triVerts[i] * mesh.numProp + j] - center[j]
  return encodeStlMesh(positions)
}

// All edges in a feature are resolved against the same input. Reject meeting or
// overlapping cuts instead of presenting a Boolean intersection as a corner blend.
function applyFeature(solid: Manifold, feature: EdgeFeature, runtime: Awaited<ReturnType<typeof loadManifold>>): Manifold {
  if (!['fillet', 'chamfer'].includes(feature.operation) || !Number.isFinite(feature.size) || feature.size < .01 || feature.size > 10000) throw new Error('Enter a radius or distance from 0.01 to 10,000 mm.')
  if (!feature.edges.length || feature.edges.length > MAX_FEATURE_EDGES) throw new Error(`Select 1 to ${MAX_FEATURE_EDGES} edges.`)
  const available = solidEdges(solid)
  const edges = feature.edges.map((edge) => {
    const current = available.find((candidate) => sameEdge(candidate, edge))
    if (!current) throw new Error('An edge changed or is unavailable. Remove dependent later features first, or pick edges again.')
    const limit = feature.operation === 'fillet' ? current.maxRadius : current.maxSize
    if (feature.size > limit + tolerance) throw new Error(`Use a ${feature.operation === 'fillet' ? 'radius' : 'distance'} no larger than ${Number(limit.toFixed(4))} mm for these edges.`)
    return current
  })
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    if ([edges[i].a, edges[i].b].some((a) => [edges[j].a, edges[j].b].some((b) => v(a).distanceTo(v(b)) < tolerance))) {
      throw new Error('Choose separate edges that do not meet. Shared corners need corner blending, which is not supported yet.')
    }
  }
  const allocated: Manifold[] = [], removals: Manifold[] = []
  const track = (s: Manifold) => { allocated.push(s); return s }
  try {
    let result = solid
    for (const current of edges) {
      const { size, operation } = feature
      const origin = v(current.a), u = v(current.normalA).negate(), w = v(current.b).sub(origin).normalize(), y = w.clone().cross(u)
      const length = v(current.b).distanceTo(origin), pad = Math.max(1, length * .01)
      const matrix = new Matrix4().makeBasis(u, y, w).setPosition(origin)
      const angle = current.angle * Math.PI / 180
      // A radius r touches each adjoining face at r*cot(angle/2) from the edge.
      // Chamfer distances are measured along the faces, not normal to them.
      const distance = operation === 'fillet' ? size / Math.tan(angle / 2) : size
      const tangentB: [number, number] = [distance * Math.sin(angle), distance * Math.cos(angle)]
      const tangentA: [number, number] = [0, distance]
      let profile: [number, number][] = [[0, 0], tangentB, tangentA]
      if (operation === 'fillet') {
        const sweep = Math.PI - angle, segments = Math.max(2, Math.ceil(sweep / (Math.PI / 48)))
        const arc = Array.from({ length: segments + 1 }, (_, i): [number, number] => {
          if (i === 0) return tangentB
          if (i === segments) return tangentA
          const t = 2 * Math.PI - angle - sweep * i / segments
          return [size + size * Math.cos(t), distance + size * Math.sin(t)]
        })
        profile = [[0, 0], ...arc]
      }
      const section = new runtime.CrossSection([profile])
      let cutter: Manifold
      try { cutter = track(section.extrude(length + 2 * pad)) } finally { section.delete() }
      cutter = track(cutter.translate([0, 0, -pad]))
      const transformed = track(cutter.transform(matrix.elements as Mat4))
      const removal = track(solid.intersect(transformed))
      for (const previous of removals) {
        const overlap = track(previous.intersect(removal))
        if (overlap.volume() > 1e-8) throw new Error('These edge cuts overlap. Use a smaller size or select separate edges.')
      }
      removals.push(removal)
      result = track(result.subtract(transformed))
    }
    if (result.status() !== 'NoError' || result.isEmpty() || result.volume() <= 0 || result.volume() >= solid.volume() - 1e-8) throw new Error('These edges could not be modified safely. Try a smaller size.')
    // Return ownership of the final result; release every intermediate.
    allocated.splice(allocated.indexOf(result), 1)
    return result
  } finally { allocated.reverse().forEach((s) => s.delete()) }
}

async function rebuild(object: Extract<CadObject, { type: 'stl' }>, history: EdgeHistory) {
  const runtime = await loadManifold()
  let result = stlMeshManifold(history.baseMeshData, runtime)
  try {
    for (let i = 0; i < history.features.length; i++) {
      let next: Manifold
      try { next = applyFeature(result, history.features[i], runtime) }
      catch (error) { throw new Error(`Feature ${i + 1}: ${error instanceof Error ? error.message : 'Could not rebuild.'}`) }
      result.delete(); result = next
    }
    const bounds = result.boundingBox()
    return { ...object, meshData: encodeSolid(result), edgeHistory: history,
      dimensions: { x: bounds.max[0] - bounds.min[0], y: bounds.max[1] - bounds.min[1], z: bounds.max[2] - bounds.min[2] } }
  } finally { result.delete() }
}

export async function previewEdgeFeature(objects: CadObject[], ids: string[], picked: FeatureEdge | FeatureEdge[], operation: EdgeOperation, size: number) {
  const edges = Array.isArray(picked) ? picked : [picked]
  const editable = historyObject(objects, ids), unit = selectedUnit(objects, ids)
  let object: Extract<CadObject, { type: 'stl' }>, history: EdgeHistory, localEdges: StoredEdge[]
  if (editable) {
    object = editable; history = editable.edgeHistory!
    localEdges = edges.map((edge) => transformEdge(edge, objectMatrix(editable).invert()))
  } else {
    const runtime = await loadManifold()
    object = readSolidManifold(unit.body, runtime, (solid) => {
      const world = solid.transform(objectMatrix(unit.body.anchor).elements as Mat4)
      try {
        const bounds = world.boundingBox(), center = bounds.min.map((n, i) => (n + bounds.max[i]) / 2)
        return { id: crypto.randomUUID(), type: 'stl', name: `${(unit.body.anchor.name || unit.body.anchor.type).slice(0, 60)} · ${operation}`,
          ...(unit.body.anchor.color ? { color: unit.body.anchor.color } : {}), meshData: encodeSolid(world, center),
          dimensions: { x: bounds.max[0] - bounds.min[0], y: bounds.max[1] - bounds.min[1], z: bounds.max[2] - bounds.min[2] },
          position: { x: center[0], y: center[1], z: center[2] }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } }
      } finally { world.delete() }
    })
    history = { baseMeshData: object.meshData, features: [] }
    localEdges = edges.map((edge) => transformEdge(edge, objectMatrix(object).invert()))
  }
  if (history.features.length >= MAX_EDGE_FEATURES) throw new Error(`A body supports up to ${MAX_EDGE_FEATURES} edge features.`)
  const feature: EdgeFeature = { id: crypto.randomUUID(), operation, size, edges: localEdges }
  return { object: await rebuild(object, { ...history, features: [...history.features, feature] }), replacedIds: [...unit.ids] }
}

export async function editEdgeFeature(objects: CadObject[], ids: string[], featureId: string, change: { operation: EdgeOperation; size: number } | null) {
  const object = historyObject(objects, ids)
  if (!object) throw new Error('Select a body with editable edge features.')
  if (!object.edgeHistory!.features.some((feature) => feature.id === featureId)) throw new Error('This feature no longer exists.')
  const features = object.edgeHistory!.features.flatMap((feature) => feature.id !== featureId ? [feature] : change ? [{ ...feature, ...change }] : [])
  return { object: await rebuild(object, { ...object.edgeHistory!, features }), replacedIds: [object.id] }
}

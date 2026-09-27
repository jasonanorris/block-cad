import { CURVE_QUALITIES, curveQuality, type CurveQuality } from './curveQuality'
import { Matrix4, Vector3 } from 'three'
import type { Manifold, Mat4 } from 'manifold-3d'
import { type CadObject, type Vector3 as Point, isHoleObject } from './cadModel'
import { canPositionUnits, getPlacementUnits } from './placement'
import { objectMatrix, readSolidManifold } from './booleanGeometry'
import { loadManifold } from './manifoldRuntime'
import { encodeStlMesh, stlMeshManifold, MAX_STL_TRIANGLES } from './stlMesh'

export type FeatureEdge = { a: Point; b: Point; normalA: Point; normalB: Point; angle: number; maxSize: number; maxRadius: number; key?: string; path?: Point[]; size?: number; curveType?: 'straight' | 'curved'; edgeType?: 'inside' | 'outside' | 'transition' }
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
function solidEdges(solid: Manifold, blended = false): FeatureEdge[] {
  const mesh = solid.getMesh()
  if (mesh.numTri > 5000) throw new Error('Edge tools currently support simple solids up to 5,000 triangles.')
  const vertices = Array.from({ length: mesh.numVert }, (_, i) => new Vector3(...Array.from({ length: 3 }, (_, j) => mesh.vertProperties[i * mesh.numProp + j]) as [number, number, number]))
  const faces: { id: number; normal: Vector3; offset: number; vertices: Set<number> }[] = []
  const triangleEdges = new Map<string, number>(), adjacent = new Set<string>()
  for (let i = 0; i < mesh.triVerts.length; i += 3) {
    const ids = Array.from(mesh.triVerts.slice(i, i + 3))
    const [a, b, c] = ids.map((id) => vertices[id])
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize(), offset = normal.dot(a)
    if (!normal.lengthSq()) continue
    let face = faces.find((f) => f.normal.dot(normal) > 1 - 1e-8 && Math.abs(f.offset - offset) < tolerance)
    if (!face) { face = { id: faces.length, normal, offset, vertices: new Set() }; faces.push(face) }
    ids.forEach((id) => face!.vertices.add(id))
    for (let j = 0; j < 3; j++) {
      const a = ids[j], b = ids[(j + 1) % 3], key = `${Math.min(a, b)},${Math.max(a, b)}`
      const other = triangleEdges.get(key)
      if (other === undefined) triangleEdges.set(key, face.id)
      else if (other !== face.id) adjacent.add(`${Math.min(other, face.id)},${Math.max(other, face.id)}`)
    }
  }
  const supporting = faces.map((f) => !vertices.some((p) => f.normal.dot(p) > f.offset + tolerance))
  if (!blended && (faces.length > 64 || supporting.some((supported) => !supported))) {
    throw new Error('This version supports convex solids with flat faces. Inside corners, curved edges, and concave or heavily faceted bodies are not supported.')
  }
  const edges: FeatureEdge[] = []
  // Only actual neighboring faces can form a selectable edge. Rounded patches
  // may contain many facets and tiny nonconvex seams from tessellation.
  const pairs = [...adjacent].map((key) => key.split(',').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1])
  for (const [i, j] of pairs) {
    if (!supporting[i] || !supporting[j]) continue
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
  if ([...unit.body.members, ...unit.body.holes].some(member => member.type === 'stl' && member.analyticHistory)) throw new Error('Use Advanced CAD for bodies with analytic feature history.')
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
    if (editable) return solidEdges(solid, true).map((edge) => ({ ...edge, ...transformEdge(edge, objectMatrix(editable)) }))
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

// A two-edge corner keeps the third edge sharp. This variable-radius patch
// meets both cylindrical fillets tangentially and fades into the two side faces.
function twoEdgeCorner(radius: number, steps: number, runtime: Awaited<ReturnType<typeof loadManifold>>) {
  const pad = Math.max(1, radius * .01)
  const samples = [-pad, ...Array.from({ length: steps + 1 }, (_, i) => radius * (1 - Math.cos(i * Math.PI / (2 * steps))))]
  const count = samples.length, vertices: number[] = [], triangles: number[] = []
  for (const zLayer of [0, 1]) for (const y of samples) for (const x of samples) {
    const sx = Math.sqrt(Math.max(0, 1 - (1 - Math.max(0, x) / radius) ** 2))
    const sy = Math.sqrt(Math.max(0, 1 - (1 - Math.max(0, y) / radius) ** 2))
    vertices.push(x, y, zLayer ? radius * (1 - sx * sy) : -pad)
  }
  const layer = count * count
  for (let y = 0; y < count - 1; y++) for (let x = 0; x < count - 1; x++) {
    const a = y * count + x, b = a + 1, c = b + count, d = a + count
    triangles.push(a, c, b, a, d, c, a + layer, b + layer, c + layer, a + layer, c + layer, d + layer)
  }
  const perimeter = [...Array.from({ length: count }, (_, x) => x),
    ...Array.from({ length: count - 1 }, (_, y) => (y + 1) * count + count - 1),
    ...Array.from({ length: count - 1 }, (_, x) => layer - 2 - x),
    ...Array.from({ length: count - 2 }, (_, y) => (count - 2 - y) * count)]
  for (let i = 0; i < perimeter.length; i++) {
    const a = perimeter[i], b = perimeter[(i + 1) % perimeter.length]
    triangles.push(a, b, b + layer, a, b + layer, a + layer)
  }
  return runtime.Manifold.ofMesh(new runtime.Mesh({ numProp: 3, vertProperties: new Float32Array(vertices), triVerts: new Uint32Array(triangles) }))
}

// Resolve each edge against the same input. Shared chamfers meet at sharp miters;
// two perpendicular fillets receive a tangent patch; three receive a sphere.
function applyFeature(solid: Manifold, feature: EdgeFeature, runtime: Awaited<ReturnType<typeof loadManifold>>, blended = false): Manifold {
  const quality = CURVE_QUALITIES[curveQuality(feature.quality)]
  if (!['fillet', 'chamfer'].includes(feature.operation) || !Number.isFinite(feature.size) || feature.size < .01 || feature.size > 10000) throw new Error('Enter a radius or distance from 0.01 to 10,000 mm.')
  if (!feature.edges.length || feature.edges.length > MAX_FEATURE_EDGES) throw new Error(`Select 1 to ${MAX_FEATURE_EDGES} edges.`)
  const available = solidEdges(solid, blended)
  const edges = feature.edges.map((edge) => {
    const current = available.find((candidate) => sameEdge(candidate, edge))
    if (!current) throw new Error('An edge changed or is unavailable. Remove dependent later features first, or pick edges again.')
    const limit = feature.operation === 'fillet' ? current.maxRadius : current.maxSize
    if (feature.size > limit + tolerance) throw new Error(`Use a ${feature.operation === 'fillet' ? 'radius' : 'distance'} no larger than ${Number(limit.toFixed(4))} mm for these edges.`)
    return current
  })
  const sharesCorner = (a: FeatureEdge, b: FeatureEdge) => [a.a, a.b].some((p) => [b.a, b.b].some((q) => v(p).distanceTo(v(q)) < tolerance))
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    if (sameEdge(edges[i], edges[j])) throw new Error('Select each edge only once.')
  }
  const corners: { origin: Vector3; axes: Vector3[]; paired: boolean }[] = []
  if (feature.operation === 'fillet') {
    const vertices: Point[] = []
    edges.forEach((edge) => [edge.a, edge.b].forEach((p) => { if (!vertices.some((q) => v(p).distanceTo(v(q)) < tolerance)) vertices.push(p) }))
    for (const p of vertices) {
      const incident = edges.filter((edge) => [edge.a, edge.b].some((q) => v(p).distanceTo(v(q)) < tolerance))
      if (incident.length < 2) continue
      const axes = incident.map((edge) => v(v(p).distanceTo(v(edge.a)) < tolerance ? edge.b : edge.a).sub(v(p)).normalize())
      if (incident.length > 3 || incident.some((edge) => Math.abs(edge.angle - 90) > 1e-4) ||
        axes.some((axis, i) => axes.slice(i + 1).some((other) => Math.abs(axis.dot(other)) > 1e-6))) {
        throw new Error('Shared fillet corners require two or three perpendicular edges with 90° faces in the same feature.')
      }
      const paired = incident.length === 2
      if (paired) {
        const normalsA = [v(incident[0].normalA), v(incident[0].normalB)]
        const normalsB = [v(incident[1].normalA), v(incident[1].normalB)]
        const common = normalsA.find((normal) => normalsB.some((other) => normal.dot(other) > 1 - 1e-6))
        if (!common) throw new Error('The two fillets must share a planar face.')
        axes.push(common.clone().negate())
      }
      corners.push({ origin: v(p), axes, paired })
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
        const sweep = Math.PI - angle, segments = Math.max(2, Math.ceil(sweep / (Math.PI / (2 * quality.arcSteps))))
        const arc = Array.from({ length: segments + 1 }, (_, i): [number, number] => {
          if (i === 0) return tangentB
          if (i === segments) return tangentA
          const t = 2 * Math.PI - angle - sweep * i / segments
          return [size + size * Math.cos(t), distance + size * Math.sin(t)]
        })
        profile = [[0, 0], ...arc]
      }
      // Extend the cutter outside both adjoining faces. Coincident cutter walls
      // can leave thin remnants after Float32 mesh round trips on angled faces.
      // Keep the chamfer segment / fillet arc unchanged inside the solid.
      const outwardB: [number, number] = [Math.cos(angle), -Math.sin(angle)]
      const outerCorner: [number, number] = [-pad, -pad * Math.sin(angle) / (1 - Math.cos(angle))]
      profile = [outerCorner,
        [tangentB[0] + pad * outwardB[0], tangentB[1] + pad * outwardB[1]],
        ...profile.slice(1), [tangentA[0] - pad, tangentA[1]]]
      const section = new runtime.CrossSection([profile])
      let cutter: Manifold
      try { cutter = track(section.extrude(length + 2 * pad)) } finally { section.delete() }
      cutter = track(cutter.translate([0, 0, -pad]))
      const transformed = track(cutter.transform(matrix.elements as Mat4))
      const removal = track(solid.intersect(transformed))
      for (let i = 0; i < removals.length; i++) {
        if (sharesCorner(current, edges[i])) continue
        const overlap = track(removals[i].intersect(removal))
        if (overlap.volume() > 1e-8) throw new Error('These edge cuts overlap. Use a smaller size or select separate edges.')
      }
      removals.push(removal)
      result = track(result.subtract(transformed))
    }
    for (const corner of corners) {
      const radius = feature.size
      // Replace the intersection ridge with a tangent corner patch. For two
      // edges, leave the third edge sharp; for three, use a spherical octant.
      const frame = new Matrix4().makeBasis(...corner.axes as [Vector3, Vector3, Vector3]).setPosition(corner.origin)
      let patch: Manifold
      if (corner.paired) patch = track(twoEdgeCorner(radius, quality.cornerSteps, runtime))
      else {
        const cube = track(runtime.Manifold.cube([radius, radius, radius]))
        const sphere = track(runtime.Manifold.sphere(radius, quality.sphereSegments))
        const centered = track(sphere.translate([radius, radius, radius]))
        patch = track(cube.subtract(centered))
      }
      const worldPatch = track(patch.transform(frame.elements as Mat4))
      result = track(result.subtract(worldPatch))
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
      try { next = applyFeature(result, history.features[i], runtime, i > 0) }
      catch (error) { throw new Error(`Feature ${i + 1}: ${error instanceof Error ? error.message : 'Could not rebuild.'}`) }
      result.delete(); result = next
    }
    const bounds = result.boundingBox()
    return { ...object, meshData: encodeSolid(result), edgeHistory: history,
      dimensions: { x: bounds.max[0] - bounds.min[0], y: bounds.max[1] - bounds.min[1], z: bounds.max[2] - bounds.min[2] } }
  } finally { result.delete() }
}

export async function previewEdgeFeature(objects: CadObject[], ids: string[], picked: FeatureEdge | FeatureEdge[], operation: EdgeOperation, size: number, quality: CurveQuality = 'fine') {
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
  const feature: EdgeFeature = { id: crypto.randomUUID(), operation, size, quality: curveQuality(quality), edges: localEdges }
  return { object: await rebuild(object, { ...history, features: [...history.features, feature] }), replacedIds: [...unit.ids] }
}

export async function editEdgeFeature(objects: CadObject[], ids: string[], featureId: string, change: { operation: EdgeOperation; size: number; quality?: CurveQuality } | null) {
  const object = historyObject(objects, ids)
  if (!object) throw new Error('Select a body with editable edge features.')
  if (!object.edgeHistory!.features.some((feature) => feature.id === featureId)) throw new Error('This feature no longer exists.')
  const features = object.edgeHistory!.features.flatMap((feature) => feature.id !== featureId ? [feature] : change ? [{ ...feature, ...change }] : [])
  return { object: await rebuild(object, { ...object.edgeHistory!, features }), replacedIds: [object.id] }
}

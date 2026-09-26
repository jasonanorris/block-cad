import { Matrix4, Vector3 } from 'three'
import type { Manifold, Mat4 } from 'manifold-3d'
import { type CadObject, type Vector3 as Point, isHoleObject } from './cadModel'
import { canPositionUnits, getPlacementUnits } from './placement'
import { objectMatrix, readSolidManifold } from './booleanGeometry'
import { loadManifold } from './manifoldRuntime'
import { encodeStlMesh, MAX_STL_TRIANGLES } from './stlMesh'

export type FeatureEdge = { a: Point; b: Point; normalA: Point; normalB: Point; maxSize: number }
export type EdgeOperation = 'fillet' | 'chamfer'
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
    if (Math.abs(f.normal.dot(g.normal)) > 1e-6) continue
    const shared = vertices.filter((p) => Math.abs(f.normal.dot(p) - f.offset) < tolerance && Math.abs(g.normal.dot(p) - g.offset) < tolerance)
    if (shared.length < 2) continue
    const direction = f.normal.clone().cross(g.normal)
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
    const maxSize = Math.min(...distances) / 2
    if (maxSize >= .01) edges.push({ a: point(a), b: point(b), normalA: point(f.normal), normalB: point(g.normal), maxSize })
  }
  if (!edges.length) throw new Error('No supported edges. Pick a simple convex solid with straight 90° outside edges and flat, square ends, such as a box.')
  return edges
}

export async function findFeatureEdges(objects: CadObject[], ids: string[]) {
  const unit = selectedUnit(objects, ids), runtime = await loadManifold()
  return readSolidManifold(unit.body, runtime, (solid) => {
    const world = solid.transform(objectMatrix(unit.body.anchor).elements as Mat4)
    try { return solidEdges(world) } finally { world.delete() }
  })
}

export async function previewEdgeFeature(objects: CadObject[], ids: string[], edge: FeatureEdge, operation: EdgeOperation, size: number) {
  if (!['fillet', 'chamfer'].includes(operation) || !Number.isFinite(size) || size < .01) throw new Error('Enter a radius or distance of at least 0.01 mm.')
  const unit = selectedUnit(objects, ids), runtime = await loadManifold()
  return readSolidManifold(unit.body, runtime, (solid) => {
    const allocated: Manifold[] = []
    const track = (s: Manifold) => { allocated.push(s); return s }
    try {
      const world = track(solid.transform(objectMatrix(unit.body.anchor).elements as Mat4))
      const current = solidEdges(world).find((e) => v(e.a).distanceTo(v(edge.a)) < tolerance && v(e.b).distanceTo(v(edge.b)) < tolerance)
      if (!current) throw new Error('The edge changed. Pick it again.')
      if (size > current.maxSize + tolerance) throw new Error(`Use a size no larger than ${Number(current.maxSize.toFixed(4))} mm for this edge.`)
      const origin = v(current.a), u = v(current.normalA).negate(), w = v(current.b).sub(origin).normalize(), y = w.clone().cross(u)
      // a→b follows normalA × normalB, so this basis points inward on both faces.
      const length = v(current.b).distanceTo(origin), pad = Math.max(1, length * .01)
      const matrix = new Matrix4().makeBasis(u, y, w).setPosition(origin)
      let cutter: Manifold
      if (operation === 'chamfer') {
        const section = new runtime.CrossSection([[[-pad, -pad], [size + pad, -pad], [-pad, size + pad]]])
        try { cutter = track(section.extrude(length + 2 * pad)) } finally { section.delete() }
        cutter = track(cutter.translate([0, 0, -pad]))
      } else {
        const block = track(runtime.Manifold.cube([size + pad, size + pad, length + 2 * pad]))
        const shifted = track(block.translate([-pad, -pad, -pad]))
        const cylinder = track(runtime.Manifold.cylinder(length + 2 * pad, size, size, 96))
        const round = track(cylinder.translate([size, size, -pad]))
        cutter = track(shifted.subtract(round))
      }
      const transformed = track(cutter.transform(matrix.elements as Mat4))
      const result = track(world.subtract(transformed))
      if (result.status() !== 'NoError' || result.isEmpty() || result.volume() <= 0 || result.volume() >= world.volume() - 1e-8) throw new Error('This edge could not be modified safely. Try a smaller size.')
      const mesh = result.getMesh()
      if (mesh.numTri > MAX_STL_TRIANGLES) throw new Error('The result exceeds the mesh triangle limit.')
      const bounds = result.boundingBox(), center = bounds.min.map((n, i) => (n + bounds.max[i]) / 2)
      const positions = new Float32Array(mesh.triVerts.length * 3)
      for (let i = 0; i < mesh.triVerts.length; i++) for (let j = 0; j < 3; j++) positions[i * 3 + j] = mesh.vertProperties[mesh.triVerts[i] * mesh.numProp + j] - center[j]
      const object: CadObject = { id: crypto.randomUUID(), type: 'stl', name: `${(unit.body.anchor.name || unit.body.anchor.type).slice(0, 60)} · ${operation}`,
        ...(unit.body.anchor.color ? { color: unit.body.anchor.color } : {}), meshData: encodeStlMesh(positions),
        dimensions: { x: bounds.max[0] - bounds.min[0], y: bounds.max[1] - bounds.min[1], z: bounds.max[2] - bounds.min[2] },
        position: { x: center[0], y: center[1], z: center[2] }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } }
      return { object, replacedIds: [...unit.ids] }
    } finally { allocated.reverse().forEach((s) => s.delete()) }
  })
}

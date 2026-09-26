import { EdgeBuildError } from './edgeDiagnostics'
import { Matrix4, Vector3 } from 'three'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import type { TopoDS_Shape, TopoDS_Edge, TopAbs_ShapeEnum, ChFi3d_FilletShape } from 'opencascade.js/dist/opencascade.full.js'
import type { CadKernel } from './occtRuntime'
import type { CadObject, Vector3 as Point } from './cadModel'
import type { EdgeFeature } from './edgeFeatureData'
import { customProfile, validateCustomParameters } from './customShapes'
import { regularPolygon } from './polygon'
import { encodeStlMesh, MAX_STL_TRIANGLES } from './stlMesh'

export class KernelScope {
  private values: { delete(): void }[] = []
  keep<T extends { delete(): void }>(value: T): T { this.values.push(value); return value }
  dispose() { this.values.reverse().forEach(value => value.delete()) }
}
export function kernelTransform(oc: CadKernel, scope: KernelScope, shape: TopoDS_Shape, matrix: Matrix4) {
  if (matrix.equals(new Matrix4())) return shape
  const e = matrix.elements, sx = Math.hypot(e[0], e[1], e[2]), sy = Math.hypot(e[4], e[5], e[6]), sz = Math.hypot(e[8], e[9], e[10])
  if (Math.abs(sx - sy) < 1e-8 && Math.abs(sx - sz) < 1e-8) {
    const tr = scope.keep(new oc.gp_Trsf_1())
    tr.SetValues(e[0], e[4], e[8], e[12], e[1], e[5], e[9], e[13], e[2], e[6], e[10], e[14])
    return scope.keep(scope.keep(new oc.BRepBuilderAPI_Transform_2(shape, tr, true)).Shape())
  }
  const tr = scope.keep(new oc.gp_GTrsf_1())
  for (let row = 1; row <= 3; row++) for (let col = 1; col <= 4; col++) tr.SetValue(row, col, matrix.elements[(col - 1) * 4 + row - 1])
  tr.SetForm()
  return scope.keep(scope.keep(new oc.BRepBuilderAPI_GTransform_2(shape, tr, true)).Shape())
}
export function kernelPrimitive(oc: CadKernel, scope: KernelScope, object: CadObject): TopoDS_Shape {
  const point = (x: number, y: number, z: number) => scope.keep(new oc.gp_Pnt_3(x, y, z))
  if (object.type === 'box') {
    const { x, y, z } = object.dimensions
    return scope.keep(scope.keep(new oc.BRepPrimAPI_MakeBox_3(point(-x / 2, -y / 2, -z / 2), x, y, z)).Shape())
  }
  if (object.type === 'custom') return kernelCustom(oc, scope, object)
  if (object.type === 'sphere') return scope.keep(scope.keep(new oc.BRepPrimAPI_MakeSphere_1(object.dimensions.diameter / 2)).Shape())
  if (object.type === 'prism' || object.type === 'wedge') {
    const polygon = scope.keep(new oc.BRepBuilderAPI_MakePolygon_1())
    let points: Point[], direction: Point
    if (object.type === 'prism') {
      points = regularPolygon(object.sides, object.dimensions.diameter / 2).map(p => ({ x: p.x, y: -object.dimensions.height / 2, z: p.y }))
      direction = { x: 0, y: object.dimensions.height, z: 0 }
    } else {
      const { x, y, z } = object.dimensions
      points = [{ x: -x / 2, y: -y / 2, z: -z / 2 }, { x: x / 2, y: -y / 2, z: -z / 2 }, { x: x / 2, y: y / 2, z: -z / 2 }]
      direction = { x: 0, y: 0, z }
    }
    points.forEach(p => polygon.Add_1(point(p.x, p.y, p.z))); polygon.Close()
    const wire = scope.keep(polygon.Wire()), face = scope.keep(scope.keep(new oc.BRepBuilderAPI_MakeFace_15(wire, true)).Face())
    const vec = scope.keep(new oc.gp_Vec_4(direction.x, direction.y, direction.z))
    return scope.keep(scope.keep(new oc.BRepPrimAPI_MakePrism_1(face, vec, true, true)).Shape())
  }
  if (object.type === 'cylinder' || object.type === 'cone') {
    const dir = scope.keep(new oc.gp_Dir_4(0, 1, 0)), axis = scope.keep(new oc.gp_Ax2_3(point(0, -object.dimensions.height / 2, 0), dir))
    return scope.keep(scope.keep(object.type === 'cone' ? new oc.BRepPrimAPI_MakeCone_3(axis, object.dimensions.diameter / 2, 0, object.dimensions.height) : new oc.BRepPrimAPI_MakeCylinder_3(axis, object.dimensions.diameter / 2, object.dimensions.height)).Shape())
  }
  throw new Error('Advanced CAD supports native primitives, custom shapes, and existing advanced bodies. Imported meshes, text, SVG, and legacy baked meshes use the mesh tools.')
}
// Build exact analytic custom shapes from their source dimensions. Rounded boxes
// are a rectangular core swept by a disk/ball; this also handles maximum radii
// where a core dimension vanishes and a conventional fillet builder can fail.
function kernelCustom(oc: CadKernel, scope: KernelScope, object: Extract<CadObject, { type: 'custom' }>) {
  const p = validateCustomParameters(object.parameters)
  const point = (x: number, y: number, z: number) => scope.keep(new oc.gp_Pnt_3(x, y, z))
  const cylinder = (radius: number, length: number, center: number[], direction: number[]) => {
    const axis = scope.keep(new oc.gp_Ax2_3(point(...center as [number, number, number]), scope.keep(new oc.gp_Dir_4(...direction as [number, number, number]))))
    return scope.keep(scope.keep(new oc.BRepPrimAPI_MakeCylinder_3(axis, radius, length)).Shape())
  }
  if (p.kind === 'tube') {
    const outer = cylinder(p.diameter / 2, p.height, [0, -p.height / 2, 0], [0, 1, 0])
    const inner = cylinder(p.diameter / 2 - p.wall, p.height + 2, [0, -p.height / 2 - 1, 0], [0, 1, 0])
    return kernelBoolean(oc, scope, outer, inner, 'cut')
  }
  if (p.kind === 'bracket') {
    const profile = customProfile(p), polygon = scope.keep(new oc.BRepBuilderAPI_MakePolygon_1())
    profile.contours.outline.forEach(v => polygon.Add_1(point(v.x, v.y, -p.depth / 2))); polygon.Close()
    const face = scope.keep(scope.keep(new oc.BRepBuilderAPI_MakeFace_15(scope.keep(polygon.Wire()), true)).Face())
    return scope.keep(scope.keep(new oc.BRepPrimAPI_MakePrism_1(face, scope.keep(new oc.gp_Vec_4(0, 0, p.depth)), true, true)).Shape())
  }
  const dims = [p.width, p.height, p.depth], r = p.radius
  const parts: TopoDS_Shape[] = []
  const box = (sizes: number[]) => {
    if (sizes.some(size => size <= 0)) return
    parts.push(scope.keep(scope.keep(new oc.BRepPrimAPI_MakeBox_3(point(-sizes[0] / 2, -sizes[1] / 2, -sizes[2] / 2), sizes[0], sizes[1], sizes[2])).Shape()))
  }
  const ends = (length: number) => length === 0 ? [0] : [-length / 2, length / 2]
  if (!r) box(dims)
  else if (p.rounding !== 'all') {
    const x = p.width - 2 * r, z = p.depth - 2 * r
    box([p.width, p.height, z]); box([x, p.height, p.depth])
    for (const cx of ends(x)) for (const cz of ends(z)) parts.push(cylinder(r, p.height, [cx, -p.height / 2, cz], [0, 1, 0]))
  } else {
    const core = dims.map(size => Math.max(0, size - 2 * r))
    for (let axis = 0; axis < 3; axis++) {
      box(core.map((size, i) => i === axis ? dims[i] : size))
      if (!core[axis]) continue
      const a = (axis + 1) % 3, b = (axis + 2) % 3
      for (const ca of ends(core[a])) for (const cb of ends(core[b])) {
        const center = [0, 0, 0], direction = [0, 0, 0]
        center[axis] = -core[axis] / 2; center[a] = ca; center[b] = cb; direction[axis] = 1
        parts.push(cylinder(r, core[axis], center, direction))
      }
    }
    for (const x of ends(core[0])) for (const y of ends(core[1])) for (const z of ends(core[2])) {
      parts.push(scope.keep(scope.keep(new oc.BRepPrimAPI_MakeSphere_5(point(x, y, z), r)).Shape()))
    }
  }
  let shape = parts[0]
  for (const part of parts.slice(1)) shape = kernelBoolean(oc, scope, shape, part, 'join', true)
  validateKernelShape(oc, scope, shape)
  return shape
}
export function kernelBoolean(oc: CadKernel, scope: KernelScope, a: TopoDS_Shape, b: TopoDS_Shape, operation: 'cut' | 'join' | 'intersection', simplify = false) {
  const progress = scope.keep(new oc.Message_ProgressRange_1())
  const builder = scope.keep(operation === 'cut' ? new oc.BRepAlgoAPI_Cut_3(a, b, progress) : operation === 'join' ? new oc.BRepAlgoAPI_Fuse_3(a, b, progress) : new oc.BRepAlgoAPI_Common_3(a, b, progress))
  if (!builder.IsDone()) throw new Error('Could not build the analytic joined/cut body.')
  if (simplify) builder.SimplifyResult(true, true, 1e-7)
  return scope.keep(builder.Shape())
}
export function validateKernelShape(oc: CadKernel, scope: KernelScope, shape: TopoDS_Shape) {
  if (shape.IsNull() || !scope.keep(new oc.BRepCheck_Analyzer(shape, true, false)).IsValid_2()) throw new Error('The radius produced an invalid solid. Reduce it or change the selected edges.')
  const solids = scope.keep(new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_SOLID as TopAbs_ShapeEnum, oc.TopAbs_ShapeEnum.TopAbs_SHAPE as TopAbs_ShapeEnum))
  if (!solids.More()) throw new Error('Advanced edges require a closed solid.')
}
export function writeBrep(oc: CadKernel, scope: KernelScope, shape: TopoDS_Shape) {
  const path = '/block-cad.brep', progress = scope.keep(new oc.Message_ProgressRange_1())
  try {
    if (!oc.BRepTools.Write_3(shape, path, progress)) throw new Error('Could not store analytic geometry.')
    return oc.FS.readFile(path, { encoding: 'utf8' }) as string
  } finally { try { oc.FS.unlink(path) } catch { /* File may not have been created. */ } }
}
export function readBrep(oc: CadKernel, scope: KernelScope, data: string) {
  const path = '/block-cad.brep', shape = scope.keep(new oc.TopoDS_Shape()), builder = scope.keep(new oc.BRep_Builder()), progress = scope.keep(new oc.Message_ProgressRange_1())
  oc.FS.writeFile(path, data)
  try { if (!oc.BRepTools.Read_2(shape, path, builder, progress)) throw new Error('Could not read analytic geometry.'); return shape }
  finally { oc.FS.unlink(path) }
}
export type KernelEdge = { edge: TopoDS_Edge; key: string; path: Point[] }
export function kernelEdges(oc: CadKernel, scope: KernelScope, shape: TopoDS_Shape): KernelEdge[] {
  const explorer = scope.keep(new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE as TopAbs_ShapeEnum, oc.TopAbs_ShapeEnum.TopAbs_SHAPE as TopAbs_ShapeEnum)), result: KernelEdge[] = []
  while (explorer.More()) {
    const current = scope.keep(explorer.Current()), edge = scope.keep(oc.TopoDS.Edge_1(current))
    if (!result.some(item => item.edge.IsSame(edge)) && !oc.BRep_Tool.Degenerated(edge)) {
      const curve = scope.keep(new oc.BRepAdaptor_Curve_2(edge)), first = curve.FirstParameter(), last = curve.LastParameter()
      if (Number.isFinite(first) && Number.isFinite(last) && last > first) {
        const path: Point[] = []
        for (let i = 0; i <= 48; i++) { const p = curve.Value(first + (last - first) * i / 48); path.push({ x: p.X(), y: p.Y(), z: p.Z() }); p.delete() }
        const signature = [0, 12, 24, 36, 48].map(i => [path[i].x, path[i].y, path[i].z].map(n => Number(n.toFixed(5))).join(','))
        const key = [signature.join(';'), signature.reverse().join(';')].sort()[0]
        result.push({ edge, key, path })
      }
    }
    explorer.Next()
  }
  return result
}
export function isKernelSeam(oc: CadKernel, scope: KernelScope, shape: TopoDS_Shape, edge: TopoDS_Edge) {
  const faces = scope.keep(new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_FACE as TopAbs_ShapeEnum, oc.TopAbs_ShapeEnum.TopAbs_SHAPE as TopAbs_ShapeEnum))
  while (faces.More()) {
    const face = scope.keep(oc.TopoDS.Face_1(scope.keep(faces.Current())))
    if (oc.BRep_Tool.IsClosed_2(edge, face)) return true
    faces.Next()
  }
  return false
}
// Sample the material around an edge midpoint. Ambiguous and tangent cases
// remain transitions; labels never grant eligibility or replace kernel checks.
export function describeKernelEdge(oc: CadKernel, scope: KernelScope, shape: TopoDS_Shape, item: KernelEdge) {
  const curve = scope.keep(new oc.BRepAdaptor_Curve_2(item.edge))
  const curveType = curve.GetType() === oc.GeomAbs_CurveType.GeomAbs_Line ? 'straight' as const : 'curved' as const
  const center = new Vector3(item.path[24].x, item.path[24].y, item.path[24].z)
  const tangent = new Vector3(item.path[25].x - item.path[23].x, item.path[25].y - item.path[23].y, item.path[25].z - item.path[23].z).normalize()
  const u = tangent.clone().cross(Math.abs(tangent.y) < .9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)).normalize(), v = tangent.clone().cross(u)
  const classifier = scope.keep(new oc.BRepClass3d_SolidClassifier_2(shape))
  const votes: string[] = []
  for (const radius of [.01, .002]) {
    let inside = 0, outside = 0
    for (let i = 0; i < 24; i++) {
      const angle = (i + .37) * Math.PI * 2 / 24, p = center.clone().addScaledVector(u, radius * Math.cos(angle)).addScaledVector(v, radius * Math.sin(angle))
      const sample = new oc.gp_Pnt_3(p.x, p.y, p.z)
      try { classifier.Perform(sample, 1e-7); const state = classifier.State(); if (state === oc.TopAbs_State.TopAbs_IN) inside++; else if (state === oc.TopAbs_State.TopAbs_OUT) outside++ }
      finally { sample.delete() }
    }
    votes.push(inside + outside < 20 ? 'transition' : inside > outside + 2 ? 'inside' : outside > inside + 2 ? 'outside' : 'transition')
  }
  const edgeType = votes[0] === votes[1] && votes[0] === 'inside' ? 'inside' : votes[0] === votes[1] && votes[0] === 'outside' ? 'outside' : 'transition'
  return { curveType, edgeType } as const
}
export function kernelFeature(oc: CadKernel, scope: KernelScope, shape: TopoDS_Shape, feature: EdgeFeature) {
  const available = kernelEdges(oc, scope, shape)
  const builder = scope.keep(feature.operation === 'fillet' ? new oc.BRepFilletAPI_MakeFillet(shape, oc.ChFi3d_FilletShape.ChFi3d_Rational as ChFi3d_FilletShape) : new oc.BRepFilletAPI_MakeChamfer(shape))
  const used = new Set<string>()
  const resolved: { edge: TopoDS_Edge; key: string; radius: number; number: number }[] = []
  for (const [index, selection] of feature.edges.entries()) {
    const matches = available.filter(edge => edge.key === selection.key)
    if (matches.length !== 1 || !selection.key || used.has(selection.key)) throw new EdgeBuildError(`Selected edge ${index + 1} changed or is ambiguous. Remove dependent later features and select edges again.`, selection.key ? [selection.key] : [])
    used.add(selection.key)
    const radius = selection.size ?? feature.size
    if (!Number.isFinite(radius) || radius < .01 || radius > 10000) throw new EdgeBuildError(`Selected edge ${index + 1}: enter a size from 0.01 to 10,000 mm.`, [selection.key])
    resolved.push({ edge: matches[0].edge, key: selection.key, radius, number: index + 1 })
    builder.Add_2(radius, matches[0].edge)
  }
  const failure = () => {
    let faulty: typeof resolved = []
    try {
      if ('NbFaultyContours' in builder) {
        const contours = Array.from({ length: builder.NbFaultyContours() }, (_, i) => builder.FaultyContour(i + 1))
        faulty = resolved.filter(item => contours.includes(builder.Contour(item.edge)))
      }
    } catch { /* Some kernel failures do not expose contour diagnostics. */ }
    const detail = (faulty.length ? faulty : resolved).map(item => `selected edge ${item.number} (${item.radius} mm)`).join(', ')
    return new EdgeBuildError(faulty.length
      ? `Could not build ${feature.operation} at ${detail}. Reduce these sizes or remove edges from the selection.`
      : `Could not build this ${feature.operation} combination: ${detail}. The kernel did not identify a single failing edge. Reduce sizes or preview fewer edges.`, faulty.map(item => item.key))
  }
  try { builder.Build(scope.keep(new oc.Message_ProgressRange_1())) } catch { throw failure() }
  if (!builder.IsDone()) throw failure()
  const result = scope.keep(builder.Shape()); validateKernelShape(oc, scope, result); return result
}
export function kernelMesh(oc: CadKernel, scope: KernelScope, shape: TopoDS_Shape) {
  scope.keep(new oc.BRepMesh_IncrementalMesh_2(shape, .02, false, .15, false))
  const writer = scope.keep(new oc.StlAPI_Writer()), path = '/block-cad.stl'
  try {
    if (!writer.Write(shape, path, scope.keep(new oc.Message_ProgressRange_1()))) throw new Error('Could not tessellate the analytic body.')
    const bytes = oc.FS.readFile(path) as Uint8Array
    const geometry = new STLLoader().parse(bytes.slice().buffer as ArrayBuffer)
    try {
      const p = geometry.getAttribute('position')
      if (p.count / 3 > MAX_STL_TRIANGLES) throw new Error('The result exceeds the mesh triangle limit.')
      const positions = new Float32Array(p.array as ArrayLike<number>)
      geometry.computeBoundingBox(); const size = geometry.boundingBox!.getSize(new Vector3())
      return { meshData: encodeStlMesh(positions), dimensions: { x: size.x, y: size.y, z: size.z } }
    } finally { geometry.dispose() }
  } finally { try { oc.FS.unlink(path) } catch { /* File may not have been created. */ } }
}

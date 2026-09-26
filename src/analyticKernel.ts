import { Matrix4, Vector3 } from 'three'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import type { TopoDS_Shape, TopoDS_Edge, TopAbs_ShapeEnum, ChFi3d_FilletShape } from 'opencascade.js/dist/opencascade.full.js'
import type { CadKernel } from './occtRuntime'
import type { CadObject, Vector3 as Point } from './cadModel'
import type { EdgeFeature } from './edgeFeatureData'
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
  if (object.type === 'cylinder') {
    const dir = scope.keep(new oc.gp_Dir_4(0, 1, 0)), axis = scope.keep(new oc.gp_Ax2_3(point(0, -object.dimensions.height / 2, 0), dir))
    return scope.keep(scope.keep(new oc.BRepPrimAPI_MakeCylinder_3(axis, object.dimensions.diameter / 2, object.dimensions.height)).Shape())
  }
  throw new Error('Advanced edges currently start from boxes, wedges, prisms, cylinders, or existing advanced bodies. Imported and baked meshes use the mesh tools.')
}
export function kernelBoolean(oc: CadKernel, scope: KernelScope, a: TopoDS_Shape, b: TopoDS_Shape, operation: 'cut' | 'join' | 'intersection') {
  const progress = scope.keep(new oc.Message_ProgressRange_1())
  const builder = scope.keep(operation === 'cut' ? new oc.BRepAlgoAPI_Cut_3(a, b, progress) : operation === 'join' ? new oc.BRepAlgoAPI_Fuse_3(a, b, progress) : new oc.BRepAlgoAPI_Common_3(a, b, progress))
  if (!builder.IsDone()) throw new Error('Could not build the analytic joined/cut body.')
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
export function kernelFeature(oc: CadKernel, scope: KernelScope, shape: TopoDS_Shape, feature: EdgeFeature) {
  const available = kernelEdges(oc, scope, shape)
  const builder = scope.keep(feature.operation === 'fillet' ? new oc.BRepFilletAPI_MakeFillet(shape, oc.ChFi3d_FilletShape.ChFi3d_Rational as ChFi3d_FilletShape) : new oc.BRepFilletAPI_MakeChamfer(shape))
  const used = new Set<string>()
  for (const selection of feature.edges) {
    const matches = available.filter(edge => edge.key === selection.key)
    if (matches.length !== 1 || !selection.key || used.has(selection.key)) throw new Error('An edge changed or is ambiguous. Remove dependent later features and select edges again.')
    used.add(selection.key)
    const radius = selection.size ?? feature.size
    if (!Number.isFinite(radius) || radius < .01 || radius > 10000) throw new Error('Each radius must be 0.01 to 10,000 mm.')
    builder.Add_2(radius, matches[0].edge)
  }
  builder.Build(scope.keep(new oc.Message_ProgressRange_1()))
  if (!builder.IsDone()) throw new Error('These radii cannot be built on the selected edges. Reduce the sizes or change the selection.')
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

import { bodyCurveQuality, curveQuality, type CurveQuality } from './curveQuality'
import { EdgeBuildError } from './edgeDiagnostics'
import { Matrix4, Vector3 } from 'three'
import type { CadObject } from './cadModel'
import { isHoleObject } from './cadModel'
import { canPositionUnits, getPlacementUnits } from './placement'
import { objectMatrix } from './booleanGeometry'
import { loadCadKernel } from './occtRuntime'
import type { CadKernel } from './occtRuntime'
import type { AnalyticHistory } from './analyticData'
import { MAX_BREP_BYTES } from './analyticData'
import { MAX_EDGE_FEATURES, MAX_FEATURE_EDGES, validateEdgeFeatures, type EdgeFeature, type EdgeOperation } from './edgeFeatureData'
import type { FeatureEdge } from './edgeFeatures'
import { KernelScope, isKernelSeam, describeKernelEdge, kernelBoolean, kernelEdges, kernelFeature, kernelMesh, kernelPrimitive, kernelTransform, readBrep, validateKernelShape, writeBrep } from './analyticKernel'

function replay(oc: CadKernel, scope: KernelScope, history: AnalyticHistory) {
  let shape = readBrep(oc, scope, history.baseBrep)
  validateKernelShape(oc, scope, shape)
  for (let i = 0; i < history.features.length; i++) {
    try { shape = kernelFeature(oc, scope, shape, history.features[i]) }
    catch (error) { throw new EdgeBuildError(`Feature ${i + 1}: ${error instanceof Error ? error.message : 'Geometry could not be built.'}`, error instanceof EdgeBuildError ? error.edgeKeys : []) }
  }
  return shape
}
function context(oc: CadKernel, scope: KernelScope, objects: CadObject[], ids: string[]) {
  const units = getPlacementUnits(objects, new Set(ids))
  if (units.length !== 1 || !canPositionUnits(objects, units) || isHoleObject(units[0].body.anchor)) throw new Error('Select one visible, unlocked solid body.')
  const unit = units[0], anchor = unit.body.anchor
  if (anchor.type === 'stl' && anchor.analyticHistory && unit.body.members.length === 1 && !unit.body.holes.length) {
    return { shape: replay(oc, scope, anchor.analyticHistory), matrix: objectMatrix(anchor), object: anchor, history: anchor.analyticHistory, ids: [...unit.ids] }
  }
  const origin = new Matrix4().makeTranslation(anchor.position.x, anchor.position.y, anchor.position.z), inverse = origin.clone().invert()
  const source = (object: CadObject) => {
    const shape = object.type === 'stl' && object.analyticHistory ? replay(oc, scope, object.analyticHistory) : kernelPrimitive(oc, scope, object)
    return kernelTransform(oc, scope, shape, inverse.clone().multiply(objectMatrix(object)))
  }
  let shape = source(unit.body.members[0])
  for (const member of unit.body.members.slice(1)) shape = kernelBoolean(oc, scope, shape, source(member), anchor.joinMode === 'intersection' ? 'intersection' : 'join')
  for (const hole of unit.body.holes) shape = kernelBoolean(oc, scope, shape, source(hole), 'cut')
  validateKernelShape(oc, scope, shape)
  const baseBrep = writeBrep(oc, scope, shape)
  if (baseBrep.length > MAX_BREP_BYTES) throw new Error('Analytic geometry exceeds the 10 MB limit.')
  const object: Extract<CadObject, { type: 'stl' }> = { id: crypto.randomUUID(), type: 'stl', name: `${anchor.name || anchor.type} · advanced`, ...(anchor.color ? { color: anchor.color } : {}), position: { ...anchor.position }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, dimensions: { x: 1, y: 1, z: 1 }, meshData: '' }
  return { shape, matrix: origin, object, history: { kernel: 'occt' as const, baseBrep, features: [] }, ids: [...unit.ids] }
}
async function job<T>(work: (oc: CadKernel, scope: KernelScope) => T): Promise<T> {
  const oc = await loadCadKernel(), scope = new KernelScope()
  try { return work(oc, scope) }
  catch (error) { throw error instanceof Error ? error : new Error('The CAD kernel could not build this geometry. Try smaller radii or another edge selection.') }
  finally { scope.dispose() }
}
export async function findAnalyticEdges(objects: CadObject[], ids: string[], featureId?: string): Promise<FeatureEdge[]> {
  return job((oc, scope) => {
    const c = context(oc, scope, objects, ids)
    const featureIndex = featureId ? c.history.features.findIndex(f => f.id === featureId) : -1
    if (featureId && featureIndex < 0) throw new Error('Separate later joins/cuts before locating this feature.')
    const shape = featureId ? replay(oc, scope, { ...c.history, features: c.history.features.slice(0, featureIndex) }) : c.shape
    const available = kernelEdges(oc, scope, shape)
    const listed = featureId ? c.history.features[featureIndex].edges.map(stored => available.find(edge => edge.key === stored.key)).filter(edge => !!edge) : available.filter(edge => !isKernelSeam(oc, scope, shape, edge.edge))
    if (featureId && listed.length !== c.history.features[featureIndex].edges.length) throw new Error('An edge could not be located for this feature.')
    if (!listed.length) throw new Error('This body has no sharp edges to select. A smooth sphere has none; joins or cuts can create edges.')
    return listed.map(edge => {
      const path = edge.path.map(p => { const v = new Vector3(p.x, p.y, p.z).applyMatrix4(c.matrix); return { x: v.x, y: v.y, z: v.z } })
      return { ...describeKernelEdge(oc, scope, shape, edge), a: path[0], b: path.at(-1)!, path, key: edge.key, normalA: { x: 0, y: 0, z: 0 }, normalB: { x: 0, y: 0, z: 0 }, angle: 0, maxSize: 10000, maxRadius: 10000 }
    })
  })
}
export async function previewAnalyticFeature(objects: CadObject[], ids: string[], edges: FeatureEdge[], operation: EdgeOperation, size: number, quality: CurveQuality = 'fine') {
  if (!edges.length || edges.length > MAX_FEATURE_EDGES || !Number.isFinite(size) || size < .01 || size > 10000) throw new Error('Select 1–24 edges and enter a size from 0.01 to 10,000 mm.')
  return job((oc, scope) => {
    const c = context(oc, scope, objects, ids)
    if (c.history.features.length >= MAX_EDGE_FEATURES) throw new Error('A body supports up to 32 edge features.')
    const available = kernelEdges(oc, scope, c.shape)
    const feature: EdgeFeature = { id: crypto.randomUUID(), operation, size, quality: curveQuality(quality), edges: edges.map(edge => {
      const current = available.find(e => e.key === edge.key)
      if (!current) throw new Error('The edge is no longer available. Select edges again.')
      return { a: current.path[0], b: current.path.at(-1)!, key: current.key, ...(edge.size !== undefined ? { size: edge.size } : {}) }
    }) }
    validateEdgeFeatures([feature], true)
    const shape = kernelFeature(oc, scope, c.shape, feature)
    return { object: { ...c.object, ...kernelMesh(oc, scope, shape, bodyCurveQuality([...c.history.features, feature])), analyticHistory: { ...c.history, features: [...c.history.features, feature] } }, replacedIds: c.ids }
  })
}
export async function editAnalyticFeature(objects: CadObject[], ids: string[], featureId: string, change: { operation: EdgeOperation; size: number; quality?: CurveQuality; sizes?: (number | null)[] } | null) {
  return job((oc, scope) => {
    const c = context(oc, scope, objects, ids)
    if (!c.history.features.some(f => f.id === featureId)) throw new Error('Separate later joins/cuts before editing this feature. Its source history is preserved until a new advanced feature is applied.')
    const features = c.history.features.flatMap(feature => feature.id !== featureId ? [feature] : change ? [{ ...feature, operation: change.operation, size: change.size, quality: curveQuality(change.quality ?? feature.quality), edges: feature.edges.map((edge, index) => ({ ...edge, size: change.sizes ? change.sizes[index] ?? undefined : edge.size })) }] : [])
    validateEdgeFeatures(features, true)
    const history = { ...c.history, features }
    return { object: { ...c.object, ...kernelMesh(oc, scope, replay(oc, scope, history), bodyCurveQuality(features)), analyticHistory: history }, replacedIds: c.ids }
  })
}

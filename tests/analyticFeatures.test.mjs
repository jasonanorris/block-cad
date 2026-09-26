import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { loadCadKernel } from '../src/occtRuntime.ts'
import { findAnalyticEdges, previewAnalyticFeature, editAnalyticFeature } from '../src/analyticFeatures.ts'
import { parseProject, serializeProject } from '../src/projectFile.ts'
import { exportStl } from '../src/stlExport.ts'
import { export3mf } from '../src/threeMfExport.ts'
import { box } from './fixtures.mjs'
import { getSolidBodies } from '../src/cadModel.ts'
import { readSolidManifold } from '../src/booleanGeometry.ts'
import { loadManifold } from '../src/manifoldRuntime.ts'
import { KernelScope, readBrep, kernelFeature } from '../src/analyticKernel.ts'
const volume=async object=>readSolidManifold(getSolidBodies([object])[0],await loadManifold(),solid=>solid.volume())

globalThis.require=createRequire(import.meta.url)
globalThis.__dirname=new URL('../node_modules/opencascade.js/dist/',import.meta.url).pathname
const nativeFetch=globalThis.fetch
globalThis.fetch=undefined
try { await loadCadKernel() } finally {globalThis.fetch=nativeFetch}
const shape=(id='a')=>({...box(id),position:{x:0,y:0,z:0},dimensions:{x:30,y:20,z:30}})
const close=(a,b)=>Math.abs(a-b)<1e-4
const build=async(objects,select,size=1,operation='fillet')=>{
 const edges=(await findAnalyticEdges(objects,[objects[0].id])).filter(select)
 assert.ok(edges.length>0)
 return (await previewAnalyticFeature(objects,[objects[0].id],edges,operation,size)).object
}
test('advanced CAD handles prism corners, rounded terminations, and unequal radii',async()=>{
 const prism={...shape(),type:'prism',sides:6,dimensions:{diameter:30,height:20}}
 const p=await build([prism],e=>e.path.some(p=>close(p.x,15)&&close(p.y,10)&&close(p.z,0)))
 assert.equal(p.analyticHistory.features[0].edges.length,3)
 const b=shape(),edges=await findAnalyticEdges([b],[b.id])
 const selected=edges.filter(e=>e.path.some(p=>close(p.x,15)&&close(p.y,10)&&close(p.z,15))).map((e,i)=>({...e,size:i+1}))
 assert.equal(selected.length,3)
 const unequal=(await previewAnalyticFeature([b],[b.id],selected,'fillet',1)).object
 assert.deepEqual(unequal.analyticHistory.features[0].edges.map(e=>e.size),[1,2,3])
 const oc=await loadCadKernel(),scope=new KernelScope()
 try {
  const base=readBrep(oc,scope,unequal.analyticHistory.baseBrep),body=kernelFeature(oc,scope,base,unequal.analyticHistory.features[0])
  const explorer=scope.keep(new oc.TopExp_Explorer_2(body,oc.TopAbs_ShapeEnum.TopAbs_FACE,oc.TopAbs_ShapeEnum.TopAbs_SHAPE)),radii=[]
  while(explorer.More()) {
   const face=scope.keep(oc.TopoDS.Face_1(scope.keep(explorer.Current()))),surface=scope.keep(new oc.BRepAdaptor_Surface_2(face,true))
   if(surface.GetType()===oc.GeomAbs_SurfaceType.GeomAbs_Cylinder) radii.push(scope.keep(surface.Cylinder()).Radius())
   explorer.Next()
  }
  for(const radius of [1,2,3]) assert.ok(radii.some(r=>close(r,radius)),`missing analytic radius ${radius}`)
 } finally {scope.dispose()}
 const first=await build([b],e=>e.path.every(p=>close(p.x,15)&&close(p.z,15)),2)
 assert.ok(Math.abs(await volume(first)-(18000-20*4*(1-Math.PI/4)))<.2)
 const second=await build([first],e=>e.path.every(p=>close(p.y,10)&&close(p.z,15)),1)
 assert.equal(second.analyticHistory.features.length,2)
 for(const result of [p,unequal,second]) {assert.ok((await exportStl([result])).byteLength>84);assert.ok((await export3mf([result])).byteLength>100)}
})
test('advanced CAD supports internal pocket and circular blind-hole edges',async()=>{
 const b=shape(),hole={...shape('hole'),dimensions:{x:12,y:12,z:12},position:{x:0,y:8,z:0},cutTargetId:b.id}
 const pocket=await build([b,hole],e=>e.path.every(p=>close(p.y,2)),1)
 assert.equal(pocket.analyticHistory.features[0].edges.length,4)
 assert.ok(await volume(pocket)>18000-12*12*8);assert.ok(await volume(pocket)<18000)
 const cylinder={...hole,type:'cylinder',dimensions:{diameter:10,height:12}}
 const circular=await build([b,cylinder],e=>e.path.every(p=>close(p.y,2)),1)
 assert.equal(circular.analyticHistory.features[0].edges.length,1)
 assert.ok(await volume(circular)>18000-Math.PI*25*8);assert.ok(await volume(circular)<18000)
 for(const result of [pocket,circular]) assert.ok((await exportStl([result])).byteLength>84)
})
test('analytic histories persist, edit atomically, transform, and reject malformed data',async()=>{
 const b=shape(),first=await build([b],e=>e.path.every(p=>close(p.x,15)&&close(p.z,15)),2)
 const {findFeatureEdges}=await import('../src/edgeFeatures.ts')
 await assert.rejects(findFeatureEdges([first],[first.id]),/Advanced CAD/)
 const transformed={...first,position:{x:40,y:30,z:10},rotation:{x:.2,y:.3,z:.4},scale:{x:-1,y:2,z:.5}}
 const saved=serializeProject([transformed]),restored=parseProject(saved)[0]
 assert.deepEqual(restored.analyticHistory,first.analyticHistory)
 const id=restored.analyticHistory.features[0].id
 const edited=(await editAnalyticFeature([restored],[restored.id],id,{operation:'fillet',size:1,sizes:[.5]})).object
 assert.deepEqual(edited.rotation,transformed.rotation);assert.deepEqual(edited.scale,transformed.scale)
 assert.equal(edited.analyticHistory.features[0].edges[0].size,.5)
 await assert.rejects(editAnalyticFeature([restored],[restored.id],id,{operation:'fillet',size:1000}),/radii|radius|geometry|Feature/)
 const removed=(await editAnalyticFeature([restored],[restored.id],id,null)).object
 assert.equal(removed.analyticHistory.features.length,0)
 assert.equal(restored.meshData,first.meshData)
 for(const change of [h=>h.baseBrep='bad',h=>h.features[0].edges[0].key='',h=>h.features[0].edges[0].size=-1]) {
  const file=JSON.parse(saved);change(file.objects[0].analyticHistory);assert.throws(()=>parseProject(JSON.stringify(file)))
 }
 const added=await findAnalyticEdges([removed],[removed.id]);assert.equal(added.length,12)
})

test('advanced sources support joined solids, scaled sources, and reusable library history',async()=>{
 const {preparePart,insertPart}=await import('../src/partsLibrary.ts')
 const b={...shape(),rotation:{x:.2,y:.3,z:.1},scale:{x:-2,y:1,z:.5}}
 const edges=await findAnalyticEdges([b],[b.id]);assert.equal(edges.length,12)
 const first=(await previewAnalyticFeature([b],[b.id],[edges[0]],'fillet',.5)).object
 const copy=insertPart(await preparePart([first],new Set([first.id])),0)[0]
 assert.deepEqual(copy.analyticHistory,first.analyticHistory)
 const id=copy.analyticHistory.features[0].id
 assert.ok((await editAnalyticFeature([copy],[copy.id],id,{operation:'chamfer',size:.25})).object.meshData)
 const a={...shape('joined-a'),joinGroupId:'join'},c={...shape('joined-b'),position:{x:10,y:0,z:0},joinGroupId:'join'}
 const candidates=await findAnalyticEdges([a,c],[a.id])
 const joined=await previewAnalyticFeature([a,c],[a.id],[candidates[0]],'fillet',1)
 assert.deepEqual(new Set(joined.replacedIds),new Set([a.id,c.id]))
 assert.ok(joined.object.dimensions.x>30)
})

test('advanced edge labels, saved-feature locations, and failure references agree with the geometry',async()=>{
 const {EdgeBuildError}=await import('../src/edgeDiagnostics.ts')
 const b=shape(),edges=await findAnalyticEdges([b],[b.id])
 assert.ok(edges.every(e=>e.edgeType==='outside' && e.curveType==='straight'))
 const hole={...shape('hole'),dimensions:{x:12,y:12,z:12},position:{x:0,y:8,z:0},cutTargetId:b.id}
 const pocket=(await findAnalyticEdges([b,hole],[b.id])).filter(e=>e.path.every(p=>close(p.y,2)))
 assert.equal(pocket.length,4);assert.ok(pocket.every(e=>e.edgeType==='inside' && e.curveType==='straight'))
 const circular=(await findAnalyticEdges([b,{...hole,type:'cylinder',dimensions:{diameter:10,height:12}}],[b.id])).filter(e=>e.path.every(p=>close(p.y,2)))
 assert.equal(circular.length,1);assert.equal(circular[0].edgeType,'inside');assert.equal(circular[0].curveType,'curved')
 const first=(await previewAnalyticFeature([b],[b.id],[edges[3],edges[0]],'fillet',1)).object
 const located=await findAnalyticEdges([first],[first.id],first.analyticHistory.features[0].id)
 assert.deepEqual(located.map(e=>e.key),[edges[3].key,edges[0].key])
 assert.deepEqual(located.map(e=>e.path),[edges[3].path,edges[0].path])
 await assert.rejects(previewAnalyticFeature([b],[b.id],[edges[0]],'fillet',1000),error=>{
  assert.ok(error instanceof EdgeBuildError);assert.match(error.message,/selected edge 1 \(1000 mm\)/)
  assert.ok(error.edgeKeys.every(key=>key===edges[0].key))
  if(!error.edgeKeys.length) assert.match(error.message,/did not identify/)
  return true
 })
})

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

test('new analytic primitives preserve custom dimensions, volumes, and maximum rounding radii',async()=>{
 const {kernelPrimitive,kernelMesh,validateKernelShape}=await import('../src/analyticKernel.ts')
 const {createCustomShape}=await import('../src/customShapes.ts')
 const oc=await loadCadKernel()
 const fixtures=[
  [{...shape(),type:'sphere',dimensions:{diameter:20}},4/3*Math.PI*1000,[20,20,20]],
  [{...shape(),type:'cone',dimensions:{diameter:20,height:30}},Math.PI*100*30/3,[20,30,20]],
  [createCustomShape({kind:'tube',diameter:30,height:25,wall:3}),Math.PI*(15**2-12**2)*25,[30,25,30]],
  [createCustomShape({kind:'bracket',width:40,height:30,depth:20,wall:4}),(40*4+26*4)*20,[40,30,20]],
 ]
 for(const rounding of ['sides','all']) for(const [width,height,depth,radius] of [[40,15,30,0],[40,15,30,5],[20,20,20,10],[20,30,20,10],[20,20,30,10]]) {
  const core=[width,height,depth].map(d=>d-2*radius),[a,b,c]=core
  const expected=rounding==='sides'?(width*depth-(4-Math.PI)*radius**2)*height:a*b*c+2*radius*(a*b+a*c+b*c)+Math.PI*radius**2*(a+b+c)+4/3*Math.PI*radius**3
  fixtures.push([createCustomShape({kind:'rounded-box',width,height,depth,radius,rounding}),expected,[width,height,depth]])
 }
 for(const [source,expected,dimensions] of fixtures) {
  const scope=new KernelScope()
  try {
   const solid=kernelPrimitive(oc,scope,source);validateKernelShape(oc,scope,solid)
   const data=kernelMesh(oc,scope,solid),object={...shape(),type:'stl',...data}
   const measured=await volume(object)
   assert.ok(Math.abs(measured-expected)<expected*.005,`${source.type}/${source.parameters?.rounding}: ${measured} vs ${expected}`)
   Object.values(data.dimensions).forEach((d,i)=>assert.ok(Math.abs(d-dimensions[i])<.05))
  } finally {scope.dispose()}
 }
})

test('cones, tubes, brackets, rounded boxes, and sphere cuts support editable analytic edges',async()=>{
 const {createCustomShape}=await import('../src/customShapes.ts')
 const sources=[
  {...shape(),type:'cone',dimensions:{diameter:20,height:30}},
  {...createCustomShape({kind:'tube',diameter:30,height:25,wall:3}),position:{x:0,y:0,z:0}},
  {...createCustomShape({kind:'bracket',width:40,height:30,depth:20,wall:4}),position:{x:0,y:0,z:0}},
  {...createCustomShape({kind:'rounded-box',width:40,height:20,depth:30,radius:5,rounding:'sides'}),position:{x:0,y:0,z:0}},
 ]
 for(const source of sources) {
  const edges=await findAnalyticEdges([source],[source.id])
  const selected=source.type==='cone'?edges.filter(e=>e.curveType==='curved'):edges.filter(e=>source.parameters?.kind==='bracket'?e.edgeType==='inside':e.edgeType!=='transition').slice(0,1)
  assert.ok(selected.length)
  const first=(await previewAnalyticFeature([source],[source.id],selected,'fillet',.5)).object
  const restored=parseProject(serializeProject([first]))[0],id=restored.analyticHistory.features[0].id
  const edited=(await editAnalyticFeature([restored],[restored.id],id,{operation:'fillet',size:.3})).object
  assert.ok((await exportStl([edited])).byteLength>84)
  assert.ok((await export3mf([edited])).byteLength>100)
 }
 const sphere={...shape(),type:'sphere',dimensions:{diameter:30}}
 await assert.rejects(findAnalyticEdges([sphere],[sphere.id]),/no sharp edges/)
 const cut={...shape('cut'),dimensions:{x:40,y:20,z:40},position:{x:0,y:15,z:0},cutTargetId:sphere.id}
 const edges=await findAnalyticEdges([sphere,cut],[sphere.id])
 const rim=edges.filter(e=>e.path.every(p=>close(p.y,5)))
 assert.equal(rim.length,1)
 const first=(await previewAnalyticFeature([sphere,cut],[sphere.id],rim,'fillet',.5)).object
 assert.ok((await exportStl([first])).byteLength>84)
 const rounded={...createCustomShape({kind:'rounded-box',width:40,height:20,depth:30,radius:5,rounding:'all'}),position:{x:0,y:0,z:0}}
 const hole={...shape('hole'),type:'cylinder',dimensions:{diameter:6,height:40},cutTargetId:rounded.id}
 const rims=(await findAnalyticEdges([rounded,hole],[rounded.id])).filter(e=>e.edgeType!=='transition'&&e.path.every(p=>close(p.y,10)))
 assert.ok(rims.length)
 const result=(await previewAnalyticFeature([rounded,hole],[rounded.id],[rims[0]],'fillet',.5)).object
 assert.ok((await exportStl([result])).byteLength>84)
})

test('analytic quality controls tessellation without changing radii and survives persistence',async()=>{
 const {decodeStlMesh}=await import('../src/stlMesh.ts')
 const {bodyCurveQuality}=await import('../src/curveQuality.ts')
 const b=shape(),edges=(await findAnalyticEdges([b],[b.id])).filter(e=>e.path.every(p=>close(p.x,15)&&close(p.z,15)))
 const counts=[];let previous
 for(const quality of ['standard','fine','extra-fine']) {
  const object=previous ? (await editAnalyticFeature([previous],[previous.id],previous.analyticHistory.features[0].id,{operation:'fillet',size:2,quality})).object
   : (await previewAnalyticFeature([b],[b.id],edges,'fillet',2,quality)).object
  counts.push(decodeStlMesh(object.meshData).length)
  assert.equal(object.analyticHistory.features[0].quality,quality)
  assert.equal(object.analyticHistory.features[0].size,2)
  assert.ok(Math.abs(await volume(object)-(18000-20*4*(1-Math.PI/4)))<.2)
  assert.deepEqual(parseProject(serializeProject([object])),JSON.parse(JSON.stringify([object])))
  previous=object
 }
 assert.ok(counts[0]<counts[1] && counts[1]<counts[2])
 assert.equal(bodyCurveQuality([{quality:'extra-fine'},{quality:'standard'}]),'extra-fine')
 const malformed=JSON.parse(serializeProject([previous]));malformed.objects[0].analyticHistory.features[0].quality='ultra'
 assert.throws(()=>parseProject(JSON.stringify(malformed)),/quality/)
 const legacy=structuredClone(previous);delete legacy.analyticHistory.features[0].quality
 const file=JSON.parse(serializeProject([legacy]));file.version=21
 const loaded=parseProject(JSON.stringify(file))[0]
 const rebuilt=(await editAnalyticFeature([loaded],[loaded.id],loaded.analyticHistory.features[0].id,{operation:'fillet',size:2})).object
 assert.equal(decodeStlMesh(rebuilt.meshData).length,counts[1])
})

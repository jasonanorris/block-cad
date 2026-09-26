import test from 'node:test'
import assert from 'node:assert/strict'
import { findFeatureEdges, previewEdgeFeature } from '../src/edgeFeatures.ts'
import { getSolidBodies } from '../src/cadModel.ts'
import { readSolidManifold } from '../src/booleanGeometry.ts'
import { loadManifold } from '../src/manifoldRuntime.ts'
import { parseProject, serializeProject } from '../src/projectFile.ts'
import { exportStl } from '../src/stlExport.ts'
import { box } from './fixtures.mjs'

test('edge tools recover 12 true box edges and cut dimensioned chamfers and fillets', async () => {
 const shape={...box('edge-box'),dimensions:{x:20,y:20,z:20},color:'#123456'},objects=[shape]
 const edges=await findFeatureEdges(objects,[shape.id]);assert.equal(edges.length,12)
 const runtime=await loadManifold()
 for(const operation of ['chamfer','fillet']) for(const size of [1,5,10]) {
  const {object,replacedIds}=await previewEdgeFeature(objects,[shape.id],edges[0],operation,size)
  const volume=readSolidManifold(getSolidBodies([object])[0],runtime,s=>{assert.equal(s.status(),'NoError');return s.volume()})
  const expected=8000-20*size*size*(operation==='chamfer'?.5:1-Math.PI/4)
  assert.ok(Math.abs(volume-expected)<(operation==='chamfer'?.01:2),`${operation}: ${volume} vs ${expected}`)
  assert.deepEqual(replacedIds,[shape.id]);assert.equal(object.color,shape.color)
  assert.deepEqual(parseProject(serializeProject([object])),[object]);assert.ok((await exportStl([object])).byteLength>84)
 }
 assert.equal(objects[0],shape)
})

test('edge tools use world dimensions for rotated reflected shapes and reject stale, locked and unsupported inputs',async()=>{
 const shape={...box('edge-box'),dimensions:{x:20,y:20,z:20},rotation:{x:.3,y:.7,z:.1},scale:{x:-2,y:1,z:.5}}
 const edges=await findFeatureEdges([shape],[shape.id]);assert.equal(edges.length,12)
 const result=await previewEdgeFeature([shape],[shape.id],edges[0],'chamfer',1)
 const runtime=await loadManifold();assert.ok(readSolidManifold(getSolidBodies([result.object])[0],runtime,s=>s.volume())<8000)
 const bounds=readSolidManifold(getSolidBodies([result.object])[0],runtime,s=>s.boundingBox())
 for(const [index,axis] of ['x','y','z'].entries())assert.ok(Math.abs(result.object.dimensions[axis]-(bounds.max[index]-bounds.min[index]))<1e-4)
 await assert.rejects(()=>previewEdgeFeature([shape],[shape.id],edges[0],'fillet',100),/no larger/)
 await assert.rejects(()=>previewEdgeFeature([shape],[shape.id],edges[0],'fillet',NaN),/0.01/)
 await assert.rejects(()=>previewEdgeFeature([shape],[shape.id],{...edges[0],a:{x:999,y:0,z:0}},'fillet',1),/changed/)
 await assert.rejects(()=>findFeatureEdges([{...shape,locked:true}],[shape.id]),/unlocked/)
 const hole={...box('hole'),dimensions:{x:5,y:40,z:5},cutTargetId:shape.id,position:shape.position}
 await assert.rejects(()=>findFeatureEdges([shape,hole],[shape.id]),/convex/)
 await assert.rejects(()=>findFeatureEdges([{...box('sphere'),type:'sphere',dimensions:{diameter:20}}],['sphere']),/convex|supported/)
})

test('every box edge has consistent orientation and joined sources are replaced as one body',async()=>{
 const shapes=[{...box('a',0),joinGroupId:'joined'}, {...box('b',10),joinGroupId:'joined'}]
 const edges=await findFeatureEdges(shapes,['b']);assert.equal(edges.length,12)
 const runtime=await loadManifold(),before=readSolidManifold(getSolidBodies(shapes)[0],runtime,s=>s.volume())
 for(const edge of edges) {
  const {object,replacedIds}=await previewEdgeFeature(shapes,['b'],edge,'chamfer',1)
  const length=Math.hypot(edge.b.x-edge.a.x,edge.b.y-edge.a.y,edge.b.z-edge.a.z)
  const after=readSolidManifold(getSolidBodies([object])[0],runtime,s=>s.volume())
  assert.ok(Math.abs(before-after-length/2)<.01)
  assert.deepEqual(new Set(replacedIds),new Set(['a','b']))
 }
})


test('a separate parallel edge remains editable after the first fillet',async()=>{
 const shape={...box('first'),dimensions:{x:20,y:20,z:20}}
 const [edge]=await findFeatureEdges([shape],[shape.id])
 const first=await previewEdgeFeature([shape],[shape.id],edge,'fillet',2)
 const remaining=await findFeatureEdges([first.object],[first.object.id])
 const direction=e=>[e.b.x-e.a.x,e.b.y-e.a.y,e.b.z-e.a.z]
 const a=direction(edge),length=Math.hypot(...a)
 const parallel=remaining.find(e=>{const b=direction(e);return Math.abs(a.reduce((s,n,i)=>s+n*b[i],0))/(length*Math.hypot(...b))>.999 && e.maxSize>=2})
 assert.ok(parallel)
 const next=await previewEdgeFeature([first.object],[first.object.id],parallel,'fillet',2)
 const runtime=await loadManifold()
 const volume=o=>readSolidManifold(getSolidBodies([o])[0],runtime,s=>s.volume())
 assert.ok(volume(next.object)<volume(first.object))
})

test('multi-edge features rebuild from a retained base and survive projects and library reuse',async()=>{
 const {editEdgeFeature}=await import('../src/edgeFeatures.ts')
 const {preparePart,insertPart}=await import('../src/partsLibrary.ts')
 const shape={...box('multi'),dimensions:{x:20,y:20,z:20}}
 const edges=await findFeatureEdges([shape],[shape.id])
 const parallel=edges.filter(e=>Math.abs(e.b.y-e.a.y)>19)
 assert.equal(parallel.length,4)
 const first=await previewEdgeFeature([shape],[shape.id],parallel,'fillet',2)
 assert.equal(first.object.edgeHistory.features[0].edges.length,4)
 const runtime=await loadManifold(),volume=o=>readSolidManifold(getSolidBodies([o])[0],runtime,s=>s.volume())
 assert.ok(Math.abs(volume(first.object)-(8000-4*20*4*(1-Math.PI/4)))<.5)
 const moved={...first.object,position:{x:45,y:40,z:-20},rotation:{x:.2,y:.6,z:.1},scale:{x:-2,y:1,z:.5}}
 const restored=parseProject(serializeProject([moved]))[0]
 const id=restored.edgeHistory.features[0].id
 const edited=await editEdgeFeature([restored],[restored.id],id,{operation:'chamfer',size:3})
 assert.equal(edited.object.id,restored.id);assert.deepEqual(edited.object.position,restored.position)
 assert.deepEqual(edited.object.rotation,restored.rotation);assert.deepEqual(edited.object.scale,restored.scale)
 assert.ok(Math.abs(volume(edited.object)-(8000-4*20*9/2))<.01)
 const removed=await editEdgeFeature([edited.object],[edited.object.id],id,null)
 assert.equal(removed.object.edgeHistory.features.length,0);assert.ok(Math.abs(volume(removed.object)-8000)<.01)
 const part=await preparePart([restored],new Set([restored.id])),copy=insertPart(part,0)[0]
 assert.deepEqual(copy.edgeHistory,restored.edgeHistory);assert.notEqual(copy.id,restored.id)
 const copiedEdit=await editEdgeFeature([copy],[copy.id],id,{operation:'fillet',size:1})
 assert.equal(copiedEdit.object.edgeHistory.features[0].size,1)
 assert.equal(restored.edgeHistory.features[0].size,2)
 const available=await findFeatureEdges([removed.object],[removed.object.id])
 const added=await previewEdgeFeature([removed.object],[removed.object.id],available[0],'fillet',1)
 assert.deepEqual(added.object.rotation,removed.object.rotation);assert.deepEqual(added.object.scale,removed.object.scale)
 assert.equal(added.object.edgeHistory.baseMeshData,removed.object.edgeHistory.baseMeshData)
 const joined=[{...shape,id:'anchor',joinGroupId:'g'},{...restored,joinGroupId:'g'}]
 await assert.rejects(()=>findFeatureEdges(joined,['anchor']),/Separate this body/)
})

test('multi-edge rejection and dependent-feature errors preserve the original model',async()=>{
 const {editEdgeFeature}=await import('../src/edgeFeatures.ts')
 const shape={...box('multi'),dimensions:{x:20,y:20,z:20}},objects=[shape]
 const edges=await findFeatureEdges(objects,[shape.id]),edge=edges[0]
 const shared=edges.find(e=>e!==edge && [e.a,e.b].some(a=>[edge.a,edge.b].some(b=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<1e-5)))
 const original=serializeProject(objects)
 await assert.rejects(()=>previewEdgeFeature(objects,[shape.id],[edge,shared],'fillet',2),/do not meet/)
 await assert.rejects(()=>previewEdgeFeature(objects,[shape.id],[edge,edge],'chamfer',2),/do not meet/)
 await assert.rejects(()=>previewEdgeFeature(objects,[shape.id],[],'fillet',2),/Select 1/)
 assert.equal(serializeProject(objects),original)
 const first=await previewEdgeFeature(objects,[shape.id],edge,'fillet',1)
 const remaining=await findFeatureEdges([first.object],[first.object.id])
 const direction=e=>[e.b.x-e.a.x,e.b.y-e.a.y,e.b.z-e.a.z]
 const a=direction(edge),length=Math.hypot(...a)
 const parallel=remaining.find(e=>{const b=direction(e);return Math.abs(a.reduce((s,n,i)=>s+n*b[i],0))/(length*Math.hypot(...b))>.999 && e.maxSize<10 && e.maxSize>=9})
 assert.ok(parallel)
 const second=await previewEdgeFeature([first.object],[first.object.id],parallel,'fillet',9)
 const before=serializeProject([second.object]),features=second.object.edgeHistory.features
 await assert.rejects(()=>editEdgeFeature([second.object],[second.object.id],features[0].id,{operation:'fillet',size:8}),/Feature 2/)
 assert.equal(serializeProject([second.object]),before)
 const removed=await editEdgeFeature([second.object],[second.object.id],features[0].id,null)
 assert.equal(removed.object.edgeHistory.features.length,1);assert.equal(removed.object.edgeHistory.features[0].id,features[1].id)
})

test('format 20 validates edge history and shares both base and resulting meshes',async()=>{
 const shape={...box('history'),dimensions:{x:20,y:20,z:20}}
 const [edge]=await findFeatureEdges([shape],[shape.id])
 const {object}=await previewEdgeFeature([shape],[shape.id],edge,'chamfer',2)
 const file=JSON.parse(serializeProject([object,{...object,id:'copy'}]))
 assert.equal(file.version,20);assert.equal(file.meshes.length,2)
 assert.equal(file.objects[0].edgeHistory.baseMeshRef,file.objects[1].edgeHistory.baseMeshRef)
 assert.deepEqual(parseProject(JSON.stringify(file)),[object,{...object,id:'copy'}])
 for(const mutate of [f=>f.version=19,f=>f.objects[0].edgeHistory.baseMeshRef=999,
  f=>f.objects[0].edgeHistory.features[0].size=-1,f=>f.objects[0].edgeHistory.features[0].edges=[],
  f=>f.objects[0].edgeHistory.features.push(f.objects[0].edgeHistory.features[0]),
  f=>f.objects[0].edgeHistory.features[0].operation='unknown']) {
  const malformed=structuredClone(file);mutate(malformed);assert.throws(()=>parseProject(JSON.stringify(malformed)))
 }
})

test('acute and obtuse edges produce dimensioned chamfers and tangent circular fillets',async()=>{
 const runtime=await loadManifold()
 const fixtures=[{angle:Math.atan(.5)*180/Math.PI,shape:{...box('transformed-wedge'),type:'wedge',dimensions:{x:20,y:20,z:20},rotation:{x:.3,y:.7,z:.2},scale:{x:-2,y:1,z:.5}}},...[15,30,45,60,75].map(angle=>({angle,shape:{...box(`wedge-${angle}`),type:'wedge',dimensions:{x:20,y:20*Math.tan(angle*Math.PI/180),z:20}}})),
  ...[5,6,12,24].map(sides=>({angle:180-360/sides,shape:{...box(`prism-${sides}`),type:'prism',sides,dimensions:{diameter:40,height:20}}}))]
 for(const {angle,shape} of fixtures) {
  const edges=await findFeatureEdges([shape],[shape.id])
  const edge=edges.find(e=>Math.abs(e.angle-angle)<.001);assert.ok(edge,`Missing ${angle}° edge`)
  const radians=angle*Math.PI/180,length=Math.hypot(edge.b.x-edge.a.x,edge.b.y-edge.a.y,edge.b.z-edge.a.z)
  assert.ok(Math.abs(edge.maxRadius-edge.maxSize*Math.tan(radians/2))<1e-4)
  const before=readSolidManifold(getSolidBodies([shape])[0],runtime,s=>s.volume())
  for(const operation of ['chamfer','fillet']) {
   const size=.5,{object}=await previewEdgeFeature([shape],[shape.id],edge,operation,size)
   const after=readSolidManifold(getSolidBodies([object])[0],runtime,s=>{assert.equal(s.status(),'NoError');return s.volume()})
   const area=operation==='chamfer'?.5*size*size*Math.sin(radians):size*size*(1/Math.tan(radians/2)-(Math.PI-radians)/2)
   assert.ok(Math.abs((before-after)-area*length)<Math.max(.002,area*length*.03),`${angle}° ${operation}: ${before-after} vs ${area*length}`)
   assert.deepEqual(parseProject(serializeProject([object])),[object])
  }
 }
})

test('angled limits differ by operation and editable histories retain acute edge choices',async()=>{
 const {editEdgeFeature}=await import('../src/edgeFeatures.ts')
 const shape={...box('acute'),type:'wedge',dimensions:{x:20,y:20,z:20}}
 const edges=await findFeatureEdges([shape],[shape.id]),edge=edges.find(e=>Math.abs(e.angle-45)<.001)
 assert.ok(edge.maxRadius<5 && edge.maxSize>5)
 await assert.rejects(()=>previewEdgeFeature([shape],[shape.id],edge,'fillet',5),/radius no larger/)
 const first=await previewEdgeFeature([shape],[shape.id],edge,'chamfer',5)
 const stored=parseProject(serializeProject([first.object]))[0],id=stored.edgeHistory.features[0].id
 const edited=await editEdgeFeature([stored],[stored.id],id,{operation:'fillet',size:2})
 assert.equal(edited.object.edgeHistory.features[0].size,2)
 const removed=await editEdgeFeature([edited.object],[edited.object.id],id,null)
 const runtime=await loadManifold();assert.ok(Math.abs(readSolidManifold(getSolidBodies([removed.object])[0],runtime,s=>s.volume())-4000)<.001)
 const shallow={...shape,id:'shallow',dimensions:{x:20,y:20*Math.tan(5*Math.PI/180),z:20}}
 assert.ok((await findFeatureEdges([shallow],[shallow.id])).every(e=>e.angle>=15 && e.angle<=165))
 const fine={...box('fine'),type:'prism',sides:32,dimensions:{diameter:40,height:20}}
 await assert.rejects(()=>findFeatureEdges([fine],[fine.id]),/No supported edges/)
})

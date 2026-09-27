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
 assert.equal((await previewEdgeFeature(objects,[shape.id],[edge,shared],'fillet',2)).object.edgeHistory.features[0].edges.length,2)
 await assert.rejects(()=>previewEdgeFeature(objects,[shape.id],[edge,edge],'chamfer',2),/only once/)
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
 assert.equal(file.version,22);assert.equal(file.meshes.length,2)
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

test('three-edge fillet corners form spherical patches and all box edges form a rounded solid',async()=>{
 const {Vector3}=await import('three')
 const {createSourceGeometry}=await import('../src/sourceGeometry.ts')
 const shape={...box('corners'),dimensions:{x:20,y:20,z:20}},edges=await findFeatureEdges([shape],[shape.id])
 const runtime=await loadManifold()
 for(const radius of [2,5,10]) {
  const {object}=await previewEdgeFeature([shape],[shape.id],edges,'fillet',radius)
  const volume=readSolidManifold(getSolidBodies([object])[0],runtime,s=>{assert.equal(s.status(),'NoError');return s.volume()})
  const inner=20-2*radius,expected=inner**3+6*radius*inner**2+3*Math.PI*radius**2*inner+4/3*Math.PI*radius**3
  assert.ok(Math.abs(volume-expected)<Math.max(1,expected*.002),`${volume} vs ${expected}`)
  const geometry=createSourceGeometry(object),p=geometry.getAttribute('position')
  try {
   // A full rounded box is the radius offset of its inner box. Intersecting
   // cylinders alone leave protruding corners and fail this geometric check.
   for(let i=0;i<p.count;i++) {
    const position=new Vector3().fromBufferAttribute(p,i)
    const distance=Math.hypot(...position.toArray().map(n=>Math.max(0,Math.abs(n)-inner/2)))
    assert.ok(Math.abs(distance-radius)<radius*.003+1e-5,`surface radius ${distance} != ${radius}`)
   }
  } finally {geometry.dispose()}
  assert.deepEqual(parseProject(serializeProject([object])),[object])
 }
 const corner=edges[0].a
 const incident=edges.filter(e=>[e.a,e.b].some(p=>Math.hypot(p.x-corner.x,p.y-corner.y,p.z-corner.z)<1e-5))
 assert.equal(incident.length,3)
 const single=await previewEdgeFeature([shape],[shape.id],incident,'fillet',2)
 assert.equal(single.object.edgeHistory.features[0].edges.length,3)
 const remaining=await findFeatureEdges([single.object],[single.object.id])
 assert.ok(remaining.length>0)
 const next=await previewEdgeFeature([single.object],[single.object.id],remaining[0],'chamfer',1)
 assert.equal(next.object.edgeHistory.features.length,2)
 assert.ok(readSolidManifold(getSolidBodies([single.object])[0],runtime,s=>s.volume())<8000)
})

test('meeting chamfers and corner feature edits stay closed, undoable data and transform-safe',async()=>{
 const {editEdgeFeature}=await import('../src/edgeFeatures.ts')
 const shape={...box('corners'),dimensions:{x:20,y:20,z:20},rotation:{x:.3,y:.4,z:.2},scale:{x:-1,y:1,z:1}}
 const edges=await findFeatureEdges([shape],[shape.id]),corner=edges[0].a
 const incident=edges.filter(e=>[e.a,e.b].some(p=>Math.hypot(p.x-corner.x,p.y-corner.y,p.z-corner.z)<1e-5))
 const runtime=await loadManifold()
 const chamfer=await previewEdgeFeature([shape],[shape.id],incident.slice(0,2),'chamfer',2)
 assert.equal(readSolidManifold(getSolidBodies([chamfer.object])[0],runtime,s=>s.status()),'NoError')
 const all=await previewEdgeFeature([shape],[shape.id],edges,'chamfer',2)
 const id=all.object.edgeHistory.features[0].id
 const rounded=await editEdgeFeature([all.object],[all.object.id],id,{operation:'fillet',size:3})
 assert.equal(rounded.object.edgeHistory.features[0].edges.length,12)
 assert.equal(readSolidManifold(getSolidBodies([rounded.object])[0],runtime,s=>s.status()),'NoError')
 assert.ok((await exportStl([rounded.object])).byteLength>84)
 const removed=await editEdgeFeature([rounded.object],[rounded.object.id],id,null)
 assert.ok(Math.abs(readSolidManifold(getSolidBodies([removed.object])[0],runtime,s=>s.volume())-8000)<.01)
})

test('prism chamfers remove every vertex beyond the cut plane without face slivers',async()=>{
 const {decodeStlMesh}=await import('../src/stlMesh.ts')
 const runtime=await loadManifold()
 for(const sides of [5,6,8,12]) {
  const shape={...box(`prism-slivers-${sides}`),type:'prism',sides,dimensions:{diameter:40,height:20}}
  const edges=await findFeatureEdges([shape],[shape.id])
  for(const selected of [...edges.map(edge=>[edge]),edges]) {
   const {object}=await previewEdgeFeature([shape],[shape.id],selected,'chamfer',2)
   const positions=decodeStlMesh(object.meshData)
   for(const edge of selected) {
    const n={x:edge.normalA.x+edge.normalB.x,y:edge.normalA.y+edge.normalB.y,z:edge.normalA.z+edge.normalB.z}
    for(let i=0;i<positions.length;i+=3) {
     const excess=(positions[i]+object.position.x-edge.a.x)*n.x+
      (positions[i+1]+object.position.y-edge.a.y)*n.y+
      (positions[i+2]+object.position.z-edge.a.z)*n.z+2*Math.sin(edge.angle*Math.PI/180)
     assert.ok(excess<1e-5,`${sides}-sided prism has a vertex ${excess} beyond its chamfer`)
    }
   }
   assert.equal(readSolidManifold(getSolidBodies([object])[0],runtime,s=>s.status()),'NoError')
  }
 }
})

test('remaining edges after spherical blends support transformed sequential features and history replay',async()=>{
 const {editEdgeFeature}=await import('../src/edgeFeatures.ts')
 const shape={...box('continue'),dimensions:{x:20,y:20,z:20}}
 const edges=await findFeatureEdges([shape],[shape.id]),corner=edges[0].a
 const incident=edges.filter(e=>[e.a,e.b].some(p=>Math.hypot(p.x-corner.x,p.y-corner.y,p.z-corner.z)<1e-5))
 const first=(await previewEdgeFeature([shape],[shape.id],incident,'fillet',2)).object
 const moved={...first,position:{x:40,y:30,z:-20},rotation:{x:.2,y:.4,z:.1},scale:{x:-2,y:1,z:.5}}
 const original=serializeProject([moved]),restored=parseProject(original)[0]
 const available=await findFeatureEdges([restored],[restored.id])
 assert.ok(available.length>0 && available.length<12)
 // No tessellation seams or curved boundaries should be offered as box edges.
 assert.ok(available.every(e=>Math.abs(e.angle-90)<1e-4))
 for(const operation of ['fillet','chamfer']) {
  const added=(await previewEdgeFeature([restored],[restored.id],available[0],operation,.5)).object
  assert.equal(added.edgeHistory.features.length,2)
  assert.deepEqual(added.rotation,moved.rotation);assert.deepEqual(added.scale,moved.scale)
  const loaded=parseProject(serializeProject([added]))[0]
  const updated=(await editEdgeFeature([loaded],[loaded.id],loaded.edgeHistory.features[0].id,{operation:'fillet',size:1})).object
  assert.equal(updated.edgeHistory.features.length,2)
  const removed=(await editEdgeFeature([loaded],[loaded.id],loaded.edgeHistory.features[1].id,null)).object
  assert.equal(removed.meshData,first.meshData)
  assert.ok((await exportStl([updated])).byteLength>84)
 }
 assert.deepEqual(restored,parseProject(original)[0])
})

test('two-edge fillets blend all box corner orientations while retaining the third sharp edge',async()=>{
 const {Vector3}=await import('three')
 const {decodeStlMesh}=await import('../src/stlMesh.ts')
 const {editEdgeFeature}=await import('../src/edgeFeatures.ts')
 const shape={...box('paired'),position:{x:0,y:0,z:0},dimensions:{x:20,y:20,z:20}}
 const edges=await findFeatureEdges([shape],[shape.id]),runtime=await loadManifold()
 const v=p=>new Vector3(p.x,p.y,p.z)
 for(const x of [-10,10]) for(const y of [-10,10]) for(const z of [-10,10]) {
  const corner=new Vector3(x,y,z),incident=edges.filter(e=>[e.a,e.b].some(p=>v(p).distanceTo(corner)<1e-5))
  for(let omit=0;omit<3;omit++) for(const radius of [2,10]) {
   const selected=incident.filter((_,i)=>i!==omit)
   const axes=selected.map(e=>v(v(e.a).distanceTo(corner)<1e-5?e.b:e.a).sub(corner).normalize())
   const third=incident[omit];axes.push(v(v(third.a).distanceTo(corner)<1e-5?third.b:third.a).sub(corner).normalize())
   const result=(await previewEdgeFeature([shape],[shape.id],selected,'fillet',radius)).object
   const positions=decodeStlMesh(result.meshData);let patchVertices=0,sharpEnd=false
   for(let i=0;i<positions.length;i+=3) {
    const p=new Vector3(positions[i]+result.position.x,positions[i+1]+result.position.y,positions[i+2]+result.position.z).sub(corner)
    const [a,b,c]=axes.map(axis=>axis.dot(p))
    if(Math.abs(a)<1e-5 && Math.abs(b)<1e-5 && Math.abs(c-radius)<1e-4) sharpEnd=true
    if(a>1e-4 && b>1e-4 && a<radius-1e-4 && b<radius-1e-4 && c<radius+1e-4) {
     const expected=radius*(1-Math.sqrt(1-(1-a/radius)**2)*Math.sqrt(1-(1-b/radius)**2))
     // Measure normal error: vertical error exaggerates tessellation error
     // where the tangent patch meets a vertical side face.
     const sx=Math.sqrt(1-(1-a/radius)**2),sy=Math.sqrt(1-(1-b/radius)**2)
     const slope=Math.hypot(1,(1-a/radius)*sy/sx,(1-b/radius)*sx/sy)
     assert.ok(Math.abs(c-expected)/slope<radius*.003,`corner patch ${c} vs ${expected}`)
     patchVertices++
    }
   }
   assert.ok(patchVertices>100);assert.ok(sharpEnd,'third edge must end at the blend, not acquire a step')
   assert.equal(readSolidManifold(getSolidBodies([result])[0],runtime,s=>s.status()),'NoError')
  }
 }
 // Switch a stored meeting chamfer into a paired blend after Save/Load and transforms.
 const corner=edges[0].a,pair=edges.filter(e=>[e.a,e.b].some(p=>v(p).distanceTo(v(corner))<1e-5)).slice(0,2)
 const chamfer=(await previewEdgeFeature([shape],[shape.id],pair,'chamfer',2)).object
 const moved={...chamfer,position:{x:30,y:40,z:20},rotation:{x:.3,y:.5,z:.2},scale:{x:-1,y:2,z:1}}
 const loaded=parseProject(serializeProject([moved]))[0],id=loaded.edgeHistory.features[0].id
 const edited=(await editEdgeFeature([loaded],[loaded.id],id,{operation:'fillet',size:3})).object
 assert.deepEqual(edited.rotation,moved.rotation);assert.deepEqual(edited.scale,moved.scale)
 assert.ok((await exportStl([edited])).byteLength>84)
 const removed=(await editEdgeFeature([edited],[edited.id],id,null)).object
 assert.ok(Math.abs(readSolidManifold(getSolidBodies([removed])[0],runtime,s=>s.volume())-8000)<.01)
})

test('mesh curve quality changes detail, preserves shape and persists through history edits',async()=>{
 const {editEdgeFeature}=await import('../src/edgeFeatures.ts')
 const {decodeStlMesh}=await import('../src/stlMesh.ts')
 const shape={...box('quality'),dimensions:{x:20,y:20,z:20}},edges=await findFeatureEdges([shape],[shape.id])
 const runtime=await loadManifold(),counts=[]
 let previous
 for(const quality of ['standard','fine','extra-fine']) {
  const object=previous ? (await editEdgeFeature([previous],[previous.id],previous.edgeHistory.features[0].id,{operation:'fillet',size:2,quality})).object
   : (await previewEdgeFeature([shape],[shape.id],edges[0],'fillet',2,quality)).object
  assert.equal(object.edgeHistory.features[0].quality,quality)
  assert.deepEqual(parseProject(serializeProject([object])),[object])
  counts.push(decodeStlMesh(object.meshData).length)
  const volume=readSolidManifold(getSolidBodies([object])[0],runtime,s=>{assert.equal(s.status(),'NoError');return s.volume()})
  assert.ok(Math.abs(volume-(8000-20*4*(1-Math.PI/4)))<.2)
  previous=object
 }
 assert.ok(counts[0]<counts[1] && counts[1]<counts[2])
 const malformed=JSON.parse(serializeProject([previous]));malformed.objects[0].edgeHistory.features[0].quality='ultra'
 assert.throws(()=>parseProject(JSON.stringify(malformed)),/quality/)
 const legacy=structuredClone(previous);delete legacy.edgeHistory.features[0].quality
 const rebuilt=(await editEdgeFeature([legacy],[legacy.id],legacy.edgeHistory.features[0].id,{operation:'fillet',size:2})).object
 assert.equal(decodeStlMesh(rebuilt.meshData).length,counts[1])
})

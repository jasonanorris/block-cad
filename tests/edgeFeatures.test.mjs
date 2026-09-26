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
 await assert.rejects(()=>previewEdgeFeature([shape],[shape.id],edges[0],'fillet',100),/no larger/)
 await assert.rejects(()=>previewEdgeFeature([shape],[shape.id],edges[0],'fillet',NaN),/at least/)
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

import test from 'node:test'
import assert from 'node:assert/strict'
import { Vector3 } from 'three'
import { createHolePattern, defaultHolePattern, patternPoints } from '../src/holePatterns.ts'
import { faceWorkplane } from '../src/workplane.ts'
import { readSolidManifold, objectMatrix } from '../src/booleanGeometry.ts'
import { loadManifold } from '../src/manifoldRuntime.ts'
import { getSolidBodies } from '../src/cadModel.ts'
import { parseProject, serializeProject } from '../src/projectFile.ts'
import { assembly, box } from './fixtures.mjs'
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`)

test('row, grid and bolt circle positions are centered with requested spacing and offsets',()=>{
 const p={...defaultHolePattern,offsetX:2,offsetZ:3}
 assert.deepEqual(patternPoints(p),[{x:-8,z:3},{x:2,z:3},{x:12,z:3}])
 const grid=patternPoints({...p,layout:'grid',rows:2,columns:2});assert.deepEqual(grid,[{x:-3,z:-2},{x:7,z:-2},{x:-3,z:8},{x:7,z:8}])
 const circle=patternPoints({...p,layout:'circle',count:4,circleDiameter:20,startAngle:90})
 circle.forEach(point=>near(Math.hypot(point.x-2,point.z-3),10));near(circle[0].x,2);near(circle[0].z,13)
})

test('patterns cut blind pockets from finished top and link every cutter to the complete joined body',async()=>{
 const objects=assembly(),before=structuredClone(objects),p={...defaultHolePattern,count:2,spacingX:10,depth:4}
 const result=await createHolePattern(objects,'b',p,null)
 assert.equal(result.targetId,'a');assert.equal(result.holes.length,2)
 result.holes.forEach(h=>{assert.equal(h.cutTargetId,'a');assert.ok(h.groupedWithTarget);near(h.position.y-h.dimensions.height/2,16);near(h.position.y+h.dimensions.height/2,20.02)})
 const runtime=await loadManifold(),v=readSolidManifold(getSolidBodies(objects)[0],runtime,s=>s.volume())
 assert.ok(readSolidManifold(getSolidBodies([...objects,...result.holes])[0],runtime,s=>s.volume())<v)
 assert.deepEqual(parseProject(serializeProject(result.holes.concat(objects))).map(o=>o.id),result.holes.concat(objects).map(o=>o.id))
 assert.deepEqual(objects,before)
})

test('face patterns orient cylinders inward, and invalid counts or locked targets fail without edits',async()=>{
 const frame=faceWorkplane({x:10,y:10,z:0},{x:1,y:0,z:0}),objects=[box('a')]
 const result=await createHolePattern(objects,'a',{...defaultHolePattern,count:1,depth:5},frame)
 const hole=result.holes[0],bottom=new Vector3(0,-hole.dimensions.height/2,0).applyMatrix4(objectMatrix(hole))
 near(bottom.x,5);near(bottom.y,10);near(bottom.z,0)
 for(const changes of [{count:201},{count:2.5},{diameter:0},{layout:'grid',rows:100,columns:100},{depth:Infinity}])assert.throws(()=>patternPoints({...defaultHolePattern,...changes}))
 await assert.rejects(createHolePattern([{...objects[0],locked:true}],'a',defaultHolePattern,null),/unlocked/)
 await assert.rejects(createHolePattern(objects,'missing',defaultHolePattern,null),/target/)
})

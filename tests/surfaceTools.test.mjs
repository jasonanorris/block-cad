import test from 'node:test'
import assert from 'node:assert/strict'
import { Vector3 } from 'three'
import { alignPickedFaces, pointDistance } from '../src/surfaceTools.ts'
import { objectMatrix } from '../src/booleanGeometry.ts'
import { assembly, box } from './fixtures.mjs'
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`)
const source={objectId:'a',point:{x:10,y:10,z:0},normal:{x:1,y:0,z:0}}
const target={objectId:'target',point:{x:50,y:20,z:0},normal:{x:0,y:1,z:0}}

test('face alignment rigidly rotates every joined member and cutter, opposes normals and respects gap',()=>{
 const objects=[...assembly(),{...box('target',50),locked:true}],before=structuredClone(objects)
 objects[2].groupedWithTarget=undefined;before[2].groupedWithTarget=undefined
 objects[0].scale={x:-2,y:1,z:.5};before[0].scale={...objects[0].scale}
 const sourceLocal=new Vector3(source.point.x,source.point.y,source.point.z).applyMatrix4(objectMatrix(objects[0]).invert())
 const result=alignPickedFaces(objects,new Set(['a','b']),source,target,3)
 const transformed=sourceLocal.applyMatrix4(objectMatrix(result[0]))
 near(transformed.distanceTo(new Vector3(50,23,0)),0)
 // Compare world displacements to the expected -90 degree Z rotation about the pick.
 for(let i=0;i<3;i++){
  const expected=new Vector3(objects[i].position.x-10,objects[i].position.y-10,objects[i].position.z)
    .applyAxisAngle(new Vector3(0,0,1),-Math.PI/2).add(new Vector3(50,23,0))
  near(new Vector3(...Object.values(result[i].position)).distanceTo(expected),0)
  assert.deepEqual(result[i].scale,objects[i].scale)
 }
 assert.equal(result[3],objects[3]);assert.deepEqual(objects,before)
})

test('parallel opposing faces translate without rotation; invalid same-body or locked sources reject',()=>{
 const objects=[box('a'),box('target',50)],s={...source,point:{x:0,y:0,z:0},normal:{x:0,y:-1,z:0}}
 const result=alignPickedFaces(objects,new Set(['a']),s,target,0)
 for(const axis of ['x','y','z'])near(result[0].rotation[axis],objects[0].rotation[axis]);near(result[0].position.y,30)
 assert.throws(()=>alignPickedFaces(objects,new Set(['a']),source,{...target,objectId:'a'},0),/separate/)
 assert.throws(()=>alignPickedFaces([{...objects[0],locked:true},objects[1]],new Set(['a']),source,target,0),/unlocked/)
 assert.throws(()=>alignPickedFaces(objects,new Set(['a']),{...source,normal:{x:0,y:0,z:0}},target,0),/valid/)
 assert.throws(()=>alignPickedFaces(objects,new Set(['a']),source,target,NaN),/offset/)
})

test('point measurement returns Euclidean distance and signed world-axis differences without changing points',()=>{
 const a={x:2,y:3,z:4},b={x:5,y:-1,z:16},before=structuredClone([a,b])
 assert.deepEqual(pointDistance(a,b),{distance:13,delta:{x:3,y:-4,z:12}})
 assert.deepEqual(pointDistance(a,a),{distance:0,delta:{x:0,y:0,z:0}})
 assert.deepEqual([a,b],before)
 assert.throws(()=>pointDistance(a,{x:NaN,y:0,z:0}),/finite/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { Vector3 } from 'three'
import { resizeSelection } from '../src/resizeSelection.ts'
import { getPlacementBounds, getPlacementUnits } from '../src/placement.ts'
import { parseProject, serializeProject } from '../src/projectFile.ts'
import { box, assembly } from './fixtures.mjs'
const bounds = (objects, ids) => Promise.all(getPlacementUnits(objects, new Set(ids)).map(getPlacementBounds)).then(boxes=>boxes.reduce((a,b)=>a.union(b)))
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-4, `${a} != ${b}`)

test('resize uses total world bounds and uniformly scales rotated reflected sources about the same center', async () => {
  const source=[box('a',-30,40,10),box('b',40,30,-10),box('outside',200)]
  source[0].rotation.y=.6; source[0].scale={x:-2,y:3,z:1}
  const original=structuredClone(source), ids=new Set(['a','b'])
  const before=await bounds(source,ids)
  for(const axis of ['x','y','z']) {
    const result=await resizeSelection(source,ids,axis,125)
    const after=await bounds(result,ids)
    near(after.max[axis]-after.min[axis],125)
    near(after.getCenter(new Vector3()).distanceTo(before.getCenter(new Vector3())),0)
    const ratio=125/(before.max[axis]-before.min[axis])
    for(const key of ['x','y','z']) near(result[0].scale[key],source[0].scale[key]*ratio)
    assert.deepEqual(result[0].rotation,source[0].rotation)
    assert.equal(result[2],source[2])
    assert.deepEqual(parseProject(serializeProject(result)),result)
  }
  assert.deepEqual(source,original)
})

test('resize uses cut intersection bounds, carries all cutters, and handles no-op sizing', async () => {
  const source=assembly('intersection'); source[2].groupedWithTarget=undefined
  const before=await bounds(source,['a'])
  const result=await resizeSelection(source,new Set(['a','b','hole']),'x',30)
  const after=await bounds(result,['a'])
  near(after.max.x-after.min.x,30)
  near(after.getCenter(new Vector3()).distanceTo(before.getCenter(new Vector3())),0)
  near(result[2].scale.x,3)
  near(result[1].position.x-result[0].position.x,30)
  assert.equal(await resizeSelection(result,new Set(['a']),'x',30),result)
})

test('resize rejects invalid sizes, hidden/locked dependencies, empty results and degenerate scales atomically', async () => {
  for(const size of [0,-1,NaN,Infinity,1e-12,1e308]) {
    const source=[box('a',1e308)],original=structuredClone(source)
    await assert.rejects(resizeSelection(source,new Set(['a']),'x',size))
    assert.deepEqual(source,original)
  }
  for(const flag of ['hidden','locked']) {
    const source=assembly();source[2][flag]=true
    await assert.rejects(resizeSelection(source,new Set(['a']),'x',50),/unlock/)
  }
  const empty=assembly('intersection');empty[1].position.x=100
  await assert.rejects(resizeSelection(empty,new Set(['a']),'x',50),/empty/)
  const flat=box('flat');flat.scale.y=0
  await assert.rejects(resizeSelection([flat],new Set(['flat']),'x',50),/nonzero/)
})

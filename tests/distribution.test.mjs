import test from 'node:test'
import assert from 'node:assert/strict'
import { distributeByBounds, getPlacementBounds, getPlacementUnits } from '../src/placement.ts'
import { box, assembly } from './fixtures.mjs'
const bounds = (objects, id) => getPlacementBounds(getPlacementUnits(objects, new Set([id]))[0])
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-5, `${a} != ${b}`)

test('distribution sorts spatially, preserves endpoints, and spaces unequal bodies by finished gaps on every axis', async () => {
  for (const axis of ['x','y','z']) {
    const objects = [box('middle'),box('last'),box('first')]
    objects[0].position[axis]=25; objects[1].position[axis]=100; objects[2].position[axis]=0
    objects[0].dimensions[axis]=30; objects[1].dimensions[axis]=40
    const original=structuredClone(objects)
    const result=await distributeByBounds(objects,new Set(objects.map(o=>o.id)),axis,'gaps')
    const [a,b,c]=await Promise.all(['first','middle','last'].map(id=>bounds(result,id)))
    near(b.min[axis]-a.max[axis],c.min[axis]-b.max[axis])
    assert.equal(result[1],objects[1]); assert.equal(result[2],objects[2])
    assert.deepEqual(objects,original)
    const centers=await distributeByBounds(objects,new Set(objects.map(o=>o.id)),axis,'centers')
    near(centers[0].position[axis],50)
  }
})

test('distribution counts an intersection as one body and carries its ungrouped cutters once', async () => {
  const objects=[...assembly('intersection'),box('left',-50),box('right',100)]
  objects[2].groupedWithTarget=undefined
  const result=await distributeByBounds(objects,new Set(objects.map(o=>o.id)),'x','centers')
  const finished=await bounds(result,'a')
  near((finished.min.x+finished.max.x)/2,25)
  near(result[1].position.x-result[0].position.x,10)
  near(result[2].position.x-result[0].position.x,5)
})

test('distribution rejects too few bodies, insufficient gap space, hidden/locked cutters, and empty geometry', async () => {
  await assert.rejects(distributeByBounds([box('a')],new Set(['a']),'x','gaps'),/three/)
  const crowded=[box('a'),box('b',5),box('c',10)]
  await assert.rejects(distributeByBounds(crowded,new Set(['a','b','c']),'x','gaps'),/room/)
  for(const flag of ['hidden','locked']) {
    const objects=[...assembly(),box('left',-50),box('right',100)]
    objects[2][flag]=true
    await assert.rejects(distributeByBounds(objects,new Set(['a','left','right']),'x','centers'),/unlock/)
  }
  const objects=[...assembly('intersection'),box('left',-50),box('right',100)]
  objects[1].position.x=50
  await assert.rejects(distributeByBounds(objects,new Set(['a','left','right']),'x','centers'),/empty/)
})

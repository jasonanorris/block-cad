import test from 'node:test'
import assert from 'node:assert/strict'
import { splitSelection } from '../src/splitSelection.ts'
import { getSolidBodies } from '../src/cadModel.ts'
import { readSolidManifold, objectMatrix } from '../src/booleanGeometry.ts'
import { loadManifold } from '../src/manifoldRuntime.ts'
import { getPlacementBounds, getPlacementUnits } from '../src/placement.ts'
import { parseProject, serializeProject } from '../src/projectFile.ts'
import { exportStl } from '../src/stlExport.ts'
import { export3mf } from '../src/threeMfExport.ts'
import { assembly, box } from './fixtures.mjs'
const near = (a, b) => assert.ok(Math.abs(a-b)<.01, `${a} != ${b}`)
const volume = (objects, runtime) => getSolidBodies(objects).reduce((sum, body) => sum + readSolidManifold(body,runtime,s => s.volume()) * Math.abs(objectMatrix(body.anchor).determinant()),0)

test('split bakes joined/cut bodies into capped independent meshes and retains world volume and color', async () => {
  const objects = assembly(); objects[0].color='#12ab34';objects[2].groupedWithTarget=undefined
  const original=structuredClone(objects),runtime=await loadManifold()
  const result=await splitSelection(objects,new Set(['a','b','hole']),'y',10)
  assert.equal(result.objects.length,2);assert.equal(result.selectedIds.length,2)
  assert.ok(result.objects.every(o=>o.type==='stl' && o.color==='#12ab34' && !o.cutTargetId && !o.joinGroupId))
  near(volume(result.objects,runtime),volume(objects,runtime))
  const units=getPlacementUnits(result.objects,new Set(result.selectedIds))
  const [high,low]=await Promise.all(units.map(getPlacementBounds))
  near(high.min.y,10);near(low.max.y,10)
  assert.deepEqual(parseProject(serializeProject(result.objects)),result.objects)
  assert.ok((await exportStl(result.objects)).byteLength>84)
  assert.ok((await export3mf(result.objects)).byteLength>100)
  assert.deepEqual(objects,original)
})

test('split handles reflected rotated scaled solids on every axis without moving unrelated bodies', async () => {
  const runtime=await loadManifold()
  for (const axis of ['x','y','z']) {
    const object={...box('a',40,-30,25),rotation:{x:.4,y:.3,z:.7},scale:{x:-2,y:3,z:.5}}
    const other=box('other',100)
    const result=await splitSelection([object,other],new Set(['a']),axis,object.position[axis])
    assert.equal(result.objects[0],other)
    near(volume(result.objects.slice(1),runtime),volume([object],runtime))
    const [high,low]=await Promise.all(getPlacementUnits(result.objects,new Set(result.selectedIds)).map(getPlacementBounds))
    near(high.min[axis],object.position[axis]);near(low.max[axis],object.position[axis])
  }
})

test('split rejects planes outside or tangent to a body and invalid/locked/hidden dependencies atomically', async () => {
  for (const position of [-1,0,20,21,Infinity]) await assert.rejects(splitSelection([box('a')],new Set(['a']),'y',position))
  for (const property of ['locked','hidden']) {
    const objects=assembly();objects[2][property]=true
    await assert.rejects(splitSelection(objects,new Set(['a']),'y',10),/unlock/)
  }
  const objects=assembly();objects[2].groupedWithTarget=undefined
  await assert.rejects(splitSelection(objects,new Set(['hole']),'y',10),/solids/)
  const multiple=[box('a'),box('b',0,50)],before=structuredClone(multiple)
  await assert.rejects(splitSelection(multiple,new Set(['a','b']),'y',10),/both sides/)
  assert.deepEqual(multiple,before)
})

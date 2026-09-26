import test from 'node:test'
import assert from 'node:assert/strict'
import { positionFromReference, selectionReference } from '../src/referenceOrigin.ts'
import { assembly, box } from './fixtures.mjs'
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`)

test('reference offsets use finished bounds and translate a multi-body selection and every cutter together', async () => {
  const objects = [...assembly('intersection'), box('other', 50)]
  objects[2].groupedWithTarget = undefined
  const before = structuredClone(objects)
  const ids = new Set(['a', 'b', 'hole', 'other'])
  const origin = { x: 100, y: -30, z: 5 }, offset = { x: 7, y: 2, z: -4 }
  for (const edge of ['min', 'center', 'max']) {
    const result = await positionFromReference(objects, ids, edge, origin, offset)
    const point = await selectionReference(result, ids, edge)
    for (const axis of ['x', 'y', 'z']) {
      near(point[axis], origin[axis] + offset[axis])
      const shift = result[0].position[axis] - objects[0].position[axis]
      result.forEach((object, i) => near(object.position[axis] - objects[i].position[axis], shift))
    }
  }
  assert.deepEqual(objects, before)
})

test('reference positioning rejects hidden/locked linked cutters and invalid coordinates', async () => {
  for (const property of ['locked', 'hidden']) {
    const objects = assembly(); objects[2][property] = true
    await assert.rejects(positionFromReference(objects, new Set(['a']), 'min', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }), /Show and unlock/)
  }
  await assert.rejects(positionFromReference([box('a')], new Set(['a']), 'min', { x: NaN, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }), /finite/)
})

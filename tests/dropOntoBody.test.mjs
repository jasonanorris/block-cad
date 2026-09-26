import test from 'node:test'
import assert from 'node:assert/strict'
import { dropOntoBody } from '../src/dropOntoBody.ts'
import { getPlacementUnits, getPlacementBounds } from '../src/placement.ts'
import { box, assembly } from './fixtures.mjs'
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-4, `${a} != ${b}`)
const bottom = async (objects, id) => (await getPlacementBounds(getPlacementUnits(objects, new Set([id]))[0])).min.y

test('surface drop places multiple bodies independently, carries all cutters and leaves a locked target fixed', async () => {
  const objects = [...assembly(), box('other', -5, 80), { ...box('target', 0, -30), dimensions: { x: 100, y: 20, z: 100 }, locked: true }]
  objects[2].groupedWithTarget = undefined
  const before = structuredClone(objects)
  const result = await dropOntoBody(objects, new Set(['a', 'other']), 'target')
  near(await bottom(result, 'a'), -20); near(await bottom(result, 'other'), -20)
  for (let i = 0; i < 3; i++) near(result[i].position.y - objects[i].position.y, -20)
  assert.equal(result[4], objects[4]); assert.deepEqual(objects, before)
  result.forEach((object, i) => { near(object.position.x, objects[i].position.x); near(object.position.z, objects[i].position.z) })
})

test('surface drop finds a pocket floor and rejects a through hole without footprint support', async () => {
  const objects = [box('target'), { ...box('pocket', 0, 17.5), dimensions: { x: 8, y: 25, z: 8 }, cutTargetId: 'target' },
    { ...box('moving', 0, 50), dimensions: { x: 2, y: 2, z: 2 } }]
  const result = await dropOntoBody(objects, new Set(['moving']), 'target')
  near(result[2].position.y, 6)
  objects[1] = { ...objects[1], position: { x: 0, y: 10, z: 0 }, dimensions: { x: 8, y: 40, z: 8 } }
  await assert.rejects(dropOntoBody(objects, new Set(['moving']), 'target'), /does not overlap/)
})

test('surface contact can occur inside a source face on a rotated target ridge', async () => {
  const objects = [{ ...box('target'), rotation: { x: 0, y: 0, z: Math.PI / 4 }, scale: { x: -1, y: 1, z: 1 } },
    { ...box('moving', 0, 0), dimensions: { x: 4, y: 2, z: 4 } }]
  const result = await dropOntoBody(objects, new Set(['moving']), 'target')
  near(result[1].position.y, 10 + 10 * Math.sqrt(2) + 1)
})

test('surface drop rejects selected targets, detached cutters, hidden targets, locked linked holes and nonoverlap atomically', async () => {
  await assert.rejects(dropOntoBody([box('a')], new Set(['a']), 'a'), /separate/)
  await assert.rejects(dropOntoBody([box('a'), box('b', 100)], new Set(['a']), 'b'), /does not overlap/)
  await assert.rejects(dropOntoBody([box('a'), { ...box('b'), hidden: true }], new Set(['a']), 'b'), /visible target/)
  const objects = [...assembly(), box('target', 0, -20)]
  objects[2].groupedWithTarget = undefined
  await assert.rejects(dropOntoBody(objects, new Set(['hole']), 'target'), /solids/)
  objects[2].locked = true
  await assert.rejects(dropOntoBody(objects, new Set(['a']), 'target'), /unlocked/)
  const multiple = [box('a'), box('far', 100), box('target', 0, -20)], before = structuredClone(multiple)
  await assert.rejects(dropOntoBody(multiple, new Set(['a', 'far']), 'target'), /does not overlap/)
  assert.deepEqual(multiple, before)
})

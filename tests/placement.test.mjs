import test from 'node:test'
import assert from 'node:assert/strict'
import { alignByBounds, dropToWorkplane, getPlacementBounds, getPlacementUnits } from '../src/placement.ts'
import { encodeStlMesh } from '../src/stlMesh.ts'
import { box, assembly } from './fixtures.mjs'

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-5, `${actual} != ${expected}`)
const boundsFor = (objects, id) => getPlacementBounds(getPlacementUnits(objects, new Set([id]))[0])

test('min/center/max alignment uses rotated and reflected bounds on all world axes', async () => {
  for (const edge of ['min', 'center', 'max']) for (const axis of ['x', 'y', 'z']) {
    const source = [box('fixed'), { ...box('moving', 80, 70, 60), dimensions: { x: 40, y: 10, z: 30 },
      rotation: { x: .2, y: .4, z: Math.PI / 2 }, scale: { x: -2, y: 1, z: 1 } }]
    const before = structuredClone(source)
    const result = await alignByBounds(source, new Set(['fixed', 'moving']), 'fixed', axis, edge)
    const fixed = await boundsFor(result, 'fixed')
    const moving = await boundsFor(result, 'moving')
    const coord = (b) => edge === 'center' ? (b.min[axis] + b.max[axis]) / 2 : b[edge][axis]
    near(coord(moving), coord(fixed))
    assert.equal(result[0], source[0])
    assert.deepEqual(source, before)
  }
})

test('intersection alignment follows the finished volume and moves every linked cutter once', async () => {
  const objects = [...assembly('intersection'), box('fixed', 100)]
  objects[2].groupedWithTarget = undefined
  const result = await alignByBounds(objects, new Set(objects.map((o) => o.id)), 'fixed', 'x', 'min')
  near((await boundsFor(result, 'a')).min.x, 90)
  near(result[0].position.x, 90)
  near(result[1].position.x, 100)
  near(result[2].position.x, 95)
  assert.equal(result[3], objects[3])
  assert.equal(getPlacementUnits(objects, new Set(['a', 'b', 'hole'])).length, 1)
})

test('a separately selected ungrouped hole can be aligned without moving its target', async () => {
  const objects = [...assembly(), box('fixed', 100)]
  objects[2].groupedWithTarget = undefined
  const result = await alignByBounds(objects, new Set(['hole', 'fixed']), 'fixed', 'x', 'center')
  near(result[2].position.x, 100)
  assert.equal(result[0], objects[0])
  assert.equal(result[1], objects[1])
})

test('locked, hidden, and empty bodies reject positioning without modifying input', async () => {
  for (const property of ['locked', 'hidden']) {
    const objects = [...assembly(), { ...box('fixed', 100), [property]: true }]
    const before = structuredClone(objects)
    await assert.rejects(alignByBounds(objects, new Set(['a', 'fixed']), 'fixed', 'x', 'min'), /Show and unlock/)
    assert.deepEqual(objects, before)
  }
  const objects = [...assembly('intersection'), box('fixed', 100)]
  objects[1].position.x = 50
  await assert.rejects(alignByBounds(objects, new Set(['a', 'fixed']), 'fixed', 'x', 'min'), /empty/)
})

test('imported mesh bounds use transformed vertices rather than transformed bounding-box corners', async () => {
  const vertices = [[0, 0, 0], [10, 0, 0], [0, 20, 0], [0, 0, 30]]
  const triangles = [[0, 2, 1], [0, 1, 3], [0, 3, 2], [1, 2, 3]]
  const object = { ...box('mesh', 0, 0, 0), type: 'stl', rotation: { x: 0, y: Math.PI / 4, z: 0 },
    dimensions: { x: 10, y: 20, z: 30 }, meshData: encodeStlMesh(new Float32Array(triangles.flatMap((t) => t.flatMap((i) => vertices[i])))) }
  const bounds = await boundsFor([object], 'mesh')
  near(bounds.max.x, 30 / Math.sqrt(2))
  near(bounds.min.z, -10 / Math.sqrt(2))
})

test('drop places each rotated body on a raised or negative plane without changing X/Z', async () => {
  const objects = [box('a', 50, 100, 60), { ...box('b', -30, -50, 80),
    rotation: { x: Math.PI / 4, y: .3, z: .1 }, scale: { x: -2, y: 1, z: 1 } }]
  for (const height of [25, -15]) {
    const result = await dropToWorkplane(objects, new Set(['a', 'b']), height)
    for (const [index, object] of result.entries()) {
      near((await boundsFor(result, object.id)).min.y, height)
      assert.equal(object.position.x, objects[index].position.x)
      assert.equal(object.position.z, objects[index].position.z)
      assert.deepEqual(object.rotation, objects[index].rotation)
    }
  }
})

test('drop uses the cut bottom and preserves ungrouped cutter offsets', async () => {
  const objects = [box('solid'), { ...box('hole', 0, 0), dimensions: { x: 30, y: 20, z: 30 }, cutTargetId: 'solid' }]
  near((await boundsFor(objects, 'solid')).min.y, 10)
  const result = await dropToWorkplane(objects, new Set(['solid', 'hole']), 5)
  near((await boundsFor(result, 'solid')).min.y, 5)
  near(result[0].position.y, 5)
  near(result[1].position.y, -5)
  assert.deepEqual(objects.map((object) => object.position.y), [10, 0])
})

test('dropping a joined assembly moves it once and keeps member offsets', async () => {
  const objects = assembly('intersection')
  const result = await dropToWorkplane(objects, new Set(['a', 'b', 'hole']), 30)
  near((await boundsFor(result, 'a')).min.y, 30)
  assert.deepEqual(result.map((object) => object.position.y), [40, 40, 40])
  const second = await dropToWorkplane(result, new Set(['a']), 30)
  assert.ok(second.every((object, index) => object === result[index]))
})

test('drop fails atomically for hidden, locked, empty, or invalid selections', async () => {
  for (const property of ['hidden', 'locked']) {
    const objects = [box('a'), { ...box('b'), [property]: true }]
    await assert.rejects(dropToWorkplane(objects, new Set(['a', 'b']), 30), /Show and unlock/)
    near(objects[0].position.y, 10)
  }
  const empty = assembly('intersection')
  empty[1].position.x = 100
  await assert.rejects(dropToWorkplane(empty, new Set(['a']), 30), /empty/)
  await assert.rejects(dropToWorkplane([box('a')], new Set(['a']), NaN), /finite/)
})

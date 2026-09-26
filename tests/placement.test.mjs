import test from 'node:test'
import assert from 'node:assert/strict'
import { alignByBounds, getPlacementBounds, getPlacementUnits } from '../src/placement.ts'
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

import test from 'node:test'
import assert from 'node:assert/strict'
import { measureSelection } from '../src/measurements.ts'
import { box, assembly } from './fixtures.mjs'

test('finished measurements collapse joined members and use intersection bounds', async () => {
  const source = assembly('intersection')
  const data = await measureSelection(source, ['a', 'b', 'hole'], 'b')
  assert.deepEqual(data.size, [10, 20, 20])
  assert.equal(data.span, null)
  assert.deepEqual(data.gaps, [])
})

test('gaps are symmetric axis separations with zero for overlapping projections', async () => {
  const source = [box('a'), box('b', 35, 15, -50)]
  const data = await measureSelection(source, ['a', 'b'], 'a')
  assert.deepEqual(data.gaps[0].axes, [15, 0, 30])
  assert.deepEqual(data.span, [55, 25, 70])
  assert.deepEqual((await measureSelection(source, ['a', 'b'], 'b')).gaps[0].axes, [15, 0, 30])
})

test('measurement uses rotated world dimensions and rejects empty finished geometry', async () => {
  const a = box('a'); a.rotation.y = Math.PI / 4
  const data = await measureSelection([a], ['a'], 'a')
  assert.ok(Math.abs(data.size[0] - 20 * Math.SQRT2) < 1e-5)
  const source = assembly('intersection'); source[1].position.x = 100
  await assert.rejects(measureSelection(source, ['a'], 'a'), /empty/)
  assert.equal((await measureSelection([], [], null)).size, null)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { repeatSelection } from '../src/repeatSelection.ts'
import { box, assembly } from './fixtures.mjs'

test('arrays count the original, use equal signed spacing, and keep source data unchanged', () => {
  const objects = [box('a', 10, 20, 30), box('b', 40, 50, 60)]
  const result = repeatSelection(objects, new Set(['a', 'b']), 'z', 4, -15)
  assert.deepEqual(result.copies.map((o) => o.position.z), [15, 45, 0, 30, -15, 15])
  assert.deepEqual(result.copies.map((o) => o.position.x), [10, 40, 10, 40, 10, 40])
  assert.equal(new Set(result.copies.map((o) => o.id)).size, 6)
  assert.deepEqual(objects.map((o) => o.position.z), [30, 60])
})

test('each repeated assembly has independent solid and cutter links', () => {
  const source = assembly('intersection')
  source[0].locked = true
  const { copies } = repeatSelection(source, new Set(['b']), 'x', 3, 40)
  assert.equal(copies.length, 6)
  assert.notEqual(copies[0].joinGroupId, copies[3].joinGroupId)
  for (const offset of [0, 3]) {
    assert.equal(copies[offset].joinGroupId, copies[offset + 1].joinGroupId)
    assert.equal(copies[offset].joinMode, 'intersection')
    assert.equal(copies[offset + 2].cutTargetId, copies[offset].id)
    assert.equal(copies[offset].locked, undefined)
  }
})

test('array validation prevents empty offsets, fractional counts, overflow, and oversized batches', () => {
  for (const [count, spacing] of [[1, 10], [2.5, 10], [101, 10], [3, 0], [3, NaN], [3, 1e308]]) {
    assert.throws(() => repeatSelection([box('a')], new Set(['a']), 'x', count, spacing))
  }
  const objects = Array.from({ length: 11 }, (_, i) => box(String(i)))
  assert.throws(() => repeatSelection(objects, new Set(objects.map((o) => o.id)), 'x', 100, 10), /1,000/)
})

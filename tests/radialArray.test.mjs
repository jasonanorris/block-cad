import test from 'node:test'
import assert from 'node:assert/strict'
import { Matrix4, Vector3 } from 'three'
import { objectMatrix } from '../src/booleanGeometry.ts'
import { radialArray } from '../src/radialArray.ts'
import { parseProject, serializeProject } from '../src/projectFile.ts'
import { box, assembly } from './fixtures.mjs'

const close = (a, b) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-7, `${v} != ${b[i]}`))

test('radial copies rotate positions and orientations about an arbitrary pivot on all axes', () => {
  for (const axis of ['x', 'y', 'z']) {
    const source = box('a', 40, 10, -10)
    source.rotation = { x: .2, y: .5, z: -.1 }; source.scale = { x: -2, y: 3, z: 4 }
    const original = structuredClone(source)
    const center = { x: 5, y: -10, z: 7 }
    const { copies } = radialArray([source], new Set(['a']), axis, 4, -90, center)
    const direction = new Vector3(); direction[axis] = 1
    for (let i = 0; i < copies.length; i++) {
      const expected = new Matrix4().makeTranslation(center.x, center.y, center.z)
        .multiply(new Matrix4().makeRotationAxis(direction, -(i + 1) * Math.PI / 2))
        .multiply(new Matrix4().makeTranslation(-center.x, -center.y, -center.z)).multiply(objectMatrix(source))
      close(objectMatrix(copies[i]).elements, expected.elements)
      assert.deepEqual(copies[i].scale, source.scale)
    }
    assert.deepEqual(source, original)
    assert.deepEqual(parseProject(serializeProject(copies)), JSON.parse(JSON.stringify(copies)))
  }
})

test('radial arrays keep each joined assembly and its cutters independently editable', () => {
  const { copies } = radialArray(assembly('intersection'), new Set(['b']), 'y', 3, 120, { x: 0, y: 0, z: 0 })
  assert.equal(copies.length, 6)
  assert.notEqual(copies[0].joinGroupId, copies[3].joinGroupId)
  for (const offset of [0, 3]) {
    assert.equal(copies[offset].joinGroupId, copies[offset + 1].joinGroupId)
    assert.equal(copies[offset + 2].cutTargetId, copies[offset].id)
    assert.equal(copies[offset].joinMode, 'intersection')
  }
})

test('radial validation rejects invalid counts, angles, pivots, and oversized arrays', () => {
  const source = [box('a')], ids = new Set(['a']), pivot = { x: 0, y: 0, z: 0 }
  for (const count of [1, 2.5, 101, NaN]) assert.throws(() => radialArray(source, ids, 'y', count, 90, pivot))
  for (const angle of [0, 360, -360, Infinity, NaN]) assert.throws(() => radialArray(source, ids, 'y', 4, angle, pivot))
  assert.throws(() => radialArray(source, ids, 'y', 4, 90, { ...pivot, x: Infinity }))
  const many = Array.from({ length: 11 }, (_, i) => box(String(i)))
  assert.throws(() => radialArray(many, new Set(many.map(o => o.id)), 'y', 100, 10, pivot), /1,000/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { Vector3 } from 'three'
import { sourceBounds, createSnapSnapshot, snapTranslation } from '../src/objectSnapping.ts'
import { box, assembly } from './fixtures.mjs'

test('drag snapping aligns the nearest edge or center only on handle axes and releases outside tolerance', () => {
  const snapshot = createSnapSnapshot([box('a'), box('b', 35, 30, 20)], 'a', new Set(['a', 'b']))
  const snap = (x, handle = 'X') => snapTranslation(snapshot.bounds, snapshot.targets, new Vector3(x, 1, 1), handle)
  assert.deepEqual(snap(14).offset.toArray(), [15, 1, 1])
  assert.equal(snap(14).matches[0].target, 'box #2')
  assert.deepEqual(snap(12).offset.toArray(), [12, 1, 1])
  assert.deepEqual(snap(34).offset.toArray(), [35, 1, 1])
  assert.deepEqual(snap(14, 'XZ').offset.toArray(), [15, 1, 0])
  assert.deepEqual(snap(14, '').matches, [])
})

test('snap targets exclude moving assemblies and invisible shapes but allow locked references and hole targets', () => {
  const objects = [...assembly(), box('hidden', 50), box('reference', 100), box('unrendered', 150)]
  objects[3].hidden = true; objects[4].locked = true
  const visible = new Set(objects.map(o => o.id)); visible.delete('unrendered')
  const snapshot = createSnapSnapshot(objects, 'b', visible)
  assert.deepEqual(snapshot.targets.map(t => t.id), ['reference'])
  assert.ok(createSnapSnapshot(objects, 'hole', visible).targets.some(t => t.id === 'a'))
  assert.equal(createSnapSnapshot(objects, 'reference', visible), null)
})

test('source bounds include rotations, negative scale, and nonuniform scale', () => {
  const a = box('a'); a.scale.x = -2; a.rotation.y = Math.PI / 2
  const size = sourceBounds(a).getSize(new Vector3())
  assert.ok(Math.abs(size.x - 20) < 1e-6)
  assert.ok(Math.abs(size.z - 40) < 1e-6)
})

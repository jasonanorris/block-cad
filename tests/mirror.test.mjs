import test from 'node:test'
import assert from 'node:assert/strict'
import { Box3, Matrix4, Euler, Quaternion, Vector3 } from 'three'
import { mirrorSelection } from '../src/mirrorSelection.ts'
import { getPlacementBounds, getPlacementUnits } from '../src/placement.ts'
import { box, assembly } from './fixtures.mjs'

function matrix(object) {
  const v = (p) => new Vector3(p.x, p.y, p.z)
  return new Matrix4().compose(v(object.position), new Quaternion().setFromEuler(
    new Euler(object.rotation.x, object.rotation.y, object.rotation.z)), v(object.scale))
}

test('mirror reflects rotated nonuniform shapes exactly about the selection center on every axis', async () => {
  const objects = [{ ...box('a', -20), rotation: { x: .4, y: .7, z: .2 }, scale: { x: -2, y: 3, z: 1 } }, box('b', 45)]
  const ids = new Set(['a', 'b'])
  const bounds = new Box3()
  for (const unit of getPlacementUnits(objects, ids)) bounds.union(await getPlacementBounds(unit))
  const center = bounds.getCenter(new Vector3())
  for (const axis of ['x', 'y', 'z']) {
    const result = await mirrorSelection(objects, ids, axis)
    for (let i = 0; i < objects.length; i++) for (const sample of [[0, 0, 0], [4, -3, 7], [-8, 6, 2]]) {
      const expected = new Vector3(...sample).applyMatrix4(matrix(objects[i]))
      expected[axis] = 2 * center[axis] - expected[axis]
      const actual = new Vector3(...sample).applyMatrix4(matrix(result[i]))
      assert.ok(actual.distanceTo(expected) < 1e-8)
    }
    const twice = await mirrorSelection(result, ids, axis)
    objects.forEach((object, i) => matrix(object).elements.forEach((value, j) =>
      assert.ok(Math.abs(value - matrix(twice[i]).elements[j]) < 1e-7)))
  }
})

test('mirroring assemblies carries linked holes once and preserves links', async () => {
  const objects = [...assembly('intersection'), box('untouched', 200)]
  const result = await mirrorSelection(objects, new Set(['a', 'b', 'hole']), 'x')
  assert.ok(Math.abs(result[0].position.x - 10) < 1e-8)
  assert.ok(Math.abs(result[1].position.x) < 1e-8)
  assert.equal(result[2].cutTargetId, 'a')
  assert.equal(result[2].position.x, 5)
  assert.equal(result[3], objects[3])
})

test('mirror refuses locked members and degenerate transforms', async () => {
  await assert.rejects(mirrorSelection([{ ...box('a'), locked: true }], new Set(['a']), 'x'), /unlock/)
  await assert.rejects(mirrorSelection([{ ...box('a'), scale: { x: 0, y: 1, z: 1 } }], new Set(['a']), 'x'), /nonzero/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { Euler, Vector3 } from 'three'
import { faceWorkplane, onFaceWorkplane, dropToFaceWorkplane } from '../src/workplane.ts'
import { objectMatrix } from '../src/booleanGeometry.ts'
import { getPlacementUnits, placementGeometry } from '../src/placement.ts'
import { createCadObject } from '../src/cadModel.ts'
import { assembly, box } from './fixtures.mjs'
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-4, `${a} != ${b}`)

test('face frames preserve handedness and put new shapes on horizontal, vertical, underside and oblique faces', () => {
  for (const normal of [{ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }, { x: 1, y: 2, z: 3 }]) {
    const frame = faceWorkplane({ x: 10, y: 20, z: -5 }, normal)
    const rotation = new Euler(frame.rotation.x, frame.rotation.y, frame.rotation.z)
    const up = new Vector3(0, 1, 0).applyEuler(rotation)
    near(up.distanceTo(new Vector3(normal.x, normal.y, normal.z).normalize()), 0)
    for (const type of ['box', 'cylinder', 'sphere', 'cone', 'wedge', 'prism']) {
      const [placed] = onFaceWorkplane([createCadObject(type)], frame)
      const bottom = new Vector3(0, -10, 0).applyMatrix4(objectMatrix(placed))
      near(bottom.distanceTo(new Vector3(10, 20, -5)), 0)
      near(objectMatrix(placed).determinant(), 1)
    }
  }
})

test('face placement rigidly transforms assemblies, preserving reflection, scale and relative cutter positions', () => {
  const objects = assembly(); objects[0].scale.x = -2
  objects[0].rotation = { x: .2, y: .6, z: .1 }
  const before = structuredClone(objects)
  const frame = faceWorkplane({ x: 40, y: 8, z: -12 }, { x: 2, y: -1, z: 1 })
  const result = onFaceWorkplane(objects, frame)
  const rotation = new Euler(frame.rotation.x, frame.rotation.y, frame.rotation.z)
  objects.forEach((object, i) => {
    const expected = new Vector3(3, 4, 5).applyMatrix4(objectMatrix(object)).applyEuler(rotation).add(new Vector3(40, 8, -12))
    const actual = new Vector3(3, 4, 5).applyMatrix4(objectMatrix(result[i]))
    near(actual.distanceTo(expected), 0)
    assert.deepEqual(result[i].scale, object.scale)
  })
  assert.deepEqual(objects, before)
})

test('drop to an oblique plane uses finished vertices and carries linked holes without rotating', async () => {
  const objects = assembly('intersection'); objects[2].groupedWithTarget = undefined
  objects[0].scale.x = -1
  const normal = new Vector3(1, 2, 3).normalize()
  const frame = faceWorkplane({ x: 10, y: 30, z: 40 }, normal)
  const result = await dropToFaceWorkplane(objects, new Set(['a', 'b']), frame)
  const geometry = await placementGeometry(getPlacementUnits(result, new Set(['a']))[0].body)
  try {
    let minimum = Infinity
    const p = geometry.getAttribute('position')
    for (let i = 0; i < p.count; i++) minimum = Math.min(minimum, new Vector3().fromBufferAttribute(p, i).dot(normal))
    near(minimum, normal.dot(new Vector3(10, 30, 40)))
  } finally { geometry.dispose() }
  const delta = new Vector3(result[0].position.x - objects[0].position.x, result[0].position.y - objects[0].position.y, result[0].position.z - objects[0].position.z)
  near(delta.clone().cross(normal).length(), 0)
  result.forEach((object, i) => {
    near(object.position.x - objects[i].position.x, delta.x)
    assert.deepEqual(object.rotation, objects[i].rotation)
  })
  objects[2].locked = true
  await assert.rejects(dropToFaceWorkplane(objects, new Set(['a']), frame), /Show and unlock/)
})

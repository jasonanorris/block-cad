import test from 'node:test'
import assert from 'node:assert/strict'
import { BoxGeometry, Mesh, Scene, PerspectiveCamera, OrthographicCamera } from 'three'
import { boxSelectedIds, screenRectangle, projectedMeshBounds } from '../src/boxSelection.ts'
import { cadHistoryReducer, createInitialHistory } from '../src/useCadHistory.ts'
import { box } from './fixtures.mjs'

test('box selection works in both projections, excludes hidden shapes and helpers', () => {
  for (const camera of [new PerspectiveCamera(50, 1, .1, 100), new OrthographicCamera(-5, 5, 5, -5, .1, 100)]) {
    camera.position.z = 10
    const scene = new Scene()
    for (const [id, visible, z] of [['a', true, 0], ['hidden', false, 0], ['behind', true, 20], [undefined, true, 0]]) {
      const mesh = new Mesh(new BoxGeometry(2, 2, 2))
      mesh.userData.cadObjectId = id
      mesh.visible = visible
      mesh.position.z = z
      scene.add(mesh)
    }
    assert.deepEqual(boxSelectedIds(scene, camera, screenRectangle(70, 70, 30, 30), 100, 100), ['a'])
    assert.deepEqual(boxSelectedIds(scene, camera, screenRectangle(0, 0, 1, 1), 100, 100), [])
  }
})

test('bounds crossing the near plane stay finite and within the canvas', () => {
  const camera = new PerspectiveCamera(50, 1, .1, 100)
  const mesh = new Mesh(new BoxGeometry(2, 2, 2))
  mesh.position.z = -1
  mesh.updateMatrixWorld()
  const bounds = projectedMeshBounds(mesh, camera, 100, 100)
  assert.ok(bounds)
  assert.ok(Object.values(bounds).every(v => Number.isFinite(v) && v >= 0 && v <= 100))
})

test('multi-selection replaces or adds valid IDs without recording an edit', () => {
  let state = createInitialHistory([box('a'), box('b')])
  const select = (ids, additive) => { state = cadHistoryReducer(state, { type: 'selectMany', ids, additive }) }
  select(['a', 'a', 'missing'], false)
  assert.deepEqual(state.present.selectedObjectIds, ['a'])
  select(['b'], true)
  assert.deepEqual(state.present.selectedObjectIds, ['a', 'b'])
  assert.equal(state.present.selectedObjectId, 'b')
  select([], true)
  assert.equal(state.present.selectedObjectId, 'b')
  select([], false)
  assert.deepEqual(state.present.selectedObjectIds, [])
  assert.equal(state.present.selectedObjectId, null)
  assert.equal(state.past.length, 0)
})

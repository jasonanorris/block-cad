import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeJoinGroups } from '../src/cadModel.ts'
import { parseProject, serializeProject } from '../src/projectFile.ts'
import { copyCadObjects, expandAssemblyIds, nudgeSelectedObjects } from '../src/selectionOperations.ts'
import { createInitialHistory, cadHistoryReducer } from '../src/useCadHistory.ts'
import { box, assembly } from './fixtures.mjs'

test('project round trip preserves intersections, hole links, names, visibility, and locking', () => {
  const objects = assembly('intersection')
  objects[0] = { ...objects[0], name: 'Part A', hidden: true, locked: true }
  assert.deepEqual(parseProject(serializeProject(objects)), objects)
  const old = JSON.parse(serializeProject(objects))
  old.version = 11
  old.objects.forEach((object) => delete object.joinMode)
  assert.ok(parseProject(JSON.stringify(old)).every((object) => !object.joinMode))
})

test('invalid projects fail validation for orphan holes, inconsistent modes, and duplicate IDs', () => {
  for (const mutate of [
    (objects) => { objects[2].cutTargetId = 'missing' },
    (objects) => { delete objects[1].joinMode },
    (objects) => { objects[1].id = objects[0].id },
  ]) {
    const objects = assembly('intersection')
    mutate(objects)
    assert.throws(() => parseProject(serializeProject(objects)))
  }
})

test('saving while editing a blank name produces a loadable project', () => {
  assert.equal(parseProject(serializeProject([{ ...box('a'), name: '   ' }]))[0].name, undefined)
})

test('copied assemblies remap every link, while one duplicated member becomes independent', () => {
  const source = assembly('intersection')
  const ids = expandAssemblyIds(source, new Set(['b']))
  assert.equal(ids.size, 3)
  const { copies } = copyCadObjects(source, 25, source)
  assert.notEqual(copies[0].joinGroupId, source[0].joinGroupId)
  assert.equal(copies[0].joinGroupId, copies[1].joinGroupId)
  assert.equal(copies[0].joinMode, 'intersection')
  assert.equal(copies[2].cutTargetId, copies[0].id)
  assert.equal(copies[0].position.x, 25)
  const single = copyCadObjects([source[0]], 25, source).copies[0]
  assert.equal(single.joinMode, undefined)
  assert.equal(single.joinGroupId, undefined)
  assert.equal(normalizeJoinGroups([source[0]])[0].joinMode, undefined)
})

test('nudging a selection moves its assembly and grouped cutter exactly once', () => {
  const source = assembly()
  const moved = nudgeSelectedObjects(source, new Set(['a', 'b', 'hole']), 'y', 7)
  assert.deepEqual(moved.map((object) => object.position.y), [17, 17, 17])
  assert.deepEqual(source.map((object) => object.position.y), [10, 10, 10])
})

test('continuous editing is one undo step; undo/redo and branch edits retain coherent state', () => {
  let state = createInitialHistory([box('a')])
  state = cadHistoryReducer(state, { type: 'begin' })
  for (const x of [1, 2, 3]) state = cadHistoryReducer(state, { type: 'edit', change: (scene) => ({ ...scene,
    objects: scene.objects.map((object) => ({ ...object, position: { ...object.position, x } })) }) })
  state = cadHistoryReducer(state, { type: 'end' })
  assert.equal(state.past.length, 1)
  state = cadHistoryReducer(state, { type: 'undo' })
  assert.equal(state.present.objects[0].position.x, 0)
  state = cadHistoryReducer(state, { type: 'redo' })
  assert.equal(state.present.objects[0].position.x, 3)
  state = cadHistoryReducer(state, { type: 'undo' })
  state = cadHistoryReducer(state, { type: 'commit', change: (scene) => ({ ...scene, objects: [box('new')] }) })
  assert.equal(state.future.length, 0)
})

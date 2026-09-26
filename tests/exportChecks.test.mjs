import test from 'node:test'
import assert from 'node:assert/strict'
import { inspectExport } from '../src/exportChecks.ts'
import { mirrorSelection } from '../src/mirrorSelection.ts'
import { box, assembly } from './fixtures.mjs'

test('export checks report world dimensions, disconnected regions, and hidden bodies', async () => {
  const objects = [box('a'), { ...box('b', 100, 30, 50), hidden: true }]
  const report = await inspectExport(objects)
  assert.deepEqual(report.dimensions, { x: 120, y: 40, z: 70 })
  assert.equal(report.bodyCount, 2)
  assert.equal(report.regions, 2)
  assert.equal(report.includesHidden, true)
  assert.deepEqual(report.errors, [])
})

test('overlapping bodies are one connected region but retain separate export bodies', async () => {
  const report = await inspectExport([box('a'), box('b', 10)])
  assert.equal(report.regions, 1)
  assert.equal(report.bodyCount, 2)
})

test('an internal cavity is not an extra disconnected solid region', async () => {
  const report = await inspectExport([box('a'), { ...box('hole'), dimensions: { x: 10, y: 10, z: 10 }, cutTargetId: 'a' }])
  assert.equal(report.regions, 1)
  assert.deepEqual(report.dimensions, { x: 20, y: 20, z: 20 })
})

test('one joined body can contain disconnected regions', async () => {
  const objects = [box('a'), box('b', 100)].map((object) => ({ ...object, joinGroupId: 'g' }))
  const report = await inspectExport(objects)
  assert.equal(report.bodyCount, 1)
  assert.equal(report.regions, 2)
})

test('empty results are named and omitted, invalid bodies are reported, mirrored bodies remain valid', async () => {
  const objects = assembly('intersection')
  objects[1].position.x = 100
  objects[0].name = 'Empty intersection'
  const empty = await inspectExport(objects)
  assert.deepEqual(empty.emptyBodies, ['Empty intersection'])
  assert.equal(empty.bodyCount, 0)
  assert.equal(empty.dimensions, null)
  const mixed = await inspectExport([...objects, box('good', 200)])
  assert.equal(mixed.bodyCount, 1)
  const invalid = await inspectExport([{ ...box('invalid'), scale: { x: 0, y: 1, z: 1 } }, box('good')])
  assert.equal(invalid.errors.length, 1)
  const mirrored = await mirrorSelection(assembly(), new Set(['a']), 'z')
  const report = await inspectExport(mirrored)
  assert.equal(report.bodyCount, 1)
  assert.equal(report.regions, 1)
  assert.deepEqual(report.errors, [])
})

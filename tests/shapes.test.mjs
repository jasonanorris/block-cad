import test from 'node:test'
import assert from 'node:assert/strict'
import { Vector3 } from 'three'
import { createCadObject, getObjectDimensions, getSolidBodies } from '../src/cadModel.ts'
import { createSourceGeometry } from '../src/sourceGeometry.ts'
import { buildSolidGeometry } from '../src/booleanGeometry.ts'
import { loadManifold } from '../src/manifoldRuntime.ts'
import { parseProject, serializeProject } from '../src/projectFile.ts'
import { export3mf } from '../src/threeMfExport.ts'
import { getObjectTopHeight } from '../src/workplane.ts'
import { getPlacementBounds, getPlacementUnits } from '../src/placement.ts'
import { box } from './fixtures.mjs'

function volume(geometry) {
  const p = geometry.getAttribute('position'), indices = geometry.getIndex()
  let total = 0
  for (let i = 0; i < indices.count; i += 3) {
    const [a, b, c] = [0, 1, 2].map((j) => new Vector3().fromBufferAttribute(p, indices.getX(i + j)))
    total += a.dot(b.cross(c)) / 6
  }
  return total
}

for (const type of ['cone', 'wedge', 'prism']) test(`${type} has consistent preview and Boolean volumes and works as a hole`, async () => {
  const object = createCadObject(type)
  const expected = type === 'wedge' ? 4000 : type === 'cone' ? 32 / 2 * 100 * Math.sin(2 * Math.PI / 32) * 20 / 3 : 6 / 2 * 100 * Math.sin(Math.PI / 3) * 20
  const runtime = await loadManifold()
  const source = createSourceGeometry(object)
  const result = buildSolidGeometry(getSolidBodies([object])[0], runtime)
  assert.ok(Math.abs(volume(source) - expected) < .01)
  assert.ok(Math.abs(volume(result) - expected) < .01)
  const cut = buildSolidGeometry(getSolidBodies([box('target'), { ...object, cutTargetId: 'target' }])[0], runtime)
  assert.ok(Math.abs(volume(cut) - (8000 - expected)) < .01)
  source.dispose(); result.dispose(); cut.dispose()
  assert.ok((await export3mf([object])).byteLength > 100)
})

test('prism side limits form valid solids and survive serialization', async () => {
  for (const sides of [3, 7, 64]) {
    const object = { ...createCadObject('prism'), sides }
    const restored = parseProject(serializeProject([object]))[0]
    assert.equal(restored.sides, sides)
    const geometry = buildSolidGeometry(getSolidBodies([restored])[0], await loadManifold())
    assert.ok(volume(geometry) > 0)
    geometry.dispose()
    const bounds = await getPlacementBounds(getPlacementUnits([object], new Set([object.id]))[0])
    const dimensions = getObjectDimensions(object)
    for (const axis of ['x', 'y', 'z']) assert.ok(Math.abs(bounds.max[axis] - bounds.min[axis] - dimensions[axis]) < 1e-5)
  }
  for (const sides of [2, 65, 3.5, '6']) assert.throws(() => parseProject(serializeProject([{ ...createCadObject('prism'), sides }])), /sides/)
})

test('new shapes round-trip names and holes; version 12 remains readable', () => {
  const objects = [box('a'), ...['cone', 'wedge', 'prism'].map((type) => ({ ...createCadObject(type), cutTargetId: 'a', name: type }))]
  assert.deepEqual(parseProject(serializeProject(objects)), objects)
  const old = JSON.parse(serializeProject([box('old')]))
  old.version = 12
  assert.equal(parseProject(JSON.stringify(old))[0].id, 'old')
})

test('selected top follows transformed vertices of asymmetric shapes', async () => {
  for (const type of ['cone', 'wedge', 'prism']) {
    const object = { ...createCadObject(type), rotation: { x: .2, y: .4, z: .7 }, scale: { x: -2, y: 1, z: 3 } }
    const bounds = await getPlacementBounds(getPlacementUnits([object], new Set([object.id]))[0])
    assert.ok(Math.abs(getObjectTopHeight(object) - bounds.max.y) < 1e-5)
  }
})

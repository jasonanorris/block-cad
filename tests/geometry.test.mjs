import test from 'node:test'
import assert from 'node:assert/strict'
import { Box3, Vector3, PerspectiveCamera, OrthographicCamera } from 'three'
import { exportStl } from '../src/stlExport.ts'
import { export3mf } from '../src/threeMfExport.ts'
import { frameCamera } from '../src/frameCamera.ts'
import { box, assembly } from './fixtures.mjs'

function stlVolume(buffer) {
  const view = new DataView(buffer)
  const count = view.getUint32(80, true)
  assert.equal(buffer.byteLength, 84 + count * 50)
  let volume = 0
  for (let index = 0; index < count; index++) {
    const offset = 84 + index * 50 + 12
    const points = [0, 1, 2].map((vertex) => new Vector3(...[0, 1, 2].map((axis) => view.getFloat32(offset + vertex * 12 + axis * 4, true))))
    volume += points[0].dot(points[1].cross(points[2])) / 6
  }
  return volume
}

for (const [mode, expected] of [[undefined, 11920], ['intersection', 3920]]) {
  test(`${mode ?? 'union'} STL uses the finished solid with its linked hole`, async () => {
    assert.ok(Math.abs(stlVolume(await exportStl(assembly(mode))) - expected) < .01)
  })
}

test('reflected STL exports retain outward winding and positive volume', async () => {
  const object = { ...box('a'), scale: { x: -2, y: 1, z: 1 } }
  assert.ok(Math.abs(stlVolume(await exportStl([object])) - 16000) < .01)
})

test('empty intersections report no printable geometry in both exports', async () => {
  const objects = assembly('intersection')
  objects[1].position.x = 100
  await assert.rejects(exportStl(objects), /no printable solid geometry/)
  await assert.rejects(export3mf(objects), /no printable solid geometry/)
})

test('3MF stores millimeter units and one build item for a combined solid', async () => {
  const data = await export3mf(assembly('intersection'))
  const view = new DataView(data)
  const files = new Map()
  let offset = 0
  while (view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true)
    const nameLength = view.getUint16(offset + 26, true)
    const extraLength = view.getUint16(offset + 28, true)
    const name = new TextDecoder().decode(new Uint8Array(data, offset + 30, nameLength))
    offset += 30 + nameLength + extraLength
    files.set(name, new TextDecoder().decode(new Uint8Array(data, offset, size)))
    offset += size
  }
  assert.equal(files.size, 3)
  const model = files.get('3D/3dmodel.model')
  assert.match(model, /unit="millimeter"/)
  assert.equal((model.match(/<item /g) ?? []).length, 1)
  assert.match(files.get('_rels/.rels'), /3D\/3dmodel.model/)
})

test('framing contains all corners at different scales, orientations, and viewport ratios', () => {
  for (const size of [.001, 20, 100000]) for (const aspect of [.3, 1, 3]) for (const orthographic of [false, true]) {
    const camera = orthographic ? new OrthographicCamera(-60 * aspect, 60 * aspect, 60, -60, .1, 1000)
      : new PerspectiveCamera(45, aspect, .1, 1000)
    camera.position.set(65, 50, 65)
    camera.lookAt(0, 0, 0)
    const bounds = new Box3(new Vector3(1000, -size, 2000), new Vector3(1000 + size, size, 2000 + size))
    frameCamera(camera, bounds)
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const point = new Vector3(x, y, z).project(camera)
      assert.ok(Math.max(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z)) < 1)
    }
  }
})

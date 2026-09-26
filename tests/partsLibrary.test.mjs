import test from 'node:test'
import assert from 'node:assert/strict'
import { preparePart, insertPart } from '../src/partsLibrary.ts'
import { savedName } from '../src/localProjects.ts'
import { getPlacementBounds, getPlacementUnits } from '../src/placement.ts'
import { parseProject, serializeProject } from '../src/projectFile.ts'
import { box, assembly } from './fixtures.mjs'
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`)

test('parts save complete assemblies at the base plane and insert independent copies at the current workplane', async () => {
  const source=[...assembly('intersection'),box('unrelated',100)]
  source[0].color='#ff0000';source[0].locked=true;source[2].hidden=true
  const before=structuredClone(source)
  const part=await preparePart(source,new Set(['b']))
  assert.equal(part.length,3);assert.deepEqual(source,before)
  assert.equal(part[0].locked,undefined);assert.equal(part[2].hidden,undefined)
  const inserted=insertPart(part,35),again=insertPart(part,-10)
  const bounds=await getPlacementBounds(getPlacementUnits(inserted,new Set([inserted[0].id]))[0])
  near(bounds.min.y,35);near((bounds.min.x+bounds.max.x)/2,0);near((bounds.min.z+bounds.max.z)/2,0)
  assert.equal(inserted[2].cutTargetId,inserted[0].id)
  assert.equal(inserted[0].joinGroupId,inserted[1].joinGroupId)
  assert.notEqual(inserted[0].joinGroupId,again[0].joinGroupId)
  assert.equal(inserted[0].color,'#ff0000')
  assert.deepEqual(parseProject(serializeProject(inserted)),JSON.parse(JSON.stringify(inserted)))
})

test('parts reject hole-only selections, empty bodies, invalid heights and invalid names', async () => {
  await assert.rejects(preparePart(assembly(),new Set(['hole'])),/solid/)
  const empty=assembly('intersection');empty[1].position.x=100
  await assert.rejects(preparePart(empty,new Set(['a'])),/empty/)
  assert.throws(()=>insertPart([box('a')],Infinity),/finite/)
  assert.equal(savedName(' Bracket '),'Bracket')
  for(const name of ['','  ','x'.repeat(81)]) assert.throws(()=>savedName(name),/name/)
})

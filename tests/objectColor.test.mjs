import test from 'node:test'
import assert from 'node:assert/strict'
import { colorObjects } from '../src/objectColor.ts'
import { parseProject, serializeProject } from '../src/projectFile.ts'
import { copyCadObjects } from '../src/selectionOperations.ts'
import { assembly } from './fixtures.mjs'

test('colors apply to whole joined solids, preserve cutters, and survive projects and copies', () => {
  const source=assembly(),result=colorObjects(source,'b','#AAbBcc')
  assert.equal(result[0].color,'#aabbcc');assert.equal(result[1].color,'#aabbcc')
  assert.equal(result[2],source[2]);assert.equal(source[0].color,undefined)
  assert.deepEqual(parseProject(serializeProject(result)),JSON.parse(JSON.stringify(result)))
  assert.equal(copyCadObjects(result,25,[]).copies[0].color,'#aabbcc')
  assert.equal(JSON.parse(serializeProject(result)).version,18)
})

test('color validation rejects unsafe formats and old projects retain the default', () => {
  for(const color of ['red','#fff','url(x)',4,null]) {
    const project=JSON.parse(serializeProject(assembly()));project.objects[0].color=color
    assert.throws(()=>parseProject(JSON.stringify(project)),/color/)
  }
  const old=JSON.parse(serializeProject(assembly()));old.version=13
  assert.equal(parseProject(JSON.stringify(old))[0].color,undefined)
  const source=assembly();source[0].locked=true
  assert.equal(colorObjects(source,'b','#ff0000'),source)
  assert.equal(colorObjects(source,'hole','#00ff00')[0],source[0])
})

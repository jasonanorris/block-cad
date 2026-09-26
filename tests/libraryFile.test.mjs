import test from 'node:test'
import assert from 'node:assert/strict'
import { parseLibrary, serializeLibrary } from '../src/libraryFile.ts'
import { assembly } from './fixtures.mjs'
import { createTextObject } from '../src/textShapes.ts'

test('portable library preserves kinds, dates, names, text fonts and complete assemblies', () => {
  const entries=[{kind:'part',name:'Joined cut',createdAt:1234,objects:assembly()},
    {kind:'snapshot',name:'Text',createdAt:5678,objects:[createTextObject('A',10,3,0,'optimer')]},
    {kind:'snapshot',name:'Empty',createdAt:0,objects:[]}]
  assert.deepEqual(parseLibrary(serializeLibrary(entries)),JSON.parse(JSON.stringify(entries)))
  assert.deepEqual(parseLibrary(serializeLibrary([])),[])
})

test('portable library rejects corrupt metadata, projects, formats, limits and empty parts', () => {
  const valid=JSON.parse(serializeLibrary([{kind:'part',name:'Part',createdAt:123,objects:assembly()}]))
  for (const patch of [{kind:'bad'},{name:''},{createdAt:-1},{createdAt:Infinity},{project:{}},
    {project:{...valid.items[0].project,objects:[]}},
    {project:{...valid.items[0].project,objects:[valid.items[0].project.objects[2]]}}]) {
    const data=structuredClone(valid);Object.assign(data.items[0],patch)
    assert.throws(()=>parseLibrary(JSON.stringify(data)))
  }
  assert.throws(()=>parseLibrary('{bad'),/JSON/)
  assert.throws(()=>parseLibrary(JSON.stringify({...valid,version:2})),/format/)
  assert.throws(()=>parseLibrary(JSON.stringify({...valid,items:Array(251).fill(valid.items[0])})),/250/)
})

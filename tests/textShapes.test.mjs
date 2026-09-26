import test from 'node:test'
import assert from 'node:assert/strict'
import { createTextObject, changeText } from '../src/textShapes.ts'
import { createSourceGeometry } from '../src/sourceGeometry.ts'
import { parseProject, serializeProject } from '../src/projectFile.ts'
import { getSolidBodies } from '../src/cadModel.ts'
import { readSolidManifold } from '../src/booleanGeometry.ts'
import { loadManifold } from '../src/manifoldRuntime.ts'
import { exportStl } from '../src/stlExport.ts'
import { export3mf } from '../src/threeMfExport.ts'
import { getObjectTopHeight } from '../src/workplane.ts'
import { getPlacementBounds, getPlacementUnits } from '../src/placement.ts'
import { box } from './fixtures.mjs'

test('text creates one printable shape with enclosed openings and exports through both formats', async () => {
  const text=createTextObject('BO 8',10,3,25)
  assert.equal(text.type,'text');assert.equal(text.position.y,26.5)
  assert.ok(text.contours.some(c=>c.holes.length===2))
  const geometry=createSourceGeometry(text);geometry.computeBoundingBox()
  assert.ok(Math.abs(geometry.boundingBox.max.x-geometry.boundingBox.min.x-text.dimensions.x)<1e-4)
  geometry.dispose()
  const runtime=await loadManifold()
  const volume=readSolidManifold(getSolidBodies([text])[0],runtime,s=>s.volume())
  assert.ok(volume>0 && volume<text.dimensions.x*text.dimensions.y*text.dimensions.z)
  assert.ok((await exportStl([text])).byteLength>84)
  assert.ok((await export3mf([text])).byteLength>100)
  assert.deepEqual(parseProject(serializeProject([text])),[text])
})

test('text is a single hole that cuts every letter and can be edited without losing placement or links', async () => {
  const plate={...box('plate'),dimensions:{x:80,y:10,z:40}}
  const text={...createTextObject('CAD',10,20),cutTargetId:'plate',color:'#ff0000',position:{x:0,y:10,z:0}}
  const runtime=await loadManifold()
  const cut=readSolidManifold(getSolidBodies([plate,text])[0],runtime,s=>s.volume())
  assert.ok(cut>0 && cut<32000)
  const edited=changeText(text,'AB\n12',12,5)
  assert.equal(edited.id,text.id);assert.deepEqual(edited.position,text.position)
  assert.equal(edited.cutTargetId,'plate');assert.equal(edited.color,'#ff0000')
  assert.equal(edited.text,'AB\n12');assert.equal(edited.dimensions.y,5)
})

test('invalid text and unsupported project text payloads fail without silently replacing glyphs', () => {
  for(const text of ['', '   ', 'x'.repeat(81), '🙂']) assert.throws(()=>createTextObject(text,10,3))
  for(const size of [0,201,NaN]) assert.throws(()=>createTextObject('A',size,3))
  for(const height of [0,-1,Infinity]) assert.throws(()=>createTextObject('A',10,height))
  const data=JSON.parse(serializeProject([createTextObject('CAD',10,3)]))
  data.version=14;assert.throws(()=>parseProject(JSON.stringify(data)),/unsupported shape/)
  data.version=15;data.objects[0].contours=[];assert.throws(()=>parseProject(JSON.stringify(data)),/contours/)
})

test('selected-top workplane follows actual rotated text vertices', async () => {
  const text={...createTextObject('T',20,3),rotation:{x:.7,y:.3,z:.2},scale:{x:-2,y:1,z:1}}
  const bounds=await getPlacementBounds(getPlacementUnits([text],new Set([text.id]))[0])
  assert.ok(Math.abs(getObjectTopHeight(text)-bounds.max.y)<1e-5)
})

test('font choices produce distinct printable contours and persist through editing and projects', async () => {
  const fonts=['helvetiker','helvetiker-bold','optimer'], runtime=await loadManifold(), outlines=[]
  for (const font of fonts) {
    const text=createTextObject('BO 8',10,3,12,font)
    assert.equal(text.fontId,font)
    assert.deepEqual(parseProject(serializeProject([text])),[text])
    assert.ok(readSolidManifold(getSolidBodies([text])[0],runtime,s=>s.volume())>0)
    assert.ok(text.contours.some(c=>c.holes.length>0))
    outlines.push(JSON.stringify(text.contours))
    const edited=changeText({...text,cutTargetId:'base',color:'#abcdef'},'AB',14,5,'helvetiker-bold')
    assert.equal(edited.fontId,'helvetiker-bold');assert.equal(edited.id,text.id)
    assert.equal(edited.cutTargetId,'base');assert.deepEqual(edited.position,text.position)
  }
  assert.equal(new Set(outlines).size,3)
  const old=JSON.parse(serializeProject([createTextObject('CAD',10,3)]));old.version=15;delete old.objects[0].fontId
  const loaded=parseProject(JSON.stringify(old))[0]
  assert.equal(loaded.fontId,undefined)
  assert.deepEqual(changeText(loaded,'CAD',10,3).contours,loaded.contours)
  const invalid=JSON.parse(serializeProject([createTextObject('A',10,3)]));invalid.objects[0].fontId='unknown'
  assert.throws(()=>parseProject(JSON.stringify(invalid)),/fontId/)
  assert.throws(()=>createTextObject('A',10,3,0,'unknown'),/font/)
})

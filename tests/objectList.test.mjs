import test from 'node:test'
import assert from 'node:assert/strict'
import { objectListRows } from '../src/objectList.ts'
import { box, assembly } from './fixtures.mjs'

test('assembly rows contain joined members and linked holes once without mutating the scene', () => {
  const source=[...assembly(),box('loose',100)],before=structuredClone(source)
  const rows=objectListRows(source,'','all',new Set())
  assert.deepEqual(rows.map(r=>r.anchor.id),['a','loose'])
  assert.deepEqual(rows[0].children.map(o=>o.id),['b','hole'])
  assert.deepEqual(source,before)
})

test('search and filters retain assembly context for matching children', () => {
  const source=assembly();source[2].name='Bore';source[2].hidden=true;source[1].locked=true
  const match=objectListRows(source,' BORE ','holes',new Set())
  assert.equal(match.length,1);assert.equal(match[0].anchorMatches,false)
  assert.deepEqual(match[0].children.map(o=>o.id),['hole'])
  assert.deepEqual(objectListRows(source,'','locked',new Set())[0].children.map(o=>o.id),['b'])
  assert.deepEqual(objectListRows(source,'','selected',new Set(['hole']))[0].children.map(o=>o.id),['hole'])
  assert.equal(objectListRows(source,'no match','all',new Set()).length,0)
  assert.equal(objectListRows(source,'#2','all',new Set())[0].children[0].id,'b')
})

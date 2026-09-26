import test from 'node:test'
import assert from 'node:assert/strict'
import { selectedExportObjects } from '../src/exportSelection.ts'
import { inspectExport } from '../src/exportChecks.ts'
import { exportStl } from '../src/stlExport.ts'
import { export3mf } from '../src/threeMfExport.ts'
import { box, assembly } from './fixtures.mjs'

test('selection export includes whole joined body and every cutter, preserving source order and hidden dependencies', async () => {
  const source=[...assembly('intersection'),box('outside',1000),{...box('other-hole',1000),cutTargetId:'outside'}]
  source[2].groupedWithTarget=undefined;source[2].hidden=true
  const snapshot=structuredClone(source)
  const result=selectedExportObjects(source,new Set(['b','other-hole']))
  assert.deepEqual(result.map(o=>o.id),['a','b','hole'])
  const report=await inspectExport(result)
  assert.equal(report.bodyCount,1);assert.equal(report.includesHidden,true)
  assert.deepEqual(report.dimensions,{x:10,y:20,z:20})
  assert.deepEqual(source,snapshot)
  const stl=await exportStl(result), expected=await exportStl(source.slice(0,3))
  assert.deepEqual(new Uint8Array(stl),new Uint8Array(expected))
  const xml=new TextDecoder().decode(await export3mf(result))
  assert.equal((xml.match(/<item /g)||[]).length,1)
})

test('hole-only, missing and empty selections have no printable export; unrelated bodies are excluded', () => {
  const source=[...assembly(),box('standalone',100)]
  for(const ids of [[],['hole'],['missing']]) assert.deepEqual(selectedExportObjects(source,new Set(ids)),[])
  assert.deepEqual(selectedExportObjects(source,new Set(['standalone'])),[source[3]])
  assert.deepEqual(selectedExportObjects(source,new Set(['a','b','standalone'])),source)
})

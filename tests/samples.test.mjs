import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parseProject, serializeProject } from '../src/projectFile.ts'
import { inspectExport } from '../src/exportChecks.ts'
import { exportStl } from '../src/stlExport.ts'
import { export3mf } from '../src/threeMfExport.ts'
for(const name of ['nameplate','section-demo','flange']) test(`${name} example loads and exports one connected printable body`,async()=>{
  const objects=parseProject(await readFile(new URL(`../public/samples/${name}.json`,import.meta.url),'utf8'))
  assert.deepEqual(parseProject(serializeProject(objects)),objects)
  const report=await inspectExport(objects)
  assert.equal(report.bodyCount,1);assert.equal(report.regions,1);assert.deepEqual(report.errors,[])
  assert.ok((await exportStl(objects)).byteLength>84)
  assert.ok((await export3mf(objects)).byteLength>100)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { inspectExport,defaultPrintSettings } from '../src/exportChecks.ts'
import { createCustomShape } from '../src/customShapes.ts'
import { box } from './fixtures.mjs'

test('print volume checks use finished world positions and configurable centered bed dimensions',async()=>{
 const fitting=box('fits'),outside=box('outside',115),below=box('below',0,-5)
 let report=await inspectExport([fitting,outside,below])
 assert.equal(report.outsideVolume.length,2)
 report=await inspectExport([outside],{...defaultPrintSettings,size:{x:300,y:250,z:220}})
 assert.deepEqual(report.outsideVolume,[])
 const rotated={...box('rotated',100),rotation:{x:0,y:Math.PI/4,z:0}}
 assert.equal((await inspectExport([rotated])).outsideVolume.length,1)
 await assert.rejects(inspectExport([fitting],{size:{x:0,y:100,z:100},minFeature:.8}),/Print dimensions/)
})

test('print checks flag small walls, holes and disconnected narrow regions without blocking exports',async()=>{
 const tube=createCustomShape({kind:'tube',diameter:20,wall:.2,height:20})
 const small={...box('small',40),dimensions:{x:.3,y:20,z:20}}
 const target=box('target',80),hole={...box('hole',80),type:'cylinder',dimensions:{diameter:.4,height:30},cutTargetId:'target'}
 const report=await inspectExport([tube,small,target,hole])
 assert.equal(report.regions,3);assert.equal(report.bodyCount,3);assert.deepEqual(report.errors,[])
 assert.ok(report.smallFeatures.some(s=>s.includes('Tube')&&s.includes('0.2')))
 assert.ok(report.smallFeatures.some(s=>s.includes('0.4')))
 assert.ok(report.smallFeatures.some(s=>s.includes('narrow bounds')))
 assert.deepEqual((await inspectExport([tube,small],{...defaultPrintSettings,minFeature:0})).smallFeatures,[])
})

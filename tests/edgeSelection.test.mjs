import test from 'node:test'
import assert from 'node:assert/strict'
import { extendEdgeSelection, circularRadius, edgeLength } from '../src/edgeSelection.ts'
import { parseEdgePresets, saveEdgePreset } from '../src/edgePresets.ts'
const p=(x,y=0,z=0)=>({x,y,z})
const edge=(a,b,rest={})=>({a,b,...rest})
test('chain follows loops and reversed edges but stops at ambiguous branches',()=>{
 const loop=[edge(p(0),p(1)),edge(p(1,1),p(1)),edge(p(0,1),p(1,1)),edge(p(0),p(0,1))]
 assert.deepEqual(new Set(extendEdgeSelection(loop,[0],'chain')),new Set([0,1,2,3]))
 const branch=[edge(p(0),p(1)),edge(p(1),p(2,1)),edge(p(1),p(2,-1))]
 assert.deepEqual(extendEdgeSelection(branch,[0],'chain'),[0])
 const tangent=[edge(p(0),p(1)),edge(p(2),p(1)),edge(p(1),p(1,1))]
 assert.deepEqual(extendEdgeSelection(tangent,[0],'chain'),[0,1])
 const many=Array.from({length:26},(_,i)=>edge(p(i),p(i+1)))
 assert.throws(()=>extendEdgeSelection(many,[0],'chain'),/limit/)
})
test('length and radius matching use tolerances and reject noncircular seeds',()=>{
 const edges=[edge(p(0),p(10)),edge(p(0),p(10.04)),edge(p(0),p(11)),edge(p(0),p(0),{radius:5}),edge(p(0),p(0),{radius:5.01})]
 assert.deepEqual(extendEdgeSelection(edges,[0],'length'),[0,1])
 assert.deepEqual(extendEdgeSelection(edges,[3],'radius'),[3,4])
 assert.throws(()=>extendEdgeSelection(edges,[0],'radius'),/circular edge/)
 assert.throws(()=>extendEdgeSelection(edges,[],'length'),/seed/)
 assert.equal(edgeLength(edge(p(0),p(1,1),{path:[p(0),p(1),p(1,1)]})),2)
 const circle=Array.from({length:49},(_,i)=>p(5*Math.cos(i*Math.PI/24)+10,5*Math.sin(i*Math.PI/24),3))
 assert.ok(Math.abs(circularRadius(circle)-5)<1e-8)
 assert.equal(circularRadius(circle.map(p=>({...p,x:p.x*2}))),undefined)
 assert.equal(circularRadius([p(0),p(1),p(2),p(3),p(4)]),undefined)
})
test('named presets persist, replace case-insensitively, and validate stored settings',()=>{
 const preset={name:'Small fillet',operation:'fillet',size:2,quality:'fine'}
 let presets=saveEdgePreset([],preset)
 assert.deepEqual(parseEdgePresets(JSON.stringify(presets)),presets)
 presets=saveEdgePreset(presets,{...preset,name:'SMALL FILLET',quality:'extra-fine'})
 assert.equal(presets.length,1);assert.equal(presets[0].quality,'extra-fine')
 for(const change of [{size:0},{size:Infinity},{quality:'ultra'},{operation:'bad'},{name:' '}]) assert.throws(()=>saveEdgePreset([],{...preset,...change}))
 assert.throws(()=>parseEdgePresets(JSON.stringify([preset,preset])),/unique/)
 assert.throws(()=>parseEdgePresets('{}'),/Invalid/)
 assert.throws(()=>saveEdgePreset(Array.from({length:20},(_,i)=>({...preset,name:String(i)})),preset),/20/)
})

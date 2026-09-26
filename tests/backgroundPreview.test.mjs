import test from 'node:test'
import assert from 'node:assert/strict'
import { BackgroundPreview } from '../src/BackgroundPreview.ts'
import { packPreview } from '../src/previewProtocol.ts'
import { createSourceGeometry } from '../src/sourceGeometry.ts'
import { assembly, box } from './fixtures.mjs'
function harness() {
  const workers=[],states=[]
  const engine=new BackgroundPreview(s=>states.push(s),()=>{
    const worker={requests:[],terminated:false,onmessage:null,onerror:null,
      postMessage(r){this.requests.push(r)},terminate(){this.terminated=true}}
    workers.push(worker);return worker
  })
  const reply=(worker,index=0,error)=>{
    const geometry=createSourceGeometry(box('result'))
    try {worker.onmessage({data:{sequence:worker.requests[index].sequence,...(error?{error}:{mesh:packPreview(geometry)})}})}
    finally {geometry.dispose()}
  }
  return {engine,workers,states,reply,latest:()=>states.at(-1)}
}

test('background previews coalesce edits and never publish obsolete or deleted geometry', () => {
  const h=harness(),a=assembly()
  try {
    h.engine.update(a);const worker=h.workers[0]
    const b=a.map(o=>o.id==='hole'?{...o,position:{...o.position,x:4}}:o)
    const c=b.map(o=>o.id==='hole'?{...o,position:{...o.position,x:8}}:o)
    h.engine.update(b);h.engine.update(c)
    assert.equal(worker.requests.length,1)
    h.reply(worker)
    assert.equal(h.latest().geometries.size,0);assert.equal(worker.requests.length,2)
    assert.equal(worker.requests[1].body.holes[0].position.x,8)
    h.reply(worker,1);assert.equal(h.latest().pending,0)
    const geometry=h.latest().geometries.get('a');let disposed=0
    geometry.addEventListener('dispose',()=>disposed++)
    h.engine.update(c.map(o=>({...o,name:'Renamed',color:'#abcdef'})))
    assert.equal(worker.requests.length,2);assert.equal(h.latest().geometries.get('a'),geometry)
    h.engine.update([]);assert.equal(disposed,1);assert.ok(worker.terminated)
    h.reply(worker,1);assert.equal(h.latest().geometries.size,0)
  } finally {h.engine.dispose()}
})

test('body failures preserve other previews and retry builds only missing results', () => {
  const h=harness(),a=assembly(),other=assembly().map(o=>({...o,id:o.id+'2',joinGroupId:o.joinGroupId?'g2':undefined,cutTargetId:o.cutTargetId?'a2':undefined}))
  try {
    h.engine.update([...a,...other]);const worker=h.workers[0]
    h.reply(worker,0);const first=h.latest().geometries.get('a')
    h.reply(worker,1,'Bad geometry')
    assert.match(h.latest().error,/Bad geometry/);assert.equal(h.latest().pending,0)
    assert.equal(h.latest().geometries.get('a'),first)
    h.engine.retry();assert.equal(worker.requests.length,3)
    h.reply(worker,2);assert.equal(h.latest().error,null);assert.equal(h.latest().geometries.size,2)
  } finally {h.engine.dispose()}
})

test('worker crashes and startup failures report errors, restart on retry, and dispose ignores late replies', () => {
  const h=harness()
  h.engine.update(assembly());const crashed=h.workers[0]
  crashed.onerror({preventDefault(){}})
  assert.ok(crashed.terminated);assert.match(h.latest().error,/Background preview failed/)
  h.engine.retry();assert.equal(h.workers.length,2)
  h.reply(crashed);assert.equal(h.latest().geometries.size,0)
  h.reply(h.workers[1]);const geometry=h.latest().geometries.get('a');let disposed=0
  geometry.addEventListener('dispose',()=>disposed++)
  h.engine.dispose();assert.equal(disposed,1)
  const count=h.states.length;h.reply(h.workers[1]);assert.equal(h.states.length,count)
  let last
  const failure=new BackgroundPreview(s=>last=s,()=>{throw new Error('Worker blocked')})
  failure.update(assembly());assert.match(last.error,/Worker blocked/);failure.dispose()
})

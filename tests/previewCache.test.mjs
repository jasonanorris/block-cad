import test from 'node:test'
import assert from 'node:assert/strict'
import { BufferGeometry } from 'three'
import { BooleanPreviewCache } from '../src/BooleanPreviewCache.ts'
import { getPlacementBounds, getPlacementUnits } from '../src/placement.ts'
import { assembly } from './fixtures.mjs'

function manyBodies(count) {
  return Array.from({length:count},(_,i)=>assembly().map(o=>({...o,id:`${o.id}${i}`,joinGroupId:o.joinGroupId?`g${i}`:undefined,
    cutTargetId:o.cutTargetId?`${o.cutTargetId}${i}`:undefined}))).flat()
}

test('100-body preview cache rebuilds only edited geometry, ignores metadata, and disposes replaced/deleted meshes', () => {
  let builds=0,disposals=0
  const cache=new BooleanPreviewCache(()=>{builds++;const g=new BufferGeometry();g.addEventListener('dispose',()=>disposals++);return g})
  const objects=manyBodies(100),first=cache.update(objects,{})
  assert.equal(builds,100)
  const renamed=objects.map(o=>({...o,name:'Part',color:'#abcdef',hidden:true,locked:true}))
  assert.equal(cache.update(renamed,{}),first);assert.equal(builds,100)
  const moved=renamed.map(o=>o.id==='hole50'?{...o,position:{...o.position,x:8}}:o)
  const next=cache.update(moved,{})
  assert.equal(builds,101);assert.equal(disposals,1)
  assert.equal(next.geometries.get('a0'),first.geometries.get('a0'))
  assert.notEqual(next.geometries.get('a50'),first.geometries.get('a50'))
  cache.update(moved.slice(3),{});assert.equal(disposals,2)
  cache.clear();assert.equal(disposals,101)
  cache.clear();assert.equal(disposals,101)
})

test('failed bodies lose stale geometry while unaffected previews survive and retries recover', () => {
  let fail=false
  const cache=new BooleanPreviewCache(body=>{if(fail&&body.anchor.id==='a0')throw new Error('broken');return new BufferGeometry()})
  const objects=manyBodies(2),first=cache.update(objects,{})
  const changed=objects.map(o=>o.id==='a0'?{...o,scale:{x:2,y:1,z:1}}:o)
  fail=true;const failed=cache.update(changed,{})
  assert.equal(failed.geometries.size,1);assert.equal(failed.geometries.get('a1'),first.geometries.get('a1'))
  assert.match(failed.error,/broken/)
  fail=false;assert.equal(cache.update(changed,{}).geometries.size,2)
  cache.clear()
})

test('cached placement bounds return independent boxes and invalidate on geometry edits', async () => {
  const source=assembly('intersection')
  const unit=getPlacementUnits(source,new Set(['a']))[0]
  const first=await getPlacementBounds(unit);first.min.x=-999
  const second=await getPlacementBounds(unit);assert.equal(second.min.x,0)
  const moved=source.map(o=>({...o,position:{...o.position,x:o.position.x+20}}))
  const next=await getPlacementBounds(getPlacementUnits(moved,new Set(['a']))[0]);assert.equal(next.min.x,20)
})

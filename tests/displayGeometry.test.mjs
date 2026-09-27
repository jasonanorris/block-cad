import test from 'node:test'
import assert from 'node:assert/strict'
import { BoxGeometry, CylinderGeometry, BufferGeometry, Float32BufferAttribute, Vector3 } from 'three'
import { smoothDisplayGeometry } from '../src/displayGeometry.ts'

test('display smoothing rounds cylinder normals while retaining flat caps and box creases',()=>{
 const cylinder=new CylinderGeometry(10,10,20,32), box=new BoxGeometry(20,20,20)
 for(const source of [cylinder,box]) {
  const before=source.getAttribute('normal').array.slice(), display=smoothDisplayGeometry(source)
  const plain=source.toNonIndexed(),p=display.getAttribute('position'),n=display.getAttribute('normal')
  assert.deepEqual(p.array,plain.getAttribute('position').array)
  assert.deepEqual(source.getAttribute('normal').array,before)
  for(let i=0;i<p.count;i++) {
   const normal=new Vector3().fromBufferAttribute(n,i)
   assert.ok(Math.abs(normal.length()-1)<1e-6)
   if(source===box) assert.equal(normal.toArray().filter(v=>Math.abs(v)>1e-6).length,1)
   else if(Math.abs(normal.y)>.5) assert.ok(Math.abs(normal.y)>1-1e-6,'cap stays flat')
   else {
    const radial=new Vector3(p.getX(i),0,p.getZ(i)).normalize()
    assert.ok(normal.dot(radial)>.99999,'cylinder sides have radial normals')
   }
  }
  display.dispose();plain.dispose();source.dispose()
 }
})

test('nearby disconnected details do not share display normals',()=>{
 const source=new BufferGeometry()
 source.setAttribute('position',new Float32BufferAttribute([0,0,0,1,0,0,0,1,0, 0,0,.001,1,0,.001,0,1,.101],3))
 source.computeVertexNormals()
 const result=smoothDisplayGeometry(source)
 assert.deepEqual(result.getAttribute('position').array,source.getAttribute('position').array)
 assert.ok(result.getAttribute('normal').array.every((v,i)=>Math.abs(v-source.getAttribute('normal').array[i])<1e-6))
 result.dispose();source.dispose()
})

test('crease angle changes display normals without changing triangles',()=>{
 const source=new BufferGeometry()
 source.setAttribute('position',new Float32BufferAttribute([0,0,0,1,0,0,0,1,0, 1,0,0,0,0,0,0,-1,1],3))
 const sharp=smoothDisplayGeometry(source,30),smooth=smoothDisplayGeometry(source,60)
 assert.deepEqual(sharp.getAttribute('position').array,smooth.getAttribute('position').array)
 assert.notDeepEqual(sharp.getAttribute('normal').array,smooth.getAttribute('normal').array)
 for(const angle of [0,91,NaN]) assert.throws(()=>smoothDisplayGeometry(source,angle),/Crease/)
 source.dispose();sharp.dispose();smooth.dispose()
})

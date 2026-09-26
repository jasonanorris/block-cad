import test from 'node:test'
import assert from 'node:assert/strict'
import { BoxGeometry } from 'three'
import { encodeStlMesh } from '../src/stlMesh.ts'
import { serializeProject,parseProject } from '../src/projectFile.ts'
import { objectListRows,visibleObjectRows,OBJECT_PAGE_SIZE } from '../src/objectList.ts'
import { equalModelData } from '../src/modelEquality.ts'
import { box } from './fixtures.mjs'

export function meshCopies(count){const geometry=new BoxGeometry(20,20,20).toNonIndexed();try{const meshData=encodeStlMesh(new Float32Array(geometry.getAttribute('position').array));return Array.from({length:count},(_,i)=>({...box(`mesh-${i}`,i*30),type:'stl',meshData}))}finally{geometry.dispose()}}

test('project 18 stores identical meshes once and restores independently editable object metadata',()=>{
 const objects=meshCopies(100),text=serializeProject(objects),file=JSON.parse(text)
 assert.equal(file.version,18);assert.equal(file.meshes.length,1)
 assert.ok(file.objects.every(o=>o.meshRef===0 && !Object.hasOwn(o,'meshData')))
 assert.deepEqual(parseProject(text),objects)
 const legacy=JSON.stringify({format:'block-cad',version:17,units:'mm',objects})
 assert.deepEqual(parseProject(legacy),objects)
 // Compare the compact table to equally pretty-printed repeated data.
 assert.ok(text.length<JSON.stringify(JSON.parse(legacy),null,2).length*.65)
 const invalid=structuredClone(file);invalid.objects[0].meshRef=2;assert.throws(()=>parseProject(JSON.stringify(invalid)),/meshRef/)
 invalid.objects[0].meshRef=0;invalid.meshes[0]='bad';assert.throws(()=>parseProject(JSON.stringify(invalid)),/meshData/)
 const ambiguous=structuredClone(file);ambiguous.objects[0].meshData=objects[0].meshData;assert.throws(()=>parseProject(JSON.stringify(ambiguous)),/meshRef/)
})

test('large object list preserves ordering, search numbers, assembly context and bounded pages',()=>{
 const objects=Array.from({length:2000},(_,i)=>box(`obj-${i}`,i))
 objects[999].cutTargetId=objects[0].id;objects[999].groupedWithTarget=true
 const rows=objectListRows(objects,'','all',new Set()),visible=visibleObjectRows(rows,new Set(),false)
 assert.equal(visible.length,2000);assert.equal(visible[1].object.id,'obj-999');assert.equal(visible[1].parent.id,'obj-0')
 assert.equal(visible.slice(0,OBJECT_PAGE_SIZE).length,50)
 const matching=objectListRows(objects,'#1000','all',new Set())
 assert.equal(matching.length,1);assert.equal(matching[0].anchorMatches,false);assert.equal(matching[0].children[0].id,'obj-999')
 assert.equal(visibleObjectRows(rows,new Set(['obj-0']),false).length,1999)
})

test('history equality skips shared payloads, accepts equivalent copies and detects nested edits',()=>{
 const objects=meshCopies(100)
 assert.equal(equalModelData(objects,objects.map(o=>({...o}))),true)
 assert.equal(equalModelData(objects,objects.map(o=>({...o,name:undefined}))),true)
 assert.equal(equalModelData(objects,objects.map((o,i)=>i===5?{...o,position:{...o.position,x:8}}:o)),false)
 assert.equal(equalModelData({contours:[{x:1,y:2}]},{contours:[{x:1,y:3}]}),false)
})

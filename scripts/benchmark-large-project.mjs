import { performance } from 'node:perf_hooks'
import { SphereGeometry } from 'three'
import { createCadObject } from '../src/cadModel.ts'
import { encodeStlMesh } from '../src/stlMesh.ts'
import { serializeProject, parseProject } from '../src/projectFile.ts'
import { equalModelData } from '../src/modelEquality.ts'
import { objectListRows, visibleObjectRows, OBJECT_PAGE_SIZE } from '../src/objectList.ts'

const indexed=new SphereGeometry(10,32,16),geometry=indexed.toNonIndexed()
let meshData
try{meshData=encodeStlMesh(new Float32Array(geometry.getAttribute('position').array))}finally{indexed.dispose();geometry.dispose()}
const meshes=Array.from({length:200},(_,i)=>({...createCadObject('box'),id:`mesh-${i}`,type:'stl',name:`Mesh ${i}`,meshData}))
const old=JSON.stringify({format:'block-cad',version:17,units:'mm',objects:meshes},null,2)
let start=performance.now();const compact=serializeProject(meshes),saveMs=performance.now()-start
start=performance.now();parseProject(compact);const loadMs=performance.now()-start
if(JSON.parse(compact).meshes.length!==1 || compact.length>=old.length*.1)throw new Error('Mesh deduplication regressed')
console.log(`200 repeated sphere meshes: ${old.length.toLocaleString()} → ${compact.length.toLocaleString()} bytes (${(100*(1-compact.length/old.length)).toFixed(1)}% smaller); save ${saveMs.toFixed(1)} ms, load ${loadMs.toFixed(1)} ms`)
start=performance.now();const same=equalModelData(meshes,meshes.map(o=>({...o})))
if(!same)throw new Error('Equivalent metadata copies should not add an Undo step')
console.log(`History equality across shared mesh payloads: ${(performance.now()-start).toFixed(2)} ms`)
const objects=Array.from({length:5000},(_,i)=>({...createCadObject('box'),id:`object-${i}`,name:`Object ${i}`}))
start=performance.now();const rows=objectListRows(objects,'object','all',new Set()),visible=visibleObjectRows(rows,new Set(),false)
if(visible.length!==5000 || visible.slice(0,OBJECT_PAGE_SIZE).length!==50)throw new Error('Object pagination regressed')
console.log(`5,000 searchable objects: ${(performance.now()-start).toFixed(2)} ms, ${OBJECT_PAGE_SIZE} rendered rows per page`)

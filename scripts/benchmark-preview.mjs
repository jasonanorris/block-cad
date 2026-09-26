import { performance } from 'node:perf_hooks'
import { BooleanPreviewCache } from '../src/BooleanPreviewCache.ts'
import { buildSolidGeometry } from '../src/booleanGeometry.ts'
import { loadManifold } from '../src/manifoldRuntime.ts'
import { createCadObject } from '../src/cadModel.ts'
const runtime=await loadManifold()
const objects=Array.from({length:100},(_,i)=>{
  const solid={...createCadObject('box',i*30),id:`solid-${i}`}
  const hole={...createCadObject('cylinder',i*30),id:`hole-${i}`,cutTargetId:solid.id,dimensions:{diameter:8,height:30}}
  return [solid,hole]
}).flat()
let builds=0
const cache=new BooleanPreviewCache((body,r)=>{builds++;return buildSolidGeometry(body,r)})
function run(label,data) {const before=builds,start=performance.now();cache.update(data,runtime);console.log(`${label}: ${(performance.now()-start).toFixed(2)} ms, ${builds-before} Boolean builds`)}
try {
  run('Initial 100 cut bodies',objects)
  const metadata=objects.map(o=>({...o,name:'Renamed',color:'#aa7722'}))
  run('Rename and recolor all',metadata)
  run('Move one cutter',metadata.map(o=>o.id==='hole-50'?{...o,position:{...o.position,x:o.position.x+2}}:o))
} finally {cache.clear()}

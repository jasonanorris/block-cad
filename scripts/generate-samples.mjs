import { writeFile } from 'node:fs/promises'
import { createCadObject } from '../src/cadModel.ts'
import { createTextObject } from '../src/textShapes.ts'
import { serializeProject } from '../src/projectFile.ts'

async function save(name,objects) {
  const ids=new Map(objects.map((o,i)=>[o.id,`${name}-${i+1}`]))
  const normalized=objects.map(o=>({...o,id:ids.get(o.id),cutTargetId:o.cutTargetId?ids.get(o.cutTargetId):undefined}))
  await writeFile(new URL(`../public/samples/${name}.json`,import.meta.url),serializeProject(normalized))
}
const plate={...createCadObject('box'),name:'Nameplate base',dimensions:{x:80,y:5,z:24},position:{x:0,y:2.5,z:0},color:'#437cc4',joinGroupId:'nameplate'}
const letters={...createTextObject('BLOCK CAD',8,2,4),color:'#437cc4',joinGroupId:'nameplate'}
await save('nameplate',[plate,letters])
const shell={...createCadObject('box'),name:'Section demo shell',dimensions:{x:40,y:30,z:30},position:{x:0,y:15,z:0},color:'#d99842'}
const cavity={...createCadObject('box'),name:'Enclosed cavity',dimensions:{x:32,y:18,z:20},position:{x:0,y:15,z:0},cutTargetId:shell.id,groupedWithTarget:true}
await save('section-demo',[shell,cavity])
const flange={...createCadObject('cylinder'),name:'Eight-hole flange',dimensions:{diameter:80,height:6},position:{x:0,y:3,z:0},color:'#6c9d69'}
const holes=Array.from({length:8},(_,i)=>({...createCadObject('cylinder'),name:`Bolt hole ${i+1}`,dimensions:{diameter:8,height:12},
  position:{x:28*Math.cos(i*Math.PI/4),y:3,z:28*Math.sin(i*Math.PI/4)},cutTargetId:flange.id,groupedWithTarget:true}))
await save('flange',[flange,...holes])

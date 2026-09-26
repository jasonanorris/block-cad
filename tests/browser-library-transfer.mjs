// Run in the Vite browser console: (await import('/tests/browser-library-transfer.mjs')).runTransferChecks()
import { exportLocalLibrary, importLocalLibrary, listLocalProjects, readLocalProject, deleteLocalProject } from '../src/localProjects.ts'
import { serializeLibrary, parseLibrary } from '../src/libraryFile.ts'
import { createCadObject } from '../src/cadModel.ts'

export async function runTransferChecks() {
  const assert=(condition,message)=>{if(!condition)throw new Error(message)}
  const fail=async(fn)=>{let rejected=false;try{await fn()}catch{rejected=true}assert(rejected,'Expected failure')}
  const all=async()=>[...await listLocalProjects('part'),...await listLocalProjects('snapshot')]
  const prefix=`Transfer test ${crypto.randomUUID()}`,created=[]
  const originalAdd=IDBObjectStore.prototype.add
  try {
    const shape={...createCadObject('box'),color:'#123456',name:'Portable',locked:true}
    const entries=[{kind:'part',name:prefix,createdAt:123456,objects:[shape]},
      {kind:'snapshot',name:prefix+' empty',createdAt:123457,objects:[]}]
    const text=serializeLibrary(entries),first=await importLocalLibrary(text);created.push(...first)
    assert(first.length===2,'Missing imported items')
    assert((await readLocalProject(first[0].id,'part'))[0].color===shape.color,'Lost model metadata')
    assert((await readLocalProject(first[1].id,'snapshot')).length===0,'Lost empty snapshot')
    const second=await importLocalLibrary(text);created.push(...second)
    assert(second.every(item=>!first.some(other=>other.id===item.id)),'Storage IDs were reused')
    assert((await all()).filter(item=>item.name===prefix).length===2,'Import overwrote an entry')
    const backedUp=parseLibrary(await exportLocalLibrary()).filter(item=>item.name.startsWith(prefix))
    assert(backedUp.length===4 && backedUp.every(item=>item.createdAt===123456||item.createdAt===123457),'Export lost dates/items')
    const before=(await all()).map(item=>item.id).sort().join(',')
    const malformed=JSON.parse(text);malformed.items[1].project.objects=[{bad:true}]
    await fail(()=>importLocalLibrary(JSON.stringify(malformed)))
    assert((await all()).map(item=>item.id).sort().join(',')===before,'Invalid input partly imported')
    let writes=0
    IDBObjectStore.prototype.add=function(...args){
      if(this.name==='projects' && ++writes===2)throw new DOMException('Simulated quota failure','QuotaExceededError')
      return originalAdd.apply(this,args)
    }
    await fail(()=>importLocalLibrary(text))
    IDBObjectStore.prototype.add=originalAdd
    assert((await all()).map(item=>item.id).sort().join(',')===before,'Transaction failure left partial items')
    return 'PASS: portable round trip, fresh IDs, no overwrites, dates, malformed data rejection and atomic quota rollback'
  } finally {
    IDBObjectStore.prototype.add=originalAdd
    for(const item of created) await deleteLocalProject(item.id,item.kind)
  }
}

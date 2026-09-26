// Run with Vite running, from the browser console:
// (await import('/tests/browser-library.mjs')).runLibraryChecks()
import { saveLocalProject, readLocalProject, listLocalProjects, deleteLocalProject } from '../src/localProjects.ts'
import { createCadObject } from '../src/cadModel.ts'

export async function runLibraryChecks() {
  const assert = (condition, message) => { if (!condition) throw new Error(message) }
  const expectFailure = async (action) => { let failed=false;try { await action() } catch { failed=true };assert(failed,'Expected rejection') }
  const prefix = `Library regression ${crypto.randomUUID()}`
  const created = []
  const originalAdd = IDBObjectStore.prototype.add
  try {
    const shape = { ...createCadObject('box'), color:'#12ab34', name:'Test part', hidden:true, locked:true }
    const item = await saveLocalProject('snapshot',prefix,[shape]);created.push(item)
    const restored=(await readLocalProject(item.id,'snapshot'))[0]
    assert(restored.id===shape.id && restored.color===shape.color && restored.hidden && restored.locked && restored.name===shape.name,'Snapshot data changed')
    const empty = await saveLocalProject('snapshot',`${prefix} empty`,[]);created.push(empty)
    assert((await readLocalProject(empty.id,'snapshot')).length===0,'Empty snapshot failed')
    const part = await saveLocalProject('part',prefix,[shape]);created.push(part)
    assert((await listLocalProjects('part')).some(p=>p.id===part.id),'Part missing')
    assert(!(await listLocalProjects('snapshot')).some(p=>p.id===part.id),'Kinds mixed')
    await expectFailure(()=>readLocalProject(part.id,'snapshot'))
    await expectFailure(()=>deleteLocalProject(part.id,'snapshot'))
    assert((await readLocalProject(part.id,'part')).length===1,'Wrong-kind delete damaged part')
    const before = (await listLocalProjects('snapshot')).length
    IDBObjectStore.prototype.add = function(...args) {
      if(this.name==='projects') throw new DOMException('Simulated quota failure','QuotaExceededError')
      return originalAdd.apply(this,args)
    }
    await expectFailure(()=>saveLocalProject('snapshot',`${prefix} failed`,[shape]))
    IDBObjectStore.prototype.add=originalAdd
    assert((await listLocalProjects('snapshot')).length===before,'Failed write left an orphan metadata entry')
    const db = await new Promise((resolve,reject)=>{const r=indexedDB.open('block-cad-library',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
    try {
      await new Promise((resolve,reject)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put('{broken',item.id);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)})
    } finally { db.close() }
    await expectFailure(()=>readLocalProject(item.id,'snapshot'))
    assert((await readLocalProject(part.id,'part'))[0].color==='#12ab34','Other saved item changed')
    return 'PASS: round trip, empty snapshots, kind isolation, atomic failed writes, damaged data rejection'
  } finally {
    IDBObjectStore.prototype.add=originalAdd
    for (const item of created) await deleteLocalProject(item.id,item.kind)
  }
}

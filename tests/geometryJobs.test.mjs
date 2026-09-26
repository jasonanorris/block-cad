import test from 'node:test'
import assert from 'node:assert/strict'
import { GeometryJobs } from '../src/GeometryJobs.ts'
const input={objects:[],ids:[],activeId:null}
function harness(){const workers=[];const jobs=new GeometryJobs(()=>{const worker={onmessage:null,onerror:null,requests:[],terminated:false,postMessage(request){this.requests.push(request)},terminate(){this.terminated=true}};workers.push(worker);return worker});return{jobs,workers}}

test('geometry jobs reuse idle workers and route results and errors by request ID',async()=>{
 const {jobs,workers}=harness()
 try{
  const first=jobs.run('measure',input),w=workers[0]
  w.onmessage({data:{id:99,result:'wrong'}})
  w.onmessage({data:{id:w.requests[0].id,result:{size:[1,2,3],span:null,gaps:[]}}})
  assert.deepEqual((await first).size,[1,2,3])
  const second=jobs.run('measure',input);assert.equal(workers.length,1)
  const rejected=assert.rejects(second,/Bad geometry/)
  w.onmessage({data:{id:w.requests[1].id,error:'Bad geometry'}});await rejected
 }finally{jobs.dispose()}
})

test('cancel terminates real work, ignores late replies and allows a fresh retry',async()=>{
 const {jobs,workers}=harness(),abort=new AbortController()
 try{
  const first=jobs.run('measure',input,abort.signal),rejected=assert.rejects(first,{name:'AbortError'}),old=workers[0]
  abort.abort();await rejected;assert.ok(old.terminated)
  const next=jobs.run('measure',input),w=workers[1]
  old.onmessage({data:{id:old.requests[0].id,result:'late'}})
  w.onmessage({data:{id:w.requests[0].id,result:{size:null,span:null,gaps:[]}}})
  assert.equal((await next).size,null)
  await assert.rejects(jobs.run('measure',input,abort.signal),{name:'AbortError'})
 }finally{jobs.dispose()}
})

test('superseded operations and disposal reject promptly; startup and worker crashes are recoverable errors',async()=>{
 const {jobs,workers}=harness()
 const first=jobs.run('measure',input),rejected=assert.rejects(first,{name:'AbortError'})
 const second=jobs.run('measure',input),secondRejected=assert.rejects(second,/Background geometry failed/)
 await rejected;workers[1].onerror({preventDefault(){}});await secondRejected
 const third=jobs.run('measure',input),thirdRejected=assert.rejects(third,{name:'AbortError'})
 jobs.dispose();await thirdRejected
 const blocked=new GeometryJobs(()=>{throw new Error('Blocked worker')})
 await assert.rejects(blocked.run('measure',input),/Blocked worker/);blocked.dispose()
})

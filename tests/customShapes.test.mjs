import test from 'node:test'
import assert from 'node:assert/strict'
import { Vector3 } from 'three'
import { createCustomShape, changeCustomShape, customDefaults } from '../src/customShapes.ts'
import { createSourceGeometry } from '../src/sourceGeometry.ts'
import { getSolidBodies, getObjectDimensions } from '../src/cadModel.ts'
import { buildSolidGeometry, readSolidManifold } from '../src/booleanGeometry.ts'
import { loadManifold } from '../src/manifoldRuntime.ts'
import { parseProject, serializeProject } from '../src/projectFile.ts'
import { sameGeometryInput } from '../src/geometryInputs.ts'
import { preparePart, insertPart } from '../src/partsLibrary.ts'
import { exportStl } from '../src/stlExport.ts'
import { export3mf } from '../src/threeMfExport.ts'
import { box } from './fixtures.mjs'
const near=(a,b)=>assert.ok(Math.abs(a-b)<.02,`${a} != ${b}`)
function volume(geometry){const p=geometry.getAttribute('position'),i=geometry.getIndex();let v=0
 for(let n=0;n<(i?.count??p.count);n+=3){const [a,b,c]=[0,1,2].map(j=>new Vector3().fromBufferAttribute(p,i?i.getX(n+j):n+j));v+=a.dot(b.cross(c))/6}return v}

test('custom shapes have matching watertight preview and Boolean geometry, dimensions and exports',async()=>{
 const runtime=await loadManifold()
 for(const parameters of [...Object.values(customDefaults),{kind:'rounded-box',width:20,depth:20,height:10,radius:10},{kind:'rounded-box',width:20,depth:30,height:10,radius:0}]){
  const shape=createCustomShape(parameters,12),source=createSourceGeometry(shape),solid=buildSolidGeometry(getSolidBodies([shape])[0],runtime)
  try{
   near(volume(source),volume(solid));assert.ok(volume(solid)>0)
   source.computeBoundingBox();solid.computeBoundingBox()
   for(const axis of ['x','y','z']){near(source.boundingBox.max[axis]-source.boundingBox.min[axis],shape.dimensions[axis]);near(source.boundingBox.min[axis],solid.boundingBox.min[axis]);near(source.boundingBox.max[axis],solid.boundingBox.max[axis])}
   near(shape.position.y-shape.dimensions.y/2,12)
  }finally{source.dispose();solid.dispose()}
  assert.deepEqual(parseProject(serializeProject([shape])),[shape])
  assert.ok((await exportStl([shape])).byteLength>84);assert.ok((await export3mf([shape])).byteLength>100)
 }
})

test('custom parameters stay editable through parts, transforms and cuts; wall changes invalidate cached geometry',async()=>{
 const shape={...createCustomShape(customDefaults.tube),rotation:{x:.4,y:.2,z:.1},scale:{x:-2,y:1,z:.5},color:'#123456'}
 const edited=changeCustomShape(shape,{...shape.parameters,wall:5})
 assert.deepEqual(edited.position,shape.position);assert.deepEqual(edited.rotation,shape.rotation);assert.deepEqual(edited.scale,shape.scale)
 assert.equal(edited.id,shape.id);assert.equal(edited.color,shape.color);assert.equal(sameGeometryInput(shape,edited),false)
 assert.deepEqual(getObjectDimensions(edited),getObjectDimensions(shape))
 const part=await preparePart([edited],new Set([edited.id])),inserted=insertPart(part,25)
 assert.deepEqual(inserted[0].parameters,edited.parameters)
 const target={...box('base'),dimensions:{x:100,y:100,z:100}},hole={...shape,cutTargetId:'base'}
 const runtime=await loadManifold();assert.ok(readSolidManifold(getSolidBodies([target,hole])[0],runtime,s=>s.volume())<1000000)
})

test('custom parameter validation rejects bad walls, radius, dimensions, kinds and incompatible projects',()=>{
 for(const parameters of [{...customDefaults.tube,wall:15},{...customDefaults.bracket,wall:30},{...customDefaults['rounded-box'],radius:16},{...customDefaults.tube,height:NaN},{kind:'unknown'}])assert.throws(()=>createCustomShape(parameters))
 const data=JSON.parse(serializeProject([createCustomShape(customDefaults.tube)]))
 data.objects[0].dimensions.y=20;assert.throws(()=>parseProject(JSON.stringify(data)),/match/)
 data.objects[0].dimensions.y=25;data.version=16;assert.throws(()=>parseProject(JSON.stringify(data)),/unsupported/)
})

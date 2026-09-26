import test from 'node:test'
import assert from 'node:assert/strict'
import { BoxGeometry, Mesh, MeshBasicMaterial, DoubleSide, Raycaster, Vector3, Scene, PerspectiveCamera } from 'three'
import { sectionPlane, clippedRaycast, fullyClipped } from '../src/sectionView.ts'
import { boxSelectedIds } from '../src/boxSelection.ts'

test('section planes keep the requested world side on all axes', () => {
  for(const axis of ['x','y','z']) for(const flipped of [false,true]) {
    const p=sectionPlane({enabled:true,axis,flipped,position:10})
    const v=new Vector3();v[axis]=15
    assert.equal(p.distanceToPoint(v)>0,!flipped)
    v[axis]=10;assert.equal(p.distanceToPoint(v),0)
  }
  assert.equal(sectionPlane({enabled:false,axis:'y',flipped:false,position:10}),null)
})

test('clipped geometry does not intercept ray hits or rectangle selection', () => {
  const mesh=new Mesh(new BoxGeometry(20,20,20),new MeshBasicMaterial({side:DoubleSide,
    clippingPlanes:[sectionPlane({enabled:true,axis:'z',flipped:true,position:0})]}))
  mesh.userData.cadObjectId='a';mesh.raycast=clippedRaycast;mesh.updateMatrixWorld()
  const ray=new Raycaster(new Vector3(0,0,30),new Vector3(0,0,-1))
  const hits=ray.intersectObject(mesh)
  assert.ok(hits.length>0);assert.ok(hits.every(hit=>hit.point.z<=0))
  assert.equal(fullyClipped(mesh),false)
  mesh.position.z=30;mesh.updateMatrixWorld();assert.equal(fullyClipped(mesh),true)
  const scene=new Scene();scene.add(mesh)
  const camera=new PerspectiveCamera(50,1,.1,1000);camera.position.z=100
  assert.deepEqual(boxSelectedIds(scene,camera,{left:0,top:0,right:100,bottom:100},100,100),[])
  mesh.geometry.dispose();mesh.material.dispose()
})

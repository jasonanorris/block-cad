import { BufferGeometry, Euler, Float32BufferAttribute, Matrix4, Quaternion, Uint32BufferAttribute, Vector3 } from 'three'
import type { Manifold, ManifoldToplevel, Mat4 } from 'manifold-3d'
import type { CadObject, HoleObject } from './cadModel'

function objectMatrix(object: CadObject): Matrix4 {
  const { position, rotation, scale } = object
  const quaternion = new Quaternion().setFromEuler(new Euler(rotation.x, rotation.y, rotation.z, 'XYZ'))
  return new Matrix4().compose(
    new Vector3(position.x, position.y, position.z),
    quaternion,
    new Vector3(scale.x, scale.y, scale.z),
  )
}

// Manifold cylinders point along Z. The workspace's cylinder axis is Y.
const CYLINDER_TO_Y = new Matrix4().makeRotationX(-Math.PI / 2)

export function subtractHoles(target: CadObject, holes: HoleObject[], runtime: ManifoldToplevel): BufferGeometry {
  const allocated: Manifold[] = []
  const track = (solid: Manifold) => { allocated.push(solid); return solid }

  function primitive(object: CadObject): Manifold {
    switch (object.type) {
      case 'box':
        return track(runtime.Manifold.cube([object.dimensions.x, object.dimensions.y, object.dimensions.z], true))
      case 'cylinder': {
        const cylinder = track(runtime.Manifold.cylinder(
          object.dimensions.height,
          object.dimensions.diameter / 2,
          object.dimensions.diameter / 2,
          32,
          true,
        ))
        return track(cylinder.transform(CYLINDER_TO_Y.elements as Mat4))
      }
      case 'sphere':
        return track(runtime.Manifold.sphere(object.dimensions.diameter / 2, 32))
    }
  }

  try {
    if ([target.scale.x, target.scale.y, target.scale.z].some((value) => Math.abs(value) < 1e-6)) {
      throw new Error('A cut target must have nonzero scale on every axis.')
    }
    let result = primitive(target)
    const worldToTarget = objectMatrix(target).invert()

    for (const hole of holes) {
      const shape = primitive(hole)
      const relativeMatrix = worldToTarget.clone().multiply(objectMatrix(hole))
      const transformed = track(shape.transform(relativeMatrix.elements as Mat4))
      result = track(result.subtract(transformed))
    }

    const mesh = result.getMesh()
    const positions = new Float32Array(mesh.numVert * 3)
    for (let vertex = 0; vertex < mesh.numVert; vertex++) {
      for (let axis = 0; axis < 3; axis++) {
        positions[vertex * 3 + axis] = mesh.vertProperties[vertex * mesh.numProp + axis]
      }
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setIndex(new Uint32BufferAttribute(mesh.triVerts, 1))
    geometry.computeVertexNormals()
    return geometry
  } finally {
    for (const solid of allocated) solid.delete()
  }
}

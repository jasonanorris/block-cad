import { BufferGeometry, Euler, Float32BufferAttribute, Matrix4, Quaternion, Uint32BufferAttribute, Vector3 } from 'three'
import type { Manifold, ManifoldToplevel, Mat4 } from 'manifold-3d'
import type { CadObject, SolidBody } from './cadModel'
import { customProfile } from './customShapes'
import { stlMeshManifold } from './stlMesh'
import { basicShapeGeometry } from './basicShapeGeometry'

export function objectMatrix(object: CadObject): Matrix4 {
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

// The callback reads the result while its temporary Manifold objects are alive.
export function readSolidManifold<T>(body: SolidBody, runtime: ManifoldToplevel, read: (solid: Manifold) => T): T {
  const allocated: Manifold[] = []
  const track = (solid: Manifold) => { allocated.push(solid); return solid }

  function primitive(object: CadObject): Manifold {
    switch (object.type) {
      case 'custom': {
        const { contours, depth, upright } = customProfile(object.parameters)
        const polygons = [contours.outline, ...contours.holes].map((contour) => contour.map((p): [number, number] => [p.x, p.y]))
        const section = new runtime.CrossSection(polygons, 'EvenOdd')
        try {
          const extruded = track(section.extrude(depth, 0, 0, [1, 1], true))
          return upright ? extruded : track(extruded.transform(CYLINDER_TO_Y.elements as Mat4))
        } finally { section.delete() }
      }
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
      case 'cone':
      case 'wedge':
      case 'prism': {
        const geometry = basicShapeGeometry(object)
        try {
          return track(runtime.Manifold.ofMesh(new runtime.Mesh({ numProp: 3,
            vertProperties: new Float32Array(geometry.getAttribute('position').array),
            triVerts: new Uint32Array(geometry.getIndex()!.array),
          })))
        } finally { geometry.dispose() }
      }
      case 'text':
      case 'svg': {
        const contours = object.type === 'text' ? object.contours : [object.contours]
        const polygons = contours.flatMap((contour) => [contour.outline, ...contour.holes])
          .map((contour) => contour.map((point): [number, number] => [point.x, point.y]))
        const section = new runtime.CrossSection(polygons, 'EvenOdd')
        try {
          const extruded = track(section.extrude(object.dimensions.y, 0, 0, [1, 1], true))
          return track(extruded.transform(CYLINDER_TO_Y.elements as Mat4))
        } finally {
          section.delete()
        }
      }
      case 'stl':
        return track(stlMeshManifold(object.meshData, runtime))
    }
  }

  try {
    if (body.members.some((member) => [member.scale.x, member.scale.y, member.scale.z]
      .some((value) => Math.abs(value) < 1e-6))) {
      throw new Error('A joined or cut solid must have nonzero scale on every axis.')
    }
    let result = primitive(body.anchor)
    const worldToAnchor = objectMatrix(body.anchor).invert()

    for (const member of body.members.slice(1)) {
      const shape = primitive(member)
      const relativeMatrix = worldToAnchor.clone().multiply(objectMatrix(member))
      const transformed = track(shape.transform(relativeMatrix.elements as Mat4))
      result = track(body.anchor.joinMode === 'intersection'
        ? result.intersect(transformed)
        : result.add(transformed))
    }

    for (const hole of body.holes) {
      const shape = primitive(hole)
      const relativeMatrix = worldToAnchor.clone().multiply(objectMatrix(hole))
      const transformed = track(shape.transform(relativeMatrix.elements as Mat4))
      result = track(result.subtract(transformed))
    }

    return read(result)
  } finally {
    for (const solid of allocated) solid.delete()
  }
}

export function buildSolidGeometry(body: SolidBody, runtime: ManifoldToplevel): BufferGeometry {
  return readSolidManifold(body, runtime, (result) => {
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
  })
}

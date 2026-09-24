import { BoxGeometry, CylinderGeometry, Mesh, Scene, SphereGeometry, type BufferGeometry } from 'three'
import { STLExporter } from 'three/addons/exporters/STLExporter.js'
import { isHoleObject, type CadObject } from './cadModel'
import { subtractHoles } from './booleanGeometry'
import { loadManifold } from './manifoldRuntime'

function geometryFor(object: CadObject): BufferGeometry {
  switch (object.type) {
    case 'box':
      return new BoxGeometry(object.dimensions.x, object.dimensions.y, object.dimensions.z)
    case 'cylinder':
      return new CylinderGeometry(object.dimensions.diameter / 2, object.dimensions.diameter / 2, object.dimensions.height, 32)
    case 'sphere':
      return new SphereGeometry(object.dimensions.diameter / 2, 32, 16)
  }
}

function reverseWinding(geometry: BufferGeometry) {
  const index = geometry.getIndex()
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const second = index.getX(i + 1)
      index.setX(i + 1, index.getX(i + 2))
      index.setX(i + 2, second)
    }
  } else {
    const position = geometry.getAttribute('position')
    for (let i = 0; i < position.count; i += 3) {
      for (let axis = 0; axis < 3; axis++) {
        const second = position.getComponent(i + 1, axis)
        position.setComponent(i + 1, axis, position.getComponent(i + 2, axis))
        position.setComponent(i + 2, axis, second)
      }
    }
  }
}

// STL stores bare coordinates without units. One scene unit is one millimeter.
export async function exportStl(objects: CadObject[]): Promise<ArrayBuffer> {
  const scene = new Scene()
  const geometries: BufferGeometry[] = []
  const holes = objects.filter(isHoleObject)
  const hasCuts = holes.length > 0
  const runtime = hasCuts ? await loadManifold() : null

  try {
    for (const object of objects) {
      if (isHoleObject(object)) continue
      const targetHoles = holes.filter((hole) => hole.cutTargetId === object.id)
      const geometry = targetHoles.length && runtime
        ? subtractHoles(object, targetHoles, runtime)
        : geometryFor(object)
      geometries.push(geometry)
      if (object.scale.x * object.scale.y * object.scale.z < 0) reverseWinding(geometry)

      const mesh = new Mesh(geometry)
      mesh.position.set(object.position.x, object.position.y, object.position.z)
      mesh.rotation.set(object.rotation.x, object.rotation.y, object.rotation.z)
      mesh.scale.set(object.scale.x, object.scale.y, object.scale.z)
      scene.add(mesh)
    }

    scene.updateMatrixWorld(true)
    return new STLExporter().parse(scene, { binary: true }).buffer
  } finally {
    for (const geometry of geometries) geometry.dispose()
  }
}

import { customGeometry } from './customShapes'
import { BoxGeometry, CylinderGeometry, SphereGeometry, type BufferGeometry } from 'three'
import type { CadObject } from './cadModel'
import { svgGeometry } from './svgGeometry'
import { stlMeshGeometry } from './stlMesh'
import { basicShapeGeometry } from './basicShapeGeometry'

export function createSourceGeometry(object: CadObject): BufferGeometry {
  switch (object.type) {
    case 'custom': return customGeometry(object.parameters)
    case 'box': return new BoxGeometry(object.dimensions.x, object.dimensions.y, object.dimensions.z)
    case 'cylinder': return new CylinderGeometry(object.dimensions.diameter / 2, object.dimensions.diameter / 2, object.dimensions.height, 32)
    case 'sphere': return new SphereGeometry(object.dimensions.diameter / 2, 32, 16)
    case 'cone':
    case 'wedge':
    case 'prism': return basicShapeGeometry(object)
    case 'text':
    case 'svg': return svgGeometry(object.contours, object.dimensions)
    case 'stl': return stlMeshGeometry(object.meshData)
  }
}

import { ExtrudeGeometry, Path, Shape, Vector2 } from 'three'
import type { BufferGeometry } from 'three'
import type { SvgContours, Vector3 } from './cadModel'

// SVG X/Y becomes model X/-Z; extrusion becomes model Y.
export function svgGeometry(contours: SvgContours | SvgContours[], dimensions: Vector3): BufferGeometry {
  const shape = (Array.isArray(contours) ? contours : [contours]).map((contour) => {
    const item = new Shape(contour.outline.map((point) => new Vector2(point.x, point.y)))
    item.holes = contour.holes.map((hole) => new Path(hole.map((point) => new Vector2(point.x, point.y))))
    return item
  })
  const geometry = new ExtrudeGeometry(shape, { depth: dimensions.y, bevelEnabled: false, curveSegments: 1 })
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, -dimensions.y / 2, 0)
  return geometry
}

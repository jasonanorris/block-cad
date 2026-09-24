import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'
import type { Shape, Vector2 } from 'three'
import type { CadObject, Point2, SvgContours } from './cadModel'

const IMPORT_WIDTH = 40
const IMPORT_HEIGHT = 5
const MAX_SVG_LENGTH = 1_000_000
const MAX_SHAPES = 100
const MAX_POINTS = 20_000

function points(values: Vector2[]): Point2[] {
  const result = values.map(({ x, y }) => ({ x, y }))
  if (result.length > 1 && result[0].x === result.at(-1)?.x && result[0].y === result.at(-1)?.y) result.pop()
  return result
}

function shapeContours(shape: Shape): SvgContours {
  const sampled = shape.extractPoints(12)
  return { outline: points(sampled.shape), holes: sampled.holes.map(points) }
}

export function importSvg(text: string, filename: string, workplaneHeight: number, x = 0, z = 0): CadObject[] {
  if (text.length > MAX_SVG_LENGTH) throw new Error('SVG files must be under 1 MB.')
  const result = new SVGLoader().parse(text)
  // SVGLoader's runtime result is the root element (its TypeScript declaration says Document).
  if ((result.xml as unknown as Element).localName?.toLowerCase() !== 'svg') throw new Error('This is not an SVG file.')

  const shapes = result.paths.flatMap((path) => {
    const style = path.userData?.style
    return style?.fill === 'none' || style?.fillOpacity === 0 ? [] : SVGLoader.createShapes(path)
  })
  if (shapes.length === 0) throw new Error('The SVG has no filled shapes to import.')
  if (shapes.length > MAX_SHAPES) throw new Error('The SVG has too many separate filled shapes (maximum 100).')

  const contours = shapes.map(shapeContours)
  const pointCount = contours.reduce((count, shape) => count + shape.outline.length +
    shape.holes.reduce((holes, hole) => holes + hole.length, 0), 0)
  if (pointCount > MAX_POINTS) throw new Error('The SVG outline is too detailed to import.')
  if (contours.some((shape) => shape.outline.length < 3 || shape.holes.length > 100 ||
    shape.holes.some((hole) => hole.length < 3))) {
    throw new Error('The SVG contains an invalid filled outline.')
  }

  const allPoints = contours.flatMap((shape) => shape.outline)
  const minX = Math.min(...allPoints.map((point) => point.x))
  const maxX = Math.max(...allPoints.map((point) => point.x))
  const minY = Math.min(...allPoints.map((point) => point.y))
  const maxY = Math.max(...allPoints.map((point) => point.y))
  const extent = Math.max(maxX - minX, maxY - minY)
  if (!Number.isFinite(extent) || extent <= 0) throw new Error('The SVG has no usable filled area.')
  const factor = IMPORT_WIDTH / extent
  const documentCenterX = (minX + maxX) / 2
  const documentCenterY = (minY + maxY) / 2
  const baseName = filename.replace(/\.svg$/i, '').trim().slice(0, 72) || 'Imported SVG'

  return contours.map((shape, index) => {
    const left = Math.min(...shape.outline.map((point) => point.x))
    const right = Math.max(...shape.outline.map((point) => point.x))
    const top = Math.min(...shape.outline.map((point) => point.y))
    const bottom = Math.max(...shape.outline.map((point) => point.y))
    if (right <= left || bottom <= top) throw new Error('The SVG contains a shape with no area.')
    const centerX = (left + right) / 2
    const centerY = (top + bottom) / 2
    const local = (point: Point2): Point2 => ({ x: (point.x - centerX) * factor, y: (point.y - centerY) * factor })
    return {
      id: crypto.randomUUID(),
      name: shapes.length === 1 ? baseName : `${baseName} #${index + 1}`,
      type: 'svg' as const,
      dimensions: { x: (right - left) * factor, y: IMPORT_HEIGHT, z: (bottom - top) * factor },
      contours: { outline: shape.outline.map(local), holes: shape.holes.map((hole) => hole.map(local)) },
      position: { x: x + (centerX - documentCenterX) * factor, y: workplaneHeight + IMPORT_HEIGHT / 2,
        z: z - (centerY - documentCenterY) * factor },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    }
  })
}

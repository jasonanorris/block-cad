import { FontLoader } from 'three/addons/loaders/FontLoader.js'
import fontData from 'three/examples/fonts/helvetiker_regular.typeface.json'
import type { Shape, Vector2 } from 'three'
import type { CadObject, SvgContours } from './cadModel'

const font = new FontLoader().parse(fontData)
const glyphs = fontData.glyphs as Record<string, unknown>

function points(values: Vector2[]) {
  const result = values.map(({ x, y }) => ({ x, y }))
  if (result.length > 1 && result[0].x === result.at(-1)!.x && result[0].y === result.at(-1)!.y) result.pop()
  return result
}

export function textContours(text: string, fontSize: number): { contours: SvgContours[]; width: number; depth: number } {
  if (!text.trim() || text.length > 80) throw new Error('Enter 1 to 80 characters of text.')
  if (!Number.isFinite(fontSize) || fontSize < 1 || fontSize > 200) throw new Error('Font size must be between 1 and 200 mm.')
  const unsupported = [...new Set(Array.from(text).filter((char) => char !== '\n' && !Object.hasOwn(glyphs, char)))]
  if (unsupported.length) throw new Error(`This font does not support: ${unsupported.join(' ')}`)
  const contours = font.generateShapes(text, fontSize).map((shape: Shape) => {
    const sampled = shape.extractPoints(8)
    return { outline: points(sampled.shape), holes: sampled.holes.map(points) }
  })
  const all = contours.flatMap((shape) => shape.outline)
  if (!all.length || contours.length > 160) throw new Error('The text has no usable outline or too many separate shapes.')
  const minX = Math.min(...all.map((p) => p.x)), maxX = Math.max(...all.map((p) => p.x))
  const minY = Math.min(...all.map((p) => p.y)), maxY = Math.max(...all.map((p) => p.y))
  const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2
  for (const shape of contours) for (const contour of [shape.outline, ...shape.holes]) {
    for (const point of contour) { point.x -= centerX; point.y -= centerY }
  }
  return { contours, width: maxX - minX, depth: maxY - minY }
}

export function createTextObject(text: string, fontSize: number, height: number, workplaneHeight = 0): Extract<CadObject, { type: 'text' }> {
  if (!Number.isFinite(height) || height <= 0 || height > 200) throw new Error('Text extrusion must be greater than 0 and at most 200 mm.')
  const result = textContours(text, fontSize)
  return { id: crypto.randomUUID(), name: text.replace(/\s+/g, ' ').trim().slice(0, 80), type: 'text', text, fontSize,
    contours: result.contours, dimensions: { x: result.width, y: height, z: result.depth },
    position: { x: 0, y: workplaneHeight + height / 2, z: 0 },
    rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } }
}

export function changeText(object: Extract<CadObject, { type: 'text' }>, text: string, fontSize: number, height: number): CadObject {
  const next = createTextObject(text, fontSize, height)
  return { ...object, text, fontSize, contours: next.contours, dimensions: next.dimensions }
}

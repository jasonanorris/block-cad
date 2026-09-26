import { ExtrudeGeometry, Path, Shape, Vector2 } from 'three'
import type { CadObject, Point2, SvgContours, Vector3 } from './cadModel'

export type CustomParameters =
  | { kind: 'tube'; diameter: number; wall: number; height: number }
  | { kind: 'rounded-box'; width: number; depth: number; height: number; radius: number }
  | { kind: 'bracket'; width: number; height: number; depth: number; wall: number }
export const customDefaults: Record<CustomParameters['kind'], CustomParameters> = {
  tube: { kind: 'tube', diameter: 30, wall: 3, height: 25 },
  'rounded-box': { kind: 'rounded-box', width: 40, depth: 30, height: 15, radius: 5 },
  bracket: { kind: 'bracket', width: 40, height: 30, depth: 20, wall: 4 },
}
export const customLabels = { tube: 'Tube', 'rounded-box': 'Rounded box', bracket: 'L bracket' }

export function validateCustomParameters(value: unknown): CustomParameters {
  if (!value || typeof value !== 'object') throw new Error('Custom shape parameters are missing.')
  const p = value as Record<string, unknown>
  const number = (key: string, allowZero = false) => {
    const value = p[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < (allowZero ? 0 : .01) || value > 1000) {
      throw new Error(`${key} must be ${allowZero ? '0' : '0.01'} to 1000 mm.`)
    }
    return value
  }
  if (p.kind === 'tube') {
    const diameter = number('diameter'), wall = number('wall'), height = number('height')
    if (wall * 2 >= diameter) throw new Error('Tube wall must be less than half its diameter.')
    return { kind: p.kind, diameter, wall, height }
  }
  if (p.kind === 'rounded-box') {
    const width = number('width'), depth = number('depth'), height = number('height'), radius = number('radius', true)
    if (radius > Math.min(width, depth) / 2) throw new Error('Corner radius cannot exceed half the smaller width/depth.')
    return { kind: p.kind, width, depth, height, radius }
  }
  if (p.kind === 'bracket') {
    const width = number('width'), height = number('height'), depth = number('depth'), wall = number('wall')
    if (wall >= Math.min(width, height)) throw new Error('Bracket wall must be smaller than its width and height.')
    return { kind: p.kind, width, height, depth, wall }
  }
  throw new Error('Choose a supported custom shape.')
}

export function customProfile(parameters: CustomParameters): { contours: SvgContours; depth: number; upright: boolean; dimensions: Vector3 } {
  const p = validateCustomParameters(parameters)
  let outline: Point2[], holes: Point2[][] = []
  if (p.kind === 'tube') {
    const circle = (radius: number) => Array.from({ length: 64 }, (_, i) => ({ x: radius * Math.cos(i * Math.PI / 32), y: radius * Math.sin(i * Math.PI / 32) }))
    outline = circle(p.diameter / 2); holes = [circle(p.diameter / 2 - p.wall)]
  } else if (p.kind === 'bracket') {
    outline = [[0, 0], [p.width, 0], [p.width, p.wall], [p.wall, p.wall], [p.wall, p.height], [0, p.height]]
      .map(([x, y]) => ({ x: x - p.width / 2, y: y - p.height / 2 }))
  } else if (p.radius === 0) {
    outline = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => ({ x: x * p.width / 2, y: y * p.depth / 2 }))
  } else {
    outline = []
    const centers = [[1, 1], [-1, 1], [-1, -1], [1, -1]]
    centers.forEach(([x, y], corner) => {
      for (let step = 0; step <= 12; step++) {
        const angle = (corner + step / 12) * Math.PI / 2
        const point = { x: x * (p.width / 2 - p.radius) + p.radius * Math.cos(angle),
          y: y * (p.depth / 2 - p.radius) + p.radius * Math.sin(angle) }
        const previous = outline.at(-1)
        if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 1e-8) outline.push(point)
      }
    })
    if (Math.hypot(outline[0].x - outline.at(-1)!.x, outline[0].y - outline.at(-1)!.y) < 1e-8) outline.pop()
  }
  const dimensions = p.kind === 'tube' ? { x: p.diameter, y: p.height, z: p.diameter }
    : { x: p.width, y: p.height, z: p.depth }
  return { contours: { outline, holes }, dimensions, depth: p.kind === 'bracket' ? p.depth : p.height, upright: p.kind === 'bracket' }
}

export function customGeometry(parameters: CustomParameters) {
  const profile = customProfile(parameters)
  const shape = new Shape(profile.contours.outline.map((p) => new Vector2(p.x, p.y)))
  shape.holes = profile.contours.holes.map((hole) => new Path(hole.map((p) => new Vector2(p.x, p.y))))
  const geometry = new ExtrudeGeometry(shape, { depth: profile.depth, bevelEnabled: false, curveSegments: 1 })
  geometry.translate(0, 0, -profile.depth / 2)
  if (!profile.upright) geometry.rotateX(-Math.PI / 2)
  return geometry
}

export function createCustomShape(parameters: CustomParameters, workplaneHeight = 0): Extract<CadObject, { type: 'custom' }> {
  const checked = validateCustomParameters(parameters), { dimensions } = customProfile(checked)
  return { id: crypto.randomUUID(), type: 'custom', name: customLabels[checked.kind], parameters: checked, dimensions,
    position: { x: 0, y: workplaneHeight + dimensions.y / 2, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } }
}
export function changeCustomShape(object: Extract<CadObject, { type: 'custom' }>, parameters: CustomParameters): CadObject {
  const next = createCustomShape(parameters)
  return { ...object, parameters: next.parameters, dimensions: next.dimensions }
}

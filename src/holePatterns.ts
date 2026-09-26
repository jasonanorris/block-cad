import { getSolidBodies, isHoleObject, type CadObject } from './cadModel'
import { getPlacementBounds, getPlacementUnits } from './placement'
import { onFaceWorkplane, type WorkplaneFrame } from './workplane'

export type HolePattern = { layout: 'row' | 'grid' | 'circle'; count: number; rows: number; columns: number;
  spacingX: number; spacingZ: number; circleDiameter: number; startAngle: number; diameter: number; depth: number; offsetX: number; offsetZ: number }
export const defaultHolePattern: HolePattern = { layout: 'row', count: 3, rows: 2, columns: 3, spacingX: 10, spacingZ: 10,
  circleDiameter: 25, startAngle: 0, diameter: 3, depth: 10, offsetX: 0, offsetZ: 0 }

export function patternPoints(p: HolePattern) {
  if (!['row', 'grid', 'circle'].includes(p.layout)) throw new Error('Choose a hole pattern layout.')
  const positive = (value: number) => Number.isFinite(value) && value >= .01 && value <= 10000
  if (![p.diameter, p.depth].every(positive) || ![p.offsetX, p.offsetZ, p.startAngle].every((v) => Number.isFinite(v) && Math.abs(v) <= 10000)) throw new Error('Enter finite hole dimensions and offsets within 10,000 mm/degrees.')
  const count = p.layout === 'grid' ? p.rows * p.columns : p.count
  if (!Number.isInteger(count) || count < 1 || count > 200 || (p.layout === 'grid' &&
    (!Number.isInteger(p.rows) || !Number.isInteger(p.columns) || p.rows < 1 || p.columns < 1))) throw new Error('A pattern must contain 1 to 200 holes using whole counts.')
  if (p.layout === 'circle' ? !positive(p.circleDiameter) : !positive(p.spacingX) || (p.layout === 'grid' && !positive(p.spacingZ))) throw new Error('Pattern spacing/diameter must be 0.01 to 10,000 mm.')
  return Array.from({ length: count }, (_, i) => {
    if (p.layout === 'circle') {
      const angle = p.startAngle * Math.PI / 180 + i * Math.PI * 2 / count
      return { x: p.offsetX + p.circleDiameter / 2 * Math.cos(angle), z: p.offsetZ + p.circleDiameter / 2 * Math.sin(angle) }
    }
    const columns = p.layout === 'row' ? p.count : p.columns, rows = p.layout === 'row' ? 1 : p.rows
    return { x: p.offsetX + (i % columns - (columns - 1) / 2) * p.spacingX,
      z: p.offsetZ + (Math.floor(i / columns) - (rows - 1) / 2) * p.spacingZ }
  })
}

export async function createHolePattern(objects: CadObject[], targetId: string, parameters: HolePattern, facePlane: WorkplaneFrame | null) {
  const points = patternPoints(parameters)
  const target = getSolidBodies(objects).find((body) => body.members.some((object) => object.id === targetId))
  if (!target || target.members.some((object) => object.hidden || object.locked) || isHoleObject(target.anchor)) throw new Error('Select a visible, unlocked solid target for the holes.')
  let frame = facePlane
  if (!frame) {
    const bounds = await getPlacementBounds(getPlacementUnits(objects, new Set([target.anchor.id]))[0])
    frame = { origin: { x: (bounds.min.x + bounds.max.x) / 2, y: bounds.max.y, z: (bounds.min.z + bounds.max.z) / 2 }, rotation: { x: 0, y: 0, z: 0 } }
  }
  const holes: CadObject[] = points.map(({ x, z }, i) => ({ id: crypto.randomUUID(), type: 'cylinder', name: `Pattern hole ${i + 1}`,
    dimensions: { diameter: parameters.diameter, height: parameters.depth + .02 },
    position: { x, y: -parameters.depth / 2 + .01, z }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 },
    cutTargetId: target.anchor.id, groupedWithTarget: true }))
  return { holes: onFaceWorkplane(holes, frame), targetId: target.anchor.id }
}

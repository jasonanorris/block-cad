import { Box3, Vector3 } from 'three'
import type { CadObject } from './cadModel'
import { selectedExportObjects } from './exportSelection'
import { getPlacementBounds, getPlacementUnits } from './placement'
import { copyCadObjects } from './selectionOperations'

export async function preparePart(objects: CadObject[], ids: Set<string>): Promise<CadObject[]> {
  const sources = selectedExportObjects(objects, ids)
  if (!sources.length) throw new Error('Select at least one solid to save a part. Its assembly and all linked holes are included.')
  const copies = copyCadObjects(sources, 0, []).copies
  const units = getPlacementUnits(copies, new Set(copies.map((object) => object.id)))
  const bounds = new Box3()
  for (const box of await Promise.all(units.map(getPlacementBounds))) bounds.union(box)
  const center = bounds.getCenter(new Vector3())
  return copies.map((object) => ({ ...object, position: {
    x: object.position.x - center.x, y: object.position.y - bounds.min.y, z: object.position.z - center.z,
  } }))
}

export function insertPart(sources: CadObject[], workplaneHeight: number): CadObject[] {
  if (!Number.isFinite(workplaneHeight)) throw new Error('Workplane height must be finite.')
  const copies = copyCadObjects(sources, 0, []).copies
  return copies.map((object) => {
    const y = object.position.y + workplaneHeight
    if (!Number.isFinite(y)) throw new Error('The part would be outside the supported coordinate range.')
    return { ...object, position: { ...object.position, y } }
  })
}

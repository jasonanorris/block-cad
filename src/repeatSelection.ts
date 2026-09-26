import type { CadObject, Vector3 } from './cadModel'
import { copyCadObjects, expandAssemblyIds } from './selectionOperations'

export function repeatSelection(objects: CadObject[], ids: Set<string>, axis: keyof Vector3, count: number, spacing: number) {
  if (!Number.isInteger(count) || count < 2 || count > 100) throw new Error('Count must be a whole number from 2 to 100, including the original.')
  if (!Number.isFinite(spacing) || spacing === 0) throw new Error('Spacing must be a nonzero distance in millimeters.')
  const expanded = expandAssemblyIds(objects, ids, true)
  const sources = objects.filter((object) => expanded.has(object.id))
  if (sources.length * (count - 1) > 1000) throw new Error('An array can add up to 1,000 source shapes. Reduce the count or selection.')
  const copies: CadObject[] = []
  let lastCopiedIds = new Map<string, string>()
  for (let step = 1; step < count; step++) {
    const result = copyCadObjects(sources, 0, objects)
    for (const object of result.copies) {
      object.position[axis] += spacing * step
      if (!Number.isFinite(object.position[axis])) throw new Error('This spacing produces coordinates that are too large.')
    }
    copies.push(...result.copies)
    lastCopiedIds = result.copiedIds
  }
  return { copies, lastCopiedIds }
}

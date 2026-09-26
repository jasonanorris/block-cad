import { Box3, Vector3 } from 'three'
import type { CadObject } from './cadModel'
import { getPlacementBounds, getPlacementUnits } from './placement'

export function boundsGap(a: Box3, b: Box3) {
  return new Vector3(...(['x', 'y', 'z'] as const).map((axis) =>
    Math.max(0, b.min[axis] - a.max[axis], a.min[axis] - b.max[axis])) as [number, number, number])
}

export async function measureSelection(objects: CadObject[], selectedIds: string[], activeId: string | null) {
  const units = getPlacementUnits(objects, new Set(selectedIds))
  const bounds = await Promise.all(units.map(getPlacementBounds))
  const activeIndex = units.findIndex((unit) => activeId !== null && unit.ids.has(activeId))
  const active = bounds[activeIndex]
  const combined = bounds.reduce((result, box) => result.union(box), new Box3())
  return {
    size: active?.getSize(new Vector3()).toArray() ?? null,
    span: bounds.length > 1 ? combined.getSize(new Vector3()).toArray() : null,
    gaps: active ? units.flatMap((unit, index) => index === activeIndex ? [] : [{
      id: unit.body.anchor.id,
      name: unit.body.anchor.name || `${unit.body.anchor.type} #${objects.indexOf(unit.body.anchor) + 1}`,
      axes: boundsGap(active, bounds[index]).toArray(),
    }]) : [],
  }
}

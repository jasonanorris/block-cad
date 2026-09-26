import { Box3, Vector3 } from 'three'
import { isHoleObject, type CadObject } from './cadModel'
import { objectMatrix } from './booleanGeometry'
import { createSourceGeometry } from './sourceGeometry'
import { expandAssemblyIds } from './selectionOperations'

export type SnapTarget = { id: string; name: string; bounds: Box3 }

export function sourceBounds(object: CadObject): Box3 {
  const geometry = createSourceGeometry(object)
  try {
    const bounds = new Box3(), point = new Vector3(), matrix = objectMatrix(object)
    const positions = geometry.getAttribute('position')
    for (let i = 0; i < positions.count; i++) bounds.expandByPoint(point.fromBufferAttribute(positions, i).applyMatrix4(matrix))
    return bounds
  } finally { geometry.dispose() }
}

export function createSnapSnapshot(objects: CadObject[], activeId: string, visibleIds: Set<string>) {
  const active = objects.find((object) => object.id === activeId)
  if (!active || active.hidden || active.locked) return null
  const excluded = isHoleObject(active) ? new Set([activeId]) : expandAssemblyIds(objects, new Set([activeId]), true)
  return {
    origin: new Vector3(active.position.x, active.position.y, active.position.z),
    bounds: sourceBounds(active),
    targets: objects.filter((object) => !object.hidden && visibleIds.has(object.id) && !excluded.has(object.id))
      .map((object) => ({ id: object.id, name: object.name || `${object.type} #${objects.indexOf(object) + 1}`, bounds: sourceBounds(object) })),
  }
}

// Evaluate from the unmodified drag position on each frame, so moving away releases a snap.
export function snapTranslation(bounds: Box3, targets: SnapTarget[], offset: Vector3, handle: string, tolerance = 2) {
  const adjusted = offset.clone()
  const matches: { axis: string; target: string }[] = []
  if (bounds.isEmpty()) return { offset: adjusted, matches }
  for (const axis of ['x', 'y', 'z'] as const) {
    if (!handle.includes(axis.toUpperCase())) continue
    const moving = [bounds.min[axis], (bounds.min[axis] + bounds.max[axis]) / 2, bounds.max[axis]]
    let best: { delta: number; target: string } | null = null
    for (const target of targets) {
      if (target.bounds.isEmpty()) continue
      const fixed = [target.bounds.min[axis], (target.bounds.min[axis] + target.bounds.max[axis]) / 2, target.bounds.max[axis]]
      for (const a of moving) for (const b of fixed) {
        const delta = b - (a + offset[axis])
        if (Math.abs(delta) <= tolerance && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, target: target.name }
      }
    }
    if (best) { adjusted[axis] += best.delta; matches.push({ axis: axis.toUpperCase(), target: best.target }) }
  }
  return { offset: adjusted, matches }
}

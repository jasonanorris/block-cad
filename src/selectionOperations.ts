import { duplicateCadObject, isHoleObject, type CadObject, type Vector3 } from './cadModel'
import { updateObjectWithGroups } from './groupTransforms'

type Axis = keyof Vector3

function selectedSolidIds(objects: CadObject[], ids: Set<string>, includeGroupedHoleTargets: boolean): Set<string> {
  const solids = new Set(objects.filter((object) => ids.has(object.id) && !isHoleObject(object))
    .map((object) => object.id))
  if (includeGroupedHoleTargets) {
    for (const hole of objects.filter(isHoleObject)) {
      if (ids.has(hole.id) && hole.groupedWithTarget) solids.add(hole.cutTargetId)
    }
  }
  const groups = new Set(objects.filter((object) => solids.has(object.id) && object.joinGroupId)
    .map((object) => object.joinGroupId))
  for (const object of objects) {
    if (object.joinGroupId && groups.has(object.joinGroupId)) solids.add(object.id)
  }
  return solids
}

// An assembly's selected solid carries its joined members and linked holes.
export function expandAssemblyIds(objects: CadObject[], ids: Set<string>, includeGroupedHoleTargets = false): Set<string> {
  const solids = selectedSolidIds(objects, ids, includeGroupedHoleTargets)
  const expanded = new Set([...ids, ...solids])
  for (const hole of objects.filter(isHoleObject)) {
    if (solids.has(hole.cutTargetId)) expanded.add(hole.id)
  }
  return expanded
}

export function copyCadObjects(sources: CadObject[], offset: number, destination: CadObject[]): {
  copies: CadObject[]
  copiedIds: Map<string, string>
} {
  const copies = sources.map((object) => duplicateCadObject(object, offset))
  const copiedIds = new Map(sources.map((source, index) => [source.id, copies[index].id]))
  const destinationSolids = new Set(destination.filter((object) => !isHoleObject(object)).map((object) => object.id))
  const groupCounts = new Map<string, number>()
  for (const source of sources) {
    if (source.joinGroupId) groupCounts.set(source.joinGroupId, (groupCounts.get(source.joinGroupId) ?? 0) + 1)
  }
  const copiedGroups = new Map<string, string>()
  return {
    copies: copies.map((object) => {
      const group = object.joinGroupId
      if (group && (groupCounts.get(group) ?? 0) >= 2 && !copiedGroups.has(group)) {
        copiedGroups.set(group, crypto.randomUUID())
      }
      const target = object.cutTargetId
        ? copiedIds.get(object.cutTargetId) ?? (destinationSolids.has(object.cutTargetId) ? object.cutTargetId : undefined)
        : undefined
      const targetCopied = !!object.cutTargetId && copiedIds.has(object.cutTargetId)
      return {
        ...object,
        cutTargetId: target,
        groupedWithTarget: object.groupedWithTarget && targetCopied ? true : undefined,
        joinGroupId: group ? copiedGroups.get(group) : undefined,
        joinMode: group && copiedGroups.has(group) ? object.joinMode : undefined,
        hidden: undefined,
        locked: undefined,
      }
    }),
    copiedIds,
  }
}

function assemblyKey(object: CadObject, objects: CadObject[]): string {
  const solid = isHoleObject(object) && object.groupedWithTarget
    ? objects.find((candidate) => candidate.id === object.cutTargetId) ?? object
    : object
  return solid.joinGroupId ? `join:${solid.joinGroupId}` : `object:${solid.id}`
}

export function alignmentCandidates(objects: CadObject[], ids: Set<string>, activeId: string | null): CadObject[] {
  const active = objects.find((object) => object.id === activeId && ids.has(object.id))
  if (!active) return []
  const visited = new Set([assemblyKey(active, objects)])
  return objects.filter((object) => {
    if (!ids.has(object.id)) return false
    const key = assemblyKey(object, objects)
    if (visited.has(key)) return false
    visited.add(key)
    return true
  })
}

export function alignSelectedObjects(objects: CadObject[], ids: Set<string>, activeId: string | null, axis: Axis): CadObject[] {
  const active = objects.find((object) => object.id === activeId)
  if (!active) return objects
  let aligned = objects
  for (const candidate of alignmentCandidates(objects, ids, activeId)) {
    const current = aligned.find((object) => object.id === candidate.id)!
    const delta = active.position[axis] - current.position[axis]
    if (delta === 0) continue
    const movingId = isHoleObject(current) && current.groupedWithTarget ? current.cutTargetId : current.id
    aligned = updateObjectWithGroups(aligned, movingId, (object) => ({
      ...object,
      position: { ...object.position, [axis]: object.position[axis] + delta },
    }))
  }
  return aligned
}

// Move each selected assembly once, even when several of its members are selected.
export function nudgeSelectedObjects(objects: CadObject[], ids: Set<string>, axis: Axis, amount: number): CadObject[] {
  let moved = objects
  const visited = new Set<string>()
  for (const object of objects) {
    if (!ids.has(object.id)) continue
    const key = assemblyKey(object, objects)
    if (visited.has(key)) continue
    visited.add(key)
    const id = isHoleObject(object) && object.groupedWithTarget ? object.cutTargetId : object.id
    moved = updateObjectWithGroups(moved, id, (current) => ({
      ...current,
      position: { ...current.position, [axis]: current.position[axis] + amount },
    }))
  }
  return moved
}

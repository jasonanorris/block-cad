import { getSolidBodies, isHoleObject, type CadObject } from './cadModel'
import { objectLabel } from './objectLabels'

export type ObjectFilter = 'all' | 'solids' | 'holes' | 'hidden' | 'locked' | 'selected'

export function objectListRows(objects: CadObject[], query: string, filter: ObjectFilter, selectedIds: Set<string>) {
  const text = query.trim().toLocaleLowerCase()
  const matches = (object: CadObject) => (!text || `${objectLabel(object, objects)} #${objects.indexOf(object) + 1}`.toLocaleLowerCase().includes(text)) &&
    (filter === 'all' || filter === 'solids' && !isHoleObject(object) || filter === 'holes' && isHoleObject(object) ||
      filter === 'hidden' && object.hidden || filter === 'locked' && object.locked || filter === 'selected' && selectedIds.has(object.id))
  return getSolidBodies(objects).flatMap((body) => {
    const members = [...body.members.slice(1), ...body.holes]
    const anchorMatches = !!matches(body.anchor)
    const children = members.filter(matches)
    if (!anchorMatches && !children.length) return []
    return [{ anchor: body.anchor, anchorMatches, children, memberCount: members.length }]
  })
}

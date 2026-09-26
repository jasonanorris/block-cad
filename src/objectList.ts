import { getSolidBodies, isHoleObject, type CadObject } from './cadModel'
import { objectLabel, objectLabelContext } from './objectLabels'

export type ObjectFilter = 'all' | 'solids' | 'holes' | 'hidden' | 'locked' | 'selected'

export function objectListRows(objects: CadObject[], query: string, filter: ObjectFilter, selectedIds: Set<string>) {
  const context = objectLabelContext(objects)
  const text = query.trim().toLocaleLowerCase()
  const matches = (object: CadObject) => (!text || `${objectLabel(object, objects, context)} #${context.indices.get(object.id)}`.toLocaleLowerCase().includes(text)) &&
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

export function visibleObjectRows(rows: ReturnType<typeof objectListRows>, collapsed: Set<string>, filtering: boolean) {
  return rows.flatMap((row) => {
    const expanded = filtering || !collapsed.has(row.anchor.id)
    return [{ object: row.anchor, parent: null as CadObject | null, context: !row.anchorMatches, memberCount: row.memberCount, expanded },
      ...(expanded ? row.children.map((object) => ({ object, parent: row.anchor as CadObject | null, context: false, memberCount: 0, expanded: false })) : [])]
  })
}
export const OBJECT_PAGE_SIZE = 50

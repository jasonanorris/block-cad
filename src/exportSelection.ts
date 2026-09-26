import { getSolidBodies, type CadObject } from './cadModel'

export type ExportScope = 'all' | 'selection'

// Preserve scene order and complete Boolean dependencies. Holes never imply a
// selected solid: a hole-only selection has nothing printable to export.
export function selectedExportObjects(objects: CadObject[], selectedIds: Set<string>): CadObject[] {
  const included = new Set<string>()
  for (const body of getSolidBodies(objects)) {
    if (!body.members.some((member) => selectedIds.has(member.id))) continue
    for (const object of [...body.members, ...body.holes]) included.add(object.id)
  }
  return objects.filter((object) => included.has(object.id))
}

import { useState } from 'react'
import type { CadObject } from './cadModel'
import { objectLabel } from './objectLabels'
import { objectListRows, type ObjectFilter } from './objectList'

export default function ObjectList({ objects, selectedIds, onSelect }: {
  objects: CadObject[]
  selectedIds: string[]
  onSelect: (id: string, additive?: boolean) => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ObjectFilter>('all')
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const rows = objectListRows(objects, query, filter, new Set(selectedIds))
  const filtering = !!query.trim() || filter !== 'all'
  const matches = rows.flatMap((row) => [...(row.anchorMatches ? [row.anchor] : []), ...row.children])
  const selectButton = (object: CadObject, context = false) => <button type="button" data-object-id={object.id}
    className={`object-select${object.hidden ? ' is-hidden' : ''}${context ? ' context-row' : ''}`}
    aria-pressed={selectedIds.includes(object.id)} onClick={(event) => onSelect(object.id, event.shiftKey)}>
    <span>{objectLabel(object, objects)}{context ? ' · Assembly context' : ''}</span><span>#{objects.indexOf(object) + 1}</span>
  </button>
  return <div className="object-browser">
    <label className="object-search">Search objects<input type="search" aria-label="Search objects" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, shape, or number" /></label>
    <label className="object-filter">Filter<select aria-label="Object filter" value={filter} onChange={(event) => setFilter(event.target.value as ObjectFilter)}>
      {(['all', 'solids', 'holes', 'hidden', 'locked', 'selected'] as const).map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
    </select></label>
    <p className="selection-hint">{matches.length} of {objects.length} objects match. Filtering doesn’t change selection or visibility.</p>
    <div className="object-list" role="group" aria-label="Objects">
      {rows.map((row) => {
        const expanded = filtering || !collapsed.has(row.anchor.id)
        return <div className="object-assembly" key={row.anchor.id}>
          <div className="object-root">
            {!!row.memberCount && <button className="assembly-toggle" type="button" aria-expanded={expanded}
              aria-label={`Members of ${row.anchor.name || row.anchor.type} #${objects.indexOf(row.anchor) + 1}`}
              disabled={filtering} onClick={() => setCollapsed((current) => {
                const next = new Set(current)
                if (next.has(row.anchor.id)) next.delete(row.anchor.id); else next.add(row.anchor.id)
                return next
              })}>{expanded ? '▾' : '▸'}</button>}
            {selectButton(row.anchor, !row.anchorMatches)}
          </div>
          {expanded && row.children.length > 0 && <div className="object-children">{row.children.map((object) => <div key={object.id}>{selectButton(object)}</div>)}</div>}
        </div>
      })}
      {!rows.length && <p className="selection-hint">{objects.length ? 'No matching objects.' : 'Add a shape to begin.'}</p>}
    </div>
  </div>
}

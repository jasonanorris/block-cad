import { memo, useMemo, useState } from 'react'
import type { CadObject } from './cadModel'
import { DEFAULT_OBJECT_COLOR } from './objectColor'
import { objectLabel, objectLabelContext } from './objectLabels'
import { objectListRows, visibleObjectRows, OBJECT_PAGE_SIZE, type ObjectFilter } from './objectList'

export default memo(function ObjectList({ objects, selectedIds, onSelect }: {
  objects: CadObject[]; selectedIds: string[]; onSelect: (id: string, additive?: boolean) => void
}) {
  const [query, setQuery] = useState(''), [filter, setFilter] = useState<ObjectFilter>('all'), [page, setPage] = useState(0)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const selected = useMemo(() => new Set(selectedIds), [selectedIds])
  const context = useMemo(() => objectLabelContext(objects), [objects])
  const rows = useMemo(() => objectListRows(objects, query, filter, selected), [objects, query, filter, selected])
  const filtering = !!query.trim() || filter !== 'all'
  const visible = useMemo(() => visibleObjectRows(rows, collapsed, filtering), [rows, collapsed, filtering])
  const pages = Math.max(1, Math.ceil(visible.length / OBJECT_PAGE_SIZE)), currentPage = Math.min(page, pages - 1)
  const shown = visible.slice(currentPage * OBJECT_PAGE_SIZE, (currentPage + 1) * OBJECT_PAGE_SIZE)
  const matchCount = rows.reduce((sum, row) => sum + Number(row.anchorMatches) + row.children.length, 0)
  return <div className="object-browser">
    <label className="object-search">Search objects<input type="search" aria-label="Search objects" value={query}
      onChange={(event) => { setQuery(event.target.value); setPage(0) }} placeholder="Name, shape, or number" /></label>
    <label className="object-filter">Filter<select aria-label="Object filter" value={filter}
      onChange={(event) => { setFilter(event.target.value as ObjectFilter); setPage(0) }}>
      {(['all', 'solids', 'holes', 'hidden', 'locked', 'selected'] as const).map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
    </select></label>
    <p className="selection-hint">{matchCount} of {objects.length} objects match. Filtering doesn’t change selection or visibility.</p>
    {pages > 1 && <div className="object-pages" aria-label="Object list pages">
      <button type="button" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous objects</button>
      <span aria-live="polite">Page {currentPage + 1} of {pages}</span>
      <button type="button" disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}>Next objects</button>
      <button type="button" disabled={!visible.some((row) => selected.has(row.object.id))} onClick={() => {
        const index = visible.findIndex((row) => selected.has(row.object.id)); if (index >= 0) setPage(Math.floor(index / OBJECT_PAGE_SIZE))
      }}>Show selected page</button>
    </div>}
    <div className="object-list" role="group" aria-label="Objects" key={`${currentPage}:${query}:${filter}`}>
      {shown[0]?.parent && <p className="selection-hint">Continued members of {shown[0].parent.name || shown[0].parent.type} #{context.indices.get(shown[0].parent.id)}</p>}
      {shown.map(({ object, parent, context: contextRow, memberCount, expanded }) => <div className={`object-root${parent ? ' object-child-row' : ''}`} key={object.id}>
        {!!memberCount && <button className="assembly-toggle" type="button" aria-expanded={expanded}
          aria-label={`Members of ${object.name || object.type} #${context.indices.get(object.id)}`} disabled={filtering} onClick={() => setCollapsed((current) => {
            const next = new Set(current); if (next.has(object.id)) next.delete(object.id); else next.add(object.id); return next
          })}>{expanded ? '▾' : '▸'}</button>}
        <button type="button" data-object-id={object.id} className={`object-select${object.hidden ? ' is-hidden' : ''}${contextRow ? ' context-row' : ''}`}
          title={parent ? `Member of ${parent.name || parent.type} #${context.indices.get(parent.id)}` : undefined}
          aria-pressed={selected.has(object.id)} onClick={(event) => onSelect(object.id, event.shiftKey)}>
          <span><i className="object-swatch" aria-hidden="true" style={{ background: object.color ?? DEFAULT_OBJECT_COLOR }} />{objectLabel(object, objects, context)}{contextRow ? ' · Assembly context' : ''}</span>
          <span>#{context.indices.get(object.id)}</span>
        </button>
      </div>)}
      {!rows.length && <p className="selection-hint">{objects.length ? 'No matching objects.' : 'Add a shape to begin.'}</p>}
    </div>
  </div>
})

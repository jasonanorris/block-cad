import { useState, type ReactNode } from 'react'

const tabs = [
  ['create', 'Create', 'Shapes, text, and imports'],
  ['edit', 'Edit', 'Properties, combine, and hole patterns'],
  ['objects', 'Objects', 'Selection, visibility, and locking'],
  ['place', 'Place', 'Workplanes, alignment, and arrays'],
  ['inspect', 'Inspect', 'Sections and measurements'],
  ['library', 'Library', 'Parts, snapshots, and backups'],
] as const

type Tab = typeof tabs[number][0]

export default function ToolSidebar({ panels, selection, hasSelection }: {
  panels: Record<Tab, ReactNode>; selection: ReactNode; hasSelection: boolean
}) {
  const [active, setActive] = useState<Tab>('create')
  return <aside className="info-panel tool-sidebar" aria-label="Modeling tools">
    <div className="sidebar-selection">
      {selection}
      <button type="button" disabled={!hasSelection} onClick={() => {
        setActive('edit'); document.getElementById('tab-edit')?.focus()
      }}>Edit selection</button>
    </div>
    <div className="tool-tabs" role="tablist" aria-label="Modeling tools">
      {tabs.map(([id, label, description], index) => <button key={id} id={`tab-${id}`} type="button" role="tab"
        aria-selected={active === id} aria-controls={`panel-${id}`} tabIndex={active === id ? 0 : -1}
        title={description} onClick={() => setActive(id)} onKeyDown={(event) => {
          let next: number
          if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
          else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length
          else if (event.key === 'ArrowDown') next = (index + 3) % tabs.length
          else if (event.key === 'ArrowUp') next = (index + tabs.length - 3) % tabs.length
          else if (event.key === 'Home') next = 0
          else if (event.key === 'End') next = tabs.length - 1
          else return
          event.preventDefault(); event.stopPropagation(); setActive(tabs[next][0]); document.getElementById(`tab-${tabs[next][0]}`)?.focus()
        }}>{label}</button>)}
    </div>
    {/* Keep drafts, expanded groups, and each panel's scroll position when switching tools. */}
    {tabs.map(([id, , description]) => <section key={id} id={`panel-${id}`} className="tool-tab-panel" role="tabpanel"
      aria-labelledby={`tab-${id}`} tabIndex={0} hidden={active !== id}>
      <p className="tool-tab-description">{description}</p>
      {panels[id]}
    </section>)}
  </aside>
}

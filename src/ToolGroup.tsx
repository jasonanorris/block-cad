import type { ReactNode } from 'react'

export default function ToolGroup({ id, title, children, open = false }: {
  id: string; title: string; children: ReactNode; open?: boolean
}) {
  return <details id={id} className="tool-group" open={open} tabIndex={-1}>
    <summary>{title}</summary><div className="tool-group-content">{children}</div>
  </details>
}

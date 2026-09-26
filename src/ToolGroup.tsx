import type { ReactNode } from 'react'

export function jumpToTools(id: string) {
  const target = document.getElementById(id)
  if (!target) return
  for (let element: HTMLElement | null = target; element; element = element.parentElement) {
    if (element instanceof HTMLDetailsElement) element.open = true
  }
  target.scrollIntoView({ block: 'start', behavior: 'smooth' })
  target.focus({ preventScroll: true })
}

export default function ToolGroup({ id, title, children, open = false }: {
  id: string; title: string; children: ReactNode; open?: boolean
}) {
  return <details id={id} className="tool-group" open={open} tabIndex={-1}>
    <summary>{title}</summary><div className="tool-group-content">{children}</div>
  </details>
}

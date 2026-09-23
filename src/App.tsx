import { useState } from 'react'
import Workspace from './Workspace'
import { createStarterBox, MODEL_UNIT, type CadObject } from './cadModel'

export default function App() {
  const [objects] = useState<CadObject[]>(() => [createStarterBox()])

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true"><span /></div>
        <div className="brand-copy"><strong>Block CAD</strong><span>Simple 3D modeling</span></div>
        <span className="foundation-badge">Workspace preview</span>
      </header>
      <main className="app-main">
        <section className="workspace-panel" aria-labelledby="workspace-title">
          <div className="workspace-heading">
            <div><p className="eyebrow">Workspace</p><h1 id="workspace-title">Your canvas</h1></div>
            <div className="view-label"><span className="view-dot" /> Perspective view</div>
          </div>
          <div className="workspace-frame">
            <Workspace objects={objects} />
            <div className="workspace-hint">Drag to orbit · Scroll to zoom · Right drag to pan</div>
            <div className="axis-label">X / Y / Z <span>·</span> {MODEL_UNIT}</div>
          </div>
        </section>
        <aside className="info-panel" aria-label="Workspace information">
          <div className="panel-section">
            <p className="eyebrow">Getting started</p>
            <h2>Take a look around</h2>
            <p>The starter box sits on the workplane. Explore the scene using the camera controls.</p>
          </div>
          <div className="panel-section controls-section">
            <h3>Camera controls</h3>
            <div className="control-row"><span>Orbit</span><kbd>Drag</kbd></div>
            <div className="control-row"><span>Zoom</span><kbd>Scroll</kbd></div>
            <div className="control-row"><span>Pan</span><kbd>Right drag</kbd></div>
          </div>
          <div className="panel-note"><span className="note-icon" aria-hidden="true">i</span><p>Modeling tools will arrive in upcoming milestones.</p></div>
        </aside>
      </main>
    </div>
  )
}

import { useCallback, useState } from 'react'
import type { TransformControlsMode } from 'three/addons/controls/TransformControls.js'
import Workspace from './Workspace'
import { createCadObject, MODEL_UNIT, type CadObject, type CadObjectType, type ObjectTransform } from './cadModel'

const shapeLabels: Record<CadObjectType, string> = {
  box: 'Box',
  cylinder: 'Cylinder',
  sphere: 'Sphere',
}

export default function App() {
  const [objects, setObjects] = useState<CadObject[]>(() => [createCadObject('box')])
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const [toolMode, setToolMode] = useState<TransformControlsMode>('translate')
  const selectedObject = objects.find((object) => object.id === selectedObjectId)

  const updateObjectTransform = useCallback((id: string, transform: ObjectTransform) => {
    setObjects((current) => current.map((object) => (
      object.id === id ? { ...object, ...transform } : object
    )))
  }, [])

  function addObject(type: CadObjectType) {
    // Keep new shapes apart so each one can be seen and selected immediately.
    const index = objects.length
    const object = createCadObject(type, (index % 3) * 30, Math.floor(index / 3) * 30)
    setObjects([...objects, object])
    setSelectedObjectId(object.id)
  }

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
          <div className="workspace-toolbar" aria-label="Transform tools">
            {([
              ['translate', 'Move'],
              ['rotate', 'Rotate'],
              ['scale', 'Scale'],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={`tool-button${toolMode === mode ? ' is-active' : ''}`}
                aria-pressed={toolMode === mode}
                disabled={!selectedObject}
                onClick={() => setToolMode(mode)}
              >
                {label}
              </button>
            ))}
            {!selectedObject && <span className="toolbar-hint">Select a shape to use these tools</span>}
          </div>
          <div className="workspace-frame">
            <Workspace
              objects={objects}
              selectedObjectId={selectedObjectId}
              toolMode={toolMode}
              onSelectObject={setSelectedObjectId}
              onTransformObject={updateObjectTransform}
            />
            <div className="workspace-hint">Drag to orbit · Scroll to zoom · Right drag to pan</div>
            <div className="axis-label">X / Y / Z <span>·</span> {MODEL_UNIT}</div>
          </div>
        </section>
        <aside className="info-panel" aria-label="Workspace information">
          <div className="panel-section">
            <p className="eyebrow">Getting started</p>
            <h2>Take a look around</h2>
            <p>Add a shape below, then click any object to select it. Click empty space to clear your selection.</p>
          </div>
          <div className="panel-section shapes-section">
            <h3>Shapes</h3>
            <div className="shape-list">
              {(['box', 'cylinder', 'sphere'] as const).map((type) => (
                <button className="shape-button" key={type} type="button" onClick={() => addObject(type)}>
                  <span className={`shape-glyph ${type}`} aria-hidden="true" />
                  <span>{shapeLabels[type]}</span>
                  <span className="shape-add" aria-hidden="true">+</span>
                </button>
              ))}
            </div>
          </div>
          <div className="panel-section selection-section" aria-live="polite">
            <h3>Selection</h3>
            <div className={`selection-card${selectedObject ? ' is-selected' : ''}`}>
              <span className="selection-indicator" aria-hidden="true" />
              <span>{selectedObject ? `${shapeLabels[selectedObject.type]} selected` : 'Nothing selected'}</span>
            </div>
          </div>
          <div className="panel-section controls-section">
            <h3>Camera controls</h3>
            <div className="control-row"><span>Orbit</span><kbd>Drag</kbd></div>
            <div className="control-row"><span>Zoom</span><kbd>Scroll</kbd></div>
            <div className="control-row"><span>Pan</span><kbd>Right drag</kbd></div>
          </div>
          <div className="panel-note"><span className="note-icon" aria-hidden="true">i</span><p>Select a shape, choose a tool, and drag its handles to transform it.</p></div>
        </aside>
      </main>
    </div>
  )
}

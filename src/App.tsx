import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { TransformControlsMode } from 'three/addons/controls/TransformControls.js'
import Workspace from './Workspace'
import ObjectInspector from './ObjectInspector'
import { createCadObject, duplicateCadObject, MODEL_UNIT, type CadObject, type CadObjectType, type ObjectTransform } from './cadModel'
import { useCadHistory } from './useCadHistory'
import { parseProject, serializeProject } from './projectFile'

const shapeLabels: Record<CadObjectType, string> = {
  box: 'Box',
  cylinder: 'Cylinder',
  sphere: 'Sphere',
}

export default function App() {
  const { scene, canUndo, canRedo, commit, editObjects, select, begin, end, undo, redo, reset } = useCadHistory(() => [createCadObject('box')])
  const { objects, selectedObjectId } = scene
  const [toolMode, setToolMode] = useState<TransformControlsMode>('translate')
  const [projectError, setProjectError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const selectedObject = objects.find((object) => object.id === selectedObjectId)

  function newProject() {
    reset([])
    setToolMode('translate')
    setProjectError(null)
  }

  function saveProject() {
    const url = URL.createObjectURL(new Blob([serializeProject(objects)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'block-cad-project.json'
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function loadProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const loadedObjects = parseProject(await file.text())
      reset(loadedObjects)
      setToolMode('translate')
      setProjectError(null)
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : 'Could not load this project file.')
    }
  }

  const updateObject = useCallback((id: string, update: (current: CadObject) => CadObject) => {
    editObjects((current) => current.map((object) => object.id === id ? update(object) : object))
  }, [editObjects])

  const updateObjectTransform = useCallback((id: string, transform: ObjectTransform) => {
    updateObject(id, (object) => ({ ...object, ...transform }))
  }, [updateObject])

  function addObject(type: CadObjectType) {
    // Keep new shapes apart so each one can be seen and selected immediately.
    const index = objects.length
    const object = createCadObject(type, (index % 3) * 30, Math.floor(index / 3) * 30)
    commit((current) => ({ objects: [...current.objects, object], selectedObjectId: object.id }))
  }

  const duplicateSelected = useCallback(() => {
    const source = objects.find((object) => object.id === selectedObjectId)
    if (!source) return
    const duplicate = duplicateCadObject(source)
    commit((current) => ({ objects: [...current.objects, duplicate], selectedObjectId: duplicate.id }))
  }, [objects, selectedObjectId, commit])

  const deleteSelected = useCallback(() => {
    if (!selectedObjectId) return
    commit((current) => ({
      objects: current.objects.filter((object) => object.id !== selectedObjectId),
      selectedObjectId: null,
    }))
  }, [selectedObjectId, commit])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey) return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select'))) return

      const modifier = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      if (modifier && key === 'z') {
        event.preventDefault()
        if (!event.repeat) (event.shiftKey ? redo : undo)()
      } else if (modifier && key === 'y') {
        event.preventDefault()
        if (!event.repeat) redo()
      } else if (event.key === 'Escape') {
        select(null)
      } else if (selectedObjectId && modifier && key === 'd') {
        event.preventDefault()
        if (!event.repeat) duplicateSelected()
      } else if (selectedObjectId && !modifier && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault()
        deleteSelected()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedObjectId, duplicateSelected, deleteSelected, select, undo, redo])

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true"><span /></div>
        <div className="brand-copy"><strong>Block CAD</strong><span>Simple 3D modeling</span></div>
        <div className="project-actions" role="group" aria-label="Project files">
          <button type="button" onClick={newProject}>New</button>
          <button type="button" onClick={saveProject}>Save</button>
          <button type="button" onClick={() => fileInput.current?.click()}>Load</button>
          <input ref={fileInput} type="file" accept=".json,application/json" onChange={loadProject} hidden aria-label="Choose a Block CAD project file" />
        </div>
      </header>
      {projectError && <div className="project-error" role="alert">Could not load project: {projectError}</div>}
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
            <div className="history-actions">
              <button type="button" disabled={!canUndo} onClick={undo} title="Undo (Ctrl/Cmd+Z)">Undo</button>
              <button type="button" disabled={!canRedo} onClick={redo} title="Redo (Ctrl/Cmd+Shift+Z or Ctrl+Y)">Redo</button>
            </div>
          </div>
          <div className="workspace-frame">
            <Workspace
              objects={objects}
              selectedObjectId={selectedObjectId}
              toolMode={toolMode}
              onSelectObject={select}
              onTransformObject={updateObjectTransform}
              onTransformStart={begin}
              onTransformEnd={end}
            />
            <div className="workspace-hint">Drag to orbit · Scroll to zoom · Right drag to pan</div>
            <div className="axis-label">X / Y / Z <span>·</span> {MODEL_UNIT}</div>
          </div>
        </section>
        <aside className="info-panel" aria-label="Workspace information">
          {!selectedObject && (
            <div className="panel-section">
              <p className="eyebrow">Getting started</p>
              <h2>Take a look around</h2>
              <p>Add a shape below, then click any object to select it. Click empty space to clear your selection.</p>
            </div>
          )}
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
          <div className="panel-section selection-section">
            <h3>Selection</h3>
            <div className={`selection-card${selectedObject ? ' is-selected' : ''}`} aria-live="polite">
              <span className="selection-indicator" aria-hidden="true" />
              <span>{selectedObject ? `${shapeLabels[selectedObject.type]} selected` : 'Nothing selected'}</span>
            </div>
            <div className="selection-actions">
              <button type="button" disabled={!selectedObject} onClick={duplicateSelected} title="Duplicate (Ctrl/Cmd+D)">Duplicate</button>
              <button type="button" disabled={!selectedObject} onClick={deleteSelected} title="Delete (Delete or Backspace)">Delete</button>
            </div>
            {selectedObject && (
              <ObjectInspector
                key={selectedObject.id}
                object={selectedObject}
                onUpdate={updateObject}
                onEditStart={begin}
                onEditEnd={end}
              />
            )}
          </div>
          <div className="panel-section controls-section">
            <h3>Camera controls</h3>
            <div className="control-row"><span>Orbit</span><kbd>Drag</kbd></div>
            <div className="control-row"><span>Zoom</span><kbd>Scroll</kbd></div>
            <div className="control-row"><span>Pan</span><kbd>Right drag</kbd></div>
          </div>
          <div className="panel-note"><span className="note-icon" aria-hidden="true">i</span><p>Ctrl/Cmd+Z undoes · Ctrl/Cmd+Shift+Z redoes</p></div>
        </aside>
      </main>
    </div>
  )
}

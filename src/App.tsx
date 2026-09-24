import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { TransformControlsMode } from 'three/addons/controls/TransformControls.js'
import Workspace from './Workspace'
import ObjectInspector from './ObjectInspector'
import { createCadObject, createCutExample, duplicateCadObject, getSolidBodies, isHoleObject, MODEL_UNIT, normalizeJoinGroups, type CadObject, type CadObjectType, type ObjectTransform } from './cadModel'
import { useCadHistory } from './useCadHistory'
import { parseProject, serializeProject } from './projectFile'
import { exportStl } from './stlExport'
import type { CameraView } from './SceneControls'
import { useBooleanPreview } from './useBooleanPreview'

const shapeLabels: Record<CadObjectType, string> = {
  box: 'Box',
  cylinder: 'Cylinder',
  sphere: 'Sphere',
}

function objectLabel(object: CadObject) {
  const shape = `${shapeLabels[object.type]}${isHoleObject(object) ? ' hole' : ''}`
  return `${object.name ? `${object.name} · ` : ''}${shape}${object.joinGroupId ? ' · Joined' : ''}`
}

const cameraViews: { view: CameraView; label: string }[] = [
  { view: 'perspective', label: 'Perspective' },
  { view: 'top', label: 'Top' },
  { view: 'front', label: 'Front' },
  { view: 'right', label: 'Right' },
]

export default function App() {
  const { scene, canUndo, canRedo, commit, editObjects, select, begin, end, undo, redo, reset } = useCadHistory(() => [createCadObject('box')])
  const { objects, selectedObjectId, selectedObjectIds } = scene
  const [toolMode, setToolMode] = useState<TransformControlsMode>('translate')
  const [snapEnabled, setSnapEnabled] = useState(false)
  const [cameraView, setCameraView] = useState<CameraView>('perspective')
  const [projectError, setProjectError] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const selectedObject = objects.find((object) => object.id === selectedObjectId)
  const selectedIds = new Set(selectedObjectIds)
  const selectedObjects = objects.filter((object) => selectedIds.has(object.id))
  const selectedSolids = selectedObjects.filter((object) => !isHoleObject(object))
  const selectedSolidIds = new Set(selectedSolids.map((object) => object.id))
  const canJoin = selectedSolids.length >= 2 && selectedSolids.every((object) => !object.joinGroupId) &&
    selectedObjects.every((object) => !isHoleObject(object) || selectedSolidIds.has(object.cutTargetId))
  const canSeparate = selectedObjects.some((object) => !!object.joinGroupId)
  const solidTargets = objects.flatMap((object, index) => object.id !== selectedObjectId && !isHoleObject(object)
    ? [{ id: object.id, label: `${object.name ? `${object.name} · ` : ''}${shapeLabels[object.type]} #${index + 1}` }]
    : [])
  const { geometries: booleanGeometries, error: booleanError } = useBooleanPreview(objects)
  const derivedBodies = getSolidBodies(objects).filter((body) => body.members.length > 1 || body.holes.length > 0)
  const hasJoinedBodies = derivedBodies.some((body) => body.members.length > 1)

  function newProject() {
    reset([])
    setToolMode('translate')
    setProjectError(null)
    setExportError(null)
  }

  function saveProject() {
    download(new Blob([serializeProject(objects)], { type: 'application/json' }), 'block-cad-project.json')
  }

  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function exportModel() {
    if (objects.length === 0) return
    try {
      download(new Blob([await exportStl(objects)], { type: 'model/stl' }), 'block-cad-model.stl')
      setExportError(null)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Could not export the model.')
    }
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
      setExportError(null)
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

  function setCutTarget(id: string, targetId: string | null) {
    commit((current) => {
      const source = current.objects.find((object) => object.id === id)
      if (!source) return current
      if (targetId && !current.objects.some((object) => object.id === targetId &&
        object.id !== id && !isHoleObject(object))) return current
      return {
        ...current,
        objects: normalizeJoinGroups(current.objects.map((object) => {
          if (object.id === id) {
            return { ...object, cutTargetId: targetId ?? undefined }
          }
          // A hole cannot also be the target of another hole.
          if (targetId && isHoleObject(object) && object.cutTargetId === id) {
            return { ...object, cutTargetId: undefined }
          }
          return object
        })),
      }
    })
  }

  function addObject(type: CadObjectType) {
    // Keep new shapes apart so each one can be seen and selected immediately.
    const index = objects.length
    const object = createCadObject(type, (index % 3) * 30, Math.floor(index / 3) * 30)
    commit((current) => ({ objects: [...current.objects, object], selectedObjectId: object.id, selectedObjectIds: [object.id] }))
  }

  function addCutExample() {
    const x = (objects.length % 3) * 40
    const z = Math.floor(objects.length / 3) * 40
    const [box, cutter] = createCutExample(x, z)
    commit((current) => ({ objects: [...current.objects, box, cutter], selectedObjectId: cutter.id, selectedObjectIds: [cutter.id] }))
  }

  const duplicateSelected = useCallback(() => {
    commit((current) => {
      const selectedIds = new Set(current.selectedObjectIds)
      const sources = current.objects.filter((object) => selectedIds.has(object.id))
      if (sources.length === 0) return current
      const duplicates = sources.map(duplicateCadObject)
      const copiedIds = new Map(sources.map((source, index) => [source.id, duplicates[index].id]))
      const groupCounts = new Map<string, number>()
      for (const source of sources) {
        if (source.joinGroupId) groupCounts.set(source.joinGroupId, (groupCounts.get(source.joinGroupId) ?? 0) + 1)
      }
      const copiedGroupIds = new Map<string, string>()
      const linkedDuplicates = duplicates.map((object) => {
        const groupId = object.joinGroupId
        if (groupId && (groupCounts.get(groupId) ?? 0) >= 2 && !copiedGroupIds.has(groupId)) {
          copiedGroupIds.set(groupId, crypto.randomUUID())
        }
        return {
          ...object,
          cutTargetId: object.cutTargetId ? copiedIds.get(object.cutTargetId) ?? object.cutTargetId : undefined,
          joinGroupId: groupId ? copiedGroupIds.get(groupId) : undefined,
        }
      })
      return {
        objects: [...current.objects, ...linkedDuplicates],
        selectedObjectIds: linkedDuplicates.map((object) => object.id),
        selectedObjectId: current.selectedObjectId
          ? copiedIds.get(current.selectedObjectId) ?? null
          : linkedDuplicates.at(-1)?.id ?? null,
      }
    })
  }, [commit])

  const deleteSelected = useCallback(() => {
    commit((current) => {
      const selectedIds = new Set(current.selectedObjectIds)
      if (selectedIds.size === 0) return current
      return {
        objects: normalizeJoinGroups(current.objects
          .filter((object) => !selectedIds.has(object.id))
          .map((object) => isHoleObject(object) && selectedIds.has(object.cutTargetId)
            ? { ...object, cutTargetId: undefined }
            : object)),
        selectedObjectId: null,
        selectedObjectIds: [],
      }
    })
  }, [commit])

  function joinSelected() {
    const groupId = crypto.randomUUID()
    commit((current) => {
      const ids = new Set(current.selectedObjectIds)
      const selected = current.objects.filter((object) => ids.has(object.id))
      const members = selected.filter((object) => !isHoleObject(object))
      const memberIds = new Set(members.map((object) => object.id))
      if (members.length < 2 || members.some((object) => object.joinGroupId) ||
        selected.some((object) => isHoleObject(object) && !memberIds.has(object.cutTargetId))) return current
      return {
        objects: current.objects.map((object) => memberIds.has(object.id) ? { ...object, joinGroupId: groupId } : object),
        selectedObjectId: members[0].id,
        selectedObjectIds: [members[0].id],
      }
    })
  }

  function separateSelected() {
    commit((current) => {
      const ids = new Set(current.selectedObjectIds)
      const groups = new Set(current.objects.filter((object) => ids.has(object.id) && object.joinGroupId)
        .map((object) => object.joinGroupId))
      if (groups.size === 0) return current
      return {
        ...current,
        objects: current.objects.map((object) => object.joinGroupId && groups.has(object.joinGroupId)
          ? { ...object, joinGroupId: undefined }
          : object),
      }
    })
  }

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
      } else if (selectedObjectIds.length > 0 && modifier && key === 'd') {
        event.preventDefault()
        if (!event.repeat) duplicateSelected()
      } else if (selectedObjectIds.length > 0 && !modifier && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault()
        deleteSelected()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedObjectIds.length, duplicateSelected, deleteSelected, select, undo, redo])

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true"><span /></div>
        <div className="brand-copy"><strong>Block CAD</strong><span>Simple 3D modeling</span></div>
        <div className="project-actions" role="group" aria-label="Project files">
          <button type="button" onClick={newProject}>New</button>
          <button type="button" onClick={saveProject}>Save</button>
          <button type="button" onClick={() => fileInput.current?.click()}>Load</button>
          <button type="button" onClick={exportModel} disabled={objects.length === 0} title="Export all shapes as a binary STL (millimeters)">Export STL</button>
          <input ref={fileInput} type="file" accept=".json,application/json" onChange={loadProject} hidden aria-label="Choose a Block CAD project file" />
        </div>
      </header>
      {projectError && <div className="project-error" role="alert">Could not load project: {projectError}</div>}
      {booleanError && <div className="project-error" role="alert">Could not calculate model: {booleanError}</div>}
      {exportError && <div className="project-error" role="alert">Could not export STL: {exportError}</div>}
      <main className="app-main">
        <section className="workspace-panel" aria-labelledby="workspace-title">
          <div className="workspace-heading">
            <div><p className="eyebrow">Workspace</p><h1 id="workspace-title">Your canvas</h1></div>
            <div className="view-presets" role="group" aria-label="Camera views">
              {cameraViews.map(({ view, label }) => (
                <button key={view} type="button" aria-pressed={cameraView === view} onClick={() => setCameraView(view)}>{label}</button>
              ))}
            </div>
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
            <button
              type="button"
              className={`tool-button snap-button${snapEnabled ? ' is-active' : ''}`}
              aria-pressed={snapEnabled}
              title="Snap moves to a 5 mm grid and rotations to 15° steps"
              onClick={() => setSnapEnabled((enabled) => !enabled)}
            >
              Snap <span>5 mm · 15°</span>
            </button>
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
              selectedObjectIds={selectedObjectIds}
              toolMode={toolMode}
              snapEnabled={snapEnabled}
              cameraView={cameraView}
              booleanGeometries={booleanGeometries}
              onSelectObject={select}
              onTransformObject={updateObjectTransform}
              onTransformStart={begin}
              onTransformEnd={end}
            />
            <div className="workspace-hint">{cameraView === 'perspective' && 'Drag to orbit · '}Scroll to zoom · Right drag to pan</div>
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
            <button className="cut-example-button" type="button" onClick={addCutExample}>Add cutout example</button>
            <p className="cut-example-hint">Adds an editable box and cylinder cutter.</p>
            {derivedBodies.length > 0 && !booleanError && (
              <p className="cut-status" role="status">
                {booleanGeometries.size === derivedBodies.length
                  ? hasJoinedBodies ? 'Join preview ready' : 'Cut preview ready'
                  : 'Calculating model…'}
              </p>
            )}
          </div>
          <div className="panel-section selection-section">
            <h3>Selection</h3>
            <div className={`selection-card${selectedObject ? ' is-selected' : ''}`} aria-live="polite">
              <span className="selection-indicator" aria-hidden="true" />
              <span>{selectedObjectIds.length > 1
                ? `${selectedObjectIds.length} objects selected · ${selectedObject ? objectLabel(selectedObject) : 'Shape'} active`
                : selectedObject ? `${objectLabel(selectedObject)} selected` : 'Nothing selected'}</span>
            </div>
            <p className="selection-hint">Shift+click shapes or the list to select more than one.</p>
            {objects.length > 0 && (
              <div className="object-list" role="group" aria-label="Objects">
                {objects.map((object, index) => (
                  <button key={object.id} type="button" aria-pressed={selectedObjectIds.includes(object.id)} onClick={(event) => select(object.id, event.shiftKey)}>
                    <span>{objectLabel(object)}</span>
                    <span>#{index + 1}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="selection-actions">
              <button type="button" disabled={selectedObjectIds.length === 0} onClick={duplicateSelected} title="Duplicate selected objects (Ctrl/Cmd+D)">Duplicate</button>
              <button type="button" disabled={selectedObjectIds.length === 0} onClick={deleteSelected} title="Delete selected objects (Delete or Backspace)">Delete</button>
            </div>
            <div className="join-actions">
              <button type="button" disabled={!canJoin} onClick={joinSelected} title="Join two or more selected solids, including their selected holes">Join</button>
              <button type="button" disabled={!canSeparate} onClick={separateSelected} title="Separate the selected joined shapes">Separate</button>
            </div>
            {selectedObject && (
              <ObjectInspector
                key={selectedObject.id}
                object={selectedObject}
                solidTargets={solidTargets}
                onUpdate={updateObject}
                onSetCutTarget={setCutTarget}
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

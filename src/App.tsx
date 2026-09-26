import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { TransformControlsMode } from 'three/addons/controls/TransformControls.js'
import Workspace from './Workspace'
import ObjectInspector from './ObjectInspector'
import { createCadObject, createCutExample, getSolidBodies, isHoleObject, MODEL_UNIT, normalizeJoinGroups, type CadObject, type CadObjectType, type ObjectTransform, type PrimitiveType, type Vector3 } from './cadModel'
import { useCadHistory } from './useCadHistory'
import { parseProject, serializeProject } from './projectFile'
import { exportStl } from './stlExport'
import { export3mf } from './threeMfExport'
import type { CameraView } from './SceneControls'
import { useBooleanPreview } from './useBooleanPreview'
import { updateObjectWithGroups } from './groupTransforms'
import { copyCadObjects, expandAssemblyIds } from './selectionOperations'
import { nudgeSelectedObjects } from './selectionOperations'
import MeasurementPanel from './MeasurementPanel'
import ViewCube from './ViewCube'
import { getObjectTopHeight } from './workplane'
import { importSvg } from './svgImport'
import { importStl } from './stlImport'
import type { FrameRequest } from './frameCamera'
import { useAutosave } from './useAutosave'
import { alignByBounds, canPositionUnits, dropToWorkplane, getPlacementUnits, type AlignmentEdge } from './placement'
import { mirrorSelection } from './mirrorSelection'
import { repeatSelection } from './repeatSelection'
import RepeatTools from './RepeatTools'

const shapeLabels: Record<CadObjectType, string> = {
  box: 'Box',
  cylinder: 'Cylinder',
  sphere: 'Sphere',
  cone: 'Cone',
  wedge: 'Wedge',
  prism: 'Prism',
  svg: 'SVG',
  stl: 'STL',
}

function objectLabel(object: CadObject, objects: CadObject[]) {
  const shape = `${shapeLabels[object.type]}${isHoleObject(object) ? ' hole' : ''}`
  const grouped = isHoleObject(object) ? object.groupedWithTarget :
    objects.some((hole) => isHoleObject(hole) && hole.groupedWithTarget && hole.cutTargetId === object.id)
  return `${object.name ? `${object.name} · ` : ''}${shape}${object.joinGroupId ? object.joinMode === 'intersection' ? ' · Intersected' : ' · Joined' : ''}${grouped ? ' · Grouped' : ''}${object.hidden ? ' · Hidden' : ''}${object.locked ? ' · Locked' : ''}`
}

const cameraViews: { view: CameraView; label: string }[] = [
  { view: 'perspective', label: 'Perspective' },
  { view: 'top', label: 'Top' },
  { view: 'front', label: 'Front' },
  { view: 'right', label: 'Right' },
  { view: 'bottom', label: 'Bottom' },
  { view: 'back', label: 'Back' },
  { view: 'left', label: 'Left' },
]

const gridSizes = [1, 5, 10, 20]

export default function App({ initialObjects, recoveryNotice = '', initialAutosaveEnabled = true }: {
  initialObjects: CadObject[]; recoveryNotice?: string; initialAutosaveEnabled?: boolean
}) {
  const { scene, canUndo, canRedo, commit, editObjects, select, begin, end, undo, redo, reset } = useCadHistory(() => initialObjects)
  const { objects, selectedObjectId, selectedObjectIds } = scene
  const sceneRef = useRef(scene)
  sceneRef.current = scene
  const [positioning, setPositioning] = useState(false)
  const [positionError, setPositionError] = useState<string | null>(null)
  const [alignmentEdge, setAlignmentEdge] = useState<AlignmentEdge>('center')
  const [autosaveEnabled, setAutosaveEnabled] = useState(initialAutosaveEnabled)
  const autosaveStatus = useAutosave(objects, autosaveEnabled)
  const [showRecoveryNotice, setShowRecoveryNotice] = useState(!!recoveryNotice)
  const [toolMode, setToolMode] = useState<TransformControlsMode>('translate')
  const [snapEnabled, setSnapEnabled] = useState(false)
  const [gridSize, setGridSize] = useState(5)
  const [workplaneHeight, setWorkplaneHeight] = useState(0)
  const [workplaneDraft, setWorkplaneDraft] = useState('0')
  const [cameraView, setCameraView] = useState<CameraView>('perspective')
  const [frameRequest, setFrameRequest] = useState<FrameRequest | null>(null)
  const requestFrame = useCallback((scope: FrameRequest['scope']) => {
    setFrameRequest((previous) => ({ sequence: (previous?.sequence ?? 0) + 1, scope }))
  }, [])
  const [cameraOrientation, setCameraOrientation] = useState('rotateX(-25deg) rotateY(-35deg)')
  const [projectError, setProjectError] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [svgError, setSvgError] = useState<string | null>(null)
  const [stlError, setStlError] = useState<string | null>(null)
  const [importingStl, setImportingStl] = useState(false)
  const [hasCopiedObjects, setHasCopiedObjects] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const svgInput = useRef<HTMLInputElement>(null)
  const stlInput = useRef<HTMLInputElement>(null)
  const copiedObjects = useRef<{ sources: CadObject[]; activeId: string | null; pasteCount: number } | null>(null)
  const nudgeKeys = useRef(new Set<string>())
  const selectedObject = objects.find((object) => object.id === selectedObjectId)
  const selectedIds = new Set(selectedObjectIds)
  const selectedObjects = objects.filter((object) => selectedIds.has(object.id))
  const selectedAssemblyIds = expandAssemblyIds(objects, selectedIds)
  const selectedAssembly = objects.filter((object) => selectedAssemblyIds.has(object.id))
  const canEditSelection = selectedObjects.length > 0 && selectedAssembly.every((object) => !object.locked)
  const activeAssemblyIds = selectedObject ? expandAssemblyIds(objects, new Set([selectedObject.id]), true) : new Set<string>()
  const canEditActive = !!selectedObject &&
    objects.every((object) => !activeAssemblyIds.has(object.id) || !object.locked)
  const canTransformSelected = canEditActive && !selectedObject?.hidden
  const nudgeIds = expandAssemblyIds(objects, selectedIds, true)
  const canNudge = selectedIds.size > 0 && objects.every((object) => !nudgeIds.has(object.id) || (!object.locked && !object.hidden))
  const placementUnits = getPlacementUnits(objects, selectedIds)
  const canPosition = !positioning && canPositionUnits(objects, placementUnits)
  const canAlign = canPosition && placementUnits.length > 1
  const selectedSolids = selectedObjects.filter((object) => !isHoleObject(object))
  const selectedHoles = selectedObjects.filter(isHoleObject)
  const selectedSolidIds = new Set(selectedSolids.map((object) => object.id))
  const canJoin = canEditSelection && selectedSolids.length >= 2 && selectedSolids.every((object) => !object.joinGroupId) &&
    selectedObjects.every((object) => !isHoleObject(object) || selectedSolidIds.has(object.cutTargetId))
  const canSeparate = canEditSelection && selectedObjects.some((object) => !!object.joinGroupId)
  const canGroupCut = canEditSelection && selectedSolids.length === 1 && selectedHoles.length > 0 &&
    selectedHoles.every((hole) => hole.cutTargetId === selectedSolids[0].id) &&
    selectedHoles.some((hole) => !hole.groupedWithTarget)
  const groupedCutTargets = new Set(objects.filter(isHoleObject).filter((hole) => hole.groupedWithTarget)
    .map((hole) => hole.cutTargetId))
  const canUngroupCut = canEditSelection && selectedObjects.some((object) => isHoleObject(object)
    ? !!object.groupedWithTarget
    : groupedCutTargets.has(object.id))
  const solidTargets = objects.flatMap((object, index) => object.id !== selectedObjectId && !isHoleObject(object) &&
    (!object.locked || selectedObject?.cutTargetId === object.id)
    ? [{ id: object.id, label: `${object.name ? `${object.name} · ` : ''}${shapeLabels[object.type]} #${index + 1}` }]
    : [])
  const { geometries: booleanGeometries, error: booleanError } = useBooleanPreview(objects)
  const derivedBodies = getSolidBodies(objects).filter((body) => body.members.length > 1 || body.holes.length > 0)
  const hasJoinedBodies = derivedBodies.some((body) => body.members.length > 1)
  const hasIntersectedBodies = derivedBodies.some((body) => body.anchor.joinMode === 'intersection')
  const hasEmptyIntersection = derivedBodies.some((body) => body.anchor.joinMode === 'intersection' &&
    booleanGeometries.get(body.anchor.id)?.getAttribute('position').count === 0)

  function newProject() {
    reset([])
    setAutosaveEnabled(true)
    setShowRecoveryNotice(false)
    setToolMode('translate')
    setWorkplane(0)
    setProjectError(null)
    setExportError(null)
    setSvgError(null)
    setStlError(null)
  }

  function setWorkplane(height: number) {
    if (!Number.isFinite(height)) return
    const rounded = Number(height.toFixed(3))
    setWorkplaneHeight(rounded)
    setWorkplaneDraft(String(rounded))
  }

  function applyWorkplaneDraft(rawValue: string) {
    const value = Number(rawValue)
    if (rawValue.trim() && Number.isFinite(value)) setWorkplane(value)
    else setWorkplaneDraft(String(workplaneHeight))
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

  async function exportPrintModel() {
    if (objects.length === 0) return
    try {
      download(new Blob([await export3mf(objects)], { type: 'model/3mf' }), 'block-cad-model.model.3mf')
      setExportError(null)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Could not export the 3MF model.')
    }
  }

  async function importSvgFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const index = objects.length
      const imported = importSvg(await file.text(), file.name, workplaneHeight,
        (index % 3) * 30, Math.floor(index / 3) * 30)
      commit((current) => ({ ...current,
        objects: [...current.objects, ...imported],
        selectedObjectIds: imported.map((object) => object.id),
        selectedObjectId: imported[0].id,
      }))
      setSvgError(null)
    } catch (error) {
      setSvgError(error instanceof Error ? error.message : 'Could not import this SVG file.')
    }
  }

  async function importStlFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImportingStl(true)
    try {
      const index = objects.length
      const imported = await importStl(await file.arrayBuffer(), file.name, workplaneHeight,
        (index % 3) * 30, Math.floor(index / 3) * 30)
      commit((current) => ({ ...current,
        objects: [...current.objects, imported],
        selectedObjectIds: [imported.id],
        selectedObjectId: imported.id,
      }))
      setStlError(null)
    } catch (error) {
      setStlError(error instanceof Error ? error.message : 'Could not import this STL file.')
    } finally {
      setImportingStl(false)
    }
  }

  async function loadProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const loadedObjects = parseProject(await file.text())
      reset(loadedObjects)
      setAutosaveEnabled(true)
      setShowRecoveryNotice(false)
      setToolMode('translate')
      setWorkplane(0)
      setProjectError(null)
      setExportError(null)
      setSvgError(null)
      setStlError(null)
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : 'Could not load this project file.')
    }
  }

  const updateObject = useCallback((id: string, update: (current: CadObject) => CadObject) => {
    editObjects((current) => {
      const changed = updateObjectWithGroups(current, id, update)
      return current.some((object, index) => object.locked && changed[index] !== object) ? current : changed
    })
  }, [editObjects])

  const updateObjectTransform = useCallback((id: string, transform: ObjectTransform) => {
    updateObject(id, (object) => ({ ...object, ...transform }))
  }, [updateObject])

  function setCutTarget(id: string, targetId: string | null) {
    commit((current) => {
      const source = current.objects.find((object) => object.id === id)
      if (!source || source.locked) return current
      if (source.cutTargetId && current.objects.some((object) => object.id === source.cutTargetId && object.locked)) return current
      if (targetId && !current.objects.some((object) => object.id === targetId &&
        object.id !== id && !isHoleObject(object) && !object.locked)) return current
      return {
        ...current,
        objects: normalizeJoinGroups(current.objects.map((object) => {
          if (object.id === id) {
            return { ...object, cutTargetId: targetId ?? undefined,
              groupedWithTarget: targetId === object.cutTargetId ? object.groupedWithTarget : undefined }
          }
          // A hole cannot also be the target of another hole.
          if (targetId && isHoleObject(object) && object.cutTargetId === id) {
            return { ...object, cutTargetId: undefined, groupedWithTarget: undefined }
          }
          return object
        })),
      }
    })
  }

  function addObject(type: PrimitiveType) {
    // Keep new shapes apart so each one can be seen and selected immediately.
    const index = objects.length
    const object = createCadObject(type, (index % 3) * 30, Math.floor(index / 3) * 30, workplaneHeight)
    commit((current) => ({ objects: [...current.objects, object], selectedObjectId: object.id, selectedObjectIds: [object.id] }))
  }

  function addCutExample() {
    const x = (objects.length % 3) * 40
    const z = Math.floor(objects.length / 3) * 40
    const [box, cutter] = createCutExample(x, z, workplaneHeight)
    commit((current) => ({ objects: [...current.objects, box, cutter], selectedObjectId: cutter.id, selectedObjectIds: [cutter.id] }))
  }

  const duplicateSelected = useCallback(() => {
    commit((current) => {
      const selectedIds = new Set(current.selectedObjectIds)
      const sources = current.objects.filter((object) => selectedIds.has(object.id))
      if (sources.length === 0) return current
      const { copies, copiedIds } = copyCadObjects(sources, 25, current.objects)
      return {
        objects: [...current.objects, ...copies],
        selectedObjectIds: copies.map((object) => object.id),
        selectedObjectId: current.selectedObjectId
          ? copiedIds.get(current.selectedObjectId) ?? null
          : copies.at(-1)?.id ?? null,
      }
    })
  }, [commit])

  const copySelected = useCallback(() => {
    const ids = expandAssemblyIds(objects, new Set(selectedObjectIds), true)
    const sources = objects.filter((object) => ids.has(object.id))
    if (sources.length === 0) return
    copiedObjects.current = { sources: structuredClone(sources), activeId: selectedObjectId, pasteCount: 0 }
    setHasCopiedObjects(true)
  }, [objects, selectedObjectId, selectedObjectIds])

  const pasteCopied = useCallback(() => {
    const copied = copiedObjects.current
    if (!copied) return
    const offset = 25 * ++copied.pasteCount
    commit((current) => {
      const { copies, copiedIds } = copyCadObjects(copied.sources, offset, current.objects)
      return {
        objects: [...current.objects, ...copies],
        selectedObjectIds: copies.map((object) => object.id),
        selectedObjectId: copied.activeId
          ? copiedIds.get(copied.activeId) ?? copies[0]?.id ?? null
          : copies[0]?.id ?? null,
      }
    })
  }, [commit])

  const deleteSelected = useCallback(() => {
    commit((current) => {
      const selectedIds = new Set(current.selectedObjectIds)
      if (selectedIds.size === 0) return current
      const affected = expandAssemblyIds(current.objects, selectedIds)
      if (current.objects.some((object) => affected.has(object.id) && object.locked)) return current
      return {
        objects: normalizeJoinGroups(current.objects
          .filter((object) => !selectedIds.has(object.id))
          .map((object) => isHoleObject(object) && selectedIds.has(object.cutTargetId)
            ? { ...object, cutTargetId: undefined, groupedWithTarget: undefined }
            : object)),
        selectedObjectId: null,
        selectedObjectIds: [],
      }
    })
  }, [commit])

  function setHidden(hidden: boolean) {
    commit((current) => {
      const ids = expandAssemblyIds(current.objects, new Set(current.selectedObjectIds))
      if (ids.size === 0) return current
      return { ...current, objects: current.objects.map((object) => ids.has(object.id)
        ? { ...object, hidden: hidden || undefined }
        : object) }
    })
  }

  function setLocked(locked: boolean) {
    commit((current) => {
      const ids = expandAssemblyIds(current.objects, new Set(current.selectedObjectIds))
      if (ids.size === 0) return current
      return { ...current, objects: current.objects.map((object) => ids.has(object.id)
        ? { ...object, locked: locked || undefined }
        : object) }
    })
  }

  async function positionSelection(operation: (objects: CadObject[], ids: Set<string>) => Promise<CadObject[]>) {
    if (positioning) return
    const snapshot = scene
    setPositioning(true)
    setPositionError(null)
    try {
      const positioned = await operation(snapshot.objects, new Set(snapshot.selectedObjectIds))
      if (sceneRef.current !== snapshot) throw new Error('The model or selection changed. Try the positioning action again.')
      commit((current) => current === snapshot ? { ...current, objects: positioned } : current)
    } catch (error) {
      setPositionError(error instanceof Error ? error.message : 'Could not position the selected shapes.')
    } finally {
      setPositioning(false)
    }
  }

  function alignSelected(axis: keyof Vector3) {
    void positionSelection((current, ids) => alignByBounds(current, ids, selectedObjectId, axis, alignmentEdge))
  }

  function repeatSelected(axis: keyof Vector3, count: number, spacing: number) {
    const snapshot = scene
    const { copies, lastCopiedIds } = repeatSelection(objects, new Set(selectedObjectIds), axis, count, spacing)
    if (!copies.length) return
    commit((current) => current === snapshot ? {
      objects: [...current.objects, ...copies],
      selectedObjectIds: copies.map((object) => object.id),
      selectedObjectId: lastCopiedIds.get(selectedObjectId ?? '') ?? copies.at(-1)!.id,
    } : current)
  }

  const nudgeSelection = useCallback((axis: keyof Vector3, amount: number) => {
    editObjects((current) => {
      const ids = new Set(selectedObjectIds)
      const affected = expandAssemblyIds(current, ids, true)
      if (current.some((object) => affected.has(object.id) && (object.locked || object.hidden))) return current
      return nudgeSelectedObjects(current, ids, axis, amount)
    })
  }, [editObjects, selectedObjectIds])

  function combineSelected(mode: 'union' | 'intersection') {
    const groupId = crypto.randomUUID()
    commit((current) => {
      const ids = new Set(current.selectedObjectIds)
      const selected = current.objects.filter((object) => ids.has(object.id))
      const affected = expandAssemblyIds(current.objects, ids)
      if (current.objects.some((object) => affected.has(object.id) && object.locked)) return current
      const members = selected.filter((object) => !isHoleObject(object))
      const memberIds = new Set(members.map((object) => object.id))
      if (members.length < 2 || members.some((object) => object.joinGroupId) ||
        selected.some((object) => isHoleObject(object) && !memberIds.has(object.cutTargetId))) return current
      return {
        objects: current.objects.map((object) => memberIds.has(object.id)
          ? { ...object, joinGroupId: groupId, joinMode: mode === 'intersection' ? 'intersection' as const : undefined }
          : object),
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
      const affected = expandAssemblyIds(current.objects, ids)
      if (current.objects.some((object) => affected.has(object.id) && object.locked)) return current
      if (groups.size === 0) return current
      return {
        ...current,
        objects: current.objects.map((object) => object.joinGroupId && groups.has(object.joinGroupId)
          ? { ...object, joinGroupId: undefined, joinMode: undefined }
          : object),
      }
    })
  }

  function groupCutSelected() {
    commit((current) => {
      const ids = new Set(current.selectedObjectIds)
      const selected = current.objects.filter((object) => ids.has(object.id))
      const affected = expandAssemblyIds(current.objects, ids)
      if (current.objects.some((object) => affected.has(object.id) && object.locked)) return current
      const solids = selected.filter((object) => !isHoleObject(object))
      const holes = selected.filter(isHoleObject)
      if (solids.length !== 1 || holes.length === 0 ||
        holes.some((hole) => hole.cutTargetId !== solids[0].id) ||
        holes.every((hole) => hole.groupedWithTarget)) return current
      return {
        objects: current.objects.map((object) => ids.has(object.id) && isHoleObject(object)
          ? { ...object, groupedWithTarget: true }
          : object),
        selectedObjectId: solids[0].id,
        selectedObjectIds: [solids[0].id],
      }
    })
  }

  function ungroupCutSelected() {
    commit((current) => {
      const ids = new Set(current.selectedObjectIds)
      const targets = new Set(current.objects.filter((object) => ids.has(object.id))
        .map((object) => isHoleObject(object) ? object.cutTargetId : object.id))
      if (current.objects.some((object) => object.locked &&
        (ids.has(object.id) || isHoleObject(object) && targets.has(object.cutTargetId)))) return current
      if (!current.objects.some((object) => isHoleObject(object) && object.groupedWithTarget && targets.has(object.cutTargetId))) return current
      return {
        ...current,
        objects: current.objects.map((object) => isHoleObject(object) && object.groupedWithTarget && targets.has(object.cutTargetId)
          ? { ...object, groupedWithTarget: undefined }
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
      const nudge: Record<string, [keyof Vector3, number]> = {
        arrowleft: ['x', -1], arrowright: ['x', 1],
        arrowup: ['z', -1], arrowdown: ['z', 1],
        pageup: ['y', 1], pagedown: ['y', -1],
      }
      if (modifier && key === 'z') {
        event.preventDefault()
        if (!event.repeat) (event.shiftKey ? redo : undo)()
      } else if (modifier && key === 'y') {
        event.preventDefault()
        if (!event.repeat) redo()
      } else if (event.key === 'Escape') {
        select(null)
      } else if (!modifier && key === 'f' && selectedObjectIds.length > 0) {
        event.preventDefault()
        if (!event.repeat) requestFrame('selection')
      } else if (selectedObjectIds.length > 0 && modifier && key === 'c') {
        event.preventDefault()
        if (!event.repeat) copySelected()
      } else if (modifier && key === 'v' && hasCopiedObjects) {
        event.preventDefault()
        if (!event.repeat) pasteCopied()
      } else if (selectedObjectIds.length > 0 && modifier && key === 'd') {
        event.preventDefault()
        if (!event.repeat) duplicateSelected()
      } else if (canEditSelection && !modifier && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault()
        deleteSelected()
      } else if (canNudge && !modifier && nudge[key]) {
        event.preventDefault()
        if (nudgeKeys.current.size === 0) begin()
        nudgeKeys.current.add(key)
        const [axis, direction] = nudge[key]
        nudgeSelection(axis, direction * (event.shiftKey ? gridSize * 10 : snapEnabled ? gridSize : 1))
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      if (nudgeKeys.current.delete(event.key.toLowerCase()) && nudgeKeys.current.size === 0) end()
    }

    function onBlur() {
      if (nudgeKeys.current.size > 0) {
        nudgeKeys.current.clear()
        end()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [selectedObjectIds.length, canEditSelection, canNudge, gridSize, snapEnabled, hasCopiedObjects, copySelected, pasteCopied, duplicateSelected, deleteSelected, nudgeSelection, begin, end, select, undo, redo, requestFrame])

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
          <button type="button" onClick={exportPrintModel} disabled={objects.length === 0} title="Export finished solids as a 3MF model (millimeters)">Export 3MF</button>
          <input ref={fileInput} type="file" accept=".json,application/json" onChange={loadProject} hidden aria-label="Choose a Block CAD project file" />
        </div>
      </header>
      <div className="autosave-status" role="status">{autosaveStatus}</div>
      {showRecoveryNotice && <div className="recovery-notice" role="status">{recoveryNotice}
        <button type="button" onClick={() => setShowRecoveryNotice(false)}>Dismiss</button>
      </div>}
      {projectError && <div className="project-error" role="alert">Could not load project: {projectError}</div>}
      {booleanError && <div className="project-error" role="alert">Could not calculate model: {booleanError}</div>}
      {exportError && <div className="project-error" role="alert">Could not export model: {exportError}</div>}
      {svgError && <div className="project-error" role="alert">Could not import SVG: {svgError}</div>}
      {stlError && <div className="project-error" role="alert">Could not import STL: {stlError}</div>}
      <main className="app-main">
        <section className="workspace-panel" aria-labelledby="workspace-title">
          <div className="workspace-heading">
            <div><p className="eyebrow">Workspace</p><h1 id="workspace-title">Your canvas</h1></div>
            <div className="view-presets" role="group" aria-label="Camera views">
              {cameraViews.slice(0, 4).map(({ view, label }) => (
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
                disabled={!canTransformSelected}
                onClick={() => setToolMode(mode)}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className={`tool-button snap-button${snapEnabled ? ' is-active' : ''}`}
              aria-pressed={snapEnabled}
              title={`Snap moves to a ${gridSize} mm grid and rotations to 15° steps`}
              onClick={() => setSnapEnabled((enabled) => !enabled)}
            >
              Snap <span>{gridSize} mm · 15°</span>
            </button>
            <label className="grid-size-control">Grid
              <select aria-label="Grid spacing" value={gridSize} onChange={(event) => setGridSize(Number(event.target.value))}>
                {gridSizes.map((size) => <option key={size} value={size}>{size} mm</option>)}
              </select>
            </label>
            {!selectedObject && <span className="toolbar-hint">Select a shape to use these tools</span>}
            <button type="button" className="tool-button" disabled={!selectedObjects.some((object) => !object.hidden)}
              onClick={() => requestFrame('selection')} title="Fit the selected visible shapes (F)">Frame selection</button>
            <button type="button" className="tool-button" disabled={!objects.some((object) => !object.hidden)}
              onClick={() => requestFrame('all')} title="Fit all visible shapes">Frame all</button>
            <div className="history-actions">
              <button type="button" disabled={!canUndo} onClick={undo} title="Undo (Ctrl/Cmd+Z)">Undo</button>
              <button type="button" disabled={!canRedo} onClick={redo} title="Redo (Ctrl/Cmd+Shift+Z or Ctrl+Y)">Redo</button>
            </div>
          </div>
          <div className="workspace-frame">
            <Workspace
              objects={objects}
              selectedObjectId={canTransformSelected ? selectedObjectId : null}
              selectedObjectIds={selectedObjectIds}
              toolMode={toolMode}
              snapEnabled={snapEnabled}
              gridSize={gridSize}
              workplaneHeight={workplaneHeight}
              cameraView={cameraView}
              frameRequest={frameRequest}
              onCameraOrientation={setCameraOrientation}
              booleanGeometries={booleanGeometries}
              onSelectObject={select}
              onTransformObject={updateObjectTransform}
              onTransformStart={begin}
              onTransformEnd={end}
            />
            <ViewCube cameraView={cameraView} orientation={cameraOrientation} onChange={setCameraView} />
            <div className="workspace-hint">{cameraView === 'perspective' && 'Drag to orbit · '}Scroll to zoom · Right drag to pan</div>
            <div className="axis-label">Workplane Y {workplaneHeight} {MODEL_UNIT} <span>·</span> X / Y / Z</div>
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
              {(['box', 'cylinder', 'sphere', 'cone', 'wedge', 'prism'] as const).map((type) => (
                <button className="shape-button" key={type} type="button" onClick={() => addObject(type)}>
                  <span className={`shape-glyph ${type}`} aria-hidden="true" />
                  <span>{shapeLabels[type]}</span>
                  <span className="shape-add" aria-hidden="true">+</span>
                </button>
              ))}
            </div>
            <button className="cut-example-button" type="button" onClick={addCutExample}>Add cutout example</button>
            <p className="cut-example-hint">Adds an editable box and cylinder cutter.</p>
            <button className="cut-example-button" type="button" onClick={() => svgInput.current?.click()}>Import SVG</button>
            <input ref={svgInput} type="file" accept=".svg,image/svg+xml" onChange={importSvgFile} hidden aria-label="Choose an SVG file" />
            <p className="cut-example-hint">Filled SVG shapes import as 5 mm tall solids.</p>
            <button className="cut-example-button" type="button" disabled={importingStl} onClick={() => stlInput.current?.click()}>{importingStl ? 'Importing STL…' : 'Import STL'}</button>
            <input ref={stlInput} type="file" accept=".stl,model/stl" onChange={importStlFile} hidden aria-label="Choose an STL file" />
            <p className="cut-example-hint">Imports a watertight STL at its original millimeter size.</p>
            {derivedBodies.length > 0 && !booleanError && (
              <p className="cut-status" role="status">
                {booleanGeometries.size === derivedBodies.length
                  ? hasEmptyIntersection ? 'Intersection is empty; select a member to Separate or move the shapes'
                    : hasIntersectedBodies ? 'Intersection preview ready'
                      : hasJoinedBodies ? 'Join preview ready' : 'Cut preview ready'
                  : 'Calculating model…'}
              </p>
            )}
          </div>
          <div className="panel-section workplane-section">
            <h3>Workplane</h3>
            <label className="workplane-height-field">Height (mm)
              <input type="number" step="any" value={workplaneDraft} disabled={positioning}
                onChange={(event) => setWorkplaneDraft(event.target.value)}
                onBlur={(event) => applyWorkplaneDraft(event.currentTarget.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} />
            </label>
            <div className="workplane-actions">
              <button type="button" disabled={!selectedObject || positioning} onClick={() => selectedObject && setWorkplane(getObjectTopHeight(selectedObject))}>Use selected top</button>
              <button type="button" disabled={workplaneHeight === 0 || positioning} onClick={() => setWorkplane(0)}>Reset to 0</button>
            </div>
            <button type="button" className="cut-example-button" disabled={!canPosition}
              onClick={() => void positionSelection((current, ids) => dropToWorkplane(current, ids, workplaneHeight))}
              title="Rest each selected body's finished bottom on the current workplane">Drop to workplane</button>
            <p className="selection-hint">New shapes rest on this horizontal plane. Existing shapes stay where they are.</p>
            <p className="selection-hint">Drop moves each selected body to this plane, carrying its linked holes. It supports Undo.</p>
          </div>
          <div className="panel-section selection-section">
            <h3>Selection</h3>
            <div className={`selection-card${selectedObject ? ' is-selected' : ''}`} aria-live="polite">
              <span className="selection-indicator" aria-hidden="true" />
              <span>{selectedObjectIds.length > 1
                ? `${selectedObjectIds.length} objects selected · ${selectedObject ? objectLabel(selectedObject, objects) : 'Shape'} active`
                : selectedObject ? `${objectLabel(selectedObject, objects)} selected` : 'Nothing selected'}</span>
            </div>
            <p className="selection-hint">Shift+click shapes or the list to select more than one. The last selected shape is active; its properties appear below.</p>
            {objects.length > 0 && (
              <div className="object-list" role="group" aria-label="Objects">
                {objects.map((object, index) => (
                  <button key={object.id} type="button" className={object.hidden ? 'is-hidden' : undefined} aria-pressed={selectedObjectIds.includes(object.id)} onClick={(event) => select(object.id, event.shiftKey)}>
                    <span>{objectLabel(object, objects)}</span>
                    <span>#{index + 1}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="selection-actions">
              <button type="button" disabled={selectedObjectIds.length === 0} onClick={duplicateSelected} title="Duplicate selected objects (Ctrl/Cmd+D)">Duplicate</button>
              <button type="button" disabled={!canEditSelection} onClick={deleteSelected} title="Delete selected objects (Delete or Backspace)">Delete</button>
            </div>
            <div className="clipboard-actions" role="group" aria-label="Copy and paste">
              <button type="button" disabled={selectedObjectIds.length === 0} onClick={copySelected} title="Copy selected shapes and assemblies (Ctrl/Cmd+C)">Copy</button>
              <button type="button" disabled={!hasCopiedObjects} onClick={pasteCopied} title="Paste copies with a 25 mm offset (Ctrl/Cmd+V)">Paste</button>
            </div>
            <div className="visibility-actions" role="group" aria-label="Visibility and locking">
              <button type="button" disabled={!selectedAssembly.some((object) => !object.hidden)} onClick={() => setHidden(true)}>Hide</button>
              <button type="button" disabled={!selectedAssembly.some((object) => object.hidden)} onClick={() => setHidden(false)}>Show</button>
              <button type="button" disabled={!selectedAssembly.some((object) => !object.locked)} onClick={() => setLocked(true)}>Lock</button>
              <button type="button" disabled={!selectedAssembly.some((object) => object.locked)} onClick={() => setLocked(false)}>Unlock</button>
            </div>
            <div className="join-actions combine-actions">
              <button type="button" disabled={!canJoin} onClick={() => combineSelected('union')} title="Join two or more selected solids, including their selected holes">Join</button>
              <button type="button" disabled={!canJoin} onClick={() => combineSelected('intersection')} title="Keep only the volume shared by two or more selected solids, then cut their linked holes">Intersect</button>
              <button type="button" disabled={!canSeparate} onClick={separateSelected} title="Separate the selected combined shapes">Separate</button>
            </div>
            <div className="join-actions">
              <button type="button" disabled={!canGroupCut} onClick={groupCutSelected} title="Group one selected solid with its selected holes">Group</button>
              <button type="button" disabled={!canUngroupCut} onClick={ungroupCutSelected} title="Reveal the grouped holes linked to the selected solid">Ungroup</button>
            </div>
            <p className="selection-hint">Join keeps the union of two or more solids; Intersect keeps their shared volume. Separate restores the source solids.</p>
            <p className="selection-hint">Group needs one solid and its linked holes selected. It hides the cutters and moves them with the solid. Ungroup reveals them again.</p>
            <div className="align-actions" role="group" aria-label="Mirror selection">
              {(['x', 'y', 'z'] as const).map((axis) => (
                <button key={axis} type="button" disabled={!canPosition}
                  onClick={() => void positionSelection((current, ids) => mirrorSelection(current, ids, axis))}>Mirror {axis.toUpperCase()}</button>
              ))}
            </div>
            <p className="selection-hint">Mirror flips the arrangement around its shared center on a world axis, including linked holes.</p>
            <RepeatTools disabled={!selectedObjectIds.length || positioning} onRepeat={repeatSelected} />
            <label className="alignment-mode">Align by
              <select value={alignmentEdge} onChange={(event) => setAlignmentEdge(event.target.value as AlignmentEdge)}>
                <option value="min">Minimum edge</option>
                <option value="center">Center</option>
                <option value="max">Maximum edge</option>
              </select>
            </label>
            <div className="align-actions" role="group" aria-label="Align selected bounds to active shape">
              {(['x', 'y', 'z'] as const).map((axis) => (
                <button key={axis} type="button" disabled={!canAlign} onClick={() => alignSelected(axis)} title={`Align the ${alignmentEdge} on world ${axis.toUpperCase()} to the active shape`}>Align {axis.toUpperCase()}</button>
              ))}
            </div>
            <p className="selection-hint">Select two or more bodies. The active body stays fixed; the others match its edge or center on a world axis. All linked holes move with their solid.</p>
            {positioning && <p className="selection-hint" role="status">Calculating placement…</p>}
            {positionError && <p className="position-error" role="alert">{positionError}</p>}
            {selectedObject && !canEditActive && <p className="selection-hint">Unlock this shape to edit its properties.</p>}
            {selectedObject && (
              <ObjectInspector
                key={selectedObject.id}
                object={selectedObject}
                solidTargets={solidTargets}
                onUpdate={updateObject}
                onSetCutTarget={setCutTarget}
                onEditStart={begin}
                onEditEnd={end}
                disabled={!canEditActive}
              />
            )}
          </div>
          <div className="panel-section controls-section">
            <MeasurementPanel objects={objects} selectedObjectIds={selectedObjectIds} activeObjectId={selectedObjectId} />
          </div>
          <div className="panel-section controls-section">
            <h3>Camera controls</h3>
            <div className="control-row"><span>Orbit</span><kbd>Drag</kbd></div>
            <div className="control-row"><span>Zoom</span><kbd>Scroll</kbd></div>
            <div className="control-row"><span>Pan</span><kbd>Right drag</kbd></div>
            <div className="control-row"><span>Nudge X / Z</span><kbd>Arrow keys</kbd></div>
            <div className="control-row"><span>Nudge Y</span><kbd>Page Up / Down</kbd></div>
            <p className="selection-hint">Shift moves 10 grid spaces. Snap uses the selected grid size; free movement uses 1 mm.</p>
          </div>
          <div className="panel-note"><span className="note-icon" aria-hidden="true">i</span><p>Ctrl/Cmd+Z undoes · Ctrl/Cmd+Shift+Z redoes</p></div>
        </aside>
      </main>
    </div>
  )
}

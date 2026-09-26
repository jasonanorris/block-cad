import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import type { TransformControlsMode } from 'three/addons/controls/TransformControls.js'
import Workspace from './Workspace'
import ReferenceTools from './ReferenceTools'
import { dropOntoBody } from './dropOntoBody'
import { positionFromReference } from './referenceOrigin'
import ToolGroup, { jumpToTools } from './ToolGroup'
import ExampleProjects from './ExampleProjects'
import SectionTools from './SectionTools'
import { GeometryJobs } from './GeometryJobs'
import { defaultSection, type SectionView } from './sectionView'
import TextTools from './TextTools'
import CustomShapeTools from './CustomShapeTools'
import HolePatternTools from './HolePatternTools'
import FaceAlignmentTools from './FaceAlignmentTools'
import PointMeasurementTools from './PointMeasurementTools'
import { alignPickedFaces, type SurfacePick, type SurfacePickMode } from './surfaceTools'
import { createHolePattern, type HolePattern } from './holePatterns'
import { createCustomShape, changeCustomShape } from './customShapes'
import type { TextFont } from './textFonts'
import { createTextObject, changeText } from './textShapes'
import ObjectList from './ObjectList'
import { colorObjects } from './objectColor'
import { objectLabel, shapeLabels } from './objectLabels'
import ObjectInspector from './ObjectInspector'
import { createCadObject, createCutExample, getSolidBodies, isHoleObject, MODEL_UNIT, normalizeJoinGroups, type CadObject, type ObjectTransform, type PrimitiveType, type Vector3 } from './cadModel'
import { useCadHistory } from './useCadHistory'
import { parseProject, serializeProject } from './projectFile'
import type { CameraView } from './SceneControls'
import { useBooleanPreview } from './useBooleanPreview'
import { updateObjectWithGroups } from './groupTransforms'
import { copyCadObjects, expandAssemblyIds } from './selectionOperations'
import { nudgeSelectedObjects } from './selectionOperations'
import MeasurementPanel from './MeasurementPanel'
import ViewCube from './ViewCube'
import { getObjectTopHeight, faceWorkplane, onFaceWorkplane, dropToFaceWorkplane, type WorkplaneFrame } from './workplane'
import { importSvg } from './svgImport'
import { importStl } from './stlImport'
import type { FrameRequest } from './frameCamera'
import { useAutosave } from './useAutosave'
import { alignByBounds, distributeByBounds, type DistributionMode, canPositionUnits, dropToWorkplane, getPlacementUnits, type AlignmentEdge } from './placement'
import { mirrorSelection } from './mirrorSelection'
import { repeatSelection } from './repeatSelection'
import RepeatTools from './RepeatTools'
import RadialArrayTools from './RadialArrayTools'
import { radialArray } from './radialArray'
import ResizeTools from './ResizeTools'
import { resizeSelection } from './resizeSelection'
import { selectedExportObjects, type ExportScope } from './exportSelection'
import ShortcutHelp from './ShortcutHelp'
import SavedProjectsPanel from './SavedProjectsPanel'
import LibraryTransfer from './LibraryTransfer'
import { readLocalProject, saveLocalProject } from './localProjects'
import { insertPart, preparePart } from './partsLibrary'
import ExportReview, { type ExportFormat } from './ExportReview'

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
  const { scene, canUndo, canRedo, commit, editObjects, select, selectMany, begin, end, undo, redo, reset } = useCadHistory(() => initialObjects)
  const { objects, selectedObjectId, selectedObjectIds } = scene
  const sceneRef = useRef(scene)
  sceneRef.current = scene
  const [libraryRevision, setLibraryRevision] = useState(0)
  const [dropTarget, setDropTarget] = useState('')
  const splitJobs = useMemo(() => new GeometryJobs(), [])
  const exportJobs = useMemo(() => new GeometryJobs(), [])
  const [splitting, setSplitting] = useState(false)
  useEffect(() => () => { splitJobs.dispose(); exportJobs.dispose() }, [splitJobs, exportJobs])
  useEffect(() => { splitJobs.cancel() }, [objects, selectedObjectIds, splitJobs])
  const [positioning, setPositioning] = useState(false)
  const [positionError, setPositionError] = useState<string | null>(null)
  const [alignmentEdge, setAlignmentEdge] = useState<AlignmentEdge>('center')
  const [autosaveEnabled, setAutosaveEnabled] = useState(initialAutosaveEnabled)
  const autosaveStatus = useAutosave(objects, autosaveEnabled)
  const [showRecoveryNotice, setShowRecoveryNotice] = useState(!!recoveryNotice)
  const [section, setSection] = useState<SectionView>(defaultSection)
  const [toolMode, setToolMode] = useState<TransformControlsMode>('translate')
  const [objectSnapEnabled, setObjectSnapEnabled] = useState(false)
  const [snapHint, setSnapHint] = useState('')
  const [distributionMode, setDistributionMode] = useState<DistributionMode>('gaps')
  const [snapEnabled, setSnapEnabled] = useState(false)
  const [boxSelectEnabled, setBoxSelectEnabled] = useState(false)
  const exitBoxSelect = useCallback(() => setBoxSelectEnabled(false), [])
  const [gridSize, setGridSize] = useState(5)
  const [facePlane, setFacePlane] = useState<WorkplaneFrame | null>(null)
  const [pickMode, setPickMode] = useState<SurfacePickMode>(null)
  const pickFace = pickMode === 'workplane'
  const [alignmentSource, setAlignmentSource] = useState<SurfacePick | null>(null)
  const [alignmentTarget, setAlignmentTarget] = useState<SurfacePick | null>(null)
  const [measurementPoints, setMeasurementPoints] = useState<Vector3[]>([])
  const exitFace = useCallback(() => {
    setPickMode(null); setAlignmentSource(null); setAlignmentTarget(null); setMeasurementPoints([])
  }, [])
  useEffect(() => { setMeasurementPoints([]); setPickMode(null) }, [objects])
  useEffect(() => {
    setAlignmentSource(null); setAlignmentTarget(null)
    setPickMode((mode) => mode === 'align-source' || mode === 'align-target' ? null : mode)
  }, [objects, selectedObjectIds])
  const [referenceOrigin, setReferenceOrigin] = useState<Vector3>({ x: 0, y: 0, z: 0 })
  const [workplaneHeight, setWorkplaneHeight] = useState(0)
  const [workplaneDraft, setWorkplaneDraft] = useState('0')
  const [cameraView, setCameraView] = useState<CameraView>('perspective')
  const [frameRequest, setFrameRequest] = useState<FrameRequest | null>(null)
  const requestFrame = useCallback((scope: FrameRequest['scope']) => {
    setFrameRequest((previous) => ({ sequence: (previous?.sequence ?? 0) + 1, scope }))
  }, [])
  const [cameraOrientation, setCameraOrientation] = useState('rotateX(-25deg) rotateY(-35deg)')
  const [projectError, setProjectError] = useState<string | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [exportScope, setExportScope] = useState<ExportScope>('all')
  const [exportRequest, setExportRequest] = useState<{ objects: CadObject[]; exportObjects: CadObject[]; scope: ExportScope; format: ExportFormat } | null>(null)
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
  const exportObjects = exportScope === 'all' ? objects : selectedExportObjects(objects, selectedIds)
  const canExport = exportObjects.some((object) => !isHoleObject(object))
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
  const movingIds = new Set(placementUnits.flatMap((unit) => [...unit.ids]))
  const dropTargets = getSolidBodies(objects).filter((body) =>
    body.members.every((object) => !object.hidden) && [...body.members, ...body.holes].every((object) => !movingIds.has(object.id)))
  const validDropTarget = dropTargets.some((body) => body.anchor.id === dropTarget) ? dropTarget : ''
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
  const { geometries: booleanGeometries, error: booleanError, pending: previewPending, retry: retryPreviews } = useBooleanPreview(objects)
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
    setReferenceOrigin({ x: 0, y: 0, z: 0 })
    setSection(defaultSection)
    setProjectError(null)
    setExportRequest(null)
    setSvgError(null)
    setStlError(null)
  }

  function setWorkplane(height: number) {
    if (!Number.isFinite(height)) return
    const rounded = Number(height.toFixed(3))
    setFacePlane(null)
    setPickMode(null)
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

  async function downloadReviewedExport(signal: AbortSignal) {
    if (!exportRequest || sceneRef.current.objects !== exportRequest.objects) throw new Error('The model changed. Please export again.')
    const { objects: snapshot, exportObjects: sources, format, scope } = exportRequest
    const data = await exportJobs.run('export', { objects: sources, format }, signal)
    if (signal.aborted) throw new DOMException('Export cancelled.', 'AbortError')
    if (sceneRef.current.objects !== snapshot) throw new Error('The model changed. Please export again.')
    download(new Blob([data], { type: format === 'stl' ? 'model/stl' : 'model/3mf' }),
      `block-cad-${scope === 'selection' ? 'selection' : 'model'}.${format === 'stl' ? 'stl' : 'model.3mf'}`)
  }

  async function importSvgFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const index = facePlane ? 0 : objects.length
      const imported = onFaceWorkplane(importSvg(await file.text(), file.name, workplaneHeight,
        (index % 3) * 30, Math.floor(index / 3) * 30), facePlane)
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
      const index = facePlane ? 0 : objects.length
      const [imported] = onFaceWorkplane([await importStl(await file.arrayBuffer(), file.name, workplaneHeight,
        (index % 3) * 30, Math.floor(index / 3) * 30)], facePlane)
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
      setReferenceOrigin({ x: 0, y: 0, z: 0 })
      setSection(defaultSection)
      setProjectError(null)
      setExportRequest(null)
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
    const index = facePlane ? 0 : objects.length
    const [object] = onFaceWorkplane([createCadObject(type, (index % 3) * 30, Math.floor(index / 3) * 30, workplaneHeight)], facePlane)
    commit((current) => ({ objects: [...current.objects, object], selectedObjectId: object.id, selectedObjectIds: [object.id] }))
  }

  function addCutExample() {
    const x = facePlane ? 0 : (objects.length % 3) * 40
    const z = facePlane ? 0 : Math.floor(objects.length / 3) * 40
    const [box, cutter] = onFaceWorkplane(createCutExample(x, z, workplaneHeight), facePlane)
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

  function acceptSurface(pick: SurfacePick) {
    setPositionError(null)
    if (pickMode === 'workplane') {
      setFacePlane(faceWorkplane(pick.point, pick.normal)); setWorkplaneHeight(0); setWorkplaneDraft('0'); setPickMode(null)
    } else if (pickMode === 'align-source') {
      if (placementUnits.length !== 1 || !placementUnits[0].body.members.some((object) => object.id === pick.objectId)) {
        setPositionError('Pick the moving face on the selected body.'); return
      }
      setAlignmentSource(pick); setAlignmentTarget(null); setPickMode('align-target')
    } else if (pickMode === 'align-target') {
      if (placementUnits.some((unit) => unit.ids.has(pick.objectId))) {
        setPositionError('Pick a target face on another body.'); return
      }
      setAlignmentTarget(pick); setPickMode(null)
    } else if (pickMode === 'measure-first') {
      setMeasurementPoints([pick.point]); setPickMode('measure-second')
    } else if (pickMode === 'measure-second') {
      setMeasurementPoints((points) => [points[0], pick.point]); setPickMode(null)
    }
  }

  async function addHolePattern(parameters: HolePattern) {
    if (positioning || !selectedObjectId) throw new Error('Select a solid target first.')
    const snapshot = scene
    setPositioning(true)
    try {
      const result = await createHolePattern(snapshot.objects, selectedObjectId, parameters, facePlane)
      if (sceneRef.current !== snapshot) throw new Error('The model or selection changed. Add the pattern again.')
      commit((current) => current === snapshot ? { objects: [...current.objects, ...result.holes], selectedObjectId: result.targetId,
        selectedObjectIds: [result.targetId] } : current)
    } finally { setPositioning(false) }
  }

  async function splitSelected() {
    if (positioning) return
    const snapshot = scene
    setPositioning(true); setSplitting(true); setPositionError(null)
    try {
      const result = await splitJobs.run('split', { objects: snapshot.objects, ids: snapshot.selectedObjectIds, axis: section.axis, position: section.position })
      if (sceneRef.current !== snapshot) throw new Error('The model or selection changed. Try splitting again.')
      commit((current) => current === snapshot ? { objects: result.objects, selectedObjectIds: result.selectedIds,
        selectedObjectId: result.selectedIds[0] ?? null } : current)
      setSection((current) => ({ ...current, enabled: false }))
    } catch (error) { setPositionError(error instanceof Error ? error.message : 'Could not split these bodies.') }
    finally { setPositioning(false); setSplitting(false) }
  }

  function alignSelected(axis: keyof Vector3) {
    void positionSelection((current, ids) => alignByBounds(current, ids, selectedObjectId, axis, alignmentEdge))
  }

  async function savePart(name: string) {
    const snapshot = scene
    const sources = await preparePart(snapshot.objects, new Set(snapshot.selectedObjectIds))
    await saveLocalProject('part', name, sources)
  }

  async function useSavedPart(id: string) {
    const snapshot = sceneRef.current
    const height = workplaneHeight
    const sources = await readLocalProject(id, 'part')
    if (sceneRef.current !== snapshot) throw new Error('The model or selection changed. Insert the part again.')
    const copies = onFaceWorkplane(insertPart(sources, height), facePlane)
    commit((current) => current === snapshot ? { objects: [...current.objects, ...copies],
      selectedObjectIds: copies.map((object) => object.id), selectedObjectId: copies[0]?.id ?? null } : current)
  }

  async function saveSnapshot(name: string) {
    await saveLocalProject('snapshot', name, scene.objects)
  }

  async function restoreSnapshot(id: string) {
    const before = sceneRef.current
    const restored = await readLocalProject(id, 'snapshot')
    if (sceneRef.current !== before) throw new Error('The model or selection changed. Restore the snapshot again.')
    commit((current) => current === before ? { objects: restored,
      selectedObjectIds: [], selectedObjectId: null } : current)
    setAutosaveEnabled(true)
    setShowRecoveryNotice(false)
    setExportRequest(null)
  }

  function addText(text: string, size: number, height: number, fontId: TextFont) {
    const [object] = onFaceWorkplane([createTextObject(text, size, height, workplaneHeight, fontId)], facePlane)
    commit((current) => ({ objects: [...current.objects, object], selectedObjectId: object.id, selectedObjectIds: [object.id] }))
  }

  function insertArray({ copies, lastCopiedIds }: ReturnType<typeof repeatSelection>) {
    const snapshot = scene
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
      if (event.defaultPrevented || event.altKey || document.querySelector('dialog[open]')) return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select'))) return

      const modifier = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      const nudge: Record<string, [keyof Vector3, number]> = {
        arrowleft: ['x', -1], arrowright: ['x', 1],
        arrowup: ['z', -1], arrowdown: ['z', 1],
        pageup: ['y', 1], pagedown: ['y', -1],
      }
      if (!modifier && key === '?') {
        event.preventDefault()
        if (!event.repeat) setShowShortcuts(true)
      } else if (modifier && key === 'z') {
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
          <label className="export-scope">Export
            <select aria-label="Export scope" value={exportScope} onChange={(event) => setExportScope(event.target.value as ExportScope)}>
              <option value="all">All bodies</option><option value="selection">Selection</option>
            </select>
          </label>
          <button type="button" onClick={() => setExportRequest({ objects, exportObjects, scope: exportScope, format: 'stl' })} disabled={!canExport} title="Review and export bodies in the chosen scope as STL (millimeters)">Export STL</button>
          <button type="button" onClick={() => setExportRequest({ objects, exportObjects, scope: exportScope, format: '3mf' })} disabled={!canExport} title="Check and export finished solids as 3MF (millimeters)">Export 3MF</button>
          <input ref={fileInput} type="file" accept=".json,application/json" onChange={loadProject} hidden aria-label="Choose a Block CAD project file" />
        </div>
      </header>
      <div className="autosave-status" role="status">{autosaveStatus}</div>
      {showRecoveryNotice && <div className="recovery-notice" role="status">{recoveryNotice}
        <button type="button" onClick={() => setShowRecoveryNotice(false)}>Dismiss</button>
      </div>}
      {projectError && <div className="project-error" role="alert">Could not load project: {projectError}</div>}
      {booleanError && <div className="project-error" role="alert">Could not calculate model: {booleanError} <button type="button" onClick={retryPreviews}>Retry previews</button></div>}
      {showShortcuts && <ShortcutHelp onClose={() => setShowShortcuts(false)} />}
      {exportRequest && <ExportReview objects={exportRequest.exportObjects} stale={objects !== exportRequest.objects} scope={exportRequest.scope} format={exportRequest.format}
        onClose={() => setExportRequest(null)} onDownload={downloadReviewedExport} />}
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
            <button type="button" className={`tool-button${boxSelectEnabled ? ' is-active' : ''}`}
              aria-pressed={boxSelectEnabled} onClick={() => { setBoxSelectEnabled((enabled) => !enabled); setPickMode(null) }}>Box select</button>
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
            <button type="button" className={`tool-button${objectSnapEnabled ? ' is-active' : ''}`}
              aria-pressed={objectSnapEnabled} title="Snap the active source shape's world edges and center to visible source shapes within 2 mm"
              onClick={() => { setObjectSnapEnabled((enabled) => !enabled); setSnapHint('') }}>Object snap</button>
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
            <button type="button" className="tool-button" title="Keyboard and mouse shortcuts (?)" onClick={() => setShowShortcuts(true)}>Shortcuts</button>
            <div className="history-actions">
              <button type="button" disabled={!canUndo} onClick={undo} title="Undo (Ctrl/Cmd+Z)">Undo</button>
              <button type="button" disabled={!canRedo} onClick={redo} title="Redo (Ctrl/Cmd+Shift+Z or Ctrl+Y)">Redo</button>
            </div>
          </div>
          <div className="workspace-frame">
            <Workspace measurementPoints={measurementPoints} facePlane={facePlane} pickFace={pickMode !== null} onPickFace={acceptSurface} onExitFace={exitFace} onFaceError={setPositionError} referenceOrigin={referenceOrigin}
              section={section}
              objects={objects}
              selectedObjectId={canTransformSelected ? selectedObjectId : null}
              selectedObjectIds={selectedObjectIds}
              toolMode={toolMode}
              objectSnapEnabled={objectSnapEnabled}
              onSnapHint={setSnapHint}
              snapEnabled={snapEnabled}
              gridSize={gridSize}
              boxSelectEnabled={boxSelectEnabled}
              onSelectMany={selectMany}
              onExitBoxSelect={exitBoxSelect}
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
            <div className="workspace-hint">{pickMode ? `${pickMode === 'workplane' ? 'Pick a workplane face' : pickMode === 'align-source' ? 'Pick the selected body’s moving face' : pickMode === 'align-target' ? 'Pick another body’s target face' : pickMode === 'measure-first' ? 'Pick the first measurement point' : 'Pick the second measurement point'} · Escape cancels` : snapHint || (boxSelectEnabled ? 'Drag a selection rectangle · Shift adds · Esc returns to camera controls'
              : `${cameraView === 'perspective' ? 'Drag to orbit · ' : ''}Scroll to zoom · Right drag to pan`)}</div>
            <div className="axis-label">{facePlane ? 'Face workplane' : `Workplane Y ${workplaneHeight} ${MODEL_UNIT}`} <span>·</span> X / Y / Z</div>
          </div>
        </section>
        <aside className="info-panel" aria-label="Workspace information">
          <nav className="tool-navigation" aria-label="Tool groups">
            {['Shapes', 'Place', 'Objects', 'Combine', 'Arrange', 'Inspect'].map((label) =>
              <button key={label} type="button" onClick={() => jumpToTools(`tools-${label.toLowerCase()}`)}>{label}</button>)}
          </nav>
          {!selectedObject && (
            <div className="panel-section">
              <p className="eyebrow">Getting started</p>
              <h2>Take a look around</h2>
              <p>Add a shape below, then click any object to select it. Click empty space to clear your selection.</p>
            </div>
          )}
          <div className="panel-section shapes-section">
            <ToolGroup id="tools-shapes" title="Shapes" open>
            <div className="shape-list">
              {(['box', 'cylinder', 'sphere', 'cone', 'wedge', 'prism'] as const).map((type) => (
                <button className="shape-button" key={type} type="button" onClick={() => addObject(type)}>
                  <span className={`shape-glyph ${type}`} aria-hidden="true" />
                  <span>{shapeLabels[type]}</span>
                  <span className="shape-add" aria-hidden="true">+</span>
                </button>
              ))}
            </div>
            <ExampleProjects onLoad={(loaded) => {
              if (sceneRef.current !== scene) throw new Error('The model or selection changed. Load the example again.')
              commit((current) => current === scene ? { objects: loaded, selectedObjectIds: [], selectedObjectId: null } : current)
              setSection(defaultSection)
              setWorkplane(0)
              setReferenceOrigin({ x: 0, y: 0, z: 0 })
              setAutosaveEnabled(true)
              setShowRecoveryNotice(false)
              setExportRequest(null)
              requestFrame('all')
            }} />
            <TextTools onApply={addText} />
            <CustomShapeTools onApply={(parameters) => {
              const [object] = onFaceWorkplane([createCustomShape(parameters, workplaneHeight)], facePlane)
              commit((current) => ({ objects: [...current.objects, object], selectedObjectIds: [object.id], selectedObjectId: object.id }))
            }} />
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
                  : `Calculating ${previewPending} preview${previewPending === 1 ? '' : 's'} in background…`}
              </p>
            )}
            </ToolGroup>
          </div>
          <div className="panel-section">
            <SavedProjectsPanel revision={libraryRevision} kind="part" canSave={selectedObjects.some((object) => !isHoleObject(object))}
              onSave={savePart} onUse={useSavedPart} />
            <SavedProjectsPanel revision={libraryRevision} kind="snapshot" canSave={true} onSave={saveSnapshot} onUse={restoreSnapshot} />
            <LibraryTransfer onImported={() => setLibraryRevision((value) => value + 1)} />
          </div>
          <div className="panel-section">{splitting && <button type="button" onClick={() => splitJobs.cancel()}>Cancel split</button>}<SectionTools error={positionError} busy={positioning} onSplit={() => void splitSelected()} canSplit={canPosition && placementUnits.every((unit) => !isHoleObject(unit.body.anchor))} section={section} onChange={setSection} activePosition={selectedObject?.position} /></div>
          <div className="panel-section workplane-section">
            <ToolGroup id="tools-place" title="Place">
            <ReferenceTools objects={objects} selectedIds={selectedObjectIds} origin={referenceOrigin} onOrigin={setReferenceOrigin}
              disabled={!canPosition} onPosition={(edge, offset) => void positionSelection((current, ids) => positionFromReference(current, ids, edge, referenceOrigin, offset))} />
            <h3>Workplane</h3>
            <button type="button" aria-pressed={pickFace} disabled={positioning}
              onClick={() => { setPickMode(pickFace ? null : 'workplane'); setBoxSelectEnabled(false); setPositionError(null) }}>{pickFace ? 'Cancel face pick' : 'Pick face workplane'}</button>
            {pickFace && <p role="status">Click a solid face in the canvas. Escape cancels.</p>}
            {facePlane && <p role="status">Face workplane active. New shapes start at the picked point, facing outward.</p>}
            <label className="workplane-height-field">Horizontal height (mm)
              <input type="number" step="any" value={workplaneDraft} disabled={positioning}
                onChange={(event) => setWorkplaneDraft(event.target.value)}
                onBlur={(event) => applyWorkplaneDraft(event.currentTarget.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} />
            </label>
            <div className="workplane-actions">
              <button type="button" disabled={!selectedObject || positioning} onClick={() => selectedObject && setWorkplane(getObjectTopHeight(selectedObject))}>Use selected top</button>
              <button type="button" disabled={(!facePlane && workplaneHeight === 0) || positioning} onClick={() => setWorkplane(0)}>Reset to 0</button>
            </div>
            <button type="button" className="cut-example-button" disabled={!canPosition}
              onClick={() => void positionSelection((current, ids) => facePlane ? dropToFaceWorkplane(current, ids, facePlane) : dropToWorkplane(current, ids, workplaneHeight))}
              title="Rest each selected body's finished bottom on the current workplane">Drop to workplane</button>
            <p className="selection-hint">New shapes rest on the current plane. Picking a face uses its triangle plane, including facets on curved meshes. The plane stays fixed when its source moves.</p>
            <p className="selection-hint">Drop moves each body along the plane normal, carrying its linked holes. The plane extends beyond the face. Height and Reset switch back to a horizontal plane. Snap and inspector coordinates use world axes.</p>
            <FaceAlignmentTools disabled={!canPosition || placementUnits.length !== 1 || isHoleObject(placementUnits[0].body.anchor)}
              source={alignmentSource} target={alignmentTarget} picking={pickMode === 'align-source' || pickMode === 'align-target'} error={positionError}
              onStart={() => { setAlignmentSource(null); setAlignmentTarget(null); setPickMode('align-source'); setBoxSelectEnabled(false); setPositionError(null) }}
              onCancel={() => { setAlignmentSource(null); setAlignmentTarget(null); setPickMode(null) }}
              onApply={(offset) => { if (alignmentSource && alignmentTarget) void positionSelection(async (current, ids) => alignPickedFaces(current, ids, alignmentSource, alignmentTarget, offset)) }} />
            <h3>Drop onto body</h3>
            <label>Target body<select aria-label="Drop target body" value={validDropTarget} onChange={(event) => setDropTarget(event.target.value)}>
              <option value="">Choose a target</option>
              {dropTargets.map((body) => <option key={body.anchor.id} value={body.anchor.id}>{objectLabel(body.anchor, objects)}</option>)}
            </select></label>
            <button type="button" disabled={!canPosition || !validDropTarget || placementUnits.some((unit) => isHoleObject(unit.body.anchor))}
              onClick={() => void positionSelection((current, ids) => dropOntoBody(current, ids, validDropTarget))}>Drop onto body</button>
            <p className="selection-hint">Move selected solids above the target in X/Z first. Drop places each at first surface contact from above, moving only world Y, with all linked holes. It can raise overlapping bodies. Other bodies are not obstacles.</p>
            {positionError && <p className="position-error" role="alert">{positionError}</p>}
            {positioning && <p role="status">Calculating placement…</p>}
            </ToolGroup>
          </div>
          <div className="panel-section selection-section" id="tools-objects" tabIndex={-1}>
            <h3>Selection</h3>
            <div className={`selection-card${selectedObject ? ' is-selected' : ''}`} aria-live="polite">
              <span className="selection-indicator" aria-hidden="true" />
              <span>{selectedObjectIds.length > 1
                ? `${selectedObjectIds.length} objects selected · ${selectedObject ? objectLabel(selectedObject, objects) : 'Shape'} active`
                : selectedObject ? `${objectLabel(selectedObject, objects)} selected` : 'Nothing selected'}</span>
            </div>
            <p className="selection-hint">Shift+click shapes or the list to select more than one. The last selected shape is active; its properties appear below.</p>
            <ObjectList objects={objects} selectedIds={selectedObjectIds} onSelect={select} />
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
            <ToolGroup id="tools-combine" title="Combine">
            <HolePatternTools busy={positioning} disabled={!canEditActive || !selectedObject || isHoleObject(selectedObject) || !!selectedObject.hidden}
              facePlane={!!facePlane} onApply={addHolePattern} />
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
            </ToolGroup>
            <ToolGroup id="tools-arrange" title="Arrange">
            <div className="align-actions" role="group" aria-label="Mirror selection">
              {(['x', 'y', 'z'] as const).map((axis) => (
                <button key={axis} type="button" disabled={!canPosition}
                  onClick={() => void positionSelection((current, ids) => mirrorSelection(current, ids, axis))}>Mirror {axis.toUpperCase()}</button>
              ))}
            </div>
            <p className="selection-hint">Mirror flips the arrangement around its shared center on a world axis, including linked holes.</p>
            <ResizeTools disabled={!canPosition}
              onResize={(axis, size) => void positionSelection((current, ids) => resizeSelection(current, ids, axis, size))} />
            <RadialArrayTools disabled={!selectedObjectIds.length || positioning}
              onRepeat={(axis, count, angle, center) => insertArray(radialArray(objects, new Set(selectedObjectIds), axis, count, angle, center))} />
            <RepeatTools disabled={!selectedObjectIds.length || positioning} onRepeat={(axis, count, spacing) => insertArray(repeatSelection(objects, new Set(selectedObjectIds), axis, count, spacing))} />
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
            <label className="alignment-mode">Distribute by
              <select aria-label="Distribution mode" value={distributionMode} onChange={(event) => setDistributionMode(event.target.value as DistributionMode)}>
                <option value="gaps">Equal gaps</option><option value="centers">Centers</option>
              </select>
            </label>
            <div className="align-actions" role="group" aria-label="Distribute selected bodies">
              {(['x', 'y', 'z'] as const).map((axis) => <button key={axis} type="button"
                disabled={!canPosition || placementUnits.length < 3}
                onClick={() => void positionSelection((current, ids) => distributeByBounds(current, ids, axis, distributionMode))}>
                Distribute {axis.toUpperCase()}</button>)}
            </div>
            <p className="selection-hint">Select at least three bodies. The first and last centers on the chosen axis stay fixed. Equal gaps needs enough room between them; centers can overlap.</p>
            </ToolGroup>
            <div id="tools-inspect" tabIndex={-1}><h3>Inspect</h3></div>
            {positioning && <p className="selection-hint" role="status">Calculating placement…</p>}
            {positionError && <p className="position-error" role="alert">{positionError}</p>}
            {selectedObject && !canEditActive && <p className="selection-hint">Unlock this shape to edit its properties.</p>}
            {selectedObject?.type === 'custom' && <CustomShapeTools key={`${selectedObject.id}:${JSON.stringify(selectedObject.parameters)}`}
              initial={selectedObject.parameters} action="Apply custom parameters" disabled={!canEditActive} onApply={(parameters) => {
                const updated = changeCustomShape(selectedObject, parameters)
                commit((current) => ({ ...current, objects: current.objects.map((object) => object.id === updated.id ? updated : object) }))
              }} />}
            {selectedObject?.type === 'text'  && <TextTools
              key={`${selectedObject.id}:${selectedObject.text}:${selectedObject.fontSize}:${selectedObject.fontId}:${selectedObject.dimensions.y}`}
              initialFont={selectedObject.fontId} initialText={selectedObject.text} initialSize={selectedObject.fontSize} initialHeight={selectedObject.dimensions.y}
              action="Apply text" disabled={!canEditActive} onApply={(text, size, height, fontId) => {
                const updated = changeText(selectedObject, text, size, height, fontId)
                commit((current) => ({ ...current, objects: current.objects.map((object) => object.id === updated.id ? updated : object) }))
              }} />}
            {selectedObject && (
              <ObjectInspector
                key={selectedObject.id}
                object={selectedObject}
                solidTargets={solidTargets}
                onUpdate={updateObject}
                onSetCutTarget={setCutTarget}
                onSetColor={(id, color) => editObjects((current) => colorObjects(current, id, color))}
                onEditStart={begin}
                onEditEnd={end}
                disabled={!canEditActive}
              />
            )}
          </div>
          <div className="panel-section controls-section">
            <PointMeasurementTools error={positionError} points={measurementPoints} picking={pickMode === 'measure-first' || pickMode === 'measure-second'}
              onStart={() => { setMeasurementPoints([]); setPickMode('measure-first'); setBoxSelectEnabled(false); setPositionError(null) }}
              onClear={() => { setMeasurementPoints([]); setPickMode(null) }} />
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

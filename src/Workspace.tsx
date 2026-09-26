import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Canvas } from '@react-three/fiber'
import { DoubleSide, FrontSide, type BufferGeometry, type Mesh, type Plane } from 'three'
import { clippedRaycast, sectionPlane, type SectionView } from './sectionView'
import type { TransformControlsMode } from 'three/addons/controls/TransformControls.js'
import { getSolidBodies, isHoleObject, type CadObject, type ObjectTransform, type Vector3 } from './cadModel'
import SceneControls, { type CameraView } from './SceneControls'
import { DEFAULT_OBJECT_COLOR } from './objectColor'
import { createSourceGeometry } from './sourceGeometry'
import type { FrameRequest } from './frameCamera'
import { expandAssemblyIds } from './selectionOperations'
import BoxSelection from './BoxSelection'
import FacePicker from './FacePicker'
import PointMeasurementOverlay from './PointMeasurementOverlay'
import type { SurfacePick } from './surfaceTools'
import type { WorkplaneFrame } from './workplane'
import type { ScreenRectangle } from './boxSelection'

const CadObjectMesh = memo(function CadObjectMesh({
  object,
  isSelected,
  isActive,
  hiddenInGroup,
  onSelect,
  selectedMeshRef,
  cutGeometry,
  clippingPlanes,
  surfaceReady,
}: {
  object: CadObject
  isSelected: boolean
  isActive: boolean
  hiddenInGroup: boolean
  onSelect: (id: string, additive: boolean) => void
  selectedMeshRef: RefObject<Mesh | null>
  clippingPlanes: Plane[]
  surfaceReady: boolean
  cutGeometry?: BufferGeometry
}) {
  const sourceGeometry = useMemo(() => createSourceGeometry(object), [object.type, object.dimensions,
    object.type === 'svg' || object.type === 'text' ? object.contours : null, object.type === 'stl' ? object.meshData : null,
    object.type === 'prism' ? object.sides : null, object.type === 'custom' ? object.parameters : null])
  useEffect(() => () => sourceGeometry.dispose(), [sourceGeometry])
  if (object.hidden) return null
  const { position, rotation, scale } = object
  const isCutter = isHoleObject(object)
  const sourceOverlay = hiddenInGroup && isSelected
  const wireframe = isCutter || sourceOverlay

  return (
    <mesh
      userData={{ cadObjectId: object.id, cadSurface: surfaceReady && !wireframe }}
      raycast={clippedRaycast}
      ref={isActive ? selectedMeshRef : undefined}
      visible={!hiddenInGroup || isSelected}
      position={[position.x, position.y, position.z]}
      rotation={[rotation.x, rotation.y, rotation.z]}
      scale={[scale.x, scale.y, scale.z]}
      renderOrder={wireframe ? 1 : 0}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(object.id, event.nativeEvent.shiftKey)
      }}
    >
      <primitive object={cutGeometry ?? sourceGeometry} attach="geometry" />
      <meshStandardMaterial
        clippingPlanes={clippingPlanes}
        side={clippingPlanes.length ? DoubleSide : FrontSide}
        color={isSelected ? '#f3a447' : object.color ?? DEFAULT_OBJECT_COLOR}
        emissive={isSelected ? '#5c2d00' : '#000000'}
        emissiveIntensity={isSelected ? 0.18 : 0}
        roughness={0.75}
        flatShading={!!cutGeometry || ['cone', 'wedge', 'prism'].includes(object.type)}
        wireframe={wireframe}
        transparent={wireframe}
        opacity={wireframe ? 0.55 : 1}
        depthTest={!wireframe}
        depthWrite={!wireframe}
      />
    </mesh>
  )
})

function CadScene({
  objects,
  selectedObjectId,
  selectedObjectIds,
  onSelectObject,
  toolMode,
  objectSnapEnabled,
  onSnapHint,
  snapEnabled,
  gridSize,
  boxSelectEnabled,
  onSelectMany,
  onExitBoxSelect,
  onRectangle,
  workplaneHeight,
  cameraView,
  frameRequest,
  onCameraOrientation,
  onTransformObject,
  onTransformStart,
  onTransformEnd,
  gizmoInteractionRef,
  booleanGeometries,
  section,
  referenceOrigin,
  measurementPoints, facePlane, pickFace, onPickFace, onExitFace, onFaceError,
}: WorkspaceProps & { gizmoInteractionRef: RefObject<boolean>; onRectangle: (rectangle: ScreenRectangle | null) => void }) {
  const onSelectMesh = useCallback((id: string, additive: boolean) => {
    if (!pickFace && !gizmoInteractionRef.current) onSelectObject(id, additive)
  }, [gizmoInteractionRef, onSelectObject, pickFace])
  const selectedMeshRef = useRef<Mesh | null>(null)
  const clippingPlanes = useMemo(() => { const plane = sectionPlane(section); return plane ? [plane] : [] }, [section])
  const hiddenGroupedIds = new Set(getSolidBodies(objects).flatMap((body) => {
    if (!booleanGeometries.has(body.anchor.id)) return []
    return [
      ...(body.members.length > 1 ? body.members.slice(1).map((member) => member.id) : []),
      ...body.holes.filter((hole) => hole.groupedWithTarget).map((hole) => hole.id),
    ]
  }))

  const pendingSurfaces = new Set(getSolidBodies(objects).filter((body) =>
    (body.members.length > 1 || body.holes.length > 0) && !booleanGeometries.has(body.anchor.id))
    .flatMap((body) => body.members.map((member) => member.id)))
  return (
    <>
      <color attach="background" args={['#f8faff']} />
      <axesHelper args={[12]} position={[referenceOrigin.x, referenceOrigin.y, referenceOrigin.z]} />
      <ambientLight intensity={1.6} />
      <directionalLight position={[50, 90, 40]} intensity={2.4} />
      <gridHelper args={[200, 200 / gridSize, '#a9b8cf', '#dce3ef']} position={facePlane ? [facePlane.origin.x, facePlane.origin.y, facePlane.origin.z] : [0, workplaneHeight - 0.01, 0]}
        rotation={facePlane ? [facePlane.rotation.x, facePlane.rotation.y, facePlane.rotation.z] : [0, 0, 0]} />
      {objects.map((object) => (
        <CadObjectMesh
          key={object.id}
          object={object}
          surfaceReady={!pendingSurfaces.has(object.id)}
          isSelected={selectedObjectIds.includes(object.id)}
          isActive={object.id === selectedObjectId}
          hiddenInGroup={hiddenGroupedIds.has(object.id)}
          onSelect={onSelectMesh}
          selectedMeshRef={selectedMeshRef}
          cutGeometry={booleanGeometries.get(object.id)}
          clippingPlanes={clippingPlanes}
        />
      ))}
      <SceneControls
        selectedMeshRef={selectedMeshRef}
        gizmoInteractionRef={gizmoInteractionRef}
        selectedObjectId={selectedObjectId}
        toolMode={toolMode}
        objects={objects}
        objectSnapEnabled={objectSnapEnabled}
        onSnapHint={onSnapHint}
        snapEnabled={snapEnabled}
        gridSize={gridSize}
        boxSelectEnabled={boxSelectEnabled || pickFace}
        cameraView={cameraView}
        frameRequest={frameRequest}
        frameSelectionIds={expandAssemblyIds(objects, new Set(selectedObjectIds), true)}
        onCameraOrientation={onCameraOrientation}
        onTransformObject={onTransformObject}
        onTransformStart={onTransformStart}
        onTransformEnd={onTransformEnd}
      />
      <PointMeasurementOverlay points={measurementPoints} />
      <FacePicker enabled={pickFace} onPick={onPickFace} onExit={onExitFace} onError={onFaceError} />
      <BoxSelection enabled={boxSelectEnabled} onSelect={onSelectMany} onExit={onExitBoxSelect} onRectangle={onRectangle} />
    </>
  )
}

type WorkspaceProps = {
  measurementPoints: Vector3[]
  facePlane: WorkplaneFrame | null
  pickFace: boolean
  onPickFace: (pick: SurfacePick) => void
  onExitFace: () => void
  onFaceError: (message: string) => void
  referenceOrigin: Vector3
  section: SectionView
  objects: CadObject[]
  selectedObjectId: string | null
  selectedObjectIds: string[]
  toolMode: TransformControlsMode
  objectSnapEnabled: boolean
  onSnapHint: (hint: string) => void
  snapEnabled: boolean
  gridSize: number
  boxSelectEnabled: boolean
  onSelectMany: (ids: string[], additive: boolean) => void
  onExitBoxSelect: () => void
  workplaneHeight: number
  cameraView: CameraView
  frameRequest: FrameRequest | null
  onCameraOrientation: (transform: string) => void
  booleanGeometries: Map<string, BufferGeometry>
  onSelectObject: (id: string | null, additive?: boolean) => void
  onTransformObject: (id: string, transform: ObjectTransform) => void
  onTransformStart: () => void
  onTransformEnd: () => void
}

export default function Workspace(props: WorkspaceProps) {
  const gizmoInteractionRef = useRef(false)
  const [rectangle, setRectangle] = useState<ScreenRectangle | null>(null)

  return (
    <div className={`workspace-canvas${props.boxSelectEnabled ? ' box-select-mode' : ''}`} aria-label={`3D workspace with ${props.objects.length} ${props.objects.length === 1 ? 'object' : 'objects'} and grid`}>
      <Canvas
        frameloop="demand"
        onCreated={({ gl }) => { gl.localClippingEnabled = true }}
        camera={{ position: [65, 50, 65], fov: 45, near: 0.1, far: 1000 }}
        onPointerMissed={(event) => { if (!props.pickFace && !props.boxSelectEnabled && !gizmoInteractionRef.current && !event.shiftKey) props.onSelectObject(null) }}
      >
        <CadScene {...props} gizmoInteractionRef={gizmoInteractionRef} onRectangle={setRectangle} />
      </Canvas>
      {rectangle && <div className="selection-rectangle" style={{ left: rectangle.left, top: rectangle.top,
        width: rectangle.right - rectangle.left, height: rectangle.bottom - rectangle.top }} />}
    </div>
  )
}

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Canvas } from '@react-three/fiber'
import type { BufferGeometry, Mesh } from 'three'
import type { TransformControlsMode } from 'three/addons/controls/TransformControls.js'
import { getSolidBodies, isHoleObject, type CadObject, type ObjectTransform } from './cadModel'
import SceneControls, { type CameraView } from './SceneControls'
import { createSourceGeometry } from './sourceGeometry'
import type { FrameRequest } from './frameCamera'
import { expandAssemblyIds } from './selectionOperations'
import BoxSelection from './BoxSelection'
import type { ScreenRectangle } from './boxSelection'

function CadObjectMesh({
  object,
  isSelected,
  isActive,
  hiddenInGroup,
  onSelect,
  selectedMeshRef,
  cutGeometry,
}: {
  object: CadObject
  isSelected: boolean
  isActive: boolean
  hiddenInGroup: boolean
  onSelect: (id: string, additive: boolean) => void
  selectedMeshRef: RefObject<Mesh | null>
  cutGeometry?: BufferGeometry
}) {
  const sourceGeometry = useMemo(() => createSourceGeometry(object), [object.type, object.dimensions,
    object.type === 'svg' ? object.contours : null, object.type === 'stl' ? object.meshData : null,
    object.type === 'prism' ? object.sides : null])
  useEffect(() => () => sourceGeometry.dispose(), [sourceGeometry])
  if (object.hidden) return null
  const { position, rotation, scale } = object
  const isCutter = isHoleObject(object)
  const sourceOverlay = hiddenInGroup && isSelected
  const wireframe = isCutter || sourceOverlay

  return (
    <mesh
      userData={{ cadObjectId: object.id }}
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
        color={isSelected ? '#f3a447' : '#6797ef'}
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
}

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
}: WorkspaceProps & { gizmoInteractionRef: RefObject<boolean>; onRectangle: (rectangle: ScreenRectangle | null) => void }) {
  const selectedMeshRef = useRef<Mesh | null>(null)
  const hiddenGroupedIds = new Set(getSolidBodies(objects).flatMap((body) => {
    if (!booleanGeometries.has(body.anchor.id)) return []
    return [
      ...(body.members.length > 1 ? body.members.slice(1).map((member) => member.id) : []),
      ...body.holes.filter((hole) => hole.groupedWithTarget).map((hole) => hole.id),
    ]
  }))

  return (
    <>
      <color attach="background" args={['#f8faff']} />
      <ambientLight intensity={1.6} />
      <directionalLight position={[50, 90, 40]} intensity={2.4} />
      <gridHelper args={[200, 200 / gridSize, '#a9b8cf', '#dce3ef']} position={[0, workplaneHeight - 0.01, 0]} />
      {objects.map((object) => (
        <CadObjectMesh
          key={object.id}
          object={object}
          isSelected={selectedObjectIds.includes(object.id)}
          isActive={object.id === selectedObjectId}
          hiddenInGroup={hiddenGroupedIds.has(object.id)}
          onSelect={(id, additive) => { if (!gizmoInteractionRef.current) onSelectObject(id, additive) }}
          selectedMeshRef={selectedMeshRef}
          cutGeometry={booleanGeometries.get(object.id)}
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
        boxSelectEnabled={boxSelectEnabled}
        cameraView={cameraView}
        frameRequest={frameRequest}
        frameSelectionIds={expandAssemblyIds(objects, new Set(selectedObjectIds), true)}
        onCameraOrientation={onCameraOrientation}
        onTransformObject={onTransformObject}
        onTransformStart={onTransformStart}
        onTransformEnd={onTransformEnd}
      />
      <BoxSelection enabled={boxSelectEnabled} onSelect={onSelectMany} onExit={onExitBoxSelect} onRectangle={onRectangle} />
    </>
  )
}

type WorkspaceProps = {
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
        camera={{ position: [65, 50, 65], fov: 45, near: 0.1, far: 1000 }}
        onPointerMissed={(event) => { if (!props.boxSelectEnabled && !gizmoInteractionRef.current && !event.shiftKey) props.onSelectObject(null) }}
      >
        <CadScene {...props} gizmoInteractionRef={gizmoInteractionRef} onRectangle={setRectangle} />
      </Canvas>
      {rectangle && <div className="selection-rectangle" style={{ left: rectangle.left, top: rectangle.top,
        width: rectangle.right - rectangle.left, height: rectangle.bottom - rectangle.top }} />}
    </div>
  )
}

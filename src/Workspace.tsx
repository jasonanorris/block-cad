import { useRef, type RefObject } from 'react'
import { Canvas } from '@react-three/fiber'
import type { BufferGeometry, Mesh } from 'three'
import type { TransformControlsMode } from 'three/addons/controls/TransformControls.js'
import { getSolidBodies, isHoleObject, type CadObject, type ObjectTransform } from './cadModel'
import SceneControls, { type CameraView } from './SceneControls'

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
  if (object.hidden) return null
  const { position, rotation, scale } = object
  const isCutter = isHoleObject(object)
  const sourceOverlay = hiddenInGroup && isSelected
  const wireframe = isCutter || sourceOverlay

  return (
    <mesh
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
      {cutGeometry ? (
        <primitive object={cutGeometry} attach="geometry" />
      ) : object.type === 'box' && (
        <boxGeometry args={[object.dimensions.x, object.dimensions.y, object.dimensions.z]} />
      )}
      {!cutGeometry && object.type === 'cylinder' && (
        <cylinderGeometry args={[object.dimensions.diameter / 2, object.dimensions.diameter / 2, object.dimensions.height, 32]} />
      )}
      {!cutGeometry && object.type === 'sphere' && (
        <sphereGeometry args={[object.dimensions.diameter / 2, 32, 16]} />
      )}
      <meshStandardMaterial
        color={isSelected ? '#f3a447' : '#6797ef'}
        emissive={isSelected ? '#5c2d00' : '#000000'}
        emissiveIntensity={isSelected ? 0.18 : 0}
        roughness={0.75}
        flatShading={!!cutGeometry}
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
  snapEnabled,
  gridSize,
  cameraView,
  onCameraOrientation,
  onTransformObject,
  onTransformStart,
  onTransformEnd,
  gizmoInteractionRef,
  booleanGeometries,
}: WorkspaceProps & { gizmoInteractionRef: RefObject<boolean> }) {
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
      <gridHelper args={[200, 200 / gridSize, '#a9b8cf', '#dce3ef']} position={[0, -0.01, 0]} />
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
        snapEnabled={snapEnabled}
        gridSize={gridSize}
        cameraView={cameraView}
        onCameraOrientation={onCameraOrientation}
        onTransformObject={onTransformObject}
        onTransformStart={onTransformStart}
        onTransformEnd={onTransformEnd}
      />
    </>
  )
}

type WorkspaceProps = {
  objects: CadObject[]
  selectedObjectId: string | null
  selectedObjectIds: string[]
  toolMode: TransformControlsMode
  snapEnabled: boolean
  gridSize: number
  cameraView: CameraView
  onCameraOrientation: (transform: string) => void
  booleanGeometries: Map<string, BufferGeometry>
  onSelectObject: (id: string | null, additive?: boolean) => void
  onTransformObject: (id: string, transform: ObjectTransform) => void
  onTransformStart: () => void
  onTransformEnd: () => void
}

export default function Workspace(props: WorkspaceProps) {
  const gizmoInteractionRef = useRef(false)

  return (
    <div className="workspace-canvas" aria-label={`3D workspace with ${props.objects.length} ${props.objects.length === 1 ? 'object' : 'objects'} and grid`}>
      <Canvas
        camera={{ position: [65, 50, 65], fov: 45, near: 0.1, far: 1000 }}
        onPointerMissed={(event) => { if (!gizmoInteractionRef.current && !event.shiftKey) props.onSelectObject(null) }}
      >
        <CadScene {...props} gizmoInteractionRef={gizmoInteractionRef} />
      </Canvas>
    </div>
  )
}

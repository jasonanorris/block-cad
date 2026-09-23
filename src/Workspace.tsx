import { useRef, type RefObject } from 'react'
import { Canvas } from '@react-three/fiber'
import type { Mesh } from 'three'
import type { TransformControlsMode } from 'three/addons/controls/TransformControls.js'
import type { CadObject, ObjectTransform } from './cadModel'
import SceneControls from './SceneControls'

function CadObjectMesh({
  object,
  isSelected,
  onSelect,
  selectedMeshRef,
}: {
  object: CadObject
  isSelected: boolean
  onSelect: (id: string) => void
  selectedMeshRef: RefObject<Mesh | null>
}) {
  const { position, rotation, scale } = object

  return (
    <mesh
      ref={isSelected ? selectedMeshRef : undefined}
      position={[position.x, position.y, position.z]}
      rotation={[rotation.x, rotation.y, rotation.z]}
      scale={[scale.x, scale.y, scale.z]}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(object.id)
      }}
    >
      {object.type === 'box' && (
        <boxGeometry args={[object.dimensions.x, object.dimensions.y, object.dimensions.z]} />
      )}
      {object.type === 'cylinder' && (
        <cylinderGeometry args={[object.dimensions.diameter / 2, object.dimensions.diameter / 2, object.dimensions.height, 32]} />
      )}
      {object.type === 'sphere' && (
        <sphereGeometry args={[object.dimensions.diameter / 2, 32, 16]} />
      )}
      <meshStandardMaterial
        color={isSelected ? '#f3a447' : '#6797ef'}
        emissive={isSelected ? '#5c2d00' : '#000000'}
        emissiveIntensity={isSelected ? 0.18 : 0}
        roughness={0.75}
      />
    </mesh>
  )
}

function CadScene({
  objects,
  selectedObjectId,
  onSelectObject,
  toolMode,
  onTransformObject,
  onTransformStart,
  onTransformEnd,
  gizmoInteractionRef,
}: WorkspaceProps & { gizmoInteractionRef: RefObject<boolean> }) {
  const selectedMeshRef = useRef<Mesh | null>(null)

  return (
    <>
      <color attach="background" args={['#f8faff']} />
      <ambientLight intensity={1.6} />
      <directionalLight position={[50, 90, 40]} intensity={2.4} />
      <gridHelper args={[200, 20, '#a9b8cf', '#dce3ef']} position={[0, -0.01, 0]} />
      {objects.map((object) => (
        <CadObjectMesh
          key={object.id}
          object={object}
          isSelected={object.id === selectedObjectId}
          onSelect={(id) => { if (!gizmoInteractionRef.current) onSelectObject(id) }}
          selectedMeshRef={selectedMeshRef}
        />
      ))}
      <SceneControls
        selectedMeshRef={selectedMeshRef}
        gizmoInteractionRef={gizmoInteractionRef}
        selectedObjectId={selectedObjectId}
        toolMode={toolMode}
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
  toolMode: TransformControlsMode
  onSelectObject: (id: string | null) => void
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
        onPointerMissed={() => { if (!gizmoInteractionRef.current) props.onSelectObject(null) }}
      >
        <CadScene {...props} gizmoInteractionRef={gizmoInteractionRef} />
      </Canvas>
    </div>
  )
}

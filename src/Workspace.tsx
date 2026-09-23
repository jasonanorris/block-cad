import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { CadObject } from './cadModel'

function CameraControls() {
  const { camera, gl } = useThree()

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement)
    controls.target.set(0, 8, 0)
    controls.minDistance = 25
    controls.maxDistance = 400
    controls.update()
    return () => controls.dispose()
  }, [camera, gl])

  return null
}

function CadObjectMesh({
  object,
  isSelected,
  onSelect,
}: {
  object: CadObject
  isSelected: boolean
  onSelect: (id: string) => void
}) {
  const { position, rotation, scale } = object

  return (
    <mesh
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
}: WorkspaceProps) {
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
          onSelect={onSelectObject}
        />
      ))}
      <CameraControls />
    </>
  )
}

type WorkspaceProps = {
  objects: CadObject[]
  selectedObjectId: string | null
  onSelectObject: (id: string | null) => void
}

export default function Workspace(props: WorkspaceProps) {
  return (
    <div className="workspace-canvas" aria-label="3D workspace with a cube and grid">
      <Canvas
        camera={{ position: [65, 50, 65], fov: 45, near: 0.1, far: 1000 }}
        onPointerMissed={() => props.onSelectObject(null)}
      >
        <CadScene {...props} />
      </Canvas>
    </div>
  )
}

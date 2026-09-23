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

function CadObjectMesh({ object }: { object: CadObject }) {
  const { position, rotation, scale, dimensions } = object

  return (
    <mesh
      position={[position.x, position.y, position.z]}
      rotation={[rotation.x, rotation.y, rotation.z]}
      scale={[scale.x, scale.y, scale.z]}
    >
      <boxGeometry args={[dimensions.x, dimensions.y, dimensions.z]} />
      <meshStandardMaterial color="#6797ef" roughness={0.75} />
    </mesh>
  )
}

function CadScene({ objects }: { objects: CadObject[] }) {
  return (
    <>
      <color attach="background" args={['#f8faff']} />
      <ambientLight intensity={1.6} />
      <directionalLight position={[50, 90, 40]} intensity={2.4} />
      <gridHelper args={[200, 20, '#a9b8cf', '#dce3ef']} position={[0, -0.01, 0]} />
      {objects.map((object) => <CadObjectMesh key={object.id} object={object} />)}
      <CameraControls />
    </>
  )
}

export default function Workspace({ objects }: { objects: CadObject[] }) {
  return (
    <div className="workspace-canvas" aria-label="3D workspace with a cube and grid">
      <Canvas camera={{ position: [65, 50, 65], fov: 45, near: 0.1, far: 1000 }}>
        <CadScene objects={objects} />
      </Canvas>
    </div>
  )
}

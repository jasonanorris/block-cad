import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

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

function FoundationScene() {
  return (
    <>
      <color attach="background" args={['#f8faff']} />
      <ambientLight intensity={1.6} />
      <directionalLight position={[50, 90, 40]} intensity={2.4} />
      <gridHelper args={[200, 20, '#a9b8cf', '#dce3ef']} position={[0, -0.01, 0]} />
      <mesh position={[0, 10, 0]}>
        <boxGeometry args={[20, 20, 20]} />
        <meshStandardMaterial color="#6797ef" roughness={0.75} />
      </mesh>
      <CameraControls />
    </>
  )
}

export default function Workspace() {
  return (
    <div className="workspace-canvas" aria-label="3D workspace with a cube and grid">
      <Canvas camera={{ position: [65, 50, 65], fov: 45, near: 0.1, far: 1000 }}>
        <FoundationScene />
      </Canvas>
    </div>
  )
}

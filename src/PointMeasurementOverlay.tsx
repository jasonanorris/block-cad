import { useEffect, useMemo } from 'react'
import { BufferGeometry, Vector3 as ThreeVector } from 'three'
import type { Vector3 } from './cadModel'

export default function PointMeasurementOverlay({ points }: { points: Vector3[] }) {
  const geometry = useMemo(() => new BufferGeometry().setFromPoints(points.map((p) => new ThreeVector(p.x, p.y, p.z))), [points])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <group>
    {points.map((point, i) => <mesh key={i} position={[point.x, point.y, point.z]} renderOrder={20}>
      <sphereGeometry args={[.8, 12, 8]} /><meshBasicMaterial color={i ? '#dc5037' : '#286ce0'} depthTest={false} depthWrite={false} />
    </mesh>)}
    {points.length === 2 && <lineSegments geometry={geometry} renderOrder={20}>
      <lineBasicMaterial color="#923bb5" depthTest={false} depthWrite={false} />
    </lineSegments>}
  </group>
}

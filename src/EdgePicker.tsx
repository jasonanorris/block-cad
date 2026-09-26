import { useEffect, useMemo, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { BufferGeometry, Mesh, Raycaster, Vector2, Vector3 } from 'three'
import type { FeatureEdge } from './edgeFeatures'

export default function EdgePicker({ enabled, edges, selected, focused, failedKeys, previewing, onPick, onCancel }: {
  enabled: boolean; edges: FeatureEdge[]; selected: number[]; focused: number | null; failedKeys: string[]; previewing: boolean; onPick: (index: number) => void; onCancel: () => void
}) {
  const { camera, scene, gl, invalidate } = useThree()
  const [hover, setHover] = useState<number | null>(null)
  const geometries = useMemo(() => edges.map((edge) => new BufferGeometry().setFromPoints((edge.path ? edge.path.slice(0, -1).flatMap((p, i) => [p, edge.path![i + 1]]) : [edge.a, edge.b]).map((p) => new Vector3(p.x, p.y, p.z)))), [edges])
  useEffect(() => { setHover(null); return () => geometries.forEach((geometry) => geometry.dispose()) }, [geometries])
  useEffect(() => {
    if (!enabled) return
    const canvas = gl.domElement
    const stop = (e: Event) => { e.preventDefault(); e.stopImmediatePropagation() }
    const nearest = (event: MouseEvent) => {
      if (previewing) return null
      const rect = canvas.getBoundingClientRect(), ray = new Raycaster()
      ray.setFromCamera(new Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), camera)
      scene.updateMatrixWorld(true)
      const meshes: Mesh[] = []; scene.traverse((o) => { if (o instanceof Mesh && o.visible && o.userData.cadSurface) meshes.push(o) })
      let best: number | null = null, distance = 12
      edges.forEach((edge, index) => {
        const path = edge.path ?? [edge.a, edge.b]
        for (let segment = 0; segment < path.length - 1; segment++) {
          const a = path[segment], b = path[segment + 1], p = new Vector3()
          ray.ray.distanceSqToSegment(new Vector3(a.x, a.y, a.z), new Vector3(b.x, b.y, b.z), undefined, p)
          const screen = p.clone().project(camera)
          if (screen.z < -1 || screen.z > 1) continue
          const pixels = Math.hypot((screen.x + 1) * rect.width / 2 + rect.left - event.clientX, (1 - screen.y) * rect.height / 2 + rect.top - event.clientY)
          if (pixels >= distance) continue
          // Raycast toward the candidate, not the nearby cursor: hidden back edges cannot win.
          const visibility = new Raycaster(); visibility.setFromCamera(new Vector2(screen.x, screen.y), camera)
          const hit = visibility.intersectObjects(meshes, false)[0]
          if (hit && hit.distance < visibility.ray.origin.distanceTo(p) - .02) continue
          best = index; distance = pixels
        }
      })
      return best
    }
    const move = (e: PointerEvent) => { const next = nearest(e); setHover(next); canvas.style.cursor = next === null ? 'crosshair' : 'pointer'; invalidate() }
    const leave = () => { setHover(null); invalidate() }
    const click = (e: MouseEvent) => { stop(e); if (e.button !== 0) return; const index = nearest(e); if (index !== null) onPick(index) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { stop(e); onCancel() } }
    canvas.addEventListener('pointerdown', stop, true); canvas.addEventListener('pointerup', stop, true)
    canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerleave', leave); canvas.addEventListener('click', click, true)
    window.addEventListener('keydown', key, true)
    return () => {
      canvas.style.cursor = ''; canvas.removeEventListener('pointerdown', stop, true); canvas.removeEventListener('pointerup', stop, true)
      canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerleave', leave); canvas.removeEventListener('click', click, true)
      window.removeEventListener('keydown', key, true)
    }
  }, [enabled, edges, previewing, camera, scene, gl, invalidate, onPick, onCancel])
  if (previewing) return null
  return <group>{geometries.map((geometry, index) => <lineSegments key={index} geometry={geometry} renderOrder={10}>
    <lineBasicMaterial color={index === focused || index === hover ? '#e84f12' : failedKeys.includes(edges[index].key ?? '') ? '#dc2626' : selected.includes(index) ? '#059669' : edges[index].edgeType === 'inside' ? '#8b5cf6' : edges[index].edgeType === 'transition' ? '#64748b' : '#2879ca'} depthTest depthWrite={false} />
  </lineSegments>)}</group>
}

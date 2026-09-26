import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Matrix3, Mesh, Raycaster, Vector2 } from 'three'
import { faceWorkplane, type WorkplaneFrame } from './workplane'

export default function FacePicker({ enabled, onPick, onExit, onError }: {
  enabled: boolean; onPick: (frame: WorkplaneFrame) => void; onExit: () => void; onError: (message: string) => void
}) {
  const { camera, scene, gl } = useThree()
  useEffect(() => {
    if (!enabled) return
    const canvas = gl.domElement
    const stop = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation() }
    const pick = (event: MouseEvent) => {
      stop(event)
      if (event.button !== 0) return
      const rect = canvas.getBoundingClientRect()
      const ray = new Raycaster()
      ray.setFromCamera(new Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), camera)
      scene.updateMatrixWorld(true)
      const meshes: Mesh[] = []
      scene.traverse((object) => { if (object instanceof Mesh && object.visible && object.userData.cadSurface) meshes.push(object) })
      const hit = ray.intersectObjects(meshes, false)[0]
      if (!hit?.face) { onError('Click a visible finished solid face. Cutters and section openings cannot be picked.'); return }
      const normal = hit.face.normal.clone().applyMatrix3(new Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize()
      onPick(faceWorkplane(hit.point, normal))
    }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { stop(event); onExit() } }
    canvas.addEventListener('pointerdown', stop, true)
    canvas.addEventListener('pointerup', stop, true)
    canvas.addEventListener('click', pick, true)
    window.addEventListener('keydown', key, true)
    return () => {
      canvas.removeEventListener('pointerdown', stop, true)
      canvas.removeEventListener('pointerup', stop, true)
      canvas.removeEventListener('click', pick, true)
      window.removeEventListener('keydown', key, true)
    }
  }, [enabled, camera, scene, gl, onPick, onExit, onError])
  return null
}

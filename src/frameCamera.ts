import { Box3, OrthographicCamera, PerspectiveCamera, Vector3 } from 'three'

export type FrameRequest = { sequence: number; scope: 'selection' | 'all' }

// A bounding sphere fits at any viewing angle, with a little space around the model.
export function frameCamera(camera: PerspectiveCamera | OrthographicCamera, bounds: Box3): Vector3 | null {
  if (bounds.isEmpty()) return null
  const center = bounds.getCenter(new Vector3())
  const radius = Math.max(bounds.getSize(new Vector3()).length() / 2, 0.5)
  const paddedRadius = radius * 1.15
  const direction = camera.getWorldDirection(new Vector3())
  let distance: number
  if (camera instanceof PerspectiveCamera) {
    const vertical = camera.getEffectiveFOV() * Math.PI / 360
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect)
    distance = paddedRadius / Math.sin(Math.min(vertical, horizontal))
  } else {
    camera.zoom = Math.min(camera.right - camera.left, camera.top - camera.bottom) / (2 * paddedRadius)
    distance = paddedRadius * 2
  }
  camera.position.copy(center).addScaledVector(direction, -distance)
  camera.near = Math.max(0.001, radius / 1000)
  camera.far = distance + radius * 100
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
  return center
}

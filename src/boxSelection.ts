import { fullyClipped } from './sectionView'
import { Camera, Matrix4, Mesh, Object3D, Vector4 } from 'three'

export type ScreenRectangle = { left: number; top: number; right: number; bottom: number }

export function screenRectangle(x1: number, y1: number, x2: number, y2: number): ScreenRectangle {
  return { left: Math.min(x1, x2), right: Math.max(x1, x2), top: Math.min(y1, y2), bottom: Math.max(y1, y2) }
}

export function projectedMeshBounds(mesh: Mesh, camera: Camera, width: number, height: number): ScreenRectangle | null {
  const geometry = mesh.geometry
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  if (!box || box.isEmpty() || width <= 0 || height <= 0) return null
  const matrix = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(mesh.matrixWorld)
  const corners = Array.from({ length: 8 }, (_, i) => new Vector4(
    i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z, 1,
  ).applyMatrix4(matrix))
  const projected: Vector4[] = []
  // Clip the twelve box edges to near/far before dividing by W. This also
  // handles shapes crossing the near plane without selecting objects behind us.
  for (let i = 0; i < 8; i++) for (const bit of [1, 2, 4]) {
    if (i & bit) continue
    let a = corners[i].clone(), b = corners[i | bit].clone()
    let visible = true
    for (const sign of [-1, 1]) {
      const fa = a.w + sign * a.z, fb = b.w + sign * b.z
      if (fa < 0 && fb < 0) { visible = false; break }
      if (fa < 0) a = a.clone().lerp(b, fa / (fa - fb))
      else if (fb < 0) b = a.clone().lerp(b, fa / (fa - fb))
    }
    if (visible) projected.push(a, b)
  }
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
  for (const point of projected) {
    if (point.w <= 0) continue
    const x = (point.x / point.w + 1) * width / 2
    const y = (1 - point.y / point.w) * height / 2
    left = Math.min(left, x); right = Math.max(right, x)
    top = Math.min(top, y); bottom = Math.max(bottom, y)
  }
  if (left > width || right < 0 || top > height || bottom < 0 || left === Infinity) return null
  return { left: Math.max(0, left), top: Math.max(0, top), right: Math.min(width, right), bottom: Math.min(height, bottom) }
}

export function boxSelectedIds(scene: Object3D, camera: Camera, rectangle: ScreenRectangle, width: number, height: number): string[] {
  const ids = new Set<string>()
  scene.updateMatrixWorld(true)
  camera.updateMatrixWorld()
  scene.traverseVisible((object) => {
    if (!(object instanceof Mesh) || typeof object.userData.cadObjectId !== 'string' || fullyClipped(object)) return
    const bounds = projectedMeshBounds(object, camera, width, height)
    if (bounds && bounds.left <= rectangle.right && bounds.right >= rectangle.left &&
      bounds.top <= rectangle.bottom && bounds.bottom >= rectangle.top) ids.add(object.userData.cadObjectId)
  })
  return [...ids]
}

import { Box3, Mesh, Plane, Vector3, type Intersection, type Raycaster } from 'three'
import type { Vector3 as Coordinates } from './cadModel'

export type SectionView = { enabled: boolean; axis: keyof Coordinates; position: number; flipped: boolean }
export const defaultSection: SectionView = { enabled: false, axis: 'y', position: 10, flipped: false }

export function sectionPlane(section: SectionView): Plane | null {
  if (!section.enabled || !Number.isFinite(section.position)) return null
  const normal = new Vector3(); normal[section.axis] = section.flipped ? -1 : 1
  return new Plane(normal, -section.position * normal[section.axis])
}

// Three's mesh raycast doesn't apply material clipping. Filter hits so removed
// surfaces don't intercept clicks on retained surfaces behind them.
export function clippedRaycast(this: Mesh, raycaster: Raycaster, hits: Intersection[]) {
  const candidates: Intersection[] = []
  Mesh.prototype.raycast.call(this, raycaster, candidates)
  const material = Array.isArray(this.material) ? this.material[0] : this.material
  const planes = material.clippingPlanes ?? []
  hits.push(...candidates.filter((hit) => planes.every((plane) => plane.distanceToPoint(hit.point) >= -1e-7)))
}

export function fullyClipped(mesh: Mesh): boolean {
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
  const planes = material.clippingPlanes
  if (!planes?.length) return false
  mesh.geometry.computeBoundingBox()
  if (!mesh.geometry.boundingBox) return false
  const bounds = new Box3().copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld)
  return planes.some((plane) => plane.distanceToPoint(new Vector3(
    plane.normal.x >= 0 ? bounds.max.x : bounds.min.x,
    plane.normal.y >= 0 ? bounds.max.y : bounds.min.y,
    plane.normal.z >= 0 ? bounds.max.z : bounds.min.z,
  )) < 0)
}

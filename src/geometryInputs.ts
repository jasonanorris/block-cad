import type { CadObject, SolidBody, Vector3 } from './cadModel'

const sameVector = (a: Vector3, b: Vector3) => a.x === b.x && a.y === b.y && a.z === b.z

// CAD objects and contour arrays are immutable in application state. Comparing
// payload references avoids serializing large meshes on every drag or color edit.
export function sameGeometryInput(a: CadObject, b: CadObject): boolean {
  if (a === b) return true
  if (a.id !== b.id || a.type !== b.type || !sameVector(a.position, b.position) ||
    !sameVector(a.rotation, b.rotation) || !sameVector(a.scale, b.scale)) return false
  const dimensionsA = Object.values(a.dimensions), dimensionsB = Object.values(b.dimensions)
  // Compare named fields, not object insertion order from imported JSON.
  if (dimensionsA.length !== dimensionsB.length || Object.entries(a.dimensions).some(([key, value]) =>
    value !== (b.dimensions as Record<string, number>)[key])) return false
  if (a.type === 'prism' && b.type === 'prism' && a.sides !== b.sides) return false
  if ((a.type === 'svg' || a.type === 'text') && (b.type === 'svg' || b.type === 'text') && a.contours !== b.contours) return false
  if (a.type === 'stl' && b.type === 'stl' && a.meshData !== b.meshData) return false
  return true
}

export function sameBodyGeometry(a: SolidBody, b: SolidBody): boolean {
  return a.anchor.id === b.anchor.id && a.anchor.joinMode === b.anchor.joinMode &&
    a.members.length === b.members.length && a.holes.length === b.holes.length &&
    a.members.every((object, index) => sameGeometryInput(object, b.members[index])) &&
    a.holes.every((object, index) => sameGeometryInput(object, b.holes[index]))
}

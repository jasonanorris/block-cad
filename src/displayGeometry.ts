import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three'

// Display-only normals. A 0.000001 mm key tolerance closes numeric seams
// without merging distinct small details (model units are millimeters).
// The crease angle keeps hard corners while averaging fine curved facets.
export function smoothDisplayGeometry(source: BufferGeometry, creaseAngle = 30): BufferGeometry {
  if (!Number.isFinite(creaseAngle) || creaseAngle < 1 || creaseAngle > 90) throw new Error('Crease angle must be 1–90 degrees.')
  const geometry = source.index ? source.toNonIndexed() : source.clone()
  const positions = geometry.getAttribute('position')
  const normals: Vector3[] = [], shared = new Map<string, number[]>()
  const keys: string[] = [], weights: number[] = []
  const a = new Vector3(), b = new Vector3(), c = new Vector3()
  const u = new Vector3(), v = new Vector3()
  for (let i = 0; i < positions.count; i += 3) {
    a.fromBufferAttribute(positions, i); b.fromBufferAttribute(positions, i + 1); c.fromBufferAttribute(positions, i + 2)
    const normal = new Vector3().crossVectors(u.subVectors(b, a), v.subVectors(c, a)).normalize()
    normals.push(normal)
    const points = [a, b, c]
    for (let j = 0; j < 3; j++) {
      const p = points[j], key = `${Math.round(p.x * 1e6)},${Math.round(p.y * 1e6)},${Math.round(p.z * 1e6)}`, index = i + j
      keys[index] = key
      u.subVectors(points[(j + 1) % 3], p); v.subVectors(points[(j + 2) % 3], p)
      weights[index] = u.lengthSq() && v.lengthSq() ? u.angleTo(v) : 0
      const entries = shared.get(key)
      if (entries) entries.push(index); else shared.set(key, [index])
    }
  }
  const result = new Float32Array(positions.count * 3), sum = new Vector3(), crease = Math.cos(creaseAngle * Math.PI / 180)
  for (let i = 0; i < positions.count; i++) {
    const face = normals[Math.floor(i / 3)]
    sum.set(0, 0, 0)
    for (const index of shared.get(keys[i])!) {
      const neighbor = normals[Math.floor(index / 3)]
      if (face.dot(neighbor) > crease) sum.addScaledVector(neighbor, weights[index])
    }
    if (!sum.lengthSq()) sum.copy(face)
    sum.normalize().toArray(result, i * 3)
  }
  geometry.setAttribute('normal', new Float32BufferAttribute(result, 3))
  return geometry
}

// Model data is plain and immutable. Skip shared geometry payloads and compare
// only changed branches, without allocating a serialized scene on every edit.
export function equalModelData(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => equalModelData(value, b[i]))
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>
  const keys = Object.keys(left).filter((key) => left[key] !== undefined)
  return keys.length === Object.keys(right).filter((key) => right[key] !== undefined).length && keys.every((key) => equalModelData(left[key], right[key]))
}

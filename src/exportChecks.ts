import type { Manifold, Mat4 } from 'manifold-3d'
import { getSolidBodies, type CadObject, type Vector3 } from './cadModel'
import { objectMatrix, readSolidManifold } from './booleanGeometry'
import { loadManifold } from './manifoldRuntime'

export type ExportReport = {
  dimensions: Vector3 | null
  bodyCount: number
  regions: number
  emptyBodies: string[]
  errors: string[]
  includesHidden: boolean
}

export async function inspectExport(objects: CadObject[]): Promise<ExportReport> {
  const report: ExportReport = { dimensions: null, bodyCount: 0, regions: 0, emptyBodies: [], errors: [], includesHidden: objects.some((o) => o.hidden) }
  const runtime = await loadManifold()
  const allocated: Manifold[] = []
  const solids: Manifold[] = []
  try {
    for (const [index, body] of getSolidBodies(objects).entries()) {
      const label = body.anchor.name ?? `${body.anchor.type} ${index + 1}`
      try {
        const world = readSolidManifold(body, runtime, (solid) => solid.transform(objectMatrix(body.anchor).elements as Mat4))
        allocated.push(world)
        if (world.status() !== 'NoError') throw new Error(`Geometry error: ${world.status()}.`)
        if (world.isEmpty() || world.volume() <= 0) report.emptyBodies.push(label)
        else solids.push(world)
      } catch (error) {
        report.errors.push(`${label}: ${error instanceof Error ? error.message : 'Could not calculate geometry.'}`)
      }
    }
    report.bodyCount = solids.length
    if (!solids.length) return report
    // Count physical regions after unioning overlaps, without modifying exported bodies.
    const united = runtime.Manifold.union(solids)
    allocated.push(united)
    if (united.status() !== 'NoError') throw new Error(`Could not check connected regions: ${united.status()}.`)
    const parts = united.decompose()
    allocated.push(...parts)
    // Negative-volume shells describe enclosed voids, not additional solid regions.
    report.regions = parts.filter((part) => part.volume() > 0).length
    const bounds = united.boundingBox()
    report.dimensions = { x: bounds.max[0] - bounds.min[0], y: bounds.max[1] - bounds.min[1], z: bounds.max[2] - bounds.min[2] }
    if (!Object.values(report.dimensions).every(Number.isFinite)) throw new Error('The model has invalid dimensions.')
    return report
  } finally {
    for (const solid of allocated) solid.delete()
  }
}

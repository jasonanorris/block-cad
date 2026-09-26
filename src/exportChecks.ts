import type { Manifold, Mat4 } from 'manifold-3d'
import { getObjectDimensions, getSolidBodies, type CadObject, type Vector3 } from './cadModel'
import { objectMatrix, readSolidManifold } from './booleanGeometry'
import { loadManifold } from './manifoldRuntime'

export type PrintSettings = { size: Vector3; minFeature: number }
export const defaultPrintSettings: PrintSettings = { size: { x: 220, y: 250, z: 220 }, minFeature: .8 }
export function validatePrintSettings(settings: PrintSettings) {
  if (!settings || !settings.size || !Object.values(settings.size).every((v) => Number.isFinite(v) && v >= .1 && v <= 10000) ||
    !['x', 'y', 'z'].every((axis) => axis in settings.size) || !Number.isFinite(settings.minFeature) || settings.minFeature < 0 || settings.minFeature > 100) {
    throw new Error('Print dimensions must be 0.1–10,000 mm and the small-feature threshold 0–100 mm.')
  }
}

export type ExportReport = {
  outsideVolume: string[]
  smallFeatures: string[]
  dimensions: Vector3 | null
  bodyCount: number
  regions: number
  emptyBodies: string[]
  errors: string[]
  includesHidden: boolean
}

export async function inspectExport(objects: CadObject[], settings: PrintSettings = defaultPrintSettings): Promise<ExportReport> {
  validatePrintSettings(settings)
  const report: ExportReport = { outsideVolume: [], smallFeatures: [], dimensions: null, bodyCount: 0, regions: 0, emptyBodies: [], errors: [], includesHidden: objects.some((o) => o.hidden) }
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
        else {
          solids.push(world)
          const bounds = world.boundingBox()
          if (bounds.min[0] < -settings.size.x / 2 - 1e-6 || bounds.max[0] > settings.size.x / 2 + 1e-6 ||
            bounds.min[2] < -settings.size.z / 2 - 1e-6 || bounds.max[2] > settings.size.z / 2 + 1e-6 ||
            bounds.min[1] < -1e-6 || bounds.max[1] > settings.size.y + 1e-6) report.outsideVolume.push(label)
          if (settings.minFeature > 0) for (const object of [...body.members, ...body.holes]) {
            const dimensions = getObjectDimensions(object)
            let feature = Math.min(dimensions.x, dimensions.y, dimensions.z)
            if (object.type === 'custom' && object.parameters.kind === 'tube') feature = Math.min(feature,
              object.parameters.wall * Math.min(Math.abs(object.scale.x), Math.abs(object.scale.z)))
            if (object.type === 'custom' && object.parameters.kind === 'bracket') feature = Math.min(feature,
              object.parameters.wall * Math.min(Math.abs(object.scale.x), Math.abs(object.scale.y)))
            if (feature < settings.minFeature) report.smallFeatures.push(`${object.name || object.type}: source feature ${Number(feature.toFixed(3))} mm`)
          }
        }
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
    const positiveParts = parts.filter((part) => part.volume() > 0)
    report.regions = positiveParts.length
    if (settings.minFeature > 0) positiveParts.forEach((part, index) => {
      const bounds = part.boundingBox(), smallest = Math.min(...bounds.max.map((value, axis) => value - bounds.min[axis]))
      if (smallest < settings.minFeature) report.smallFeatures.push(`Region ${index + 1}: narrow bounds ${Number(smallest.toFixed(3))} mm`)
    })
    report.smallFeatures = [...new Set(report.smallFeatures)]
    const bounds = united.boundingBox()
    report.dimensions = { x: bounds.max[0] - bounds.min[0], y: bounds.max[1] - bounds.min[1], z: bounds.max[2] - bounds.min[2] }
    if (!Object.values(report.dimensions).every(Number.isFinite)) throw new Error('The model has invalid dimensions.')
    return report
  } finally {
    for (const solid of allocated) solid.delete()
  }
}

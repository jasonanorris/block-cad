import { getSolidBodies, type CadObject } from './cadModel'
import { curveQuality, type CurveQuality } from './curveQuality'
import { rebuildMeshQuality } from './edgeFeatures'

export function qualityTargets(objects: CadObject[]) {
  const locked = new Set(getSolidBodies(objects).filter(b => [...b.members, ...b.holes].some(o => o.locked)).flatMap(b => [...b.members, ...b.holes].map(o => o.id)))
  return objects.filter((o): o is Extract<CadObject, { type: 'stl' }> => o.type === 'stl' && !o.locked && !locked.has(o.id) && !!(o.analyticHistory?.features.length || o.edgeHistory?.features.length))
}
export async function rebuildProjectQuality(objects: CadObject[], quality: CurveQuality): Promise<CadObject[]> {
  curveQuality(quality)
  const replacements = new Map<string, CadObject>()
  for (const object of qualityTargets(objects)) {
    try {
      replacements.set(object.id, object.analyticHistory
        ? await (await import('./analyticFeatures')).rebuildAnalyticQuality(object, quality)
        : await rebuildMeshQuality(object, quality))
    } catch (error) { throw new Error(`${object.name || object.id}: ${error instanceof Error ? error.message : 'Could not rebuild features.'} No bodies were changed.`) }
  }
  return objects.map(o => replacements.get(o.id) ?? o)
}

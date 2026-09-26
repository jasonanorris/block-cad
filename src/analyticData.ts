import { validateEdgeFeatures, type EdgeFeature } from './edgeFeatureData'
export type AnalyticHistory = { kernel: 'occt'; baseBrep: string; features: EdgeFeature[] }
export const MAX_BREP_BYTES = 10_000_000

export function validateAnalyticHistory(value: unknown): AnalyticHistory {
  if (!value || typeof value !== 'object') throw new Error('Invalid analytic history.')
  const data = value as Record<string, unknown>
  if (data.kernel !== 'occt' || typeof data.baseBrep !== 'string' || data.baseBrep.length > MAX_BREP_BYTES || !data.baseBrep.includes('CASCADE Topology')) throw new Error('Invalid analytic starting body.')
  return { kernel: 'occt', baseBrep: data.baseBrep, features: validateEdgeFeatures(data.features, true) }
}

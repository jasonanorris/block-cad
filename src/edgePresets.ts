import { curveQuality, type CurveQuality } from './curveQuality'
import type { EdgeOperation } from './edgeFeatureData'
export type EdgePreset = { name: string; operation: EdgeOperation; size: number; quality: CurveQuality }
export const EDGE_PRESETS_KEY = 'block-cad-edge-presets-v1'
export function validateEdgePreset(value: unknown): EdgePreset {
  const p = value as Partial<EdgePreset> | null
  if (!p || typeof p.name !== 'string' || !p.name.trim() || p.name.trim().length > 60) throw new Error('Use a preset name of 1–60 characters.')
  if (p.operation !== 'fillet' && p.operation !== 'chamfer') throw new Error('Invalid preset operation.')
  if (typeof p.size !== 'number' || !Number.isFinite(p.size) || p.size < .01 || p.size > 10000) throw new Error('Preset size must be 0.01–10,000 mm.')
  return { name: p.name.trim(), operation: p.operation, size: p.size, quality: curveQuality(p.quality) }
}
export function parseEdgePresets(text: string | null): EdgePreset[] {
  if (!text) return []
  const data: unknown = JSON.parse(text)
  if (!Array.isArray(data) || data.length > 20) throw new Error('Invalid saved edge presets.')
  const presets = data.map(validateEdgePreset)
  if (new Set(presets.map(p => p.name.toLowerCase())).size !== presets.length) throw new Error('Saved preset names must be unique.')
  return presets
}
export function saveEdgePreset(presets: EdgePreset[], value: EdgePreset): EdgePreset[] {
  const preset = validateEdgePreset(value), remaining = presets.filter(p => p.name.toLowerCase() !== preset.name.toLowerCase())
  if (remaining.length >= 20) throw new Error('You can save up to 20 presets. Delete one first.')
  return [...remaining, preset]
}

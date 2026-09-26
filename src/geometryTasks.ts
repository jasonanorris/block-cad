import type { CadObject } from './cadModel'
import type { measureSelection } from './measurements'
import type { selectionReference } from './referenceOrigin'
import type { splitSelection } from './splitSelection'
import type { ExportReport, PrintSettings } from './exportChecks'

import type { FeatureEdge, EdgeOperation, previewEdgeFeature } from './edgeFeatures'

export type GeometryTasks = {
  edges: { input: { objects: CadObject[]; ids: string[] }; output: FeatureEdge[] }
  edgePreview: { input: { objects: CadObject[]; ids: string[]; edges: FeatureEdge[]; operation: EdgeOperation; size: number }; output: Awaited<ReturnType<typeof previewEdgeFeature>> }
  edgeEdit: { input: { objects: CadObject[]; ids: string[]; featureId: string; change: { operation: EdgeOperation; size: number } | null }; output: Awaited<ReturnType<typeof previewEdgeFeature>> }
  measure: { input: { objects: CadObject[]; ids: string[]; activeId: string | null }; output: Awaited<ReturnType<typeof measureSelection>> }
  reference: { input: { objects: CadObject[]; ids: string[]; edge: 'min' | 'center' | 'max' }; output: Awaited<ReturnType<typeof selectionReference>> }
  inspect: { input: { objects: CadObject[]; settings: PrintSettings }; output: ExportReport }
  export: { input: { objects: CadObject[]; format: 'stl' | '3mf' }; output: ArrayBuffer }
  split: { input: { objects: CadObject[]; ids: string[]; axis: 'x' | 'y' | 'z'; position: number }; output: Awaited<ReturnType<typeof splitSelection>> }
}
export type GeometryKind = keyof GeometryTasks
export type GeometryRequest = { [K in GeometryKind]: { id: number; kind: K; input: GeometryTasks[K]['input'] } }[GeometryKind]
export type GeometryResponse = { id: number; result?: GeometryTasks[GeometryKind]['output']; error?: string }

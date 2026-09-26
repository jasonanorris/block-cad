import { findFeatureEdges, previewEdgeFeature, editEdgeFeature } from './edgeFeatures'
import { measureSelection } from './measurements'
import { selectionReference } from './referenceOrigin'
import { inspectExport } from './exportChecks'
import { splitSelection } from './splitSelection'
import { exportStl } from './stlExport'
import { export3mf } from './threeMfExport'
import type { GeometryRequest, GeometryResponse } from './geometryTasks'

const worker = globalThis as unknown as { onmessage: ((event: MessageEvent<GeometryRequest>) => void) | null;
  postMessage: (result: GeometryResponse, transfer?: Transferable[]) => void }
worker.onmessage = async ({ data }) => {
  try {
    let result: GeometryResponse['result']
    switch (data.kind) {
      case 'edges': result = data.input.advanced ? await (await import('./analyticFeatures')).findAnalyticEdges(data.input.objects, data.input.ids) : await findFeatureEdges(data.input.objects, data.input.ids); break
      case 'edgePreview': result = data.input.advanced ? await (await import('./analyticFeatures')).previewAnalyticFeature(data.input.objects, data.input.ids, data.input.edges, data.input.operation, data.input.size) : await previewEdgeFeature(data.input.objects, data.input.ids, data.input.edges, data.input.operation, data.input.size); break
      case 'edgeEdit': result = data.input.advanced ? await (await import('./analyticFeatures')).editAnalyticFeature(data.input.objects, data.input.ids, data.input.featureId, data.input.change) : await editEdgeFeature(data.input.objects, data.input.ids, data.input.featureId, data.input.change); break
      case 'measure': result = await measureSelection(data.input.objects, data.input.ids, data.input.activeId); break
      case 'reference': result = await selectionReference(data.input.objects, new Set(data.input.ids), data.input.edge); break
      case 'inspect': result = await inspectExport(data.input.objects, data.input.settings); break
      case 'split': result = await splitSelection(data.input.objects, new Set(data.input.ids), data.input.axis, data.input.position); break
      case 'export': result = await (data.input.format === 'stl' ? exportStl(data.input.objects) : export3mf(data.input.objects)); break
    }
    worker.postMessage({ id: data.id, result }, result instanceof ArrayBuffer ? [result] : [])
  } catch (error) { worker.postMessage({ id: data.id, error: error instanceof Error ? error.message : 'Geometry operation failed.' }) }
}

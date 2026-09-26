import { buildSolidGeometry } from './booleanGeometry'
import { loadManifold } from './manifoldRuntime'
import { packPreview, type PreviewRequest, type PreviewResponse } from './previewProtocol'

const worker = globalThis as unknown as {
  onmessage: ((event: MessageEvent<PreviewRequest>) => void) | null
  postMessage: (result: PreviewResponse, transfer?: Transferable[]) => void
}
worker.onmessage = async ({ data }) => {
  try {
    const geometry = buildSolidGeometry(data.body, await loadManifold())
    try {
      const mesh = packPreview(geometry)
      worker.postMessage({ sequence: data.sequence, mesh }, [mesh.positions.buffer, mesh.normals.buffer, mesh.indices.buffer])
    } finally { geometry.dispose() }
  } catch (error) {
    worker.postMessage({ sequence: data.sequence, error: error instanceof Error ? error.message : 'Preview calculation failed.' })
  }
}

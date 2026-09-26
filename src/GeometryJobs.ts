import type { GeometryKind, GeometryRequest, GeometryResponse, GeometryTasks } from './geometryTasks'

export type GeometryWorker = { onmessage: ((event: MessageEvent<GeometryResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null; postMessage: (request: GeometryRequest) => void; terminate: () => void }

// Each consumer owns one reusable worker. Cancellation terminates synchronous
// WASM as well as queued work; cancelled replies cannot reach the consumer.
export class GeometryJobs {
  private worker: GeometryWorker | null = null
  private sequence = 0
  private pending: { id: number; resolve: (value: unknown) => void; reject: (reason: Error) => void; cleanup: () => void } | null = null
  constructor(private createWorker: () => GeometryWorker = () => new Worker(new URL('./geometryTask.worker.ts', import.meta.url), { type: 'module' })) {}

  run<K extends GeometryKind>(kind: K, input: GeometryTasks[K]['input'], signal?: AbortSignal): Promise<GeometryTasks[K]['output']> {
    this.cancel()
    if (signal?.aborted) return Promise.reject(new DOMException('Operation cancelled.', 'AbortError'))
    return new Promise((resolve, reject) => {
      const id = ++this.sequence
      const abort = () => this.cancel()
      const timer = setTimeout(() => this.stop(new Error('Geometry operation exceeded 60 seconds. Simplify the model and retry.')), 60_000)
      const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
      this.pending = { id, resolve: (value) => resolve(value as GeometryTasks[K]['output']), reject, cleanup }
      signal?.addEventListener('abort', abort, { once: true })
      try {
        if (!this.worker) {
          const worker = this.createWorker(); this.worker = worker
          worker.onmessage = ({ data }) => {
            if (this.worker !== worker || data.id !== this.pending?.id) return
            const pending = this.pending; this.pending = null; pending.cleanup()
            if (data.error) pending.reject(new Error(data.error)); else pending.resolve(data.result)
          }
          worker.onerror = (event) => { event.preventDefault?.(); if (this.worker === worker) this.stop(new Error('Background geometry failed. Retry the operation.')) }
        }
        this.worker.postMessage({ id, kind, input } as GeometryRequest)
      } catch (error) { this.stop(error instanceof Error ? error : new Error('Could not start background geometry.')) }
    })
  }
  private stop(error: Error) {
    this.worker?.terminate(); this.worker = null
    const pending = this.pending; this.pending = null
    if (pending) { pending.cleanup(); pending.reject(error) }
  }
  cancel() { if (this.pending) this.stop(new DOMException('Operation cancelled.', 'AbortError')) }
  dispose() { this.stop(new DOMException('Operation cancelled.', 'AbortError')) }
}

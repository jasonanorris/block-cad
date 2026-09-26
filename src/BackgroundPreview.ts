import type { BufferGeometry } from 'three'
import { getSolidBodies, type CadObject, type SolidBody } from './cadModel'
import { sameBodyGeometry } from './geometryInputs'
import { unpackPreview, type PreviewRequest, type PreviewResponse } from './previewProtocol'

export type BackgroundPreviewState = { geometries: Map<string, BufferGeometry>; error: string | null; pending: number }
export type PreviewWorker = {
  onmessage: ((event: MessageEvent<PreviewResponse>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  postMessage: (request: PreviewRequest) => void
  terminate: () => void
}

// One request in flight. Changes are coalesced to the latest desired body,
// retaining geometry only while it still matches the current model exactly.
export class BackgroundPreview {
  private desired = new Map<string, SolidBody>()
  private ready = new Map<string, { body: SolidBody; geometry: BufferGeometry }>()
  private failed = new Map<string, { body: SolidBody; error: string }>()
  private flight: { sequence: number; body: SolidBody } | null = null
  private worker: PreviewWorker | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private sequence = 0
  private disposed = false
  constructor(private publish: (preview: BackgroundPreviewState) => void,
    private createWorker: () => PreviewWorker = () => new Worker(new URL('./booleanPreview.worker.ts', import.meta.url), { type: 'module' })) {}

  update(objects: CadObject[]) {
    if (this.disposed) return
    this.desired = new Map(getSolidBodies(objects).filter((body) => body.members.length > 1 || body.holes.length)
      .map((body) => [body.anchor.id, body]))
    for (const [id, entry] of this.ready) {
      const wanted = this.desired.get(id)
      if (!wanted || !sameBodyGeometry(wanted, entry.body)) { entry.geometry.dispose(); this.ready.delete(id) }
    }
    for (const [id, entry] of this.failed) {
      const wanted = this.desired.get(id)
      if (!wanted || !sameBodyGeometry(wanted, entry.body)) this.failed.delete(id)
    }
    if (!this.desired.size) this.stopWorker()
    this.emit(); this.pump()
  }

  retry() { if (!this.disposed) { this.failed.clear(); this.emit(); this.pump() } }

  private emit() {
    if (this.disposed) return
    this.publish({ geometries: new Map([...this.ready].map(([id, entry]) => [id, entry.geometry])),
      error: [...this.failed.values()].map((entry) => `${entry.body.anchor.name || entry.body.anchor.type}: ${entry.error}`).join(' ') || null,
      pending: [...this.desired.keys()].filter((id) => !this.ready.has(id) && !this.failed.has(id)).length })
  }

  private pump() {
    if (this.disposed || this.flight) return
    const body = [...this.desired.values()].find((body) => !this.ready.has(body.anchor.id) && !this.failed.has(body.anchor.id))
    if (!body) return
    try {
      if (!this.worker) {
        const worker = this.createWorker()
        this.worker = worker
        worker.onmessage = ({ data }) => { if (this.worker === worker) this.receive(data) }
        worker.onerror = (event) => { event.preventDefault?.(); if (this.worker === worker) this.failWorker('Background preview failed. Retry previews to restart it.') }
      }
      this.flight = { sequence: ++this.sequence, body }
      this.timer = setTimeout(() => this.failWorker('Preview exceeded 30 seconds. Simplify the body or retry previews.'), 30_000)
      this.worker.postMessage(this.flight)
    } catch (error) { this.failWorker(error instanceof Error ? error.message : 'Background previews are unavailable.') }
  }

  private receive(result: PreviewResponse) {
    if (!this.flight || result.sequence !== this.flight.sequence) return
    const { body } = this.flight
    clearTimeout(this.timer); this.flight = null
    const wanted = this.desired.get(body.anchor.id)
    if (wanted && sameBodyGeometry(wanted, body)) {
      if (result.mesh) this.ready.set(body.anchor.id, { body: wanted, geometry: unpackPreview(result.mesh) })
      else this.failed.set(body.anchor.id, { body: wanted, error: result.error || 'Preview returned no geometry.' })
    }
    this.emit(); this.pump()
  }

  private stopWorker() {
    clearTimeout(this.timer)
    this.worker?.terminate(); this.worker = null; this.flight = null
  }

  private failWorker(message: string) {
    this.stopWorker()
    for (const [id, body] of this.desired) if (!this.ready.has(id)) this.failed.set(id, { body, error: message })
    this.emit()
  }

  dispose() {
    this.disposed = true; this.stopWorker()
    for (const entry of this.ready.values()) entry.geometry.dispose()
    this.ready.clear(); this.desired.clear(); this.failed.clear()
  }
}

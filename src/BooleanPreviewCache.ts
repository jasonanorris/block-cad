import type { BufferGeometry } from 'three'
import type { ManifoldToplevel } from 'manifold-3d'
import { getSolidBodies, type CadObject, type SolidBody } from './cadModel'
import { buildSolidGeometry } from './booleanGeometry'
import { sameBodyGeometry } from './geometryInputs'

export type Preview = { geometries: Map<string, BufferGeometry>; error: string | null }

export class BooleanPreviewCache {
  private entries = new Map<string, { body: SolidBody; geometry: BufferGeometry }>()
  private preview: Preview = { geometries: new Map(), error: null }
  constructor(private build = buildSolidGeometry) {}

  update(objects: CadObject[], runtime: ManifoldToplevel): Preview {
    const next = new Map<string, { body: SolidBody; geometry: BufferGeometry }>()
    const errors: string[] = []
    for (const body of getSolidBodies(objects)) {
      if (body.members.length === 1 && !body.holes.length) continue
      const previous = this.entries.get(body.anchor.id)
      try {
        const geometry = previous && sameBodyGeometry(previous.body, body) ? previous.geometry : this.build(body, runtime)
        next.set(body.anchor.id, { body, geometry })
      } catch (error) {
        errors.push(`${body.anchor.name || body.anchor.type}: ${error instanceof Error ? error.message : 'Geometry calculation failed.'}`)
      }
    }
    for (const [id, entry] of this.entries) if (next.get(id)?.geometry !== entry.geometry) entry.geometry.dispose()
    this.entries = next
    const error = errors.length ? errors.join(' ') : null
    if (error !== this.preview.error || next.size !== this.preview.geometries.size ||
      [...next].some(([id, entry]) => this.preview.geometries.get(id) !== entry.geometry)) {
      this.preview = { geometries: new Map([...next].map(([id, entry]) => [id, entry.geometry])), error }
    }
    return this.preview
  }

  clear(): Preview {
    for (const entry of this.entries.values()) entry.geometry.dispose()
    this.entries.clear()
    this.preview = { geometries: new Map(), error: null }
    return this.preview
  }
}

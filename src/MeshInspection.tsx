import { useEffect, useMemo, useRef, useState } from 'react'
import type { BufferGeometry } from 'three'
import { getSolidBodies, type CadObject } from './cadModel'
import { createSourceGeometry } from './sourceGeometry'
import { CURVE_QUALITIES, type CurveQuality } from './curveQuality'
import { GeometryJobs } from './GeometryJobs'
import { qualityTargets } from './rebuildQuality'

export default function MeshInspection({ objects, selectedIds, geometries, disabled, onApply }: {
  objects: CadObject[]; selectedIds: string[]; geometries: Map<string, BufferGeometry>; disabled: boolean
  onApply: (source: CadObject[], result: CadObject[]) => void
}) {
  const jobs = useMemo(() => new GeometryJobs(), [])
  const generation = useRef(0)
  const [quality, setQuality] = useState<CurveQuality>('fine')
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  const cancel = () => { generation.current++; jobs.cancel(); setBusy(false) }
  useEffect(() => { cancel(); setMessage('') }, [objects, disabled])
  useEffect(() => () => { generation.current++; jobs.dispose() }, [jobs])
  const targets = useMemo(() => qualityTargets(objects), [objects])
  const stats = useMemo(() => {
    const ids = new Set(selectedIds)
    const bodies = getSolidBodies(objects).filter(b => b.members.some(o => ids.has(o.id)))
    let triangles = 0, pending = false
    for (const body of bodies) {
      const cached = geometries.get(body.anchor.id)
      if (!cached && (body.members.length > 1 || body.holes.length)) { pending = true; continue }
      const geometry = cached ?? createSourceGeometry(body.anchor)
      try { triangles += (geometry.index?.count ?? geometry.getAttribute('position').count) / 3 }
      finally { if (!cached) geometry.dispose() }
    }
    return { bodies: bodies.length, triangles, pending }
  }, [objects, selectedIds, geometries])
  async function rebuild() {
    const current = ++generation.current; setBusy(true); setMessage('')
    try {
      const result = await jobs.run('rebuildQuality', { objects, quality })
      if (current !== generation.current) return
      onApply(objects, result)
    } catch (error) { if (current === generation.current) setMessage(error instanceof Error ? error.message : 'Could not rebuild features.') }
    finally { if (current === generation.current) setBusy(false) }
  }
  return <details className="repeat-tools"><summary>Mesh inspection &amp; quality</summary>
    <p aria-label="Selected mesh statistics">{!stats.bodies ? 'Select a solid body to inspect its mesh.' : stats.pending ? 'Calculating selected mesh…' : `${stats.bodies} selected ${stats.bodies === 1 ? 'body' : 'bodies'} · ${stats.triangles.toLocaleString()} triangles · ${(stats.triangles * 36 / 1024).toFixed(1)} KiB triangle positions`}</p>
    <p className="selection-hint">Position data only; saved files, normals, and display buffers use additional space. Counts describe committed bodies.</p>
    <label>All fillet/edge histories<select aria-label="Rebuild all curve quality" value={quality} disabled={busy} onChange={e => setQuality(e.target.value as CurveQuality)}>
      {Object.entries(CURVE_QUALITIES).map(([value, option]) => <option value={value} key={value}>{option.label}</option>)}
    </select></label>
    <p className="selection-hint">Rebuilds every edge feature on {targets.length} unlocked bodies, including hidden bodies. Locked assemblies and shapes without editable edge history are skipped. One Undo restores the whole change. A failed rebuild changes nothing.</p>
    <button type="button" disabled={disabled || busy || !targets.length} onClick={() => void rebuild()}>Rebuild all edge quality</button>
    {busy && <><p role="status">Rebuilding edge histories…</p><button type="button" onClick={cancel}>Cancel rebuild</button></>}
    {message && <p role="alert">{message}</p>}
  </details>
}

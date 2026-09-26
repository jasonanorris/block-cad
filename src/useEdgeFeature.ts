import { useEffect, useMemo, useRef, useState } from 'react'
import type { CadObject } from './cadModel'
import { GeometryJobs } from './GeometryJobs'
import type { EdgeOperation, FeatureEdge, previewEdgeFeature } from './edgeFeatures'

type Preview = Awaited<ReturnType<typeof previewEdgeFeature>>
export function useEdgeFeature(objects: CadObject[], ids: string[], onBegin: () => void, onApply: (preview: Preview) => void) {
  const jobs = useMemo(() => new GeometryJobs(), [])
  const generation = useRef(0)
  const [edges, setEdges] = useState<FeatureEdge[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [operation, setOperation] = useState<EdgeOperation>('fillet')
  const [size, setSize] = useState('2')
  const [previewState, setPreviewState] = useState<{ objects: CadObject[]; ids: string[]; result: Preview } | null>(null)
  const preview = previewState?.objects === objects && previewState.ids === ids ? previewState.result : null
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  function cancel() { generation.current++; jobs.cancel(); setEdges([]); setSelected(null); setPreviewState(null); setBusy(false); setError('') }
  useEffect(() => { cancel() }, [objects, ids]) // A pick/preview belongs only to this model and selection.
  useEffect(() => () => { generation.current++; jobs.dispose() }, [jobs])
  useEffect(() => {
    if (!busy || edges.length) return
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); cancel() } }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [busy, edges.length])
  function invalidate() { generation.current++; jobs.cancel(); setPreviewState(null); setBusy(false); setError('') }
  async function start() {
    cancel(); onBegin(); const current = ++generation.current; setBusy(true)
    try { const result = await jobs.run('edges', { objects, ids }); if (current === generation.current) setEdges(result) }
    catch (reason) { if (current === generation.current) setError(reason instanceof Error ? reason.message : 'Could not find edges.') }
    finally { if (current === generation.current) setBusy(false) }
  }
  async function calculate() {
    if (selected === null) return
    invalidate(); const current = ++generation.current; setBusy(true)
    try {
      const result = await jobs.run('edgePreview', { objects, ids, edge: edges[selected], operation, size: size.trim() ? Number(size) : NaN })
      if (current === generation.current) setPreviewState({ objects, ids, result })
    } catch (reason) { if (current === generation.current) setError(reason instanceof Error ? reason.message : 'Could not preview this edge.') }
    finally { if (current === generation.current) setBusy(false) }
  }
  return { edges, selected, operation, size, preview, busy, error, start, cancel, calculate,
    pick: (index: number) => { invalidate(); setSelected(index) },
    setOperation: (value: EdgeOperation) => { invalidate(); setOperation(value) },
    setSize: (value: string) => { invalidate(); setSize(value) },
    apply: () => { if (preview && !busy) { onApply(preview); cancel() } },
  }
}
export type EdgeFeatureController = ReturnType<typeof useEdgeFeature>

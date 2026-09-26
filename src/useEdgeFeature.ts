import { useEffect, useMemo, useRef, useState } from 'react'
import type { CadObject } from './cadModel'
import { GeometryJobs } from './GeometryJobs'
import type { EdgeFeature } from './edgeFeatureData'
import type { EdgeOperation, FeatureEdge, previewEdgeFeature } from './edgeFeatures'

type Preview = Awaited<ReturnType<typeof previewEdgeFeature>>
export function useEdgeFeature(objects: CadObject[], ids: string[], onBegin: () => void, onApply: (preview: Preview) => void) {
  const jobs = useMemo(() => new GeometryJobs(), [])
  const generation = useRef(0)
  const [edges, setEdges] = useState<FeatureEdge[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [editing, setEditing] = useState<string | null>(null), [removing, setRemoving] = useState(false)
  const [operation, setOperation] = useState<EdgeOperation>('fillet')
  const [size, setSize] = useState('2')
  const [previewState, setPreviewState] = useState<{ objects: CadObject[]; ids: string[]; result: Preview } | null>(null)
  const preview = previewState?.objects === objects && previewState.ids === ids ? previewState.result : null
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const target = ids.length === 1 ? objects.find((object) => object.id === ids[0]) : undefined
  const features = target?.type === 'stl' ? target.edgeHistory?.features ?? [] : []
  function cancel() { generation.current++; jobs.cancel(); setEdges([]); setSelected([]); setEditing(null); setRemoving(false); setPreviewState(null); setBusy(false); setError('') }
  useEffect(() => { cancel() }, [objects, ids])
  useEffect(() => () => { generation.current++; jobs.dispose() }, [jobs])
  function invalidate() { generation.current++; jobs.cancel(); setPreviewState(null); setBusy(false); setError('') }
  async function start() {
    cancel(); onBegin(); const current = ++generation.current; setBusy(true)
    try { const result = await jobs.run('edges', { objects, ids }); if (current === generation.current) setEdges(result) }
    catch (reason) { if (current === generation.current) setError(reason instanceof Error ? reason.message : 'Could not find edges.') }
    finally { if (current === generation.current) setBusy(false) }
  }
  function edit(feature: EdgeFeature, remove = false) {
    cancel(); onBegin(); setEditing(feature.id); setOperation(feature.operation); setSize(String(feature.size)); setRemoving(remove)
  }
  async function calculate() {
    if (!editing && !selected.length) return
    invalidate(); const current = ++generation.current; setBusy(true)
    const value = size.trim() ? Number(size) : NaN
    try {
      const result = editing
        ? await jobs.run('edgeEdit', { objects, ids, featureId: editing, change: removing ? null : { operation, size: value } })
        : await jobs.run('edgePreview', { objects, ids, edges: selected.map((index) => edges[index]), operation, size: value })
      if (current === generation.current) setPreviewState({ objects, ids, result })
    } catch (reason) { if (current === generation.current) setError(reason instanceof Error ? reason.message : 'Could not preview these edges.') }
    finally { if (current === generation.current) setBusy(false) }
  }
  return { edges, selected, operation, size, preview, busy, error, features, editing, removing,
    active: edges.length > 0 || !!editing || busy, start, cancel, calculate, edit,
    pick: (index: number) => { invalidate(); setSelected((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index]) },
    clearSelection: () => { invalidate(); setSelected([]) },
    setOperation: (value: EdgeOperation) => { invalidate(); setOperation(value) },
    setSize: (value: string) => { invalidate(); setSize(value) },
    apply: () => { if (preview && !busy) { onApply(preview); cancel() } },
  }
}
export type EdgeFeatureController = ReturnType<typeof useEdgeFeature>

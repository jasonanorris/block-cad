import { extendEdgeSelection, type EdgeSelectionShortcut } from './edgeSelection'
import { curveQuality, type CurveQuality } from './curveQuality'
import { EdgeBuildError } from './edgeDiagnostics'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CadObject } from './cadModel'
import { GeometryJobs } from './GeometryJobs'
import { MAX_FEATURE_EDGES, type EdgeFeature } from './edgeFeatureData'
import type { EdgeOperation, FeatureEdge } from './edgeFeatures'

import type { EdgePreview as Preview } from './geometryTasks'
export function useEdgeFeature(objects: CadObject[], ids: string[], onBegin: () => void, onApply: (preview: Preview) => void) {
  const jobs = useMemo(() => new GeometryJobs(), [])
  const generation = useRef(0)
  const [edges, setEdges] = useState<FeatureEdge[]>([])
  const [editingEdges, setEditingEdges] = useState<FeatureEdge[]>([])
  const [focusedEdge, setFocusedEdge] = useState<number | null>(null)
  const [failedKeys, setFailedKeys] = useState<string[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [editing, setEditing] = useState<string | null>(null), [removing, setRemoving] = useState(false)
  const [operation, setOperation] = useState<EdgeOperation>('fillet')
  const [quality, setQuality] = useState<CurveQuality>('fine')
  const [size, setSize] = useState('2')
  const [preferAdvanced, setPreferAdvanced] = useState(false)
  const [edgeSizes, setEdgeSizes] = useState<Record<number, string>>({})
  const [previewState, setPreviewState] = useState<{ objects: CadObject[]; ids: string[]; result: Preview } | null>(null)
  const preview = previewState?.objects === objects && previewState.ids === ids ? previewState.result : null
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const target = ids.length === 1 ? objects.find((object) => object.id === ids[0]) : undefined
  const advanced = target?.type === 'stl' && target.analyticHistory ? true : preferAdvanced
  const analyticBody = target?.type === 'stl' && !!target.analyticHistory
  const features = target?.type === 'stl' ? (advanced ? target.analyticHistory?.features : target.edgeHistory?.features) ?? [] : []
  function cancel() { generation.current++; jobs.cancel(); setEdges([]); setSelected([]); setEditing(null); setRemoving(false); setPreviewState(null); setBusy(false); setError(''); setEdgeSizes({}); setEditingEdges([]); setFocusedEdge(null); setFailedKeys([]) }
  useEffect(() => { cancel() }, [objects, ids])
  useEffect(() => () => { generation.current++; jobs.dispose() }, [jobs])
  function invalidate() { generation.current++; jobs.cancel(); setPreviewState(null); setBusy(false); setError(''); setFailedKeys([]) }
  async function start() {
    cancel(); onBegin(); const current = ++generation.current; setBusy(true)
    try { const result = await jobs.run('edges', { objects, ids, advanced }); if (current === generation.current) setEdges(result) }
    catch (reason) { if (current === generation.current) setError(reason instanceof Error ? reason.message : 'Could not find edges.') }
    finally { if (current === generation.current) setBusy(false) }
  }
  async function edit(feature: EdgeFeature, remove = false) {
    cancel(); onBegin(); setEditing(feature.id); setOperation(feature.operation); setQuality(curveQuality(feature.quality)); setSize(String(feature.size)); setRemoving(remove); setEdgeSizes(Object.fromEntries(feature.edges.map((edge, index) => [index, edge.size === undefined ? '' : String(edge.size)])))
    if (advanced && !remove) {
      const current = ++generation.current; setBusy(true)
      try { const result = await jobs.run('edges', { objects, ids, advanced: true, featureId: feature.id }); if (current === generation.current) setEditingEdges(result) }
      catch (reason) { if (current === generation.current) setError(reason instanceof Error ? reason.message : 'Could not locate feature edges.') }
      finally { if (current === generation.current) setBusy(false) }
    }
  }
  async function calculate() {
    if (!editing && !selected.length) return
    invalidate(); const current = ++generation.current; setBusy(true)
    const value = size.trim() ? Number(size) : NaN
    try {
      const result = editing
        ? await jobs.run('edgeEdit', { objects, ids, advanced, featureId: editing, change: removing ? null : { operation, quality, size: value, ...(advanced ? { sizes: features.find(f => f.id === editing)!.edges.map((_, i) => edgeSizes[i]?.trim() ? Number(edgeSizes[i]) : null) } : {}) } })
        : await jobs.run('edgePreview', { objects, ids, edges: selected.map((index) => ({ ...edges[index], ...(advanced && edgeSizes[index]?.trim() ? { size: Number(edgeSizes[index]) } : {}) })), operation, quality, size: value, advanced })
      if (current === generation.current) setPreviewState({ objects, ids, result })
    } catch (reason) { if (current === generation.current) { setError(reason instanceof Error ? reason.message : 'Could not preview these edges.'); setFailedKeys(reason instanceof EdgeBuildError ? reason.edgeKeys : []) } }
    finally { if (current === generation.current) setBusy(false) }
  }
  const displayEdges = editing ? editingEdges : edges
  return { edges, displayEdges, focusedEdge, setFocusedEdge, failedKeys, selected, operation, quality, size, advanced, analyticBody, edgeSizes,
    setAdvanced: (value: boolean) => { cancel(); setPreferAdvanced(value) },
    setEdgeSize: (index: number, value: string) => { invalidate(); setEdgeSizes(current => ({ ...current, [index]: value })) }, preview, busy, error, features, editing, removing,
    active: edges.length > 0 || !!editing || busy, start, cancel, calculate, edit,
    pick: (index: number) => { if (editing) { setFocusedEdge(index); return }; invalidate(); setSelected((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index]) },
    extendSelection: (mode: EdgeSelectionShortcut) => { invalidate(); try { setSelected(extendEdgeSelection(edges, selected, mode)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not extend selection.') } },
    applyPreset: (preset: { operation: EdgeOperation; size: number; quality: CurveQuality }) => { invalidate(); setOperation(preset.operation); setSize(String(preset.size)); setQuality(preset.quality); setEdgeSizes({}) },
    selectAll: () => { invalidate(); if (edges.length <= MAX_FEATURE_EDGES) setSelected(edges.map((_, index) => index)); else setError(`Select up to ${MAX_FEATURE_EDGES} edges per feature.`) },
    clearSelection: () => { invalidate(); setSelected([]) },
    setOperation: (value: EdgeOperation) => { invalidate(); setOperation(value) },
    setQuality: (value: CurveQuality) => { invalidate(); setQuality(value) },
    setSize: (value: string) => { invalidate(); setSize(value) },
    apply: () => { if (preview && !busy) { onApply(preview); cancel() } },
  }
}
export type EdgeFeatureController = ReturnType<typeof useEdgeFeature>

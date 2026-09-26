import { memo, useEffect, useState } from 'react'
import type { CadObject } from './cadModel'
import { measureSelection } from './measurements'

const format = (value: number) => `${Number(value.toFixed(2))} mm`
type Readout = Awaited<ReturnType<typeof measureSelection>>

export default memo(function MeasurementPanel({ objects, selectedObjectIds, activeObjectId }: {
  objects: CadObject[]
  selectedObjectIds: string[]
  activeObjectId: string | null
}) {
  const [result, setResult] = useState<{ objects: CadObject[]; ids: string[]; activeId: string | null; data?: Readout; error?: string } | null>(null)
  useEffect(() => {
    let cancelled = false
    void measureSelection(objects, selectedObjectIds, activeObjectId).then(
      (data) => { if (!cancelled) setResult({ objects, ids: selectedObjectIds, activeId: activeObjectId, data }) },
      (error) => { if (!cancelled) setResult({ objects, ids: selectedObjectIds, activeId: activeObjectId,
        error: error instanceof Error ? error.message : 'Could not measure the selection.' }) },
    )
    return () => { cancelled = true }
  }, [objects, selectedObjectIds, activeObjectId])
  const current = result?.objects === objects && result.ids === selectedObjectIds && result.activeId === activeObjectId ? result : null
  const data = current?.data
  return (
    <div className="measurement-panel" aria-live="polite">
      <h3>Measurements</h3>
      {!selectedObjectIds.length ? <p className="selection-hint">Select a shape to see its finished size.</p> : <>
        {!current && <p className="selection-hint">Measuring…</p>}
        {current?.error && <p className="position-error">{current.error}</p>}
        {data?.size && <div className="measurement-row"><span>Finished size X / Y / Z</span><strong>{data.size.map(format).join(' × ')}</strong></div>}
        {data?.span && <div className="measurement-row"><span>Selection size X / Y / Z</span><strong>{data.span.map(format).join(' × ')}</strong></div>}
        {data?.gaps.map((gap) => <div className="measurement-row" key={gap.id}><span>Gap to {gap.name} X / Y / Z</span><strong>{gap.axes.map(format).join(' / ')}</strong></div>)}
        <p className="selection-hint">World bounds of finished bodies, including cuts. Gaps compare bounding boxes: 0 means overlap or touch on that axis, not necessarily touching surfaces. A separately selected hole measures its source shape.</p>
      </>}
    </div>
  )
})

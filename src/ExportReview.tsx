import { useEffect, useRef, useState } from 'react'
import type { CadObject } from './cadModel'
import { inspectExport, type ExportReport } from './exportChecks'

export type ExportFormat = 'stl' | '3mf'

export default function ExportReview({ objects, currentObjects, format, onClose, onDownload }: {
  objects: CadObject[]
  currentObjects: CadObject[]
  format: ExportFormat
  onClose: () => void
  onDownload: () => Promise<void>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [report, setReport] = useState<ExportReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const stale = currentObjects !== objects
  useEffect(() => {
    dialog.current?.showModal()
    let cancelled = false
    inspectExport(objects).then((result) => { if (!cancelled) setReport(result) })
      .catch((error) => { if (!cancelled) setError(error instanceof Error ? error.message : 'Could not check the model.') })
    return () => { cancelled = true }
  }, [objects])
  const formatMm = (value: number) => `${Number(value.toFixed(3))} mm`
  return (
    <dialog ref={dialog} className="export-review" aria-labelledby="export-review-title"
      onCancel={onClose} onKeyDown={(event) => event.stopPropagation()}>
      <h2 id="export-review-title">Review {format.toUpperCase()} export</h2>
      {!report && !error && <p role="status">Checking finished geometry…</p>}
      {report && <>
        {report.dimensions && <dl>
          <dt>Width (X)</dt><dd>{formatMm(report.dimensions.x)}</dd>
          <dt>Depth (Z)</dt><dd>{formatMm(report.dimensions.z)}</dd>
          <dt>Height (Y)</dt><dd>{formatMm(report.dimensions.y)}</dd>
          <dt>Export bodies</dt><dd>{report.bodyCount}</dd>
          <dt>Connected solid regions</dt><dd>{report.regions}</dd>
        </dl>}
        {report.regions > 1 && <p className="export-warning">The model contains {report.regions} disconnected solid regions.</p>}
        {report.bodyCount > 1 && <p>Separate bodies stay separate in the export. Use Join if you want them combined.</p>}
        {report.emptyBodies.length > 0 && <p className="export-warning">Empty bodies will be omitted: {report.emptyBodies.join(', ')}.</p>}
        {!report.bodyCount && <p role="alert">There is no printable solid geometry to export.</p>}
        {report.includesHidden && <p>Hidden shapes are included in this export.</p>}
        {report.errors.map((message) => <p key={message} role="alert">{message}</p>)}
      </>}
      {stale && <p role="alert">The model changed. Close this review and export again to check the current model.</p>}
      {error && <p role="alert">{error}</p>}
      <div className="export-review-actions">
        <button type="button" onClick={onClose}>Close</button>
        <button type="button" disabled={!report?.bodyCount || !!report.errors.length || stale || downloading || !!error}
          onClick={async () => {
            setDownloading(true)
            try { await onDownload(); onClose() }
            catch (error) { setError(error instanceof Error ? error.message : 'Export failed.'); setDownloading(false) }
          }}>{downloading ? 'Exporting…' : `Download ${format.toUpperCase()}`}</button>
      </div>
    </dialog>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ExportScope } from './exportSelection'
import type { CadObject } from './cadModel'
import { defaultPrintSettings, validatePrintSettings, type PrintSettings, type ExportReport } from './exportChecks'

import { GeometryJobs } from './GeometryJobs'

export type ExportFormat = 'stl' | '3mf'

export default function ExportReview({ objects, stale, scope, format, onClose, onDownload }: {
  objects: CadObject[]
  stale: boolean
  scope: ExportScope
  format: ExportFormat
  onClose: () => void
  onDownload: (signal: AbortSignal) => Promise<void>
}) {
  const jobs = useMemo(() => new GeometryJobs(), [])
  const downloadAbort = useRef<AbortController | null>(null)
  const [settings, setSettings] = useState<PrintSettings>(defaultPrintSettings)
  const [draft, setDraft] = useState({ x: '220', y: '250', z: '220', minFeature: '0.8' })
  const [settingsError, setSettingsError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => () => { jobs.dispose(); downloadAbort.current?.abort() }, [jobs])
  useEffect(() => { if (stale) { jobs.cancel(); downloadAbort.current?.abort() } }, [stale, jobs])
  const dialog = useRef<HTMLDialogElement>(null)
  const [report, setReport] = useState<ExportReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  useEffect(() => {
    dialog.current?.showModal()
    let cancelled = false
    setReport(null); setError(null)
    jobs.run('inspect', { objects, settings }).then((result) => { if (!cancelled) setReport(result) })
      .catch((error) => { if (!cancelled) setError(error instanceof Error ? error.message : 'Could not check the model.') })
    return () => { cancelled = true; jobs.cancel() }
  }, [objects, settings, jobs, retry])
  const formatMm = (value: number) => `${Number(value.toFixed(3))} mm`
  return (
    <dialog ref={dialog} className="export-review" aria-labelledby="export-review-title"
      onCancel={onClose} onKeyDown={(event) => event.stopPropagation()}>
      <h2 id="export-review-title">Review {format.toUpperCase()} export</h2>
      <p>{scope === 'selection' ? 'Scope: selected bodies, including their joined members and all linked holes.' : 'Scope: all bodies in the project.'}</p>
      {!report && !error && <p role="status">Checking finished geometry… <button type="button" onClick={() => jobs.cancel()}>Cancel checks</button></p>}
      <details className="print-settings"><summary>Print volume and feature checks</summary>
        <div className="coordinate-fields">{(['x', 'y', 'z'] as const).map((axis) => <label key={axis}>Size {axis.toUpperCase()} (mm)
          <input aria-label={`Print size ${axis.toUpperCase()}`} type="number" step="any" value={draft[axis]} disabled={downloading}
            onChange={(event) => setDraft({ ...draft, [axis]: event.target.value })} /></label>)}</div>
        <label>Small-feature threshold (mm)<input aria-label="Minimum print feature" type="number" step="any" value={draft.minFeature} disabled={downloading}
          onChange={(event) => setDraft({ ...draft, minFeature: event.target.value })} /></label>
        <button type="button" disabled={downloading || stale} onClick={() => {
          try {
            if (Object.values(draft).some((value) => !value.trim())) throw new Error('Fill in every print setting.')
            const next = { size: { x: Number(draft.x), y: Number(draft.y), z: Number(draft.z) }, minFeature: Number(draft.minFeature) }
            validatePrintSettings(next); setSettings(next); setSettingsError('')
          } catch (reason) { setSettingsError(reason instanceof Error ? reason.message : 'Invalid print settings.') }
        }}>Apply print settings</button>
        {settingsError && <p role="alert">{settingsError}</p>}
        <p>Volume is centered on X/Z, from Y=0 to the chosen height. These checks flag small source dimensions, custom walls, and narrow connected-region bounds. They do not measure wall thickness after cuts, bridges, or overhangs. Set the threshold to 0 to disable small-feature warnings.</p>
      </details>
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
        {report.outsideVolume.length > 0 && <p className="export-warning">Outside the print volume: {report.outsideVolume.join(', ')}.</p>}
        {report.smallFeatures.length > 0 && <details className="feature-warnings"><summary>{report.smallFeatures.length} small-feature warnings</summary>
          <ul>{report.smallFeatures.map((warning) => <li key={warning}>{warning}</li>)}</ul></details>}
        {report.errors.map((message) => <p key={message} role="alert">{message}</p>)}
      </>}
      {stale && <p role="alert">The model changed. Close this review and export again to check the current model.</p>}
      {error && <p role="alert">{error} <button type="button" disabled={stale || downloading} onClick={() => setRetry((value) => value + 1)}>Retry checks</button></p>}
      <div className="export-review-actions">
        <button type="button" onClick={onClose}>Close</button>
        {downloading && <button type="button" onClick={() => downloadAbort.current?.abort()}>Cancel export</button>}
        <button type="button" disabled={!report?.bodyCount || !!report.errors.length || stale || downloading || !!error}
          onClick={async () => {
            setDownloading(true)
            const controller = new AbortController(); downloadAbort.current = controller
            try { await onDownload(controller.signal); if (!controller.signal.aborted) onClose() }
            catch (error) { setError(error instanceof Error ? error.message : 'Export failed.'); setDownloading(false) }
          }}>{downloading ? 'Exporting…' : `Download ${format.toUpperCase()}`}</button>
      </div>
    </dialog>
  )
}

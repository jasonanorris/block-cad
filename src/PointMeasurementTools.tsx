import type { Vector3 } from './cadModel'
import { pointDistance } from './surfaceTools'

export default function PointMeasurementTools({ points, picking, onStart, onClear, error }: {
  error: string | null; points: Vector3[]; picking: boolean; onStart: () => void; onClear: () => void
}) {
  const result = points.length === 2 ? pointDistance(points[0], points[1]) : null
  const format = (value: number) => Number(value.toFixed(3)).toString()
  return <details className="repeat-tools point-measurement-tools"><summary>Point-to-point measurement</summary>
    <button type="button" onClick={onStart}>Measure two points</button>
    {(points.length > 0 || picking) && <button type="button" onClick={onClear}>Clear point measurement</button>}
    {picking && <p role="status">Pick {points.length ? 'the second' : 'the first'} point on a visible solid surface. Escape cancels.</p>}
    {result && <dl className="point-measurement-result" aria-live="polite">
      <dt>Distance</dt><dd>{format(result.distance)} mm</dd>
      {(['x', 'y', 'z'] as const).map((axis) => <div key={axis}><dt>Δ{axis.toUpperCase()}</dt><dd>{format(result.delta[axis])} mm</dd></div>)}
    </dl>}
    {error && <p role="alert" className="position-error">{error}</p>}
    <p className="selection-hint">Straight-line distance between the clicked surface points; axis differences are second minus first in world coordinates. No vertex snapping. Measurements clear after model edits and are not saved or exported.</p>
  </details>
}

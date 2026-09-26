import { useState } from 'react'
import { defaultHolePattern, patternPoints, type HolePattern } from './holePatterns'

export default function HolePatternTools({ disabled, busy, onApply, facePlane }: {
  disabled: boolean; busy: boolean; facePlane: boolean; onApply: (parameters: HolePattern) => Promise<void>
}) {
  const [layout, setLayout] = useState<HolePattern['layout']>('row')
  const [values, setValues] = useState(Object.fromEntries(Object.entries(defaultHolePattern).filter(([key]) => key !== 'layout').map(([key, value]) => [key, String(value)])))
  const [error, setError] = useState('')
  const fields = [...(layout === 'grid' ? ['rows', 'columns', 'spacingX', 'spacingZ'] : layout === 'row' ? ['count', 'spacingX'] : ['count', 'circleDiameter', 'startAngle']), 'diameter', 'depth', 'offsetX', 'offsetZ']
  const labels: Record<string, string> = { count: 'Count', rows: 'Rows', columns: 'Columns', spacingX: 'X spacing (mm)', spacingZ: 'Z spacing (mm)',
    circleDiameter: 'Bolt circle diameter (mm)', startAngle: 'Start angle (degrees)', diameter: 'Hole diameter (mm)', depth: 'Hole depth (mm)', offsetX: 'X offset (mm)', offsetZ: 'Z offset (mm)' }
  return <details className="repeat-tools hole-pattern-tools"><summary>Hole patterns</summary>
    <label>Layout<select aria-label="Hole pattern layout" disabled={busy} value={layout} onChange={(event) => setLayout(event.target.value as HolePattern['layout'])}>
      <option value="row">Row</option><option value="grid">Grid</option><option value="circle">Bolt circle</option>
    </select></label>
    {fields.map((key) => <label key={key}>{labels[key]}<input aria-label={`Pattern ${key}`} type="number" step="any" value={values[key]} disabled={busy}
      onChange={(event) => setValues({ ...values, [key]: event.target.value })} /></label>)}
    <button type="button" disabled={disabled || busy} onClick={() => void (async () => {
      try {
        if (fields.some((key) => !values[key].trim())) throw new Error('Fill in every pattern field.')
        const parameters = { layout, ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number(value)])) } as HolePattern
        patternPoints(parameters); await onApply(parameters); setError('')
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not add the pattern.') }
    })()}>Add hole pattern</button>
    <p className="selection-hint">{facePlane ? 'Starts at the face workplane origin and cuts inward along its normal.' : 'Centered above the selected body, cutting downward from its finished top.'} Offsets and spacing follow the pattern plane. Holes outside the target do not cut it. Each cutter stays editable in the object list; all are added in one Undo step.</p>
    {error && <p role="alert" className="position-error">{error}</p>}
  </details>
}

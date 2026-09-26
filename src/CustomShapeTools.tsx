import { useState } from 'react'
import { customDefaults, customLabels, validateCustomParameters, type CustomParameters } from './customShapes'

export default function CustomShapeTools({ initial = customDefaults.tube, disabled = false, action = 'Add custom shape', onApply }: {
  initial?: CustomParameters; disabled?: boolean; action?: string; onApply: (parameters: CustomParameters) => void
}) {
  const [kind, setKind] = useState(initial.kind)
  const drafts = (p: CustomParameters) => Object.fromEntries(Object.entries(p).filter(([key]) => key !== 'kind').map(([key, value]) => [key, String(value)]))
  const [values, setValues] = useState(drafts(initial)), [error, setError] = useState('')
  return <details className="repeat-tools custom-tools"><summary>{action === 'Add custom shape' ? 'Custom shapes' : 'Edit custom shape'}</summary>
    <label>Shape<select aria-label={`${action} type`} value={kind} disabled={disabled} onChange={(event) => {
      const next = event.target.value as CustomParameters['kind']; setKind(next); setValues(drafts(customDefaults[next])); setError('')
    }}>{Object.entries(customLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    {Object.entries(values).map(([key, value]) => <label key={key}>{key[0].toUpperCase() + key.slice(1)} (mm)
      <input aria-label={`${action} ${key}`} type="number" step="any" value={value} disabled={disabled}
        onChange={(event) => setValues({ ...values, [key]: event.target.value })} /></label>)}
    <button type="button" disabled={disabled} onClick={() => {
      try {
        if (Object.values(values).some((value) => !value.trim())) throw new Error('Fill in every parameter.')
        onApply(validateCustomParameters({ kind, ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number(value)])) })); setError('')
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create this shape.') }
    }}>{action}</button>
    <p className="selection-hint">Rounded boxes have rounded vertical corners, with flat tops and bottoms. Brackets have an upright leg and a base. Parameters remain editable after saving or adding to the parts library. Edits retain the current center, rotation, and scale.</p>
    {error && <p role="alert" className="position-error">{error}</p>}
  </details>
}

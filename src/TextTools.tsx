import { useState } from 'react'

export default function TextTools({ initialText = 'CAD', initialSize = 10, initialHeight = 3, action = 'Add text', onApply, disabled = false }: {
  initialText?: string; initialSize?: number; initialHeight?: number; action?: string; disabled?: boolean
  onApply: (text: string, size: number, height: number) => void
}) {
  const [text, setText] = useState(initialText), [size, setSize] = useState(String(initialSize)), [height, setHeight] = useState(String(initialHeight))
  const [error, setError] = useState<string | null>(null)
  return <details className="repeat-tools text-tools">
    <summary>{action === 'Add text' ? 'Text shape' : 'Edit text'}</summary>
    <label>Wording<textarea aria-label={`${action} wording`} maxLength={80} value={text} disabled={disabled} onChange={(event) => setText(event.target.value)} /></label>
    <label>Font size (mm)<input aria-label={`${action} font size`} type="number" min="1" max="200" value={size} disabled={disabled} onChange={(event) => setSize(event.target.value)} /></label>
    <label>Extrusion (mm)<input aria-label={`${action} extrusion`} type="number" min="0.001" max="200" step="any" value={height} disabled={disabled} onChange={(event) => setHeight(event.target.value)} /></label>
    <button type="button" className="cut-example-button" disabled={disabled} onClick={() => {
      try { onApply(text, Number(size), Number(height)); setError(null) }
      catch (error) { setError(error instanceof Error ? error.message : 'Could not build the text.') }
    }}>{action}</button>
    <p className="selection-hint">Helvetiker lettering starts flat on the current workplane. Use Shape mode → Hole for engraving, or Join with a base for raised labels. Spaces and line breaks are supported.</p>
    {error && <p role="alert" className="position-error">{error}</p>}
  </details>
}

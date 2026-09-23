import { useEffect, useRef, useState } from 'react'
import { getObjectDimensions, setObjectDimension, type CadObject, type Vector3 } from './cadModel'

type Axis = keyof Vector3
const axes: Axis[] = ['x', 'y', 'z']

function displayNumber(value: number) {
  return String(Number(value.toFixed(3)))
}

function NumericField({
  label,
  ariaLabel,
  value,
  positive = false,
  onChange,
}: {
  label: string
  ariaLabel: string
  value: number
  positive?: boolean
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState(() => displayNumber(value))
  const editing = useRef(false)

  useEffect(() => {
    if (!editing.current) setDraft(displayNumber(value))
  }, [value])

  function validNumber(text: string) {
    const number = Number(text)
    return text.trim() !== '' && Number.isFinite(number) && (!positive || number > 0)
  }

  return (
    <label className="numeric-field">
      <span>{label}</span>
      <input
        aria-label={ariaLabel}
        type="number"
        step="any"
        min={positive ? '0.001' : undefined}
        value={draft}
        onFocus={() => { editing.current = true }}
        onChange={(event) => {
          const text = event.target.value
          setDraft(text)
          if (validNumber(text)) onChange(Number(text))
        }}
        onBlur={() => {
          editing.current = false
          if (!validNumber(draft)) setDraft(displayNumber(value))
        }}
      />
    </label>
  )
}

export default function ObjectInspector({
  object,
  onUpdate,
}: {
  object: CadObject
  onUpdate: (id: string, update: (current: CadObject) => CadObject) => void
}) {
  const dimensions = getObjectDimensions(object)

  return (
    <div className="object-inspector">
      <div className="inspector-group">
        <h4>Position <span>mm</span></h4>
        <div className="numeric-grid">
          {axes.map((axis) => (
            <NumericField
              key={axis}
              label={axis.toUpperCase()}
              ariaLabel={`Position ${axis.toUpperCase()} in millimeters`}
              value={object.position[axis]}
              onChange={(value) => onUpdate(object.id, (current) => ({
                ...current,
                position: { ...current.position, [axis]: value },
              }))}
            />
          ))}
        </div>
      </div>
      <div className="inspector-group">
        <h4>Rotation <span>degrees</span></h4>
        <div className="numeric-grid">
          {axes.map((axis) => (
            <NumericField
              key={axis}
              label={axis.toUpperCase()}
              ariaLabel={`Rotation ${axis.toUpperCase()} in degrees`}
              value={object.rotation[axis] * 180 / Math.PI}
              onChange={(value) => onUpdate(object.id, (current) => ({
                ...current,
                rotation: { ...current.rotation, [axis]: value * Math.PI / 180 },
              }))}
            />
          ))}
        </div>
      </div>
      <div className="inspector-group">
        <h4>Dimensions <span>mm</span></h4>
        <div className="numeric-grid">
          {axes.map((axis) => (
            <NumericField
              key={axis}
              label={axis.toUpperCase()}
              ariaLabel={`Dimension ${axis.toUpperCase()} in millimeters`}
              value={dimensions[axis]}
              positive
              onChange={(value) => onUpdate(object.id, (current) => setObjectDimension(current, axis, value))}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

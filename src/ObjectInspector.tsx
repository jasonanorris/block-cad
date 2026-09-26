import { useEffect, useRef, useState } from 'react'
import { DEFAULT_OBJECT_COLOR } from './objectColor'
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
  integer = false,
  minimum,
  maximum,
  onChange,
  onEditStart,
  onEditEnd,
}: {
  label: string
  ariaLabel: string
  value: number
  positive?: boolean
  integer?: boolean
  minimum?: number
  maximum?: number
  onChange: (value: number) => void
  onEditStart: () => void
  onEditEnd: () => void
}) {
  const [draft, setDraft] = useState(() => displayNumber(value))
  const editing = useRef(false)

  useEffect(() => {
    if (!editing.current) setDraft(displayNumber(value))
  }, [value])

  function validNumber(text: string) {
    const number = Number(text)
    return text.trim() !== '' && Number.isFinite(number) && (!positive || number > 0) &&
      (!integer || Number.isInteger(number)) && (minimum === undefined || number >= minimum) && (maximum === undefined || number <= maximum)
  }

  return (
    <label className="numeric-field">
      <span>{label}</span>
      <input
        aria-label={ariaLabel}
        type="number"
        step={integer ? 1 : 'any'}
        min={minimum ?? (positive ? 0.001 : undefined)}
        max={maximum}
        value={draft}
        onFocus={() => {
          editing.current = true
          onEditStart()
        }}
        onChange={(event) => {
          const text = event.target.value
          setDraft(text)
          if (validNumber(text)) onChange(Number(text))
        }}
        onBlur={() => {
          editing.current = false
          if (!validNumber(draft)) setDraft(displayNumber(value))
          onEditEnd()
        }}
      />
    </label>
  )
}

export default function ObjectInspector({
  object,
  solidTargets,
  onUpdate,
  onSetCutTarget,
  onSetColor,
  onEditStart,
  onEditEnd,
  disabled = false,
}: {
  object: CadObject
  solidTargets: { id: string; label: string }[]
  onUpdate: (id: string, update: (current: CadObject) => CadObject) => void
  onSetColor: (id: string, color: string) => void
  onSetCutTarget: (id: string, targetId: string | null) => void
  onEditStart: () => void
  onEditEnd: () => void
  disabled?: boolean
}) {
  const dimensions = getObjectDimensions(object)
  const shapeName = object.type === 'svg' || object.type === 'stl'
    ? object.type.toUpperCase() : object.type[0].toUpperCase() + object.type.slice(1)

  return (
    <fieldset className="object-inspector" disabled={disabled}>
      <div className="inspector-group">
        <label className="name-field">
          <span>Name</span>
          <input
            aria-label="Object name"
            type="text"
            maxLength={80}
            placeholder={shapeName}
            value={object.name ?? ''}
            onFocus={onEditStart}
            onChange={(event) => {
              const name = event.target.value
              onUpdate(object.id, (current) => ({ ...current, name }))
            }}
            onBlur={(event) => {
              const name = event.target.value.trim() || undefined
              if (name !== object.name) onUpdate(object.id, (current) => ({ ...current, name }))
              onEditEnd()
            }}
          />
        </label>
      </div>
      <div className="inspector-group">
        <label className="color-field">Color
          <input type="color" aria-label="Object color" value={object.color ?? DEFAULT_OBJECT_COLOR}
            onFocus={onEditStart} onBlur={onEditEnd}
            onChange={(event) => onSetColor(object.id, event.target.value)} />
        </label>
        <p className="selection-hint">Joined solids share a color. Selected shapes keep the orange highlight. Colors are saved in projects; STL/3MF exports contain geometry only.</p>
        <h4>Shape mode</h4>
        <div className="shape-mode" role="group" aria-label={`${shapeName} shape mode`}>
          <button type="button" aria-pressed={!object.cutTargetId} onClick={() => onSetCutTarget(object.id, null)}>Solid</button>
          <button
            type="button"
            aria-pressed={!!object.cutTargetId}
            disabled={solidTargets.length === 0}
            onClick={() => onSetCutTarget(object.id, object.cutTargetId ?? solidTargets[0].id)}
          >Hole</button>
        </div>
        {object.cutTargetId ? (
          <label className="cut-target-field">
            <span>Cut solid</span>
            <select
              aria-label="Solid to cut"
              value={object.cutTargetId}
              onChange={(event) => onSetCutTarget(object.id, event.target.value)}
            >
              {solidTargets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
            </select>
          </label>
        ) : solidTargets.length === 0 ? (
          <p className="shape-mode-hint">Add a solid shape to use this {object.type} as a hole.</p>
        ) : null}
        {object.cutTargetId && <p className="shape-mode-hint">Move this {object.type} into the solid to cut it.</p>}
      </div>
      <div className="inspector-group">
        <h4>Position <span>mm</span></h4>
        <div className="numeric-grid">
          {axes.map((axis) => (
            <NumericField
              key={axis}
              label={axis.toUpperCase()}
              ariaLabel={`Position ${axis.toUpperCase()} in millimeters`}
              value={object.position[axis]}
              onEditStart={onEditStart}
              onEditEnd={onEditEnd}
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
              onEditStart={onEditStart}
              onEditEnd={onEditEnd}
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
              onEditStart={onEditStart}
              onEditEnd={onEditEnd}
              onChange={(value) => onUpdate(object.id, (current) => setObjectDimension(current, axis, value))}
            />
          ))}
        </div>
      </div>
      {object.type === 'prism' && <div className="inspector-group">
        <h4>Polygon</h4>
        <NumericField label="Sides (3–64)" ariaLabel="Prism sides" value={object.sides} integer minimum={3} maximum={64}
          onEditStart={onEditStart} onEditEnd={onEditEnd}
          onChange={(sides) => onUpdate(object.id, (current) => current.type === 'prism' ? { ...current, sides } : current)} />
      </div>}
    </fieldset>
  )
}

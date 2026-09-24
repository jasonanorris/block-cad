import type { CameraView } from './SceneControls'

const faces: { view: Exclude<CameraView, 'perspective'>; label: string }[] = [
  { view: 'front', label: 'Front' },
  { view: 'back', label: 'Back' },
  { view: 'right', label: 'Right' },
  { view: 'left', label: 'Left' },
  { view: 'top', label: 'Top' },
  { view: 'bottom', label: 'Bottom' },
]

export default function ViewCube({ cameraView, orientation, onChange }: {
  cameraView: CameraView
  orientation: string
  onChange: (view: CameraView) => void
}) {
  return (
    <div className="view-cube-control" aria-label="Camera view cube">
      <div className="view-cube-stage">
        <div className="view-cube" style={{ transform: orientation }}>
          {faces.map(({ view, label }) => (
            <button key={view} type="button" className={`view-cube-face face-${view}`}
              aria-label={`${label} view`} aria-pressed={cameraView === view}
              onClick={() => onChange(view)}>{label}</button>
          ))}
        </div>
      </div>
      <div className="view-cube-options" role="group" aria-label="All camera views">
        {faces.map(({ view, label }) => (
          <button key={view} type="button" aria-label={`${label} view`} aria-pressed={cameraView === view}
          onClick={() => onChange(view)}>{view === 'back' ? 'Bk' : view === 'bottom' ? 'Bt' : label.slice(0, 1)}</button>
        ))}
        <button type="button" aria-label="Perspective view" aria-pressed={cameraView === 'perspective'}
          onClick={() => onChange('perspective')}>P</button>
      </div>
    </div>
  )
}

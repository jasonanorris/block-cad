import { useEffect, useState, type ReactNode } from 'react'
import { readAutosave } from './autosave'
import { createCadObject, type CadObject } from './cadModel'

type RecoveredProject = { objects: CadObject[]; notice: string }

export default function ProjectRecovery({ children }: { children: (project: RecoveredProject) => ReactNode }) {
  const [project, setProject] = useState<RecoveredProject | null>(null)
  useEffect(() => {
    let cancelled = false
    readAutosave().then((draft) => {
      if (!cancelled) setProject({ objects: draft?.objects ?? [createCadObject('box')],
        notice: draft ? `Restored local draft from ${new Date(draft.savedAt).toLocaleString()}.` : '' })
    }).catch(() => {
      if (!cancelled) setProject({ objects: [createCadObject('box')],
        notice: 'Local recovery unavailable. You can load a downloaded project file.' })
    })
    return () => { cancelled = true }
  }, [])
  return project ? children(project) : <p className="recovery-notice" role="status">Checking for a local draft…</p>
}

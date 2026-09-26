import { useEffect, useRef, useState } from 'react'
import type { CadObject } from './cadModel'
import { writeAutosave } from './autosave'

export function useAutosave(objects: CadObject[]) {
  const [status, setStatus] = useState('Saving locally…')
  const revision = useRef(0)

  useEffect(() => {
    const current = ++revision.current
    let timer: number
    let started = false
    setStatus('Saving locally…')
    const save = () => {
      window.clearTimeout(timer)
      if (started) return
      started = true
      writeAutosave(objects).then(() => {
        if (revision.current === current) setStatus('Saved locally')
      }).catch(() => {
        if (revision.current === current) setStatus('Local autosave unavailable — use Save to download your project.')
      })
    }
    const onVisibilityChange = () => { if (document.visibilityState === 'hidden') save() }
    timer = window.setTimeout(save, 400)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', save)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', save)
    }
  }, [objects])

  return status
}

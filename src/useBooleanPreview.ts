import { useCallback, useEffect, useRef, useState } from 'react'
import type { CadObject } from './cadModel'
import { BackgroundPreview, type BackgroundPreviewState } from './BackgroundPreview'

export function useBooleanPreview(objects: CadObject[]) {
  const controller = useRef<BackgroundPreview | null>(null)
  const [preview, setPreview] = useState<BackgroundPreviewState>(() => ({ geometries: new Map(), error: null, pending: 0 }))
  useEffect(() => {
    const current = new BackgroundPreview(setPreview)
    controller.current = current
    return () => { current.dispose(); controller.current = null }
  }, [])
  useEffect(() => { controller.current?.update(objects) }, [objects])
  const retry = useCallback(() => controller.current?.retry(), [])
  return { ...preview, retry }
}

import { useEffect, useMemo, useState } from 'react'
import { getSolidBodies, type CadObject } from './cadModel'
import { loadManifold } from './manifoldRuntime'
import { BooleanPreviewCache, type Preview } from './BooleanPreviewCache'

export function useBooleanPreview(objects: CadObject[]): Preview {
  const cache = useMemo(() => new BooleanPreviewCache(), [])
  const [preview, setPreview] = useState<Preview>(() => ({ geometries: new Map(), error: null }))
  useEffect(() => {
    let cancelled = false
    if (!getSolidBodies(objects).some((body) => body.members.length > 1 || body.holes.length)) {
      setPreview(cache.clear())
      return
    }
    loadManifold().then((runtime) => {
      if (!cancelled) setPreview(cache.update(objects, runtime))
    }).catch((error: unknown) => {
      if (!cancelled) setPreview({ ...cache.clear(), error: error instanceof Error ? error.message : 'Could not load Manifold.' })
    })
    return () => { cancelled = true }
  }, [objects, cache])
  useEffect(() => () => { cache.clear() }, [cache])
  return preview
}

import { useEffect, useState } from 'react'
import type { BufferGeometry } from 'three'
import { isCylinderCutter, type CadObject } from './cadModel'
import { subtractCylinders } from './booleanGeometry'
import { loadManifold } from './manifoldRuntime'

type Preview = { geometries: Map<string, BufferGeometry>; error: string | null }

export function useBooleanPreview(objects: CadObject[]): Preview {
  const [preview, setPreview] = useState<Preview>(() => ({ geometries: new Map(), error: null }))

  useEffect(() => {
    const cutters = objects.filter(isCylinderCutter)
    if (cutters.length === 0) {
      setPreview((current) => current.geometries.size || current.error
        ? { geometries: new Map(), error: null }
        : current)
      return
    }

    let cancelled = false
    loadManifold().then((runtime) => {
      const geometries = new Map<string, BufferGeometry>()
      try {
        for (const object of objects) {
          if (isCylinderCutter(object)) continue
          const targetCutters = cutters.filter((cutter) => cutter.cutTargetId === object.id)
          if (targetCutters.length) geometries.set(object.id, subtractCylinders(object, targetCutters, runtime))
        }
        if (cancelled) {
          for (const geometry of geometries.values()) geometry.dispose()
        } else {
          setPreview({ geometries, error: null })
        }
      } catch (error) {
        for (const geometry of geometries.values()) geometry.dispose()
        if (!cancelled) setPreview({ geometries: new Map(), error: error instanceof Error ? error.message : 'Could not calculate the cut.' })
      }
    }).catch((error: unknown) => {
      if (!cancelled) setPreview({ geometries: new Map(), error: error instanceof Error ? error.message : 'Could not load Manifold.' })
    })

    return () => { cancelled = true }
  }, [objects])

  useEffect(() => () => {
    for (const geometry of preview.geometries.values()) geometry.dispose()
  }, [preview.geometries])

  return preview
}

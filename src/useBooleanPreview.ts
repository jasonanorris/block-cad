import { useEffect, useState } from 'react'
import type { BufferGeometry } from 'three'
import { isHoleObject, type CadObject } from './cadModel'
import { subtractHoles } from './booleanGeometry'
import { loadManifold } from './manifoldRuntime'

type Preview = { geometries: Map<string, BufferGeometry>; error: string | null }

export function useBooleanPreview(objects: CadObject[]): Preview {
  const [preview, setPreview] = useState<Preview>(() => ({ geometries: new Map(), error: null }))

  useEffect(() => {
    const holes = objects.filter(isHoleObject)
    if (holes.length === 0) {
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
          if (isHoleObject(object)) continue
          const targetHoles = holes.filter((hole) => hole.cutTargetId === object.id)
          if (targetHoles.length) geometries.set(object.id, subtractHoles(object, targetHoles, runtime))
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

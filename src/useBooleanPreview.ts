import { useEffect, useState } from 'react'
import type { BufferGeometry } from 'three'
import { getSolidBodies, type CadObject } from './cadModel'
import { buildSolidGeometry } from './booleanGeometry'
import { loadManifold } from './manifoldRuntime'

type Preview = { geometries: Map<string, BufferGeometry>; error: string | null }

export function useBooleanPreview(objects: CadObject[]): Preview {
  const [preview, setPreview] = useState<Preview>(() => ({ geometries: new Map(), error: null }))

  useEffect(() => {
    const derivedBodies = getSolidBodies(objects).filter((body) => body.members.length > 1 || body.holes.length > 0)
    if (derivedBodies.length === 0) {
      setPreview((current) => current.geometries.size || current.error
        ? { geometries: new Map(), error: null }
        : current)
      return
    }

    let cancelled = false
    loadManifold().then((runtime) => {
      const geometries = new Map<string, BufferGeometry>()
      try {
        for (const body of derivedBodies) {
          geometries.set(body.anchor.id, buildSolidGeometry(body, runtime))
        }
        if (cancelled) {
          for (const geometry of geometries.values()) geometry.dispose()
        } else {
          setPreview({ geometries, error: null })
        }
      } catch (error) {
        for (const geometry of geometries.values()) geometry.dispose()
        if (!cancelled) setPreview({ geometries: new Map(), error: error instanceof Error ? error.message : 'Could not calculate the model.' })
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

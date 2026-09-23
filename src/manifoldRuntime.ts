import Module from 'manifold-3d'
import wasmUrl from 'manifold-3d/manifold.wasm?url'

let runtimePromise: ReturnType<typeof Module> | null = null

export function loadManifold() {
  if (!runtimePromise) {
    runtimePromise = Module({ locateFile: () => wasmUrl })
      .then((runtime) => {
        runtime.setup()
        return runtime
      })
      .catch((error: unknown) => {
        runtimePromise = null
        throw error
      })
  }
  return runtimePromise
}

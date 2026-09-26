import factory from 'opencascade.js/dist/opencascade.full.js'
import wasmUrl from 'opencascade.js/dist/opencascade.full.wasm?url'
import type { OpenCascadeInstance } from 'opencascade.js/dist/opencascade.full.js'

type FileSystem = { readFile(path: string, options?: { encoding: string }): Uint8Array | string; writeFile(path: string, data: string): void; unlink(path: string): void }
export type CadKernel = OpenCascadeInstance & { FS: FileSystem; HEAP8: Int8Array }
let pending: Promise<CadKernel> | null = null
export function loadCadKernel() {
  if (!pending) {
    const initialize = factory as unknown as (options: { locateFile: () => string }) => Promise<CadKernel>
    pending = initialize({ locateFile: () => wasmUrl }).catch((error: unknown) => { pending = null; throw error })
  }
  return pending
}

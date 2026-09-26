import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

// Use the project's existing compiler with Node's test runner; no test framework.
export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith('?url')) {
    const result = await nextResolve(specifier.slice(0, -4), context)
    return { ...result, url: result.url + '?url' }
  }
  try { return await nextResolve(specifier, context) } catch (error) {
    if (!specifier.startsWith('.')) throw error
    for (const extension of ['.ts', '.tsx']) {
      try { return await nextResolve(specifier + extension, context) } catch { /* Try the next source extension. */ }
    }
    throw error
  }
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('?url')) return { format: 'module', shortCircuit: true,
    source: `export default ${JSON.stringify(fileURLToPath(url.slice(0, -4)))}` }
  if (!/\.tsx?$/.test(url)) return nextLoad(url, context)
  const source = await readFile(new URL(url), 'utf8')
  return { format: 'module', shortCircuit: true, source: ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    fileName: fileURLToPath(url),
  }).outputText }
}

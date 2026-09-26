import { defineConfig } from 'vite'

// Advanced CAD is loaded on demand inside the geometry worker.
export default defineConfig({
  worker: { format: 'es' },
  // Avoid a dependency-optimizer page reload on the first advanced request.
  optimizeDeps: { exclude: ['opencascade.js'] },
})

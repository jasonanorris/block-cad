# AGENTS.md

## Project

This is a web development project under `/home/mint/projects`.

Before making significant changes, understand the existing structure and ask questions when requirements are unclear.

## Development Preferences

Prefer:

- Simple, maintainable code
- Vanilla HTML, CSS, and JavaScript for small projects
- Minimal dependencies
- Readability over cleverness
- Clear file and function names
- Small, focused changes

Avoid adding large frameworks unless they provide a clear benefit.

## Local Workflow

This is a Vite/React/TypeScript app; use the Vite development server.

Document project-specific commands here:

```bash
# install
npm install

# run locally
npm run dev

# build
npm run build

# regression tests
npm test

# preview-cache benchmark
npm run benchmark

# regenerate bundled example projects
npm run samples
```

## Geometry and browser checks

Boolean previews use `src/booleanPreview.worker.ts`, scheduled by `BackgroundPreview.ts`. Keep one request in flight, discard obsolete results, and dispose replaced meshes. Other geometry operations still run on the main thread. Production smoke checks must load the worker JS and Manifold WASM through Vite preview.

Browser-only storage regression helpers (run with Vite, from the browser console):

```js
(await import('/tests/browser-library.mjs')).runLibraryChecks()
(await import('/tests/browser-library-transfer.mjs')).runTransferChecks()
```

Both helpers remove the temporary entries they create. Project format 16 adds text font IDs and reads earlier versions. Library backup format 1 embeds validated project files and imports additively in one IndexedDB transaction.

## Deployment

Deployment target: TBD

Possible targets:

- Namecheap web hosting
- Home server
- Cloudflare
- GitHub Pages

For infrastructure, deployment, DNS, server, hosting, Docker, Cloudflare, Tailscale, or Namecheap questions, read:

```text
/home/mint/projects/personal-dev-env/infrastructure.md
```

## Documentation

When setup, deployment, or architecture changes, update:

- `README.md`
- This `AGENTS.md`
- Relevant docs in `/home/mint/projects/personal-dev-env`

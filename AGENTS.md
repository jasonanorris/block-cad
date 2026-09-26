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

# repeated-mesh storage and large object-list benchmark
npm run benchmark:large

# regenerate bundled example projects
npm run samples
```

## Geometry and browser checks

Boolean previews use `src/booleanPreview.worker.ts`, scheduled by `BackgroundPreview.ts`. Keep one request in flight, discard obsolete results, and dispose replaced meshes. Edge discovery/fillet/chamfer previews, measurements, reference bounds, split, export review, and STL/3MF generation use `geometryTask.worker.ts` via `GeometryJobs.ts`. Cancellation terminates active workers; reject stale results and keep split commits atomic. These jobs have a 60-second timeout. Selected-edge features support a restricted convex, square-ended edge domain with 15°–165° interior angles and operation-specific radius/distance limits: validate it again in the worker, preserve source objects until Apply, and commit the mesh replacement atomically. Meeting chamfers use sharp miters; shared fillet corners require two or three perpendicular incident edges in one feature. Two-edge corners use a variable-radius tangent patch retaining the third sharp edge; three-edge corners use spherical patches. Other corner blends remain unsupported. For existing feature histories, discover actual neighboring planar faces and require both candidate faces to support the whole solid. This permits untouched straight edges after spherical blends without selecting tessellation seams. Keep square-end, angle, clearance, and triangle-limit checks; initial inputs still require convex geometry. Placement and import validation still run on the main thread. Production smoke checks must load the worker JS and Manifold WASM through Vite preview.

Browser-only storage regression helpers (run with Vite, from the browser console):

```js
(await import('/tests/browser-library.mjs')).runLibraryChecks()
(await import('/tests/browser-library-transfer.mjs')).runTransferChecks()
```

Both helpers remove the temporary entries they create. Project format 21 adds validated analytic BREP histories and reads formats 1–20. Legacy format 20 stores validated edge histories (shared base mesh and ordered features) and reads formats 1–19. Rebuild histories in mesh-local coordinates; preserve transforms, reject dependent-feature failures atomically, and validate multi-edge clearance before applying. Format 19 added rounded-box rounding mode; format 18 introduced deduplicated STL payloads in a mesh table. Older rounded boxes default to sides-only rounding. All-edge rounded boxes share a welded indexed mesh between source previews and Manifold. Resolve references and validate shared payloads before creating runtime objects. Custom-shape parameters were added in 17 and font IDs in 16. Custom geometry must agree between source meshes and Manifold. Surface tools share the finished-surface picker and must invalidate picks when the model changes. Library backup format 1 embeds validated project files and imports additively in one IndexedDB transaction.

## Advanced CAD

Advanced CAD is approved and implemented through pinned OpenCascade.js, loaded dynamically in the ES module geometry worker. Keep it lazy; free WASM objects through KernelScope. Native boxes, wedges, prisms, cylinders, joins/intersections, and cuts construct analytic starting bodies. Preserve BREP history and per-edge radius overrides alongside the cached mesh. Edge labels use conservative local material sampling and curve type; they never relax kernel validity checks. Preserve diagnostic edge keys through worker errors and clear stale highlights. Saved-feature highlighting must replay the input history and retain stored edge order. Analytic edge references use orientation-normalized geometric signatures; require unique matches during replay and reject ambiguous/dependent edits atomically. Existing mesh histories remain on their legacy implementation. Imported/baked meshes do not imply analytic surfaces. Keep license notices in public/licenses and update docs/ADVANCED_FILLETS.md for architecture/resource changes. Test all four advanced feature cases plus geometry validity, exports, persistence, and production worker/WASM loading.

## Deployment

Publishing is deferred by user request; keep the app local. Deployment target: TBD.

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

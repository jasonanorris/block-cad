# Local release checks

This is a local browser CAD prototype. Publishing (milestone 80) is deferred by user request. Release preparation does not deploy or publish it.

## Automated checks

```bash
npm install
npm test
npm run build
npm run benchmark
npm run benchmark:large
npm run preview -- --host 127.0.0.1 --port 4175
```

Open the URL printed by Vite. For storage failure/validation checks, run `npm run dev`, then execute `(await import('/tests/browser-library.mjs')).runLibraryChecks()` in the browser console. It creates and removes its own test records.

`npm run benchmark` reports elapsed time and Boolean build counts for 100 cut bodies: initial build, metadata-only edits, and one cutter move. Expected rebuild counts are **100 / 0 / 1**. Timings depend on hardware and are not test gates. This benchmark measures the synchronous geometry builder/cache. Browser previews and geometry jobs use workers with separate scheduling/cancellation tests. The current regression suite contains 134 tests.

`npm run benchmark:large` verifies shared-mesh storage for 200 repeated sphere meshes and bounded object rows for 5,000 objects. Timings are informational; storage deduplication and the 50-row page limit are assertions.

`npm run samples` regenerates the three bundled examples from source; tests load them, validate their projects, and export STL/3MF.

## Browser acceptance checks

- Load each example; inspect geometry, Undo the load, and Redo.
- Create `BO 8` text, edit wording, make it a hole, and export. Confirm letter openings and millimeter dimensions.
- Enable Section view, move and flip its plane, then disable it. Confirm clipped surfaces do not intercept visible geometry clicks and exports remain whole.
- Move/rotate/scale a selected shape with the mouse; orbit and zoom. Rendering must resume on interaction and stop when idle.
- Edit one cutter in a scene containing multiple cut bodies. Unchanged bodies should retain their geometry.
- Save/load a project, reload for autosave recovery, insert a library part, and restore a snapshot. Check Undo/Redo and independent cutter links.
- Try invalid text, malformed project data, empty intersections, locked selections, and unavailable storage. Failed actions must leave the model intact.

- Switch all six sidebar tabs with mouse and Left/Right/Home/End keys; selection, model, and Undo must remain unchanged. Check Edit selection, unfinished text drafts, expanded groups, and per-tab scroll preservation. Open every group at desktop, 800px, and 390px widths; ensure no horizontal overflow and desktop tabs remain visible while the active panel scrolls.
- Set a reference origin, position a joined/cut selection by minimum/center/maximum offsets, then Undo/Redo. Confirm linked cutters travel once and locked dependencies reject the action.
- Pick top, side, underside, and sloped faces. Add a primitive, text, SVG, STL, and library part; confirm they face outward and rest on the plane. Drop an existing body, Undo, reset, and cancel picking with Escape. Check face picking and Box select are mutually exclusive.
- Drop onto a rotated body and into a cut pocket. A through hole without support must fail without moving the model. Check multiple selected bodies and a locked target; Undo must restore all moved shapes in one step.

- Enable a section through a joined, cut body; split, move one half, and export both. Check that the cap is closed, holes remain cut, and Undo restores source objects and selection. An outside/tangent plane must fail atomically.
- Create and edit lettering in all three fonts. Save/load and Undo/Redo must retain the font, contours, transform, and cutter links. Load a version-15 project and check the default font.
- Check the production preview worker JS and WASM load successfully. Change one cutter rapidly; only its newest result may appear. Color/name edits should not trigger new work. New must cancel outstanding work, and a worker error must offer Retry previews.
- Export/import a library backup, including an empty snapshot and joined part. Reimport adds fresh entries without overwrites. Malformed input and quota failures must add no partial entries. Run `(await import('/tests/browser-library-transfer.mjs')).runTransferChecks()` with Vite for automated IndexedDB checks; it deletes its own temporary entries.

- Create, edit, Save/Load, copy, and library-insert all three custom shapes. Check unchanged exterior dimensions with a tube wall edit, bracket orientation, rounded-box radius limits, and preserved parameters after Undo/Redo. Verify Boolean worker and STL/3MF output for a cut custom body.
- Add row, grid, and bolt-circle hole patterns to a joined target. Check offsets, blind depth, side-face workplanes, editable cutter links, locked target rejection, and a single Undo step for the whole pattern.
- Physically pick a moving face and target face, align with an offset, and Undo/Redo. Confirm the target stays fixed and all linked cutters move rigidly. Selection/model changes must clear pending picks.
- Pick two surface points, check the line and signed X/Y/Z differences, then cancel with Escape. Measurement must leave Save output/Undo unchanged and clear after a model edit. Verify switching to workplane and box-selection modes.

- Load more than 50 objects; navigate pages, search, filter assemblies, and use Show selected page. Verify selection survives paging.
- Save/load repeated STL copies in format 20 and load an older inline-mesh file. Check independent transforms and a shared mesh table, including projects embedded in library backups.
- Cancel and retry measurements/reference bounds and export checks. Cancel a split/export while pending; no partial model changes or downloads may occur. Complete a split and Undo/Redo it.
- In production preview, verify the geometry-task worker and WASM load for measurement, split, export review, STL, and 3MF. Closing export review must cancel pending work.
- Review a disconnected model, a body outside the print volume, and small walls/holes. Change volume/threshold, apply settings, and verify updated warnings. Zero threshold disables feature warnings; warnings do not block valid downloads.

- Create a rounded box with All edges (3D), switch to Sides only (2D) in Edit, and Undo/Redo. Check unchanged outside dimensions, radius validation against height, maximum radius, Save/Load, and STL/3MF worker exports. Older projects must keep sides-only geometry.

- Select a box, open Edit → Fillet / chamfer edges, and physically hover/click an eligible edge. Check front/side views and hidden-edge rejection. Preview must change only the canvas, with Save/export retaining the committed model until Apply.
- Check fillet and chamfer sizes, excessive size errors, Cancel/Escape, Apply, and one-step Undo/Redo. Changing the model/selection must discard pending work and previews. Unsupported concave/curved bodies must leave the model intact. Verify the worker operation in Vite production preview.

- Toggle multiple separate edges, preview/apply together, and Undo/Redo. Unsupported corner angles and overlapping cuts away from shared corners must fail atomically. Save/Load the result and edit its radius/operation; preview/cancel/remove a feature and Undo/Redo removal. Removing all features must recover the starting mesh.
- Copy/library-insert a featured body, transform it, and edit its history independently. Verify feature size remains in local pre-scale units and a failed earlier edit leaves dependent later features and the model unchanged. Test version-20 base mesh references and malformed feature histories.

- Load a box with one spherical corner blend, select a remaining straight edge, and apply another chamfer/fillet. Check preview isolation, Undo/Redo, edits to both history entries, Save/Load, and worker exports. Rounded surface facets must not be selectable.
- Pick two meeting box edges: Fillet must blend tangentially while retaining the third sharp edge; Chamfer must retain sharp miters. Check all box corner orientations, maximum radius, Save/Load, transformed history edits, removal, and exports. Use Select all edges to fillet all twelve box edges; verify Preview/Cancel, Apply, Undo/Redo, Save/Load editing, operation changes, feature removal, and STL/3MF exports. Geometry tests check spherical corner surfaces, analytic rounded-box volume, maximum radius, and reflected/rotated bodies.
- Physically pick 45° wedge and 120° prism edges. Check angle readouts, different chamfer-distance/fillet-radius limits, invalid-radius rejection, preview/apply, Undo/Redo, Save/Load editing, and STL/3MF worker exports. Geometry regressions cover acute/obtuse angles, reflected nonuniform transforms, and angle exclusions. Prism chamfer regressions check every output vertex against the cut plane on every edge of 5-, 6-, 8-, and 12-sided prisms, individually and together, to catch thin face remnants that volume checks miss.

## Known limits

- Mesh selected-edge tools currently handle straight outside edges with 15°–165° interior angles and flat, square ends on convex bodies up to 5,000 triangles. Size limits are conservative. The starting mesh bakes original primitive parameters and linked shapes; new edge features retain editable history, with sharp meeting chamfers and tangent variable-radius blends for two perpendicular fillets and spherical blends for three, selected together. Remaining straight edges can be selected after spherical blends; curved boundaries and edges ending in blends remain unsupported. Older baked features and split/exported meshes do not gain editable history.
- Custom shapes are three built-in parameterized generators. Rounded boxes offer sides-only or all-edge rounding with a uniform source radius; this is not general edge filleting. Nonuniform scaling also scales the rounding.
- Hole patterns generate separate cutters, with no persistent pattern constraint or automatic through-depth calculation.
- Face alignment uses picked triangle normals and points, without collision checking or additional twist control.
- Point measurement uses clicked surface points, without vertex snapping; it is not minimum body-to-body clearance.
- Face workplanes use the picked mesh triangle plane, stay fixed, and extend beyond the picked face. World-axis snapping is not reoriented.
- Surface drop resolves vertical contact against one chosen target; it does not resolve other obstacles or stability/overhangs. It limits each action to five million projected triangle comparisons.
- Section views are not capped, printable slices.
- Gaps compare world bounding boxes, not exact surface distances.
- Object snapping uses source bounds before cuts/joins.
- Nonuniform scaling of rotated assemblies can approximate shear.
- Text offers three bundled font choices; custom font uploads are not supported and unsupported characters are rejected.
- STL has no unit metadata; this app treats coordinates as millimeters.
- Geometry exports do not include display colors.
- Local storage is specific to the browser and site address.
- Previews have a 30-second timeout per body; measurement/reference/split/export jobs have a 60-second timeout. Placement, import validation, worker input copying, and the large initial bundle remain performance limits.
- Print-feature checks are heuristics over source dimensions/custom walls and connected-region bounds, not post-cut wall-thickness, overhang, bridge, or clearance analysis. Print settings reset for each export review.
- Split results are baked meshes. Undo restores editable sources; each half has the existing 100,000-triangle limit.
- Library backups are limited to 50 MB / 250 entries / 10,000 source shapes and exclude autosave and the currently open unsaved model.

The font licenses are shipped in `public/licenses/helvetiker.txt` and `public/licenses/bundled-fonts.txt` and copied into production output.

### Advanced CAD acceptance

- Verify inside/outside/transition and straight/curved labels on boxes, pockets, and hole rims. Hover/focus a size field and check its orange viewport highlight, including after reopening saved feature history. An oversized radius must report sizes and implicated edges when available, mark those fields/edges, and leave Save unchanged; unknown failures must not blame a specific edge.
- Choose Advanced CAD and physically pick two meeting edges. Set different individual sizes, Preview/Apply, Undo/Redo, Save/Load, edit overrides, remove the feature, and export STL/3MF. No kernel asset should be required for ordinary mesh-tool use.
- Build a hexagonal prism corner blend, an edge ending in an existing rounded surface, a rectangular pocket bottom fillet, and a circular blind-hole bottom fillet. Verify valid solids and expected radii/material changes, not only successful responses.
- Check transformed native sources, joined solids, analytic library copies, dependent-history failures, invalid radii, and invalid saved analytic references. Format 22 must continue loading formats 1–21. Verify Standard / Fine / Extra fine persistence in both engines, increasing curved-mesh detail, stale-preview rejection after changing quality, and legacy Fine defaults.
- Advanced CAD starts from all native primitives, tubes, rounded boxes, L-brackets, and their analytic joins/cuts. Imported or baked meshes retain mesh-tool support. The on-demand WASM is about 48 MiB uncompressed / 14 MB gzip and starts with a 100 MiB heap. See ADVANCED_FILLETS.md for implementation and limits.

- Expanded sources: verify cone base-rim fillets, tube-rim fillets, bracket edges, sides-only rounded-box edges, and edges created by cutting spheres/all-edge rounded boxes. Check analytic dimensions/volumes, radius zero and maximum-radius rounded boxes (including spheres/capsules), Save/Load, feature editing, transforms, and STL/3MF exports. Smooth spheres must not offer their parameter seam as an edge.

## Surface display

- Toggle Smooth shading on a filleted body: curved lighting blends, box corners stay sharp, and switching back shows individual facets.
- Toggle Wireframe overlay: triangle edges appear over visible solids, stay clipped in section view, and do not intercept selection or edge picks. Hidden/grouped sources must not gain an overlay.
- Verify display toggles preserve vertex positions, saved project data, export geometry, and Undo/Redo; dispose derived display geometry when objects change.

- Mesh inspection: compare selected-body triangle counts against the rendered mesh; joined bodies count once and pending Booleans show a pending message. Confirm the size is labeled as triangle positions.
- Selected-only wireframe: toggle with multiple visible bodies and change selection; overlays must follow selection. Crease-angle changes must alter normals without changing saved meshes.
- Bulk quality: rebuild mixed mesh/analytic histories, including hidden bodies. Check locked assemblies are skipped, failures/cancellation are atomic, stale results are discarded, and a single Undo/Redo restores the entire batch.

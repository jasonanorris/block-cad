# Local release checks

This is a local browser CAD prototype. Release preparation does not deploy or publish it.

## Automated checks

```bash
npm install
npm test
npm run build
npm run benchmark
npm run preview -- --host 127.0.0.1 --port 4175
```

Open the URL printed by Vite. For storage failure/validation checks, run `npm run dev`, then execute `(await import('/tests/browser-library.mjs')).runLibraryChecks()` in the browser console. It creates and removes its own test records.

`npm run benchmark` reports elapsed time and Boolean build counts for 100 cut bodies: initial build, metadata-only edits, and one cutter move. Expected rebuild counts are **100 / 0 / 1**. Timings depend on hardware and are not test gates. This benchmark measures the synchronous geometry builder/cache. Browser previews use a worker with separate scheduling tests; measurements and export calculations still run on the main thread.

`npm run samples` regenerates the three bundled examples from source; tests load them, validate their projects, and export STL/3MF.

## Browser acceptance checks

- Load each example; inspect geometry, Undo the load, and Redo.
- Create `BO 8` text, edit wording, make it a hole, and export. Confirm letter openings and millimeter dimensions.
- Enable Section view, move and flip its plane, then disable it. Confirm clipped surfaces do not intercept visible geometry clicks and exports remain whole.
- Move/rotate/scale a selected shape with the mouse; orbit and zoom. Rendering must resume on interaction and stop when idle.
- Edit one cutter in a scene containing multiple cut bodies. Unchanged bodies should retain their geometry.
- Save/load a project, reload for autosave recovery, insert a library part, and restore a snapshot. Check Undo/Redo and independent cutter links.
- Try invalid text, malformed project data, empty intersections, locked selections, and unavailable storage. Failed actions must leave the model intact.

- Open sidebar navigation groups with mouse/keyboard; selection and model must remain unchanged. Check narrow-screen layout and desktop canvas visibility while scrolling.
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

## Known limits

- Custom shapes are three built-in parameterized generators. Rounded boxes only round vertical corners; this is not general edge filleting.
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
- Previews run in a worker, with a 30-second timeout per body; other geometry calculations and the large initial bundle remain performance limits.
- Split results are baked meshes. Undo restores editable sources; each half has the existing 100,000-triangle limit.
- Library backups are limited to 50 MB / 250 entries / 10,000 source shapes and exclude autosave and the currently open unsaved model.

The font licenses are shipped in `public/licenses/helvetiker.txt` and `public/licenses/bundled-fonts.txt` and copied into production output.

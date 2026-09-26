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

`npm run benchmark` reports elapsed time and Boolean build counts for 100 cut bodies: initial build, metadata-only edits, and one cutter move. Expected rebuild counts are **100 / 0 / 1**. Timings depend on hardware and are not test gates. Complex single-body Booleans still run on the main thread.

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

## Known limits

- Face workplanes use the picked mesh triangle plane, stay fixed, and extend beyond the picked face. World-axis snapping is not reoriented.
- Surface drop resolves vertical contact against one chosen target; it does not resolve other obstacles or stability/overhangs. It limits each action to five million projected triangle comparisons.
- Section views are not capped, printable slices.
- Gaps compare world bounding boxes, not exact surface distances.
- Object snapping uses source bounds before cuts/joins.
- Nonuniform scaling of rotated assemblies can approximate shear.
- Text uses one bundled font; unsupported characters are rejected.
- STL has no unit metadata; this app treats coordinates as millimeters.
- Geometry exports do not include display colors.
- Local storage is specific to the browser and site address.
- Main-thread geometry and large initial bundles remain performance limits.

The font license is shipped in `public/licenses/helvetiker.txt` and copied into production output.

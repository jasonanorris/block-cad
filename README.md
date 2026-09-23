# Block CAD

A simple browser-based 3D modeling project. You can add, select, move, rotate, size, duplicate, delete, undo, and redo changes to boxes, cylinders, and spheres on a gridded 3D workplane. Projects can be saved to and loaded from JSON files, or exported as STL for 3D printing.

## Local development

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Use New to start with an empty workplane, Save to download a project JSON file, Load to open one, and Export STL to download all shapes for a slicer. New and Load clear selection and undo history. An invalid file leaves the current project intact and displays an error. Use the Shapes buttons to add a box, cylinder, or sphere. New shapes appear on the workplane and are selected automatically. Choose Move, Rotate, or Scale above the workspace and drag the colored handles on the selected shape. Turn on Snap to move in 5 mm grid steps and rotate in 15° steps; turn it off for freeform dragging. Snap does not affect scaling or numeric inspector edits. The selected object's inspector also lets you enter position, rotation, and dimensions numerically. Use the Perspective, Top, Front, and Right buttons to switch camera views. Top, Front, and Right use orthographic projection; scroll to zoom and right-drag to pan. Perspective also supports drag to orbit. Changing views resets the camera angle and framing without changing the model. Use Duplicate or Delete in the sidebar, Ctrl/Cmd+D to duplicate, Delete or Backspace to remove, and Escape to clear selection. Undo and Redo are above the workspace; Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl+Y redoes. App shortcuts do not run while editing an inspector field.

```bash
npm run build
npm run preview
```

The Vite app needs a local server; opening `index.html` directly is not supported.

## Architecture

React holds CAD objects as application data in `src/cadModel.ts`. React Three Fiber renders those objects in `src/Workspace.tsx`, and Three.js supplies camera and transform controls. Objects have stable IDs, types, positions, rotations, scales, and shape-specific base dimensions. Selection is stored separately as an object ID. `src/useCadHistory.ts` keeps past, present, and future snapshots of CAD data and selection, never Three.js objects. History retains up to 100 steps, and a new edit clears redo. Add, duplicate, and delete each create one history entry. A transform drag or focused numeric edit creates one entry when it ends. Dragging a handle or editing an inspector field updates the CAD data, which remains the source of truth. Duplicating copies the selected CAD data with a new ID and a 25 mm offset in X and Z; the copy becomes selected. Deleting removes the selected object and clears selection. Scene lengths and dimensions use millimeters; rotation values use radians internally and degrees in the inspector. The inspector shows each local dimension after applying scale; editing a dimension adjusts that axis's scale. New shapes are 20 mm tall and rest on the Y=0 workplane.

`src/projectFile.ts` writes version 1 project JSON with `format: "block-cad"`, `units: "mm"`, and an `objects` array. Loading validates the file and shape data before replacing the scene. Project files contain CAD data only; selection, undo history, and Three.js state are not saved.

`src/stlExport.ts` creates a binary STL from the same primitive sizes and transforms used in the workspace. STL has no unit metadata, so import the file as millimeters in a slicer. Every shape exports as its own closed surface within one file. Overlapping shapes are not fused; use a slicer's union/merge option if needed for a single solid. Export STL is disabled for an empty project.

The Snap toggle controls Three.js `TransformControls` during drag operations and shows a 5 mm grid while enabled. It is an editing preference, not part of the project file; it does not change existing object coordinates when toggled.

`src/SceneControls.tsx` switches the active camera between perspective and orthographic views. The orthographic camera adjusts its aspect ratio with the workspace size. Camera view is an editing preference, not part of the project file or undo history.

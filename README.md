# Block CAD

A simple browser-based 3D modeling project. You can add, select, move, rotate, size, duplicate, delete, undo, and redo changes to boxes, cylinders, and spheres on a gridded 3D workplane. Projects can be saved to and loaded from JSON files, or exported as STL for 3D printing. Any shape can act as a hole in another solid shape.

## Local development

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Use New to start with an empty workplane, Save to download a project JSON file, Load to open one, and Export STL to download all shapes for a slicer. New and Load clear selection and undo history. An invalid file leaves the current project intact and displays an error. Use the Shapes buttons to add a box, cylinder, or sphere. New shapes appear on the workplane and are selected automatically. Shift+click shapes on the canvas or in the Objects list to select several; click without Shift to select one, or click empty space or press Escape to clear selection. Choose Move, Rotate, or Scale above the workspace and drag the colored handles on the active shape. Turn on Snap to move in 5 mm grid steps and rotate in 15° steps; turn it off for freeform dragging. Snap does not affect scaling or numeric inspector edits. The inspector edits the active shape, including its optional name. Names appear in the Objects list and Cut solid menu; clear a name to use the shape label again. Use the Perspective, Top, Front, and Right buttons to switch camera views. Top, Front, and Right use orthographic projection; scroll to zoom and right-drag to pan. Perspective also supports drag to orbit. Changing views resets the camera angle and framing without changing the model. Duplicate or Delete acts on all selected shapes; use the sidebar buttons, Ctrl/Cmd+D to duplicate, or Delete or Backspace to remove. Undo and Redo are above the workspace; Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl+Y redoes. App shortcuts do not run while editing an inspector field.

To cut a hole, add a shape and another solid shape. Select the first shape and choose **Hole** under Shape mode. Use **Cut solid** to choose a box, solid cylinder, or solid sphere as the target. Move or resize the hole so it overlaps the target. Choose **Solid** to restore it as a separate shape. **Add cutout example** provides a ready-made box and cylinder hole. Deleting a hole restores its target; deleting the target turns its holes into solids. Turning a solid shape into a hole also restores any holes that were cutting it to solids. Undo and Redo cover these changes.

To show only the cut result, Shift+click one solid and one or more holes linked to it, then choose **Group**. The cutter wireframes disappear when the preview is ready, while their source shapes remain in the Objects list. Moving the grouped solid with the Move gizmo or Position fields moves its grouped holes by the same amount; ungrouped holes stay in place. Select a grouped hole in the list to reveal and edit its wireframe. Select the target or a grouped hole and choose **Ungroup** to show the cutters again. Grouping and ungrouping are undoable and saved in project files. Duplicating a grouped solid and its hole together preserves the grouping in the copies.

To join shapes, Shift+click at least two separate solids and choose **Join**. You can also select holes linked to those solids at the same time. The workspace and STL export use one Manifold union of the solids, with any holes linked to a member cut from the joined result. Select a joined member in the Objects list to edit its original shape; members other than the first appear as a wireframe while selected. Transform handles move the active source shape. Choose **Separate** with a joined member selected to restore separate solids. Joining, separating, and edits are undoable. Duplicating multiple joined members creates a new join among the copies; duplicating only one member makes an independent solid.

```bash
npm run build
npm run preview
```

The Vite app needs a local server; opening `index.html` directly is not supported.

## Architecture

React holds CAD objects as application data in `src/cadModel.ts`. React Three Fiber renders those objects in `src/Workspace.tsx`, and Three.js supplies camera and transform controls. Objects have stable IDs, optional names, types, positions, rotations, scales, and shape-specific base dimensions. Selection stores a set of object IDs and one active ID; transform handles and the inspector act on the active shape. `src/useCadHistory.ts` keeps past, present, and future snapshots of CAD data and selection, never Three.js objects. History retains up to 100 steps, and a new edit clears redo. Add, duplicate, delete, join, and separate each create one history entry. A transform drag or focused inspector edit creates one entry when it ends. Dragging a handle or editing an inspector field updates the CAD data, which remains the source of truth. Duplicating copies each selected shape with a new ID and a 25 mm offset in X and Z, keeping its name. If a selected hole and its target are duplicated together, the copied hole targets the copied solid. The copies become selected. Deleting removes selected shapes and clears selection; any remaining holes whose targets were deleted become solids. A join with fewer than two remaining solids dissolves. Scene lengths and dimensions use millimeters; rotation values use radians internally and degrees in the inspector. The inspector shows each local dimension after applying scale; editing a dimension adjusts that axis's scale. New shapes are 20 mm tall and rest on the Y=0 workplane.

`src/projectFile.ts` writes version 8 project JSON with `format: "block-cad"`, `units: "mm"`, and an `objects` array. A hole shape stores the ID of the solid it cuts and whether its cutter wireframe is grouped with the target. Joined solids share a join group ID. Optional object names are saved with the shapes. Versions 1 through 7 still load. Loading validates the file, shape data, names, hole links, cut groups, and join groups before replacing the scene. Project files contain CAD data only; selection, undo history, generated meshes, and Three.js state are not saved.

`src/stlExport.ts` creates a binary STL from the same primitive sizes and transforms used in the workspace. It exports each joined body or cut target as the Manifold result and omits hole shapes as separate solids. STL has no unit metadata, so import the file as millimeters in a slicer. Overlapping shapes that have not been joined are still separate surfaces; use Join or a slicer's union/merge option if needed for a single solid. Export STL is disabled for an empty project.

`src/booleanGeometry.ts` uses the Manifold WebAssembly library to derive joined and cut surfaces from the original CAD shapes. It unions joined solids, then subtracts holes linked to any member. Both the preview and STL export call this module. `src/useBooleanPreview.ts` manages generated preview geometry and disposes it when it changes. The Manifold result is derived data; edits, undo/redo, and project files retain the source shapes.

The Snap toggle controls Three.js `TransformControls` during drag operations and shows a 5 mm grid while enabled. It is an editing preference, not part of the project file; it does not change existing object coordinates when toggled.

`src/SceneControls.tsx` switches the active camera between perspective and orthographic views. The orthographic camera adjusts its aspect ratio with the workspace size. Camera view is an editing preference, not part of the project file or undo history.

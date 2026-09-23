# Block CAD

A simple browser-based 3D modeling project. The current milestone supports adding, selecting, moving, rotating, and sizing boxes, cylinders, and spheres on a gridded 3D workplane.

## Local development

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Use the Shapes buttons to add a box, cylinder, or sphere. New shapes appear on the workplane and are selected automatically. Choose Move, Rotate, or Scale above the workspace and drag the colored handles on the selected shape. The selected object's inspector also lets you enter position, rotation, and dimensions numerically. Click empty workspace to deselect it. Drag outside the handles to orbit, scroll to zoom, and right-drag to pan.

```bash
npm run build
npm run preview
```

The Vite app needs a local server; opening `index.html` directly is not supported.

## Architecture

React holds CAD objects as application data in `src/cadModel.ts`. React Three Fiber renders those objects in `src/Workspace.tsx`, and Three.js supplies camera and transform controls. Objects have stable IDs, types, positions, rotations, scales, and shape-specific base dimensions. Selection is stored separately as an object ID in React state. Dragging a handle or editing an inspector field updates the CAD data, which remains the source of truth. Scene lengths and dimensions use millimeters; rotation values use radians internally and degrees in the inspector. The inspector shows each local dimension after applying scale; editing a dimension adjusts that axis's scale. New shapes are 20 mm tall and rest on the Y=0 workplane.

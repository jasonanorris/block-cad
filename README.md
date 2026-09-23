# Block CAD

A simple browser-based 3D modeling project. The current milestone supports adding and selecting boxes, cylinders, and spheres on a gridded 3D workplane.

## Local development

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Use the Shapes buttons to add a box, cylinder, or sphere. New shapes appear on the workplane and are selected automatically. Click any object to select it; it turns orange and the sidebar confirms the selection. Click empty workspace to deselect it. Drag to orbit, scroll to zoom, and right-drag to pan.

```bash
npm run build
npm run preview
```

The Vite app needs a local server; opening `index.html` directly is not supported.

## Architecture

React holds CAD objects as application data in `src/cadModel.ts`. React Three Fiber renders those objects in `src/Workspace.tsx`, and Three.js supplies orbit controls. Objects have stable IDs, types, positions, rotations, scales, and shape-specific dimensions. Selection is stored separately as an object ID in React state. Scene lengths and dimensions use millimeters; rotation values use radians. New shapes are 20 mm tall and rest on the Y=0 workplane. Editing controls are planned for later milestones.

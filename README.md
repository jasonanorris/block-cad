# Block CAD

A simple browser-based 3D modeling project. The current milestone shows a responsive workspace with a starter box, grid, and orbit camera controls. Modeling tools are planned for later milestones.

## Local development

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Drag to orbit, scroll to zoom, and right-drag to pan.

```bash
npm run build
npm run preview
```

The Vite app needs a local server; opening `index.html` directly is not supported.

## Architecture

React holds CAD objects as application data in `src/cadModel.ts`. React Three Fiber renders those objects in `src/Workspace.tsx`, and Three.js supplies orbit controls. A box has a stable ID, type, position, rotation, scale, and dimensions. Scene lengths and dimensions use millimeters; rotation values use radians. The starter box is 20 × 20 × 20 mm and rests on the Y=0 workplane. Editing controls are planned for later milestones.

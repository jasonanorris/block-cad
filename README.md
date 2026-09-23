# Block CAD

A simple browser-based 3D modeling project. The foundation milestone shows a responsive workspace with a temporary cube, grid, and orbit camera controls. Modeling tools are planned for later milestones.

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

React renders the application layout. React Three Fiber renders the temporary scene in `src/Workspace.tsx`, and Three.js supplies orbit controls. The cube is hard-coded only for this foundation milestone. Milestone 2 will introduce CAD object data as the source of truth, separate from Three.js objects. Scene dimensions are treated as millimeters.

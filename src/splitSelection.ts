import type { Manifold, Mat4 } from 'manifold-3d'
import { isHoleObject, type CadObject, type Vector3 } from './cadModel'
import { objectMatrix, readSolidManifold } from './booleanGeometry'
import { canPositionUnits, getPlacementUnits } from './placement'
import { loadManifold } from './manifoldRuntime'
import { encodeStlMesh, MAX_STL_TRIANGLES } from './stlMesh'

function splitMesh(solid: Manifold, source: CadObject, side: string): CadObject {
  if (solid.isEmpty() || solid.volume() <= 1e-9 || solid.status() !== 'NoError') {
    throw new Error('The plane must pass through every selected body, leaving solid material on both sides.')
  }
  const mesh = solid.getMesh()
  if (mesh.numTri > MAX_STL_TRIANGLES) throw new Error('A split result exceeds the 100,000 triangle mesh limit.')
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < mesh.numVert; i++) for (let axis = 0; axis < 3; axis++) {
    const value = mesh.vertProperties[i * mesh.numProp + axis]
    min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value)
  }
  const center = min.map((value, axis) => (value + max[axis]) / 2)
  const size = min.map((value, axis) => max[axis] - value)
  if (![...center, ...size].every(Number.isFinite) || size.some((value) => value <= 0)) throw new Error('The split produced invalid dimensions.')
  const positions = new Float32Array(mesh.triVerts.length * 3)
  for (let i = 0; i < mesh.triVerts.length; i++) for (let axis = 0; axis < 3; axis++) {
    positions[i * 3 + axis] = mesh.vertProperties[mesh.triVerts[i] * mesh.numProp + axis] - center[axis]
  }
  return { id: crypto.randomUUID(), type: 'stl', name: `${(source.name || source.type).slice(0, 65)} · ${side}`,
    ...(source.color ? { color: source.color } : {}), meshData: encodeStlMesh(positions),
    dimensions: { x: size[0], y: size[1], z: size[2] }, position: { x: center[0], y: center[1], z: center[2] },
    rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } }
}

export async function splitSelection(objects: CadObject[], ids: Set<string>, axis: keyof Vector3, position: number) {
  if (!['x', 'y', 'z'].includes(axis) || !Number.isFinite(position)) throw new Error('Choose a valid split axis and position.')
  const units = getPlacementUnits(objects, ids)
  if (!canPositionUnits(objects, units) || units.some((unit) => isHoleObject(unit.body.anchor))) {
    throw new Error('Select visible, unlocked solids and unlock/show their linked holes before splitting.')
  }
  const runtime = await loadManifold()
  const normal: [number, number, number] = [axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0]
  const pieces: CadObject[] = []
  for (const unit of units) {
    readSolidManifold(unit.body, runtime, (solid) => {
      const world = solid.transform(objectMatrix(unit.body.anchor).elements as Mat4)
      try {
        const halves = world.splitByPlane(normal, position)
        try {
          pieces.push(splitMesh(halves[0], unit.body.anchor, `${axis.toUpperCase()} high`),
            splitMesh(halves[1], unit.body.anchor, `${axis.toUpperCase()} low`))
        } finally { halves.forEach((half) => half.delete()) }
      } finally { world.delete() }
    })
  }
  const replaced = new Set(units.flatMap((unit) => [...unit.ids]))
  return { objects: [...objects.filter((object) => !replaced.has(object.id)), ...pieces], selectedIds: pieces.map((piece) => piece.id) }
}

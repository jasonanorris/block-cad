import { createCadObject } from '../src/cadModel.ts'

export function box(id, x = 0, y = 10, z = 0) {
  return { ...createCadObject('box', x, z), id, position: { x, y, z } }
}

export function assembly(mode) {
  return [
    { ...box('a'), joinGroupId: 'g', joinMode: mode },
    { ...box('b', 10), joinGroupId: 'g', joinMode: mode },
    { ...box('hole', 5), dimensions: { x: 2, y: 30, z: 2 }, cutTargetId: 'a', groupedWithTarget: true },
  ]
}

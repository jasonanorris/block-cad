import { isHoleObject, type CadObject, type CadObjectType } from './cadModel'

export const shapeLabels: Record<CadObjectType, string> = {
  box: 'Box',
  cylinder: 'Cylinder',
  sphere: 'Sphere',
  cone: 'Cone',
  wedge: 'Wedge',
  prism: 'Prism',
  svg: 'SVG',
  stl: 'STL',
}

export function objectLabel(object: CadObject, objects: CadObject[]) {
  const shape = `${shapeLabels[object.type]}${isHoleObject(object) ? ' hole' : ''}`
  const grouped = isHoleObject(object) ? object.groupedWithTarget :
    objects.some((hole) => isHoleObject(hole) && hole.groupedWithTarget && hole.cutTargetId === object.id)
  return `${object.name ? `${object.name} · ` : ''}${shape}${object.joinGroupId ? object.joinMode === 'intersection' ? ' · Intersected' : ' · Joined' : ''}${grouped ? ' · Grouped' : ''}${object.hidden ? ' · Hidden' : ''}${object.locked ? ' · Locked' : ''}`
}


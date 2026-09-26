import { isHoleObject, type CadObject, type CadObjectType } from './cadModel'

export const shapeLabels: Record<CadObjectType, string> = {
  custom: 'Custom shape',
  box: 'Box',
  cylinder: 'Cylinder',
  sphere: 'Sphere',
  cone: 'Cone',
  wedge: 'Wedge',
  prism: 'Prism',
  svg: 'SVG',
  text: 'Text',
  stl: 'STL',
}

export function objectLabelContext(objects: CadObject[]) {
  return { indices: new Map(objects.map((object, index) => [object.id, index + 1])),
    groupedTargets: new Set(objects.filter((object) => isHoleObject(object) && object.groupedWithTarget).map((object) => object.cutTargetId!)) }
}

export function objectLabel(object: CadObject, objects: CadObject[], context?: ReturnType<typeof objectLabelContext>) {
  const shape = `${shapeLabels[object.type]}${isHoleObject(object) ? ' hole' : ''}`
  const grouped = isHoleObject(object) ? object.groupedWithTarget :
    context ? context.groupedTargets.has(object.id) : objects.some((hole) => isHoleObject(hole) && hole.groupedWithTarget && hole.cutTargetId === object.id)
  return `${object.name ? `${object.name} · ` : ''}${shape}${object.joinGroupId ? object.joinMode === 'intersection' ? ' · Intersected' : ' · Joined' : ''}${grouped ? ' · Grouped' : ''}${object.hidden ? ' · Hidden' : ''}${object.locked ? ' · Locked' : ''}`
}


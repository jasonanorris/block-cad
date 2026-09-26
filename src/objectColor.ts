import { isHoleObject, type CadObject } from './cadModel'

export const DEFAULT_OBJECT_COLOR = '#6797ef'
export const validObjectColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)

export function colorObjects(objects: CadObject[], id: string, color: string): CadObject[] {
  if (!validObjectColor(color)) throw new Error('Choose a six-digit hexadecimal color.')
  const source = objects.find((object) => object.id === id)
  if (!source) return objects
  const affected = (object: CadObject) => object.id === id || !isHoleObject(source) && !!source.joinGroupId && object.joinGroupId === source.joinGroupId
  if (objects.some((object) => affected(object) && object.locked)) return objects
  return objects.map((object) => affected(object) && object.color !== color.toLowerCase() ? { ...object, color: color.toLowerCase() } : object)
}

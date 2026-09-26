import type { Point2 } from './cadModel'

export function regularPolygon(sides: number, radius: number): Point2[] {
  return Array.from({ length: sides }, (_, index) => {
    const angle = index * 2 * Math.PI / sides
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) }
  })
}

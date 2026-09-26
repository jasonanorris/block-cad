export const textFonts = [
  { id: 'helvetiker', label: 'Helvetiker Regular' },
  { id: 'helvetiker-bold', label: 'Helvetiker Bold' },
  { id: 'optimer', label: 'Optimer Regular' },
] as const
export type TextFont = typeof textFonts[number]['id']
export function isTextFont(value: unknown): value is TextFont {
  return textFonts.some((font) => font.id === value)
}

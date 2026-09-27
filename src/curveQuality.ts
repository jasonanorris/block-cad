export type CurveQuality = 'standard' | 'fine' | 'extra-fine'
export const CURVE_QUALITIES: Record<CurveQuality, { label: string; linear: number; angular: number; arcSteps: number; cornerSteps: number; sphereSegments: number }> = {
  standard: { label: 'Standard', linear: .02, angular: .15, arcSteps: 24, cornerSteps: 24, sphereSegments: 128 },
  fine: { label: 'Fine', linear: .005, angular: .075, arcSteps: 48, cornerSteps: 32, sphereSegments: 128 },
  'extra-fine': { label: 'Extra fine', linear: .00125, angular: .0375, arcSteps: 96, cornerSteps: 48, sphereSegments: 192 },
}
export function curveQuality(value: unknown = 'fine'): CurveQuality {
  if (value !== 'standard' && value !== 'fine' && value !== 'extra-fine') throw new Error('Choose Standard, Fine, or Extra fine curve quality.')
  return value
}
// Analytic faces share a tessellation: honor the finest request in the body.
export function bodyCurveQuality(features: { quality?: CurveQuality }[]): CurveQuality {
  return features.reduce<CurveQuality>((best, feature) => {
    const quality = curveQuality(feature.quality)
    return CURVE_QUALITIES[quality].linear < CURVE_QUALITIES[best].linear ? quality : best
  }, features.length ? 'standard' : 'fine')
}

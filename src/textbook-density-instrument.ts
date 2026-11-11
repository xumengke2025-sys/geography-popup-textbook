import { evaluateDensityComparison } from './textbook-ground-process-model';

/** Mechanical dimensions are schematic, not a calibrated mass or volume scale. */
export const DENSITY_INSTRUMENT = {
  pivot: [50, 54, 17] as const,
  arm: 31,
  suspension: 34,
  cupOuterRadius: 6.6,
  cupInnerRadius: 5.9,
  waterRadius: 5.84,
  cupHeight: 15,
  waterHeight: 11.6,
  panRadius: 9.4,
} as const;

/** A balance has a rotating beam and two plumb suspensions. No scientific
 * state is integrated over time and neither sample is rescaled to look heavy. */
export function densityInstrumentPose(selection: number) {
  const science = evaluateDensityComparison(selection);
  const { pivot, arm, suspension } = DENSITY_INSTRUMENT;
  const suspensions = ([-1, 1] as const).map(side => {
    const anchor = [pivot[0] + side * arm * Math.cos(science.angle),
      pivot[1] + side * arm * Math.sin(science.angle), pivot[2]] as [number, number, number];
    return { anchor, pan: [anchor[0], anchor[1] - suspension, anchor[2]] as [number, number, number] };
  });
  return { ...science, suspensions, sampleVolume: Math.PI * DENSITY_INSTRUMENT.waterRadius ** 2 * DENSITY_INSTRUMENT.waterHeight,
    volumeIsTeachingGeometry: true, calibratedReadout: false };
}

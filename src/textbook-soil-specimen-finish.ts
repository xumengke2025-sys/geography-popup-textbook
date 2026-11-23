import { applyEarthScan, type EarthScan } from './textbook-earth-scan';
import { createSolidMaterial } from './textbook-solid-materials';

/** Pigment identifies the horizon; the measured surface supplies grain, pores,
 * incident-light response and roughness even on a newly exposed cut face. */
export function createSoilSpecimenFinish(pop: any, color: string, level: number, scale: number,
  scan: EarthScan = level === 0 ? 'outcrop' : 'loam') {
  const material = createSolidMaterial(pop, level === 0 ? 'rock' : 'land', color);
  const span = scan === 'alluvium' ? 8 : scan === 'outcrop' ? 19 : scan === 'turf' ? 12 : 13;
  return applyEarthScan(material, scan, span * scale);
}

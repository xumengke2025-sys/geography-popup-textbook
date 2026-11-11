import { basinGround, basinRiverPoint, basinFloodLevel } from './textbook-integrated-model';

const smooth = (x: number) => { const a = Math.max(0, Math.min(1, x)); return a * a * (3 - 2 * a); };
const ridge = (x: number, z: number, cx: number, cz: number, rx: number, rz: number, skew = 0) => {
  const u = x - cx, v = z - cz - skew * u;
  return Math.exp(-2.1 * Math.abs(u / rx) ** 1.45 - 1.8 * v * v / (rz * rz));
};

/** Sculpted dry shoulders for an explanatory relief specimen. The scientific
 * river, banks and every point reachable by the maximum flood retain their
 * original elevation exactly. Broad ridges, not random displacement, give
 * the upper basin a directional mountain silhouette. No calibrated geology. */
export function basinSpecimenGround(x: number, z: number): number {
  const original = basinGround(x, z), river = basinRiverPoint((x - 8) / 91);
  const bankDistance = Math.abs(z - river[2]);
  const dryShoulder = smooth((bankDistance - 12) / 7) * smooth((original - basinFloodLevel(x, 1) - 2) / 7);
  if (dryShoulder === 0) return original;
  const rear = z < river[2];
  const relief = rear
    ? 14 * ridge(x, z, 15, 7, 8, 10, .28)
      + 11 * ridge(x, z, 33, 10, 8.5, 8, -.27)
      + 7 * ridge(x, z, 52, 7, 9, 9, .24)
      + 3.5 * ridge(x, z, 71, 12, 10, 7, -.18)
    : 4.8 * ridge(x, z, 16, 57, 13, 8, -.23)
      + 3.3 * ridge(x, z, 41, 55, 14, 8, .18)
      + 1.4 * ridge(x, z, 66, 58, 15, 8, -.15);
  return original + dryShoulder * relief;
}

/** The colours are a diagrammatic material treatment, never a soil/vegetation
 * map. Heights and channels remain defined by the terrain functions above. */
export function basinSurfaceTreatment(x: number, z: number) {
  const river = basinRiverPoint((x - 8) / 91), distance = Math.abs(z - river[2]);
  const dx = (basinSpecimenGround(x + .35, z) - basinSpecimenGround(x - .35, z)) / .7;
  const dz = (basinSpecimenGround(x, z + .35) - basinSpecimenGround(x, z - .35)) / .7;
  return { slope: Math.hypot(dx, dz), gravel: 1 - smooth((distance - 3.5) / 3.8),
    highRock: smooth((basinSpecimenGround(x, z) - 36) / 20) };
}

/** Gentle, laterally continuous specimen bedding. These are invented material
 * bands on the teaching cut face, not dated or surveyed geological strata. */
export function basinSpecimenBedding(boundary: number, x: number, z: number): number {
  if (boundary <= -4) return -4;
  return boundary + .45 * Math.sin(x * .055 + z * .035) + .18 * Math.cos(z * .08);
}

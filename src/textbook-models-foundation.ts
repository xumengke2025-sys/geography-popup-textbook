import { buildWaterRenewalWorld } from './textbook-water-renewal-world';
import { THREE as T } from './reference/engine.js';
import { PALETTE as C, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { buildSoilTextureWorld } from './textbook-soil-texture-world';
import { buildSoilCareWorld } from './textbook-soil-care-world';
import { buildSeismicInstrumentWorld } from './textbook-seismic-instrument-world';
import { buildInsolationWorld } from './textbook-insolation-world';
import { buildCaveDepositionWorld, buildSoilPoreWorld } from './textbook-foundation-process-world';

/** Additional explanations are derived from the textbook prose, never from a
 * cropped illustration. All dimensions and rates below are teaching choices. */
export function buildFoundation(b: TextbookGeometry, effect: string): ModelMotion | null {
  const s = b.width / 100, p = (u: number, v: number, h = 0) => b.p(u, v, h * s);
  if (effect === 'solar-distribution') return buildInsolationWorld(b);
  if (effect === 'seismic-waves') return buildSeismicInstrumentWorld(b);
  if (effect === 'water-renewal') return buildWaterRenewalWorld(b);
  if (effect === 'karst-cave') return buildCaveDepositionWorld(b);
  if (effect === 'soil-composition') return buildSoilPoreWorld(b);
  if (effect === 'soil-texture') return buildSoilTextureWorld(b);
  if (effect === 'soil-care') return buildSoilCareWorld(b);
  if (effect === 'cold-wave') {
    const z = p(0, .8)[2];
    b.terrain(b.width * .07, b.width * .93, z - 15 * s, z + 13 * s, (x, zz) => (3 + 2 * Math.sin(x / b.width * 8) * Math.cos((zz - z) / (20 * s))) * s, C.land, 20, 10, 0);
    b.house([b.width * .72, 5 * s, z], 10 * s, 7 * s);
    const front = b.box([b.width * .14, 4 * s, z - 14 * s], [b.width * .16, 25 * s, z + 12 * s], C.cool, false);
    for (const u of [.47, .55, .62]) b.cylinder([u * b.width, 3 * s, z + 5 * s], [u * b.width, 9 * s, z + 5 * s], .22 * s, C.green);
    b.label('冷空气', p(.22, .78, 34), 17 * s, 5 * s);
    b.label('暖空气', p(.82, .78, 34), 17 * s, 5 * s);
    let advance = .1, advancing = false;
    return { update(t, selection) {
      advancing = selection === 1;
      advance = selection === 0 ? .1 : .1 + t * .65;
      front.position.x = (advance - .14) * b.width;
      if (selection === 1) b.trace([p(.05, .8, 13), p(.82, .8, 13)], t, 5);
    }, describe: () => ({ kind: 'cold-wave', advancing, advance, schematicDirection: true, definedByActualCoolingThreshold: false, cropDamageGuaranteed: false }) };
  }
  return null;
}

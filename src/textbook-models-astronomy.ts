import { type TextbookGeometry, type ModelMotion } from './textbook-geometry';
import type { Effect } from './textbook-catalog';
import { buildEarthInstrumentWorld } from './textbook-earth-instrument-world';
import { buildSolarHeatingWorld } from './textbook-solar-heating-world';
import { buildOrreryWorld } from './textbook-orrery-world';

export function buildAstronomy(b: TextbookGeometry, effect: Effect): ModelMotion {
  if (effect === 'orbit') return buildOrreryWorld(b);
  if (effect === 'radiation') return buildSolarHeatingWorld(b);
  return buildEarthInstrumentWorld(b);
}

export { buildStrataWorld as buildStrata } from './textbook-strata-world';
import { TextbookGeometry, type ModelMotion } from './textbook-geometry';
import type { Effect } from './textbook-catalog';
import { buildBreeze } from './textbook-coastal-world';
import { buildPressureWind } from './textbook-pressure-world';
import { buildAirProcessWorld } from './textbook-air-process-world';
import { buildAtmosphereWorld } from './textbook-atmosphere-world';

export function buildAir(b: TextbookGeometry, effect: Effect): ModelMotion {
  if (effect === 'breeze') return buildBreeze(b);
  if (effect === 'pressure') return buildPressureWind(b);
  if (effect === 'heat' || effect === 'circulation') return buildAirProcessWorld(b, effect);
  return buildAtmosphereWorld(b);
}

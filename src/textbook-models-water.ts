import { type TextbookGeometry, type ModelMotion } from './textbook-geometry';
import type { Effect } from './textbook-catalog';
import { buildWaveWorld } from './textbook-wave-world';
import { buildTideWorld } from './textbook-tide-world';
import { buildWaterCycleWorld } from './textbook-water-cycle-world';
import { buildCurrentWorld } from './textbook-current-world';
import { buildTemperatureWorld } from './textbook-temperature-world';

export const buildWaterCycle = buildWaterCycleWorld;

export function buildOcean(b: TextbookGeometry, effect: Effect): ModelMotion {
  if (effect === 'water') return buildWaterCycle(b);
  if (effect === 'wave') return buildWaveWorld(b);
  if (effect === 'tide') return buildTideWorld(b);
  if (effect === 'current') return buildCurrentWorld(b);
  if (effect === 'temperature') return buildTemperatureWorld(b);
  return { update() {} };
}

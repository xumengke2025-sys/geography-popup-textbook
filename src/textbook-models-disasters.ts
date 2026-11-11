import type { TextbookGeometry, ModelMotion } from './textbook-geometry';
import type { Effect } from './textbook-catalog';
import { buildGisWorld } from './textbook-gis-world';
import { buildQuakeWorld } from './textbook-quake-world';
import { buildLandslideWorld } from './textbook-landslide-world';
import { buildRemoteWorld } from './textbook-remote-world';
import { buildTyphoonWorld } from './textbook-typhoon-world';
import { buildRecoveryWorld } from './textbook-recovery-world';

export function buildDisasters(b: TextbookGeometry, effect: Effect): ModelMotion {
  if (effect === 'quake') return buildQuakeWorld(b);
  if (effect === 'typhoon') return buildTyphoonWorld(b);
  if (effect === 'landslide') return buildLandslideWorld(b);
  if (effect === 'rescue') return buildRecoveryWorld(b);
  throw new Error(`Unsupported disaster demonstration: ${effect}`);
}

export function buildGeoTechnology(b: TextbookGeometry, effect: Effect): ModelMotion {
  if (effect === 'gis') return buildGisWorld(b);
  if (effect === 'remote') return buildRemoteWorld(b);
  throw new Error(`Unsupported geography technology: ${effect}`);
}

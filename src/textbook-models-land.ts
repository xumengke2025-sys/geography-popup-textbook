import type { TextbookGeometry, ModelMotion } from './textbook-geometry';
import type { Effect } from './textbook-catalog';
import { buildRiverWorld } from './textbook-river-world';
import { buildKarstWorld } from './textbook-karst-world';
import { buildSoilProfileWorld } from './textbook-soil-profile-world';
import { buildForestWorld } from './textbook-forest-world';
import { buildSlopeWorld } from './textbook-slope-world';

export function buildLand(b: TextbookGeometry, effect: Effect): ModelMotion {
  if (effect === 'forest') return buildForestWorld(b);
  if (effect === 'soil') return buildSoilProfileWorld(b);
  if (effect === 'karst') return buildKarstWorld(b);
  if (effect === 'river') return buildRiverWorld(b);
  if (effect === 'slope') return buildSlopeWorld(b);
  throw new Error(`Unsupported land demonstration: ${effect}`);
}


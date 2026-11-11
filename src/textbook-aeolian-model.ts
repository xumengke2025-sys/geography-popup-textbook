/** Textbook pp.72–73: four independent wind-landform examples.
 * phase is bounded demonstration progress, never a geological date or a
 * measured erosion/migration rate. Only explicit replay/seek may rewind it. */
export const AEOLIAN_REFERENCE = {
  printedPages: [72, 73], pdfPages: [77, 78],
  requiredLandformSequence: false, measuredRate: false,
  distancesAndTimeAreSchematic: true, wind: 'positive-x',
} as const;

export const AEOLIAN_FORMS = ['mushroom', 'yardang', 'barchan', 'stabilized-dune'] as const;
export const AEOLIAN_TITLES = ['风蚀蘑菇', '雅丹', '新月形沙丘', '植被固沙'] as const;
/** The original lathed stone profile, in the model's 100-wide teaching frame. */
export const AEOLIAN_STONE_PROFILE = [
  [0, 0], [9, 0], [8, 2], [6, 7], [6, 13], [11, 17],
  [13, 20], [11, 25], [5, 27], [0, 27.5],
] as const;

const clamp = (n: number) => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
const cycle = (n: number) => ((n % 1) + 1) % 1;

/** Both the Three.js stone and the SVG silhouette use this lower-rock
 * erosion envelope. The upper cap is much less affected than the neck. */
export function aeolianRadiusScale(height: number, erosion: number): number {
  return 1 - .5 * clamp(erosion) * Math.exp(-(((height - 8) / 6.5) ** 2));
}

export interface AeolianGrain {
  id: number;
  x: number;
  depth: number;
  height: number;
  visible: boolean;
}
export interface AeolianState {
  phase: number;
  selection: number;
  form: typeof AEOLIAN_FORMS[number];
  title: typeof AEOLIAN_TITLES[number];
  erosion: number;
  neckScale: number;
  duneOffset: number;
  stabilized: boolean;
  windPhase: number;
  grains: AeolianGrain[];
  independentForms: true;
  processIsSchematic: true;
  playback: 'once';
}

export function evaluateAeolian(phase: number, selection = 0): AeolianState {
  const t = clamp(phase);
  const n = Number.isFinite(selection) ? Math.max(0, Math.min(3, Math.round(selection))) : 0;
  const erosion = .55 + .45 * t;
  return {
    phase: t, selection: n, form: AEOLIAN_FORMS[n], title: AEOLIAN_TITLES[n],
    erosion, neckScale: aeolianRadiusScale(8, erosion),
    duneOffset: n === 2 ? (t - .5) * 12 : 0,
    stabilized: n === 3, windPhase: t,
    // Individual transport tracers may re-enter the illustrated wind field;
    // accumulated erosion and landform positions never use that cyclic phase.
    grains: Array.from({ length: 18 }, (_, id) => {
      const x = cycle(t + id / 18), depth = .2 + (id % 5) * .14;
      const height = 2.4 + (id % 3) * .7
        + (n >= 2 ? 13 * Math.exp(-(((x - .48) / .17) ** 2)) * (1 - Math.abs(depth - .5)) : 0);
      return { id, x, depth, height, visible: n !== 3 || x < .54 };
    }),
    independentForms: true, processIsSchematic: true, playback: 'once',
  };
}

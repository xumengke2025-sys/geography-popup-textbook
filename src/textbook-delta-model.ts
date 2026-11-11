/** Textbook pp.70–71. All distances, parcel sizes and timings are teaching
 * settings. This is one asymmetric river-mouth example, not a dated coast
 * or a rule that every delta has the same outline. */
export type DeltaPoint = [number, number];
export type DeltaPosition = [number, number, number];
export type DeltaGrainClass = 'coarse' | 'medium' | 'fine';
export type DeltaGrainStage = 'waiting' | 'transport' | 'slowing' | 'settling' | 'deposited';

export const DELTA_MOUTH: DeltaPoint = [.49, .34];
export const DELTA_GRAIN_COUNT = 54;
export const DELTA_BASE = 1.35;
export const DELTA_TOP = 7.2;
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const smooth = (a: number, b: number, n: number) => { const q = clamp((n - a) / (b - a)); return q * q * (3 - 2 * q); };
const spread: readonly DeltaPoint[] = [[-.25, .45], [.035, .55], [.285, .39]];
const radii = [.72, .49, .30] as const;
const grainClasses: readonly DeltaGrainClass[] = ['coarse', 'medium', 'fine'];

export interface DeltaGrain {
  id: number;
  branch: number;
  grainClass: DeltaGrainClass;
  radius: number;
  stage: DeltaGrainStage;
  position: DeltaPosition;
  target: DeltaPosition;
  targetQ: number;
  releaseAt: number;
  mouthAt: number;
  settlingAt: number;
  depositedAt: number;
  deposition: number;
  /** Local normalized distance per phase, never metres per second. */
  pathSpeed: number;
}
export interface DeltaDepositionState {
  phase: number;
  grains: DeltaGrain[];
  branches: { front: number; deposition: number }[];
  deposited: number;
  settling: number;
  transported: number;
  deposition: number;
  shoreline: DeltaPoint[];
}

export function deltaMainPoint(q: number): DeltaPoint {
  const t = clamp(q);
  return [DELTA_MOUTH[0] + .023 * Math.sin(t * Math.PI * 2) * Math.sin(t * Math.PI), .025 + (.34 - .025) * t];
}

/** Unequal, bent distributaries retain an explicitly non-universal shape. */
export function deltaBranchPoint(branch: number, q: number): DeltaPoint {
  const t = Math.max(0, Math.min(1.14, q)), [dx, dv] = spread[branch];
  return [DELTA_MOUTH[0] + dx * t + .022 * Math.sin(t * Math.PI) * (branch === 1 ? -1 : .7), DELTA_MOUTH[1] + dv * t];
}

function frontContour(fronts: readonly number[]): DeltaPoint[] {
  const out: DeltaPoint[] = [];
  // A connected envelope is sampled in polar order for a quiet paper outline.
  // The surface itself uses the union of three lobes rather than this outline.
  for (let i = 0; i <= 72; i++) {
    const angle = -1.2 + 2.4 * i / 72;
    let reach = 0;
    for (let j = 0; j < 3; j++) {
      const tip = deltaBranchPoint(j, fronts[j]), dx = tip[0] - DELTA_MOUTH[0], dv = tip[1] - DELTA_MOUTH[1];
      const direction = Math.atan2(dx, dv), taper = Math.exp(-(((angle - direction) / .39) ** 2));
      reach = Math.max(reach, Math.hypot(dx, dv) * taper);
    }
    out.push([DELTA_MOUTH[0] + Math.sin(angle) * reach, DELTA_MOUTH[1] + Math.cos(angle) * reach]);
  }
  return out;
}

export function evaluateDeltaDeposition(phase: number): DeltaDepositionState {
  const t = clamp(phase), branches = Array.from({ length: 3 }, () => ({ front: .025, deposition: 0 }));
  const grains = Array.from({ length: DELTA_GRAIN_COUNT }, (_, id): DeltaGrain => {
    const size = id % 3, branch = Math.floor(id / 3) % 3, wave = Math.floor(id / 9);
    const releaseAt = .008 + wave * .037 + branch * .006;
    const mouthAt = releaseAt + .16, slowingDuration = [.22, .32, .42][size];
    const settlingAt = mouthAt + slowingDuration, depositedAt = settlingAt + [.065, .085, .105][size];
    const targetQ = [.26, .49, .74][size] + wave * .025;
    const lateral = ((wave % 3) - 1) * .012, targetPlan = deltaBranchPoint(branch, targetQ);
    const target: DeltaPosition = [targetPlan[0] + lateral, DELTA_TOP + radii[size] * .62, targetPlan[1]];
    let stage: DeltaGrainStage = 'waiting', position: DeltaPosition = [deltaMainPoint(0)[0], 9.7, .025], pathSpeed = 0;
    if (t >= releaseAt && t < mouthAt) {
      stage = 'transport'; const q = (t - releaseAt) / .16, point = deltaMainPoint(q);
      position = [point[0] + lateral * .25, 9.7 - q * .35, point[1]]; pathSpeed = (.34 - .025) / .16;
    } else if (t >= mouthAt && t < settlingAt) {
      stage = 'slowing'; const q = (t - mouthAt) / slowingDuration, travel = q * (2 - q), point = deltaBranchPoint(branch, targetQ * travel);
      position = [point[0] + lateral * (.25 + .75 * travel), 9.35 - .3 * travel, point[1]];
      pathSpeed = targetQ * spread[branch][1] * 2 * (1 - q) / slowingDuration;
    } else if (t >= settlingAt && t < depositedAt) {
      stage = 'settling'; const fall = smooth(settlingAt, depositedAt, t);
      position = [target[0], 9.05 + (target[1] - 9.05) * fall, target[2]];
    } else if (t >= depositedAt) { stage = 'deposited'; position = [...target]; }
    const deposition = smooth(settlingAt, depositedAt, t);
    branches[branch].deposition += deposition;
    // No independent clock scales a fan. Only actual falling/landed parcels
    // supply this front, which reaches its new position as they reach the bed.
    branches[branch].front = Math.max(branches[branch].front, (targetQ + .105) * deposition);
    return { id, branch, grainClass: grainClasses[size], radius: radii[size], stage, position, target,
      targetQ, releaseAt, mouthAt, settlingAt, depositedAt, deposition, pathSpeed };
  });
  return { phase: t, grains, branches, deposited: grains.filter(g => g.stage === 'deposited').length,
    settling: grains.filter(g => g.stage === 'settling').length,
    transported: grains.filter(g => g.stage === 'transport' || g.stage === 'slowing').length,
    deposition: grains.reduce((sum, g) => sum + g.deposition, 0), shoreline: frontContour(branches.map(b => b.front)) };
}

/** Closed sediment surface used by both Three.js and SVG. Each lobe widens
 * independently and its bed is permanent once the contributing parcel lands.
 * Its exaggerated relief makes accumulation readable, not a water-depth map. */
export function deltaBedHeight(state: DeltaDepositionState, u: number, v: number): number {
  if (v < DELTA_MOUTH[1] - .018) return DELTA_BASE;
  let fill = 0;
  for (let i = 0; i < 3; i++) {
    const q = (v - DELTA_MOUTH[1]) / spread[i][1];
    if (q < -.04 || q > state.branches[i].front + .06) continue;
    const center = deltaBranchPoint(i, Math.max(0, q)), width = .042 + .045 * Math.sqrt(Math.max(0, q));
    const lateral = 1 - smooth(width * .40, width, Math.abs(u - center[0]));
    const distal = 1 - smooth(state.branches[i].front - .065, state.branches[i].front + .035, q);
    fill = Math.max(fill, lateral * distal);
  }
  return DELTA_BASE + (DELTA_TOP - DELTA_BASE) * fill;
}

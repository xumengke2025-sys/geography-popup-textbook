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
  return [DELTA_MOUTH[0] + dx * t + (.023 * Math.sin(t * Math.PI * 2.6 + branch * 1.7) + .012 * Math.sin(t * Math.PI * 5.1 + branch)) * Math.sin(t * Math.PI), DELTA_MOUTH[1] + dv * t];
}

function frontContour(fronts: readonly number[]): DeltaPoint[] {
  const out: DeltaPoint[] = [];
  // Adjacent dispersal lobes overlap into a common alluvial apron. A small
  // shore sinuosity breaks the ideal curves while preserving monotonic growth.
  for (let i = 0; i <= 72; i++) {
    const angle = -Math.PI / 2 + Math.PI * i / 72;
    let reach = 0;
    for (let j = 0; j < 3; j++) {
      const [dx, dv] = spread[j];
      const direction = Math.atan2(dx, dv), taper = Math.exp(-(((angle - direction) / .86) ** 2));
      reach = Math.max(reach, Math.hypot(dx, dv) * fronts[j] * taper);
    }
    reach *= 1 + .036*Math.sin(13*angle) + .017*Math.cos(29*angle) + .009*Math.sin(43*angle);
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
  if (v < DELTA_MOUTH[1] - .015) return DELTA_BASE;
  const dx = u - DELTA_MOUTH[0], dv = Math.max(0,v - DELTA_MOUTH[1]);
  const last = state.shoreline.length - 1;
  const index = (Math.atan2(dx,dv)/Math.PI+.5)*last;
  const i = Math.min(last-1,Math.floor(index)), fraction=index-i;
  const a=state.shoreline[i], b=state.shoreline[i+1];
  const reach=Math.hypot(a[0]+(b[0]-a[0])*fraction-DELTA_MOUTH[0],a[1]+(b[1]-a[1])*fraction-DELTA_MOUTH[1]);
  const fill=1-smooth(.935,1.18,Math.hypot(dx,dv)/Math.max(reach,.001));
  return DELTA_BASE + (DELTA_TOP - DELTA_BASE) * fill;
}

/** Channel-incised sand and paired natural levees. The scalar is fixed per
 * sampling point; the live mass envelope still comes solely from landed grains. */
export function deltaSandTopography(u: number, v: number) {
  const distance = Math.min(...spread.map(([, dv], branch) => {
    const q = Math.max(0, Math.min(1.03, (v - DELTA_MOUTH[1]) / dv));
    return Math.hypot(u - deltaBranchPoint(branch, q)[0], (v - DELTA_MOUTH[1] - q * dv) * .60);
  }));
  const bank = .7 * Math.exp(-(((distance - .018) / .012) ** 2));
  const cut = 2.12 * Math.exp(-((distance / .013) ** 2));
  const overbank = .21 * Math.sin(u * 130 + v * 27 + Math.sin(v * 32)) + .14 * Math.sin(v * 115 - u * 43);
  return bank - cut + overbank;
}
export function deltaSurfaceHeight(state: DeltaDepositionState, u: number, v: number, detail = deltaSandTopography(u, v)) {
  const bed = deltaBedHeight(state, u, v);
  return bed + detail * (bed - DELTA_BASE) / (DELTA_TOP - DELTA_BASE);
}
export const DELTA_WATER = 6.34;

export function deltaPoolPoint(id: number): [number,number,number] {
  const angle = id * 2.399963, r = Math.sqrt((id + .5) / DELTA_GRAIN_COUNT) * 5.53;
  return [49 + r * Math.cos(angle), 22.85 - .13 * r, -2.5 + r * Math.sin(angle)];
}

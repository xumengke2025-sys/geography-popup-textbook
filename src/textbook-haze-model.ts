import { hazeChamberDrawing } from './textbook-pneumatic-drawings';
/** Textbook pp.42–44: source emissions and meteorological conditions both
 * matter. Every coordinate/rate is a teaching setting, not a measured plume,
 * AQI, emission inventory, health threshold or clearance time. Three trials
 * share the same initial stock; selecting a condition replays that trial. */
export type HazeMode = 0 | 1 | 2;
export interface HazeParticle {
  id: number;
  cohort: 'existing' | 'new';
  born: number;
  x: number;
  y: number;
  z: number;
  size: number;
  visible: boolean;
  emitted: boolean;
  exited: boolean;
}
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const smooth = (value: number) => { const q = clamp(value); return q * q * (3 - 2 * q); };
const hash = (id: number, salt = 0) => { const v = Math.sin((id + 1) * 127.1 + salt * 311.7) * 43758.5453; return v - Math.floor(v); };
const EXISTING = 36, NEW = 60;
const START = .06, END = .28;
/** Exact integral of the smooth wind ramp; positions are deterministic when
 * the timeline is dragged backwards, jumped or rendered at another FPS. */
function windIntegral(t: number) {
  if (t <= START) return 0;
  if (t >= END) return t - (START + END) / 2;
  const q = (t - START) / (END - START);
  return (END - START) * (q ** 3 - .5 * q ** 4);
}
function sourceRate(t: number, mode: HazeMode) { return mode === 2 ? 1 - .82 * smooth((t - .06) / .20) : 1; }
function travel(from: number, to: number, mode: HazeMode) {
  return 28 * (to - from) + (mode === 1 ? 106 * (windIntegral(to) - windIntegral(from)) : 0);
}
export function evaluateHaze(phase: number, selection: number) {
  const t = clamp(phase), mode = Math.max(0, Math.min(2, Math.round(Number.isFinite(selection) ? selection : 0))) as HazeMode;
  const particles: HazeParticle[] = [];
  for (let id = 0; id < EXISTING + NEW; id++) {
    const legacy = id < EXISTING, j = id - EXISTING;
    const born = legacy ? 0 : .015 + j / NEW * .95;
    // A fixed low-discrepancy sample thins future emissions only. Existing
    // parcels keep their identity, size and removal rule in the reduced trial.
    const admitted = legacy || hash(j, 7) <= sourceRate(born, mode);
    const emitted = admitted && t >= born, age = Math.max(0, t - born);
    const x0 = legacy ? 27 + hash(id, 1) * 73 : 17;
    const x = x0 + travel(born, t, mode);
    const y = legacy ? 27 + hash(id, 2) * 14 + Math.sin(age * 3 + id) * age * 1.3
      : 19 + 13 * (1 - Math.exp(-age * 10)) + Math.sin(age * 5 + id * 1.7) * Math.min(2.4, age * 8);
    const z0 = legacy ? 26 + hash(id, 3) * 27 : 40;
    const z = z0 + Math.sin(age * 4 + id * 2.4) * Math.min(5, age * 8);
    const exited = emitted && x >= 108;
    // Birth and exit have small geometric tapers; no full-screen fog, no
    // transparency animation that erases the initial stock on a button press.
    const size = (.64 + hash(id, 5) * .44) * (legacy ? 1 : smooth(age / .025)) * (1 - smooth((x - 103) / 5));
    particles.push({ id, cohort: legacy ? 'existing' : 'new', born, x, y, z, size, emitted, exited, visible: emitted && !exited && size > .001 });
  }
  const emitted = particles.filter(p => p.emitted).length;
  const removed = particles.filter(p => p.exited).length;
  return {
    kind: 'air-pollution-stock' as const, phase: t, mode, initialStock: EXISTING,
    emittedNew: emitted - EXISTING, removed, stock: emitted - removed,
    existingRemaining: particles.filter(p => p.cohort === 'existing' && !p.exited).length,
    fanAngle: -2.2*t - (mode === 1 ? 14.2*windIntegral(t) : 0),
    sourceRate: sourceRate(t, mode), windStrength: mode === 1 ? smooth((t - START) / (END - START)) : 0,
    particles, units: 'dimensionless-teaching-only' as const,
    particlesAreMeasured: false, aqiComputed: false, instantCleanupClaimed: false,
  };
}

/** No-WebGL mode shares the same parcels, source schedule and wind integral. */
export function hazeSvg(phase: number, selection: number) {
  return hazeChamberDrawing(evaluateHaze(phase,selection));
}

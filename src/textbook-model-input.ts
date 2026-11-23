import type { Vec3 } from './textbook-geometry';

export interface PhaseDial {
  center: Vec3;
  radiusX: number;
  radiusY: number;
  /** Complete revolutions between the two ends of a bounded demonstration. */
  turns?: number;
  /** A lateral drive shaft turns in the YZ plane. */
  plane?: 'yz';
}
export interface PhaseTrack {
  start: Vec3;
  end: Vec3;
}
export interface IndexedDial {
  kind: 'indexed-dial';
  dial: PhaseDial;
  start: number;
  step: number;
  stops: readonly ({ selection: number } | { inspection: string })[];
  toggleOnTap?: boolean;
  advanceAtHub?: boolean;
  keepPhase?: boolean;
  label: string;
}

export function nearestDialStop(x: number, y: number, input: IndexedDial) {
  const dx = (x - input.dial.center[0]) / input.dial.radiusX;
  const dy = (y - input.dial.center[1]) / input.dial.radiusY;
  if (!Number.isFinite(dx + dy) || Math.hypot(dx, dy) < .20) return null;
  let best = 0, score = -Infinity;
  for (let i = 0; i < input.stops.length; i++) {
    const angle = input.start + i * input.step;
    const distanceAlongRay = dx * Math.cos(angle) + dy * Math.sin(angle);
    if (distanceAlongRay > score) { best = i; score = distanceAlongRay; }
  }
  return best;
}

export type ModelInput =
  | IndexedDial
  | { kind: 'select'; selection: number; toggleTo?: number; keepPhase?: boolean; label: string }
  | { kind: 'inspect'; target: string; toggleTo?: string; label: string }
  | { kind: 'replay'; selection?: number; label: string }
  | { kind: 'phase-dial'; dial: PhaseDial; label: string }
  | { kind: 'phase-track'; track: PhaseTrack; label: string; engage?: { from: number; to: number } };
export type PhaseInput = Extract<ModelInput, { kind: 'phase-dial' | 'phase-track' }>;
export function isPhaseInput(input: ModelInput | null | undefined): input is PhaseInput {
  return input?.kind === 'phase-dial' || input?.kind === 'phase-track';
}
export type DragInput = PhaseInput | IndexedDial;
export function isDragInput(input: ModelInput | null | undefined): input is DragInput {
  return isPhaseInput(input) || input?.kind === 'indexed-dial';
}
export interface ModelInputChange {
  inspection?: string;
  phase?: number;
  selection?: number;
  replay?: boolean;
  keepPhase?: boolean;
  commit: boolean;
}

/** The day/night handle follows a small diagrammatic clock in the sky.
 * Midnight is below, noon above; this is a time control, not a solar ephemeris. */
export function phaseDialPoint(phase: number, dial: PhaseDial): Vec3 {
  const angle = (phase * (dial.turns ?? 1) - .25) * Math.PI * 2;
  if(dial.plane==='yz') return [dial.center[0],dial.center[1]-Math.sin(angle)*dial.radiusY,dial.center[2]+Math.cos(angle)*dial.radiusX];
  return [dial.center[0] + Math.cos(angle) * dial.radiusX,
    dial.center[1] + Math.sin(angle) * dial.radiusY, dial.center[2]];
}

export function phaseFromDialPoint(x: number, y: number, dial: PhaseDial, current: number): number {
  const u = (x - dial.center[0]) / dial.radiusX, v = (y - dial.center[1]) / dial.radiusY;
  if (!Number.isFinite(u + v) || Math.hypot(u, v) < .08) return current;
  return ((Math.atan2(v, u) / (Math.PI * 2) + .25) % 1 + 1) % 1;
}

export function phaseFromSpatialDialPoint(p: Vec3, dial: PhaseDial, current: number) {
  if(dial.plane==='yz')return phaseFromDialPoint(dial.center[0]+p[2]-dial.center[2],dial.center[1]-(p[1]-dial.center[1]),dial,current);
  return phaseFromDialPoint(p[0],p[1],dial,current);
}

export function advanceCrank(phase: number, previous: number, next: number, turns: number) {
  // Signed shortest arc across the twelve-o'clock seam. At either end the
  // demonstrator stops immediately and accepts reverse movement on the next sample.
  const delta = next - previous;
  return Math.max(0, Math.min(1, phase + (delta - Math.round(delta)) / turns));
}

export function phaseTrackPoint(phase: number, track: PhaseTrack): Vec3 {
  const t = Number.isFinite(phase) ? Math.max(0, Math.min(1, phase)) : 0;
  return track.start.map((start, i) => start + (track.end[i] - start) * t) as Vec3;
}

/** Project onto the rail rather than screen X. A vertical/oblique rail keeps
 * the same meaning, and off-axis finger movement cannot alter the result. */
export function phaseFromTrackPoint(x: number, y: number, track: PhaseTrack, current: number, z = track.start[2]): number {
  const [ax, ay, az] = track.start;
  const dx = track.end[0] - ax, dy = track.end[1] - ay, dz = track.end[2] - az;
  const lengthSquared = dx * dx + dy * dy + dz * dz;
  const along = (x - ax) * dx + (y - ay) * dy + (z - az) * dz;
  if (!Number.isFinite(along + lengthSquared) || lengthSquared < 1e-10) return current;
  return Math.max(0, Math.min(1, along / lengthSquared));
}

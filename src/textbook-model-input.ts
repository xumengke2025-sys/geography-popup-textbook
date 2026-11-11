import type { Vec3 } from './textbook-geometry';

export interface PhaseDial {
  center: Vec3;
  radiusX: number;
  radiusY: number;
}
/** A pull tab travels in a local XY plane, in front of the raised model.
 * Both endpoints share Z; this keeps the grab stable while the camera moves. */
export interface PhaseTrack {
  start: Vec3;
  end: Vec3;
}
export type ModelInput =
  | { kind: 'select'; selection: number; toggleTo?: number; label: string }
  | { kind: 'inspect'; target: string; toggleTo?: string; label: string }
  | { kind: 'replay'; selection?: number; label: string }
  | { kind: 'phase-dial'; dial: PhaseDial; label: string }
  | { kind: 'phase-track'; track: PhaseTrack; label: string };
export type PhaseInput = Extract<ModelInput, { kind: 'phase-dial' | 'phase-track' }>;
export function isPhaseInput(input: ModelInput | null | undefined): input is PhaseInput {
  return input?.kind === 'phase-dial' || input?.kind === 'phase-track';
}
export interface ModelInputChange {
  inspection?: string;
  phase?: number;
  selection?: number;
  replay?: boolean;
  commit: boolean;
}

/** The day/night handle follows a small diagrammatic clock in the sky.
 * Midnight is below, noon above; this is a time control, not a solar ephemeris. */
export function phaseDialPoint(phase: number, dial: PhaseDial): Vec3 {
  const angle = (phase - .25) * Math.PI * 2;
  return [dial.center[0] + Math.cos(angle) * dial.radiusX,
    dial.center[1] + Math.sin(angle) * dial.radiusY, dial.center[2]];
}

export function phaseFromDialPoint(x: number, y: number, dial: PhaseDial, current: number): number {
  const u = (x - dial.center[0]) / dial.radiusX, v = (y - dial.center[1]) / dial.radiusY;
  if (!Number.isFinite(u + v) || Math.hypot(u, v) < .08) return current;
  return ((Math.atan2(v, u) / (Math.PI * 2) + .25) % 1 + 1) % 1;
}

export function phaseTrackPoint(phase: number, track: PhaseTrack): Vec3 {
  const t = Number.isFinite(phase) ? Math.max(0, Math.min(1, phase)) : 0;
  return track.start.map((start, i) => start + (track.end[i] - start) * t) as Vec3;
}

/** Project onto the rail rather than screen X. A vertical/oblique rail keeps
 * the same meaning, and off-axis finger movement cannot alter the result. */
export function phaseFromTrackPoint(x: number, y: number, track: PhaseTrack, current: number): number {
  const dx = track.end[0] - track.start[0], dy = track.end[1] - track.start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (!Number.isFinite(x + y + lengthSquared + track.start[0] + track.start[1]) || lengthSquared < 1e-10) return current;
  return Math.max(0, Math.min(1, ((x - track.start[0]) * dx + (y - track.start[1]) * dy) / lengthSquared));
}

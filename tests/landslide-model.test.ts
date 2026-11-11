import { describe, expect, it } from 'vitest';
import { evaluateLandslide, landslideGrade, landslideGround, landslideSvg, LANDSLIDE_LAYOUT as L,
  SLIDE_BODY_VOLUME, type LandslidePoint } from '../src/textbook-landslide-model';

/** Integrate actual closed mesh geometry independently of the model's stock
 * metadata. This catches accidental material creation when the fan widens. */
function closedVolume(lower: LandslidePoint[], upper: LandslidePoint[], triangles: number[], boundary: number[]) {
  const vertices = [...lower, ...upper], count = lower.length, ix: number[] = [];
  for (let i = 0; i < triangles.length; i += 3) {
    const [a, b, c] = triangles.slice(i, i + 3); ix.push(a, b, c, a + count, c + count, b + count);
  }
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i], b = boundary[(i + 1) % boundary.length]; ix.push(a, a + count, b + count, a, b + count, b);
  }
  let volume = 0;
  for (let i = 0; i < ix.length; i += 3) {
    const [a, b, c] = ix.slice(i, i + 3).map(n => vertices[n]);
    volume += (a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  return Math.abs(volume);
}
const distance = (a: LandslidePoint, b: LandslidePoint) => Math.hypot(...a.map((v, i) => v - b[i]));

describe('two finite slope-movement trials from textbook p.108', () => {
  it('starts with all material at the upper source and leaves it at the foot, without wrapping', () => {
    const start = evaluateLandslide(0), end = evaluateLandslide(1);
    expect(start.stage).toBe('initial'); expect(end.stage).toBe('deposited');
    expect(start.slide.x).toBe(24); expect(end.slide.x).toBe(78);
    expect(start.debris.tail).toBe(18); expect(start.debris.front).toBe(30);
    expect(end.debris.tail).toBe(68); expect(end.debris.front).toBe(91);
    expect(start.debris.coarse.every(q => q.center[0] < 31)).toBe(true);
    expect(end.debris.coarse.every(q => q.center[0] >= 68)).toBe(true);
    expect(evaluateLandslide(.999999).slide.x).toBe(end.slide.x);
    expect(evaluateLandslide(.999999, 1).debris.top).toEqual(end.debris.top);
    expect(evaluateLandslide(2, 1)).toEqual(evaluateLandslide(1, 1));
  });
  it('moves a coherent rigid slide body, conserving its shape and solid volume', () => {
    const initial = evaluateLandslide(0).slide, triangles: number[] = [];
    for (let i = 1; i < initial.lower.length - 1; i++) triangles.push(0, i, i + 1);
    const boundary = initial.lower.map((_, i) => i);
    for (let i = 0; i <= 50; i++) {
      const body = evaluateLandslide(i / 50).slide;
      expect(closedVolume(body.lower, body.upper, triangles, boundary)).toBeCloseTo(SLIDE_BODY_VOLUME, 7);
      for (let j = 0; j < body.lower.length; j++) {
        expect(distance(body.lower[j], body.upper[j])).toBeCloseTo(3.2, 9);
        expect(distance(body.upper[j], body.upper[(j + 3) % body.upper.length])).toBeCloseTo(distance(initial.upper[j], initial.upper[(j + 3) % body.upper.length]), 9);
        expect(body.lower[j][1]).toBeGreaterThanOrEqual(landslideGrade(body.lower[j][0]) - .002);
      }
    }
  });
  it('keeps a closed, finite wet-debris volume throughout stretching and fan deposition', () => {
    const initial = evaluateLandslide(0, 1).debris;
    for (let i = 0; i <= 80; i++) {
      const f = evaluateLandslide(i / 80, 1).debris;
      expect(f.top.length).toBe(initial.top.length); expect(f.bottom.length).toBe(initial.bottom.length);
      expect(f.indices).toEqual(initial.indices); expect(f.boundary).toEqual(initial.boundary);
      expect(f.volume).toBeCloseTo(L.flowBulkVolume, 9);
      expect(closedVolume(f.bottom, f.top, f.indices, f.boundary)).toBeCloseTo(L.flowBulkVolume, 7);
      expect(f.containsWater).toBe(true); expect(f.finiteStock).toBe(true);
      for (let j = 0; j < f.top.length; j++) {
        expect(f.top[j][1]).toBeGreaterThan(f.bottom[j][1]);
        expect(f.bottom[j][1]).toBeCloseTo(landslideGround(f.bottom[j][0], f.bottom[j][2], 'debris-flow') + .045, 10);
      }
      expect(f.coarse.map(q => q.id)).toEqual(Array.from({ length: L.coarseCount }, (_, i) => i));
      expect(f.coarse.every(q => q.embedded && q.center.every(Number.isFinite))).toBe(true);
    }
    const end = evaluateLandslide(1, 1).debris;
    expect(end.fanWidth).toBeGreaterThan(initial.fanWidth * 3);
    expect(end.thicknessScale).toBeLessThan(initial.thicknessScale);
    expect(end.sourceEmpty).toBe(true); expect(end.deposited).toBe(true);
  });
  it('moves the front and tail continuously downhill and never teleports a rock to the source', () => {
    let previous = evaluateLandslide(0, 1);
    for (let i = 1; i <= 200; i++) {
      const next = evaluateLandslide(i / 200, 1);
      expect(next.slide.x).toBeGreaterThanOrEqual(previous.slide.x);
      expect(next.debris.front).toBeGreaterThanOrEqual(previous.debris.front);
      expect(next.debris.tail).toBeGreaterThanOrEqual(previous.debris.tail);
      next.debris.coarse.forEach((q, j) => expect(q.center[0]).toBeGreaterThanOrEqual(previous.debris.coarse[j].center[0]));
      const nearby = evaluateLandslide(i / 200 - .000001, 1);
      expect(Math.max(...next.debris.top.map((p, j) => distance(p, nearby.debris.top[j])))).toBeLessThan(.002);
      previous = next;
    }
  });
  it('is a pure seekable state, independent of frame order and the other trial', () => {
    const savedSlide = evaluateLandslide(.42), savedFlow = evaluateLandslide(.42, 1);
    for (let i = 60; i >= 0; i--) { evaluateLandslide(i / 60); evaluateLandslide(i / 60, 1); }
    expect(evaluateLandslide(.42)).toEqual(savedSlide); expect(evaluateLandslide(.42, 1)).toEqual(savedFlow);
    expect(savedSlide.mode).toBe('landslide'); expect(savedFlow.mode).toBe('debris-flow');
    expect(savedSlide.separateTrials).toBe(true); expect(savedFlow.separateTrials).toBe(true);
    expect(evaluateLandslide(NaN)).toEqual(evaluateLandslide(0)); expect(evaluateLandslide(-1)).toEqual(evaluateLandslide(0));
  });
  it('renders the same model state in native SVG and makes no risk forecast or measured-time claim', () => {
    for (const selection of [0, 1]) for (const phase of [0, .18, .48, .76, 1]) {
      const state = evaluateLandslide(phase, selection), svg = landslideSvg(phase, selection);
      expect(svg).toContain(`data-landslide-mode="${state.mode}"`);
      expect(svg).toContain(`data-landslide-phase="${state.phase}"`);
      expect(svg).toContain(`data-landslide-stage="${state.stage}"`);
      expect(svg).toContain(`data-landslide-stock="${state.stockVolume}"`);
      expect(svg).toContain(`data-landslide-front="${selection ? state.debris.front : state.slide.x}"`);
      expect(svg).toContain(state.caption); expect(svg).not.toContain('<image');
      expect(svg).not.toContain('marker-end'); expect(svg).not.toMatch(/\d+\s*(秒|分钟|米\/秒)/);
      expect(state.reference.printedPages).toEqual([108]); expect(state.reference.prediction).toBe(false);
      expect(state.realFailureThreshold).toBe(false); expect(state.rainTriggerSimulated).toBe(false);
    }
  });
});

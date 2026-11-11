import { describe, expect, it } from 'vitest';
import { evaluateSalinity, salinityPortionPoint, salinitySvg, SALINITY_REFERENCE } from '../src/textbook-salinity-model';

describe('textbook pp.52–53 salinity condition trials', () => {
  it('starts every trial with identical water, dissolved salt and concentration', () => {
    const samples = [0, 1, 2].map(mode => evaluateSalinity(0, mode));
    expect(samples.map(s => s.water)).toEqual([54, 54, 54]);
    expect(samples.map(s => s.concentration)).toEqual([2 / 56, 2 / 56, 2 / 56]);
    for (const sample of samples) { expect(sample.salt).toBe(2); expect(sample.released).toBe(0); expect(sample.arrived).toBe(0); }
  });
  it('conserves water and keeps salt inside throughout every finite transfer', () => {
    for (let mode = 0; mode < 3; mode++) for (let i = 0; i <= 400; i++) {
      const state = evaluateSalinity(i / 400, mode);
      expect(state.totalWater).toBeCloseTo(state.expectedTotalWater, 10);
      expect(state.salt).toBe(SALINITY_REFERENCE.saltMass);
      expect(state.source).toBeGreaterThanOrEqual(0); expect(state.removed).toBeGreaterThanOrEqual(0); expect(state.inTransit).toBeGreaterThanOrEqual(-1e-10);
      for (const p of state.portions) {
        expect(p.arrived).toBeLessThanOrEqual(p.departed); expect(p.inTransit).toBeGreaterThanOrEqual(0);
        expect(salinityPortionPoint(state, p.id).every(Number.isFinite)).toBe(true);
      }
    }
  });
  it('removes only water at evaporation departure and adds freshwater only on arrival', () => {
    for (let i = 0; i <= 150; i++) {
      const t = i / 150, evaporation = evaluateSalinity(t, 0), rain = evaluateSalinity(t, 1), river = evaluateSalinity(t, 2);
      expect(evaporation.water + evaporation.released).toBeCloseTo(54, 12);
      expect(rain.water - rain.arrived).toBeCloseTo(54, 12);
      expect(river.water).toBe(rain.water);
    }
    expect(evaluateSalinity(.12, 1).water).toBe(54);
    expect(evaluateSalinity(.12, 0).water).toBeLessThan(54);
  });
  it('raises concentration during evaporation and lowers it during freshwater addition', () => {
    for (let mode = 0; mode < 3; mode++) {
      let previous = evaluateSalinity(0, mode);
      for (let i = 1; i <= 200; i++) {
        const state = evaluateSalinity(i / 200, mode);
        if (mode === 0) expect(state.concentration).toBeGreaterThanOrEqual(previous.concentration);
        else expect(state.concentration).toBeLessThanOrEqual(previous.concentration);
        expect(state.concentration).toBeCloseTo(state.salt / (state.water + state.salt), 12); previous = state;
      }
      expect(previous.water).toBe(mode === 0 ? 36 : 72); expect(previous.inTransit).toBe(0);
    }
  });
  it('holds the finished inventory without a wrap and is deterministic when scrubbed backwards', () => {
    for (const mode of [0, 1, 2]) {
      const middle = evaluateSalinity(.43, mode); evaluateSalinity(1, mode); evaluateSalinity(.01, mode);
      expect(evaluateSalinity(.43, mode)).toEqual(middle);
      expect(evaluateSalinity(1, mode).water).toBe(evaluateSalinity(1.5, mode).water);
      expect(evaluateSalinity(1, mode).stage).toBe('complete');
    }
  });
  it('keeps the SVG on the same inventory without inventing measured units', () => {
    const state = evaluateSalinity(.61, 1), svg = salinitySvg(.61, 1);
    expect(svg).toContain(`data-water="${state.water}"`); expect(svg).toContain(`data-salt="${state.salt}"`);
    expect(svg).toContain(`data-concentration="${state.concentration}"`);
    expect(svg).not.toMatch(/<image|NaN|undefined|‰|实测|℃/);
  });
});

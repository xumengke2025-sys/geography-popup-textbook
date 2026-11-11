import { describe, expect, it } from 'vitest';
import { evaluateHaze, hazeSvg } from '../src/textbook-haze-model';

describe('air-pollution stock and condition trials', () => {
  it('starts all comparisons with the same pre-existing pollution', () => {
    const initial = evaluateHaze(0, 0);
    for (const mode of [0, 1, 2]) {
      const state = evaluateHaze(0, mode);
      expect(state.stock).toBe(36);
      expect(state.emittedNew).toBe(0);
      expect(state.particles.filter(p => p.cohort === 'existing')).toEqual(initial.particles.filter(p => p.cohort === 'existing'));
    }
  });
  it('reduces future emissions without removing the existing stock on selection', () => {
    for (const phase of [.01, .1, .35, .7, 1]) {
      const normal = evaluateHaze(phase, 0), reduced = evaluateHaze(phase, 2);
      expect(reduced.particles.filter(p => p.cohort === 'existing')).toEqual(normal.particles.filter(p => p.cohort === 'existing'));
      expect(reduced.emittedNew).toBeLessThanOrEqual(normal.emittedNew);
    }
    expect(evaluateHaze(1, 2).emittedNew).toBeLessThan(evaluateHaze(1, 0).emittedNew / 2);
    expect(evaluateHaze(.35, 2).existingRemaining).toBeGreaterThan(20);
  });
  it('moves pollution out of the observation region under stronger ventilation', () => {
    const weak = evaluateHaze(1, 0), wind = evaluateHaze(1, 1);
    expect(wind.emittedNew).toBe(weak.emittedNew);
    expect(wind.removed).toBeGreaterThan(weak.removed);
    expect(wind.stock).toBeLessThan(weak.stock);
    expect(wind.particles.filter(p => p.exited).every(p => p.x >= 108)).toBe(true);
    expect(evaluateHaze(.06, 1).windStrength).toBe(0);
  });
  it('accounts for initial stock, new arrivals and departures in every frame', () => {
    for (const mode of [0, 1, 2]) for (let frame = 0; frame <= 100; frame++) {
      const state = evaluateHaze(frame / 100, mode);
      expect(state.stock).toBe(state.initialStock + state.emittedNew - state.removed);
      expect(state.particles.filter(p => p.emitted && !p.exited)).toHaveLength(state.stock);
      expect(state.particles.every(p => Number.isFinite(p.x + p.y + p.z + p.size))).toBe(true);
    }
  });
  it('has no timeline wrap, time step dependence or random new particle identities', () => {
    const reference = evaluateHaze(.615, 1);
    for (const phase of [.9, .1, 1, 0, .615]) evaluateHaze(phase, 2);
    expect(evaluateHaze(.615, 1)).toEqual(reference);
    expect(evaluateHaze(1, 0)).not.toEqual(evaluateHaze(0, 0));
    expect(evaluateHaze(Infinity, NaN).phase).toBe(0);
  });
  it('tapers new parcels from the source and old parcels at the exit', () => {
    const birth = evaluateHaze(.015, 0).particles[36];
    expect(birth.size).toBe(0);
    expect(evaluateHaze(.015001, 0).particles[36].size).toBeLessThan(.00001);
    const first = evaluateHaze(.4, 1), next = evaluateHaze(.40001, 1);
    for (let i = 0; i < first.particles.length; i++) {
      expect(Math.abs(next.particles[i].x - first.particles[i].x)).toBeLessThan(.002);
      expect(Math.abs(next.particles[i].size - first.particles[i].size)).toBeLessThan(.002);
    }
  });
  it('uses the same parcel identities and coordinates in the SVG alternative', () => {
    const state = evaluateHaze(.63, 2), svg = hazeSvg(.63, 2);
    expect(svg.match(/data-particle=/g)).toHaveLength(state.particles.filter(p => p.visible).length);
    for (const p of state.particles.filter(p => p.visible)) expect(svg).toContain(`data-particle="${p.id}" data-cohort="${p.cohort}" cx="${(48 + p.x * 4.7).toFixed(2)}"`);
    expect(svg).toContain('data-model-selection="1"');
    expect(svg).toContain('data-model-selection="2"');
  });
});

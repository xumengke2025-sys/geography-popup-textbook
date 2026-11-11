import { describe, expect, it } from 'vitest';
import { evaluateWave, waveHeightAt, waveParticleAt, waveSvg, WAVE_GEOMETRY, WAVE_REFERENCE } from '../src/textbook-wave-model';

describe('one periodic wave, moving form and a tracked water point', () => {
  it('closes the same material orbit after a whole cycle with no net translation', () => {
    const rest = WAVE_GEOMETRY.particleRestX;
    for (const depth of [0, 3, 12]) {
      const first = waveParticleAt(evaluateWave(0), rest, depth), last = waveParticleAt(evaluateWave(1), rest, depth);
      expect(last).toEqual(first);
      const orbit = Array.from({ length: 120 }, (_, i) => waveParticleAt(evaluateWave(i / 120), rest, depth));
      expect(orbit.reduce((sum, p) => sum + p.x, 0) / orbit.length).toBeCloseTo(rest, 11);
      expect(orbit.reduce((sum, p) => sum + p.height, 0) / orbit.length).toBeCloseTo(WAVE_GEOMETRY.meanHeight - depth, 11);
    }
  });
  it('travels to the right while a selected material point remains on that exact surface', () => {
    for (const phase of [0, .13, .32, .57, .81, 1]) {
      const state = evaluateWave(phase), next = evaluateWave((phase + .09) % 1);
      for (const x of [-4, 17, 50, 83, 104]) expect(waveHeightAt(next, x + .09 * state.wavelength)).toBeCloseTo(waveHeightAt(state, x), 8);
      for (const rest of [10, 35, WAVE_GEOMETRY.particleRestX, 87]) {
        const p = waveParticleAt(state, rest);
        expect(waveHeightAt(state, p.x)).toBeCloseTo(p.height, 8);
      }
    }
  });
  it('has a nonfolding surface, exact wave height and positive thickness', () => {
    expect(Math.PI * 2 / WAVE_GEOMETRY.wavelength * WAVE_GEOMETRY.amplitude).toBeLessThan(1);
    for (const phase of [0, .2, .7, 1]) {
      const state = evaluateWave(phase), crest = phase * state.wavelength, trough = crest + state.wavelength / 2;
      expect(waveHeightAt(state, crest) - waveHeightAt(state, trough)).toBeCloseTo(state.waveHeight, 8);
      for (let i = 0; i <= 100; i++) expect(waveHeightAt(state, i)).toBeGreaterThan(13);
    }
  });
  it('uses selection only for emphasis and supports exact reverse seeking', () => {
    const first = evaluateWave(.53, 0), tracked = evaluateWave(.53, 1);
    expect(tracked.particle).toEqual(first.particle); expect(tracked.cyclePhase).toBe(first.cyclePhase);
    expect([0, 25, 50, 100].map(x => waveHeightAt(first, x))).toEqual([0, 25, 50, 100].map(x => waveHeightAt(tracked, x)));
    evaluateWave(.99, 1); evaluateWave(.02, 0); expect(evaluateWave(.53, 0)).toEqual(first);
    expect(evaluateWave(-4).phase).toBe(0); expect(evaluateWave(8).phase).toBe(1); expect(evaluateWave(NaN).phase).toBe(0);
  });
  it('decreases orbital amplitude with depth and declares its scientific limits', () => {
    const state = evaluateWave(.3), rest = WAVE_GEOMETRY.particleRestX;
    const radius = (depth: number) => { const p = waveParticleAt(state, rest, depth); return Math.hypot(p.x - rest, p.height - (state.meanHeight - depth)); };
    expect(radius(10)).toBeLessThan(radius(0) / 2); expect(radius(20)).toBeLessThan(radius(10));
    expect(WAVE_REFERENCE.includesStokesDrift).toBe(false); expect(WAVE_REFERENCE.markerIsRealBuoy).toBe(false);
  });
  it('draws its vector cutaway and native marker control from the same state', () => {
    const state = evaluateWave(.53, 1), svg = waveSvg(.53, 1);
    expect(svg).not.toContain('<image'); expect(svg).toContain('role="group"');
    expect(svg).toContain('data-wave-orbit="closed"'); expect(svg.includes('data-model-inspection="displacement"')).toBe(true);
    expect(svg).toContain(`data-x="${Number(state.particle.x.toFixed(6))}"`);
    expect(svg).toContain('不含洋流、破碎和近岸变化'); expect(svg).toContain('不是实际浮标运动');
    const probes = JSON.parse(svg.match(/data-height-probes='([^']+)'/)![1]);
    for (const p of probes) expect(p.height).toBeCloseTo(waveHeightAt(state, p.x), 5);
    expect(waveSvg(.53, 0)).not.toContain('data-wave-orbit="closed"');
  });
});

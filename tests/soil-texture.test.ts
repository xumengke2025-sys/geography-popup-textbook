import { describe, expect, it } from 'vitest';
import { evaluateSoilTexture, soilTextureSvg, SOIL_TEXTURE_GRAINS, SOIL_TEXTURE_RAIN_POOL, SOIL_TEXTURE_TYPES,
  SOIL_TEXTURE_WATER_COUNT, SOIL_TEXTURE_COLLECTOR_FLOOR, type SoilTextureInventory } from '../src/textbook-soil-texture-model';

const total = (inventory: SoilTextureInventory) => Object.entries(inventory).filter(([key]) => key !== 'total').reduce((sum, [, n]) => sum + n, 0);
describe('textbook p.89 simultaneous soil-texture rainfall comparison', () => {
  it('preserves the textbook sample names and comparison order', () => {
    expect(SOIL_TEXTURE_TYPES.map(s => s.name)).toEqual(['砂土', '壤土', '黏土']);
    expect(SOIL_TEXTURE_TYPES[0].grainRadius).toBeGreaterThan(SOIL_TEXTURE_TYPES[1].grainRadius);
    expect(SOIL_TEXTURE_TYPES[1].grainRadius).toBeGreaterThan(SOIL_TEXTURE_TYPES[2].grainRadius);
  });
  it('keeps equal rainfall schedules, not a different rain amount when selected', () => {
    for (let step = 0; step <= 100; step++) {
      const state = evaluateSoilTexture(step / 100, step % 3), [a, b, c] = state.samples;
      expect(a.inventory.waiting).toBe(b.inventory.waiting); expect(b.inventory.waiting).toBe(c.inventory.waiting);
      expect(a.inventory.falling).toBe(b.inventory.falling); expect(b.inventory.falling).toBe(c.inventory.falling);
      expect(a.portions.map(p => p.release)).toEqual(b.portions.map(p => p.release));
      expect(a.portions.map(p => p.impact)).toEqual(c.portions.map(p => p.impact));
      expect(state.rain.released + state.rain.waiting).toBe(SOIL_TEXTURE_WATER_COUNT);
    }
  });
  it('conserves every finite water portion through rain, pores, retention and collection', () => {
    const ids = SOIL_TEXTURE_RAIN_POOL.map(p => p.id);
    for (let step = 0; step <= 200; step++) for (const sample of evaluateSoilTexture(step / 200).samples) {
      expect(sample.portions.map(p => p.id)).toEqual(ids);
      expect(total(sample.inventory)).toBeCloseTo(SOIL_TEXTURE_WATER_COUNT, 10);
      expect(sample.portions.reduce((sum, p) => sum + p.amount + p.collectedFraction, 0)).toBeCloseTo(SOIL_TEXTURE_WATER_COUNT, 10);
      expect(sample.portions.every(p => p.amount >= 0 && p.amount <= 1 && p.collectedFraction >= 0 && p.collectedFraction <= 1)).toBe(true);
      expect(sample.reservoir).toBe(sample.inventory.waiting / SOIL_TEXTURE_WATER_COUNT);
      expect(sample.collected).toBeCloseTo(sample.inventory.collected / SOIL_TEXTURE_WATER_COUNT, 12);
    }
  });
  it('starts with all water above and collects nothing before water crosses the soil', () => {
    const initial = evaluateSoilTexture(0); expect(initial.stage).toBe('ready');
    for (const s of initial.samples) expect(s.inventory).toEqual({ waiting: 36, falling: 0, infiltrating: 0, dripping: 0, retained: 0, collected: 0, total: 36 });
    for (const s of evaluateSoilTexture(.10).samples) expect(s.collected).toBe(0);
    for (let step = 0; step <= 100; step++) for (const s of evaluateSoilTexture(step / 100).samples) for (const p of s.portions) {
      if (p.status === 'falling') expect(p.depth).toBeLessThanOrEqual(0);
      if (p.status === 'infiltrating' || p.status === 'retained') { expect(p.depth).toBeGreaterThanOrEqual(0); expect(p.depth).toBeLessThanOrEqual(1); }
      if (p.status === 'dripping' || p.status === 'collected') { expect(p.depth).toBeGreaterThanOrEqual(1); expect(p.depth).toBeLessThanOrEqual(SOIL_TEXTURE_COLLECTOR_FLOOR); }
      expect(Number.isFinite(p.u + p.depth + p.radius + p.amount)).toBe(true);
    }
  });
  it('makes sand drain sooner and retains more water in loam and clay', () => {
    const first = (i: number) => Array.from({ length: 1001 }, (_, step) => evaluateSoilTexture(step / 1000).samples[i]).findIndex(s => s.collected > 0);
    expect(first(0)).toBeLessThan(first(1)); expect(first(1)).toBeLessThan(first(2));
    const end = evaluateSoilTexture(1); expect(end.stage).toBe('retained');
    expect(end.samples.map(s => s.inventory.retained)).toEqual([6, 21, 28]);
    expect(end.samples.map(s => s.inventory.collected)).toEqual([30, 15, 8]);
    for (const s of end.samples) {
      expect(s.inventory.retained + s.inventory.collected).toBe(36);
      expect(s.portions.filter(p => p.status === 'retained').every(p => p.depth > 0 && p.depth < 1)).toBe(true);
    }
  });
  it('does not move, create or remove soil grains while rain changes', () => {
    const before = JSON.stringify(SOIL_TEXTURE_GRAINS);
    for (const phase of [0, .2, .4, .7, 1, .3]) for (let selection = 0; selection < 3; selection++) evaluateSoilTexture(phase, selection);
    expect(JSON.stringify(SOIL_TEXTURE_GRAINS)).toBe(before);
    for (const grains of SOIL_TEXTURE_GRAINS) { expect(new Set(grains.map(p => p.id)).size).toBe(grains.length); expect(grains.every(p => Object.isFrozen(p))).toBe(true); }
  });
  it('uses selection solely to emphasize, never to change water or the same-rain conditions', () => {
    for (const phase of [.1, .4, .7, 1]) {
      const a = evaluateSoilTexture(phase, 0), b = evaluateSoilTexture(phase, 1), c = evaluateSoilTexture(phase, 2);
      expect(a.samples).toEqual(b.samples); expect(a.samples).toEqual(c.samples); expect(a.rain).toEqual(c.rain);
    }
  });
  it('scrubs reversibly, keeps the final state, and handles invalid input safely', () => {
    const mid = evaluateSoilTexture(.63, 2); evaluateSoilTexture(1); evaluateSoilTexture(0);
    expect(evaluateSoilTexture(.63, 2)).toEqual(mid);
    expect(evaluateSoilTexture(1.3)).toEqual(evaluateSoilTexture(1));
    for (const phase of [NaN, Infinity, -Infinity, -1]) expect(evaluateSoilTexture(phase)).toEqual(evaluateSoilTexture(0));
    expect(evaluateSoilTexture(.4, NaN).selection).toBe(0);
    expect(evaluateSoilTexture(.4, 8).selection).toBe(2);
  });
  it('transfers a portion into collected volume continuously instead of erasing it', () => {
    const state = evaluateSoilTexture(.7), p = state.samples[0].portions.find(p => p.arrival < .8 && p.status !== 'retained')!;
    const a = evaluateSoilTexture(p.arrival + .004).samples[0].portions[p.id];
    expect(a.status).toBe('dripping'); expect(a.amount).toBeGreaterThan(0); expect(a.amount).toBeLessThan(1);
    expect(a.amount + a.collectedFraction).toBe(1);
    for (const phase of [.2, .4, .6, .8, .95]) {
      const before = evaluateSoilTexture(phase - .000001), after = evaluateSoilTexture(phase + .000001);
      for (let i = 0; i < 3; i++) expect(Math.abs(before.samples[i].collectorLevelDepth - after.samples[i].collectorLevelDepth)).toBeLessThan(.0001);
    }
  });
  it('draws every visible SVG water portion from the same model and keeps real controls accessible', () => {
    const phase = .40, source = soilTextureSvg(phase, 1), state = evaluateSoilTexture(phase, 1);
    expect(source).not.toContain('<image'); expect(source).toContain('role="group"');
    expect(source).toContain('均为教学设定'); expect(source).toContain('不是实测值'); expect(source).toContain('下部自由排水');
    expect(source.match(/data-soil-texture-part="sample"/g)).toHaveLength(3);
    expect(source).toContain('data-model-replay="true"');
    for (const s of state.samples) {
      expect(source).toContain(`data-model-selection="${s.index}" role="button" tabindex="0"`);
      for (const p of s.portions.filter(p => p.status !== 'waiting' && p.status !== 'collected')) expect(source).toContain(`data-soil-texture-water="${s.index}-${p.id}" data-sample="${s.index}" data-water-id="${p.id}" data-u="${Number(p.u.toFixed(6))}" data-depth="${Number(p.depth.toFixed(6))}" data-status="${p.status}"`);
    }
  });
});

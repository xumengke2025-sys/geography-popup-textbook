import { describe, expect, it } from 'vitest';
import { evaluateSoilSorting, soilSortingSvg } from '../src/textbook-soil-sorting-model';

describe('one illustrative hillside water/particle sorting relationship', () => {
  it('conserves the same particles and identities throughout transport', () => {
    const initial = evaluateSoilSorting(0);
    for (const phase of [.15, .4, .7, 1]) {
      const s = evaluateSoilSorting(phase);
      expect(s.grains.map(p => p.id)).toEqual(initial.grains.map(p => p.id));
      expect(new Set(s.grains.map(p => p.id)).size).toBe(54);
      expect(s.grains.every(p => Number.isFinite(p.u + p.v + p.height))).toBe(true);
    }
  });
  it('leaves progressively finer material farther downslope', () => {
    const end = evaluateSoilSorting(1);
    const group = (size: string) => end.grains.filter(p => p.size === size);
    expect(Math.max(...group('coarse').map(p => p.u))).toBeLessThan(Math.min(...group('medium').map(p => p.u)));
    expect(Math.max(...group('medium').map(p => p.u))).toBeLessThan(Math.min(...group('fine').map(p => p.u)));
    expect(group('coarse')[0].radius).toBeGreaterThan(group('fine')[0].radius);
  });
  it('lets coarse material stop while water and finer grains continue', () => {
    const middle = evaluateSoilSorting(.5);
    expect(middle.water.active).toBe(true);
    expect(middle.grains.filter(p => p.size === 'coarse').every(p => p.deposited)).toBe(true);
    expect(middle.grains.filter(p => p.size === 'fine').every(p => !p.deposited)).toBe(true);
    const before = evaluateSoilSorting(.5), after = evaluateSoilSorting(.65);
    expect(before.grains.filter(p => p.size === 'coarse').map(p => p.u)).toEqual(after.grains.filter(p => p.size === 'coarse').map(p => p.u));
    expect(after.grains.find(p => p.size === 'fine')!.u).toBeGreaterThan(before.grains.find(p => p.size === 'fine')!.u);
  });
  it('does not let transported particles travel beyond the water front', () => {
    for (const phase of [.06, .1, .2, .35, .5, .65, .8, .9]) {
      const state = evaluateSoilSorting(phase), front = .025 + .94 * state.water.reach;
      expect(state.grains.filter(p => p.travel > 0 && !p.deposited).every(p => p.u < front)).toBe(true);
    }
  });
  it('keeps the final distribution after transport ends', () => {
    const final = evaluateSoilSorting(1);
    expect(final.stage).toBe('settled'); expect(final.water.active).toBe(false);
    expect(final.deposited).toBe(final.grains.length);
    expect(evaluateSoilSorting(1.2)).toEqual(final);
  });
  it('can be scrubbed backward without history or jumps at deposition', () => {
    const middle = evaluateSoilSorting(.51); evaluateSoilSorting(1); evaluateSoilSorting(0);
    expect(evaluateSoilSorting(.51)).toEqual(middle);
    for (const phase of [.1, .4, .5, .65, .89, .98]) {
      const a = evaluateSoilSorting(phase - .00001), z = evaluateSoilSorting(phase + .00001);
      expect(Math.max(...a.grains.map((p, i) => Math.abs(p.u - z.grains[i].u)))).toBeLessThan(.0001);
    }
  });
  it('uses those same positions in a vector-only 2D view with explicit scientific limits', () => {
    const source = soilSortingSvg(.62), state = evaluateSoilSorting(.62);
    expect(source.match(/data-soil-grain=/g)).toHaveLength(state.grains.length);
    expect(source).toContain('不是全部成土因素'); expect(source).toContain('不表示真实侵蚀或成土速率');
    expect(source).not.toContain('<image');
    for (const p of state.grains) expect(source).toContain(`data-soil-grain="${p.id}" data-size="${p.size}" data-u="${Number(p.u.toFixed(6))}"`);
  });
});

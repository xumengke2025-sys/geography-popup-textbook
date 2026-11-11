import { describe, expect, it } from 'vitest';
import { evaluateKarst, KARST_NAMES, KARST_PEAKS, karstHeight, karstJointU, karstSvg, karstWaterPoint } from '../src/textbook-karst-model';

describe('karst surface dissolution comparisons', () => {
  it('seeks deterministically without elapsed-time or frame-history state', () => {
    for (let selection = 0; selection < 6; selection++) {
      const middle = evaluateKarst(.57, selection);
      evaluateKarst(.96, selection); evaluateKarst(.12, selection);
      expect(evaluateKarst(.57, selection)).toEqual(middle);
      expect(evaluateKarst(0, selection).erosion).toBe(0);
      expect(evaluateKarst(1, selection).erosion).toBe(1);
    }
  });
  it('removes stone monotonically everywhere, including every residual peak top', () => {
    for (let selection = 0; selection < 6; selection++) {
      const states = [0, .18, .38, .57, .76, 1].map(phase => evaluateKarst(phase, selection));
      let lowered = 0;
      for (let j = 0; j <= 16; j++) for (let i = 0; i <= 22; i++) {
        const u = i / 22, v = j / 16, initial = karstHeight(states[0], u, v);
        let previous = initial;
        for (const state of states.slice(1)) {
          const height = karstHeight(state, u, v);
          expect(height).toBeLessThanOrEqual(previous + 1e-10); previous = height;
        }
        if (initial - previous > .2) lowered++;
      }
      expect(lowered).toBeGreaterThan(200);
      for (const [u, v] of KARST_PEAKS[selection]) expect(karstHeight(evaluateKarst(1, selection), u, v)).toBeLessThan(karstHeight(evaluateKarst(0, selection), u, v));
    }
  });
  it('widens a fissure while preserving a broad, flat-bottomed depression as a distinct comparison', () => {
    const first = evaluateKarst(0, 0), last = evaluateKarst(1, 0), v = .57, center = karstJointU(1, v);
    expect(last.jointWidth).toBeGreaterThan(first.jointWidth * 2);
    expect(karstHeight(first, center + .028, v) - karstHeight(last, center + .028, v)).toBeGreaterThan(2);
    expect(karstHeight(first, .025, v) - karstHeight(last, .025, v)).toBeLessThan(1.2);
    const basin = evaluateKarst(1, 1);
    const bottom = [.47, .52, .57].map(u => karstHeight(basin, u, .55));
    expect(Math.max(...bottom) - Math.min(...bottom)).toBeLessThan(.02);
    expect(karstHeight(basin, .06, .08) - bottom[1]).toBeGreaterThan(15);
  });
  it('keeps six recognizable, different form definitions rather than deriving them from a shared clock', () => {
    expect(KARST_NAMES).toEqual(['溶沟', '洼地', '峰丛', '峰林', '孤峰', '残丘']);
    const signatures = Array.from({ length: 6 }, (_, k) => {
      const state = evaluateKarst(.6, k);
      return [.15, .35, .55, .75].map(u => karstHeight(state, u, .4).toFixed(4)).join(',');
    });
    expect(new Set(signatures).size).toBe(6);
    expect(KARST_PEAKS[2].length).toBeGreaterThan(KARST_PEAKS[4].length);
    expect(Math.max(...KARST_PEAKS[5].map(p => p[2]))).toBeLessThan(Math.max(...KARST_PEAKS[4].map(p => p[2])) / 2);
  });
  it('routes rain downhill over the same surface and then into a fissure', () => {
    for (let selection = 0; selection < 6; selection++) for (const phase of [.14, .45, .78]) {
      const state = evaluateKarst(phase, selection);
      for (const path of state.paths) {
        expect(path.points.length).toBeGreaterThan(1);
        path.points.forEach((point, i) => {
          expect(point.height).toBe(karstHeight(state, point.u, point.v));
          if (i) expect(point.height).toBeLessThan(path.points[i - 1].height);
        });
        const rain = karstWaterPoint(state, path.lane, .08), surface = karstWaterPoint(state, path.lane, .5), entering = karstWaterPoint(state, path.lane, 1);
        expect(rain.stage).toBe('rain'); expect(rain.height).toBeGreaterThan(path.points[0].height + 5);
        expect(surface.height).toBeCloseTo(karstHeight(state, surface.u, surface.v) + .18, 10);
        expect(entering.stage).toBe('infiltration'); expect(entering.height).toBeLessThan(path.inlet.height - 3);
        expect([entering.u, entering.v]).toEqual([path.inlet.u, path.inlet.v]);
      }
    }
  });
  it('keeps native SVG on the same selected form, erosion and height samples', () => {
    const state = evaluateKarst(.57, 3), svg = karstSvg(.57, 3);
    expect(svg).not.toContain('<image'); expect(svg).toContain('data-karst-form="3"');
    expect(svg).toContain(`data-erosion="${Number(state.erosion.toFixed(5))}"`);
    expect(svg).toContain('不是所有地区必经的等时序列'); expect(svg).toContain('岩体只会降低');
    const probes = JSON.parse(svg.match(/data-height-probes='([^']+)'/)![1]);
    for (const probe of probes) expect(probe.height).toBeCloseTo(karstHeight(state, probe.u, probe.v), 5);
  });
});

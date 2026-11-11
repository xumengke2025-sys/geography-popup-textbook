import { describe, expect, it } from 'vitest';
import { BRINE_COLLECTOR, BRINE_POCKET_HALF_SIZE, evaluateDesalination, desalinationPocketProjection } from '../src/textbook-desalination-model';
import { figureById } from '../src/textbook-catalog';
import { flatModelSvg } from '../src/textbook-flat-model';

describe('salt-rich liquid stays in the apparatus after separation', () => {
  for (const mode of [0, 1]) {
    it(`method ${mode}: collects every expelled pocket inside the actual tray, leaving four in the ice`, () => {
      const state = evaluateDesalination(1, mode), tray = BRINE_COLLECTOR;
      expect(state.retainedBrinePockets).toBe(4);
      expect(state.collectedPockets).toBe(12);
      expect(state.separatedBrineCollected).toBe(true);
      for (const pocket of state.pockets.filter(p => !p.retained)) {
        const [x, y, z] = pocket.point, [hx, hy, hz] = BRINE_POCKET_HALF_SIZE;
        expect(x - hx).toBeGreaterThanOrEqual(tray.left); expect(x + hx).toBeLessThanOrEqual(tray.right);
        expect(z - hz).toBeGreaterThanOrEqual(tray.back); expect(z + hz).toBeLessThanOrEqual(tray.front);
        expect(y - hy).toBeGreaterThanOrEqual(tray.bottom); expect(y + hy).toBeLessThanOrEqual(tray.top);
        const [sx, sy] = desalinationPocketProjection(pocket.point);
        expect(sx - 3).toBeGreaterThan(121); expect(sx + 3).toBeLessThan(526);
        expect(sy - 3.5).toBeGreaterThan(273); expect(sy + 3.5).toBeLessThan(331);
      }
    });
    it(`method ${mode}: retains identities, deterministic seeking and the SVG endpoints`, () => {
      for (let step = 0; step <= 100; step++) {
        const phase = step / 100, state = evaluateDesalination(phase, mode);
        expect(state.pockets).toHaveLength(16);
        expect(new Set(state.pockets.map(p => p.id)).size).toBe(16);
        expect(state.pockets.flatMap(p => p.point).every(Number.isFinite)).toBe(true);
        if (step < 100) {
          const next = evaluateDesalination(phase + 1e-7, mode);
          state.pockets.forEach((p, i) => expect(Math.hypot(...p.point.map((v, j) => v - next.pockets[i].point[j]))).toBeLessThan(.001));
        }
      }
      const middle = evaluateDesalination(.574, mode);
      evaluateDesalination(1, mode); evaluateDesalination(0, mode);
      expect(evaluateDesalination(.574, mode)).toEqual(middle);
      expect(evaluateDesalination(0, mode).separatedBrineCollected).toBe(false);
      const svg = flatModelSvg(figureById('desalination')!, 1, mode);
      expect(svg.match(/data-brine-pocket=/g)).toHaveLength(16);
      expect(svg.match(/data-collected="true"/g)).toHaveLength(12);
      expect(svg).not.toMatch(/NaN|Infinity|undefined/);
    });
  }
});

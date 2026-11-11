import { describe, expect, it } from 'vitest';
import { evaluateSoilCare } from '../src/textbook-soil-care-model';
import { figureById } from '../src/textbook-catalog';
import { evaluateFigure } from '../src/textbook-effects';
import { flatModelSvg } from '../src/textbook-flat-model';
import { processTimeline } from '../src/textbook-timeline';

describe('soil cover prevents additional return of salt, without removing the existing salt', () => {
  it('compares all conditions from the same initial salt distribution', () => {
    const start = evaluateSoilCare(0, 0);
    for (const selection of [1, 2]) {
      const other = evaluateSoilCare(0, selection);
      expect(other.packets).toEqual(start.packets);
      expect(other.surfaceSalt).toBe(start.surfaceSalt);
      expect(other.retainedSalt).toBe(1);
    }
  });
  it('retains all salt under cover while reducing upward transfer', () => {
    let previous = evaluateSoilCare(0, 2).surfaceSalt;
    for (let i = 0; i <= 100; i++) {
      const covered = evaluateSoilCare(i / 100, 2), bare = evaluateSoilCare(i / 100, 0);
      expect(covered.retainedSalt).toBe(1);
      expect(covered.drainedSalt).toBe(0);
      expect(covered.surfaceSalt).toBeGreaterThanOrEqual(previous);
      expect(covered.surfaceSalt).toBeLessThanOrEqual(bare.surfaceSalt);
      expect(covered.packets.filter(p => p.drained)).toHaveLength(0);
      previous = covered.surfaceSalt;
    }
    expect(evaluateSoilCare(1, 2).caption).toContain('没有直接脱盐');
  });
  it('keeps the same salt tracers visible after they leave through the drain', () => {
    const start = evaluateSoilCare(0, 1), end = evaluateSoilCare(1, 1);
    expect(end.packets.map(p => p.id)).toEqual(start.packets.map(p => p.id));
    expect(end.packets.filter(p => p.drained)).toHaveLength(15);
    expect(end.packets.filter(p => p.drained).every(p => p.u > .86 && p.height < 5)).toBe(true);
    expect(end.retainedSalt).toBeGreaterThan(0);
    for (let i = 0; i <= 100; i++) {
      const state = evaluateSoilCare(i / 100, 1);
      expect(state.retainedSalt + state.drainedSalt).toBeCloseTo(start.totalSalt, 12);
    }
  });
  it('seeks without time-step history and has no discontinuous salt disappearance', () => {
    for (const selection of [0, 1, 2]) {
      const saved = evaluateSoilCare(.73, selection);
      for (const phase of [1, .01, .5, .99, 0]) evaluateSoilCare(phase, selection);
      expect(evaluateSoilCare(.73, selection)).toEqual(saved);
      for (const phase of [.08, .98, 1]) {
        const a = evaluateSoilCare(phase - 1e-6, selection), b = evaluateSoilCare(phase, selection);
        a.packets.forEach((p, id) => {
          expect(Math.hypot(p.u - b.packets[id].u, p.height - b.packets[id].height)).toBeLessThan(.001);
        });
      }
    }
  });
  it('uses the same results and bookmarks for the native SVG, captions and progress note', () => {
    const figure = figureById('soil-care')!;
    expect(figure.playback).toBe('once');
    expect(figure.restartOnSelection).toBe(true);
    for (const selection of [0, 1, 2]) for (const phase of [0, .1, .5, .99, 1]) {
      const state = evaluateSoilCare(phase, selection), note = processTimeline(figure, phase, selection)!;
      const svg = flatModelSvg(figure, phase, selection);
      expect(note.title).toBe(state.caption);
      expect(note.activeStop).toBe(state.stageIndex);
      expect(note.replacesChoices).toBe(false);
      expect(evaluateFigure(figure, phase, selection).caption).toBe(state.caption);
      expect(svg.match(/data-salt-id=/g)).toHaveLength(20);
      expect(svg).not.toContain('<image');
    }
  });
});

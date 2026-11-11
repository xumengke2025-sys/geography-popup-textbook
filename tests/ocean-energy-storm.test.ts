import { describe, expect, it } from 'vitest';
import { figureById } from '../src/textbook-catalog';
import { evaluateFigure } from '../src/textbook-effects';
import { flatModelSvg } from '../src/textbook-flat-model';
import { processTimeline } from '../src/textbook-timeline';
import { evaluateOceanCurrent } from '../src/textbook-current-model';
import { evaluateSolarHeating } from '../src/textbook-solar-heating-model';
import { evaluateTyphoon } from '../src/textbook-typhoon-model';

describe('one playhead survives bookmarked choices and renderer changes', () => {
  for (const [id, evaluate] of [
    ['currents', evaluateOceanCurrent], ['sun', evaluateSolarHeating], ['typhoon', evaluateTyphoon],
  ] as const) {
    it(`${id}: a stale saved selection cannot replace the current physical or observation state`, () => {
      const f = figureById(id)!;
      expect(f.playback).toBe('once');
      expect(f.controlPhases).toHaveLength(f.controls!.length);
      const phases = [...new Set([0, 1, ...f.controlPhases!, ...Array.from({ length: 41 }, (_, i) => i / 40)])];
      for (const phase of phases) {
        const model = evaluate(phase);
        for (let staleSelection = 0; staleSelection < f.controls!.length; staleSelection++) {
          const current = evaluateFigure(f, phase, staleSelection);
          const note = processTimeline(f, phase, staleSelection)!;
          expect(current.phase).toBe(model.phase);
          expect(current.selection).toBe(model.stageIndex);
          expect(current.caption).toBe(model.caption);
          expect(note.activeStop).toBe(model.stageIndex);
          expect(note.title).toBe(current.caption);
          expect(note.stops.map(stop => stop.phase)).toEqual(f.controlPhases);
          expect(note.stops.map(stop => stop.label)).toEqual(f.controls);
          expect(note.cyclic).toBe(false);
          expect(note.replacesChoices).toBe(true);
        }
        const svg = flatModelSvg(f, phase, f.controls!.length - 1);
        expect(svg).not.toMatch(/<image\b|NaN|Infinity|undefined/);
        expect(svg).toContain(model.caption);
      }
      f.controlPhases!.forEach((phase, index) => expect(evaluate(phase).stageIndex).toBe(index));
    });
  }
});

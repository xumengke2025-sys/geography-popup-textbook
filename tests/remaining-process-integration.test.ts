import { describe, expect, it } from 'vitest';
import { figureById } from '../src/textbook-catalog';
import { evaluateFigure } from '../src/textbook-effects';
import { flatModelSvg } from '../src/textbook-flat-model';
import { processTimeline } from '../src/textbook-timeline';
import { evaluateTemperatureProfile } from '../src/textbook-temperature-model';
import { evaluateSlopeRelief } from '../src/textbook-slope-model';
import { evaluateRecovery } from '../src/textbook-recovery-model';

describe('remaining observations use the shared production playhead', () => {
  it('seeks depth and relief bookmarks without treating stale choices as different scenes', () => {
    for (const [id, evaluate] of [['temperature', evaluateTemperatureProfile], ['slope', evaluateSlopeRelief]] as const) {
      const figure = figureById(id)!;
      const stops = processTimeline(figure, 0, 0)!.stops;
      expect(stops.map(s => s.phase)).toEqual(figure.controlPhases);
      expect(figure.playback).toBe('once');
      for (const phase of [0, .113, .2, .5, .65, .9, 1, .113]) {
        const model = evaluate(phase);
        for (const staleChoice of [0, 1, 2]) {
          const note = processTimeline(figure, phase, staleChoice)!;
          expect(evaluateFigure(figure, phase, staleChoice).selection).toBe(model.stageIndex);
          expect(note.activeStop).toBe(model.stageIndex);
          expect(note.title).toBe(model.caption);
          expect(note.replacesChoices).toBe(true);
          expect(note.progressLabel).toContain('观察');
          expect(flatModelSvg(figure, phase, staleChoice)).not.toContain('<image');
        }
      }
      stops.forEach((stop, index) => expect(evaluate(stop.phase).stageIndex).toBe(index));
    }
  });

  it('keeps two documented places independent while each observation has a continuous playhead', () => {
    const figure = figureById('mitigation')!;
    expect(figure.controlPhases).toBeUndefined();
    expect(figure.restartOnSelection).toBe(true);
    for (const selection of [0, 1]) {
      for (const phase of [0, .13, .5, .86, 1, .13]) {
        const model = evaluateRecovery(phase, selection), note = processTimeline(figure, phase, selection)!;
        expect(evaluateFigure(figure, phase, selection).selection).toBe(selection);
        expect(evaluateFigure(figure, phase, selection).caption).toBe(model.caption);
        expect(note.title).toBe(model.caption);
        expect(note.text).toBe(model.text);
        expect(note.activeStop).toBe(model.stageIndex);
        expect(note.replacesChoices).toBe(false);
        expect(note.stops.every(stop => stop.selection === undefined)).toBe(true);
        expect(model.casesConnectedByTime).toBe(false);
        expect(flatModelSvg(figure, phase, selection)).not.toContain('<image');
      }
    }
  });
});

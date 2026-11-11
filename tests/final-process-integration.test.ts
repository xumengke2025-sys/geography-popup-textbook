import { describe, expect, it } from 'vitest';
import { figureById } from '../src/textbook-catalog';
import { processTimeline } from '../src/textbook-timeline';
import { evaluateFigure } from '../src/textbook-effects';
import { flatModelSvg } from '../src/textbook-flat-model';
import { evaluateGnss } from '../src/textbook-gnss-model';
import { evaluateColdWave } from '../src/textbook-cold-wave-model';
import { evaluateUrbanWater } from '../src/textbook-urban-water-model';

describe('continuous system observations share the actual lesson playhead', () => {
  it('treats GNSS and cold-air choices as bookmarks even with a stale saved choice', () => {
    for (const [id, evaluate] of [['gnss', evaluateGnss], ['cold-wave', evaluateColdWave]] as const) {
      const f = figureById(id)!;
      expect(f.playback).toBe('once');
      const stops = processTimeline(f, 0, 0)!.stops;
      expect(stops.map(stop => stop.phase)).toEqual(f.controlPhases);
      stops.forEach((stop, index) => expect(evaluate(stop.phase).stageIndex).toBe(index));
      for (const phase of [0, .13, .35, .49, .62, .78, .9, 1, .13]) {
        const model = evaluate(phase);
        for (let staleChoice = 0; staleChoice < f.controls!.length; staleChoice++) {
          const note = processTimeline(f, phase, staleChoice)!;
          const display = evaluateFigure(f, phase, staleChoice);
          expect(note.activeStop).toBe(model.stageIndex);
          expect(display.selection).toBe(model.stageIndex);
          expect(display.caption).toBe(model.caption);
          expect(note.title).toBe(model.caption);
          expect(note.replacesChoices).toBe(true);
          expect(note.cyclic).toBe(false);
          expect(flatModelSvg(f, phase, staleChoice)).not.toContain('<image');
        }
      }
    }
  });

  it('updates the GNSS explanation when the message arrives within the same node', () => {
    const f = figureById('gnss')!;
    const sending = processTimeline(f, .72, 2)!;
    const delivered = processTimeline(f, .9, 2)!;
    expect(sending.activeStop).toBe(delivered.activeStop);
    expect(sending.key).not.toBe(delivered.key);
    expect(sending.title).not.toBe(delivered.title);
    expect(delivered.title).toContain('收到');
  });

  it('retains independent urban surfaces but puts the same rainfall on one continuous route', () => {
    const f = figureById('urban-waterlogging')!;
    expect(f.playback).toBe('once');
    expect(f.restartOnSelection).toBe(true);
    expect(f.controlPhases).toBeUndefined();
    for (const selection of [0, 1, 2]) {
      const stops = processTimeline(f, 0, selection)!.stops;
      stops.forEach((stop, index) => expect(evaluateUrbanWater(stop.phase, selection).stageIndex).toBe(index));
      for (const phase of [0, .12, .3, .5, .7, .9, 1, .12]) {
        const model = evaluateUrbanWater(phase, selection);
        const note = processTimeline(f, phase, selection)!;
        expect(note.title).toBe(model.caption);
        expect(note.text).toBe(model.text);
        expect(note.activeStop).toBe(model.stageIndex);
        expect(note.replacesChoices).toBe(false);
        expect(note.stops.every(stop => stop.selection === undefined)).toBe(true);
        expect(evaluateFigure(f, phase, selection).selection).toBe(selection);
        expect(evaluateFigure(f, phase, selection).caption).toBe(model.caption);
        expect(flatModelSvg(f, phase, selection)).not.toContain('<image');
      }
    }
  });
});

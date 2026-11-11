import { describe, expect, it } from 'vitest';
import { figureById } from '../src/textbook-catalog';
import { evaluateSeaBreeze } from '../src/model';
import { evaluateCoastalProcess } from '../src/textbook-coastal-process-model';
import { evaluateGis } from '../src/textbook-gis-model';
import { evaluateRiverCutoff } from '../src/textbook-river-model';
import { evaluateTide } from '../src/textbook-tide-model';
import { processTimeline, seekProcessPhase } from '../src/textbook-timeline';
import { evaluateAirProcess } from '../src/textbook-air-process-model';
import { evaluateRemoteSensing } from '../src/textbook-remote-model';
import { evaluateFigure } from '../src/textbook-effects';
import { evaluateAtmosphere } from '../src/textbook-atmosphere-model';
import { evaluateForest } from '../src/textbook-forest-model';
import { evaluateWaterCycle } from '../src/textbook-water-cycle-model';
import { evaluateInsolation, INSOLATION_STOPS } from '../src/textbook-insolation-model';

function figure(id: string) {
  const value = figureById(id);
  if (!value) throw new Error(`Missing production figure: ${id}`);
  return value;
}

function timeline(id: string, phase: number, selection = 0) {
  const value = processTimeline(figure(id), phase, selection);
  if (!value) throw new Error(`Missing process timeline: ${id}`);
  return value;
}

describe('process narratives follow the production scientific state', () => {
  it('uses one continuous observation latitude for insolation geometry, choices and the side note', () => {
    const f = figure('solar-distribution');
    expect(f.controlPhases).toEqual(INSOLATION_STOPS.map(stop => stop.phase));
    expect(f.playback).toBe('once');
    for (const phase of [0, .2, .5, .8, 1, .5, 0]) {
      const model = evaluateInsolation(phase);
      for (const staleChoice of [0, 1, 2]) {
        const note = timeline(f.id, phase, staleChoice), state = evaluateFigure(f, phase, staleChoice);
        expect(state.selection).toBe(model.selection);
        expect(state.caption).toBe(model.caption);
        expect(note.activeStop).toBe(model.selection);
        expect(note.replacesChoices).toBe(true);
        expect(note.cyclic).toBe(false);
        expect(note.progressLabel).toBe('观察纬度');
      }
    }
  });
  it('uses spatial bookmarks for a single retained atmosphere and forest instead of separate scenes', () => {
    for (const [id, evaluate] of [['atmosphere', evaluateAtmosphere], ['forest', evaluateForest]] as const) {
      const f = figure(id), stops = timeline(id, 0).stops;
      expect(f.playback).toBe('once');
      expect(stops.map(stop => stop.phase)).toEqual(f.controlPhases);
      for (const stop of stops) {
        const state = evaluate(stop.phase);
        expect(state.stageIndex).toBe(stop.selection);
        for (const staleChoice of [0, 1, 2]) {
          const note = timeline(id, stop.phase, staleChoice);
          expect(note.activeStop).toBe(state.stageIndex);
          expect(note.progressLabel).toBe('观察位置');
          expect(note.replacesChoices).toBe(true);
          expect(note.cyclic).toBe(false);
          expect(evaluateFigure(f, stop.phase, staleChoice).selection).toBe(state.stageIndex);
          expect(evaluateFigure(f, stop.phase, staleChoice).caption).toBe(state.caption);
        }
      }
    }
    expect(timeline('atmosphere', .85).text).toContain('先下降');
    expect(timeline('atmosphere', .42).text).toContain('为主');
    expect(timeline('forest', 1).text).toContain('光照减弱');
  });

  it('keeps cycle type independent from the process playhead and follows the same finite water samples', () => {
    const f = figure('water');
    expect(f.playback).toBe('once');
    expect(f.restartOnSelection).toBe(true);
    expect(f.controlPhases).toBeUndefined();
    for (const type of [0, 1, 2]) {
      const first = evaluateWaterCycle(0, type), stops = timeline('water', 0, type).stops;
      expect(stops).toHaveLength(type === 0 ? 6 : 4);
      stops.forEach((stop, index) => {
        const state = evaluateWaterCycle(stop.phase, type), note = timeline('water', stop.phase, type);
        expect(note.activeStop).toBe(index);
        expect(note.activeStop).toBe(state.stageIndex);
        expect(note.title).toBe(state.caption);
        expect(note.stage).toBe(state.cycle);
        expect(note.replacesChoices).toBe(false);
        expect(note.cyclic).toBe(false);
        expect(stop.selection).toBeUndefined();
        expect(state.samples.map(sample => sample.id)).toEqual(first.samples.map(sample => sample.id));
        expect(evaluateFigure(f, stop.phase, type).selection).toBe(type);
      });
      expect(evaluateWaterCycle(1, type).inventory.returned).toBe(6);
    }
    expect(timeline('water', 1, 1).text).toContain('陆地');
    expect(timeline('water', 1, 2).text).toContain('独立对照');
  });

  it('keeps heat and circulation in one process even when a stale saved choice names another step', () => {
    for (const id of ['heating', 'thermal'] as const) {
      const f = figure(id), effect = id === 'heating' ? 'heat' : 'circulation';
      expect(f.playback).toBe('once');
      const stops = timeline(id, 0).stops;
      expect(stops.map(s => s.phase)).toEqual(f.controlPhases);
      stops.forEach((stop, index) => {
        const model = evaluateAirProcess(effect, stop.phase);
        expect(model.stageIndex).toBe(index);
        for (let savedChoice = 0; savedChoice < stops.length; savedChoice++) {
          const note = timeline(id, stop.phase, savedChoice);
          const displayed = evaluateFigure(f, stop.phase, savedChoice);
          expect(note.activeStop).toBe(index);
          expect(note.title).toBe(model.caption);
          expect(displayed.selection).toBe(index);
          expect(displayed.caption).toBe(note.title);
          expect(note.replacesChoices).toBe(true);
          expect(note.cyclic).toBe(false);
        }
      });
    }
    expect(timeline('thermal', .74).text).toContain('分别在近地面和高空');
    expect(timeline('heating', 1).text).toContain('不是实际气象时间');
  });

  it('keeps the remote-sensing samples through acquisition, reception, processing and output', () => {
    const f = figure('remote'), stops = timeline('remote', 0).stops;
    expect(f.playback).toBe('once');
    expect(stops.map(stop => stop.phase)).toEqual(f.controlPhases);
    stops.forEach((stop, index) => {
      const s = evaluateRemoteSensing(stop.phase), note = timeline('remote', stop.phase, 3 - index);
      expect(note.activeStop).toBe(index);
      expect(note.activeStop).toBe(s.selection);
      expect(evaluateFigure(f, stop.phase, 3 - index).selection).toBe(index);
      expect(note.cyclic).toBe(false);
      expect(note.replacesChoices).toBe(true);
      if (index >= 1) expect(s.counts.captured).toBe(12);
      if (index >= 2) expect(s.counts.received).toBe(12);
      if (index >= 3) expect(s.counts.processed).toBe(12);
    });
    expect(evaluateRemoteSensing(1).counts.output).toBe(12);
    expect(timeline('remote', 1).text).toContain('没有自动识别地类或预测灾害');
  });

  it('retains condition choices while revealing their internal process', () => {
    for (const [id, choices] of [['salinity', 3], ['soil', 6], ['slide', 2], ['earthquake', 3]] as const) {
      for (let selection = id === 'earthquake' ? 1 : 0; selection < choices; selection++) {
        for (const phase of [0, .2, .6, 1]) {
          const note = timeline(id, phase, selection);
          expect(note.replacesChoices).toBe(false);
          expect(note.cyclic).toBe(false);
          expect(note.title).toBeTruthy();
          expect(note.text).toBeTruthy();
          expect(note.activeStop).toBeGreaterThanOrEqual(0);
          expect(note.activeStop).toBeLessThan(note.stops.length);
        }
      }
    }
    expect(processTimeline(figure('earthquake'), .5, 0)).toBeNull();
    expect(timeline('soil', .6, 0)).toEqual(timeline('soil', .6, 5));
    expect(timeline('slide', .5, 0).stage).toBe('滑坡');
    expect(timeline('slide', .5, 1).stage).toBe('泥石流');
  });

  it('keeps the thermal lag at sunrise and sunset, and weakens before reversing', () => {
    const sunrise = evaluateSeaBreeze({ phase: .25, contrast: 1 });
    expect(sunrise.land).toBeLessThan(sunrise.sea);
    expect(sunrise.direction).toBe(-1);
    expect(timeline('breeze', .25).title).toBe('陆风吹向海洋');
    expect(timeline('breeze', .25).text).toContain('太阳已升起');

    const sunset = evaluateSeaBreeze({ phase: .75, contrast: 1 });
    expect(sunset.land).toBeGreaterThan(sunset.sea);
    expect(sunset.direction).toBe(1);
    expect(timeline('breeze', .75).title).toBe('海风吹向陆地');
    expect(timeline('breeze', .76).text).toContain('日落不等于风立即转向');

    const weak = evaluateSeaBreeze({ phase: .8, contrast: 1 });
    expect(weak.strength).toBeLessThan(.08);
    expect(timeline('breeze', .8).key).toContain('weak');
    expect(timeline('breeze', .8).title).toContain('旗垂落');
  });

  it('puts the four daylight shortcuts in their model stages without assigning sunrise a wind answer', () => {
    const stops = timeline('breeze', 0).stops;
    expect(stops.map(stop => stop.label)).toEqual(['夜晚', '日出', '白天', '日落']);
    const stages = ['夜间', '日出附近', '午后', '日落附近'];
    const directions = [-1, -1, 1, 1];
    stops.forEach((stop, i) => {
      const state = evaluateSeaBreeze({ phase: stop.phase, contrast: 1 });
      expect(state.stage).toBe(stages[i]);
      expect(state.direction).toBe(directions[i]);
      expect(timeline('breeze', stop.phase, stop.selection ?? 0).activeStop).toBe(i);
    });
    expect(stops.map(stop => stop.selection)).toEqual([1, undefined, 0, undefined]);
  });

  it('uses the actual tide state at shortcuts and between them, regardless of the old choice index', () => {
    const stops = timeline('tides', 0).stops;
    const stages = ['low', 'rising', 'high', 'falling'];
    expect(stops).toHaveLength(4);
    stops.forEach((stop, i) => {
      const state = evaluateTide(stop.phase);
      const narrative = timeline('tides', stop.phase, stop.selection);
      expect(state.stage).toBe(stages[i]);
      expect(narrative.activeStop).toBe(i);
      expect(narrative.title).toBe(state.caption);
      expect(narrative.key).toBe(`tide-${state.stage}`);
    });
    expect(evaluateTide(.6).direction).toBe(-1);
    for (const selection of [0, 1, 2, 3]) {
      expect(timeline('tides', .6, selection).title).toBe('落潮');
      expect(timeline('tides', .6, selection).activeStop).toBe(3);
    }
    expect(timeline('tides', 1)).toEqual(timeline('tides', 0));
  });

  it('seeks a possible river cutoff from the intact bend through breach to an isolated lake', () => {
    const stops = timeline('river', 0).stops;
    expect(stops).toHaveLength(3);
    stops.forEach((stop, i) => {
      const state = evaluateRiverCutoff(stop.phase);
      const narrative = timeline('river', stop.phase, stop.selection);
      expect(state.stage).toBe(i);
      expect(narrative.activeStop).toBe(state.stage);
      expect(narrative.title).toBe(state.caption);
    });
    const initial = evaluateRiverCutoff(stops[0].phase);
    const breaching = evaluateRiverCutoff(stops[1].phase);
    const isolated = evaluateRiverCutoff(stops[2].phase);
    expect(initial.shortcut).toHaveLength(0);
    expect(breaching.breach).toBeGreaterThan(0);
    expect(breaching.isolated).toBe(false);
    expect(isolated.isolated).toBe(true);
    expect(timeline('river', 0).text).toContain('并非每条河曲');
    for (const phase of [.41, .43, .83, .85]) {
      const state = evaluateRiverCutoff(phase);
      expect(timeline('river', phase).activeStop).toBe(state.stage);
      expect(timeline('river', phase).title).toBe(state.caption);
    }
  });

  it('distinguishes GIS alignment from classification and derives its final count from the same stations', () => {
    const stages = [
      { phase: 0, stage: 'separated', stop: 0 },
      { phase: .3, stage: 'aligning', stop: 0 },
      { phase: .54, stage: 'aligned', stop: 1 },
      { phase: .7, stage: 'classifying', stop: 1 },
      { phase: 1, stage: 'result', stop: 1 },
    ];
    for (const sample of stages) {
      const state = evaluateGis(sample.phase);
      const narrative = timeline('gis', sample.phase);
      expect(state.stage).toBe(sample.stage);
      expect(narrative.key).toBe(`gis-${state.stage}`);
      expect(narrative.activeStop).toBe(sample.stop);
      if (state.overlay < 1) {
        expect(state.resultReady).toBe(false);
        expect(state.counts.every(count => !count.visible && count.count === 0)).toBe(true);
        expect(narrative.title).not.toContain('统计');
      }
    }
    const stops = timeline('gis', 0).stops;
    expect(stops.map(stop => evaluateGis(stop.phase).stage)).toEqual(['separated', 'result']);
    const result = evaluateGis(stops[1].phase);
    expect(result.stations).toHaveLength(33);
    expect(result.counts.map(count => count.count)).toEqual([5, 15, 13]);
    expect(result.counts.every(count => count.complete)).toBe(true);
    expect(timeline('gis', 1).text).toContain('5、15、13');
  });

  it('gives the cliff example four physical stages while retaining its independent coastal choices', () => {
    const stops = timeline('coastal-landform', 0).stops;
    const stages = ['undercut', 'fracture', 'collapse', 'platform'];
    expect(stops).toHaveLength(4);
    stops.forEach((stop, i) => {
      const state = evaluateCoastalProcess(stop.phase);
      const narrative = timeline('coastal-landform', stop.phase);
      expect(state.stage).toBe(stages[i]);
      expect(narrative.activeStop).toBe(i);
      expect(narrative.key).toBe(`coastal-${state.stage}`);
      expect(narrative.replacesChoices).toBe(false);
    });
    const states = stops.map(stop => evaluateCoastalProcess(stop.phase));
    expect(states[0].inventory.falling).toBe(0);
    expect(states[1].undercut).toBeGreaterThan(states[0].undercut);
    expect(states[1].inventory.attached).toBe(3);
    expect(states[2].inventory.falling).toBeGreaterThan(0);
    expect(states[3].inventory).toEqual({ attached: 0, falling: 0, deposited: 3, total: 3 });
    expect(timeline('coastal-landform', 1).text).toContain('不是新长出的地面');
  });

  it('never labels the arch, stack or depositional beach as later cliff stages', () => {
    for (const selection of [1, 2, 3]) {
      for (const phase of [0, .18, .44, .67, 1]) {
        expect(processTimeline(figure('coastal-landform'), phase, selection)).toBeNull();
      }
    }
  });

  it('keeps independent conditions and landforms out of a shared evolutionary timeline', () => {
    const independent = ['density', 'wind-forces', 'aeolian', 'vegetation',
      'river-valley', 'karst-livelihood', 'soil-factors', 'greenhouse', 'karst'];
    for (const id of independent) {
      const f = figure(id);
      for (let selection = 0; selection < (f.controls?.length ?? 1); selection++) {
        for (const phase of [0, .45, 1]) {
          expect(processTimeline(f, phase, selection), `${id}, choice ${selection}, phase ${phase}`).toBeNull();
        }
      }
    }
  });

  it('repeats natural cycles but does not silently rewind irreversible demonstrations', () => {
    for (const id of ['breeze', 'tides']) {
      expect(timeline(id, .4).cyclic).toBe(true);
      expect(timeline(id, .4).replacesChoices).toBe(true);
    }
    for (const id of ['river', 'gis', 'coastal-landform']) {
      expect(timeline(id, .4).cyclic).toBe(false);
    }
  });
});

describe('seeking the production phase', () => {
  it('crosses the cycle boundary by the shorter route in either direction', () => {
    for (const [from, to, forward] of [[.95, .05, true], [.05, .95, false]] as const) {
      const path = Array.from({ length: 21 }, (_, i) => seekProcessPhase(from, to, i / 20, true));
      expect(Math.min(path[10], 1 - path[10])).toBeLessThan(1e-12);
      const unwrapped = path.map(phase => forward ? (phase < .5 ? phase + 1 : phase) : (phase > .5 ? phase - 1 : phase));
      path.forEach(phase => {
        expect(phase).toBeGreaterThanOrEqual(0);
        expect(phase).toBeLessThan(1);
        expect(Math.min(phase, 1 - phase)).toBeLessThanOrEqual(.05 + 1e-12);
      });
      for (let i = 1; i < unwrapped.length; i++) {
        expect((unwrapped[i] - unwrapped[i - 1]) * (forward ? 1 : -1)).toBeGreaterThanOrEqual(-1e-12);
      }
    }
  });

  it('moves noncyclic processes monotonically through their interior instead of wrapping', () => {
    for (const [from, to] of [[.1, .9], [.9, .1]]) {
      const path = Array.from({ length: 21 }, (_, i) => seekProcessPhase(from, to, i / 20, false));
      expect(path[10]).toBeCloseTo(.5, 12);
      path.forEach(phase => {
        expect(phase).toBeGreaterThanOrEqual(.1 - 1e-12);
        expect(phase).toBeLessThanOrEqual(.9 + 1e-12);
      });
      for (let i = 1; i < path.length; i++) {
        expect((path[i] - path[i - 1]) * Math.sign(to - from)).toBeGreaterThanOrEqual(-1e-12);
      }
    }
  });

  it('preserves exact destination endpoints, including phase one, and clamps seek progress', () => {
    for (const cyclic of [false, true]) {
      for (const to of [0, 1, .987654321]) {
        expect(seekProcessPhase(.37, to, 0, cyclic)).toBeCloseTo(.37, 14);
        expect(seekProcessPhase(.37, to, -2, cyclic)).toBeCloseTo(.37, 14);
        expect(seekProcessPhase(.37, to, 1, cyclic)).toBe(to);
        expect(seekProcessPhase(.37, to, 2, cyclic)).toBe(to);
      }
    }
  });
});

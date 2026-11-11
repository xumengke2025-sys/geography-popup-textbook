import { describe, expect, it } from 'vitest';
import { QUAKE_LAYOUT, evaluateQuake, quakeSvg } from '../src/textbook-quake-model';

describe('post-event earthquake warning', () => {
  it('keeps the epicentre directly above the underground source', () => {
    expect(QUAKE_LAYOUT.source[0]).toBe(QUAKE_LAYOUT.epicenter[0]);
    expect(QUAKE_LAYOUT.source[2]).toBe(QUAKE_LAYOUT.epicenter[2]);
    expect(QUAKE_LAYOUT.source[1]).toBeLessThan(QUAKE_LAYOUT.epicenter[1]);
    expect(evaluateQuake(0, 0).view).toBe('structure');
  });
  it('does not detect, communicate or warn before the earthquake', () => {
    const s = evaluateQuake(0, 1);
    expect([s.occurred, s.detected, s.sent, s.alerted, s.sArrived]).toEqual([false, false, false, false, false]);
    expect(s.pRadius).toBe(0); expect(s.sRadius).toBe(0);
    expect(s.prequakePrediction).toBe(false);
  });
  it('has P arrival, detection, communication, warning and strong shaking in causal order for the distant town', () => {
    const s = evaluateQuake(1, 1), e = s.events;
    expect(e.earthquake).toBeLessThan(e.stationP);
    expect(e.stationP).toBeLessThan(e.dispatch);
    expect(e.dispatch).toBeLessThan(e.warningArrival);
    expect(e.warningArrival).toBeLessThan(e.targetS);
    expect(e.targetP).toBeLessThan(e.targetS);
    expect(e.targetS).toBeLessThan(1);
    const interval = evaluateQuake((e.warningArrival + e.targetS) / 2, 1);
    expect(interval.alerted).toBe(true); expect(interval.sArrived).toBe(false);
    expect(interval.stage).toBe('lead');
  });
  it('allows no advance warning near the epicentre', () => {
    const s = evaluateQuake(1, 2), e = s.events;
    expect(s.hasLead).toBe(false);
    expect(e.targetS).toBeLessThan(e.warningArrival);
    const hit = evaluateQuake((e.targetS + e.warningArrival) / 2, 2);
    expect(hit.sArrived).toBe(true); expect(hit.alerted).toBe(false);
    expect(hit.caption).toBe('震动先到');
    expect(s.caption).toBe('无提前量');
  });
  it('never sends or receives a warning before the required preceding event', () => {
    for (const selection of [1, 2]) for (let i = 0; i <= 500; i++) {
      const s = evaluateQuake(i / 500, selection);
      if (s.alerted) expect(s.sent && s.detected && s.occurred).toBe(true);
      if (s.sent) expect(s.detected && s.occurred).toBe(true);
      if (s.detected) expect(s.occurred).toBe(true);
      if (s.occurred) expect(s.pRadius).toBeGreaterThanOrEqual(s.sRadius);
    }
  });
  it('seeks and reverses exactly, with a held, unshaking result', () => {
    const a = evaluateQuake(.43, 1);
    evaluateQuake(1, 2); evaluateQuake(0, 0);
    expect(evaluateQuake(.43, 1)).toEqual(a);
    expect(evaluateQuake(-1, 1)).toEqual(evaluateQuake(0, 1));
    expect(evaluateQuake(NaN, 1)).toEqual(evaluateQuake(0, 1));
    for (const selection of [1, 2]) {
      expect(evaluateQuake(1, selection).stage).toBe('result');
      expect(evaluateQuake(1, selection).shake).toBeCloseTo(0, 10);
    }
  });
  it('renders the same event status in native SVG without textbook image sampling or uncalibrated seconds', () => {
    for (const selection of [0, 1, 2]) for (const phase of [0, .25, .34, .5, .8, 1]) {
      const s = evaluateQuake(phase, selection), svg = quakeSvg(phase, selection);
      expect(svg).toContain(`data-quake-stage="${s.stage}"`);
      expect(svg).toContain(`data-quake-alerted="${s.alerted}"`);
      expect(svg).toContain(`data-quake-s-arrived="${s.sArrived}"`);
      expect(svg).not.toContain('<image');
      expect(svg).not.toMatch(/\d+\s*秒/);
    }
  });
});

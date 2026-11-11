import { describe, expect, it } from 'vitest';
import { evaluateTide, tideGround, tideShoreX, tideSvg, TIDE_LAYOUT as L } from '../src/textbook-tide-model';

describe('a single coastal tide cycle', () => {
  it('keeps the low and high presets and classifies an actual falling tide after the high water', () => {
    expect(evaluateTide(0).caption).toBe('低潮'); expect(evaluateTide(1).caption).toBe('低潮');
    expect(evaluateTide(.25).caption).toBe('涨潮'); expect(evaluateTide(.5).caption).toBe('高潮');
    expect(evaluateTide(.6).caption).toBe('落潮'); expect(evaluateTide(.75).caption).toBe('落潮');
    expect(evaluateTide(.014).stage).toBe('low'); expect(evaluateTide(.986).stage).toBe('low');
    expect(evaluateTide(.491).stage).toBe('high'); expect(evaluateTide(.509).stage).toBe('high');
  });
  it('returns to the identical water, boat and shoreline at the loop join', () => {
    const a = evaluateTide(0), b = evaluateTide(1);
    expect(a.waterLevel).toBe(L.low); expect(b.waterLevel).toBe(a.waterLevel);
    expect(b.shoreline).toEqual(a.shoreline); expect(b.boat).toEqual(a.boat); expect(b.gauge).toEqual(a.gauge);
    expect(evaluateTide(.5).waterLevel).toBe(L.high);
    expect(Math.abs(evaluateTide(.00001).waterLevel - evaluateTide(.99999).waterLevel)).toBeLessThan(1e-10);
  });
  it('makes every shoreline vertex the actual intersection of one sea level and the same sloping beach', () => {
    for (let i = 0; i <= 150; i++) {
      const s = evaluateTide(i / 150);
      for (const [x, y, z] of s.shoreline) {
        expect(y).toBe(s.waterLevel); expect(tideGround(x, z)).toBeCloseTo(y, 10);
        expect(tideGround(x - .1, z)).toBeLessThan(y); expect(tideGround(x + .1, z)).toBeGreaterThan(y);
        expect(x).toBeGreaterThan(L.seaLeft); expect(x).toBeLessThan(L.landRight);
      }
    }
  });
  it('advances the shore landward while rising and exposes the same intertidal band on the way back', () => {
    let previous = evaluateTide(0);
    for (let i = 1; i <= 50; i++) {
      const s = evaluateTide(i / 100);
      expect(s.waterLevel).toBeGreaterThanOrEqual(previous.waterLevel);
      expect(s.shorelineFront).toBeGreaterThanOrEqual(previous.shorelineFront);
      expect(s.intertidal.exposedFraction).toBeLessThanOrEqual(previous.intertidal.exposedFraction);
      expect(evaluateTide(1 - i / 100).waterLevel).toBeCloseTo(s.waterLevel, 10);
      previous = s;
    }
    expect(evaluateTide(0).intertidal.exposedFraction).toBe(1); expect(evaluateTide(.5).intertidal.exposedFraction).toBe(0);
  });
  it('floats the boat on the same waterline with a fixed draft and keeps the gauge stationary', () => {
    for (let i = 0; i <= 100; i++) {
      const s = evaluateTide(i / 100);
      expect(s.boat.waterline).toBe(s.waterLevel); expect(s.boat.keel).toBeCloseTo(s.waterLevel - L.boatDraft, 10);
      expect(s.boat.keel).toBeGreaterThan(tideGround(s.boat.x, s.boat.z));
      expect(s.gauge.x).toBe(L.gaugeX); expect(s.gauge.z).toBe(L.gaugeZ); expect(s.gauge.top).toBe(L.gaugeTop);
      expect(s.gauge.waterMark).toBe(s.waterLevel);
    }
  });
  it('ignores the preset selection, seeks in either direction and bounds invalid inputs', () => {
    for (const selection of [0, 1, 2, 3]) expect(evaluateTide(.6, selection)).toEqual(evaluateTide(.6));
    const s = evaluateTide(.35); evaluateTide(1); evaluateTide(.1); expect(evaluateTide(.35)).toEqual(s);
    expect(evaluateTide(NaN)).toEqual(evaluateTide(0)); expect(evaluateTide(-1)).toEqual(evaluateTide(0));
    expect(evaluateTide(2)).toEqual(evaluateTide(1));
  });
  it('does not turn schematic phase or water height into measured tide times or local current directions', () => {
    const s = evaluateTide(.6);
    expect(s.units).toBe('schematic-cycle'); expect(s.locationSpecific).toBe(false); expect(s.tideCurrentCalculated).toBe(false);
    expect(tideShoreX(s.waterLevel, 20)).not.toBe(tideShoreX(s.waterLevel, 40));
  });
  it('uses the same water, boat and shore state in the native SVG without a sampled page image', () => {
    for (const phase of [0, .25, .5, .6, .75, 1]) {
      const s = evaluateTide(phase), svg = tideSvg(phase, 3);
      expect(svg).toContain(`data-tide-stage="${s.stage}"`); expect(svg).toContain(`data-tide-level="${s.waterLevel}"`);
      expect(svg).toContain(`data-tide-shore="${s.shorelineFront}"`); expect(svg).toContain(`data-tide-boat="${s.boat.waterline}"`);
      expect(svg).toContain(`data-tide-gauge-mark="${s.gauge.waterMark}"`);
      expect(svg).not.toContain('<image'); expect(svg).not.toMatch(/\d+\s*(米|时|秒)|marker-end/);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { evaluateSolarDisturbance, evaluateSphereExchange, evaluateMarsTransfer, evaluateGreenhouseResponse,
  evaluateWindForces, GEOLOGICAL_INTERVALS, geologicalInterval } from '../src/textbook-sky-causality-model';
import { flatSkyExtra } from '../src/textbook-flat-sky-extra';
import type { Figure } from '../src/textbook-catalog';

describe('paper models preserve departure, reception and consequence', () => {
  it('does not light the polar receiver before the same disturbance reaches it', () => {
    expect(evaluateSolarDisturbance(.43, 1).magnetosphereResponse).toBe(0);
    expect(evaluateSolarDisturbance(.71, 1).auroraResponse).toBe(0);
    expect(evaluateSolarDisturbance(.90, 1).auroraResponse).toBeGreaterThan(.9);
    expect(evaluateSolarDisturbance(1, 0).auroraResponse).toBe(0);
    expect(evaluateSolarDisturbance(.2, 1).eventIds).toEqual(evaluateSolarDisturbance(.95, 1).eventIds);
  });
  it('gives a proportional geological ruler rather than four equal eras', () => {
    const spans = GEOLOGICAL_INTERVALS.map((_, i) => geologicalInterval(i));
    expect(spans.reduce((sum, s) => sum + s.fraction, 0)).toBeCloseTo(1, 12);
    expect(spans[0].fraction).toBeGreaterThan(.88);
    expect(spans[3].fraction).toBeCloseTo(66 / 4600, 12);
    spans.slice(0, -1).forEach((span, i) => expect(span.end).toBe(spans[i + 1].start));
  });
  it('retains the same water identities across soil, plant and atmosphere', () => {
    const root = evaluateSphereExchange(.2, 2), leaf = evaluateSphereExchange(.55, 2), vapor = evaluateSphereExchange(.95, 2);
    expect(root.waterIds).toEqual(leaf.waterIds); expect(vapor.waterIds).toEqual(root.waterIds);
    expect(root.leafResponse).toBe(0); expect(leaf.leafResponse).toBeGreaterThan(0);
    expect(vapor.biologicalGrowthSimulated).toBe(false);
  });
  it('keeps reclaimed water identity and delays receiving-module responses', () => {
    const start = evaluateMarsTransfer(.1, 1), middle = evaluateMarsTransfer(.5, 1), end = evaluateMarsTransfer(1, 1);
    expect(start.packets.map(p => p.id)).toEqual(end.packets.map(p => p.id));
    expect(start.purifierReceived).toBe(false); expect(middle.purifierReceived).toBe(true);
    expect(middle.crewWaterReceived).toBe(false); expect(end.crewWaterReceived).toBe(true);
    expect(end.packets.every(p => p.received)).toBe(true);
    expect(evaluateMarsTransfer(.31, 1).packets[0]).toMatchObject({ leg: 1, legProgress: 0 });
    expect(evaluateMarsTransfer(.62, 1).packets[0]).toMatchObject({ leg: 2, legProgress: 0 });
    expect(evaluateMarsTransfer(.94, 1).packets[0]).toMatchObject({ leg: 2, legProgress: 1, received: true });
  });
  it('keeps CO2, oxygen and food as separate transfers and highlights only the selected circuit', () => {
    expect(evaluateMarsTransfer(.9, 0).packets).toHaveLength(0);
    expect(evaluateMarsTransfer(.7, 2).packets.map(p => p.kind)).toEqual(['carbon-dioxide', 'oxygen', 'food']);
    expect(evaluateMarsTransfer(.29, 2).plantResponse).toBe(0);
    expect(evaluateMarsTransfer(.4, 2).crewOxygenResponse).toBe(0);
    expect(evaluateMarsTransfer(1, 3).packets.map(p => p.kind)).toEqual(['electricity']);
  });
  it('compares identical solar input and delays the ground difference until return reception', () => {
    for (const phase of [.1, .3, .6, .77]) {
      const noAir = evaluateGreenhouseResponse(phase, 0);
      for (const selection of [1, 2]) {
        const s = evaluateGreenhouseResponse(phase, selection);
        expect(s.shortwave).toBe(noAir.shortwave); expect(s.groundHeat).toBeCloseTo(noAir.groundHeat, 12);
      }
    }
    expect(evaluateGreenhouseResponse(1, 2).groundHeat).toBeGreaterThan(evaluateGreenhouseResponse(1, 1).groundHeat);
    expect(evaluateGreenhouseResponse(1, 1).groundHeat).toBeGreaterThan(evaluateGreenhouseResponse(1, 0).groundHeat);
    expect(evaluateGreenhouseResponse(1, 0).returnReceived).toBe(0);
  });
  it('preserves perpendicular Coriolis and opposite friction on the same air parcel', () => {
    for (const selection of [1, 2, 3]) {
      const s = evaluateWindForces(selection), dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1];
      expect(dot(s.wind, s.coriolis)).toBeCloseTo(0, 12);
      if (selection > 1) expect(dot(s.wind, s.friction)).toBeLessThan(0);
      for (const axis of [0, 1]) expect(s.gradient[axis] + s.coriolis[axis] + s.friction[axis]).toBeCloseTo(0, 12);
    }
  });
  it('is deterministic under reverse seeking and independent of render history', () => {
    const a = [evaluateSolarDisturbance(.531, 1), evaluateMarsTransfer(.531, 2), evaluateGreenhouseResponse(.831, 2)];
    evaluateSolarDisturbance(.9, 1); evaluateMarsTransfer(0, 3); evaluateGreenhouseResponse(1, 0);
    expect([evaluateSolarDisturbance(.531, 1), evaluateMarsTransfer(.531, 2), evaluateGreenhouseResponse(.831, 2)]).toEqual(a);
  });
  it('uses the same reception state in native SVG and never shows an early polar response', () => {
    const figure = (effect: string) => ({ effect, title: effect }) as Figure;
    const cases = [
      ['solar-activity', .71, 1, evaluateSolarDisturbance(.71, 1)],
      ['external-spheres', .55, 2, evaluateSphereExchange(.55, 2)],
      ['mars-base', .62, 1, evaluateMarsTransfer(.62, 1)],
      ['greenhouse', .77, 2, evaluateGreenhouseResponse(.77, 2)],
    ] as const;
    for (const [effect, phase, selected, state] of cases) {
      const svg = flatSkyExtra(figure(effect), phase, selected)!;
      expect(svg).toContain(`data-sky-causality-state='${JSON.stringify(state)}'`);
      expect(svg).not.toContain('<image');
    }
    expect(flatSkyExtra(figure('solar-activity'), .71, 1)).not.toContain('data-polar-response');
    expect(flatSkyExtra(figure('solar-activity'), .91, 1)).toContain('data-polar-response');
  });
});

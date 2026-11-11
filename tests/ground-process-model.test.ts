import { describe, expect, it } from 'vitest';
import {
  evaluateCaveDeposition, evaluateDensityComparison, evaluateDroughtSequence,
  evaluateFloodSequence, evaluateKarstCover, evaluateSeismicParticles,
  evaluateSoilPores, evaluateSoilProvenance,
} from '../src/textbook-ground-process-model';
import { figureById } from '../src/textbook-catalog';
import { flatModelSvg } from '../src/textbook-flat-model';

describe('ground-process explanations preserve causal evidence', () => {
  it('keeps equal volumes and settles mass comparisons for each fixed condition', () => {
    const same = evaluateDensityComparison(0);
    expect(same.angle).toBe(0); expect(same.massTokens[0]).toBe(same.massTokens[1]);
    for (const mode of [1, 2]) {
      const comparison = evaluateDensityComparison(mode);
      expect(comparison.equalVolumes).toBe(true);
      expect(comparison.angle).toBeLessThan(0);
      expect(comparison.massTokens[1]).toBeGreaterThan(comparison.massTokens[0]);
      expect(evaluateDensityComparison(mode)).toEqual(comparison);
    }
  });

  it('keeps the same density comparison in the two-dimensional fallback at every phase', () => {
    const figure = figureById('density')!;
    for (const mode of [0, 1, 2]) {
      const initial = flatModelSvg(figure, 0, mode);
      expect(flatModelSvg(figure, .38, mode)).toBe(initial);
      expect(flatModelSvg(figure, 1, mode)).toBe(initial);
    }
  });

  it('replaces pore air with water without changing pore or solid volume', () => {
    const states = [0, 1, 2].map(evaluateSoilPores);
    for (const state of states) {
      expect(state.water + state.air).toBeCloseTo(state.poreVolume);
      expect(state.solidVolumeChanges).toBe(false);
    }
    expect(states[0].water).toBeLessThan(states[1].water);
    expect(states[1].water).toBeLessThan(states[2].water);
    expect(states[0].air).toBeGreaterThan(states[2].air);
  });

  it('oscillates the same particles about fixed equilibrium positions', () => {
    const initial = evaluateSeismicParticles(0, 0);
    for (let step = 0; step <= 40; step++) {
      const state = evaluateSeismicParticles(step / 40, 0);
      state.particles.forEach((particle, i) => {
        expect(particle.restX).toBe(initial.particles[i].restX);
        expect(Math.abs(particle.pDx)).toBeLessThanOrEqual(1.65);
        expect(particle.pDy).toBe(0); expect(particle.sDx).toBe(0);
        if (i >= 10) expect(particle.sDy).toBe(0);
      });
    }
    expect(evaluateSeismicParticles(.31, 1).particles.slice(10).some(p => Math.abs(p.sDy) > 1)).toBe(true);
  });

  it('waits for arrival before growing a floor deposit and retains the final evidence', () => {
    const beforeArrival = evaluateCaveDeposition(.264, 1);
    expect(beforeArrival.drops.some(drop => drop.arrived)).toBe(false);
    expect(beforeArrival.deposits.every(deposit => deposit.rising === 1.5)).toBe(true);
    const end = evaluateCaveDeposition(1, 1);
    expect(end.drops.every(drop => drop.arrived && !drop.visible)).toBe(true);
    expect(end.deposits.every(deposit => deposit.hanging > 2.3 && deposit.rising > 1.5)).toBe(true);
    expect(evaluateCaveDeposition(1, 1)).toEqual(end);
    expect(evaluateCaveDeposition(1, 0).deposits.every(deposit => deposit.rising === 1.5)).toBe(true);
  });

  for (const factor of [0, 1, 2]) {
    it(`carries the same material from a source into the soil for factor ${factor}`, () => {
      const start = evaluateSoilProvenance(0, factor), end = evaluateSoilProvenance(1, factor);
      expect(new Set(start.particles.map(packet => packet.id)).size).toBe(12);
      expect(end.retained).toBe(12);
      end.particles.forEach((packet, i) => {
        expect(packet.id).toBe(start.particles[i].id);
        expect(packet.u).toBeCloseTo(packet.target.u);
        expect(packet.h).toBeCloseTo(packet.target.h);
        expect(packet.stage).toBe('retained');
        if (factor === 0) expect(packet.h).toBeGreaterThan(start.particles[i].h);
        else expect(packet.h).toBeLessThan(start.particles[i].h);
      });
    });
  }

  it('removes karst cover before losing slope soil, then retains it in the depression', () => {
    const early = evaluateKarstCover(.2, 1), end = evaluateKarstCover(1, 1);
    expect(early.loss).toBeGreaterThan(0); expect(early.particles.every(p => p.progress === 0)).toBe(true);
    expect(end.cover).toBe(0); expect(end.retained).toBe(14);
    expect(end.particles.every(p => Math.abs(p.u - .5) < .08 && p.v >= .77)).toBe(true);
    expect(evaluateKarstCover(.42, 2).wet).toBeGreaterThan(evaluateKarstCover(.99, 2).wet);
    expect(evaluateKarstCover(.99, 2).dry).toBe(true);
  });

  it('shows rainfall, then runoff, then overbank water without a declining replay', () => {
    const rain = evaluateFloodSequence(.1, 1), runoff = evaluateFloodSequence(.24, 1);
    expect(rain.heavyRain).toBe(true); expect(rain.runoff).toBe(0); expect(rain.rise).toBe(0);
    expect(runoff.runoff).toBeGreaterThan(0); expect(runoff.rise).toBe(0);
    let last = 2.9;
    for (let step = 0; step <= 100; step++) {
      const state = evaluateFloodSequence(step / 100, 1);
      expect(state.waterLevel).toBeGreaterThanOrEqual(last); last = state.waterLevel;
    }
    expect(evaluateFloodSequence(1, 1).overbank).toBe(true);
    expect(evaluateFloodSequence(1, 0).overbank).toBe(false);
  });

  it('makes drought affect soil and storage before the crops respond', () => {
    const soil = evaluateDroughtSequence(.15, 1), storage = evaluateDroughtSequence(.3, 1), end = evaluateDroughtSequence(1, 1);
    expect(soil.soilDeficit).toBeGreaterThan(0); expect(soil.sourceDeficit).toBe(0); expect(soil.cropStress).toBe(0);
    expect(storage.sourceDeficit).toBeGreaterThan(0); expect(storage.cropStress).toBe(0);
    expect(end.cropStress).toBe(1); expect(end.sourceLevel).toBeCloseTo(1.9);
    expect(evaluateDroughtSequence(1, 0).cropStress).toBe(0);
  });

  it('seeks the same scientific state regardless of previous phase order', () => {
    for (const model of [evaluateCaveDeposition, evaluateSoilProvenance, evaluateKarstCover, evaluateFloodSequence, evaluateDroughtSequence]) {
      const middle = model(.537, 1); model(1, 1); model(0, 0);
      expect(model(.537, 1)).toEqual(middle);
    }
  });
});

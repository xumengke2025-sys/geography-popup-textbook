import { describe, expect, it } from 'vitest';
import { DELTA_GRAIN_COUNT, DELTA_MOUTH, deltaBedHeight, deltaBranchPoint, evaluateDeltaDeposition } from '../src/textbook-delta-model';

describe('schematic river-mouth deposition', () => {
  it('retains a fixed parcel pool and deterministic forward/backward seeking', () => {
    const a = evaluateDeltaDeposition(.57);
    evaluateDeltaDeposition(.93); evaluateDeltaDeposition(.12);
    expect(evaluateDeltaDeposition(.57)).toEqual(a);
    expect(a.grains).toHaveLength(DELTA_GRAIN_COUNT);
    expect(evaluateDeltaDeposition(1).grains).toHaveLength(DELTA_GRAIN_COUNT);
  });
  it('a parcel slows in the mouth, settles vertically, then remains at exactly the same position', () => {
    const id = 2, g = evaluateDeltaDeposition(0).grains[id];
    const early = evaluateDeltaDeposition(g.mouthAt + .05).grains[id];
    const late = evaluateDeltaDeposition(g.settlingAt - .02).grains[id];
    expect(late.pathSpeed).toBeLessThan(early.pathSpeed);
    const fallingA = evaluateDeltaDeposition(g.settlingAt + .02).grains[id];
    const fallingB = evaluateDeltaDeposition(g.depositedAt - .01).grains[id];
    expect(fallingA.stage).toBe('settling'); expect(fallingB.stage).toBe('settling');
    expect(fallingB.position[1]).toBeLessThan(fallingA.position[1]);
    expect(fallingB.position[0]).toBe(fallingA.position[0]); expect(fallingB.position[2]).toBe(fallingA.position[2]);
    expect(evaluateDeltaDeposition(g.depositedAt + .01).grains[id].position).toEqual(evaluateDeltaDeposition(1).grains[id].position);
  });
  it('coarser parcels stop sooner and nearer than finer parcels from the same release', () => {
    const state = evaluateDeltaDeposition(1);
    for (let i = 0; i < DELTA_GRAIN_COUNT; i += 3) {
      const [coarse, medium, fine] = state.grains.slice(i, i + 3);
      expect(coarse.radius).toBeGreaterThan(medium.radius); expect(medium.radius).toBeGreaterThan(fine.radius);
      expect(coarse.target[2]).toBeLessThan(medium.target[2]); expect(medium.target[2]).toBeLessThan(fine.target[2]);
      expect(coarse.depositedAt).toBeLessThan(medium.depositedAt); expect(medium.depositedAt).toBeLessThan(fine.depositedAt);
    }
  });
  it('fronts remain still before deposition and can only advance from permanent accumulation', () => {
    const empty = evaluateDeltaDeposition(.2);
    expect(empty.deposition).toBe(0); expect(empty.branches.map(b => b.front)).toEqual([.025, .025, .025]);
    let previous = empty;
    for (let i = 21; i <= 100; i++) {
      const state = evaluateDeltaDeposition(i / 100);
      expect(state.deposition).toBeGreaterThanOrEqual(previous.deposition);
      state.branches.forEach((branch, j) => expect(branch.front).toBeGreaterThanOrEqual(previous.branches[j].front));
      for (const grain of previous.grains.filter(g => g.stage === 'deposited')) expect(state.grains[grain.id].position).toEqual(grain.position);
      previous = state;
    }
    expect(previous.deposited).toBe(DELTA_GRAIN_COUNT);
  });
  it('an accumulated lobe is a real stable bed under the stopped parcels, with unequal outlines', () => {
    const state = evaluateDeltaDeposition(1);
    for (const grain of state.grains) expect(deltaBedHeight(state, grain.target[0], grain.target[2])).toBeGreaterThan(6.9);
    const tips = state.branches.map((branch, i) => deltaBranchPoint(i, branch.front));
    expect(new Set(tips.map(tip => Math.hypot(tip[0] - DELTA_MOUTH[0], tip[1] - DELTA_MOUTH[1]).toFixed(3))).size).toBe(3);
    expect(deltaBedHeight(state, .05, .9)).toBeLessThan(2);
  });
});

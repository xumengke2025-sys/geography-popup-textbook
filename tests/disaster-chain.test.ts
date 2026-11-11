import { describe, expect, it } from 'vitest';
import { DISASTER_CHAIN_CONDITIONS, DISASTER_CHAIN_LAYOUT as L,
  chainFreshHead, chainSalineInterface, chainValleyGround, chainRiverHalfWidth, disasterChainSvg, evaluateDisasterChain } from '../src/textbook-disaster-chain-model';

describe('selected conditional disaster chains', () => {
  it('states the chosen geological and water-supply conditions rather than a universal consequence', () => {
    expect(DISASTER_CHAIN_CONDITIONS.drought.join('')).toMatch(/沿海.*松软.*加抽地下水.*连通/);
    expect(DISASTER_CHAIN_CONDITIONS.earthquake.join('')).toMatch(/陡坡.*持续来水.*选定.*并非/);
    for (const selection of [0, 1]) {
      const s = evaluateDisasterChain(.8, selection);
      expect(s.conditional).toBe(true); expect(s.measuredOrPredicted).toBe(false);
      expect(s.units).toBe('schematic-phase');
    }
  });
  it('orders shortage, extraction, sediment compaction and underground intrusion', () => {
    const shortage = evaluateDisasterChain(.20, 0), pumping = evaluateDisasterChain(.40, 0);
    const compaction = evaluateDisasterChain(.64, 0), intrusion = evaluateDisasterChain(.90, 0);
    expect(shortage.drought.deficit).toBeGreaterThan(0);
    expect([shortage.drought.extraction, shortage.drought.subsidence, shortage.drought.intrusion]).toEqual([0, 0, 0]);
    expect(pumping.drought.extraction).toBeGreaterThan(0);
    expect([pumping.drought.subsidence, pumping.drought.intrusion]).toEqual([0, 0]);
    expect(compaction.drought.subsidence).toBeGreaterThan(0); expect(compaction.drought.intrusion).toBe(0);
    expect(intrusion.drought.intrusion).toBeGreaterThan(0);
    expect(intrusion.drought.salineToe).toBeLessThan(compaction.drought.salineToe);
    expect(chainFreshHead(pumping, L.wellX)).toBeLessThan(chainFreshHead(shortage, L.wellX));
  });
  it('keeps the sea surface fixed, lowers groundwater near the well and moves the saline wedge underground', () => {
    for (let i = 0; i <= 100; i++) {
      const s = evaluateDisasterChain(i / 100, 0);
      expect(s.drought.seaLevel).toBe(L.seaLevel);
      expect(chainFreshHead(s, L.coast)).toBeCloseTo(L.seaLevel, 10);
      expect(chainSalineInterface(s, s.drought.salineToe)).toBe(L.bedrock);
      for (let x = s.drought.salineToe; x <= L.coast; x++) {
        const salt = chainSalineInterface(s, x);
        expect(salt).toBeGreaterThanOrEqual(L.bedrock);
        expect(salt).toBeLessThanOrEqual(chainFreshHead(s, x));
        expect(salt).toBeLessThan(s.drought.surface);
      }
    }
  });
  it('requires slope displacement before blockage, blockage before a lake and a lake before the selected breach', () => {
    for (let i = 0; i <= 500; i++) {
      const q = evaluateDisasterChain(i / 500, 1).earthquake;
      if (q.blockage > 0) expect(q.slide).toBeGreaterThan(.75);
      if (q.accumulation > 0) expect(q.blockage).toBe(1);
      if (q.breach > 0) expect(q.accumulation).toBe(1);
      if (q.flood > 0) expect(q.breach).toBeGreaterThan(0);
    }
  });
  it('matches both water edges to the valley slopes instead of standing a blue prism on low banks', () => {
    for (let i = 0; i <= 100; i++) {
      const s = evaluateDisasterChain(i / 100, 1);
      for (const level of [s.earthquake.lakeLevel, s.earthquake.floodLevel]) {
        const half = chainRiverHalfWidth(level);
        expect(chainValleyGround(L.riverZ - half)).toBeCloseTo(level, 10);
        expect(chainValleyGround(L.riverZ + half)).toBeCloseTo(level, 10);
        expect(L.riverZ + half).toBeLessThan(52);
        expect(L.riverZ - half).toBeGreaterThan(21);
      }
    }
  });
  it('retains the final consequences without endless shaking or resetting the event', () => {
    const d = evaluateDisasterChain(1, 0), q = evaluateDisasterChain(1, 1);
    expect(d.drought.surface).toBeLessThan(L.originalSurface); expect(d.drought.intrusion).toBe(1);
    expect(d.drought.extraction).toBe(1); expect(d.drought.pumpingActive).toBe(false);
    expect(q.earthquake.shake).toBe(0); expect(q.earthquake.breach).toBe(1); expect(q.earthquake.flood).toBe(1);
    expect(q.earthquake.lake).toBeGreaterThan(0); expect(q.earthquake.lake).toBeLessThan(evaluateDisasterChain(.78, 1).earthquake.lake);
    expect(q.earthquake.floodFront).toBe(97); expect(q.earthquake.resultHeld).toBe(true);
  });
  it('seeks backwards exactly and resets all inactive-branch processes on a switch', () => {
    for (const selection of [0, 1]) {
      const s = evaluateDisasterChain(.57, selection);
      evaluateDisasterChain(1, 1 - selection); evaluateDisasterChain(0, selection);
      expect(evaluateDisasterChain(.57, selection)).toEqual(s);
      expect(evaluateDisasterChain(-2, selection)).toEqual(evaluateDisasterChain(0, selection));
      expect(evaluateDisasterChain(NaN, selection)).toEqual(evaluateDisasterChain(0, selection));
      expect(evaluateDisasterChain(2, selection)).toEqual(evaluateDisasterChain(1, selection));
    }
    expect(evaluateDisasterChain(1, 0).earthquake.slide).toBe(0);
    expect(evaluateDisasterChain(1, 1).drought.intrusion).toBe(0);
    expect(evaluateDisasterChain(1, 1).drought.subsidence).toBe(0);
  });
  it('has finite, continuous geometry inputs and monotonic consequences', () => {
    for (const selection of [0, 1]) {
      let previous = evaluateDisasterChain(0, selection);
      for (let i = 1; i <= 1000; i++) {
        const s = evaluateDisasterChain(i / 1000, selection);
        for (const values of [s.drought, s.earthquake]) for (const value of Object.values(values))
          if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
        for (const key of ['deficit', 'extraction', 'subsidence', 'intrusion'] as const)
          expect(s.drought[key]).toBeGreaterThanOrEqual(previous.drought[key]);
        for (const key of ['slide', 'blockage', 'accumulation', 'breach', 'flood'] as const)
          expect(s.earthquake[key]).toBeGreaterThanOrEqual(previous.earthquake[key]);
        previous = s;
      }
    }
  });
  it('uses the same state in native SVG, with keyboard-ready replay attached to causal entities', () => {
    for (const choice of [0, 1]) for (const phase of [0, .2, .4, .6, .8, 1]) {
      const s = evaluateDisasterChain(phase, choice), svg = disasterChainSvg(phase, choice);
      expect(svg).toContain(`data-chain-stage="${s.stage}"`); expect(svg).toContain(`data-chain-branch="${s.branch}"`);
      expect(svg).toContain(`data-chain-intrusion="${s.drought.intrusion}"`);
      expect(svg).toContain(`data-chain-breach="${s.earthquake.breach}"`);
      expect(svg).not.toContain('<image'); expect(svg).not.toMatch(/\d+\s*秒|概率|真实预测/);
      expect(svg).toMatch(/data-model-replay="true"[^>]*role="button"[^>]*tabindex="0"[^>]*aria-label=/);
      expect(svg.match(new RegExp(`>${s.caption}<`, 'g'))).toHaveLength(1);
      expect(svg).not.toContain(`data-model-selection="${1 - choice}"`);
    }
  });
});

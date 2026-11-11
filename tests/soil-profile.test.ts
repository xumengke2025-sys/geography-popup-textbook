import { describe, expect, it } from 'vitest';
import { evaluateSoilProfile, normalizeSoilProfileSelection, soilProfileBoundary, soilProfileOffsetAtDepth,
  soilProfileSvg, SOIL_PROFILE_LAYERS, SOIL_PROFILE_MATERIAL_POOL } from '../src/textbook-soil-profile-model';

describe('textbook p.89 forest-soil leaching and illuviation', () => {
  it('preserves the textbook order and adjoining boundaries of the six-layer column', () => {
    expect(SOIL_PROFILE_LAYERS.map(p => p.name)).toEqual(['有机层', '腐殖质层', '淋溶层', '淀积层', '母质层', '母岩层']);
    for (let i = 0; i < 6; i++) for (const u of [0, .25, .5, .75, 1]) for (const v of [0, .5, 1]) {
      expect(soilProfileBoundary(i + 1, u, v)).toBeGreaterThan(soilProfileBoundary(i, u, v));
      if (i > 0) expect(SOIL_PROFILE_LAYERS[i].top).toBe(SOIL_PROFILE_LAYERS[i - 1].bottom);
    }
  });
  it('transfers the same finite movable portion without creating or losing markers', () => {
    const ids = SOIL_PROFILE_MATERIAL_POOL.map(p => p.id);
    for (let step = 0; step <= 100; step++) {
      const s = evaluateSoilProfile(step / 100), { source, moving, deposited, total } = s.inventory;
      expect(s.materials.map(p => p.id)).toEqual(ids);
      expect(new Set(s.materials.map(p => p.id)).size).toBe(24);
      expect(source + moving + deposited).toBe(total);
      expect(total).toBe(24);
      expect(s.materials.every(p => Number.isFinite(p.u + p.depth + p.travel + p.offsetX))).toBe(true);
    }
  });
  it('lets water arrive before any material leaves the leaching layer', () => {
    for (const p of SOIL_PROFILE_MATERIAL_POOL) {
      const wet = evaluateSoilProfile(p.release - .0001);
      expect(wet.water.active).toBe(true);
      expect(wet.water.front).toBeGreaterThan(p.sourceDepth);
      expect(wet.water.front).toBeGreaterThan(p.targetDepth);
      expect(wet.materials[p.id].status).toBe('source');
    }
    expect(evaluateSoilProfile(.30).inventory).toEqual({ source: 24, moving: 0, deposited: 0, total: 24 });
  });
  it('moves downwards only, from the leaching layer into the illuviation layer', () => {
    let previous = evaluateSoilProfile(0);
    for (let step = 1; step <= 100; step++) {
      const s = evaluateSoilProfile(step / 100);
      for (const p of s.materials) {
        expect(p.depth).toBeGreaterThanOrEqual(previous.materials[p.id].depth);
        expect(p.depth).toBeGreaterThan(.24);
        expect(p.depth).toBeLessThan(.70);
        expect(p.u).toBeGreaterThan(0); expect(p.u).toBeLessThan(1);
      }
      expect(s.water.tracers.every(p => p.depth >= p.tailDepth && p.depth <= s.water.front)).toBe(true);
      expect(s.inventory.source).toBeLessThanOrEqual(previous.inventory.source);
      expect(s.inventory.deposited).toBeGreaterThanOrEqual(previous.inventory.deposited);
      previous = s;
    }
    expect(evaluateSoilProfile(0).materials.every(p => p.depth > .24 && p.depth < .45)).toBe(true);
    expect(previous.materials.every(p => p.depth > .45 && p.depth < .70)).toBe(true);
  });
  it('keeps the deposited material after the rain and infiltration have ended', () => {
    const end = evaluateSoilProfile(1);
    expect(end.stage).toBe('retained'); expect(end.water.active).toBe(false); expect(end.water.rain).toBe(false);
    expect(end.inventory).toEqual({ source: 0, moving: 0, deposited: 24, total: 24 });
    expect(end.materials.every(p => p.status === 'deposited' && p.depth === p.targetDepth)).toBe(true);
    expect(evaluateSoilProfile(1.4)).toEqual(end);
  });
  it('is deterministic under reverse scrubbing and continuous at release and arrival', () => {
    const middle = evaluateSoilProfile(.63, 2); evaluateSoilProfile(1, 3); evaluateSoilProfile(0);
    expect(evaluateSoilProfile(.63, 2)).toEqual(middle);
    for (const phase of [.34, .36, .45, .60, .76, .90, .98]) {
      const a = evaluateSoilProfile(phase - .00001, 2), z = evaluateSoilProfile(phase + .00001, 2);
      expect(Math.max(...a.materials.map((p, i) => Math.abs(p.depth - z.materials[i].depth)))).toBeLessThan(.0001);
      expect(Math.max(...a.materials.map((p, i) => Math.abs(p.offsetX - z.materials[i].offsetX)))).toBeLessThan(.0001);
    }
  });
  it('pulls out one layer without changing scientific progress or the conserved portion', () => {
    const science = (n: number) => evaluateSoilProfile(.60, n).materials.map(({ offsetX, ...p }) => p);
    for (const selection of [-1, 0, 1, 2, 3, 4, 5]) expect(science(selection)).toEqual(science(-1));
    expect(evaluateSoilProfile(0, 2).materials.every(p => p.offsetX === .26)).toBe(true);
    expect(evaluateSoilProfile(1, 3).materials.every(p => p.offsetX === .26)).toBe(true);
    expect(evaluateSoilProfile(1, 2).materials.every(p => p.offsetX === 0)).toBe(true);
    for (const depth of [.24, .45, .70]) expect(Math.abs(soilProfileOffsetAtDepth(depth - .000001, 2) - soilProfileOffsetAtDepth(depth + .000001, 2))).toBeLessThan(.0001);
  });
  it('handles invalid inputs and preserves the whole-column sentinel', () => {
    expect(normalizeSoilProfileSelection(-1)).toBe(-1);
    for (const selection of [NaN, Infinity, -4, 5.9, 6, 80]) expect(normalizeSoilProfileSelection(selection)).toBe(-1);
    for (const phase of [NaN, Infinity, -Infinity, -10]) expect(evaluateSoilProfile(phase)).toEqual(evaluateSoilProfile(0));
  });
  it('uses identical material coordinates in vector fallback and exposes accessible layer actions', () => {
    for (const selection of [-1, 0, 2, 3, 5]) {
      const source = soilProfileSvg(.62, selection), state = evaluateSoilProfile(.62, selection);
      expect(source).not.toContain('<image'); expect(source).toContain('role="group"');
      expect(source).toContain('不代表全部土壤矿物质'); expect(source).toContain('不表示真实成土年限');
      expect(source.match(/data-soil-profile-part="layer"/g)).toHaveLength(6);
      expect(source.match(/data-soil-profile-material=/g)).toHaveLength(24);
      for (let layer = 0; layer < 6; layer++) expect(source).toContain(`data-model-selection="${layer}" data-model-toggle="-1" role="button" tabindex="0"`);
      for (const p of state.materials) expect(source).toContain(`data-soil-profile-material="${p.id}" data-u="${Number(p.u.toFixed(6))}" data-depth="${Number(p.depth.toFixed(6))}" data-offset="${Number(p.offsetX.toFixed(6))}"`);
    }
  });
});

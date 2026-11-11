import { describe, expect, it } from 'vitest';
import { AIR_COMPOSITION_REFERENCE, AIR_VAPOR_FRAME, airCompositionExtraSvg, evaluateAirComposition } from '../src/textbook-air-composition-model';
import { flatSkyExtra } from '../src/textbook-flat-sky-extra';
import type { Figure } from '../src/textbook-catalog';

describe('textbook pp.28–29: invisible vapour and separate impurities', () => {
  it('does not equate gas with a visible cloud or a liquid drop', () => {
    expect(AIR_COMPOSITION_REFERENCE.waterVaporVisible).toBe(false);
    expect(AIR_COMPOSITION_REFERENCE.cloudRepresented).toBe(false);
    expect(AIR_COMPOSITION_REFERENCE.vaporSymbol).toBe('open-diamond-tracer');
    expect(AIR_COMPOSITION_REFERENCE.impuritySymbol).toBe('solid-grain');
    expect(AIR_COMPOSITION_REFERENCE.markerCountsAreQuantities).toBe(false);
    expect(AIR_COMPOSITION_REFERENCE.dryAirProportionsExcludeWaterAndDust).toBe(true);
    expect(AIR_VAPOR_FRAME.innerRatio).toBeGreaterThan(0);
    expect(AIR_VAPOR_FRAME.innerRatio).toBeLessThan(1);
  });
  it('keeps the extra marks out of the fixed dry-air sample', () => {
    const dry = evaluateAirComposition(.5, 0), extra = evaluateAirComposition(.5, 1);
    expect(dry.vapor).toHaveLength(0); expect(dry.impurities).toHaveLength(0);
    expect(extra.vapor).toHaveLength(5); expect(extra.impurities).toHaveLength(9);
    expect(airCompositionExtraSvg(.5, 0)).toBe('');
  });
  it('keeps the same symbolic inventory and returns to the same position each cycle', () => {
    const first = evaluateAirComposition(0, 1), end = evaluateAirComposition(1, 1);
    expect(end).toEqual(first);
    for (const t of [0, .17, .38, .72, 1]) {
      const s = evaluateAirComposition(t, 1);
      expect(s.vapor.map(m => m.id)).toEqual(first.vapor.map(m => m.id));
      expect(s.impurities.map(m => m.id)).toEqual(first.impurities.map(m => m.id));
      for (const m of [...s.vapor, ...s.impurities]) expect([m.x, m.y].every(Number.isFinite)).toBe(true);
    }
    const middle = evaluateAirComposition(.38, 1); evaluateAirComposition(.8, 1);
    expect(evaluateAirComposition(.38, 1)).toEqual(middle);
  });
  it('gives SVG the same hollow tracer and solid-grain inventory', () => {
    for (const t of [0, .43, 1]) {
      const state = evaluateAirComposition(t, 1), svg = airCompositionExtraSvg(t, 1);
      expect(svg.match(/data-composition-symbol="water-vapor-tracer"/g)).toHaveLength(state.vapor.length);
      expect(svg.match(/data-composition-symbol="impurity-grain"/g)).toHaveLength(state.impurities.length);
      for (const mark of [...state.vapor, ...state.impurities]) expect(svg).toContain(`data-symbol-id="${mark.id}"`);
      expect(svg).toContain('fill-rule="evenodd"'); expect(svg).toContain('水汽不可见');
      expect(svg).toContain('不是云滴');
    }
  });
  it('preserves the original 78/21/1 dry-air cells in both conditions', () => {
    const figure = { effect: 'air-composition', title: '大气的组成' } as Figure;
    for (const selected of [0, 1]) {
      const svg = flatSkyExtra(figure, .3, selected)!;
      const cells = [...svg.matchAll(/<rect x="[^"]+" y="[^"]+" width="18" height="18" fill="([^"]+)"/g)];
      expect(cells).toHaveLength(100);
      expect(cells.filter(c => c[1] === '#a7c6ce')).toHaveLength(78);
      expect(cells.filter(c => c[1] === '#c18358')).toHaveLength(21);
      expect(cells.filter(c => c[1] === '#bb985c')).toHaveLength(1);
    }
  });
});

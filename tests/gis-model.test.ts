import { describe, expect, it } from 'vitest';
import { GIS_COUNTS, GIS_MEMBERSHIP, GIS_PHASES, GIS_REGIONS, GIS_STATIONS, evaluateGis, gisRegionAt, gisSvg, pointInGisPolygon } from '../src/textbook-gis-model';

describe('textbook GIS source positions and analysis', () => {
  it('has exactly the 33 source symbols, assigned once to the irregular regions', () => {
    expect(GIS_STATIONS).toHaveLength(33);
    expect(new Set(GIS_STATIONS.map(s => s.point.join(','))).size).toBe(33);
    for (const station of GIS_MEMBERSHIP) {
      expect(GIS_REGIONS.filter(r => pointInGisPolygon(station.point, r.polygon))).toHaveLength(1);
      expect(station.region).not.toBeNull();
    }
    expect(GIS_COUNTS).toEqual([{ id: 1, count: 5 }, { id: 2, count: 15 }, { id: 3, count: 13 }]);
  });
  it('partitions the whole sheet without gaps or overlapping interiors', () => {
    const area = (p: readonly (readonly [number, number])[]) => Math.abs(p.reduce((a, q, i) => {
      const n = p[(i + 1) % p.length]; return a + q[0] * n[1] - q[1] * n[0];
    }, 0)) / 2;
    expect(GIS_REGIONS.reduce((a, r) => a + area(r.polygon), 0)).toBeCloseTo(1, 9);
    for (let y = .013; y < 1; y += .031) for (let x = .017; x < 1; x += .029) {
      expect(GIS_REGIONS.filter(r => pointInGisPolygon([x, y], r.polygon))).toHaveLength(1);
    }
    expect(gisRegionAt([-1, -1])).toBeNull();
    expect(gisRegionAt([0, 0])).toBe(1);
  });
});

describe('one seekable GIS timeline', () => {
  it('aligns first, then assigns and counts, and holds the result', () => {
    expect(evaluateGis(0).counts.map(c => c.count)).toEqual([0, 0, 0]);
    expect(evaluateGis(.52).overlay).toBe(1);
    expect(evaluateGis(.52).stations.some(s => s.counted)).toBe(false);
    expect(evaluateGis(GIS_PHASES.result).counts.map(c => c.count)).toEqual([5, 15, 13]);
    expect(evaluateGis(1).counts.map(c => c.count)).toEqual([5, 15, 13]);
    expect(evaluateGis(.9).resultReady).toBe(true);
  });
  it('does not lose or duplicate any station, and counts monotonically', () => {
    let last = [0, 0, 0];
    for (let k = 0; k <= 500; k++) {
      const state = evaluateGis(k / 500);
      expect(state.stations).toHaveLength(33);
      state.counts.forEach((c, i) => { expect(c.count).toBeGreaterThanOrEqual(last[i]); });
      expect(state.counts.reduce((n, c) => n + c.count, 0)).toBe(state.stations.filter(s => s.counted).length);
      last = state.counts.map(c => c.count);
    }
  });
  it('is deterministic when seeking backward, clamps boundaries, and ignores legacy selection', () => {
    const before = evaluateGis(.735);
    evaluateGis(1); evaluateGis(0);
    expect(evaluateGis(.735)).toEqual(before);
    expect(evaluateGis(-3)).toEqual(evaluateGis(0));
    expect(evaluateGis(4)).toEqual(evaluateGis(1));
    expect(evaluateGis(NaN)).toEqual(evaluateGis(0));
    expect(gisSvg(.735, 0)).toBe(gisSvg(.735, 1));
  });
  it('draws the same 33 stations and derived final counts in the SVG fallback', () => {
    const svg = gisSvg(1, 0);
    expect((svg.match(/data-station="station-/g) ?? [])).toHaveLength(33);
    expect(svg).toContain('data-gis-stage="result"');
    expect(svg).toContain('>1区 5</text>');
    expect(svg).toContain('>2区 15</text>');
    expect(svg).toContain('>3区 13</text>');
    expect(svg).not.toContain('<image');
  });
  it('inspects a region without changing ownership, counts or the observation phase', () => {
    const svg = gisSvg(.735, 0, 'region-1');
    expect(svg).toContain('data-model-inspect="region-1"');
    expect(svg).toContain('stroke-width="4"');
    expect((svg.match(/data-station="station-/g) ?? [])).toHaveLength(33);
    expect(svg.match(/data-counted="true"/g)).toHaveLength(evaluateGis(.735).stations.filter(s => s.counted).length);
    expect(gisSvg(.735, 0, 'invalid')).toBe(gisSvg(.735));
  });
});

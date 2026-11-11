import { describe, expect, it } from 'vitest';
import { buildCrownSurface, buildFernSurface, buildLeafBladeSurface, buildReliefCutSurface, buildTreeSkeletonSurface, riverValleySurfaceHeight, type CrownHabit, type NaturalSurface } from '../src/textbook-natural-form-geometry';

function inspectClosed(surface: NaturalSurface) {
  const { positions, indices } = surface, vertices = positions.length / 3, edges = new Map<string, { count: number; direction: number }>();
  expect(positions.every(Number.isFinite)).toBe(true); expect(indices.every(i => Number.isInteger(i) && i >= 0 && i < vertices)).toBe(true);
  let volume = 0, minArea = Infinity;
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = indices.slice(i, i + 3), [a, b, c] = triangle.map(index => positions.slice(index * 3, index * 3 + 3));
    const ab = b.map((v, j) => v - a[j]), ac = c.map((v, j) => v - a[j]);
    const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    minArea = Math.min(minArea, Math.hypot(...cross) / 2);
    volume += (a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    for (let j = 0; j < 3; j++) {
      const start = triangle[j], end = triangle[(j + 1) % 3], key = `${Math.min(start, end)}:${Math.max(start, end)}`, entry = edges.get(key) ?? { count: 0, direction: 0 };
      entry.count++; entry.direction += start < end ? 1 : -1; edges.set(key, entry);
    }
  }
  // A zero-area face, an unmatched cut edge, or an inward shell can be almost
  // invisible in a screenshot but produces fragile normals and open volumes.
  expect(minArea).toBeGreaterThan(1e-10);
  expect([...edges.values()].every(edge => edge.count === 2 && edge.direction === 0)).toBe(true);
  expect(volume).toBeGreaterThan(1e-8);
  return { volume, minArea };
}

const extent = (surface: NaturalSurface, axis: number) => {
  const values = surface.positions.filter((_, i) => i % 3 === axis); return Math.max(...values) - Math.min(...values);
};

describe('natural paper forms have solid, differentiated silhouettes', () => {
  const habits: CrownHabit[] = ['rainforest', 'evergreen', 'deciduous', 'conifer', 'savanna', 'shrub'];
  it('keeps every canopy closed and nondegenerate across seeds and habits', () => {
    for (const habit of habits) for (const seed of [0, 1, 4, 8, 17]) inspectClosed(buildCrownSurface(habit, seed));
  });
  it('distinguishes flat savanna, tiered conifer and broadleaf profiles without changing their state', () => {
    const flat = buildCrownSurface('savanna', 4), needle = buildCrownSurface('conifer', 4), broad = buildCrownSurface('rainforest', 4);
    expect(extent(flat, 0) / extent(flat, 1)).toBeGreaterThan(3.5);
    expect(extent(needle, 1) / extent(needle, 0)).toBeGreaterThan(extent(broad, 1) / extent(broad, 0));
    expect(buildCrownSurface('rainforest', 4)).toEqual(broad);
    expect(buildCrownSurface('rainforest', 5).positions).not.toEqual(broad.positions);
  });
  it('caps all tapered stem and twig ends, including the thinnest members', () => {
    for (const seed of [0, 1, 4, 8]) for (const featured of [false, true]) {
      const skeleton = buildTreeSkeletonSurface(seed, featured); inspectClosed(skeleton);
      expect(extent(skeleton, 1)).toBeLessThan(1); expect(extent(skeleton, 0)).toBeGreaterThan(.3);
    }
  });
  it('gives blades and low fronds thickness rather than zero-width triangles', () => {
    const blade = buildLeafBladeSurface(); inspectClosed(blade); expect(extent(blade, 1)).toBeGreaterThan(.1);
    for (const seed of [0, 1, 8]) { const fern = buildFernSurface(seed); inspectClosed(fern); expect(extent(fern, 1)).toBeLessThan(extent(fern, 0)); }
  });
});

describe('relief cuts retain their measured surface and a closed bottom', () => {
  it('has no collapsed corner, missing base edge or reversed face even on coarse grids', () => {
    const height = (x: number, z: number) => 2.5 + .6 * Math.cos(x / 5) + .4 * Math.sin(z / 4);
    for (const nx of [2, 7, 24]) for (const nz of [2, 11]) for (const roundness of [0, .38, .65]) {
      const surface = buildReliefCutSurface(-7, 9, -4, 6, height, nx, nz, 0, roundness); inspectClosed(surface);
      expect(new Set(surface.boundary).size).toBe(surface.boundary.length);
      for (const sample of surface.samples) expect(surface.positions[sample.index * 3 + 1]).toBe(height(sample.x, sample.z));
      surface.bottomRing.forEach((index, i) => {
        const top = surface.boundary[i]; expect(surface.positions[index * 3]).toBe(surface.positions[top * 3]);
        expect(surface.positions[index * 3 + 1]).toBe(0); expect(surface.positions[index * 3 + 2]).toBe(surface.positions[top * 3 + 2]);
      });
    }
  });
  it('rejects empty grids, reversed bounds and a terrain surface touching its cut base', () => {
    expect(() => buildReliefCutSurface(0, 1, 0, 1, () => 1, 1, 3)).toThrow();
    expect(() => buildReliefCutSurface(1, 0, 0, 1, () => 1)).toThrow();
    expect(() => buildReliefCutSurface(0, 1, 0, 1, () => 0)).toThrow();
    expect(() => buildReliefCutSurface(0, 1, 0, 1, () => NaN)).toThrow();
  });
  it('keeps the river bed fixed, the two environments distinct and every flank above the bed', () => {
    for (let j = 0; j <= 100; j++) {
      const v = j / 100, center = .5 + .035 * Math.sin(v * 4), bed = 3.4 - 1.3 * v;
      expect(riverValleySurfaceHeight(center, v, false)).toBeCloseTo(bed, 12);
      expect(riverValleySurfaceHeight(center, v, true)).toBeCloseTo(bed, 12);
      expect(riverValleySurfaceHeight(center + .3, v, false)).toBeGreaterThan(riverValleySurfaceHeight(center + .3, v, true) + 10);
      for (let i = 0; i <= 50; i++) for (const plain of [false, true]) expect(riverValleySurfaceHeight(i / 50, v, plain)).toBeGreaterThanOrEqual(bed - 1e-12);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { EARTH_RADII, evaluateEarthLayers, evaluateSolarSystem, earthLayersSvg, solarSystemSvg } from '../src/textbook-astronomy-model';

describe('one astronomy state for solid and vector observations', () => {
  it('closes all eight schematic orbits at the exact playback endpoint', () => {
    const start = evaluateSolarSystem(0), end = evaluateSolarSystem(1);
    expect(start.bodies).toHaveLength(8);
    end.bodies.forEach((body, i) => body.point.forEach((v, axis) => expect(v).toBeCloseTo(start.bodies[i].point[axis], 11)));
    expect(start.bodies.map(b => b.name)).toEqual(['水星', '金星', '地球', '火星', '木星', '土星', '天王星', '海王星']);
    expect(start.source.periodsToScale).toBe(false);
  });
  it('gives the same orbital positions when scrubbing backwards, independent of rendering frames', () => {
    const first = evaluateSolarSystem(.371);
    evaluateSolarSystem(.9); evaluateSolarSystem(.001);
    expect(evaluateSolarSystem(.371)).toEqual(first);
    first.bodies.forEach(body => expect(Math.hypot(body.point[0], body.point[2] / .58)).toBeCloseTo(body.radius, 11));
  });
  it('extracts the selected intact shell without changing its radius or reversing its layers', () => {
    for (const selection of [0, 1, 2, 3]) {
      const state = evaluateEarthLayers(selection);
      expect(state.layers.map(l => l.outer)).toEqual([...EARTH_RADII]);
      state.layers.forEach((l, i) => {
        expect(l.inner).toBe(state.layers[i + 1]?.outer ?? 0);
        expect(l.visible).toBe(selection === 0 || i >= selection - 1);
        if (l.peeled) expect(l.offset[0] - l.outer).toBeGreaterThan(l.inner);
        else expect(l.offset).toEqual([0, 0, 0]);
      });
      expect(state.source.radiiToScale).toBe(false);
      expect(state.source.depictsSeismicVelocity).toBe(false);
    }
  });
  it('uses native vectors and maintains keyboard selection of every visible earth layer', () => {
    expect(solarSystemSvg(.43)).not.toContain('<image');
    for (let selected = 1; selected <= 8; selected++) {
      const svg = solarSystemSvg(.43, selected);
      expect(svg).toContain(`data-model-selection="${selected}"`);
      expect(svg).toContain(`"selected":${selected}`);
      expect([...svg.matchAll(/role="button" tabindex="0"/g)]).toHaveLength(9);
    }
    for (const selection of [0, 1, 2, 3]) {
      const svg = earthLayersSvg(selection);
      expect(svg).not.toContain('<image');
      const count = [...svg.matchAll(/role="button" tabindex="0"/g)].length;
      expect(count).toBeGreaterThanOrEqual(evaluateEarthLayers(selection).layers.filter(l => l.visible).length);
      expect(svg).toContain(`data-earth-layers-state='${JSON.stringify({ selection, focus: evaluateEarthLayers(selection).focus, layers: evaluateEarthLayers(selection).layers })}'`);
    }
  });
});

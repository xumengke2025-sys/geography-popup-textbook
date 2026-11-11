import { describe, expect, it } from 'vitest';
import {
  approximateTemperatureAtDepth, evaluateTemperatureProfile, temperatureDepthY, temperatureAxisX,
  temperatureProfilePoint, temperatureWaterMesh, temperatureProfileSvg,
  TEMPERATURE_GRAPH_READINGS, TEMPERATURE_LAYOUT, TEMPERATURE_PROFILE_CURVE, TEMPERATURE_REFERENCE, TEMPERATURE_STOPS,
} from '../src/textbook-temperature-model';

describe('fig.3.8 fixed temperature profile and continuous observation depth', () => {
  it('identifies a printed graph approximation at one station rather than a new global observation dataset', () => {
    expect(TEMPERATURE_REFERENCE.printedPage).toBe(50);
    expect(TEMPERATURE_REFERENCE.pdfPage).toBe(55);
    expect(TEMPERATURE_REFERENCE.figure).toBe('3.8');
    expect(TEMPERATURE_REFERENCE.location).toContain('西经170°');
    expect(TEMPERATURE_REFERENCE.approximateReadGraph).toBe(true);
    expect(TEMPERATURE_REFERENCE.preciseMeasuredDataset).toBe(false);
    expect(TEMPERATURE_REFERENCE.newObservations).toBe(false);
    expect(TEMPERATURE_REFERENCE.appliesToAllOceans).toBe(false);
    expect(TEMPERATURE_REFERENCE.thermoclineBoundaryClaimed).toBe(false);
  });

  it('retains the original axis extent while stopping at the printed curve endpoint', () => {
    expect(TEMPERATURE_REFERENCE.temperatureAxisC).toEqual([0, 10, 20, 30]);
    expect(TEMPERATURE_REFERENCE.depthAxisKm).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(TEMPERATURE_REFERENCE.curveMaxDepthKm).toBe(5);
    const end = evaluateTemperatureProfile(1);
    expect(end.depthKm).toBe(5); expect(end.extrapolatesBelowCurve).toBe(false);
    expect(approximateTemperatureAtDepth(6)).toBe(approximateTemperatureAtDepth(5));
    expect(temperatureDepthY(6)).toBeLessThan(TEMPERATURE_LAYOUT.water.bottom);
    expect(TEMPERATURE_PROFILE_CURVE.at(-1)![1]).toBe(TEMPERATURE_LAYOUT.water.bottom);
  });

  it('interpolates graph anchors without inventing a warm reversal or spline overshoot', () => {
    let previous = Infinity;
    for (let step = 0; step <= 1000; step++) {
      const value = approximateTemperatureAtDepth(step / 200);
      expect(value).toBeLessThanOrEqual(previous + 1e-10); previous = value;
      expect(value).toBeGreaterThanOrEqual(TEMPERATURE_GRAPH_READINGS.at(-1)![1] - 1e-10);
      expect(value).toBeLessThanOrEqual(TEMPERATURE_GRAPH_READINGS[0][1] + 1e-10);
    }
    for (const [depth, value] of TEMPERATURE_GRAPH_READINGS) expect(approximateTemperatureAtDepth(depth)).toBeCloseTo(value, 10);
    for (let index = 1; index < TEMPERATURE_GRAPH_READINGS.length; index++) {
      const [start, high] = TEMPERATURE_GRAPH_READINGS[index - 1], [end, low] = TEMPERATURE_GRAPH_READINGS[index];
      for (let step = 0; step <= 20; step++) {
        const value = approximateTemperatureAtDepth(start + (end - start) * step / 20);
        expect(value).toBeLessThanOrEqual(high + 1e-10); expect(value).toBeGreaterThanOrEqual(low - 1e-10);
      }
    }
  });

  it('preserves the textbook comparison of larger change in the upper kilometre and smaller deep change', () => {
    const upperPerKm = approximateTemperatureAtDepth(0) - approximateTemperatureAtDepth(1);
    const deepPerKm = (approximateTemperatureAtDepth(1) - approximateTemperatureAtDepth(5)) / 4;
    expect(upperPerKm).toBeGreaterThan(10 * deepPerKm);
    expect(evaluateTemperatureProfile(0).note).toBe('表层水温较高');
    expect(evaluateTemperatureProfile(.2).note).toBe('千米内变化较大');
    expect(evaluateTemperatureProfile(1).note).toBe('深层变化较小');
  });

  it('uses progress as depth with three useful stops and no elapsed-time interpretation', () => {
    expect(TEMPERATURE_STOPS.map(stop => evaluateTemperatureProfile(stop.phase).stageIndex)).toEqual([0, 1, 2]);
    expect(TEMPERATURE_STOPS.map(stop => evaluateTemperatureProfile(stop.phase).depthKm)).toEqual([0, 1, 5]);
    for (let step = 0; step <= 100; step++) {
      const state = evaluateTemperatureProfile(step / 100);
      expect(state.depthKm).toBeCloseTo(step / 20, 12);
      expect(state.phaseMeaning).toBe('observation-depth'); expect(state.phaseIsTime).toBe(false);
      expect(state.curveIsFixed).toBe(true);
      expect(state.newObservations).toBe(false); expect(state.preciseMeasuredDataset).toBe(false);
    }
  });

  it('links the profile point, horizontal slice and physical depth probe to exactly the same depth', () => {
    for (let step = 0; step <= 200; step++) {
      const state = evaluateTemperatureProfile(step / 200);
      expect(state.point).toEqual(temperatureProfilePoint(state.phase));
      expect(state.point[0]).toBeCloseTo(temperatureAxisX(state.approxTemperatureC), 12);
      expect(state.point[1]).toBe(temperatureDepthY(state.depthKm));
      expect(state.probe[1]).toBe(state.point[1]); expect(state.sliceY).toBe(state.point[1]);
      expect(state.probe[0]).toBe(TEMPERATURE_LAYOUT.probeX);
      expect(state.point.every(Number.isFinite)).toBe(true);
      expect(state.handle[0]).toBeCloseTo(TEMPERATURE_LAYOUT.track.start[0] + 80 * state.phase, 12);
    }
    expect(evaluateTemperatureProfile(1).temperatureReading).toBe('接近0°C');
  });

  it('keeps the graph and water geometry fixed under reverse seeks and arbitrary evaluation order', () => {
    const graph = TEMPERATURE_PROFILE_CURVE.map(point => [...point]), mesh = temperatureWaterMesh();
    for (const phase of [1, .7, .2, 0, .5, .03, 1]) {
      const expected = evaluateTemperatureProfile(phase);
      evaluateTemperatureProfile(0); evaluateTemperatureProfile(1); evaluateTemperatureProfile(.333);
      expect(evaluateTemperatureProfile(phase)).toEqual(expected);
      expect(TEMPERATURE_PROFILE_CURVE).toEqual(graph);
      expect(temperatureWaterMesh()).toEqual(mesh);
    }
  });

  it('is continuous at graph anchors and observation-stage boundaries', () => {
    for (const depth of [...TEMPERATURE_GRAPH_READINGS.slice(1, -1).map(point => point[0]), .3, 1.2]) {
      const before = evaluateTemperatureProfile((depth - 1e-7) / 5), after = evaluateTemperatureProfile((depth + 1e-7) / 5);
      expect(Math.hypot(...before.point.map((value, index) => value - after.point[index]))).toBeLessThan(1e-4);
    }
  });

  it('clips invalid and excessive inputs instead of extrapolating a station profile', () => {
    for (const phase of [NaN, Infinity, -Infinity, -2]) expect(evaluateTemperatureProfile(phase)).toEqual(evaluateTemperatureProfile(0));
    expect(evaluateTemperatureProfile(2)).toEqual(evaluateTemperatureProfile(1));
    for (const depth of [NaN, Infinity, -Infinity, -10]) expect(approximateTemperatureAtDepth(depth)).toBe(27);
    expect(approximateTemperatureAtDepth(100)).toBe(approximateTemperatureAtDepth(5));
  });

  it('makes a closed solid water volume with finite fixed per-vertex reading colors', () => {
    const mesh = temperatureWaterMesh();
    expect(mesh.positions.every(Number.isFinite)).toBe(true); expect(mesh.indices.length % 3).toBe(0);
    expect(mesh.colors).toHaveLength(mesh.positions.length);
    expect(mesh.colors!.every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
    const edges = new Map<string, number>();
    for (let i = 0; i < mesh.indices.length; i += 3) for (let side = 0; side < 3; side++) {
      const edge = [mesh.indices[i + side], mesh.indices[i + (side + 1) % 3]].sort((a, b) => a - b).join('|');
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
    expect([...edges.values()].every(count => count === 2)).toBe(true);
    expect(Math.min(...mesh.positions.filter((_, i) => i % 3 === 1))).toBe(4);
    expect(Math.max(...mesh.positions.filter((_, i) => i % 3 === 1))).toBe(64);
  });

  it('publishes the identical read-point and depth state in interactive native SVG', () => {
    let originalCurve = '';
    for (const phase of [0, .12, .2, .5, 1]) {
      const state = evaluateTemperatureProfile(phase), svg = temperatureProfileSvg(phase);
      const match = svg.match(/data-temperature-state='([^']+)'/); expect(match).not.toBeNull();
      const decoded = JSON.parse(match![1].replace(/&#39;/g, "'").replace(/&amp;/g, '&'));
      expect(decoded).toEqual(state);
      const curve = svg.match(/data-temperature-profile="fixed" points="([^"]+)"/)![1];
      if (!originalCurve) originalCurve = curve; expect(curve).toBe(originalCurve);
      expect((svg.match(/data-model-selection=/g) ?? []).length).toBe(6);
      expect((svg.match(/role="button" tabindex="0"/g) ?? []).length).toBe(7);
      expect(svg.includes('data-model-inspection="surface-compare"')).toBe(true);
      expect((svg.match(/data-temperature-current-label=/g) ?? []).length).toBe(1);
      expect(svg).toContain('原图近似读图'); expect(svg).toContain('进度表示深度');
      expect(svg).not.toMatch(/<image|<animate|setInterval|requestAnimationFrame/);
    }
  });
});

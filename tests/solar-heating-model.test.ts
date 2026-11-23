import { describe, expect, it } from 'vitest';
import {
  evaluateSolarHeating, solarHeatingPathPoint, solarHeatingSvg, solarHeatingSlab,
  solarHeatingBoxMesh, SOLAR_HEATING_REFERENCE, SOLAR_HEATING_STOPS,
  SOLAR_HEATING_LAYOUT, SOLAR_HEATING_BOXES, SOLAR_HEATING_ROOFS,
  SOLAR_HEATING_COLLECTOR, SOLAR_HEATING_WATER_PATHS, SOLAR_HEATING_WATER_MARKS,
  SOLAR_HEATING_RAYS, type SolarPoint,
} from '../src/textbook-solar-heating-model';

const distance = (a: readonly number[], b: readonly number[]) => Math.hypot(...a.map((n, i) => n - b[i]));

describe('finite solar-thermal collection and room-heating demonstration', () => {
  it('launches parallel shortwave paths at the three outward points on the model Sun',()=>{
    const source=SOLAR_HEATING_LAYOUT.sun;
    const vectors=SOLAR_HEATING_RAYS.map(ray=>{
      expect(Math.hypot(...ray.source.map((v,i)=>v-source[i]))).toBeCloseTo(SOLAR_HEATING_LAYOUT.sunRadius,10);
      const d=ray.destination.map((v,i)=>v-ray.source[i]),len=Math.hypot(...d);
      return d.map(v=>v/len);
    });
    vectors.forEach(v=>v.forEach((value,i)=>expect(value).toBeCloseTo(vectors[0][i],10)));
  });
  it('preserves the distinction between three radiation marks and six existing water marks', () => {
    const rays = SOLAR_HEATING_RAYS.map(ray => ray.id);
    const water = SOLAR_HEATING_WATER_MARKS.map(mark => mark.id);
    expect(new Set([...rays, ...water]).size).toBe(9);
    for (let step = 0; step <= 200; step++) {
      const state = evaluateSolarHeating(step / 200);
      expect(state.radiationIds).toEqual(rays); expect(state.waterIds).toEqual(water);
      expect(state.rays.every(ray => ray.medium === 'radiation')).toBe(true);
      expect(state.water.every(mark => mark.medium === 'water')).toBe(true);
      expect(state.water).toHaveLength(6);
      for (const mark of [...state.rays, ...state.water]) expect(mark.point.every(Number.isFinite)).toBe(true);
    }
    expect(SOLAR_HEATING_REFERENCE.radiationMarksBecomeWater).toBe(false);
    expect(SOLAR_HEATING_REFERENCE.collectorType).toBe('solar-thermal-not-photovoltaic');
  });

  it('uses the four stops as a monotonic explanation sequence and shows only the current short label', () => {
    expect(SOLAR_HEATING_STOPS.map(stop => evaluateSolarHeating(stop.phase).selection)).toEqual([0, 1, 2, 3]);
    expect(SOLAR_HEATING_STOPS.map(stop => evaluateSolarHeating(stop.phase).stage)).toEqual([
      'shortwave', 'absorption', 'circulation', 'room-heating',
    ]);
    let previous = 0;
    for (let step = 0; step <= 200; step++) {
      const state = evaluateSolarHeating(step / 200);
      expect(state.stageIndex).toBeGreaterThanOrEqual(previous); previous = state.stageIndex;
      expect(state.labels).toHaveLength(1);
      expect(state.labels[0].selection).toBe(state.selection);
      expect(state.caption).toBe(SOLAR_HEATING_STOPS[state.selection].label);
    }
  });

  it('receives radiation before collector warming and returns collected heat before room response', () => {
    const start = evaluateSolarHeating(0), arrival = evaluateSolarHeating(.22);
    expect(start.rays.every(ray => ray.progress === 0 && !ray.absorbed)).toBe(true);
    expect(arrival.retained.shortwaveArrived).toBe(true);
    expect(arrival.collectorWarmth).toBe(0);
    const collector = evaluateSolarHeating(.44);
    expect(collector.collectorWarmth).toBe(1);
    expect(collector.storageWarmth).toBe(0);
    expect(collector.water.every(mark => mark.progress === 0)).toBe(true);
    const stored = evaluateSolarHeating(.74);
    expect(stored.storageWarmth).toBe(1);
    expect(stored.water.filter(mark => mark.circuit === 'collection').every(mark => mark.returned)).toBe(true);
    expect(stored.roomWarmth).toEqual({ upper: 0, lower: 0 });
    expect(stored.water.filter(mark => mark.circuit !== 'collection').every(mark => !mark.started)).toBe(true);
    const end = evaluateSolarHeating(1);
    expect(end.roomWarmth).toEqual({ upper: 1, lower: 1 });
    expect(end.retained.roomsHeated).toBe(true);
    expect(end.retained.waterReturned).toBe(6);
  });

  it('has closed collection and room-return paths and retains each water mark inside storage at the end', () => {
    expect(SOLAR_HEATING_WATER_PATHS.map(path => path.id)).toEqual(['collection', 'upper-room', 'lower-room']);
    for (const path of SOLAR_HEATING_WATER_PATHS) expect(path.points.at(-1)).toEqual(path.points[0]);
    const first = evaluateSolarHeating(0), last = evaluateSolarHeating(1), beyond = evaluateSolarHeating(2);
    expect(last.water.map(mark => mark.point)).toEqual(first.water.map(mark => mark.point));
    expect(last.water.map(mark => mark.point)).toEqual(beyond.water.map(mark => mark.point));
    for (const mark of last.water) {
      expect(mark.progress).toBe(1); expect(mark.returned).toBe(true);
      expect(mark.route.at(-1)).toEqual(mark.route[0]);
      const [x, y, z] = mark.point, { center, radius, height } = SOLAR_HEATING_LAYOUT.tank;
      expect(Math.hypot(x - center[0], z - center[2])).toBeLessThan(radius);
      expect(Math.abs(y - center[1])).toBeLessThan(height / 2);
    }
    expect(first.water.every(mark => mark.progress === 0 && !mark.returned)).toBe(true);
    expect(last.closedWaterPaths).toBe(true); expect(last.sharedStorage).toBe(true);
    expect(SOLAR_HEATING_REFERENCE.separateHeatExchangerImplied).toBe(false);
  });

  it('never wraps or respawns a water mark when advancing beyond its return', () => {
    for (const definition of SOLAR_HEATING_WATER_MARKS) {
      let previous = 0;
      for (let step = 0; step <= 200; step++) {
        const mark = evaluateSolarHeating(step / 200).water[definition.index];
        expect(mark.progress).toBeGreaterThanOrEqual(previous); previous = mark.progress;
        if (step / 200 >= definition.end) {
          expect(mark.progress).toBe(1); expect(mark.returned).toBe(true);
          expect(mark.point).toEqual(definition.route.at(-1));
        }
      }
      const middle = evaluateSolarHeating((definition.start + definition.end) / 2).water[definition.index];
      expect(distance(middle.point, definition.route[0])).toBeGreaterThan(5);
    }
  });

  it('is deterministic under reverse seeking and arbitrary evaluation order', () => {
    const phases = [0, .09, .22, .33, .44, .58, .72, .75, .86, .98, 1];
    const forward = phases.map(phase => evaluateSolarHeating(phase));
    for (let index = phases.length - 1; index >= 0; index--) {
      evaluateSolarHeating(1); evaluateSolarHeating(.25); evaluateSolarHeating(0);
      expect(evaluateSolarHeating(phases[index])).toEqual(forward[index]);
    }
  });

  it('normalizes non-finite and out-of-range inputs to a finite teaching state', () => {
    for (const phase of [NaN, Infinity, -Infinity, -100]) expect(evaluateSolarHeating(phase)).toEqual(evaluateSolarHeating(0));
    expect(evaluateSolarHeating(10)).toEqual(evaluateSolarHeating(1));
    for (const phase of [0, .1, .5, .9, 1]) {
      const state = evaluateSolarHeating(phase);
      for (const value of [state.collectorWarmth, state.storageWarmth, state.roomWarmth.upper, state.roomWarmth.lower,
        ...state.water.map(mark => mark.warmth)]) {
        expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(1);
      }
      expect(state.phaseMeansElapsedTime).toBe(false);
      expect(state.phaseMeaning).toBe('teaching-sequence');
      expect(state.units).toBe('qualitative-teaching-state');
    }
    expect(SOLAR_HEATING_REFERENCE.measuredTemperature).toBe(false);
    expect(SOLAR_HEATING_REFERENCE.measuredFlowRate).toBe(false);
    expect(SOLAR_HEATING_REFERENCE.measuredEfficiency).toBe(false);
  });

  it('follows straight pipe segments without spline overshoot and stops at route endpoints', () => {
    const path: SolarPoint[] = [[0, 0, 0], [0, 4, 0], [3, 4, 0]];
    expect(solarHeatingPathPoint(path, 4 / 7)).toEqual(path[1]);
    expect(solarHeatingPathPoint(path, -1)).toEqual(path[0]);
    expect(solarHeatingPathPoint(path, Infinity)).toEqual(path[0]);
    expect(solarHeatingPathPoint(path, 2)).toEqual(path[2]);
    for (const route of SOLAR_HEATING_WATER_MARKS.map(mark => mark.route)) for (let step = 0; step <= 200; step++) {
      const point = solarHeatingPathPoint(route, step / 200);
      const onSegment = route.slice(1).some((b, index) => {
        const a = route[index], length = distance(a, b);
        return Math.abs(distance(a, point) + distance(point, b) - length) < 1e-7;
      });
      expect(onSegment).toBe(true);
    }
  });

  it('keeps water motion continuous at the beginning and end of every finite journey', () => {
    for (const definition of SOLAR_HEATING_WATER_MARKS) for (const boundary of [definition.start, definition.end]) {
      const before = evaluateSolarHeating(boundary - 1e-7).water[definition.index];
      const after = evaluateSolarHeating(boundary + 1e-7).water[definition.index];
      expect(distance(before.point, after.point)).toBeLessThan(1e-5);
    }
  });

  it('uses closed solid mesh data for the roof, thermal collector and cutaway structure', () => {
    const meshes = [
      ...SOLAR_HEATING_ROOFS.map(roof => solarHeatingSlab(roof, 1)),
      solarHeatingSlab(SOLAR_HEATING_COLLECTOR),
      ...SOLAR_HEATING_BOXES.map(part => solarHeatingBoxMesh(part)),
    ];
    for (const mesh of meshes) {
      expect(mesh.positions.every(Number.isFinite)).toBe(true);
      expect(mesh.indices.length % 3).toBe(0);
      const edges = new Map<string, number>();
      for (let i = 0; i < mesh.indices.length; i += 3) for (let side = 0; side < 3; side++) {
        const edge = [mesh.indices[i + side], mesh.indices[i + (side + 1) % 3]].sort((a, b) => a - b).join('|');
        edges.set(edge, (edges.get(edge) ?? 0) + 1);
      }
      expect([...edges.values()].every(count => count === 2)).toBe(true);
    }
  });

  it('publishes the same identities, positions and result state in native SVG', () => {
    for (const phase of [0, .22, .44, .6, .72, .9, 1]) {
      const state = evaluateSolarHeating(phase), svg = solarHeatingSvg(phase);
      const match = svg.match(/data-solar-heating-state='([^']+)'/); expect(match).not.toBeNull();
      const decoded = JSON.parse(match![1].replace(/&#39;/g, "'").replace(/&amp;/g, '&'));
      expect(decoded).toEqual({ ...state, reference: SOLAR_HEATING_REFERENCE });
      expect((svg.match(/data-solar-ray=/g) ?? []).length).toBe(3);
      expect((svg.match(/data-solar-water=/g) ?? []).length).toBe(6);
      expect(svg).not.toMatch(/<image|<animate|setInterval|requestAnimationFrame/);
      expect(svg).toContain('font-size="36"');
      // Every stage stays reachable through the equipment, even when its
      // explanatory label is hidden at another position on the timeline.
      expect(svg).toContain('role="group"');
      for (const stop of SOLAR_HEATING_STOPS) {
        expect(svg).toContain(`data-model-selection="${stop.selection}" role="button" tabindex="0"`);
      }
    }
  });
});

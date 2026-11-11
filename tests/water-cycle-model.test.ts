import { describe, expect, it } from 'vitest';
import { evaluateWaterCycle, waterCycleDiagnostics, waterCycleSvg, waterCycleTerrainHeight,
  waterCycleRiverSection, waterCycleLandMesh, waterCycleSeaMesh, waterCycleRiverMesh,
  waterCycleCoastX, waterCyclePathPoint, WATER_CYCLE_SAMPLE_IDS, WATER_CYCLE_REFERENCE } from '../src/textbook-water-cycle-model';

describe('three distinct finite water-cycle demonstrations', () => {
  it('retains all six identities from source through return without spawning a second batch', () => {
    for (const selection of [0, 1, 2]) for (let i = 0; i <= 200; i++) {
      const state = evaluateWaterCycle(i / 200, selection);
      expect(state.samples.map(sample => sample.id)).toEqual(WATER_CYCLE_SAMPLE_IDS);
      expect(state.inventory.total).toBe(6);
      const { total, ...buckets } = state.inventory;
      expect(Object.values(buckets).reduce((a, b) => a + b, 0)).toBe(total);
      state.samples.forEach(sample => expect(sample.position.every(Number.isFinite)).toBe(true));
    }
  });
  it('keeps the terminal destination instead of wrapping to evaporation', () => {
    for (const selection of [0, 1, 2]) {
      const start = evaluateWaterCycle(0, selection), end = evaluateWaterCycle(1, selection);
      expect(start.inventory.source).toBe(6); expect(end.inventory.returned).toBe(6);
      expect(end.samples.every(sample => sample.returned && sample.medium === 'liquid')).toBe(true);
      expect(end.samples.map(sample => sample.position)).not.toEqual(start.samples.map(sample => sample.position));
      expect(end.samples.map(sample => sample.position)).toEqual(evaluateWaterCycle(5, selection).samples.map(sample => sample.position));
    }
  });
  it('has separate joined surface and subsurface routes only in the sea–land cycle', () => {
    const state = evaluateWaterCycle(.9, 0);
    expect(state.samples.slice(0, 3).every(sample => sample.branch === 'surface')).toBe(true);
    expect(state.samples.slice(3).every(sample => sample.branch === 'subsurface')).toBe(true);
    expect(state.samples.every(sample => sample.source === 'sea' && sample.destination === 'sea')).toBe(true);
    for (const sample of state.samples) {
      const returning = sample.route.at(-1)!;
      expect(returning.kind).toBe(sample.index < 3 ? 'surface-return' : 'subsurface-return');
      expect(returning.points[0]).toEqual(sample.route.at(-2)!.points.at(-1));
      expect(returning.points.at(-1)![0]).toBeGreaterThan(waterCycleCoastX(returning.points.at(-1)![2]));
    }
    expect(state.samples[0].position).not.toEqual(state.samples[3].position);
  });
  it('keeps land recycling over land and sea recycling over the sea', () => {
    for (let i = 0; i <= 120; i++) for (const selection of [1, 2]) {
      const state = evaluateWaterCycle(i / 120, selection);
      for (const sample of state.samples) {
        const [x, , z] = sample.position;
        if (selection === 1) {
          expect(x).toBeLessThan(waterCycleCoastX(z)); expect(sample.destination).toBe('land');
          expect(sample.route.some(leg => leg.kind === 'surface-return' || leg.kind === 'subsurface-return')).toBe(false);
        } else {
          expect(x).toBeGreaterThan(waterCycleCoastX(z)); expect(sample.source).toBe('sea');
          expect(sample.destination).toBe('sea');
        }
      }
    }
    const land = evaluateWaterCycle(.1, 1);
    expect(land.samples.filter(sample => sample.currentLeg === 'transpiration')).toHaveLength(3);
    expect(land.samples.filter(sample => sample.source === 'land-water')).toHaveLength(3);
  });
  it('joins every phase boundary continuously and falls downward through the same precipitation leg', () => {
    for (const selection of [0, 1, 2]) {
      const first = evaluateWaterCycle(0, selection);
      for (const sample of first.samples) for (let j = 1; j < sample.route.length; j++) {
        const before = sample.route[j - 1], after = sample.route[j];
        expect(before.end).toBe(after.start); expect(before.points.at(-1)).toEqual(after.points[0]);
        const low = evaluateWaterCycle(before.end - 1e-7, selection).samples[sample.index].position;
        const high = evaluateWaterCycle(before.end + 1e-7, selection).samples[sample.index].position;
        expect(Math.hypot(...low.map((n, k) => n - high[k]))).toBeLessThan(1e-4);
      }
      const rain = first.samples[0].route.find(leg => leg.kind === 'precipitation')!;
      for (let step = 0; step < 30; step++) {
        const phase = rain.start + (rain.end - rain.start) * (step + .1) / 31;
        const a = evaluateWaterCycle(phase, selection), b = evaluateWaterCycle(phase + (rain.end - rain.start) / 62, selection);
        for (let index = 0; index < 6; index++) {
          expect(a.samples[index].medium).toBe('rain');
          expect(b.samples[index].position[1]).toBeLessThan(a.samples[index].position[1]);
        }
      }
    }
  });
  it('is a pure reversible lookup: seeking order and frame timing cannot change a result', () => {
    for (const selection of [0, 1, 2]) for (const phase of [.04, .29, .46, .58, .75, .93, 1]) {
      const expected = evaluateWaterCycle(phase, selection);
      evaluateWaterCycle(1, (selection + 1) % 3); evaluateWaterCycle(0, selection); evaluateWaterCycle(.77, selection);
      expect(evaluateWaterCycle(phase, selection)).toEqual(expected);
    }
  });
  it('distinguishes invisible vapor symbols from condensed cloud water', () => {
    for (const selection of [0, 1, 2]) {
      const start = evaluateWaterCycle(0, selection), vapor = evaluateWaterCycle(.1, selection);
      expect(start.cloud.land + start.cloud.sea).toBe(0);
      expect(vapor.samples.every(sample => sample.medium === 'vapor')).toBe(true);
      expect(vapor.cloud.land + vapor.cloud.sea).toBe(0);
      const cloudy = evaluateWaterCycle(selection === 0 ? .46 : .5, selection);
      expect(cloudy.samples.every(sample => sample.medium === 'cloud-water')).toBe(true);
      expect(cloudy.cloud.land + cloudy.cloud.sea).toBeGreaterThan(.9);
      const end = evaluateWaterCycle(1, selection); expect(end.cloud.land + end.cloud.sea).toBe(0);
    }
    expect(WATER_CYCLE_REFERENCE.vaporIsInvisible).toBe(true);
    expect(WATER_CYCLE_REFERENCE.sampleCountIsNotWaterAmount).toBe(true);
    expect(WATER_CYCLE_REFERENCE.branchCountsAreNotRunoffFractions).toBe(true);
  });
  it('closes the actual land, river and sea meshes and embeds river banks into the land heightfield', () => {
    for (const mesh of [waterCycleLandMesh(), waterCycleRiverMesh(), waterCycleSeaMesh()]) {
      expect(mesh.positions.every(Number.isFinite)).toBe(true);
      expect(mesh.indices.length % 3).toBe(0);
      const edges = new Map<string, number>();
      const vertex = (index: number) => mesh.positions.slice(index * 3, index * 3 + 3).map(n => n.toFixed(6)).join(',');
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const face = mesh.indices.slice(i, i + 3);
        for (let j = 0; j < 3; j++) {
          const edge = [vertex(face[j]), vertex(face[(j + 1) % 3])].sort().join('|');
          edges.set(edge, (edges.get(edge) ?? 0) + 1);
        }
      }
      expect([...edges.values()].every(count => count === 2)).toBe(true);
    }
    for (let x = 23; x <= 62; x += 1.3) {
      const section = waterCycleRiverSection(x);
      expect(waterCycleTerrainHeight(x, section.leftZ)).toBeCloseTo(section.level, 3);
      expect(waterCycleTerrainHeight(x, section.rightZ)).toBeCloseTo(section.level, 3);
      expect(section.bed).toBeLessThan(section.level);
    }
  });
  it('outputs the identical six states in native SVG, with no image or independent animation', () => {
    for (const selection of [0, 1, 2]) for (const phase of [.1, .4, .6, .85, 1]) {
      const state = evaluateWaterCycle(phase, selection), svg = waterCycleSvg(phase, selection);
      const match = svg.match(/data-water-cycle-state='([^']+)'/); expect(match).not.toBeNull();
      const decoded = JSON.parse(match![1].replace(/&#39;/g, "'").replace(/&amp;/g, '&'));
      expect(decoded.samples).toEqual(waterCycleDiagnostics(state).samples);
      expect((svg.match(/data-water-sample=/g) ?? []).length).toBe(6);
      expect(svg).not.toMatch(/<image|<animate|setInterval|requestAnimationFrame/);
    }
  });
  it('walks a polyline without Catmull-Rom overshoot or endpoint wrapping', () => {
    const path = [[0, 0, 0], [0, 4, 0], [3, 4, 0]] as const;
    expect(waterCyclePathPoint(path, 0)).toEqual(path[0]); expect(waterCyclePathPoint(path, 1)).toEqual(path[2]);
    expect(waterCyclePathPoint(path, 4 / 7)).toEqual(path[1]);
    for (let i = 0; i <= 80; i++) {
      const [x, y, z] = waterCyclePathPoint(path, i / 80);
      expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(3);
      expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(4); expect(z).toBe(0);
    }
  });
});

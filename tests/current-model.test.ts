import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
import { CURRENT_LAYOUT, CURRENT_PATH_LENGTH, CURRENT_REFERENCE, CURRENT_SAMPLE_COUNT, CURRENT_SAMPLES,
  CURRENT_STOPS, CURRENT_TRAVEL, CURRENT_WAVE_ORBIT, currentCoastMesh, currentPathPoint,
  currentPathTangent, currentRibbonMesh, currentSeaMesh, currentWaveComparisonPoint,
  evaluateOceanCurrent, oceanCurrentSvg, type CurrentMeshData } from '../src/textbook-current-model';
import { evaluateWave } from '../src/textbook-wave-model';
import { phaseFromTrackPoint } from '../src/textbook-model-input';
import type { TextbookGeometry, Vec3 } from '../src/textbook-geometry';
import { loadFieldInstrument } from '../src/textbook-field-instruments';

beforeAll(() => loadFieldInstrument('currents'));

vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildCurrentWorld } from '../src/textbook-current-world';

function fixture() {
  const meshes: Three.Mesh[] = [], root = new Three.Group(), strokes: Vec3[][] = [], contours: Vec3[][] = [];
  const b: any = {
    width: 300, height: 140, root, meshes, strokes, contours,
    pop: { paper: ({ color = '#fff' }: { color?: string }) => new Three.MeshBasicMaterial({ color }) },
    v: (point: Vec3) => new Three.Vector3(...point),
    mesh(geometry: Three.BufferGeometry, color = '#fff') {
      const mesh = new Three.Mesh(geometry, new Three.MeshBasicMaterial({ color }));
      root.add(mesh); meshes.push(mesh); return mesh;
    },
    label(text: string, point: Vec3, width: number, height: number) {
      const mesh = this.mesh(new Three.PlaneGeometry(width, height)); mesh.position.set(...point);
      mesh.userData.kind = 'text-label'; mesh.userData.text = text; mesh.userData.labelSize = [width, height]; return mesh;
    },
    stroke(points: Vec3[]) { strokes.push(points); }, contour(points: Vec3[]) { contours.push(points); },
    outline(_mesh: Three.Mesh) {},
  };
  return { b, meshes, motion: buildCurrentWorld(b as TextbookGeometry) };
}
const closePoint = (a: number[], z: number[], digits = 10) => a.forEach((value, i) => expect(value).toBeCloseTo(z[i], digits));

describe('a finite directional-current teaching example with a checked source', () => {
  it('corrects the old Gulf Stream attribution and does not derive a route from the photo', () => {
    expect(CURRENT_REFERENCE).toMatchObject({ printedPage: 61, pdfPage: 66, figure: '3.26',
      imageRegion: '阿根廷东南沿海', imageHasDirectionArrows: false, notGeoreferenced: true,
      namedCurrent: null, actualCoastline: false, actualTrajectory: false, measuredSpeed: false,
      measuredTemperature: false, calibratedTime: false, globalClosedCirculation: false,
      confluenceOrEcologySimulated: false });
    expect(CURRENT_REFERENCE.title).toBe('洋流交汇海域浮游生物的卫星影像');
  });

  it('uses three bookmarks on one continuous process rather than independent alternatives', () => {
    expect(CURRENT_STOPS.map(stop => [stop.phase, stop.selection])).toEqual([[0, 0], [.5, 1], [1, 2]]);
    CURRENT_STOPS.forEach(stop => expect(evaluateOceanCurrent(stop.phase)).toMatchObject({
      phase: stop.phase, stageIndex: stop.selection, selection: stop.selection, activeStop: stop.selection,
    }));
    expect(evaluateOceanCurrent(.25).caption.length).toBeLessThan(30);
    expect(evaluateOceanCurrent(.2).phaseMeaning).toBe('uncalibrated-observation-progress');
  });

  it('retains twelve fixed identities, origins, destinations and colours after any seek', () => {
    expect(CURRENT_SAMPLE_COUNT).toBe(12); expect(CURRENT_SAMPLES).toHaveLength(12);
    expect(new Set(CURRENT_SAMPLES.map(sample => sample.id)).size).toBe(12);
    const identities = CURRENT_SAMPLES.map(({ id, origin, destination, color, lane }) => ({ id, origin, destination, color, lane }));
    for (const phase of [0, .4, .9, .1, 1, .5, 0]) {
      const state = evaluateOceanCurrent(phase);
      expect(state.samples.map(({ id, origin, destination, color, lane }) => ({ id, origin, destination, color, lane }))).toEqual(identities);
      expect(state.samples.every(sample => sample.retained)).toBe(true);
      expect(state.retainedCount).toBe(12); expect(state.wraps).toBe(false); expect(state.respawns).toBe(false);
    }
  });

  it('moves every actual water point in the same forward sense on an open route', () => {
    expect(currentPathPoint(0)).not.toEqual(currentPathPoint(1)); expect(CURRENT_PATH_LENGTH).toBeGreaterThan(60);
    let previous = evaluateOceanCurrent(0);
    for (let step = 1; step <= 100; step++) {
      const state = evaluateOceanCurrent(step / 100);
      state.samples.forEach((sample, index) => {
        expect(sample.progress).toBeGreaterThan(previous.samples[index].progress);
        expect(sample.point[0]).toBeGreaterThan(previous.samples[index].point[0]);
        expect(sample.point[2]).toBeLessThan(previous.samples[index].point[2]);
        expect(sample.point[1]).toBe(9.05);
        expect(sample.progress).toBeCloseTo(sample.startProgress + CURRENT_TRAVEL * state.phase, 12);
        expect(sample.point).toEqual(currentPathPoint(sample.progress, sample.lane));
        expect(sample.tangent[0]).toBeGreaterThan(0); expect(sample.tangent[2]).toBeLessThan(0);
        expect(Math.hypot(...sample.tangent)).toBeCloseTo(1, 12);
      });
      previous = state;
    }
  });

  it('is history-free and accepts only a bounded finite phase', () => {
    const expected = evaluateOceanCurrent(.637193);
    for (const phase of [1, .13, .9, 0, .37]) evaluateOceanCurrent(phase);
    expect(evaluateOceanCurrent(.637193)).toEqual(expected);
    expect(evaluateOceanCurrent(-4).phase).toBe(0); expect(evaluateOceanCurrent(4).phase).toBe(1);
    for (const invalid of [Number.NaN, Infinity, -Infinity]) {
      const state = evaluateOceanCurrent(invalid); expect(state.phase).toBe(0);
      expect(state.samples.flatMap(sample => sample.point).every(Number.isFinite)).toBe(true);
    }
    expect(currentPathPoint(Number.NaN, Number.NaN).every(Number.isFinite)).toBe(true);
    expect(currentPathTangent(Number.NaN).every(Number.isFinite)).toBe(true);
  });

  it('retains the final position instead of wrapping and visibly differs from the existing wave orbit', () => {
    const start = evaluateOceanCurrent(0), end = evaluateOceanCurrent(1);
    expect(end.complete).toBe(true); expect(end.samples.every(sample => sample.endpointReached)).toBe(true);
    end.samples.forEach((sample, index) => {
      expect(sample.point).toEqual(sample.destination);
      expect(Math.hypot(...sample.displacement)).toBeGreaterThan(50);
      expect(sample.point).not.toEqual(start.samples[index].point);
    });
    expect(evaluateOceanCurrent(1)).toEqual(end);
    expect(currentWaveComparisonPoint(1)).toEqual(currentWaveComparisonPoint(0));
    expect(evaluateWave(1, 1).particle).toEqual(evaluateWave(0, 1).particle);
    expect(end.comparison.displacement).toEqual([0, 0, 0]);
    expect(CURRENT_WAVE_ORBIT[0]).toEqual(CURRENT_WAVE_ORBIT.at(-1));
    expect(end.comparison).toMatchObject({ closedOrbit: true, oceanCurrentUsesThisOrbit: false, sameCalibratedDuration: false });
  });

  it('supplies finite closed, genuinely thick sea, bank and guide geometry', () => {
    for (const data of [currentSeaMesh(), currentCoastMesh(), currentRibbonMesh()]) {
      expect(data.positions.every(Number.isFinite)).toBe(true);
      expect(data.indices.every(index => index >= 0 && index < data.positions.length / 3)).toBe(true);
      const edges = new Map<string, number>();
      for (let i = 0; i < data.indices.length; i += 3) for (let j = 0; j < 3; j++) {
        const a = data.indices[i + j], z = data.indices[i + (j + 1) % 3], key = [a, z].sort((x, y) => x - y).join(':');
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
      expect([...edges.values()].every(count => count === 2)).toBe(true);
      const ys = data.positions.filter((_, i) => i % 3 === 1);
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(.1);
    }
  });

  it('exposes exactly the same unrounded state in native SVG with selectable fixed identities', () => {
    for (const phase of [0, .437129, .5, 1, .43712899999993]) {
      const state = evaluateOceanCurrent(phase), svg = oceanCurrentSvg(phase);
      expect(svg).not.toContain('<image'); expect(svg).not.toContain('data:image');
      expect(svg.match(/data-current-sample="/g)).toHaveLength(12);
      expect(svg.match(/data-current-node="/g)).toHaveLength(3);
      const embedded = JSON.parse(svg.match(/data-current-state='([^']+)'/)![1]);
      expect(embedded.phase).toBe(state.phase); expect(embedded.stageIndex).toBe(state.stageIndex);
      expect(embedded.samples).toEqual(state.samples.map(({ id, progress, point }) => ({ id, progress, point })));
      expect(embedded.comparison.point).toEqual(state.comparison.point);
      expect(svg).toContain('data-current-not-georeferenced="true"');
      expect(svg).toContain(state.caption);
      expect(svg).not.toMatch(/北美洲|大西洋|墨西哥湾|北大西洋|米每秒|℃|抵达日/);
    }
  });
});

describe('the raised sea uses the pure finite advection state', () => {
  it('builds actual sea, bank, finite tracer solids and click targets without a model image', () => {
    const { meshes, motion } = fixture(), tracers = meshes.filter(mesh => mesh.userData.currentRole === 'water-tracer');
    expect(tracers).toHaveLength(12);
    expect(meshes.some(mesh => mesh.userData.blenderPart === 'sea')).toBe(true);
    expect(new Set(tracers.map(mesh => mesh.userData.currentSampleId)).size).toBe(12);
    expect(tracers.every(mesh => mesh.userData.modelInput.kind === 'select' && mesh.userData.modelInput.selection === 1)).toBe(true);
    expect(meshes.find(mesh => mesh.userData.currentRole === 'origin-bookmark')!.userData.modelInput.selection).toBe(0);
    expect(meshes.find(mesh => mesh.userData.currentRole === 'destination-bookmark')!.userData.modelInput.selection).toBe(2);
    const labels = meshes.filter(mesh => mesh.userData.kind === 'text-label');
    expect(labels.map(mesh => mesh.userData.text)).toEqual(['往复参照', '起点', '前移', '末位置']);
    expect(labels.every(mesh => mesh.userData.labelSize[1] >= 7.8 * 3)).toBe(true);
    expect(motion.describe!()).toMatchObject({ kind: 'ocean-current-advection', sampleCount: 12,
      fixedMeshCount: meshes.length, notGeoreferenced: true, originalPagePreserved: true, measuredSpeed: false });
    const sea = meshes.find(mesh => mesh.userData.currentRole === 'closed-sea-solid')!;
    sea.geometry.computeBoundingBox(); expect(sea.geometry.boundingBox!.max.y - sea.geometry.boundingBox!.min.y).toBeCloseTo(7.7 * 3, 5);
  });

  it('keeps all actual marker world positions, probe progress and comparison in sync', () => {
    const { motion } = fixture();
    for (const phase of [0, .25, .8, 1, .4, 0]) {
      motion.update(phase, 2, 1 / 60, false);
      const state = evaluateOceanCurrent(phase), actual = motion.describe!();
      expect(actual.state).toEqual(state);
      expect(actual).toMatchObject({ phase: state.phase, stage: state.stage, stageIndex: state.stageIndex,
        selection: state.selection, caption: state.caption, allTracersVisible: true });
      for (const sample of actual.tracerWorld as { id: string; point: Vec3; progress: number }[]) {
        const expected = state.samples.find(s => s.id === sample.id)!;
        closePoint(sample.point, [expected.point[0] * 3, expected.point[1] * 3 + 129, -336 + expected.point[2] * 3]);
        expect(sample.progress).toBe(expected.progress);
      }
      const track = actual.phaseTrackWorld as { start: Vec3; end: Vec3 };
      closePoint(actual.handleWorld as Vec3, track.start.map((value, i) => value + (track.end[i] - value) * phase));
    }
  });

  it('has a stable front pull tab with deterministic forward and reverse seeking', () => {
    const { meshes } = fixture(), handle = meshes.find(mesh => mesh.userData.currentRole === 'phase-handle')!;
    expect(handle.userData.smallPointTarget).toBe(true);
    const { kind, track } = handle.userData.modelInput;
    expect(kind).toBe('phase-track'); expect(track.start[2]).toBe(track.end[2]);
    for (const phase of [0, .43, .91, .15, .43, 1]) {
      const point = track.start.map((value: number, i: number) => value + (track.end[i] - value) * phase);
      expect(phaseFromTrackPoint(point[0], point[1], track, 0)).toBeCloseTo(phase, 12);
    }
  });

  it('retains all final geometry, stable buffers and fixed focus at different frame rates', () => {
    const { b, meshes, motion } = fixture(), focus = motion.focusBounds!();
    const positions = meshes.map(mesh => mesh.geometry.attributes.position.array), indices = meshes.map(mesh => mesh.geometry.index?.array);
    const structures = meshes.filter(mesh => ['closed-sea-solid', 'abstract-coast-solid', 'open-direction-guide', 'fixed-direction-marks'].includes(mesh.userData.currentRole));
    const transforms = structures.map(mesh => mesh.matrix.clone());
    for (const phase of [0, .9, .2, .5, 1, 0, 1]) {
      b.contours.length = 0; motion.update(phase, 1, 1 / 30, false);
      expect(motion.focusBounds!()).toEqual(focus);
      expect(motion.describe!().geometryBuffersReused).toBe(true);
      meshes.forEach((mesh, i) => { expect(mesh.geometry.attributes.position.array).toBe(positions[i]); expect(mesh.geometry.index?.array).toBe(indices[i]); });
      structures.forEach((mesh, i) => { mesh.updateMatrix(); expect(mesh.matrix).toEqual(transforms[i]); });
      expect(b.contours.length).toBeLessThanOrEqual(1);
    }
    motion.update(1, 0, 1 / 30, false); const endpoint = motion.describe!();
    motion.update(1, 2, 1000, true); expect(motion.describe!()).toEqual(endpoint);
    expect(endpoint).toMatchObject({ endpointRetained: true, allTracersVisible: true, retainedCount: 12, wraps: false, respawns: false });
    motion.update(.613, 0, 1 / 30, false); const slow = motion.describe!();
    motion.update(.613, 2, 1 / 144, true); expect(motion.describe!()).toEqual(slow);
  });
});

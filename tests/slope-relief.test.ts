import { describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
import { SLOPE_BOUNDARY_INDICES, SLOPE_CONSTRAINTS, SLOPE_CONTOURS, SLOPE_GRID, SLOPE_LAYOUT,
  SLOPE_REFERENCE, SLOPE_SPOTS, SLOPE_STOPS, evaluateSlopeRelief, slopeDisplayY,
  slopeElevationAt, slopeReliefMesh, slopeReliefSvg, slopeTerrainElevationAt } from '../src/textbook-slope-model';
import { phaseFromTrackPoint } from '../src/textbook-model-input';
import type { TextbookGeometry, Vec3 } from '../src/textbook-geometry';
vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildSlopeWorld } from '../src/textbook-slope-world';

function fixture() {
  const meshes: Three.Mesh[] = [], root = new Three.Group(), contours: Vec3[][] = [];
  const b: any = {
    width: 300, height: 140, root, meshes, contours,
    pop: { paper: ({ color = '#fff' }: { color?: string }) => new Three.MeshBasicMaterial({ color }) },
    v: (point: Vec3) => new Three.Vector3(...point),
    mesh(geometry: Three.BufferGeometry, color = '#fff') {
      const mesh = new Three.Mesh(geometry, new Three.MeshBasicMaterial({ color })); root.add(mesh); meshes.push(mesh); return mesh;
    },
    label(text: string, point: Vec3, width: number, height: number) {
      const mesh = this.mesh(new Three.PlaneGeometry(width, height)); mesh.position.set(...point);
      mesh.userData.kind = 'text-label'; mesh.userData.text = text; mesh.userData.labelSize = [width, height]; return mesh;
    },
    stroke() {}, contour(points: Vec3[]) { contours.push(points); }, outline() {},
  };
  return { b, meshes, motion: buildSlopeWorld(b as TextbookGeometry) };
}
// Three.js stores mesh attributes in Float32, while pure/source coordinates are
// doubles. 1e-4 world units is far below a rendered pixel at this book scale.
const closePoint = (a: number[], z: number[], digits = 4) => a.forEach((value, index) => expect(value).toBeCloseTo(z[index], digits));

describe('Fig.4.22 contour-constrained fixed teaching relief', () => {
  it('preserves checked values, the two spot positions and the boundary of what was actually read', () => {
    expect(SLOPE_REFERENCE).toMatchObject({ printedPage: 77, pdfPage: 82, figure: '4.22',
      checkedElevationsM: { jia: 879, yi: 885.4 }, checkedContourLabelsM: [800, 850],
      checkedScaleBarM: 75, sourceContourIntervalM: null, surveyedDEM: false,
      exactMapScale: false, auxiliaryContoursAreOriginalTraces: false, slopeAngleFigure423Included: false });
    expect(SLOPE_REFERENCE.title).toBe('黄土高原某地等高线地形示意');
    const [jia, yi] = SLOPE_SPOTS;
    expect(jia.x).toBeGreaterThan(80); expect(jia.z).toBeLessThan(20);
    expect(yi.x).toBeLessThan(20); expect(yi.z).toBeGreaterThan(40);
    expect(yi.elevationM - jia.elevationM).toBeCloseTo(6.4, 10);
  });
  it('uses the central deep gully and connected right tributary rather than unrelated rounded hills', () => {
    const main = SLOPE_CONSTRAINTS.find(line => line.id === 'main-gully')!;
    const tributary = SLOPE_CONSTRAINTS.find(line => line.id === 'right-tributary')!;
    expect(main.points[0][1]).toBe(0); expect(main.points.at(-1)![1]).toBe(SLOPE_LAYOUT.depth);
    expect(main.points).toContainEqual(tributary.points.at(-1));
    for (const [x, z, elevation] of [...main.points, ...tributary.points]) expect(slopeElevationAt(x, z)).toBeCloseTo(elevation, 7);
    expect(slopeElevationAt(18.1, 41.45)).toBeGreaterThan(slopeElevationAt(48, 43) + 90);
    expect(slopeElevationAt(87.9, 17)).toBeGreaterThan(slopeElevationAt(40.8, 20) + 85);
    expect(slopeElevationAt(74, 47)).toBeGreaterThan(slopeElevationAt(74, 53));
    expect(slopeElevationAt(74, 59)).toBeGreaterThan(slopeElevationAt(74, 53));
  });
  it('honours the approximately traced read contour lines and the exact two spot heights', () => {
    for (const line of SLOPE_CONSTRAINTS.filter(line => line.kind === 'read-contour'))
      for (const [x, z, elevation] of line.points) expect(slopeElevationAt(x, z)).toBeCloseTo(elevation, 8);
    for (const spot of SLOPE_SPOTS) {
      const point = SLOPE_GRID.find(point => point.x === spot.x && point.z === spot.z)!;
      expect(point.elevationM).toBe(spot.elevationM);
      expect(slopeTerrainElevationAt(spot.x, spot.z)).toBeCloseTo(spot.elevationM, 10);
    }
  });
  it('makes every derived contour lie on the very triangulated surface used in 3D', () => {
    expect(SLOPE_CONTOURS.filter(line => line.sourceLabelRead).map(line => line.elevationM)).toEqual([800, 850]);
    for (const line of SLOPE_CONTOURS) for (const path of line.paths) for (const [x, elevation, z] of path) {
      expect(elevation).toBe(line.elevationM);
      expect(slopeTerrainElevationAt(x, z)).toBeCloseTo(elevation, 7);
      for (const phase of [0, .61, 1]) expect(slopeDisplayY(elevation, phase)).toBeCloseTo(slopeDisplayY(slopeTerrainElevationAt(x, z), phase), 7);
    }
    expect(SLOPE_CONTOURS.find(line => line.elevationM === 800)!.paths.flat().length).toBeGreaterThan(100);
  });
  it('builds a fully closed, genuinely thick indexed terrain and no open bottom', () => {
    const mesh = slopeReliefMesh(1), edges = new Map<string, number>();
    expect(mesh.positions.every(Number.isFinite)).toBe(true);
    expect(mesh.positions.length / 3).toBe(SLOPE_GRID.length * 2);
    for (let i = 0; i < mesh.indices.length; i += 3) for (let j = 0; j < 3; j++) {
      const a = mesh.indices[i + j], z = mesh.indices[i + (j + 1) % 3];
      expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThan(mesh.positions.length / 3);
      const key = [a, z].sort((a, z) => a - z).join(':'); edges.set(key, (edges.get(key) ?? 0) + 1);
    }
    expect([...edges.values()].every(value => value === 2)).toBe(true);
    expect(new Set(SLOPE_BOUNDARY_INDICES).size).toBe(SLOPE_BOUNDARY_INDICES.length);
    const flat = slopeReliefMesh(0); expect(flat.indices).toEqual(mesh.indices);
    for (let i = 0; i < mesh.topVertexCount; i++) {
      expect(flat.positions[i * 3 + 1]).toBe(2); expect(mesh.positions[i * 3 + 1]).toBeGreaterThan(2);
      expect(mesh.positions[(i + mesh.topVertexCount) * 3 + 1]).toBe(0);
    }
  });
  it('treats phase solely as observation lift and keeps physical elevations and 6.4m unchanged', () => {
    SLOPE_STOPS.forEach(stop => expect(evaluateSlopeRelief(stop.phase)).toMatchObject({ stageIndex: stop.selection, selection: stop.selection }));
    let last = 0;
    for (const phase of [0, .1, .4, .65, 1]) {
      const state = evaluateSlopeRelief(phase);
      expect(state).toMatchObject({ phase, phaseMeaning: 'plane-to-relief-observation-progress', landformEvolutionSimulated: false,
        relativeHeightM: 6.4, higherSpotId: 'yi', surveyedDEM: false, interpolationIsFixed: true });
      expect(state.points.map(point => point.elevationM)).toEqual([879, 885.4]);
      expect(state.points[0].position[1]).toBeGreaterThanOrEqual(last); last = state.points[0].position[1];
      expect(state.points[1].position[1] - state.points[0].position[1]).toBeCloseTo(6.4 * .235 * phase, 10);
    }
    expect(evaluateSlopeRelief(1).comparison).toMatchObject({ visible: true, verticallyMagnified: true, sameReference: 'jia-879.0m', differenceM: 6.4 });
  });
  it('has deterministic reverse seeking and bounded finite inputs', () => {
    const expected = evaluateSlopeRelief(.48731);
    for (const phase of [1, .2, 0, .95]) evaluateSlopeRelief(phase);
    expect(evaluateSlopeRelief(.48731)).toEqual(expected);
    expect(evaluateSlopeRelief(-4).phase).toBe(0); expect(evaluateSlopeRelief(4).phase).toBe(1);
    for (const invalid of [NaN, Infinity, -Infinity]) expect(evaluateSlopeRelief(invalid).phase).toBe(0);
  });
  it('uses the same exact state in native SVG with keyboard-selectable spots and process stops', () => {
    for (const phase of [0, .4327189, 1]) {
      const svg = slopeReliefSvg(phase), state = evaluateSlopeRelief(phase);
      const embedded = JSON.parse(svg.match(/data-slope-state='([^']+)'/)![1]);
      expect(embedded).toMatchObject({ phase: state.phase, stageIndex: state.stageIndex, points: state.points,
        relativeHeightM: 6.4, sourceContourIntervalM: null, surveyedDEM: false });
      expect(svg.match(/data-slope-node="/g)).toHaveLength(3); expect(svg.match(/data-slope-spot="/g)).toHaveLength(2);
      expect(svg.match(/data-model-selection="2" role="button" tabindex="0"/g)!.length).toBeGreaterThanOrEqual(3);
      expect(svg).not.toContain('<image'); expect(svg).not.toContain('data:image'); expect(svg).not.toContain('data-flat-select');
      expect(svg.match(/<path /g)!.length).toBeLessThan(5);
      expect(svg).toContain('data-slope-terrain-triangles="4368"');
      expect(svg).toContain(state.caption); expect(svg).toContain('竖向夸张'); expect(svg).toContain('不是精确地形复原');
      expect(svg).not.toMatch(/坡度角|侵蚀过程|精确DEM|等高距为10/);
    }
  });
});
describe('raised paper terrain with fixed real Three.js geometry', () => {
  it('provides a closed land body, two direct spot targets, readable paper labels and a short difference ruler', () => {
    const { meshes, motion } = fixture();
    const markers = meshes.filter(mesh => mesh.userData.slopeRole === 'spot-height-marker');
    expect(markers).toHaveLength(2); expect(markers.map(mesh => mesh.userData.slopePointId)).toEqual(['jia', 'yi']);
    expect(markers.every(mesh => mesh.userData.modelInput.selection === 2 && mesh.userData.smallPointTarget)).toBe(true);
    const labels = meshes.filter(mesh => mesh.userData.kind === 'text-label');
    expect(labels.map(mesh => mesh.userData.text)).toEqual(['甲 879.0m', '乙 885.4m', '甲', '乙', '6.4m', '高差放大', '平面', '抬升', '高差']);
    expect(labels.every(mesh => mesh.userData.labelSize[1] >= 8.2 * 3)).toBe(true);
    expect(motion.describe!()).toMatchObject({ kind: 'textbook-contour-relief', originalPagePreserved: true,
      landformEvolutionSimulated: false, surveyedDEM: false, contoursFromSameTriangles: true, relativeHeightM: 6.4 });
  });
  it('keeps actual spot vertices, markers, source elevations and world click locations in sync after seek', () => {
    const { b, motion } = fixture();
    for (const phase of [0, .65, 1, .3, 0]) {
      b.contours.length = 0; motion.update(phase, 0, 1 / 60, false);
      const actual: any = motion.describe!(), state = evaluateSlopeRelief(phase); expect(actual.state).toEqual(state);
      for (const spot of state.points) {
        const marker = actual.spotWorld.find((point: any) => point.id === spot.id);
        const vertex = actual.terrainWorld.spotVertexWorld.find((point: any) => point.id === spot.id);
        const surface = [spot.x * 3, spot.position[1] * 3 + 126, -354 + spot.z * 3];
        closePoint(marker.surfacePoint, surface); closePoint(vertex.point, surface);
        closePoint(marker.point, [surface[0], surface[1] + .9, surface[2]]);
      }
      expect(actual.comparisonWorld.visible).toBe(state.comparison.visible);
      expect(actual.nodeWorld).toHaveLength(3);
    }
  });
  it('uses an XY-plane pull track and exposes stable world coordinates for reverse dragging', () => {
    const { meshes, motion } = fixture(), handle = meshes.find(mesh => mesh.userData.slopeRole === 'phase-handle')!;
    const { kind, track } = handle.userData.modelInput; expect(kind).toBe('phase-track'); expect(track.start[2]).toBe(track.end[2]);
    expect(handle.userData.smallPointTarget).toBe(true);
    for (const phase of [.1, .85, .29, 1, 0]) {
      const point = track.start.map((value: number, index: number) => value + (track.end[index] - value) * phase);
      expect(phaseFromTrackPoint(point[0], point[1], track, 0)).toBeCloseTo(phase, 12);
      motion.update(phase, 1, 1 / 60, true); const actual: any = motion.describe!();
      closePoint(actual.handleWorld, actual.phaseTrackWorld.start.map((value: number, index: number) => value + (actual.phaseTrackWorld.end[index] - value) * phase));
    }
  });
  it('reuses mesh buffers, index buffers and fixed focus rather than reallocating terrain on every frame', () => {
    const { b, meshes, motion } = fixture(), focus = motion.focusBounds!();
    const positions = meshes.map(mesh => mesh.geometry.attributes.position.array), normals = meshes.map(mesh => mesh.geometry.attributes.normal?.array);
    const indices = meshes.map(mesh => mesh.geometry.index?.array), count = meshes.length;
    for (const phase of [1, .5, .1, .7, 1, 0]) {
      b.contours.length = 0; motion.update(phase, 2, 1 / 30, false);
      expect(meshes).toHaveLength(count); expect(motion.focusBounds!()).toEqual(focus);
      expect(motion.describe!().geometryBuffersReused).toBe(true);
      meshes.forEach((mesh, index) => {
        expect(mesh.geometry.attributes.position.array).toBe(positions[index]);
        expect(mesh.geometry.attributes.normal?.array).toBe(normals[index]); expect(mesh.geometry.index?.array).toBe(indices[index]);
      });
      expect(b.contours.length).toBeLessThan(150);
    }
    motion.update(.637, 0, 1 / 30, false); const slow = motion.describe!();
    motion.update(.637, 2, 1 / 144, true); expect(motion.describe!()).toEqual(slow);
  });
});

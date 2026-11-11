import { describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
import type { TextbookGeometry, Vec3 } from '../src/textbook-geometry';
import { phaseFromTrackPoint } from '../src/textbook-model-input';
import { evaluateTyphoon, TYPHOON_BASE_OUTLINE, TYPHOON_COLUMNS, TYPHOON_EYE_DESCENT,
  TYPHOON_EYE_OUTLINE, TYPHOON_LAYOUT, TYPHOON_REFERENCE, TYPHOON_STOPS,
  TYPHOON_WALL_PROFILE, typhoonArrowMeshData, typhoonCloudMesh, typhoonDiagnostics,
  typhoonPathPoint, typhoonPrismMesh, typhoonProject, typhoonSvg,
  type TyphoonMesh, type TyphoonPoint } from '../src/textbook-typhoon-model';

vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildTyphoonWorld } from '../src/textbook-typhoon-world';

function fixture(width = 150) {
  const root = new Three.Group(), meshes: Three.Mesh[] = [];
  const b = {
    width, height: 220, root, meshes,
    pop: { paper: ({ color }: { color: string }) => new Three.MeshBasicMaterial({ color }) },
    mesh(geometry: Three.BufferGeometry, color: string) {
      const mesh = new Three.Mesh(geometry, new Three.MeshBasicMaterial({ color }));
      root.add(mesh); meshes.push(mesh); return mesh;
    },
    label(text: string, at: Vec3, width: number, height: number) {
      const mesh = this.mesh(new Three.PlaneGeometry(width, height), '#f7f1e3');
      mesh.position.set(...at); mesh.userData.kind = 'text-label'; mesh.userData.text = text; return mesh;
    },
    stroke() {}, contour() {}, outline() {}, v(p: Vec3) { return new Three.Vector3(...p); },
  };
  const motion = buildTyphoonWorld(b as unknown as TextbookGeometry);
  return { b, root, meshes, motion };
}

const radius = ([x, , z]: TyphoonPoint) => Math.hypot(x - TYPHOON_LAYOUT.center[0], z - TYPHOON_LAYOUT.center[1]);
const vertex = (mesh: TyphoonMesh, i: number) => new Three.Vector3(...mesh.positions.slice(i * 3, i * 3 + 3));
function assertClosed(mesh: TyphoonMesh) {
  const edges = new Map<string, { count: number; balance: number }>();
  let volume = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const face = mesh.indices.slice(i, i + 3), [a, b, c] = face.map(n => vertex(mesh, n));
    expect(b.clone().sub(a).cross(c.clone().sub(a)).length()).toBeGreaterThan(1e-9);
    volume += a.dot(b.clone().cross(c)) / 6;
    for (let j = 0; j < 3; j++) {
      const a = face[j], b = face[(j + 1) % 3], key = `${Math.min(a, b)}:${Math.max(a, b)}`;
      const edge = edges.get(key) ?? { count: 0, balance: 0 };
      edge.count++; edge.balance += a < b ? 1 : -1; edges.set(key, edge);
    }
  }
  for (const edge of edges.values()) { expect(edge.count).toBe(2); expect(edge.balance).toBe(0); }
  expect(Math.abs(volume)).toBeGreaterThan(.0001);
}

describe('textbook fig.6.5: one idealized mature Northern Hemisphere typhoon', () => {
  it('keeps the four bookmarks on one bounded deterministic reveal, including its final endpoint', () => {
    for (const stop of TYPHOON_STOPS) {
      const state = evaluateTyphoon(stop.phase);
      expect(state.stageIndex).toBe(stop.selection); expect(state.caption).toBe(stop.label);
    }
    expect(evaluateTyphoon(-2)).toEqual(evaluateTyphoon(0));
    expect(evaluateTyphoon(9)).toEqual(evaluateTyphoon(1));
    expect(evaluateTyphoon(NaN)).toEqual(evaluateTyphoon(0));
    expect(evaluateTyphoon(1).endpointRetained).toBe(true);
    const expected = evaluateTyphoon(.62);
    [1, .12, .81, 0].forEach(evaluateTyphoon);
    expect(evaluateTyphoon(.62)).toEqual(expected);
  });

  it('converges counterclockwise when viewed from above with north up', () => {
    for (const { inflow } of TYPHOON_COLUMNS) for (let i = 1; i < inflow.length; i++) {
      const [a, b] = [inflow[i - 1], inflow[i]];
      expect(radius(b)).toBeLessThan(radius(a)); expect(b[1]).toBe(a[1]);
      // Map coordinates are east X and north -Z; positive cross product is CCW.
      const ax = a[0] - 50, ay = 40 - a[2], bx = b[0] - 50, by = 40 - b[2];
      expect(ax * by - ay * bx).toBeGreaterThan(0);
    }
  });

  it('connects the same low-level path to rising eyewall flow and high-level divergence', () => {
    for (const column of TYPHOON_COLUMNS) {
      expect(column.inflow.at(-1)).toEqual(column.ascent[0]);
      column.ascent.at(-1)!.forEach((n, i) => expect(n).toBeCloseTo(column.outflow[0][i], 12));
      for (let i = 1; i < column.ascent.length; i++) expect(column.ascent[i][1]).toBeGreaterThan(column.ascent[i - 1][1]);
      for (let i = 1; i < column.outflow.length; i++) {
        expect(radius(column.outflow[i])).toBeGreaterThan(radius(column.outflow[i - 1]));
        expect(column.outflow[i][1]).toBeGreaterThanOrEqual(column.outflow[i - 1][1]);
      }
    }
  });

  it('keeps eye descent inside the true eye and distinct from the surrounding ascending column', () => {
    for (let i = 0; i < TYPHOON_EYE_DESCENT.length; i++) {
      expect(radius(TYPHOON_EYE_DESCENT[i])).toBeLessThan(TYPHOON_LAYOUT.eyeRadius);
      if (i) expect(TYPHOON_EYE_DESCENT[i][1]).toBeLessThan(TYPHOON_EYE_DESCENT[i - 1][1]);
    }
    expect(TYPHOON_REFERENCE.eyeDescentIsNotAllEyewallAirReturning).toBe(true);
    expect(TYPHOON_REFERENCE.eyeIsRelativelyCloudFree).toBe(true);
    expect(TYPHOON_REFERENCE.cloudParticlesAreWaterDropletsAndIce).toBe(true);
  });

  it('reveals simultaneous motions cumulatively and explicitly excludes genesis, lifecycle and weather readings', () => {
    let previous = [0, 0, 0, 0];
    for (let i = 0; i <= 100; i++) {
      const state = evaluateTyphoon(i / 100), values = Object.values(state.visibility);
      values.forEach((v, k) => { expect(v).toBeGreaterThanOrEqual(previous[k]); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); });
      previous = values;
      expect(state.columns).toBe(TYPHOON_COLUMNS); expect(state.progressMeansElapsedTime).toBe(false);
      expect(state.depictsGenesis).toBe(false); expect(state.depictsLifecycle).toBe(false);
      expect(state.surfaceConvergence && state.eyewallAscent && state.upperDivergence && state.eyeDescent).toBe(true);
    }
    expect(previous).toEqual([1, 1, 1, 1]);
    expect(TYPHOON_REFERENCE.cutawayIsAnActualGapInTheStorm).toBe(false);
    expect(TYPHOON_REFERENCE.measuredWindSpeed || TYPHOON_REFERENCE.forecast).toBe(false);
    expect(evaluateTyphoon(1).text).toContain('不能把本课的揭示顺序当作台风的形成过程');
  });

  it('builds closed cloud annuli and cut faces around an actual unfilled eye', () => {
    for (const levels of [TYPHOON_WALL_PROFILE, TYPHOON_WALL_PROFILE.slice(0, 4), TYPHOON_WALL_PROFILE.slice(3)]) {
      const mesh = typhoonCloudMesh(36, levels); assertClosed(mesh);
      for (let i = 0; i < mesh.positions.length; i += 3) expect(radius(mesh.positions.slice(i, i + 3) as unknown as TyphoonPoint)).toBeGreaterThan(TYPHOON_LAYOUT.eyeRadius);
      // Every face remains outside the eye, not only the vertices of a painted-over solid.
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const centroid = mesh.indices.slice(i, i + 3).map(n => vertex(mesh, n)).reduce((a, b) => a.add(b), new Three.Vector3()).multiplyScalar(1 / 3);
        expect(radius(centroid.toArray() as TyphoonPoint)).toBeGreaterThan(TYPHOON_LAYOUT.eyeRadius);
      }
    }
    assertClosed(typhoonPrismMesh(TYPHOON_BASE_OUTLINE, 0, 2));
    assertClosed(typhoonPrismMesh(TYPHOON_EYE_OUTLINE, 2.05, 2.32));
  });

  it('uses finite closed paper arrow volumes whose head vertices follow the declared field', () => {
    for (const phase of [.03, .15, .25, .34, .5, .63, .75, .87, 1]) {
      for (const arrow of evaluateTyphoon(phase).arrows) if (arrow.reveal > .01) {
        const mesh = typhoonArrowMeshData(arrow); assertClosed(mesh);
        expect(mesh.positions.every(Number.isFinite)).toBe(true);
        const average = mesh.tipVertices.map(i => vertex(mesh, i)).reduce((a, b) => a.add(b), new Three.Vector3()).multiplyScalar(.5);
        arrow.tip.forEach((n, i) => expect(average.toArray()[i]).toBeCloseTo(n, 12));
        expect(arrow.tip).toEqual(typhoonPathPoint(arrow.path, arrow.reveal));
      }
    }
  });

  it('renders the same geometry state in native SVG, with keyboard targets and readable current labels', () => {
    for (const phase of [0, .1, .25, .38, .5, .64, .75, .88, 1]) {
      const svg = typhoonSvg(phase), state = evaluateTyphoon(phase);
      expect(svg).not.toMatch(/<image|data:image|<animate|NaN|Infinity|undefined/);
      expect(JSON.parse(svg.match(/data-typhoon-state='([^']+)'/)![1])).toEqual(typhoonDiagnostics(state));
      expect(svg.match(/data-typhoon-node="\d"/g)).toHaveLength(4);
      expect(svg.match(/tabindex="0"/g)).toHaveLength(5);
      expect(svg).toContain('font-size="30"'); expect(svg).toContain('不是形成过程');
      const [x, y] = typhoonProject(state.labels[0].at);
      expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(620);
      expect(y).toBeGreaterThan(22); expect(y).toBeLessThan(470);
      for (const arrow of state.arrows) if (arrow.reveal > .001) expect(svg).toContain(`data-typhoon-part="${arrow.id}"`);
    }
  });
});

describe('raised paper typhoon and direct interaction', () => {
  it('keeps a genuinely open eye through both sculpted cloud bodies', () => {
    const { root, meshes } = fixture(); root.updateMatrixWorld(true);
    const cloud = meshes.filter(m => ['cloud-eyewall', 'upper-cloud-canopy'].includes(m.userData.typhoonRole));
    const box = new Three.Box3().setFromObject(meshes.find(m => m.userData.typhoonRole === 'eye-footprint')!);
    const center = box.getCenter(new Three.Vector3());
    const ray = new Three.Raycaster(center.clone().add(new Three.Vector3(0, 500, 0)), new Three.Vector3(0, -1, 0));
    expect(ray.intersectObjects(cloud)).toHaveLength(0);
  });
  it('uses real thick cloud, water and arrow geometry above the page, with no diagram image planes', () => {
    const { root, meshes, motion } = fixture(); motion.update(1, 0, 0, false);
    expect(root.position.y).toBeGreaterThan(0);
    for (const role of ['sea-base', 'cloud-eyewall', 'upper-cloud-canopy', 'eye-footprint']) {
      const mesh = meshes.find(m => m.userData.typhoonRole === role)!;
      const a = mesh.geometry.attributes.position;
      assertClosed({ positions: [...a.array], indices: [...mesh.geometry.index!.array] });
    }
    expect(meshes.filter(m => m.userData.typhoonArrowId)).toHaveLength(10);
    expect(meshes.filter(m => m.userData.kind !== 'text-label').every(m => (m.material as Three.MeshBasicMaterial).map === null)).toBe(true);
    const d = motion.describe!(); expect(d.originalPagePreserved).toBe(true); expect(d.freeRunningRotation).toBe(false);
  });

  it('makes the actual cloud, water, eye and revealed flow parts ray-pickable at all four observation nodes', () => {
    const { meshes, motion } = fixture(); motion.update(1, 0, 0, false);
    for (const [role, selection] of [['sea-base', 0], ['cloud-eyewall', 1], ['upper-cloud-canopy', 2], ['eye-footprint', 3]] as const) {
      const mesh = meshes.find(m => m.userData.typhoonRole === role)!;
      expect(mesh.userData.modelInput.kind).toBe('select'); expect(mesh.userData.modelInput.selection).toBe(selection);
      const box = new Three.Box3().setFromObject(mesh), center = box.getCenter(new Three.Vector3());
      const ray = new Three.Raycaster(center.clone().add(new Three.Vector3(0, 500, 0)), new Three.Vector3(0, -1, 0));
      // The cloud centre is deliberately a hole: cast at its solid bounds edge instead.
      if (selection === 1 || selection === 2) ray.ray.origin.x = (box.min.x + center.x) / 2;
      expect(ray.intersectObject(mesh).length).toBeGreaterThan(0);
    }
    expect(new Set(meshes.filter(m => m.userData.typhoonArrowId).map(m => m.userData.modelInput.selection))).toEqual(new Set([0, 1, 2, 3]));
  });

  it('derives the same continuous phase from the raised pull tab and its local and transformed world track', () => {
    const { root, meshes, motion } = fixture(), handle = meshes.find(m => m.userData.typhoonRole === 'phase-handle')!;
    const track = handle.userData.modelInput.track;
    expect(handle.userData.modelInput.kind).toBe('phase-track');
    expect(track.start[2]).toBe(track.end[2]);
    root.position.set(11, 9, -3); root.rotation.y = .2;
    for (const phase of [0, .14, .25, .44, .5, .7, .75, .91, 1, .42]) {
      motion.update(phase, 3, .016, false); const d = motion.describe!() as any;
      expect(phaseFromTrackPoint(handle.position.x, handle.position.y, track, 0)).toBeCloseTo(phase, 12);
      expect(d.handleWorld).toEqual(handle.getWorldPosition(new Three.Vector3()).toArray());
      const interpolated = d.phaseTrackWorld.start.map((n: number, i: number) => n + (d.phaseTrackWorld.end[i] - n) * phase);
      d.handleWorld.forEach((n: number, i: number) => expect(n).toBeCloseTo(interpolated[i], 10));
    }
  });

  it('keeps a constant camera envelope containing every label and visible arrow throughout the reveal', () => {
    const { meshes, motion } = fixture(), bounds = motion.focusBounds!();
    const envelope = new Three.Box3(new Three.Vector3(...bounds.min), new Three.Vector3(...bounds.max));
    for (const phase of [0, .1, .25, .38, .5, .64, .75, .88, 1]) {
      motion.update(phase, 0, .016, false); expect(motion.focusBounds!()).toEqual(bounds);
      for (const mesh of meshes.filter(m => m.visible)) {
        mesh.updateMatrix(); mesh.geometry.computeBoundingBox();
        expect(envelope.containsBox(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrix)), mesh.userData.typhoonRole).toBe(true);
      }
    }
  });

  it('reuses GPU buffers, restores exact geometry after reverse seeking, and reports the actual solid arrowheads', () => {
    const { meshes, motion } = fixture();
    const buffers = meshes.map(m => [m.geometry.uuid, m.geometry.attributes.position.array, m.geometry.index?.array]);
    const signature = () => meshes.map(m => ({ position: m.position.toArray(), visible: m.visible, vertices: [...m.geometry.attributes.position.array] }));
    motion.update(.87, 0, 1 / 60, false); const expected = signature();
    for (const phase of [.11, 1, 0, .75, .87]) motion.update(phase, 3, .5, true);
    expect(signature()).toEqual(expected);
    const d = motion.describe!() as any;
    expect(d.geometryBuffersReused).toBe(true);
    meshes.forEach((mesh, i) => {
      expect(mesh.geometry.uuid).toBe(buffers[i][0]); expect(mesh.geometry.attributes.position.array).toBe(buffers[i][1]);
      expect(mesh.geometry.index?.array).toBe(buffers[i][2]);
    });
    d.arrowWorld.forEach((arrow: any) => arrow.actualTip.forEach((n: number, i: number) => expect(n).toBeCloseTo(arrow.tip[i], 4)));
  });
});

import { describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
import { BASIN_ACCUMULATION_STOPS, INTEGRATED_CONTROLS, INTEGRATED_REFERENCES,
  QUAKE_FLAGS, QUAKE_LAYOUT, basinFloodLevel, basinGround, confirmedRoute, evaluateBasin,
  evaluateCityRain, evaluateIntegrated, evaluateQuakeResponse, integratedRoutePoint,
  integratedSvg, quakeResponseActions } from '../src/textbook-integrated-model';
import { basinSpecimenGround } from '../src/textbook-basin-detail';
import { evaluateUrbanWater } from '../src/textbook-urban-water-model';

vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
vi.mock('../src/geography-pen', () => ({ GeographyPen: class {} }));
import { TextbookGeometry, LIFT_MARGIN, type Vec3 } from '../src/textbook-geometry';
import { buildIntegratedWorld, INTEGRATED_INSPECTIONS } from '../src/textbook-integrated-world';

/** Real Three buffers, meshes and transforms. Only the browser text canvas and
 * ink renderer are replaced; the production terrain/solid constructors run. */
function fixture(effect: string) {
  const root = new Three.Group(), meshes: Three.Mesh[] = [];
  const b: any = {
    width: 300, height: 160, root, meshes,
    pop: { paper: ({ color = '#fff' }: { color?: string }) => new Three.MeshBasicMaterial({ color }) },
    v: (point: Vec3) => new Three.Vector3(...point),
    mesh(geometry: Three.BufferGeometry, color = '#fff') {
      const mesh = new Three.Mesh(geometry, new Three.MeshBasicMaterial({ color, side: Three.DoubleSide }));
      root.add(mesh); meshes.push(mesh); return mesh;
    },
    label(text: string, at: Vec3, width: number, height: number) {
      const mesh = this.mesh(new Three.PlaneGeometry(width, height)); mesh.position.set(...at);
      mesh.userData.kind = 'text-label'; mesh.userData.text = text; return mesh;
    },
    stroke() {}, contour: vi.fn(), outline() {}, ring() {},
  };
  for (const method of ['box', 'prism', 'prismCut', 'sphere', 'cylinder', 'tube', 'terrain', 'tree', 'house'])
    b[method] = (TextbookGeometry.prototype as any)[method];
  const motion = buildIntegratedWorld(b, effect);
  if (!motion) throw Error(`Missing integrated world: ${effect}`);
  return { b, root, meshes, motion };
}
const closePoint = (a: readonly number[], b: readonly number[]) =>
  a.forEach((value, i) => expect(value).toBeCloseTo(b[i], 7));

describe('source-bounded cross-chapter model states', () => {
  it('keeps a finite identifiable batch of water and sediment in each independent basin comparison', () => {
    const ids = evaluateBasin(0).packets.map(packet => packet.id), sandIds = evaluateBasin(0).sediment.map(packet => packet.id);
    for (const selection of [0, 1, 2]) for (let i = 0; i <= 100; i++) {
      const state = evaluateBasin(i / 100, selection);
      expect(state.packets.map(packet => packet.id)).toEqual(ids);
      expect(state.sediment.map(packet => packet.id)).toEqual(sandIds);
      expect([...state.packets, ...state.sediment].flatMap(packet => packet.point).every(Number.isFinite)).toBe(true);
      expect(state.formsEntireValleyInOneStorm).toBe(false);
      expect(state.waterMarkersAreVolumes).toBe(false); expect(state.sedimentMarkersAreMass).toBe(false);
    }
    const final = evaluateBasin(1);
    expect(final.packets.every(packet => packet.complete && packet.compartment === 'sea')).toBe(true);
    expect(final.sediment.filter(packet => packet.status === 'deposited')).toHaveLength(5);
    expect(final.sediment.filter(packet => packet.status === 'exported')).toHaveLength(3);
    expect(evaluateBasin(1, 2).packets.filter(packet => packet.compartment === 'floodplain')).toHaveLength(3);
  });

  it('separates long-term landform accumulation from one rainfall observation', () => {
    for (const phase of [0, .21, .44, .65, .88, 1]) {
      const single = evaluateBasin(phase, 0), long = evaluateBasin(phase, 1);
      expect(single.accumulation).toBe(0); expect(single.timeScale).toBe('本次水路');
      expect(long.timeScale).toBe('长期累积示意'); expect(long.stops).toEqual(BASIN_ACCUMULATION_STOPS);
      expect(long.title).toMatch(/长期|多次|反复|已经存在/);
      expect(long.calibratedTime).toBe(false); expect(long.differentTimeScales).toBe(true);
      expect(long.reference.interpretation).toMatch(/不表示一次降水/);
    }
    expect(evaluateBasin(1, 1).accumulation).toBe(1);
    expect(evaluateBasin(1, 0).floodRise).toBe(0); expect(evaluateBasin(1, 2).floodRise).toBe(1);
  });

  it('uses the established city rainfall state without introducing new rain quantities', () => {
    for (const selection of [0, 1, 2]) for (const phase of [0, .3, .5217, .7, 1]) {
      const actual = evaluateCityRain(phase, selection), original = evaluateUrbanWater(phase, selection);
      expect(actual.packets).toEqual(original.packets); expect(actual.inventory).toEqual(original.inventory);
      expect(Object.values(actual.inventory).reduce((sum, count) => sum + count, 0)).toBe(12);
      expect(actual.sameRainInput && actual.sameCityGeometry).toBe(true);
      expect(actual.unitsAreSchematic).toBe(true);
    }
  });

  it('requires both independent communication and complete verified roads before rescue moves', () => {
    const located = evaluateQuakeResponse(1, 0), communicated = evaluateQuakeResponse(1, 1), verified = evaluateQuakeResponse(1, 2);
    expect(located.positionKnown).toBe(true); expect(located.remoteObserved).toBe(true);
    for (const state of [located, communicated, verified]) {
      expect(state.route).toBeNull(); expect(state.rescueProgress).toBe(0);
      expect(state.vehicle).toEqual(QUAKE_LAYOUT.nodes.a);
    }
    for (const phase of [.1, .29, .49, .58, .68, .71, .85, 1]) for (const selection of [0, 1, 2, 3, 7, 11, 15]) {
      const state = evaluateQuakeResponse(phase, selection);
      if (!state.route) continue;
      expect(state.communicationDelivered).toBe(true);
      for (let i = 1; i < state.route.length; i++) {
        const [a, b] = [state.route[i - 1], state.route[i]];
        const edge = state.roads.find(edge => edge.a === a && edge.b === b || edge.a === b && edge.b === a)!;
        expect(edge.status).toBe('passable'); expect(edge.role).not.toBe('damaged-bridge');
      }
    }
    const completed = evaluateQuakeResponse(1, 3);
    expect(completed.route).toEqual(['a', 'south', 'east', 'town']); closePoint(completed.vehicle, QUAKE_LAYOUT.nodes.town);
    expect(evaluateQuakeResponse(1, 7).route).toEqual(['b', 'north', 'town']);
    expect(evaluateQuakeResponse(1, 7).optimalWarehouseCalculated).toBe(false);
  });

  it('keeps bitmask actions independent, stage gated, and reversible without resetting unrelated evidence', () => {
    expect(INTEGRATED_CONTROLS['quake-response-system']).toEqual([]);
    expect(QUAKE_FLAGS).toEqual({ communication: 1, verified: 2, warehouseB: 4, layers: 8 });
    const actions = quakeResponseActions(13, .3);
    expect(actions.find(action => action.id === 'send')!.enabled).toBe(false);
    expect(actions.find(action => action.id === 'verify')!.enabled).toBe(false);
    for (const selection of [0, 1, 3, 7, 15]) {
      const byId = Object.fromEntries(quakeResponseActions(selection, 1).map(action => [action.id, action]));
      expect(byId.send.selection).toBe(selection | 1); expect(byId.send.replay).toBe(false);
      expect(byId.verify.selection).toBe(selection ^ 2); expect(byId.verify.replay).toBe(false);
      expect(byId.layers.selection).toBe(selection ^ 8);
      expect(byId['warehouse-a'].selection).toBe(selection & ~4); expect(byId['warehouse-a'].replay).toBe(true);
      expect(byId['warehouse-b'].selection).toBe(selection | 4);
    }
  });

  it('never includes unknown, pending, or blocked edges in a confirmed route', () => {
    const roads = evaluateQuakeResponse(1, 3).roads;
    expect(confirmedRoute(roads, 'a', 'town')).not.toBeNull();
    for (const status of ['pending', 'unobserved', 'blocked'] as const) {
      expect(confirmedRoute(roads.map(edge => edge.id === 'south-east' ? { ...edge, status } : edge), 'a', 'town')).toBeNull();
    }
    expect(confirmedRoute(roads, 'missing', 'town')).toBeNull();
    expect(integratedRoutePoint([], .5)).toEqual([0, 0, 0]);
    expect(integratedRoutePoint([[1, 2, 3]], .5)).toEqual([1, 2, 3]);
  });

  it('seeks deterministically, clamps invalid input, and preserves end results', () => {
    for (const effect of ['basin-system', 'city-rain-system', 'quake-response-system']) for (const selection of [0, 1, 2, 3, 15]) {
      const middle = evaluateIntegrated(effect, .637, selection);
      evaluateIntegrated(effect, 1, selection); evaluateIntegrated(effect, 0, selection);
      expect(evaluateIntegrated(effect, .637, selection)).toEqual(middle);
      expect(evaluateIntegrated(effect, -1, selection)).toEqual(evaluateIntegrated(effect, 0, selection));
      expect(evaluateIntegrated(effect, NaN, selection)).toEqual(evaluateIntegrated(effect, 0, selection));
      expect(evaluateIntegrated(effect, 2, selection)).toEqual(evaluateIntegrated(effect, 1, selection));
    }
    expect(evaluateIntegrated('unknown', 1)).toBeNull();
  });

  it('keeps keyboard-ready SVG interactions and scientific limitations consistent with the model', () => {
    for (const effect of ['basin-system', 'city-rain-system', 'quake-response-system']) for (const phase of [0, .5, 1]) {
      const svg = integratedSvg(effect, phase, 3);
      expect(svg).not.toContain('<image'); expect(svg).not.toContain('data:image');
      expect(svg).not.toMatch(/\bNaN\b|\bInfinity\b/); expect(svg).toContain(`data-integrated-effect="${effect}"`);
      expect(svg).toContain('role="button"'); expect(svg).toContain('tabindex="0"');
    }
    const beforeSend = integratedSvg('quake-response-system', 1, 2), afterSend = integratedSvg('quake-response-system', 1, 3);
    expect(beforeSend).toContain('位置尚未送达调度端'); expect(afterSend).toContain('位置已送达调度端');
    expect(beforeSend).toContain('接收机已定位'); expect(beforeSend).toContain('通路待确认，原地等待');
    expect(INTEGRATED_REFERENCES['quake-response-system']).toMatchObject({ realDispatch: false, earthquakePrediction: false, realRoadData: false });
  });
});

describe('actual raised integrated Three.js worlds', () => {
  it('partitions the river-safe relief into closed physical specimens with a shared sculpted surface', () => {
    const { meshes } = fixture('basin-system');
    const surfaces = meshes.filter(mesh => mesh.userData.heightField === 'basinGround');
    expect(surfaces).toHaveLength(5);
    for (const mesh of surfaces) {
      const vertices = mesh.geometry.attributes.position;
      for (let i = 0; i < vertices.count; i++) {
        const x = vertices.getX(i) / 3, z = (vertices.getZ(i) + LIFT_MARGIN + 216) / 3;
        expect(vertices.getY(i) / 3).toBeCloseTo(basinSpecimenGround(x, z), 4);
      }
    }
    expect(meshes.filter(mesh => mesh.userData.integratedRole === 'basin-specimen-bottom')).toHaveLength(5);
    expect(meshes.filter(mesh => mesh.userData.integratedRole === 'basin-drawer-guide')).toHaveLength(6);
    expect(meshes.filter(mesh => mesh.userData.integratedRole === 'basin-moving-guide-shoe')).toHaveLength(12);
  });

  it('moves real front slices on inspection only, preserves water and sediment, and keeps the actuator on its axis', () => {
    const { meshes, root, motion } = fixture('basin-system'); motion.update(.65, 0, 0, true);
    root.updateMatrixWorld(true);
    const actual = motion.describe!() as any, opening = actual.specimenOffsets;
    const markers = meshes.filter(mesh => ['water-marker', 'sediment-grain'].includes(mesh.userData.integratedRole));
    const positions = markers.map(mesh => mesh.getWorldPosition(new Three.Vector3()).toArray());
    const wheel = meshes.find(mesh => mesh.userData.integratedRole === 'basin-section-handwheel')!;
    const center = new Three.Vector3(); wheel.geometry.computeBoundingBox(); wheel.geometry.boundingBox!.getCenter(center);
    const wheelPosition = wheel.localToWorld(center.clone()).toArray();
    motion.inspect!('specimen-closed'); motion.update(.65, 0, 0, true); root.updateMatrixWorld(true);
    expect(motion.describe!().sectionOpening).toBe(0);
    (motion.describe!().specimenOffsets as number[][]).forEach(offset => closePoint(offset, [0, 0, 0]));
    expect(wheel.localToWorld(center.clone()).distanceTo(new Three.Vector3(...wheelPosition))).toBeLessThan(1e-4);
    markers.forEach((mesh, i) => closePoint(mesh.getWorldPosition(new Three.Vector3()).toArray(), positions[i]));
    motion.inspect!('specimen-open'); motion.update(.65, 0, 0, true); root.updateMatrixWorld(true);
    expect(motion.describe!().specimenOffsets).toEqual(opening);
    expect(motion.describe!().specimenMotionIsObservationOnly).toBe(true);
    expect(motion.describe!().geometryBuffersReused).toBe(true);
    const bounds = motion.focusBounds!();
    const front = meshes.filter(mesh => mesh.userData.specimenSlice !== undefined && mesh.userData.heightField);
    for (const mesh of front) {
      const v = mesh.geometry.attributes.position;
      for (let i = 0; i < v.count; i++) {
        const point = new Three.Vector3().fromBufferAttribute(v, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(root.matrixWorld.clone().invert());
        point.toArray().forEach((value, axis) => { expect(value).toBeGreaterThanOrEqual(bounds.min[axis]); expect(value).toBeLessThanOrEqual(bounds.max[axis]); });
      }
    }
  });

  it('closes specimens for the flood surface, and never leaves a full-area flood sheet hovering above an opened cutaway', () => {
    const { motion } = fixture('basin-system');
    motion.update(1, 2, 0, true);
    expect(motion.describe!().sectionOpening).toBe(0); expect(motion.describe!().floodSurfaceVisible).toBe(true);
    const science = evaluateBasin(1, 2);
    motion.inspect!('specimen-open'); motion.update(1, 2, 0, true);
    expect(motion.describe!().sectionOpening).toBe(1); expect(motion.describe!().floodSurfaceVisible).toBe(false);
    expect(motion.describe!().packets).toEqual(science.packets); expect(motion.describe!().floodRise).toBe(science.floodRise);
    motion.inspect!('specimen-closed'); motion.update(1, 2, 0, true);
    expect(motion.describe!().floodSurfaceVisible).toBe(true);
  });

  it('keeps solid geometry and fixed buffers while basin packets follow the pure water/sediment state', () => {
    const { meshes, root, motion } = fixture('basin-system'), count = meshes.length;
    const buffers = meshes.map(mesh => mesh.geometry.attributes.position.array);
    for (const selection of [0, 2, 1, 0]) for (const phase of [0, .3, .7, 1, .2, 1]) {
      motion.update(phase, selection, 1 / 60, false); root.updateMatrixWorld(true);
      const state = evaluateBasin(phase, selection), actual = motion.describe!() as any;
      expect(actual.geometryBuffersReused).toBe(true); expect(meshes).toHaveLength(count);
      meshes.forEach((mesh, i) => expect(mesh.geometry.attributes.position.array).toBe(buffers[i]));
      for (const [role, packets] of [['water-marker', state.packets], ['sediment-grain', state.sediment]] as const) {
        const markers = meshes.filter(mesh => mesh.userData.integratedRole === role);
        expect(markers).toHaveLength(packets.length);
        markers.forEach((mesh, i) => closePoint(mesh.position.toArray(), [packets[i].point[0] * 3, packets[i].point[1] * 3, -LIFT_MARGIN - 216 + packets[i].point[2] * 3]));
      }
    }
    expect(meshes.some(mesh => mesh.geometry.type === 'TubeGeometry')).toBe(true);
    expect(meshes.filter(mesh => mesh.userData.kind !== 'text-label').every(mesh => !(mesh.material as Three.MeshBasicMaterial).map)).toBe(true);
    motion.inspect!('sediment'); motion.update(.95, 0, 0, true); expect(motion.describe!().inspection).toBe('sediment');
  });

  it('clips actual flood triangles to local terrain and gives them finite drawn-only bounds', () => {
    const { meshes, motion } = fixture('basin-system'); motion.update(1, 2, 0, true);
    const flood = meshes.find(mesh => mesh.userData.integratedRole === 'terrain-clipped-floodwater')!;
    expect(flood.visible).toBe(true); const geometry = flood.geometry, positions = geometry.attributes.position;
    expect(geometry.drawRange.count).toBeGreaterThan(0);
    for (let i = 0; i < geometry.drawRange.count; i++) {
      const x = positions.getX(i) / 3, y = positions.getY(i) / 3, z = (positions.getZ(i) + LIFT_MARGIN + 216) / 3;
      expect(y).toBeCloseTo(basinFloodLevel(x, 1) + .08, 4);
      // A clipping edge interpolates the gridded terrain, not an analytic
      // infinitely fine terrain. Keep the check at its declared mesh scale.
      expect(basinGround(x, z) - y).toBeLessThan(.65);
    }
    expect(geometry.boundingBox!.max.z).toBeLessThan(0);
    motion.update(.2, 0, 0, true); expect(flood.visible).toBe(false);
  });

  it('opens the same city side on real hinges without moving rain packets or duplicating the street', () => {
    const { meshes, motion } = fixture('city-rain-system'); motion.update(.72, 2, 0, true);
    const before = motion.describe!() as any, markers = meshes.filter(mesh => mesh.userData.urbanRole === 'water-packet');
    expect(markers).toHaveLength(12); const positions = markers.map(mesh => mesh.position.toArray());
    const panels = meshes.filter(mesh => mesh.userData.integratedRole === 'hinged-underground-side');
    expect(panels).toHaveLength(3);
    motion.inspect!('underground'); motion.update(.72, 2, 0, true);
    const opened = motion.describe!() as any;
    expect(opened.reusedOriginalRainWorld).toBe(true); expect(opened.repeatedCityCount).toBe(1);
    expect(opened.packets).toEqual(before.packets); expect(opened.inventory).toEqual(before.inventory);
    panels.forEach(mesh => expect(mesh.rotation.x).toBe(Math.PI / 2));
    markers.forEach((mesh, i) => expect(mesh.position.toArray()).toEqual(positions[i]));
    motion.inspect!('overview'); motion.update(.72, 2, 0, true); panels.forEach(mesh => expect(mesh.rotation.x).toBe(0));
    expect(motion.describe!().geometryBuffersReused).toBe(true);
  });

  it('keeps the vehicle waiting on uncertainty, then drives its physical parts along the same verified route', () => {
    const { meshes, motion } = fixture('quake-response-system');
    const truck = meshes.find(mesh => mesh.userData.integratedRole === 'rescue-truck')!;
    motion.update(1, 0, 0, true); const waiting = truck.position.toArray();
    motion.update(1, 1, 0, true); expect(truck.position.toArray()).toEqual(waiting);
    motion.update(1, 2, 0, true); expect(truck.position.toArray()).toEqual(waiting);
    motion.update(1, 3, 0, true);
    closePoint(truck.position.toArray(), [88 * 3, (3 + 1.7) * 3, -LIFT_MARGIN - 216 + 40 * 3]);
    const forward = truck.position.toArray(); motion.update(.4, 0, 0, true); expect(truck.position.toArray()).toEqual(waiting);
    motion.update(1, 3, 1 / 144, false); expect(truck.position.toArray()).toEqual(forward);
    expect(motion.describe!().geometryBuffersReused).toBe(true);
    expect(meshes.filter(mesh => mesh.userData.integratedRole === 'truck-wheel')).toHaveLength(4);
    const definitions = meshes.filter(mesh => mesh.userData.actionId === 'verify');
    expect(definitions.length).toBeGreaterThan(0); definitions.forEach(mesh => expect(mesh.userData.modelInput.selection).toBe(1));
  });

  it('offers real inspection destinations and preserves horizontal map registration while separating layers', () => {
    for (const effect of ['basin-system', 'city-rain-system', 'quake-response-system'] as const) {
      const { motion } = fixture(effect);
      for (const { target } of INTEGRATED_INSPECTIONS[effect]) {
        motion.inspect!(target); motion.update(.8, 3, 0, true);
        expect(motion.describe!().inspection).toBe(target);
        const bounds = motion.focusBounds!(); expect([...bounds.min, ...bounds.max].every(Number.isFinite)).toBe(true);
        expect(bounds.max.every((value, axis) => value > bounds.min[axis])).toBe(true);
      }
    }
    const { meshes, motion } = fixture('quake-response-system');
    const edges = meshes.filter(mesh => mesh.userData.integratedRole === 'map-layer-edge');
    motion.update(.8, 3, 0, true); const xy = edges.map(mesh => [mesh.position.x, mesh.position.z]);
    motion.update(.8, 11, 0, true);
    edges.forEach((mesh, i) => { expect([mesh.position.x, mesh.position.z]).toEqual(xy[i]); expect(mesh.visible).toBe(true); });
    expect(motion.describe!().mapLayerHeights).toEqual([18, 28, 38]);
  });
});

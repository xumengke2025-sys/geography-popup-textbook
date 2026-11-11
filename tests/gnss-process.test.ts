import { describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
import { GNSS_LAYOUT, GNSS_REFERENCE, GNSS_STOPS, evaluateGnss, gnssProject,
  gnssRoadPoint, gnssSegmentClearance, gnssSvg, gnssVehiclePoint, type GnssPoint } from '../src/textbook-gnss-model';
import { phaseFromTrackPoint } from '../src/textbook-model-input';
import type { TextbookGeometry, Vec3 } from '../src/textbook-geometry';
vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildGnssWorld } from '../src/textbook-gnss-world';

function fixture() {
  const meshes: Three.Mesh[] = [], root = new Three.Group(), contours: Vec3[][] = [];
  const b = {
    width: 300, height: 150, root, meshes,
    pop: { paper: ({ color = '#fff' }: { color?: string }) => new Three.MeshBasicMaterial({ color }) },
    mesh(geometry: Three.BufferGeometry, color = '#fff') {
      const mesh = new Three.Mesh(geometry, new Three.MeshBasicMaterial({ color })); root.add(mesh); meshes.push(mesh); return mesh;
    },
    label(text: string, at: Vec3, width: number, height: number) {
      const mesh = this.mesh(new Three.PlaneGeometry(width, height)); mesh.position.set(...at);
      mesh.userData.kind = 'text-label'; mesh.userData.text = text; mesh.userData.labelSize = [width, height]; return mesh;
    },
    stroke() {}, outline() {}, contour(points: Vec3[]) { contours.push(points); },
  };
  return { b, meshes, contours, motion: buildGnssWorld(b as unknown as TextbookGeometry) };
}
const norm = (point: number[]) => Math.hypot(...point);
const dot = (a: number[], b: number[]) => a.reduce((v, c, i) => v + c * b[i], 0);
const closePoint = (a: number[], b: number[], digits = 7) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits));

describe('GNSS is a continuous three-part explanation followed by independent communication', () => {
  it('preserves the textbook scope without inventing an algorithm, precise coordinates or a generic distress transmitter', () => {
    expect(GNSS_REFERENCE).toMatchObject({ printedPages: [114, 116], pdfPages: [119, 121],
      actualConstellationCount: false, actualOrbits: false, positioningAlgorithm: false,
      solvedCoordinates: false, accuracyCalculated: false, passiveReceiverCanTransmitDistress: false,
      independentCommunicationRequired: true, eachFixRequiresThisMonitoringSequence: false });
    expect(GNSS_STOPS.map(stop => stop.label)).toEqual(['卫星与地面', '接收定位', '定位助救援']);
    expect(GNSS_STOPS.map(stop => stop.selection)).toEqual([0, 1, 2]);
    expect(evaluateGnss(.75).explanation).toContain('须具备发送能力');
  });
  it('derives the selected node from one bounded phase and retains the complete endpoint', () => {
    for (const [phase, selection] of [[0, 0], [.3399, 0], [.34, 1], [.6799, 1], [.68, 2], [1, 2]]) {
      expect(evaluateGnss(phase)).toMatchObject({ phase, stage: selection, stageIndex: selection, selection });
    }
    expect(evaluateGnss(-1)).toEqual(evaluateGnss(0)); expect(evaluateGnss(19)).toEqual(evaluateGnss(1));
    expect(evaluateGnss(NaN)).toEqual(evaluateGnss(0));
    const done = evaluateGnss(1);
    expect(done.signals.every(s => s.status === 'arrived')).toBe(true);
    expect(done.positionReady).toBe(true); expect(done.positionMark).toBe(1);
    expect(done.communicationDelivered).toBe(true); expect(done.rescue.progress).toBe(1);
  });
  it('keeps each signal identity while its front advances once, arrives and remains arrived', () => {
    const ids = evaluateGnss(0).signals.map(signal => signal.id), previous = new Map<string, number>();
    for (let i = 0; i <= 200; i++) {
      const state = evaluateGnss(i / 200); expect(state.signals.map(signal => signal.id)).toEqual(ids);
      for (const signal of state.signals) {
        expect(signal.progress).toBeGreaterThanOrEqual(previous.get(signal.id) ?? 0); previous.set(signal.id, signal.progress);
        closePoint(signal.point, signal.source.map((v, j) => v + (signal.target[j] - v) * signal.progress));
        if (signal.status === 'waiting') expect(signal.path).toEqual([]);
        else closePoint(signal.path.at(-1)!, signal.point);
      }
    }
  });
  it('puts all four navigation links and both monitoring directions above the solid Earth horizon', () => {
    const signals = evaluateGnss(1).signals;
    for (const signal of signals) {
      expect(gnssSegmentClearance(signal.source, signal.target), signal.id).toBeGreaterThan(.5);
      for (const phase of [0, .03, .10, .20, .36, .44, .52, .71, .78, 1]) {
        const current = evaluateGnss(phase).signals.find(s => s.id === signal.id)!;
        expect(norm(current.point.map((v, i) => v - GNSS_LAYOUT.earth.center[i]))).toBeGreaterThan(GNSS_LAYOUT.earth.radius);
      }
    }
  });
  it('lets monitoring information arrive before the illustrated return contact and keeps navigation one-way', () => {
    const [down, up] = evaluateGnss(1).signals;
    expect(down.end).toBeLessThan(up.start); closePoint(down.source, up.target); closePoint(down.target, up.source);
    for (const signal of evaluateGnss(1).signals.filter(s => s.kind === 'navigation')) {
      expect(GNSS_LAYOUT.satellites).toContainEqual(signal.source);
      expect(signal.target[0]).toBe(GNSS_LAYOUT.receiver[0]);
    }
  });
  it('receives navigation signals before the position result, sends that position separately, then moves the rescue vehicle', () => {
    const navigationArrival = Math.max(...evaluateGnss(1).signals.filter(s => s.kind === 'navigation').map(s => s.end));
    expect(evaluateGnss(navigationArrival).positionMark).toBe(0);
    expect(evaluateGnss(.62).receivedSignalIds).toEqual(['nav-0', 'nav-1', 'nav-2', 'nav-3']);
    for (const phase of [0, .4, .6, .69, .79, .84, .86]) expect(evaluateGnss(phase).rescue.progress).toBe(0);
    const message = evaluateGnss(.8).signals.find(s => s.kind === 'communication')!;
    expect(evaluateGnss(message.start).positionReady).toBe(true);
    expect(message.source).not.toEqual(evaluateGnss(.8).signals.find(s => s.kind === 'navigation')!.target);
    expect(evaluateGnss(.9).communicationDelivered).toBe(true); expect(evaluateGnss(.9).rescue.progress).toBeGreaterThan(0);
  });
  it('follows an exterior curved road with a consistent vehicle tangent and ground normal', () => {
    let distance = Infinity;
    for (let i = 0; i <= 100; i++) {
      const state = evaluateGnss(.86 + i * .14 / 100), vehicle = state.rescue;
      expect(norm(vehicle.position.map((v, j) => v - GNSS_LAYOUT.earth.center[j]))).toBeCloseTo(22.6, 9);
      expect(norm(vehicle.up)).toBeCloseTo(1, 9); expect(norm(vehicle.forward)).toBeCloseTo(1, 9); expect(norm(vehicle.side)).toBeCloseTo(1, 9);
      expect(dot(vehicle.up, vehicle.forward)).toBeCloseTo(0, 9); expect(dot(vehicle.up, vehicle.side)).toBeCloseTo(0, 9);
      const next = norm(vehicle.position.map((v, j) => v - GNSS_LAYOUT.receiver[j]));
      expect(next).toBeLessThanOrEqual(distance + 1e-10); distance = next;
      closePoint(vehicle.position, gnssRoadPoint(vehicle.progress));
    }
    for (const point of evaluateGnss(1).road) expect(norm(point.map((v, j) => v - GNSS_LAYOUT.earth.center[j]))).toBeGreaterThan(22);
  });
  it('seeks backward or forward deterministically and does not accumulate a different result after replay', () => {
    const expected = evaluateGnss(.786);
    for (const phase of [1, 0, .9, .2, .786]) evaluateGnss(phase);
    expect(evaluateGnss(.786)).toEqual(expected);
  });
});

describe('real raised paper GNSS geometry and direct manipulation', () => {
  it('keeps the whole system and rescue apparatus present at phase zero, with only results and tracers gated', () => {
    const { meshes, motion } = fixture();
    for (const role of ['earth', 'ground-monitor', 'user-receiver', 'independent-communication-device', 'rescue-station', 'rescue-vehicle-body']) {
      expect(meshes.find(mesh => mesh.userData.gnssRole === role)?.visible, role).toBe(true);
    }
    expect(meshes.filter(mesh => mesh.userData.gnssRole === 'satellite-body')).toHaveLength(4);
    expect(meshes.filter(mesh => mesh.userData.gnssRole === 'signal-tracer').some(mesh => mesh.visible)).toBe(false);
    expect(meshes.find(mesh => mesh.userData.gnssRole === 'position-result-pin')?.visible).toBe(false);
    expect(motion.describe!()).toMatchObject({ kind: 'gnss-three-segments', completeStructureAlwaysPresent: true,
      passiveReceiverTransmitsDistress: false, displayedSatellites: 4 });
  });
  it('drives actual tracer meshes and diagnostics from exactly the shared state, independently of selection', () => {
    const { meshes, motion } = fixture();
    for (const phase of [.08, .21, .40, .51, .59, .77, .93, 1]) {
      motion.update(phase, 99, 1 / 30, false);
      const state = evaluateGnss(phase), actual: any = motion.describe!();
      expect(actual.state).toEqual(state); expect(actual.selection).toBe(state.selection);
      for (const signal of state.signals) {
        const tracer = meshes.find(mesh => mesh.userData.gnssRole === 'signal-tracer' && mesh.userData.gnssId === signal.id)!;
        closePoint(tracer.position.toArray(), [signal.point[0] * 3, signal.point[1] * 3, -342 + signal.point[2] * 3]);
        expect(tracer.visible).toBe(signal.status === 'moving');
        const diagnostic = actual.linkWorld.find((link: any) => link.id === signal.id);
        expect(diagnostic.earthClearance).toBeCloseTo(gnssSegmentClearance(signal.source, signal.target) * 3, 9);
      }
    }
  });
  it('moves the same closed vehicle body and cabin along the curved road, then retains them at the target', () => {
    const { meshes, motion } = fixture();
    const body = meshes.find(mesh => mesh.userData.gnssRole === 'rescue-vehicle-body')!;
    for (const phase of [0, .87, .92, 1, .5, 1]) {
      motion.update(phase, 0, 1 / 60, false);
      const state = evaluateGnss(phase), expected = gnssVehiclePoint(state.rescue, [0, 1, 0]);
      closePoint(body.position.toArray(), [expected[0] * 3, expected[1] * 3, -342 + expected[2] * 3]);
      expect(body.geometry.type).toBe('BoxGeometry'); expect(body.visible).toBe(true);
    }
    const road = meshes.find(mesh => mesh.userData.gnssRole === 'rescue-road')!;
    expect(road.geometry.type).toBe('TubeGeometry');
    const positions = road.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const point = [positions.getX(i) / 3, positions.getY(i) / 3, (positions.getZ(i) + 342) / 3];
      expect(norm(point.map((v, j) => v - GNSS_LAYOUT.earth.center[j]))).toBeGreaterThan(22);
    }
  });
  it('exposes the three phase nodes on real entities and short legible labels', () => {
    const { meshes, motion } = fixture();
    const labels = meshes.filter(mesh => mesh.userData.gnssRole === 'node-label');
    expect(labels).toHaveLength(4); expect(new Set(labels.map(mesh => mesh.userData.modelInput.selection))).toEqual(new Set([0, 1, 2]));
    expect(labels.every(mesh => mesh.userData.labelSize[1] === 9.2 * 3)).toBe(true);
    for (const [role, selection] of [['ground-monitor', 0], ['user-receiver', 1], ['independent-communication-device', 2], ['rescue-vehicle-body', 2]]) {
      expect(meshes.find(mesh => mesh.userData.gnssRole === role)!.userData.modelInput).toMatchObject({ kind: 'select', selection });
    }
    meshes.filter(mesh => mesh.userData.gnssRole === 'satellite-body').forEach((mesh, i) => expect(mesh.userData.modelInput).toMatchObject({ kind: 'inspect', target: `sat-${i}`, toggleTo: 'overview' }));
    expect((motion.describe!() as any).nodeStops).toEqual(GNSS_STOPS);
  });
  it('makes the process front a stable XY-plane phase handle with matching world coordinates', () => {
    const { meshes, motion } = fixture(), front = meshes.find(mesh => mesh.userData.gnssRole === 'process-front')!;
    const input = front.userData.modelInput;
    expect(input.kind).toBe('phase-track'); expect(input.track.start[2]).toBe(input.track.end[2]);
    expect(front.userData.smallPointTarget).toBe(true);
    for (const phase of [0, .32, .79, 1, .2]) {
      motion.update(phase, 0, 1 / 60, false);
      expect(phaseFromTrackPoint(front.position.x, front.position.y, input.track, 0)).toBeCloseTo(phase, 10);
      const actual: any = motion.describe!();
      closePoint(actual.handleWorld, actual.phaseTrackWorld.start.map((v: number, i: number) => v + (actual.phaseTrackWorld.end[i] - v) * phase));
    }
  });
  it('reuses its physical geometry and focus across frames, modes and repeated backward seeks', () => {
    const { meshes, motion } = fixture(), count = meshes.length, focus = motion.focusBounds!();
    const arrays = meshes.map(mesh => mesh.geometry.attributes.position.array), indices = meshes.map(mesh => mesh.geometry.index?.array);
    for (const phase of [0, .37, .95, 1, .6, .2, 1]) {
      motion.update(phase, 0, 1 / 30, false); const slow = motion.describe!();
      motion.update(phase, 2, 1 / 144, true); expect(motion.describe!()).toEqual(slow);
      expect(meshes).toHaveLength(count); expect(motion.focusBounds!()).toEqual(focus);
      expect(motion.describe!().geometryBuffersReused).toBe(true);
      meshes.forEach((mesh, i) => { expect(mesh.geometry.attributes.position.array).toBe(arrays[i]); expect(mesh.geometry.index?.array).toBe(indices[i]); });
    }
  });
});

describe('native SVG is another view of the same GNSS state', () => {
  it('keeps the structure, nodes and signal fronts consistent rather than switching illustrations', () => {
    for (const phase of [0, .08, .42, .61, .78, 1]) {
      const state = evaluateGnss(phase), svg = gnssSvg(phase, 99);
      expect(svg).toBe(gnssSvg(phase, -1)); expect(svg).toContain(`data-gnss-phase="${state.phase}"`);
      expect(svg).toContain(`data-gnss-stage="${state.stage}"`); expect(svg).toContain(`data-gnss-selection="${state.selection}"`);
      expect(svg.match(/data-gnss-satellite="/g)).toHaveLength(4); expect(svg.match(/data-gnss-node="/g)).toHaveLength(4);
      expect(svg).toContain('data-gnss-vehicle="rescue-vehicle"'); expect(svg).toContain('data-gnss-process-front="true"');
      expect(svg).toContain(state.caption); expect(svg).toContain('定位接收与求救通信分开');
      expect(svg).not.toMatch(/<image\b|data:image|NaN|Infinity|undefined/);
      for (const signal of state.signals) {
        expect(svg.includes(`data-gnss-tracer="${signal.id}"`)).toBe(signal.status === 'moving');
        expect(svg.includes(`data-gnss-link="${signal.id}"`)).toBe(signal.path.length > 0);
        if (signal.path.length) expect(svg).toContain(`M${gnssProject(signal.source).join(',')}L${gnssProject(signal.point).join(',')}`);
      }
    }
  });
  it('keeps short node labels within the SVG viewport and separate from each other', () => {
    const boxes = GNSS_LAYOUT.labels.map(label => { const [x, y] = gnssProject(label.position); return { x: x - 84, y: y - 23, width: 168, height: 46 }; });
    for (const box of boxes) { expect(box.x).toBeGreaterThan(0); expect(box.y).toBeGreaterThan(0); expect(box.x + box.width).toBeLessThan(720); expect(box.y + box.height).toBeLessThan(550); }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
    }
  });
  it('holds the received-position and rescue result until an explicit replay', () => {
    expect(gnssSvg(1)).toBe(gnssSvg(18)); expect(gnssSvg(0)).not.toBe(gnssSvg(1));
    expect(gnssSvg(0)).not.toContain('data-gnss-position="known"'); expect(gnssSvg(1)).toContain('data-gnss-position="known"');
    expect(gnssSvg(1).match(/data-gnss-link="/g)).toHaveLength(7);
  });
});

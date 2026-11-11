import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint } from './textbook-model-input';
import { GNSS_LAYOUT, GNSS_REFERENCE, GNSS_STOPS, evaluateGnss, gnssGlobeLines,
  gnssSegmentClearance, gnssVehiclePoint, evaluateGnssInspection, type GnssPoint } from './textbook-gnss-model';

/** A continuous paper globe: the complete system stays in place. Signals
 * travel once, arrive, and only then permit the location/communication/result
 * marks. Navigation arrows never double as distress uplinks. */
export function buildGnssWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, back = -LIFT_MARGIN - 82 * s, rise = 40 * s;
  const p = ([x, y, z]: readonly number[]): Vec3 => [x * s, y * s, back + z * s];
  b.root.position.set(0, rise, 0);
  const materials = new Map<string, any>();
  const material = (color: string) => {
    if (!materials.has(color)) {
      const mat = createSpecimenMaterial(b.pop, { color, ink: '#626558', spacing: 2.8, hatch: .045, shade: .10, seed: 624 + materials.size });
      mat.side = T.DoubleSide; materials.set(color, mat);
    }
    return materials.get(color);
  };
  const solid = (geometry: any, color: string, role: string) => {
    const mesh = b.mesh(geometry, color, false); mesh.material = material(color); mesh.userData.gnssRole = role; return mesh;
  };
  const select = (mesh: any, selection: number, label: string) => {
    mesh.userData.modelInput = { kind: 'select', selection, label }; return mesh;
  };
  const box = (center: GnssPoint, size: GnssPoint, color: string, role: string) => {
    const mesh = solid(new T.BoxGeometry(...size.map(v => v * s)), color, role); mesh.position.set(...p(center)); return mesh;
  };
  const sphere = (point: GnssPoint, radius: number, color: string, role: string) => {
    const mesh = solid(new T.SphereGeometry(radius * s, 20, 14), color, role); mesh.position.set(...p(point)); return mesh;
  };
  const plus = (point: GnssPoint, offset: GnssPoint): GnssPoint => point.map((v, i) => v + offset[i]) as GnssPoint;
  const stem = (point: GnssPoint, height: number, radius: number, color: string, role: string) => {
    const mesh = solid(new T.CylinderGeometry(radius * s, radius * s, height * s, 12), color, role);
    mesh.position.set(...p(plus(point, [0, height / 2, 0]))); return mesh;
  };

  const globe = solid(new T.SphereGeometry(GNSS_LAYOUT.earth.radius * s, 40, 28), '#adc5c5', 'earth');
  globe.position.set(...p(GNSS_LAYOUT.earth.center));
  box([47, .8, 25], [18, 1.6, 12], '#d8ccb3', 'globe-foot');
  stem([47, 1.5, 25], 4.5, .65, '#aa936f', 'globe-stand');
  for (const line of gnssGlobeLines()) b.stroke(line.map(p), .27);

  const satellites = GNSS_LAYOUT.satellites.map((at, i) => {
    const body = select(box(at, [3.3, 3.2, 3.2], '#eee5d2', 'satellite-body'), 0, '查看卫星与地面监控的联系');
    const observe = { kind: 'inspect', target: `sat-${i}`, toggleTo: 'overview', label: `查看卫星${i + 1}到用户的接收链路，保持过程时刻` };
    body.userData.modelInput = observe;
    body.userData.gnssId = `sat-${i}`;
    const wings = [-1, 1].map(side => {
      const wing = select(box(plus(at, [side * 5.3, 0, 0]), [6, .6, 3.5], '#6e94a0', 'satellite-panel'), 0, '查看卫星星座');
      wing.userData.modelInput = observe;
      // Fine panel cells are structure, not luminous decoration.
      for (const x of [-1.7, 0, 1.7]) {
        const center = plus(at, [side * 5.3 + x, .34, 0]);
        b.stroke([p(plus(center, [0, 0, -1.6])), p(plus(center, [0, 0, 1.6]))], .19);
      }
      return wing;
    });
    stem(plus(at, [0, -2.1, 0]), .5, .36, '#a08d6c', 'satellite-antenna');
    return { body, wings };
  });

  const monitor = GNSS_LAYOUT.monitor;
  const monitorBox = select(box(plus(monitor, [0, 1.1, 0]), [5, 2.2, 4], '#ded2bb', 'ground-monitor'), 0, '查看地面监控部分');
  stem(plus(monitor, [0, 2, 0]), 2.2, .17, '#9a8f76', 'ground-antenna');
  const dishProfile = [[0, .12], [.55, .22], [1.1, .51], [1.5, .94], [1.5, 1.08], [1.1, .65], [.55, .36], [0, .26]];
  const dish = select(solid(new T.LatheGeometry(dishProfile.map(([r, y]) => new T.Vector2(r * s, y * s)), 20), '#f1e6d2', 'monitor-dish'), 0, '查看地面监控与卫星联系');
  dish.position.set(...p(plus(monitor, [0, 3, 0]))); dish.rotation.z = -.32;
  const monitorLight = sphere(plus(monitor, [1.8, 2.5, 1.3]), .38, '#8c9a7d', 'monitor-status');

  const receiver = GNSS_LAYOUT.receiver;
  const receiverBox = select(box(plus(receiver, [0, 1.4, 0]), [2.5, 2.8, 1.5], '#f1e8d6', 'user-receiver'), 1, '查看用户接收与定位');
  box(plus(receiver, [0, 1.7, .8]), [1.6, 1.3, .13], '#6e94a0', 'receiver-screen');
  stem(plus(receiver, [0, 2.5, 0]), 1.5, .12, '#8f8267', 'receiver-antenna');
  const leds = GNSS_LAYOUT.satellites.map((_, i) => sphere(plus(receiver, [-.75 + i * .5, .75, .85]), .22, '#6d8c70', 'received-signal-led'));
  const communication = select(box(plus(receiver, [2.4, 1.4, 0]), [1.4, 2.7, 1], '#b98b5f', 'independent-communication-device'), 2, '定位信息经独立通信设备发送');
  stem(plus(receiver, [2.4, 2.7, 0]), .8, .10, '#8f7858', 'communication-antenna');

  const base = GNSS_LAYOUT.rescueBase;
  const baseBox = select(box(plus(base, [0, 1.1, 0]), [4, 2.2, 3], '#d8c5a6', 'rescue-station'), 2, '查看收到位置后的救援行动');
  stem(plus(base, [0, 2, 0]), 2.2, .15, '#9b815d', 'rescue-station-antenna');
  const baseLight = sphere(plus(base, [0, 4.4, 0]), .4, '#b98b5f', 'message-received-light');

  let state = evaluateGnss(0), inspection = 'overview';
  const roadCurve = new T.CatmullRomCurve3(state.road.map(point => new T.Vector3(...p(point))), false, 'catmullrom', .15);
  const road = select(solid(new T.TubeGeometry(roadCurve, 48, .46 * s, 6, false), '#e5dcc8', 'rescue-road'), 2, '收到位置信息后沿示意路线接近目标');
  b.stroke(state.road.filter((_, i) => i % 2 === 0).map(p), .24);
  const vehicleParts = [
    { local: [0, 1, 0] as GnssPoint, mesh: solid(new T.BoxGeometry(4 * s, 1.5 * s, 2.4 * s), '#b98b5f', 'rescue-vehicle-body') },
    { local: [-.35, 2.05, 0] as GnssPoint, mesh: solid(new T.BoxGeometry(1.8 * s, 1 * s, 2.1 * s), '#f0e7d6', 'rescue-vehicle-cabin') },
    ...[-1.3, 1.3].flatMap(x => [-1.25, 1.25].map(z => {
      const geometry = new T.CylinderGeometry(.53 * s, .53 * s, .35 * s, 12); geometry.rotateX(Math.PI / 2);
      return { local: [x, .52, z] as GnssPoint, mesh: solid(geometry, '#676a5d', 'rescue-vehicle-wheel') };
    })),
  ];
  for (const part of vehicleParts) select(part.mesh, 2, '查看依据收到位置前往目标的救援车');

  const positionPin = solid(new T.ConeGeometry(.65 * s, 1.7 * s, 14), '#aa744c', 'position-result-pin');
  positionPin.rotation.z = Math.PI;
  const signals = state.signals.map(signal => {
    const color = signal.kind === 'communication' ? '#b38152' : signal.kind === 'navigation' ? '#648e99' : '#869780';
    const mesh = sphere(signal.source, .52, color, 'signal-tracer'); mesh.userData.gnssId = signal.id; return mesh;
  });
  const labels = GNSS_LAYOUT.labels.map(spec => {
    const mesh = select(b.label(spec.text, p(spec.position), spec.width * s, 9.2 * s), spec.selection, GNSS_STOPS[spec.selection].label);
    mesh.userData.gnssRole = 'node-label'; mesh.userData.gnssSelection = spec.selection; return mesh;
  });

  // A quiet front edge on the globe's stand carries the overall process. Its
  // fixed XY plane remains a stable direct manipulation target in any view.
  const track = { start: p(GNSS_LAYOUT.track.start), end: p(GNSS_LAYOUT.track.end) };
  b.stroke([track.start, track.end], .36);
  const front = solid(new T.SphereGeometry(1.05 * s, 14, 10), '#a97b4d', 'process-front');
  front.userData.smallPointTarget = true;
  front.userData.modelInput = { kind: 'phase-track', track, label: '拖动过程前缘，连续回看卫星、接收和救援' };
  const fixedMeshCount = b.meshes.length, buffers = b.meshes.map(mesh => mesh.geometry.attributes.position.array);
  const basis = new T.Matrix4();
  const motion: ModelMotion = {
    update(phase) {
      state = evaluateGnss(phase);
      const observation = evaluateGnssInspection(phase, inspection);
      if (observation.signal) for (let i = 0; i < 24; i += 2) b.contour([i, i + 1].map(q => observation.signal!.source.map((value, axis) => value + (observation.signal!.target[axis] - value) * q / 24) as GnssPoint).map(p), .32);
      state.signals.forEach((signal, i) => {
        const mesh = signals[i]; mesh.position.set(...p(signal.point)); mesh.visible = signal.status === 'moving';
        const focused = signal.kind === 'communication' ? state.selection === 2
          : signal.kind === 'navigation' ? state.selection === 1 : state.selection === 0;
        if (signal.path.length) b.contour(signal.path.map(p), observation.signal ? signal.id === observation.signal.id ? 1.08 : .16 : focused ? .82 : .28);
      });
      monitorLight.visible = state.signals[0].status === 'arrived'; baseLight.visible = state.communicationDelivered;
      leds.forEach((led, i) => { led.visible = state.receivedSignalIds.includes(`nav-${i}`); });
      for (const led of leds) if (led.visible) b.outline(led, state.selection === 1 ? .45 : .24);
      if (monitorLight.visible) b.outline(monitorLight, .42);
      if (baseLight.visible) b.outline(baseLight, .48);
      positionPin.visible = state.positionMark > 0;
      positionPin.position.set(...p(plus(receiver, [0, 5.2 + state.positionMark * 2.5, 0])));
      positionPin.scale.y = Math.max(.01, state.positionMark);
      const vehicle = state.rescue;
      basis.makeBasis(new T.Vector3(...vehicle.forward), new T.Vector3(...vehicle.up), new T.Vector3(...vehicle.side));
      vehicleParts.forEach(part => {
        part.mesh.position.set(...p(gnssVehiclePoint(vehicle, part.local))); part.mesh.quaternion.setFromRotationMatrix(basis); b.outline(part.mesh, .30);
      });
      front.position.set(...phaseTrackPoint(state.phase, track));
      b.contour([track.start, p(state.front)], .8);
      labels.forEach((label, i) => { label.userData.gnssActive = GNSS_LAYOUT.labels[i].selection === state.selection; });
      for (const [i, satellite] of satellites.entries()) { const chosen = i === observation.satellite; b.outline(satellite.body, chosen ? .85 : .35); for (const panel of satellite.wings) b.outline(panel, chosen ? .6 : .28); }
      for (const mesh of [monitorBox, dish, receiverBox, communication, baseBox]) b.outline(mesh, .35);
    },
    inspect(target) { inspection = evaluateGnssInspection(0, target).inspection; },
    focusBounds: () => ({ min: p([-12, -3, -3]), max: p([109, 92, 77]) }),
    describe: () => {
      b.root.updateWorldMatrix(true, true);
      const world = (point: Vec3): Vec3 => new T.Vector3(...point).applyMatrix4(b.root.matrixWorld).toArray() as Vec3;
      const meshWorld = (mesh: any): Vec3 => mesh.getWorldPosition(new T.Vector3()).toArray() as Vec3;
      return { kind: 'gnss-three-segments', phase: state.phase, stage: state.stage, stageIndex: state.stageIndex,
        inspection, observation: evaluateGnssInspection(state.phase, inspection),
        selection: state.selection, mode: state.selection, state, caption: state.caption, explanation: state.explanation,
        source: GNSS_REFERENCE, segments: ['space', 'ground-control', 'user'], displayedSatellites: 4,
        completeStructureAlwaysPresent: true, constellationCountIsSchematic: true,
        communicationRequiredForDistress: true, passiveReceiverTransmitsDistress: false,
        solvedCoordinates: false, accuracyCalculated: false, actualOrbits: false,
        earthWorld: { center: meshWorld(globe), radius: GNSS_LAYOUT.earth.radius * s },
        satelliteWorld: satellites.map((satellite, i) => ({ id: `sat-${i}`, point: meshWorld(satellite.body) })),
        receiverWorld: world(p(receiver)), monitorWorld: world(p(monitor)), rescueBaseWorld: world(p(base)),
        linkWorld: state.signals.map(signal => ({ id: signal.id, kind: signal.kind, status: signal.status,
          source: world(p(signal.source)), target: world(p(signal.target)), point: world(p(signal.point)),
          earthClearance: gnssSegmentClearance(signal.source, signal.target) * s })),
        vehicleWorld: { id: state.rescue.id, progress: state.rescue.progress, point: world(p(state.rescue.position)),
          up: state.rescue.up, forward: state.rescue.forward },
        roadWorld: state.road.map(point => world(p(point))), nodeStops: GNSS_STOPS,
        nodeWorld: labels.map((mesh, i) => ({ selection: GNSS_LAYOUT.labels[i].selection, point: meshWorld(mesh) })),
        handleWorld: meshWorld(front), phaseTrackWorld: { start: world(track.start), end: world(track.end) },
        geometryBuffersReused: b.meshes.length === fixedMeshCount && b.meshes.every((mesh, i) => mesh.geometry.attributes.position.array === buffers[i]),
        elevatedAbovePage: rise, directInteraction: 'segment-click-and-process-front-drag',
      };
    },
  };
  motion.update(0, 0, 0, true); return motion;
}

import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { evaluateDesalination } from './textbook-desalination-model';
import { createInstrumentParts, chamferedPlateGeometry, mergeInstrumentGeometry } from './textbook-instrument-parts';

/** A turned, thick-walled section. The open wedge is a teaching cutaway,
 * never an open side of a real centrifuge. End faces close the solid wall. */
export function sectionedVesselGeometry(profile: readonly (readonly [number, number])[], start: number, arc: number) {
  const shell = new T.LatheGeometry(profile.map(([r, h]) => new T.Vector2(r, h)), 64, start, arc);
  const contours = profile.map(([r, h]) => new T.Vector2(r, h));
  const faces = T.ShapeUtils.triangulateShape(contours, []), caps: number[] = [];
  for (const angle of [start, start + arc]) for (const face of faces) {
    const order = angle === start ? face : [...face].reverse();
    for (const i of order) { const [r, h] = profile[i]; caps.push(r * Math.sin(angle), h, r * Math.cos(angle)); }
  }
  const ends = new T.BufferGeometry(); ends.setAttribute('position', new T.Float32BufferAttribute(caps, 3)); ends.computeVertexNormals();
  return mergeInstrumentGeometry([shell, ends]);
}

/** Deliberately faceted fracture, not a rounded plastic cube. */
function iceFragmentGeometry(s: number, id: number) {
  const shape = new T.Shape();
  const points = [[-3.5, -2.6], [1.8, -3.1], [3.8, -.8], [2.5, 2.9], [-2.6, 3.2], [-3.8, .4]];
  points.forEach(([x, y], i) => i ? shape.lineTo(x * s, y * s) : shape.moveTo(x * s, y * s)); shape.closePath();
  const geometry = new T.ExtrudeGeometry(shape, { depth: (4.1 + id % 3 * .35) * s, bevelEnabled: true,
    bevelThickness: .5 * s, bevelSize: .45 * s, bevelSegments: 1, steps: 1 });
  geometry.translate(0, 0, -2.4 * s); geometry.rotateX(-Math.PI / 2); return geometry;
}

function cleavedIceGeometry(left: number, high: number, s: number, back: number, id: number) {
  const footprint = [[left + .8, 28.4], [left + 6.9, 27.6], [left + 8.1, 29.6],
    [left + 7.6, 50.4], [left + 6.5, 52.9], [left + .5, 52.8], [left - .2, 50.7], [left - .1, 31]];
  const positions: number[] = [];
  const heights = [high - 1.7, high - .7, high - 1, high - 2.2, high - 1.1, high - 2.7, high - 3, high - 2.6];
  const point = (i: number, top: boolean) => [footprint[i][0] * s, (top ? heights[i] : 20.3) * s, back + footprint[i][1] * s];
  const tri = (a: number[], c: number[], d: number[]) => positions.push(...a, ...c, ...d);
  const center = [(left + 3.7) * s, (high + .8 - id % 2 * .7) * s, back + 39 * s];
  for (let i = 0; i < footprint.length; i++) {
    const j = (i + 1) % footprint.length;
    tri(point(i, false), point(j, false), point(j, true)); tri(point(i, false), point(j, true), point(i, true));
    tri(center, point(i, true), point(j, true));
    tri([(left + 3.7) * s, 20.3 * s, back + 39 * s], point(j, false), point(i, false));
  }
  const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals(); return geometry;
}

/** Two method-specific mechanisms share only the collector and the existing
 * deterministic brine state. No new operating parameters or water claims. */
export function buildDesalinationInstrumentWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, back = -LIFT_MARGIN - 78 * s;
  const at = (x: number, y: number, z: number): Vec3 => [x * s, y * s, back + z * s];
  const root = b.root, parts = createInstrumentParts(b), made: any[] = [];
  const mesh = (geometry: any, color: string, role: any, name: string, parent = root) => {
    const object = b.mesh(geometry, color, false, true, role); object.name = name;
    object.userData.desalinationRole = name; parent.add(object); made.push(object); return object;
  };
  const plate = (a: Vec3, c: Vec3, color: string, role: any, name: string, parent = root) =>
    mesh(chamferedPlateGeometry(at(...a), at(...c), .24 * s), color, role, name, parent);
  // Walnut under-edge, painted chassis, thin brass rebate. Their dimensions
  // describe the same enclosure instead of three unrelated stacked plinths.
  plate([13, -.9, 17], [91, .3, 68], '#544534', 'wood', 'collector-walnut-underedge');
  plate([13.7, .3, 17.7], [90.3, 1, 67.3], '#a88b50', 'brass', 'collector-rebate');
  plate([14.3, 1, 18.3], [89.7, 3.8, 66.7], '#293c37', 'enamel', 'collector-chassis');
  // Four walls, a real recessed floor and an uninterrupted open top. The
  // collector includes every endpoint of the unchanged salt-rich pockets.
  plate([17, 3.8, 24], [83, 4.5, 64], '#adb5af', 'steel', 'collector-floor');
  for (const [a, c] of [ [[16.7, 3.8, 23.7], [83.3, 9.2, 25]],
    [[16.7, 3.8, 25], [18, 9.2, 63]], [[82, 3.8, 25], [83.3, 9.2, 63]],
    [[16.7, 3.8, 62.8], [83.3, 5.3, 64]] ] as [Vec3, Vec3][])
    plate(a, c, '#adb5af', 'steel', 'collector-thick-wall');
  parts.fasteners([[20, 3.85, 21], [79, 3.85, 21], [20, 3.85, 65], [79, 3.85, 65]].map(p => at(...p as Vec3)), [0, 1, 0], .65 * s);
  const brine = mesh(chamferedPlateGeometry(at(18.2, 4.55, 25.2), at(81.8, 5.35, 62.5), .06 * s),
    '#78938b', 'water', 'collected-salt-rich-water');

  const draining = new T.Group(), spinning = new T.Group();
  draining.name = 'gravity-drain-assembly'; spinning.name = 'cutaway-centrifuge-assembly'; root.add(draining, spinning);
  const gp = createInstrumentParts(b, draining), cp = createInstrumentParts(b, spinning);
  // Drain rack: an actual supported open grate leaves the drainage path free.
  for (const x of [30, 70]) for (const z of [29, 50]) {
    gp.plate(at(x - 2, 8.9, z - 2), at(x + 2, 10, z + 2), 'brass', .2 * s);
    gp.shaft(at(x, 9.7, z), at(x, 20, z), .54 * s, 'steel');
    gp.bearing(at(x, 19.6, z), [0, 1, 0], 1.1 * s, 1.5 * s);
  }
  const grate: any[] = [];
  for (let x = 30; x <= 70; x += 2.5)
    grate.push(chamferedPlateGeometry(at(x - .22, 19.5, 27), at(x + .22, 20, 54.5), .1 * s));
  for (const z of [27, 54]) grate.push(chamferedPlateGeometry(at(29, 19, z - .4), at(71, 20.2, z + .4), .16 * s));
  mesh(mergeInstrumentGeometry(grate), '#929b98', 'steel', 'open-drain-grate', draining);
  // Cleaved slab front exposes the liquid pockets without depicting salt
  // crystals or hiding the pockets in an opaque rectangular block.
  const iceSlab: any[] = [];
  for (let i = 0; i < 4; i++) {
    const left = 33 + i * 8.3, high = 35.5 + [0, 1.3, .4, -.5][i];
    const piece = mesh(cleavedIceGeometry(left, high, s, back, i), '#d6e3dc', 'ivory', 'cleaved-sea-ice', draining);
    iceSlab.push(piece);
  }
  // Bearing housings sit behind the section, with a true continuous axle.
  cp.plate(at(44, 3.9, 20), at(56, 7, 28), 'steel', .3 * s);
  cp.shaft(at(50, 6, 24), at(50, 16, 24), 2 * s, 'steel');
  cp.shaft(at(50, 14, 24), at(50, 14, 39), 1.35 * s, 'steel');
  for (const y of [8, 12.5]) cp.bearing(at(50, y, 24), [0, 1, 0], 3.1 * s, 2.1 * s);
  const arcStart = .32 * Math.PI, arc = 1.36 * Math.PI;
  const drumGeo = sectionedVesselGeometry([[18.5, 12], [20.5, 12], [21, 13], [21, 36], [20.3, 37], [19, 37], [18.5, 36]], arcStart, arc);
  drumGeo.scale(s, s, s); drumGeo.translate(...at(50, 0, 39));
  const drum = mesh(drumGeo, '#293c37', 'enamel', 'sectioned-centrifuge-guard', spinning);
  drum.userData.teachingCutaway = true;
  for (const a of [Math.PI * .47, Math.PI, Math.PI * 1.53]) {
    const x = 50 + Math.sin(a) * 20, z = 39 + Math.cos(a) * 20;
    cp.plate(at(x - 2, 8.7, z - 2), at(x + 2, 9.9, z + 2), 'brass', .2 * s);
    cp.shaft(at(x, 9.6, z), at(x, 13.5, z), 1.1 * s, 'steel');
  }
  cp.bearing(at(50, 12.5, 39), [0, 1, 0], 2.4 * s, 2.8 * s);
  const rimGeometries: any[] = [];
  for (const y of [12.5, 36.7]) {
    const curve = new T.CatmullRomCurve3(Array.from({ length: 65 }, (_, i) => {
      const a = arcStart + arc * i / 64; return b.v(at(50 + Math.sin(a) * 20.25, y, 39 + Math.cos(a) * 20.25));
    }));
    rimGeometries.push(new T.TubeGeometry(curve, 64, .36 * s, 6, false));
  }
  mesh(mergeInstrumentGeometry(rimGeometries), '#a88b50', 'brass', 'guard-rolled-rims', spinning);
  const rotor = new T.Group(); rotor.name = 'bearing-driven-rotor'; rotor.position.set(...at(50, 0, 39)); spinning.add(rotor);
  const rp = createInstrumentParts(b, rotor);
  rp.shaft([0, 10 * s, 0], [0, 35 * s, 0], 1.05 * s, 'steel');
  rp.bearing([0, 13.3 * s, 0], [0, 1, 0], 2.4 * s, 2 * s);
  const basket: any[] = [];
  for (let i = 0; i < 32; i++) {
    const a = i * Math.PI / 16, x = Math.sin(a) * 15.5 * s, z = Math.cos(a) * 15.5 * s;
    const rod = new T.CylinderGeometry(.17 * s, .17 * s, 19.5 * s, 6); rod.translate(x, 24 * s, z); basket.push(rod);
  }
  for (const y of [14.3, 34]) { const ring = new T.TorusGeometry(15.5 * s, .35 * s, 6, 64); ring.rotateX(Math.PI / 2); ring.translate(0, y * s, 0); basket.push(ring); }
  const basketMesh = mesh(mergeInstrumentGeometry(basket), '#929b98', 'steel', 'perforated-spinning-basket', rotor);
  basketMesh.userData.movingWithAxle = true;
  // A side crank shares the spindle's angular input; it is also the replay
  // handle. No decorative free-running gear or unrelated fake dial.
  cp.plate(at(74, 3.9, 34), at(85, 8, 44), 'steel', .4 * s);
  cp.shaft(at(67, 13, 39), at(81, 13, 39), 1.2 * s, 'steel');
  cp.bearing(at(77, 13, 39), [1, 0, 0], 2.8 * s, 4 * s);
  const crank = new T.Group(); crank.position.set(...at(81, 13, 39)); spinning.add(crank);
  const crankParts = createInstrumentParts(b, crank);
  crankParts.shaft([0, 0, 0], [0, 7 * s, 0], .65 * s, 'brass');
  const handle = crankParts.knob([3 * s, 7 * s, 0], [1, 0, 0], 1.3 * s, 5 * s);
  handle.traverse((o: any) => { if (o.isMesh) {
    o.userData.modelInput = { kind: 'replay', selection: 1, label: '从头观察破碎离心与盐水收集' };
    o.userData.desalinationNativeControl = true;
  } });
  const fragments = Array.from({ length: 9 }, (_, i) => {
    const piece = mesh(iceFragmentGeometry(s, i), '#d6e3dc', 'ivory', 'fractured-sea-ice', spinning);
    piece.userData.modelInput = { kind: 'replay', selection: 1, label: '从头观察破碎离心' }; return piece;
  });
  for (const slab of iceSlab) slab.userData.modelInput = { kind: 'replay', selection: 0, label: '从头观察重力排盐' };
  // One identity per pocket, with unchanged positions read by both renderers.
  const pockets = Array.from({ length: 16 }, (_, i) => {
    const object = mesh(new T.SphereGeometry(.68 * s, 10, 7), '#b6a56b', 'water', 'salt-rich-brine-pocket');
    object.userData.brinePocketId = i; return object;
  });
  b.label('海冰', at(22, 38, 38), 10 * s, 4.8 * s);
  b.label('盐水收集', at(75, 8, 69), 18 * s, 4.8 * s);
  let state = evaluateDesalination(0);
  return {
    update(phase, selection) {
      state = evaluateDesalination(phase, selection);
      draining.visible = state.mode === 0; spinning.visible = state.mode === 1;
      const angle = state.phase * Math.PI * 4;
      rotor.rotation.y = -angle; crank.rotation.x = angle;
      brine.scale.y = 1 + state.progress * 2.5;
      // Keep the lower face exactly seated on the collector floor.
      brine.position.y = 4.55 * s * (1 - brine.scale.y);
      fragments.forEach((piece, i) => {
        const a = i / 9 * Math.PI * 2 + angle, r = 6 + i % 3 * 2.4;
        piece.position.set(...at(50 + Math.cos(a) * r, 19 + i % 3 * 4, 39 + Math.sin(a) * r * .8));
        piece.rotation.y = -a;
      });
      pockets.forEach((object, i) => { object.position.set(...at(...state.pockets[i].point)); object.userData.collected = state.pockets[i].inCollector; });
    },
    describe: () => ({ kind: 'sea-ice-desalination', method: state.mode ? 'crushing-and-centrifuging' : 'gravity-draining', progress: state.progress,
      retainedBrinePockets: state.retainedBrinePockets, collectedPockets: state.collectedPockets, brinePockets: state.pockets,
      separatedBrineCollected: state.separatedBrineCollected, potableWaterClaim: false, operatingParameters: 'not-simulated',
      specimenConstruction: 'supported-drain-rack-and-bearing-driven-cutaway-centrifuge',
      rotorAngle: -state.phase * Math.PI * 4, cutawayIsTeachingView: true, pocketPositionsUnchanged: true, selfSupported: true }),
  };
}

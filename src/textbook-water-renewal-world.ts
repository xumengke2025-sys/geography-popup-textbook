import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { createInstrumentParts } from './textbook-instrument-parts';
import { phaseTrackPoint, type ModelInput } from './textbook-model-input';
import type { SolidMaterialRole } from './textbook-solid-materials';
import { evaluateWaterRenewal } from './textbook-water-renewal-model';

/** Open-topped water-budget instrument: one retained storage, real plumbing,
 * an observable receiver and a sample tap. The pane is an actual local window,
 * not a transparent enclosure around the whole lesson. */
export function buildWaterRenewalWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, originZ = -LIFT_MARGIN - b.height * .48;
  const p = (x: number, y: number, z = 0): Vec3 => [x * s, y * s, originZ + z * s];
  const parts = createInstrumentParts(b);
  const tag = (mesh: any, role: string) => { mesh.userData.waterRenewalRole = role; return mesh; };
  const input = (node: any, action: ModelInput) => {
    node.traverse((mesh: any) => { if (mesh.isMesh) { mesh.userData.modelInput = action; mesh.userData.interactionFeedback = false; } });
    return node;
  };
  const solid = (geometry: any, color: string, material: SolidMaterialRole, role: string, parent = b.root) => {
    const mesh = b.mesh(geometry, color, false, true, material);
    // Filled water volumes receive vessel shadows but do not self-project their
    // closed cylinder onto the surface or inspection pane.
    if (material === 'water') { mesh.castShadow = false; mesh.userData.castShadow = false; }
    parent.add(mesh); return tag(mesh, role);
  };
  const cylinder = (x: number, y: number, z: number, radius: number, height: number, color: string, material: SolidMaterialRole, role: string) => {
    const mesh = solid(new T.CylinderGeometry(radius * s, radius * s, height * s, 48), color, material, role);
    mesh.position.set(...p(x, y, z)); return mesh;
  };
  const ring = (x: number, y: number, z: number, radius: number, tube: number, color: string, material: SolidMaterialRole, role: string) => {
    const mesh = solid(new T.TorusGeometry(radius * s, tube * s, 8, 64), color, material, role);
    mesh.rotation.x = Math.PI / 2; mesh.position.set(...p(x, y, z)); return mesh;
  };
  // Four closed faces around a real empty central bore. End faces are retained
  // when a vessel sector is replaced by its small inspection pane.
  const vesselWall = (cx: number, cz: number, inner: number, outer: number, low: number, high: number,
    start: number, angle: number, color: string, material: SolidMaterialRole, role: string) => {
    const count = Math.max(12, Math.ceil(angle * 14)), vertices: number[] = [], indices: number[] = [];
    const profile = [[outer, low], [outer, high], [inner, high], [inner, low]];
    for (let i = 0; i <= count; i++) {
      const a = start + angle * i / count;
      for (const [r, y] of profile) vertices.push(...p(cx + Math.sin(a) * r, y, cz + Math.cos(a) * r));
      if (i < count) for (let j = 0; j < 4; j++) {
        const a = i * 4 + j, c = i * 4 + (j + 1) % 4;
        indices.push(a, c, a + 4, c, c + 4, a + 4);
      }
    }
    if (angle < Math.PI * 2 - .001) for (const k of [0, count * 4]) indices.push(k, k + 2, k + 1, k, k + 3, k + 2);
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const mesh = solid(geometry, color, material, role);
    mesh.userData.openTop = true; mesh.userData.innerRadius = inner * s; mesh.userData.wallThickness = (outer - inner) * s;
    return mesh;
  };
  const tube = (points: number[][], radius: number, color: string, material: SolidMaterialRole, role: string) => {
    const curve = new T.CatmullRomCurve3(points.map(at => new T.Vector3(...p(at[0], at[1], at[2] ?? 0))));
    const mesh = solid(new T.TubeGeometry(curve, 56, radius * s, 12, false), color, material, role);
    mesh.userData.hollowPipe = true; return { mesh, curve };
  };
  const markParts = (node: any, role: string) => node.traverse((mesh: any) => { if (mesh.isMesh) tag(mesh, role); });
  const balanced: ModelInput = { kind: 'replay', selection: 0, label: '从同一初始水位观察补给与取用相当' };
  const overdraw: ModelInput = { kind: 'replay', selection: 1, label: '从同一初始水位观察取用超过补给' };
  const polluted: ModelInput = { kind: 'replay', selection: 2, label: '比较水量仍在、污染影响可用性的情形' };

  // One shallow instrument bed carries all three objects. The main tank's
  // bearing blocks touch both the bed and the underside of its retained floor.
  parts.plate(p(3, 0, -24), p(98, 1.4, 32), 'wood');
  parts.plate(p(3.6, 1.4, -23.4), p(97.4, 1.68, 31.4), 'brass');
  const deck = solid(new T.BoxGeometry(92 * s, .45 * s, 52.6 * s), '#29443e', 'enamel', 'instrument-deck');
  deck.position.set(...p(50.5, 1.91, 4));
  parts.fasteners([p(6, 2.18, -20), p(95, 2.18, -20), p(6, 2.18, 28), p(95, 2.18, 28)], [0, 1, 0], .42 * s);
  for (const x of [36, 62]) for (const z of [-13, 7]) {
    parts.plate(p(x - 2.9, 2.15, z - 2.5), p(x + 2.9, 3.2, z + 2.5), 'steel');
    parts.shaft(p(x, 3.2, z), p(x, 12.9, z), 1.05 * s, 'steel');
    parts.bearing(p(x, 10.8, z), [0, 1, 0], 1.6 * s, 3.6 * s);
    parts.plate(p(x - 2.3, 12.5, z - 1.9), p(x + 2.3, 13.2, z + 1.9), 'brass');
  }
  cylinder(49, 13.6, -3, 18.8, 1.25, '#3d5750', 'enamel', 'retained-tank-floor');
  const tank = vesselWall(49, -3, 17.15, 18.65, 14.2, 40.5, .92, Math.PI * 2 - 1.84,
    '#d3d8ca', 'enamel', 'open-reservoir-wall'); input(tank, overdraw);
  const pane = vesselWall(49, -3, 17.3, 17.52, 14.2, 40.5, -.92, 1.84,
    '#d7e7e1', 'air', 'reservoir-inspection-pane');
  pane.material.opacity = .12; pane.material.transparent = true; pane.material.depthWrite = false;
  pane.castShadow = false; pane.userData.isObservationWindow = true;
  for (const a of [-.92, .92]) {
    const x = 49 + Math.sin(a) * 17.65, z = -3 + Math.cos(a) * 17.65;
    const jamb = parts.shaft(p(x, 14.2, z), p(x, 40.7, z), .6 * s, 'brass'); tag(jamb, 'window-jamb');
  }
  ring(49, 40.65, -3, 17.95, .62, '#a88b50', 'brass', 'open-reservoir-mouth');
  ring(49, 14.25, -3, 18, .43, '#a88b50', 'brass', 'reservoir-lower-gasket');
  const reservoir = cylinder(49, 14.4, -3, 16.85, 1, '#699fa5', 'water', 'stored-water');
  // A fixed initial mark is anchored to both sides of the actual window.
  for (const side of [-1, 1]) {
    const x = 49 + side * 12.4, z = 9.45;
    const datum = parts.plate(p(x - 1.25, 31.84, z), p(x + 1.25, 32.05, z + .55), 'ivory');
    tag(datum, 'initial-water-level-reference'); datum.userData.initialNormalizedLevel = .7;
  }
  const float = cylinder(53, 32, 7, 1.7, .52, '#e4d9b9', 'ivory', 'surface-float');
  input(float, overdraw);

  // Constant-head boundary supply, a real open header and a free-falling inlet.
  parts.plate(p(8, 2.1, -11), p(18, 3.3, 1), 'steel');
  parts.shaft(p(13, 3.3, -5), p(13, 43.15, -5), 1.5 * s, 'steel');
  parts.bearing(p(13, 7, -5), [0, 1, 0], 2.3 * s, 5 * s);
  cylinder(13, 43.75, -5, 7.3, 1.4, '#39564d', 'enamel', 'supply-header-floor');
  const supplyWall = vesselWall(13, -5, 6.3, 7.25, 44.4, 51.7, 0, Math.PI * 2, '#d7d9ca', 'enamel', 'open-boundary-supply');
  input(supplyWall, balanced);
  ring(13, 51.7, -5, 6.78, .5, '#a88b50', 'brass', 'supply-header-mouth');
  cylinder(13, 46.5, -5, 6.13, 3.8, '#7caab0', 'water', 'boundary-supply-water');
  const inlet = tube([[19.4, 45.4, -5], [24, 45.4, -5], [32, 45.4, -5], [37, 45.4, -4], [38, 43, -3]],
    .92, '#929b98', 'steel', 'inlet-plumbing'); input(inlet.mesh, balanced);
  ring(38, 42.95, -3, .91, .22, '#a88b50', 'brass', 'inlet-open-nozzle');
  for (const x of [22, 31]) {
    parts.bearing(p(x, 45.4, -5), [1, 0, 0], 1.3 * s, 1.4 * s);
  }

  // The take-off is below the lowest retained water level. Every delivery end
  // is below the tank floor, so no unsupported uphill gravity pipe is implied.
  const outlet = tube([[67, 15.4, -3], [72, 15.4, -3], [79, 15.4, -3], [84, 15.4, -3], [84, 12.7, -3]],
    1, '#929b98', 'steel', 'withdrawal-plumbing'); input(outlet.mesh, overdraw);
  for (const x of [68.4, 73.5, 80]) parts.bearing(p(x, 15.4, -3), [1, 0, 0], 1.42 * s, 1.7 * s);
  ring(84, 12.66, -3, 1, .23, '#a88b50', 'brass', 'withdrawal-open-nozzle');
  cylinder(84, 3, -3, 9, 1.7, '#3c5750', 'enamel', 'receiver-floor');
  const receiverWall = vesselWall(84, -3, 8.0, 8.85, 3.85, 11.9, .95, Math.PI * 2 - 1.9,
    '#d3d8ca', 'enamel', 'open-receiving-cup'); input(receiverWall, overdraw);
  const receiverPane = vesselWall(84, -3, 8.08, 8.26, 3.85, 11.9, -.95, 1.9,
    '#d7e7e1', 'air', 'receiver-inspection-pane');
  receiverPane.material.opacity = .12; receiverPane.material.transparent = true; receiverPane.material.depthWrite = false; receiverPane.castShadow = false;
  ring(84, 11.95, -3, 8.45, .4, '#a88b50', 'brass', 'receiver-open-mouth');
  const receivedWater = cylinder(84, 3.9, -3, 7.8, 1, '#699fa5', 'water', 'received-water');

  // A stem physically joins the wheel to its valve body. The angular setting
  // is a teaching condition selector, not a calibrated flow/pressure dial.
  const valve = new T.Group(); valve.position.set(...p(73.5, 20.7, 1.5)); b.root.add(valve);
  parts.shaft(p(73.5, 15.4, -3), p(73.5, 20.7, -3), .75 * s, 'steel');
  parts.shaft(p(73.5, 20.7, -3), p(73.5, 20.7, 1.5), .6 * s, 'steel');
  const valveRing = solid(new T.TorusGeometry(3.2 * s, .43 * s, 8, 40), '#a88b50', 'brass', 'withdrawal-valve-wheel', valve);
  for (const a of [0, Math.PI / 3, Math.PI * 2 / 3]) {
    const spoke = solid(new T.CylinderGeometry(.22 * s, .22 * s, 5.7 * s, 12), '#a88b50', 'brass', 'withdrawal-valve-spoke', valve);
    spoke.rotation.z = a;
  }
  const hub = solid(new T.CylinderGeometry(.9 * s, .9 * s, 1.4 * s, 24), '#929b98', 'steel', 'withdrawal-valve-hub', valve); hub.rotation.x = Math.PI / 2;
  input(valve, overdraw);

  // A real tap branches through the tank's front wall into a small sample cup.
  // Its quality marker changes with the SAME stored water; it does not inject
  // a pollutant or suggest that amber colour measures drinking-water safety.
  tube([[49, 16, 14.4], [49, 16, 20.5], [49, 10.7, 20.5]], .55, '#929b98', 'steel', 'sampling-tap');
  const sample = vesselWall(49, 20.5, 2.65, 3.15, 3, 10.2, .85, Math.PI * 2 - 1.7, '#d3d8ca', 'enamel', 'sample-cup');
  cylinder(49, 2.6, 20.5, 3.25, .8, '#3c5750', 'enamel', 'sample-floor');
  ring(49, 10.25, 20.5, 2.95, .28, '#a88b50', 'brass', 'sample-open-mouth');
  const sampleWater = cylinder(49, 5, 20.5, 2.55, 3.6, '#699fa5', 'water', 'water-quality-sample');
  input(sample, polluted); input(sampleWater, polluted);
  const sampleHandle = parts.knob(p(54.2, 6.5, 21), [0, 0, 1], 1.7 * s, 1.1 * s);
  markParts(sampleHandle, 'quality-sample-selector'); input(sampleHandle, polluted);
  parts.shaft(p(52, 6.5, 21), p(54.2, 6.5, 21), .45 * s, 'steel');

  const track = { start: p(24, 5, 28), end: p(74, 5, 28) };
  const trackMesh = parts.shaft(track.start, track.end, .38 * s, 'steel'); tag(trackMesh, 'observation-rail');
  for (const x of [24, 74]) {
    parts.plate(p(x - 1.5, 2.15, 26.6), p(x + 1.5, 4.6, 29.4), 'steel');
    parts.bearing(p(x, 5, 28), [1, 0, 0], .8 * s, 1.4 * s);
  }
  const slider = solid(new T.SphereGeometry(1.6 * s, 20, 12), '#e4d9b9', 'ivory', 'observation-slider');
  slider.scale.set(1.3, .85, .9);
  slider.userData.modelInput = { kind: 'phase-track', track, label: '沿观察轨拖动，比较同一时段的储水与取水' };
  const inputDrops = Array.from({ length: 4 }, (_, i) => cylinder(0, 0, 0, .48, 1.8, '#74abb2', 'water', `inlet-drop-${i}`));
  const outputDrops = Array.from({ length: 3 }, (_, i) => cylinder(0, 0, 0, .5, 1.4, '#74abb2', 'water', `outlet-drop-${i}`));
  const contaminants = Array.from({ length: 10 }, (_, i) => {
    const mesh = solid(new T.OctahedronGeometry(.45 * s), '#8d713d', 'rock', 'quality-symbol');
    mesh.userData.qualitySymbol = i; return mesh;
  });
  const clean = reservoir.material;
  const dirty = b.materialFor('water', '#a9a07e');
  let state = evaluateWaterRenewal(0), inspection = 'overview';
  const fixedCount = b.meshes.length, fixedBuffers = b.meshes.map(mesh => mesh.geometry.attributes.position.array);
  const animateWater = (mesh: any, x: number, z: number, bottom: number, depth: number) => {
    mesh.scale.y = Math.max(.002, depth); mesh.position.set(...p(x, bottom + Math.max(.002, depth) / 2, z));
  };
  const update = (phase: number, selection: number) => {
    state = evaluateWaterRenewal(phase, selection);
    const depth = state.level * 25, top = 14.4 + depth;
    animateWater(reservoir, 49, -3, 14.4, depth);
    animateWater(receivedWater, 84, -3, 3.9, state.receiverLevel * 7.3);
    receivedWater.visible = state.phase > .002;
    for (const mesh of [reservoir, receivedWater, sampleWater]) mesh.material = state.contaminated ? dirty : clean;
    float.position.set(...p(53, top + .17, 7));
    valve.rotation.z = state.selection === 1 ? .85 : -.2;
    input(valve, state.selection === 1 ? balanced : overdraw);
    slider.position.set(...phaseTrackPoint(state.phase, track));
    inputDrops.forEach((mesh, i) => {
      const q = (state.phase * 5 + i / inputDrops.length) % 1;
      mesh.visible = state.phase > 0 && state.phase < 1;
      mesh.position.set(...p(38, 42.4 + (top + .3 - 42.4) * q, -3));
    });
    outputDrops.forEach((mesh, i) => {
      const q = (state.phase * (state.selection === 1 ? 10 : 4) + i / outputDrops.length) % 1;
      const low = 4.1 + state.receiverLevel * 7.3;
      mesh.visible = state.phase > 0 && state.phase < 1;
      mesh.position.set(...p(84, 12.2 + (low - 12.2) * q, -3)); mesh.material = state.contaminated ? dirty : clean;
    });
    contaminants.forEach((mesh, i) => {
      const a = i * 2.399963, r = 4 + i % 3 * 3.4;
      mesh.visible = state.contaminated;
      mesh.position.set(...p(49 + Math.sin(a) * r, top + .12, -3 + Math.cos(a) * r));
    });
    reservoir.userData.normalizedLevel = state.level; receivedWater.userData.normalizedReceiverLevel = state.receiverLevel;
  };
  update(0, 0);
  return {
    update,
    inspect(target) { inspection = target; },
    inspectTargets: () => [{ target: 'supply', label: '补给入口' }, { target: 'storage', label: '储水与初始参照' },
      { target: 'receiver', label: '取用与接收' }, { target: 'sample', label: '水质样本' }],
    focusBounds() {
      if (inspection === 'supply') return { min: p(2, 0, -17), max: p(57, 56, 18) };
      if (inspection === 'storage') return { min: p(23, 4, -25), max: p(75, 47, 25) };
      if (inspection === 'receiver') return { min: p(58, 0, -17), max: p(98, 30, 19) };
      if (inspection === 'sample') return { min: p(37, 0, 7), max: p(62, 28, 32) };
      return { min: p(1, 0, -25), max: p(100, 56, 33) };
    },
    describe: () => ({ ...state, inspection, originalPagePreserved: true, actualOpenVessels: true,
      realWallThickness: true, connectedSupplyAndWithdrawal: true, receiverReadsSameState: true,
      isolatedObservationWindow: true, sharedInitialReference: true, qualityChangesStoredAmount: false,
      mainWaterSurface: 14.4 + state.level * 25, receiverWaterSurface: 3.9 + state.receiverLevel * 7.3,
      fixedMeshCount: fixedCount, geometryBuffersReused: b.meshes.length === fixedCount && b.meshes.every((m, i) => m.geometry.attributes.position.array === fixedBuffers[i]),
      handleWorld: new T.Vector3().fromArray(slider.position.toArray()).applyMatrix4(b.root.matrixWorld).toArray(),
      phaseTrackWorld: { start: new T.Vector3(...track.start).applyMatrix4(b.root.matrixWorld).toArray(), end: new T.Vector3(...track.end).applyMatrix4(b.root.matrixWorld).toArray() },
      construction: 'open-water-budget-instrument', numericalScalesAreMeasured: false }),
  };
}

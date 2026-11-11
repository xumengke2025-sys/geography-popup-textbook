import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { evaluateSoilCare } from './textbook-soil-care-model';
import { createSoilInstrument } from './textbook-soil-instrument-parts';
import { mergeInstrumentGeometry } from './textbook-instrument-parts';
import { phaseTrackPoint } from './textbook-model-input';

/** One retained cutaway, not three unrelated dioramas. The front paths are an
 * enlarged schematic water network. Salt identity and all scientific x/y
 * coordinates belong to evaluateSoilCare; depth only separates coincident
 * markers in the physical cutaway. No water volume or pore size is measured. */
export function buildSoilCareWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, z0 = -LIFT_MARGIN - b.height * .45;
  const p = (x: number, y: number, z = 0): Vec3 => [x * s, y * s, z0 + z * s];
  const y = (height: number) => 8 + height * 1.8;
  const { parts, solid, plate, pipe, bearing, finish, openBox, nozzle } = createSoilInstrument(b, s);
  const role = (mesh: any, name: string) => { mesh.userData.soilCareRole = name; return mesh; };
  const input = (mesh: any, selection: number) => {
    mesh.userData.modelInput = { kind: 'replay', selection,
      label: `从同一土壤开始，${['观察蒸发返盐', '观察引淡淋盐', '观察覆盖抑蒸发'][selection]}` };
    mesh.userData.interactionFeedback = false; return mesh;
  };
  const inspectionPane = (a: Vec3, c: Vec3) => {
    const mesh = plate(a, c, '#d7e3dc', 'air', 'unframed-inspection-pane');
    mesh.material.opacity = .055; mesh.material.depthWrite = false;
    mesh.castShadow = mesh.receiveShadow = false; mesh.userData.castShadow = false; return mesh;
  };
  // A continuous low chassis retains the groundwater section and its outlet.
  // The pale walls are vessel walls; the soil itself carries no metal frame.
  plate(p(5, 2, -14), p(100, 4, 22), '#544534', 'wood', 'water-salt-bed');
  plate(p(5.6, 4, -13.4), p(99.4, 4.35, 21.4), '#a88b50', 'brass', 'bed-edge-reveal');
  plate(p(6.3, 4.35, -12.7), p(98.7, 5.25, 20.7), '#2c443d', 'enamel', 'retaining-bed');
  parts.fasteners([p(9, 5.3, -10), p(96, 5.3, -10), p(9, 5.3, 18), p(96, 5.3, 18)], [0, 1, 0], .38 * s);
  for (const x of [18, 78]) for (const z of [-6, 12]) {
    pipe(p(x, 5.25, z), p(x, 11.4, z), .62 * s);
    bearing(p(x, 8.2, z), [0, 1, 0], .95 * s, 2.2 * s);
  }
  const basalWalls = openBox(13.6 * s, 83.4 * s, 12 * s, 17.2 * s, z0 - 10 * s, z0 + 17.3 * s,
    '#d8d3bb', 'ivory', 'groundwater-section', false, true, .6 * s);
  input(inspectionPane(p(14.2, 12, 17.2), p(82.8, 17.2, 17.3)), 1);
  // Replace the right wall by a retained wall with a real exit opening.
  // Moving markers must not pass through an intact vessel wall.
  basalWalls[3].visible = false;
  plate(p(82.8, 12, -10), p(83.4, 17.2, 8.6), '#d8d3bb', 'ivory', 'groundwater-right-retained-wall');
  plate(p(82.8, 12, 8.6), p(83.4, 14.5, 17.3), '#d8d3bb', 'ivory', 'groundwater-open-exit-sill');
  const groundwater = role(solid(new T.BoxGeometry(68.4 * s, 5.2 * s, 25.7 * s), '#78a1a6', 'water', 'retained-groundwater'), 'groundwater');
  groundwater.position.set(...p(48.5, 14.6, 3.35)); groundwater.userData.castShadow = false; input(groundwater, 1);
  // An actual empty channel connects the groundwater cutaway to the cup.
  // Its sliding gate visibly opens only in the drainage condition.
  plate(p(82.6, 13.8, 8), p(90.6, 14.5, 17.3), '#d8d3bb', 'ivory', 'drain-bridge-floor');
  plate(p(82.6, 14.5, 8), p(90.6, 18.0, 8.6), '#d8d3bb', 'ivory', 'drain-bridge-back');
  plate(p(82.6, 14.5, 16.7), p(90.6, 18.0, 17.3), '#d8d3bb', 'ivory', 'drain-bridge-front');
  const gate = role(plate(p(84.5, 14.5, 8.7), p(85.1, 18.2, 16.6), '#a88b50', 'brass', 'drainage-gate'), 'drainage-gate');
  input(gate, 1);
  pipe(p(84.8, 18.2, 12.6), p(84.8, 24.5, 12.6), .35 * s, '#929b98', 'steel');
  const gateKnob = parts.knob(p(84.8, 24.5, 12.6), [0, 1, 0], 1.7 * s, 1.4 * s);
  gateKnob.traverse((m: any) => { if (m.isMesh) input(role(m, 'drainage-control'), 1); });
  const receivingWalls = openBox(90 * s, 99 * s, 10.6 * s, 18.8 * s, z0 + 8 * s, z0 + 18.8 * s,
    '#d8d3bb', 'ivory', 'drained-salt-receiver', false, true, .5 * s);
  inspectionPane(p(90.5, 10.6, 18.7), p(98.5, 18.8, 18.8));
  receivingWalls[2].visible = false;
  plate(p(90, 10.6, 8), p(90.5, 14.5, 18.8), '#d8d3bb', 'ivory', 'receiver-open-inlet-sill');
  plate(p(90, 14.5, 8), p(90.5, 18.8, 8.6), '#d8d3bb', 'ivory', 'receiver-inlet-back-jamb');
  const receiver = role(solid(new T.BoxGeometry(7.9 * s, 5.5 * s, 9.1 * s), '#91b2b5', 'water', 'receiver-inspection-water'), 'receiver-water');
  receiver.position.set(...p(94.5, 13.85, 13.35)); receiver.userData.castShadow = false;
  // One continuous natural cut face. Flow lanes belong to the schematic
  // tracers, never to eight vertical trenches cut through the soil specimen.
  const lanes = Array.from({ length: 8 }, (_, i) => 21 + i * 7.8);
  const cols = 116, rows = 28, vertices: number[] = [], colors: number[] = [], indices: number[] = [];
  const topAt = (x: number) => 43.6 + .55 * Math.sin(x * .21) + .32 * Math.sin(x * .73 + .7);
  // Stable value noise for the exposed natural specimen. Independent lattice
  // samples avoid diagonal sine waves reading as a manufactured corrugation.
  const grainAt = (x: number, y: number) => {
    const ix = Math.floor(x), iy = Math.floor(y), u = x - ix, v = y - iy;
    const sx = u * u * (3 - 2 * u), sy = v * v * (3 - 2 * v);
    const hash = (a: number, c: number) => { const h = Math.sin(a * 127.1 + c * 311.7 + 19.3) * 43758.5453; return h - Math.floor(h); };
    const a = hash(ix, iy), c = hash(ix + 1, iy), d = hash(ix, iy + 1), e = hash(ix + 1, iy + 1);
    return (a + (c - a) * sx) * (1 - sy) + (d + (e - d) * sx) * sy;
  };
  const soilColor = new T.Color('#8e7959');
  for (let side = 0; side < 2; side++) for (let row = 0; row <= rows; row++) for (let col = 0; col <= cols; col++) {
    const u = col / cols, v = row / rows, xx = 14.3 + u * 68.5;
    const x = xx + (Math.exp(-u * 35) - Math.exp(-(1 - u) * 35)) * Math.sin(v * 14.7) * .48;
    const yy = 17.2 + v * (topAt(xx) - 17.2);
    // Several incommensurate directions avoid the old repeated diagonal
    // corrugation. Isolated shallow pores never divide the whole monolith.
    const relief = .55 * (grainAt(xx * .45, yy * .45) - .5)
      + .22 * (grainAt(xx * 1.09 + 17, yy * 1.09) - .5);
    let recess = 0;
    for (let k = 0; k < 21; k++) {
      const px = 17.5 + (k * .61803398875 % 1) * 62, py = 19 + (k * .41421356237 % 1) * 22;
      const dx = (xx - px) / (.55 + k % 3 * .15), dy = (yy - py) / (.7 + k % 4 * .13);
      recess += .38 * Math.exp(-(dx * dx + dy * dy) * 1.6);
    }
    const z = side ? -8 : 11.65 + relief - recess;
    vertices.push(...p(x, yy, z));
    const darkTop = 1 - .16 * Math.exp(-(1 - v) * 9), grain = .95 + .09 * grainAt(xx * 1.17, yy * 1.17);
    colors.push(soilColor.r * darkTop * grain, soilColor.g * darkTop * grain, soilColor.b * darkTop * grain);
  }
  const count = (cols + 1) * (rows + 1), at = (row: number, col: number) => row * (cols + 1) + col;
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const a = at(row, col), c = a + 1, d = at(row + 1, col), e = d + 1;
    indices.push(a,c,d,c,e,d,a+count,d+count,c+count,c+count,d+count,e+count);
  }
  const edge = [...Array.from({length:cols+1},(_,col)=>at(0,col)),
    ...Array.from({length:rows},(_,row)=>at(row+1,cols)),
    ...Array.from({length:cols},(_,col)=>at(rows,cols-1-col)),
    ...Array.from({length:rows-1},(_,row)=>at(rows-1-row,0))];
  edge.forEach((a,i)=>{const c=edge[(i+1)%edge.length];indices.push(a,a+count,c,c,a+count,c+count);});
  const soilGeometry = new T.BufferGeometry();soilGeometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  soilGeometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));soilGeometry.setIndex(indices);soilGeometry.computeVertexNormals();
  const soil = role(solid(soilGeometry, '#ffffff', 'land', 'single-irregular-porous-soil-monolith'),'soil-aggregate');
  // A dedicated colour avoids changing other white materials in the book.
  soil.material = b.materialFor('land', '#8e7959');soil.material.color.set('#ffffff');soil.material.vertexColors = true;
  soil.userData.singleContinuousSoil = true;soil.userData.schematicFlowLanes = lanes;input(soil,0);
  for (const x of [12.1, 84.8]) {
    plate(p(x - 1.2, 5.25, -7), p(x + 1.2, 7.1, -2), '#2c443d', 'enamel', 'header-upright-foot');
    pipe(p(x, 7.1, -4.5), p(x, 52.5, -4.5), .58 * s);
    bearing(p(x, 50.8, -4.5), [0, 1, 0], .9 * s, 2.8 * s);
  }
  plate(p(11.2, 51.1, -5.3), p(85.7, 52.05, .5), '#2c443d', 'enamel', 'freshwater-header-seat');
  const header = openBox(14 * s, 82.5 * s, 52.5 * s, 56.8 * s, z0 - 5 * s, z0 + 13.5 * s,
    '#d8d3bb', 'ivory', 'freshwater-distribution-gutter', false, false, .45 * s);
  input(inspectionPane(p(14.45,52.5,13.4),p(82.05,56.8,13.5)),1);
  header.forEach(m => input(role(m, 'freshwater-header'), 1));
  // Perforated gutter floor and eight aligned open downspouts.
  const floor = new T.Shape(); floor.moveTo(14 * s, -(z0 - 5 * s)); floor.lineTo(82.5 * s, -(z0 - 5 * s));
  floor.lineTo(82.5 * s, -(z0 + 13.5 * s)); floor.lineTo(14 * s, -(z0 + 13.5 * s)); floor.closePath();
  for (const x of lanes) { const h = new T.Path(); h.absarc(x * s, -(z0 + 12.8 * s), .52 * s, 0, Math.PI * 2, true); floor.holes.push(h);
    input(role(nozzle(p(x, 51.9, 12.8), .76 * s, .52 * s, 1.7 * s), 'freshwater-nozzle'), 1); }
  const floorGeometry = new T.ExtrudeGeometry(floor, { depth: .45 * s, bevelEnabled: false, curveSegments: 16 });
  floorGeometry.rotateX(-Math.PI / 2); floorGeometry.translate(0, 52.05 * s, 0);
  input(role(solid(floorGeometry, '#a88b50', 'brass', 'open-perforated-freshwater-floor'), 'freshwater-floor'), 1);
  const freshwater = role(solid(new T.BoxGeometry(66.9 * s, 2.7 * s, 17.2 * s), '#a5c4c8', 'water', 'freshwater-surface'), 'freshwater');
  freshwater.position.set(...p(48.25, 53.85, 4.2)); freshwater.userData.castShadow = false; input(freshwater, 1);
  // The natural cover rests on the SAME soil. Short irregular stems and curled
  // leaf ribbons form an open mulch mat; no long green rods substitute for it.
  const straw: any[] = [], leaf: any[] = [];
  for (let i = 0; i < 90; i++) {
    const x = 15.5 + (i * .61803398875 % 1) * 65, z = -6.5 + (i * .41421356237 % 1) * 19;
    const angle = i * 2.39996, length = 2.3 + (i % 7) * .52, ax = x - Math.cos(angle) * length / 2, cx = x + Math.cos(angle) * length / 2;
    const a = new T.Vector3(...p(ax, topAt(ax) + .2 + i % 4 * .13, z - Math.sin(angle) * length / 2));
    const c = new T.Vector3(...p(cx, topAt(cx) + .2 + i % 4 * .13, z + Math.sin(angle) * length / 2));
    const g = new T.CylinderGeometry(.105 * s, .16 * s, a.distanceTo(c), 5);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), c.clone().sub(a).normalize())); g.translate(...a.add(c).multiplyScalar(.5).toArray()); straw.push(g);
  }
  for (let i = 0; i < 20; i++) {
    const x = 16 + (i * .754877666 % 1) * 63, zz = -6 + (i * .56984 % 1) * 19, angle = i * 1.64;
    const v: number[] = [], at = (u: number, side: number): Vec3 => p(x + Math.cos(angle) * u * 3.5 - Math.sin(angle) * side * Math.sin(Math.PI * u) * 1.2,
      topAt(x + Math.cos(angle) * u * 3.5 - Math.sin(angle) * side * Math.sin(Math.PI * u) * 1.2) + .2 + Math.sin(Math.PI * u) * .55,
      zz + Math.sin(angle) * u * 3.5 + Math.cos(angle) * side * Math.sin(Math.PI * u) * 1.2);
    for (let k = 0; k < 6; k++) { const a = k / 6, c = (k + 1) / 6; v.push(...at(a, -1), ...at(c, -1), ...at(a, 1), ...at(a, 1), ...at(c, -1), ...at(c, 1)); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); leaf.push(g);
  }
  const cover = [role(solid(mergeInstrumentGeometry(straw), '#a28d51', 'plant', 'short-natural-straw-mulch'), 'mulch-stems'),
    role(solid(mergeInstrumentGeometry(leaf), '#777445', 'plant', 'curled-organic-mulch'), 'mulch-leaves')];
  cover.forEach(m => input(m, 2));
  const salts = evaluateSoilCare(0, 0).packets.map(packet => {
    const mesh = role(solid(new T.SphereGeometry(.59 * s, 10, 6), '#b48943', 'rock', 'retained-salt-marker'), 'salt-packet');
    mesh.userData.soilCareSaltId = packet.id; mesh.userData.castShadow = false; return mesh;
  });
  const saltZ = (id: number) => 12.1 + (id % 5) * .6 + Math.floor(id / 8) * .16;
  const track = { start: p(7.9, 49.2, 15.4), end: p(7.9, 17.1, 15.4) };
  pipe(track.start, track.end, .26 * s);
  for (const at of [track.start, track.end]) {
    bearing(at, [0, 1, 0], .61 * s, 1.3 * s);
    // Short horizontal brackets connect the observation slide to the actual
    // header mast. The guide no longer floats beside the specimen.
    pipe([at[0], at[1], at[2]], [12.1 * s, at[1], z0 - 4.5 * s], .32 * s);
    bearing([12.1 * s, at[1], z0 - 4.5 * s], [0, 1, 0], .9 * s, 1.8 * s);
  }
  const rider = role(solid(new T.SphereGeometry(1.45 * s, 20, 12), '#e3ddc9', 'ivory', 'migration-observation-rider'), 'observation-slider');
  rider.scale.set(1, 1.3, .8); rider.userData.modelInput = { kind: 'phase-track', track, label: '拖动观察水盐迁移，倒拖回看同一批盐的去向' }; rider.userData.interactionFeedback = false;
  const waterSource = new T.IcosahedronGeometry(1, 0), waterVertices = new Float32Array(waterSource.attributes.position.array), stride = waterSource.attributes.position.count;
  const waterGeometry = new T.BufferGeometry(); waterGeometry.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(8 * 4 * stride * 3), 3));
  const water = role(solid(waterGeometry, '#76a6af', 'water', 'schematic-water-migration'), 'water-flow'); water.userData.castShadow = false; waterSource.dispose();
  let state = evaluateSoilCare(0, 0), previous = '';
  return { update(phase, selection) {
    state = evaluateSoilCare(phase, selection);
    const key = `${state.phase}:${state.selection}`;
    if (key !== previous) {
      const washing = state.freshwaterWithDrainage, covered = state.protectedFromEvaporation;
      for (const m of cover) m.visible = covered;
      freshwater.visible = washing; receiver.visible = washing;
      gate.position.y = washing ? 6 * s : 0;
      salts.forEach((m, i) => { const packet = state.packets[i]; m.position.set(...p(packet.u * 100, y(packet.height), saltZ(packet.id)));
        m.userData.drained = packet.drained; m.userData.modelU = packet.u; m.userData.modelHeight = packet.height; });
      const a = waterGeometry.attributes.position;
      for (let lane = 0; lane < 8; lane++) for (let j = 0; j < 4; j++) {
        const visible = state.phase > .08 && state.phase < .98 && (!covered || j < 1), fraction = (state.phase * 2 + j / 4) % 1;
        const yy = washing ? 51.0 - fraction * 34.6 : 17.2 + fraction * 29.5;
        const radius = visible ? (covered ? .31 : .42) * s : 0, center = p(lanes[lane], yy, 12.8);
        for (let k = 0; k < stride; k++) { const base = k * 3, vertex = (lane * 4 + j) * stride + k;
          a.setXYZ(vertex, center[0] + waterVertices[base] * radius, center[1] + waterVertices[base + 1] * radius * 1.45, center[2] + waterVertices[base + 2] * radius); }
      }
      a.needsUpdate = true; waterGeometry.computeVertexNormals(); waterGeometry.computeBoundingSphere();
      rider.position.set(...phaseTrackPoint(state.phase, track)); previous = key;
    }
  }, focusBounds: () => ({ min: p(3, 0, -15), max: p(103, 60, 24) }),
    describe: () => ({ ...state, construction: 'retained-soil-water-salt-instrument', schematicFlowLaneCenters: lanes,
      packetPositionsFromSameState: true, packetIdentitiesRetained: true, actualDrainageReceiver: true,
      drainedMarkersRemainVisible: true, naturalMulchOnSameSoil: true, selfSupporting: true,
      poreGeometryMeasured: false, waterAmountMeasured: false, schematicWaterTracers: true,
      geometryLayout: { scale: s, z0, heightOffset: 8, heightScale: 1.8, saltDepths: state.packets.map(packet => saltZ(packet.id)) }, observationTrack: track }),
  };
}

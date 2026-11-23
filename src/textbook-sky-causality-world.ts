import { mountEstuarySpecimen, mountRadiationReceiver } from './textbook-atmosphere-specimens';
import { applyEarthScan } from './textbook-earth-scan';
import { mountSpecimenDial } from './textbook-specimen-dial';
import { THREE as T } from './reference/engine.js';
import { createSpecimenMaterial } from './textbook-solid-materials';
import { PALETTE as C, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint } from './textbook-model-input';
import { buildSolarInstrument } from './textbook-solar-instrument';
import { mountFieldInstrument } from './textbook-field-instruments';
import { buildMarsCabin } from './textbook-mars-cabin';
import { createInstrumentParts, chamferedPlateGeometry, turnedShaftGeometry, turnedSleeveGeometry, mergeInstrumentGeometry } from './textbook-instrument-parts';
import { evaluateSolarDisturbance, evaluateSphereExchange, evaluateMarsTransfer, evaluateGreenhouseResponse,
  evaluateWindForces, skyClamp, skyProgress, skyEase } from './textbook-sky-causality-model';

const world = (b: TextbookGeometry) => {
  const s = b.width / 100;
  return { s, p: (u: number, v: number, h = 0): Vec3 => b.p(u, v, h * s) };
};
const label = (b: TextbookGeometry, text: string, at: Vec3, s: number, width = Math.max(15, text.length * 5.1)) => b.label(text, at, width * s, 6.2 * s);
const curve = (b: TextbookGeometry, points: Vec3[]) => points.length === 2 ? new T.LineCurve3(b.v(points[0]), b.v(points[1])) : new T.CatmullRomCurve3(points.map(q => b.v(q)), false, 'catmullrom', .15);
function partial(b: TextbookGeometry, path: any, progress: number, color: 'flow' | 'accent' = 'flow', width = 1.15) {
  if (progress <= 0) return;
  const points = Array.from({ length: 41 }, (_, i) => path.getPoint(skyClamp(progress) * i / 40));
  (color === 'flow' ? b.flow : b.accentStrokes).push({ points, width });
}
function ball(b: TextbookGeometry, radius: number, color: string, at: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]) {
  const g = new T.SphereGeometry(radius, 18, 12); g.scale(...scale);
  const mesh = b.mesh(g, color, false); mesh.position.set(...at); return mesh;
}
function uniqueMaterial(b: TextbookGeometry, mesh: any) {
  // A Three.js clone drops the reference renderer's onBeforeCompile hook.
  // Register a separate physical surface with the same reveal and disposal
  // lifecycle so a response cannot recolour unrelated objects.
  mesh.material = createSpecimenMaterial(b.pop,{color:`#${mesh.material.color.getHexString()}`});
  mesh.material.side = T.DoubleSide; return mesh.material;
}
function input(meshes: any[], selection: number, text: string) {
  meshes.forEach(mesh => { mesh.userData.modelInput = { kind: 'select', selection, label: text }; });
}
function handle(b: TextbookGeometry, s: number, p: ReturnType<typeof world>['p'], text: string) {
  const track = { start: p(.15, 1.14, 3), end: p(.85, 1.14, 3) };
  const mesh = b.mesh(new T.BoxGeometry(4.4 * s, 3 * s, 1.2 * s), C.paper, false);
  mesh.userData.modelInput = { kind: 'phase-track', track, label: text };
  return (phase: number) => {
    mesh.position.set(...phaseTrackPoint(phase, track)); b.outline(mesh, mesh.userData.modelHovered ? .9 : .55);
    b.contour([track.start, track.end], .35);
    for (const sign of [-1, 1]) b.contour([[mesh.position.x + sign * .8 * s, mesh.position.y - .8 * s, mesh.position.z + .65 * s], [mesh.position.x + sign * .8 * s, mesh.position.y + .8 * s, mesh.position.z + .65 * s]], .4);
  };
}
function globe(b: TextbookGeometry, at: Vec3, radius: number) {
  const meshes = [ball(b, radius, C.sea, at)];
  for (const [phi, length, theta, span] of [[.25, .7, .55, .95], [2, .6, .7, 1.05], [4.15, .9, .4, .62]]) {
    const g = new T.SphereGeometry(radius * 1.008, 12, 8, phi, length, theta, span); g.translate(...at); meshes.push(b.mesh(g, C.green, false, false));
  }
  return meshes;
}
function ringPath(at: Vec3, r: number, plane: 'xy' | 'xz' = 'xz', aspect = 1): Vec3[] {
  return Array.from({ length: 65 }, (_, i): Vec3 => { const a = i / 64 * Math.PI * 2; return [at[0] + Math.cos(a) * r, at[1] + (plane === 'xy' ? Math.sin(a) * r * aspect : 0), at[2] + (plane === 'xz' ? Math.sin(a) * r * aspect : 0)]; });
}

/** One disturbance travels to the magnetosphere before either polar receiver
 * responds. The permanent field is a thin context; the active event is solid. */
export function buildSolarDisturbanceWorld(b: TextbookGeometry): ModelMotion {
  const { s, p } = world(b), sun = p(.16, .80, 23), earth = p(.79, .80, 23);
  const setInstrumentPhase = buildSolarInstrument(b, s, sun[2]);
  for (const [x, y] of [[-3, 4], [2, -2], [1, 7]]) ball(b, 1.1 * s, C.rock, [sun[0] + x * s, sun[1] + y * s, sun[2] + 11 * s], [1, .65, .25]);
  const flareG = new T.TorusGeometry(5 * s, .65 * s, 6, 28, Math.PI); flareG.rotateZ(-Math.PI / 2);
  const flare = b.mesh(flareG, C.warm, false); flare.position.set(sun[0] + 10 * s, sun[1], sun[2]); input([flare], 1, '重看太阳扰动的传播');
  const poles = [-1, 1].map(sign => [earth[0] + .8 * s, earth[1] + sign * 9.6 * s, earth[2] + 4 * s] as Vec3);
  const outbound = [-1, 1].map(sign => curve(b, [[sun[0] + 12 * s, sun[1] + sign * 3 * s, sun[2]], p(.39, .80, 23 + sign * 3), p(.55, .80, 23 + sign * 3)]));
  const deflected = [-1, 1].map((sign, i) => curve(b, [p(.55, .80, 23 + sign * 3), p(.60, .80, 23 + sign * 15), p(.73, .80, 23 + sign * 17), poles[i]]));
  const packets = [-1, 1].map(() => ball(b, 1.45 * s, C.warm)); packets.forEach((m, i) => { m.userData.disturbanceId = `disturbance-${i === 0 ? 'north' : 'south'}`; });
  const auroras = [-1, 1].map(sign => {
    // A finite paper curtain follows the front polar atmosphere. Its lower
    // edge stays attached; the upper edge opens only after the event arrives.
    const vertices: number[] = [], indices: number[] = [];
    for (let i = 0; i <= 32; i++) {
      const a = .08 * Math.PI + i / 32 * .84 * Math.PI;
      for (const row of [0, 1]) {
        const radius = (5.8 - row * .6) * s;
        vertices.push(Math.cos(a) * radius, sign * row * (3.3 + .5 * Math.sin(i / 32 * Math.PI * 3)) * s, Math.sin(a) * radius);
      }
      if (i < 32) { const k = i * 2; indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const mesh = b.mesh(geometry, C.darkGreen, false, false); mesh.position.set(earth[0], earth[1] + sign * 9.4 * s, earth[2]);
    mesh.userData.receiver = sign < 0 ? 'south-polar-atmosphere' : 'north-polar-atmosphere'; mesh.userData.causalRole = 'polar-receiving-curtain'; return mesh;
  });
  label(b, '太阳活动', p(.15, .71, 43), s); label(b, '地球磁场', p(.74, .69, 47), s);
  const polarLabel = label(b, '极区响应', p(.88, .94, 11), s);

  let state = evaluateSolarDisturbance(0);
  return { update(phase, selection) {
    state = evaluateSolarDisturbance(phase, selection); flare.visible = state.enhanced;
    flare.scale.setScalar(.5 + state.sourceOpen * .5); packets.forEach(m => { m.visible = state.enhanced && phase >= .06; });
    for (const sign of [-1, 1]) {
      const path: Vec3[] = [p(.55 + state.magnetosphereResponse * .025, .80, 23), p(.61, .80, 23 + sign * (21 - state.magnetosphereResponse * 2)), p(.84, .80, 23 + sign * 21), p(.98, .80, 23 + sign * 8)];
      b.contour(curve(b, path).getPoints(48).map((q: any) => q.toArray()), .38 + state.magnetosphereResponse * .22);
    }
    packets.forEach((mesh, i) => {
      const moving = state.arrived ? deflected[i].getPoint(state.deflected) : outbound[i].getPoint(state.outbound);
      mesh.position.copy(moving); if (mesh.visible) b.outline(mesh, .65);
      if (state.enhanced) { partial(b, outbound[i], state.outbound, 'accent', 1.1); if (state.arrived) partial(b, deflected[i], state.deflected, 'accent', 1.2); }
    });
    auroras.forEach(mesh => { mesh.visible = state.auroraResponse > .001; mesh.scale.y = Math.max(.015, state.auroraResponse); if (mesh.visible) b.outline(mesh, .85); });
    polarLabel.visible = state.polarReceived; setInstrumentPhase(phase);
  }, focusBounds: () => ({ min: p(.01, .59, 0), max: p(1.01, 1.19, 53) }),
    describe: () => ({ kind: 'solar-activity', ...state, causalChain: ['departure', 'magnetosphere-arrival', 'polar-reception'], eventIdentityPreserved: true, polarResult: 'attached-finite-paper-curtain', receivingGeometryRetainsEndState: true, phaseMeaning: 'explanation-order', solarWindReachesGround: false }) };
}

function waterSymbol(b: TextbookGeometry, s: number, id: string) {
  const drop = ball(b, 1.2 * s, C.water, [0, 0, 0], [.75, 1.3, .75]);
  const shape = new T.Shape(); shape.moveTo(0, 1.6 * s); shape.lineTo(-1.2 * s, 0); shape.lineTo(0, -1.6 * s); shape.lineTo(1.2 * s, 0); shape.closePath();
  const hole = new T.Path(); hole.moveTo(0, .9 * s); hole.lineTo(.65 * s, 0); hole.lineTo(0, -.9 * s); hole.lineTo(-.65 * s, 0); hole.closePath(); shape.holes.push(hole);
  const frame = b.mesh(new T.ExtrudeGeometry(shape, { depth: .3 * s, bevelEnabled: false }), C.cool, false);
  [drop, frame].forEach(mesh => { mesh.userData.waterId = id; }); return { drop, frame };
}

/** A single water identity changes state as it crosses sphere boundaries.
 * Vapor is an open tracer, never a visible liquid droplet floating upward. */
export function buildSphereExchangeWorld(b: TextbookGeometry): ModelMotion {
  const { s,p }=world(b),landscape=mountEstuarySpecimen(b,s);
  const {cloudAt,river,soilAt,treeAt,canopy}=landscape;
  const pore=new T.Shape();
  pore.moveTo(-5.8,-.23);pore.bezierCurveTo(-3.9,-1.15,-.9,-1.12,1.85,-.95);
  pore.bezierCurveTo(4.1,-.9,5.85,-.35,6,.29);pore.bezierCurveTo(1.8,.93,-3.13,.72,-5.8,-.23);
  const wetGeom=new T.ExtrudeGeometry(pore,{depth:.12,bevelEnabled:false});wetGeom.scale(s,s,s);
  const wet=b.mesh(wetGeom,'#74908a',false,true,'land');wet.position.set(...soilAt);wet.userData.causalRole='root-zone-water-section';
  const rainLanding=river[18];
  const waterPaths=[curve(b,[p(.81,.85,3),p(.78,.81,22),cloudAt]),curve(b,[cloudAt,p(.42,.72,34),rainLanding]),
    curve(b,[...river.slice(18),p(.82,.88,3)])];
  const biologyPaths=[curve(b,[soilAt,p(.35,.97,9),treeAt,canopy]),curve(b,[canopy,p(.40,.81,30),cloudAt])];
  const symbols = ['water-a', 'water-b', 'water-c'].map(id => waterSymbol(b, s, id));
  let state=evaluateSphereExchange(0);
  return { update(phase, selection) {
    state = evaluateSphereExchange(phase, selection); wet.scale.x = .5 + .5 * state.soilResponse;
    landscape.update(phase,state.selected,state.cloudResponse,state.leafResponse);
    symbols.forEach(({ drop, frame }, i) => {
      const t = skyClamp(phase - i * .018), bio = state.biological;
      const vapor = bio ? t >= .63 : t < .22;
      const point = bio ? t < .42 ? biologyPaths[0].getPoint(skyProgress(.06, .42, t)) : t < .63 ? biologyPaths[0].getPoint(1) : biologyPaths[1].getPoint(skyProgress(.63, .95, t))
        : t < .22 ? waterPaths[0].getPoint(skyProgress(.03, .22, t)) : t < .50 ? waterPaths[1].getPoint(skyProgress(.30, .50, t)) : waterPaths[2].getPoint(skyProgress(.50, .98, t));
      drop.visible = !vapor; frame.visible = vapor; drop.position.copy(point); frame.position.copy(point);
      const mesh = vapor ? frame : drop;
      // In the channel the three identities share its finite width. The old
      // decorative spread put the outside drops on dry land beside the river.
      mesh.position.x += (i - 1) * (vapor ? 1.6 : .35) * s; b.outline(mesh, .6);
    });
    if (state.biological) { partial(b, biologyPaths[0], skyProgress(.06, .42, phase)); if (phase >= .63) partial(b, biologyPaths[1], skyProgress(.63, .95, phase)); }
    else { partial(b, waterPaths[0], skyProgress(.03, .22, phase)); if (phase >= .30) partial(b, waterPaths[1], skyProgress(.30, .50, phase)); if (phase >= .50) partial(b, waterPaths[2], skyProgress(.50, .98, phase)); }
  }, focusBounds: () => ({ min: p(.02, .54, -2), max: p(1.01, 1.21, 43) }),
    describe: () => ({ kind: 'external-spheres', ...state, rainLanding,riverEntry:waterPaths[2].getPoint(0).toArray(),rootZone:soilAt,treeContact:treeAt,vaporSymbol: 'open-frame', liquidSymbol: 'drop', spheresAlwaysPresent: true, identitySurvivesPhaseChange: true, phaseMeaning: 'exchange-explanation-order' }) };
}

/** Four different modules remain present. Only the chosen connection is active;
 * each receiving indicator waits for its own incoming water/gas/food/energy. */
export function buildMarsTransferWorld(b: TextbookGeometry): ModelMotion {
  const { s, p } = world(b), centers = [p(.18, .80, 3), p(.48, .60, 3), p(.79, .80, 3), p(.49, .98, 3)];
  b.terrain(.03 * b.width, .98 * b.width, p(0, .43)[2], p(0, 1.09)[2], (x, z) => (1.3 + .4 * Math.sin(x / s * .13) * Math.cos(z / s * .1)) * s, '#b89375', 24, 10);
  const windows: any[] = [], moduleSurfaces: any[][] = [];
  centers.forEach((at, i) => {
    const cabin=buildMarsCabin(b,at,s,i);uniqueMaterial(b,cabin.window);windows.push(cabin.window);
    input(cabin.meshes,[0,2,1,3][i],['查看基地整体','查看植物与乘员的交换','查看水的再生','查看能源供给'][i]);
    moduleSurfaces.push(cabin.meshes.filter(m=>m.userData.kind!=='text-label'));
  });
  const crew = centers[0], plants = centers[1], support = centers[2], resources = centers[3];
  // Visible instruments sit at the front of their own cabin, so a response
  // belongs to a receiver rather than to an unrelated floating title.
  for (const dx of [-3.2, 3.2]) {
    ball(b, .9 * s, C.ink, [crew[0] + dx * s, crew[1] + 5.4 * s, crew[2] + 8.6 * s]);
    b.cylinder([crew[0] + dx * s, crew[1] + 1.4 * s, crew[2] + 8.6 * s], [crew[0] + dx * s, crew[1] + 4.4 * s, crew[2] + 8.6 * s], .8 * s, C.rock);
  }
  const plantLeaves: any[] = [];
  for (const dx of [-2.6, 0, 2.6]) { b.cylinder([plants[0] + dx * s, plants[1] + 1.2 * s, plants[2] + 8.4 * s], [plants[0] + dx * s, plants[1] + 5 * s, plants[2] + 8.4 * s], .1 * s, C.darkGreen); for (const sign of [-1, 1]) { const leaf = ball(b, 1.05 * s, C.green, [plants[0] + (dx + sign * .7) * s, plants[1] + (3.5 + sign * .6) * s, plants[2] + 8.5 * s], [1, .32, .42]); uniqueMaterial(b, leaf); plantLeaves.push(leaf); } }
  const instrumentAt: Vec3 = [support[0], support[1] + 4 * s, support[2] + 9.1 * s];
  const rotor = b.mesh(new T.BoxGeometry(5.6 * s, .75 * s, .65 * s), C.cool, false); rotor.position.set(...instrumentAt); rotor.userData.causalRole = 'receiving-filter-rotor';
  const rotorCross = b.mesh(new T.BoxGeometry(.75 * s, 5.6 * s, .65 * s), C.cool, false); rotorCross.position.set(...instrumentAt);
  const valve = b.mesh(new T.BoxGeometry(3.4 * s, 1 * s, .6 * s), C.warm, false); valve.position.set(support[0] - 4.7 * s, support[1] + 4 * s, support[2] + 9.1 * s); valve.userData.causalRole = 'receiving-filter-valve';
  b.cylinder([support[0] - 4.7 * s, support[1] + .8 * s, support[2] + 8.7 * s], [support[0] - 4.7 * s, support[1] + 6.8 * s, support[2] + 8.7 * s], .65 * s, C.rock);
  const tank = b.mesh(new T.BoxGeometry(7 * s, 5.2 * s, .7 * s), C.water, false); tank.userData.causalRole = 'reclaimed-water-receiving-store';
  const cup = b.mesh(new T.CylinderGeometry(2.6 * s, 2.3 * s, 2.7 * s, 18, 1, true), C.paper, false); cup.position.set(crew[0], crew[1] + 2 * s, crew[2] + 10.2 * s);
  const drinkingWater = b.mesh(new T.CylinderGeometry(2.3 * s, 2.1 * s, 2.2 * s, 18), C.water, false); drinkingWater.userData.causalRole = 'crew-received-water';
  const oxygenPiston = b.mesh(new T.BoxGeometry(2 * s, 1 * s, .6 * s), C.darkGreen, false); oxygenPiston.position.set(crew[0] + 5.5 * s, crew[1] + 6.7 * s, crew[2] + 9.2 * s); oxygenPiston.userData.causalRole = 'crew-received-oxygen';
  const foodTray = b.mesh(new T.BoxGeometry(3.8 * s, .6 * s, 2.8 * s), C.land, false); foodTray.position.set(crew[0] - 3.7 * s, crew[1] + 1.4 * s, crew[2] + 10 * s); foodTray.userData.causalRole = 'crew-received-food-tray';
  const plantGasPiston = b.mesh(new T.BoxGeometry(2.4 * s, 1.2 * s, .65 * s), C.cool, false); plantGasPiston.position.set(plants[0] + 5.3 * s, plants[1] + 2 * s, plants[2] + 9 * s); plantGasPiston.userData.causalRole = 'plant-received-gas';
  const powerSwitch = b.mesh(new T.BoxGeometry(2 * s, 1 * s, .75 * s), C.gold, false); powerSwitch.position.set(support[0] + 5 * s, support[1] + 2.3 * s, support[2] + 9.2 * s); powerSwitch.userData.causalRole = 'life-support-power-switch';
  const solar = b.box(p(.76, .43, 2), p(.94, .60, 3), '#6b8790', false); input([solar], 3, '查看太阳能供给基地');
  for (const u of [.80, .85, .90]) b.stroke([p(u, .44, 3.1), p(u, .59, 3.1)], .3);
  const port = (i: number, y = 2.4): Vec3 => [centers[i][0], centers[i][1] + y * s, centers[i][2] + 9 * s];
  const paths = {
    water: curve(b, [port(0), p(.40, .93, 5.4), port(2), p(.68, 1.07, 5.4), port(3), p(.25, 1.07, 5.4), port(0)]),
    'carbon-dioxide': curve(b, [port(0, 7), p(.27, .61, 17), port(1, 7)]),
    oxygen: curve(b, [port(1, 10), p(.25, .71, 23), port(0, 10)]),
    food: curve(b, [port(1, 4), p(.34, .87, 7.5), port(0, 4)]),
    electricity: curve(b, [p(.84, .52, 3.2), p(.89, .68, 5), port(2, 5)]),
  };
  const waterLegs = [curve(b, [port(0), p(.40, .93, 5.4), port(2)]),
    curve(b, [port(2), p(.68, 1.07, 5.4), port(3)]), curve(b, [port(3), p(.25, 1.07, 5.4), port(0)])];
  const pathMeshes = Object.entries(paths).map(([kind, path]) => {
    const color = kind === 'electricity' ? C.gold : kind === 'carbon-dioxide' ? '#9d9b8e' : kind === 'oxygen' ? C.darkGreen : kind === 'food' ? C.land : C.cool;
    const mesh = b.tube(path.getPoints(24).map((q: any) => q.toArray()), .30 * s, color, false); uniqueMaterial(b, mesh);
    const selection = kind === 'water' ? 1 : kind === 'electricity' ? 3 : 2; input([mesh], selection, '选择这条物资联系'); return { kind, mesh, color, selection };
  });
  const symbols = new Map<string, any>();
  for (const id of ['reclaimed-water-0', 'reclaimed-water-1', 'reclaimed-water-2', 'carbon-dioxide-transfer', 'oxygen-transfer', 'food-transfer', 'solar-electricity']) {
    const water = id.startsWith('reclaimed'), oxygen = id.startsWith('oxygen'), food = id.startsWith('food'), electric = id.startsWith('solar');
    const parts: any[] = [];
    const addPart = (geometry: any, color: string) => { const mesh = b.mesh(geometry, color, false); mesh.userData.transferId = id; parts.push(mesh); return mesh; };
    if (water) { const geometry = new T.SphereGeometry(1.5 * s, 16, 12); geometry.scale(.75, 1.5, .75); addPart(geometry, C.water); }
    else if (food) addPart(new T.BoxGeometry(3.1 * s, 2.2 * s, 2.5 * s), C.land);
    else if (electric) { const shape = new T.Shape(); [[.4, 2.2], [-1.2, -.1], [-.2, -.1], [-.7, -2.2], [1.3, .5], [.3, .5]].forEach(([x, y], i) => i ? shape.lineTo(x * s, y * s) : shape.moveTo(x * s, y * s)); shape.closePath(); addPart(new T.ExtrudeGeometry(shape, { depth: .55 * s, bevelEnabled: false }), C.gold); }
    else {
      const count = oxygen ? 2 : 3;
      for (let i = 0; i < count; i++) { const geometry = new T.SphereGeometry((oxygen ? 1.1 : i === 1 ? 1 : .95) * s, 12, 8); geometry.translate((i - (count - 1) / 2) * 1.9 * s, 0, 0); addPart(geometry, oxygen ? C.darkGreen : i === 1 ? C.rock : C.cool); }
      const bond = new T.CylinderGeometry(.22 * s, .22 * s, (count - 1) * 1.9 * s, 8); bond.rotateZ(Math.PI / 2); addPart(bond, C.ink);
    }
    parts.forEach(mesh => { mesh.userData.symbolKind = water ? 'water-drop' : food ? 'food-box' : electric ? 'electricity-mark' : oxygen ? 'oxygen-diatomic' : 'carbon-dioxide-triatomic'; });
    symbols.set(id, { parts, food, water });
  }
  const drag = handle(b, s, p, '拖动纸签，回看物资到舱与部件响应'); let state = evaluateMarsTransfer(0);
  return { update(phase, selection) {
    state = evaluateMarsTransfer(phase, selection); symbols.forEach(symbol => { symbol.parts.forEach((mesh: any) => { mesh.visible = false; }); });
    pathMeshes.forEach(({ mesh, color, selection: mode, kind }) => {
      const active = state.selected === mode; mesh.visible = state.selected === 0 || active; mesh.material.color.copy(new T.Color(color).lerp(new T.Color(C.rock), active ? 0 : .62));
      if (active) partial(b, paths[kind as keyof typeof paths], kind === 'water' ? skyProgress(.04, .99, phase) : state.packets.find(packet => packet.kind === kind)?.progress ?? 0, kind === 'water' ? 'flow' : 'accent', 1.0);
    });
    state.packets.forEach(packet => {
      const symbol = symbols.get(packet.id); if (!symbol) return;
      const at = packet.kind === 'water' ? waterLegs[packet.leg ?? 0].getPoint(packet.legProgress ?? 0) : paths[packet.kind].getPoint(packet.progress);
      if (packet.received && packet.kind === 'water') { const i = Number(packet.id.at(-1)), dock = skyEase(.94 + i * .025, Math.min(1, .97 + i * .025), phase); at.x += (i - 1) * 1.6 * s * dock; at.y += .7 * s * dock; at.z += 1.2 * s * dock; }
      if (packet.received && packet.kind === 'food') { at.x -= 3.7 * s * state.crewFoodResponse; at.y -= 1.8 * s * state.crewFoodResponse; at.z += 1.1 * s * state.crewFoodResponse; }
      symbol.parts.forEach((mesh: any) => { mesh.visible = packet.visible; mesh.position.copy(at); if (mesh.visible) b.outline(mesh, .7); });
    });
    const responses = [Math.max(state.crewOxygenResponse, state.crewFoodResponse, state.crewWaterReceived ? 1 : 0), state.plantResponse, Math.max(state.purifierResponse, state.powerResponse), state.reservoirResponse];
    windows.forEach((mesh, i) => { mesh.material.color.copy(new T.Color('#aabfc1').lerp(new T.Color(i === 1 ? C.green : C.water), responses[i] * .7)); b.outline(mesh, .3 + responses[i] * .25); });
    plantLeaves.forEach(mesh => { mesh.material.color.copy(new T.Color(C.green).lerp(new T.Color(C.darkGreen), state.plantResponse * .7)); });
    rotor.rotation.z = rotorCross.rotation.z = state.purifierStroke * Math.PI * .65; b.outline(rotor, .6); b.outline(rotorCross, .6);
    valve.rotation.z = state.purifierStroke * Math.PI * .45; b.outline(valve, .65);
    const tankFraction = .06 + .94 * state.reservoirResponse; tank.scale.y = tankFraction; tank.position.set(resources[0], resources[1] + (.7 + 2.6 * tankFraction) * s, resources[2] + 9.2 * s);
    b.contour([[resources[0] - 3.8 * s, resources[1] + .5 * s, resources[2] + 9.6 * s], [resources[0] - 3.8 * s, resources[1] + 6.1 * s, resources[2] + 9.6 * s], [resources[0] + 3.8 * s, resources[1] + 6.1 * s, resources[2] + 9.6 * s], [resources[0] + 3.8 * s, resources[1] + .5 * s, resources[2] + 9.6 * s]], .65);
    drinkingWater.scale.y = .05 + .95 * state.crewWaterResponse; drinkingWater.position.set(crew[0], crew[1] + (.65 + 1.1 * drinkingWater.scale.y) * s, crew[2] + 10.2 * s);
    oxygenPiston.position.y = crew[1] + (6.7 + 2.7 * state.crewOxygenResponse) * s; b.outline(oxygenPiston, .7);
    plantGasPiston.position.y = plants[1] + (2 + 3.4 * state.plantResponse) * s; b.outline(plantGasPiston, .7);
    foodTray.position.z = crew[2] + (9 + 2.4 * state.crewFoodResponse) * s; b.outline(foodTray, .65);
    powerSwitch.rotation.z = state.powerResponse * Math.PI / 2; b.outline(powerSwitch, .65);
    for (const [at, x, low, high] of [[crew, 5.5, 6.1, 10.2], [plants, 5.3, 1.2, 6.3]] as const) b.contour([[at[0] + (x - 1.4) * s, at[1] + low * s, at[2] + 9.7 * s], [at[0] + (x - 1.4) * s, at[1] + high * s, at[2] + 9.7 * s], [at[0] + (x + 1.4) * s, at[1] + high * s, at[2] + 9.7 * s], [at[0] + (x + 1.4) * s, at[1] + low * s, at[2] + 9.7 * s]], .4);
    moduleSurfaces.forEach((meshes, i) => { if (state.selected > 0 && ([0, 2, 1, 3][i] === state.selected || i === 0 && state.selected < 3)) meshes.slice(0, 3).forEach(mesh => b.outline(mesh, .5)); });
    drag(phase);
  }, focusBounds: () => ({ min: p(.01, .39, 0), max: p(1.01, 1.19, 34) }),
    describe: () => ({ kind: 'mars-base', ...state, construction:'open-sector-connected-cabins', receivingPartsOnCabinFloor:true,selectedCircuitOnly: true, receivingIndicatorsFollowArrival: true, chemicalSpeciesRemainDistinct: true, materialShapes: ['water-drop', 'carbon-dioxide-triatomic', 'oxygen-diatomic', 'food-box', 'electricity-mark'], receiverGeometryRetainsEndState: true, phaseMeaning: 'transfer-explanation-order' }) };
}

/** One ground slab receives identical shortwave input in every condition.
 * Its quiet front inlay records relative heat retained after longwave exchange. */
export function buildGreenhouseResponseWorld(b: TextbookGeometry): ModelMotion {
  const { s, p } = world(b);
  const hardware=createInstrumentParts(b);
  const setRadiationReceiver=mountRadiationReceiver(b,s);
  hardware.casting(p(.055,.584,-3),p(1.08,1.22,-1),'wood',.55*s);
  hardware.plate(p(.062,.592,-1.03),p(1.074,1.21,-.68),'brass',.16*s);
  const inset=b.mesh(chamferedPlateGeometry(p(.072,.608,-.72),p(1.063,1.184,-.55),.14*s),'#394e43',false,true,'enamel');
  inset.userData.causalRole='recessed-instrument-worktop';
  for(const x of [.095,1.03])for(const z of [.64,1.16])hardware.column(p(x,z,-4.4),p(x,z,-3),1.48*s);
  // A trunnion-mounted source collimates the same shortwave path in every
  // atmosphere trial. Its aperture lies at the exact first ray coordinate.
  const source=b.v(p(.10,.75,49)),axis=b.v(p(.29,.83,3.78)).sub(source).normalize();
  const axial=(n:number):Vec3=>source.clone().addScaledVector(axis,n*s).toArray() as Vec3;
  const pivot=axial(-4.3), foot=p(.075,.667,-.68);
  hardware.plate([foot[0]-2.3*s,foot[1],foot[2]-2.4*s],[foot[0]+2.3*s,foot[1]+1.1*s,foot[2]+2.4*s],'brass',.25*s);
  hardware.column([foot[0],foot[1]+1.1*s,foot[2]],[foot[0],pivot[1],foot[2]],1.32*s);
  hardware.shaft([foot[0],pivot[1],foot[2]],pivot,.61*s,'steel');
  b.mesh(turnedSleeveGeometry(axial(-8.1),axial(-.14),[[2.6*s,0],[3.2*s,.06],[3.2*s,.16],[2.82*s,.24],[2.68*s,.78],[3.5*s,.87],[3.5*s,1]],2.16*s),'#a6834c',false,true,'brass');
  b.mesh(turnedShaftGeometry(axial(-.41),axial(0),[[2.10*s,0],[2.05*s,1]]),'#edd396',false,true,'ivory');
  const ground = b.mesh(chamferedPlateGeometry(p(.09,.65,-.8),p(.93,1,3),.45*s), '#aa9370', false,true,'land');
  const scaleStart = p(.145,1.025,1.75), scaleLength = 73*s;
  // Local y runs up the inclined dial. The fill, graduations and moving
  // index all occupy parallel planes on this same physical front face.
  const faceAngle=-Math.PI*.28;
  const dialPoint=(x:number,y:number,z:number):Vec3=>[
    scaleStart[0]+x*s,scaleStart[1]+(y*Math.cos(faceAngle)-z*Math.sin(faceAngle))*s,
    scaleStart[2]+(y*Math.sin(faceAngle)+z*Math.cos(faceAngle))*s];
  const block=(x:number,y:number,z:number,w:number,h:number,d:number,bevel:number)=>{
    const geometry=chamferedPlateGeometry([-w*s/2,-h*s/2,-d*s/2],[w*s/2,h*s/2,d*s/2],bevel*s);
    geometry.rotateX(faceAngle);geometry.translate(...dialPoint(x,y,z));return geometry;
  };
  b.mesh(block(36.5,0,0,82,8.2,2.6,.65),'#3c524a',false,true,'enamel');
  b.mesh(block(36.5,0,1.26,78,6.8,.52,.23),'#aa8551',false,true,'brass');
  b.mesh(block(36.5,0,1.52,76.7,5.8,.26,.10),'#e5dcc4',false,true,'ivory');
  b.mesh(block(36.5,.62,1.68,73,1.4,.14,.05),'#817961',false,true,'enamel');
  const ticks=Array.from({length:21},(_,i)=>{
    const height=i%5===0?1.25:.65;
    return block(73*i/20,-1.92+height/2,1.72,.22,height,.10,.035);
  });
  b.mesh(mergeInstrumentGeometry(ticks),'#4a4940',false,true,'enamel');
  const inlay = b.mesh(new T.BoxGeometry(scaleLength,1.25*s,.16*s), '#ab5335',false,true,'enamel');
  inlay.rotation.x=faceAngle;inlay.userData.causalRole='relative-ground-heat-fill';
  const pointer=new T.Shape();
  pointer.moveTo(-1.35,2.6);pointer.lineTo(1.35,2.6);pointer.lineTo(1.35,1.7);pointer.lineTo(0,-1.65);pointer.lineTo(-1.35,1.7);pointer.closePath();
  const indexGeometry=new T.ExtrudeGeometry(pointer,{depth:.25,bevelEnabled:true,bevelThickness:.08,bevelSize:.08,bevelSegments:1});
  indexGeometry.scale(s,s,s);indexGeometry.rotateX(faceAngle);
  const heatNeedle=b.mesh(indexGeometry,'#39463f',false,true,'enamel');
  heatNeedle.userData.causalRole='relative-ground-heat-position';
  uniqueMaterial(b,ground);
  applyEarthScan(ground.material,'loam',10*s);
  const air: any[] = [];
  const airHeight=29+5*Math.sin(Math.PI*(.55-.12)/.77);
  const veilGeometry=new T.CircleGeometry(1,56);veilGeometry.rotateX(-Math.PI/2);
  veilGeometry.scale(10.56*s,1,10.56*b.height/100);veilGeometry.translate(...p(.554,.83,airHeight-.12));
  const veil=b.mesh(veilGeometry,'#a6c7c6',false,false,'air');
  veil.material=createSpecimenMaterial(b.pop,{role:'air',color:'#a6c7c6'});
  veil.material.opacity=.19;veil.material.depthWrite=false;veil.castShadow=false;veil.userData.castShadow=false;
  air.push(veil);
  const cloudAt=p(.554,.83,35.3), cloudVertices:number[]=[],cloudIndices:number[]=[];
  const sides=24, slices=36;
  cloudVertices.push(cloudAt[0]-12*s,cloudAt[1],cloudAt[2]);
  for(let i=1;i<slices;i++){
    const u=i/slices,x=24*u-12;
    for(let j=0;j<sides;j++){
      const angle=2*Math.PI*j/sides, upper=Math.sin(angle);
      const edge=Math.pow(Math.sin(Math.PI*u),.55);
      const lobes=1+.20*Math.sin(4.7*Math.PI*u+.65*Math.cos(angle))+.11*Math.cos(8*Math.PI*u-angle);
      const y=edge*lobes*upper*(upper>0?4.8:1.55);
      const z=edge*(4.5*lobes*Math.cos(angle)+.8*Math.sin(5*u));
      cloudVertices.push(cloudAt[0]+x*s,cloudAt[1]+y*s,cloudAt[2]+z*s);
      const k=1+(i-1)*sides+j,next=1+(i-1)*sides+(j+1)%sides;
      if(i===1)cloudIndices.push(0,k,next);
      if(i<slices-1)cloudIndices.push(k,k+sides,next,next,k+sides,next+sides);
      else cloudIndices.push(k,1+(slices-1)*sides,next);
    }
  }
  cloudVertices.push(cloudAt[0]+12*s,cloudAt[1],cloudAt[2]);
  const cloudGeometry=new T.BufferGeometry();
  cloudGeometry.setAttribute('position',new T.Float32BufferAttribute(cloudVertices,3));
  cloudGeometry.setIndex(cloudIndices);cloudGeometry.computeVertexNormals();
  const cloud=b.mesh(cloudGeometry,'#ece9da',false,true,'air');
  const short = curve(b, [p(.10, .75, 49), p(.29, .83, 3.78)]);
  const longSpace = curve(b, [p(.46, .83, 3.3), p(.49, .83, 20), p(.53, .83, 49)]);
  const airContact=p(.55,.83,29+5*Math.sin(Math.PI*(.55-.12)/.77));
  const longAir = curve(b, [p(.46, .83, 3.3), p(.49, .83, 17), airContact]);
  const down = curve(b, [airContact, p(.67, .83, 19), p(.68, .83, 3.78)]), up = curve(b, [airContact, p(.73, .83, 40), p(.83, .83, 49)]);
  // Each ray retains its direction at rest. Advancing only the draw range
  // keeps the same path buffers through a complete forward or reverse seek.
  const ray=(path:any,tint:string)=>{
    const steps=64,sides=8;
    const geometry=new T.TubeGeometry(path,steps,.34*s,sides,false);
    const trail=b.mesh(geometry,tint,false,true,'enamel');
    const head=b.mesh(new T.ConeGeometry(1.34*s,3.3*s,12),tint,false,true,'enamel');
    const axis=new T.Vector3(0,1,0);
    return (q:number)=>{
      trail.visible=head.visible=q>.004;
      if(!head.visible)return;
      geometry.setDrawRange(0,Math.floor(steps*q)*sides*6);
      const tangent=path.getTangentAt(q);
      const size=Math.min(1,path.getLength()*q/(3.3*s));
      head.scale.setScalar(size);
      head.position.copy(path.getPointAt(q)).addScaledVector(tangent,-1.65*s*size);
      head.quaternion.setFromUnitVectors(axis,tangent);
    };
  };
  const sunlight=ray(short,'#c6953c'), escape=ray(longSpace,'#b25e45'), absorption=ray(longAir,'#b25e45');
  const backRadiation=ray(down,'#b25e45'),spaceRadiation=ray(up,'#b25e45');
  const receivers=[.29,.68].map(x=>{
    const at=p(x,.83,3.16);
    return b.mesh(turnedShaftGeometry(at,[at[0],at[1]+.48*s,at[2]],[[3.8*s,0],[4*s,.22],[3.8*s,.7],[3.4*s,1]]),'#a68049',false,true,'brass');
  });
  const disks=receivers.map((_,i)=>{
    const at=p(i===0?.29:.68,.83,3.66);
    const disk=b.mesh(turnedShaftGeometry(at,[at[0],at[1]+.1*s,at[2]],[[3.23*s,0],[3.23*s,1]]),'#685f52',false,true,'rock');
    uniqueMaterial(b,disk);return disk;
  });
  const tags = [label(b, '太阳短波', p(.09,.68,62), s), label(b, '地面长波', p(.36, .69, 18), s), label(b, '大气逆辐射', p(.83, .84, 22), s)];
  input([ground, inlay,...disks,...receivers], 0, '比较没有大气时的长波损失'); input(air, 1, '比较有大气时向上、向下的长波辐射'); input([cloud], 2, '比较低云条件下的长波交换');
  for(const m of [ground,inlay,...disks,...receivers,...air,cloud])m.userData.modelInput.keepPhase=true;
  const covers=mountSpecimenDial(b,p(1.012,1.12,5.95),6.3*s,{label:'拨动试验盘，换大气条件',choices:['无大气','有大气','低云']});
  let state=evaluateGreenhouseResponse(0);
  return { update(phase, selection) {
    covers(phase,selection);setRadiationReceiver(phase,selection);
    state = evaluateGreenhouseResponse(phase, selection); air.forEach(mesh => { mesh.visible = state.atmosphere; }); cloud.visible=state.cloud;
    tags[1].visible = phase >= .33; tags[2].visible = state.atmosphere && phase >= .6;
    inlay.scale.x = state.groundHeat; inlay.position.set(...dialPoint(36.5*state.groundHeat,.62,1.83));
    heatNeedle.position.set(...dialPoint(73*state.groundHeat,0,2.08));
    ground.material.color.set('#aa9370').lerp(new T.Color('#b88157'),state.returnReceived*.45);
    sunlight(state.shortwave);escape(state.atmosphere?0:state.emitted);absorption(state.atmosphere?state.emitted:0);
    backRadiation(state.returned);spaceRadiation(state.atmosphere?state.spaceEmission:0);
    disks[0].material.color.set('#685f52').lerp(new T.Color('#d49d4e'),state.solarArrival);
    disks[1].material.color.set('#685f52').lerp(new T.Color('#c5684c'),state.returnReceived);
    if (state.returnReceived > 0) b.contour(ringPath(p(.68, .84, 3.25), (3 + state.returnReceived * 3) * s, 'xz', .55), .65);
    b.outline(ground, .26);
  }, focusBounds: () => ({ min:p(.013,.56,-4.4),max:p(1.108,1.26,65) }),
    describe: () => ({ kind: 'greenhouse', ...state, groundHeatIndicator: { relativeOnly: true, fixedTrack: true, position: state.groundHeat, resultRetained: true }, sameGroundAndSolarInput: true, receiverResponseAfterArrival: true, atmosphereAbsorbsLongwave: state.atmosphere, upwardAndDownwardEmission: state.atmosphere, enhancedCloudBackRadiation: state.cloud, phaseMeaning: 'explanation-order' }) };
}

/** All vectors act on one parcel. The previous wind is a quiet dashed memory;
 * equilibrium conditions are compared directly, without a false chronology. */
export function buildWindForceParcelWorld(b: TextbookGeometry): ModelMotion {
  const { s, p } = world(b), origin = p(.52, .77, 5.4);
  const at=(x:number,y:number,z:number):Vec3=>[origin[0]+x*s,y*s,origin[2]+z*s];
  const pivot = at(0, 0, 0);
  const parts = mountFieldInstrument(b, 'wind-forces', s, pivot);
  const windDial=mountSpecimenDial(b,at(1,4.2,30),4.9*s,{label:'拨动条件盘，比较同一气团的受力',choices:['只受气压梯度力','北半球高空','北半球近地面','南半球近地面']});
  const vanes = parts.get('vane')!;
  const parcel = parts.get('pivot')![0];
  const selectParcel = { kind: 'select', selection: 1, label: '比较同一气团所受的力' };
  for (const mesh of [...vanes, parcel]) mesh.userData.modelInput = selectParcel;
  for (const mesh of vanes) {
    mesh.geometry.translate(-pivot[0], -pivot[1], -pivot[2]);
    mesh.position.set(...pivot);
  }
  for (const [x, text] of [[-38, '高压'], [38, '低压']] as const) {
    const plaque = b.label(text, at(x, 2.69, 22.43), 12.6 * s, 8.15 * s,
      { appearance: 'engraved', ink: '#423a2d' });
    plaque.rotation.x = .43 - Math.PI / 2;
    plaque.userData.labelMount = 'surface';
  }
  const tags = [label(b, '气压梯度力', p(.84, .75, 29), s, 28),
    b.label('偏向力', p(.24, .52, 14), 23 * s, 6.48 * s),
    label(b, '摩擦力', p(.39, 1.02, 14), s, 23), label(b, '风向', p(.58, .55, 18), s, 17)];
  const shapeArrow = (color: string, radius: number) => {
    const shaft = b.mesh(new T.CylinderGeometry(radius, radius, 1, 10), color, false), tip = b.mesh(new T.ConeGeometry(radius * 2.6, radius * 4.6, 10), color, false); return { shaft, tip };
  };
  const vectors = [shapeArrow('#aa5640', .57 * s), shapeArrow('#667fa3', .57 * s), shapeArrow('#726750', .57 * s)];
  const pose = ({ shaft, tip }: ReturnType<typeof shapeArrow>, vector: readonly number[], length: number, height: number) => {
    const direction = new T.Vector3(vector[0], 0, vector[1]), magnitude = direction.length(); shaft.visible = tip.visible = magnitude > .001;
    if (!shaft.visible) return; direction.normalize(); const len = magnitude * length * s, head = Math.min(3.8 * s, len * .27), from = b.v(origin).add(new T.Vector3(0, height * s, 0));
    shaft.scale.y = len - head; shaft.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction); shaft.position.copy(from).addScaledVector(direction, (len - head) / 2);
    tip.quaternion.copy(shaft.quaternion); tip.position.copy(from).addScaledVector(direction, len - head / 2); tip.scale.y = head / (tip.geometry.parameters.height || 1);
    b.outline(shaft, .4); b.outline(tip, .45);
  };
  let state = evaluateWindForces(0), previousWind: readonly number[] = state.wind, previousSelection = 0;
  return { update(_phase, selection) {
    windDial(0,selection);
    const next = evaluateWindForces(selection); if (next.selected !== previousSelection) { previousWind = state.wind; previousSelection = next.selected; } state = next;
    pose(vectors[0], state.gradient, 24, 0); pose(vectors[1], state.coriolis, 24, 0); pose(vectors[2], state.friction, 24, 0);
    const bearing = -Math.atan2(state.wind[1], state.wind[0]);
    for (const mesh of vanes) mesh.rotation.y = bearing;
    for (let i = 0; i < 8; i++) {
      const a = (i + .15) / 8 * 28, c = (i + .62) / 8 * 28;
      b.contour([[origin[0] + previousWind[0] * a * s, origin[1] + 1.7 * s, origin[2] + previousWind[1] * a * s], [origin[0] + previousWind[0] * c * s, origin[1] + 1.7 * s, origin[2] + previousWind[1] * c * s]], .25);
    }
    tags[1].visible = state.selected > 0; tags[2].visible = state.selected > 1;
    b.contour(ringPath(origin, 3.1 * s, 'xz'), parcel.userData.modelHovered ? .85 : .5);
    const windTip = b.v(at(state.wind[0]*29.8,7.76,state.wind[1]*29.8));
    tags[3].position.set(...at(state.wind[0]*39+3,12,state.wind[1]*37+2));
    tags[0].position.set(...at(32,14,-12));
    if(state.selected>0){
      tags[1].position.set(...at(-31,11,state.selected===1?-8:state.selected===2?21:-24));
      const end=at(state.coriolis[0]*24,5.4,state.coriolis[1]*24);
      b.contour([end,tags[1].position.toArray() as Vec3],.35);
    }
    if(state.selected>1){
      tags[2].position.set(...at(-12,11,state.selected===2?-23:25));
      b.contour([at(state.friction[0]*24,5.4,state.friction[1]*24),tags[2].position.toArray() as Vec3],.35);
    }
    const relative = tags[3].position.clone().sub(tags[0].position).applyQuaternion(tags[0].quaternion.clone().invert());
    if (Math.abs(relative.x) < 28 * s && Math.abs(relative.y) < 13 * s) {
      const up = new T.Vector3(0, 1, 0).applyQuaternion(tags[0].quaternion);
      tags[3].position.addScaledVector(up, 13 * s - relative.y);
    }
    b.contour([windTip.toArray() as Vec3,tags[3].position.toArray() as Vec3],.3);
  }, focusBounds: () => ({ min: at(-49,-4,-39), max: at(49,34,39) }),
    describe: () => ({ kind: 'wind-forces', ...state, windXZ: state.wind, pressureGradientXZ: state.gradient, previousWindXZ: previousWind, sameAirParcel: true, previousWindIsComparisonOnly: true, phaseMeaning: 'static-condition', coriolisPerpendicularToWind: true, frictionOppositeToWind: state.selected > 1, nearSurfaceCrossIsobars: state.selected > 1, forceScaleIsMeasured: false }) };
}

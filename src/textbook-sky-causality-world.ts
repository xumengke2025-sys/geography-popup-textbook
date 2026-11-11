import { THREE as T } from './reference/engine.js';
import { createSpecimenMaterial } from './textbook-solid-materials';
import { PALETTE as C, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint } from './textbook-model-input';
import { buildMarsCabin } from './textbook-mars-cabin';
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
  const sunMesh = ball(b, 12 * s, C.gold, sun), earthParts = globe(b, earth, 11 * s);
  input([sunMesh], 1, '从太阳活动出发，回看同一扰动'); input(earthParts, 1, '查看扰动到达磁层后的极区响应');
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
  const drag = handle(b, s, p, '拖动纸签，回看太阳扰动出发、到达与极区响应');
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
    polarLabel.visible = state.polarReceived; drag(phase);
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
  const { s, p } = world(b), z0 = p(0, .59)[2], z1 = p(0, 1)[2];
  const height = (x: number) => (2 + 11 * Math.exp(-((x / b.width - .25) ** 2) / .027)) * s;
  const ground = b.terrain(.05 * b.width, .65 * b.width, z0, z1, height, C.rock, 28, 12);
  const sea = b.box(p(.65, .59, .3), p(.96, 1, 2), C.sea);
  const cloudAt = p(.49, .70, 36), clouds = [[-.28, 0, .24], [0, .07, .31], [.30, -.02, .22]].map(([x, y, r]) => ball(b, r * 18 * s, C.paper, [cloudAt[0] + x * 18 * s, cloudAt[1] + y * 18 * s, cloudAt[2]], [1, .64, .63]));
  const treeAt = p(.36, .89, height(.36 * b.width) / s), leaves: any[] = [];
  b.cylinder(treeAt, [treeAt[0], treeAt[1] + 16 * s, treeAt[2]], .45 * s, C.rock);
  for (const [dx, dy, r] of [[-3, 13, 4.8], [2, 16, 5.5], [5, 12, 3.7]]) { const m = ball(b, r * s, C.green, [treeAt[0] + dx * s, treeAt[1] + dy * s, treeAt[2]], [1, .84, .8]); uniqueMaterial(b, m); leaves.push(m); }
  const river: Vec3[] = [.18, .30, .42, .54, .69].map((u, i) => [u * b.width, height(u * b.width) + .35 * s, z0 + (z1 - z0) * (.2 + i * .16)]);
  b.tube(river, .75 * s, C.water);
  const soilAt = p(.36, 1.015, 5), wet = b.mesh(new T.BoxGeometry(15 * s, 2.6 * s, .5 * s), '#799b9c', false); wet.position.set(...soilAt);
  const roots = [[soilAt, p(.34, .97, 10), treeAt], [p(.41, 1.01, 4), p(.39, .96, 8), treeAt]];
  roots.forEach(path => b.tube(path, .28 * s, C.darkGreen));
  const waterPaths = [curve(b, [p(.81, .85, 3), p(.78, .81, 22), cloudAt]), curve(b, [cloudAt, p(.42, .72, 34), p(.29, .73, 15)]), curve(b, [p(.29, .73, 15), ...river.slice(1), p(.82, .88, 3)])];
  const biologyPaths = [curve(b, [soilAt, p(.35, .97, 9), treeAt, p(.37, .89, treeAt[1] / s + 17)]), curve(b, [p(.37, .89, treeAt[1] / s + 17), p(.40, .81, 30), cloudAt])];
  const symbols = ['water-a', 'water-b', 'water-c'].map(id => waterSymbol(b, s, id));
  const tags = [label(b, '大气圈', p(.55, .57, 45), s), label(b, '水圈', p(.85, 1.06, 6), s), label(b, '生物圈', p(.27, .91, 29), s), label(b, '岩石圈', p(.16, 1.04, 2), s)];
  input([sea, clouds[0], tags[1], tags[0]], 1, '追踪同一批水在圈层之间的迁移'); input([...leaves, tags[2]], 2, '追踪根吸水、叶片接收与蒸腾'); input([ground, tags[3]], 0, '查看同一地景中的圈层联系');
  const drag = handle(b, s, p, '拖动纸签，回看同一批水的交换与接收'); let state = evaluateSphereExchange(0);
  return { update(phase, selection) {
    state = evaluateSphereExchange(phase, selection); wet.scale.x = .5 + .5 * state.soilResponse;
    leaves.forEach(mesh => { mesh.material.color.copy(new T.Color(C.green).lerp(new T.Color(C.darkGreen), state.leafResponse * .55)); b.outline(mesh, .35 + state.leafResponse * .25); });
    symbols.forEach(({ drop, frame }, i) => {
      const t = skyClamp(phase - i * .018), bio = state.biological;
      const vapor = bio ? t >= .63 : t < .22;
      const point = bio ? t < .42 ? biologyPaths[0].getPoint(skyProgress(.06, .42, t)) : t < .63 ? biologyPaths[0].getPoint(1) : biologyPaths[1].getPoint(skyProgress(.63, .95, t))
        : t < .22 ? waterPaths[0].getPoint(skyProgress(.03, .22, t)) : t < .50 ? waterPaths[1].getPoint(skyProgress(.30, .50, t)) : waterPaths[2].getPoint(skyProgress(.50, .98, t));
      drop.visible = !vapor; frame.visible = vapor; drop.position.copy(point); frame.position.copy(point);
      const mesh = vapor ? frame : drop; mesh.position.x += (i - 1) * 1.6 * s; b.outline(mesh, .6);
    });
    clouds.forEach(mesh => { mesh.scale.setScalar(.80 + .2 * state.cloudResponse); b.outline(mesh, .35); });
    if (state.biological) { partial(b, biologyPaths[0], skyProgress(.06, .42, phase)); if (phase >= .63) partial(b, biologyPaths[1], skyProgress(.63, .95, phase)); }
    else { partial(b, waterPaths[0], skyProgress(.03, .22, phase)); if (phase >= .30) partial(b, waterPaths[1], skyProgress(.30, .50, phase)); if (phase >= .50) partial(b, waterPaths[2], skyProgress(.50, .98, phase)); }
    drag(phase);
  }, focusBounds: () => ({ min: p(.02, .54, -2), max: p(.99, 1.19, 49) }),
    describe: () => ({ kind: 'external-spheres', ...state, vaporSymbol: 'open-frame', liquidSymbol: 'drop', spheresAlwaysPresent: true, identitySurvivesPhaseChange: true, phaseMeaning: 'exchange-explanation-order' }) };
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
  const { s, p } = world(b), ground = b.box(p(.09, .65, 0), p(.93, 1, 3), C.land);
  const scaleStart = p(.145, 1.017, 1.75), scaleLength = 73 * s;
  const scaleTrack = b.mesh(new T.BoxGeometry(scaleLength, 2.5 * s, .55 * s), '#d0cab9', false); scaleTrack.position.set(scaleStart[0] + scaleLength / 2, scaleStart[1], scaleStart[2]);
  const inlay = b.mesh(new T.BoxGeometry(scaleLength, 2.1 * s, .65 * s), C.warm, false); uniqueMaterial(b, inlay); inlay.userData.causalRole = 'relative-ground-heat-fill';
  const heatNeedle = b.mesh(new T.BoxGeometry(.65 * s, 3.5 * s, .7 * s), C.ink, false); heatNeedle.userData.causalRole = 'relative-ground-heat-position';
  const receiving = b.mesh(new T.PlaneGeometry(22 * s, 12 * s), C.land, false, false); receiving.rotation.x = -Math.PI / 2; receiving.position.set(...p(.63, .84, 3.12)); uniqueMaterial(b, receiving);
  const air: any[] = [];
  for (const depth of [.69, .96]) {
    const points = Array.from({ length: 49 }, (_, i): Vec3 => { const u = i / 48; return p(.12 + u * .77, depth, 29 + 5 * Math.sin(u * Math.PI)); }); air.push(b.tube(points, .22 * s, C.cool));
  }
  const cloudAt = p(.61, .80, 32), clouds = [[-.27, 0, .24], [0, .07, .31], [.30, -.02, .22]].map(([x, y, r]) => ball(b, r * 19 * s, C.paper, [cloudAt[0] + x * 19 * s, cloudAt[1] + y * 19 * s, cloudAt[2]], [1, .64, .63]));
  const short = curve(b, [p(.10, .75, 49), p(.29, .82, 3.3)]);
  const longSpace = curve(b, [p(.46, .83, 3.3), p(.49, .83, 20), p(.53, .83, 49)]);
  const longAir = curve(b, [p(.46, .83, 3.3), p(.49, .83, 17), p(.55, .83, 31)]);
  const down = curve(b, [p(.55, .83, 31), p(.67, .83, 19), p(.68, .83, 3.3)]), up = curve(b, [p(.55, .83, 31), p(.73, .83, 40), p(.83, .83, 49)]);
  const photons = [ball(b, 1.25 * s, C.gold), ball(b, 1.15 * s, C.warm), ball(b, 1.15 * s, C.warm), ball(b, 1.15 * s, C.warm)];
  const tags = [label(b, '太阳短波', p(.13, .66, 48), s), label(b, '地面长波', p(.36, 1.02, 14), s), label(b, '大气逆辐射', p(.81, .98, 22), s)];
  input([ground, inlay], 0, '比较没有大气时的长波损失'); input(air, 1, '比较有大气时向上、向下的长波辐射'); input(clouds, 2, '比较低云条件下的长波交换');
  const drag = handle(b, s, p, '拖动纸签，回看地面吸收、长波传递与接收响应'); let state = evaluateGreenhouseResponse(0);
  return { update(phase, selection) {
    state = evaluateGreenhouseResponse(phase, selection); air.forEach(mesh => { mesh.visible = state.atmosphere; }); clouds.forEach(mesh => { mesh.visible = state.cloud; if (mesh.visible) b.outline(mesh, .35); });
    tags[1].visible = phase >= .33; tags[2].visible = state.atmosphere && phase >= .6;
    inlay.scale.x = state.groundHeat; inlay.position.set(scaleStart[0] + scaleLength * state.groundHeat / 2, scaleStart[1], scaleStart[2] + .45 * s);
    heatNeedle.position.set(scaleStart[0] + scaleLength * state.groundHeat, scaleStart[1], scaleStart[2] + .8 * s);
    for (const mark of [0, .25, .5, .75, 1]) b.contour([[scaleStart[0] + scaleLength * mark, scaleStart[1] - 1.6 * s, scaleStart[2] + .9 * s], [scaleStart[0] + scaleLength * mark, scaleStart[1] - 1.1 * s, scaleStart[2] + .9 * s]], .45);
    receiving.material.color.copy(new T.Color(C.land).lerp(new T.Color(C.warm), state.returnReceived * .7));
    photons[0].visible = phase >= .02 && phase < .18; photons[0].position.copy(short.getPoint(state.shortwave)); partial(b, short, state.shortwave, 'accent', 1.1);
    const outgoing = state.atmosphere ? longAir : longSpace; photons[1].visible = phase >= .33 && phase < .52; photons[1].position.copy(outgoing.getPoint(state.emitted)); partial(b, outgoing, state.emitted, 'accent', 1.25);
    photons[2].visible = state.atmosphere && phase >= .60 && phase < .78; photons[2].position.copy(down.getPoint(state.returned));
    photons[3].visible = state.atmosphere && phase >= .60 && phase < .9; photons[3].position.copy(up.getPoint(state.spaceEmission));
    if (state.atmosphere && phase >= .60) { partial(b, down, state.returned, 'accent', state.cloud ? 1.5 : 1.15); partial(b, up, state.spaceEmission, 'accent', .8); }
    if (state.returnReceived > 0) b.contour(ringPath(p(.68, .84, 3.25), (3 + state.returnReceived * 3) * s, 'xz', .55), .65);
    b.outline(ground, .4); drag(phase);
  }, focusBounds: () => ({ min: p(.04, .58, -1), max: p(.99, 1.19, 55) }),
    describe: () => ({ kind: 'greenhouse', ...state, groundHeatIndicator: { relativeOnly: true, fixedTrack: true, position: state.groundHeat, resultRetained: true }, sameGroundAndSolarInput: true, receiverResponseAfterArrival: true, atmosphereAbsorbsLongwave: state.atmosphere, upwardAndDownwardEmission: state.atmosphere, enhancedCloudBackRadiation: state.cloud, phaseMeaning: 'explanation-order' }) };
}

/** All vectors act on one parcel. The previous wind is a quiet dashed memory;
 * equilibrium conditions are compared directly, without a false chronology. */
export function buildWindForceParcelWorld(b: TextbookGeometry): ModelMotion {
  const { s, p } = world(b), origin = p(.52, .77, 5.4);
  b.box(p(.04, .34, 0), p(.96, 1.08, 1.2), C.paper);
  for (let i = 0; i < 6; i++) b.stroke([p(.12 + i * .15, .41, 1.4), p(.12 + i * .15, 1.01, 1.4)], .3);
  label(b, '高压', p(.11, 1.02, 7), s); label(b, '低压', p(.88, 1.02, 7), s);
  const parcel = ball(b, 3 * s, '#dce3d4', origin, [1, .7, 1]);
  parcel.userData.modelInput = { kind: 'select', selection: 1, label: '比较同一个空气对象所受的力' };
  const tags = [label(b, '气压梯度力', p(.84, .75, 29), s, 28), label(b, '偏向力', p(.24, .52, 14), s, 23), label(b, '摩擦力', p(.39, 1.02, 14), s, 23), label(b, '风向', p(.58, .55, 18), s, 17)];
  const shapeArrow = (color: string, radius: number) => {
    const shaft = b.mesh(new T.CylinderGeometry(radius, radius, 1, 10), color, false), tip = b.mesh(new T.ConeGeometry(radius * 2.6, radius * 4.6, 10), color, false); return { shaft, tip };
  };
  const vectors = [shapeArrow(C.warm, .40 * s), shapeArrow(C.cool, .40 * s), shapeArrow(C.rock, .40 * s), shapeArrow(C.water, .65 * s)];
  const pose = ({ shaft, tip }: ReturnType<typeof shapeArrow>, vector: readonly number[], length: number, height: number) => {
    const direction = new T.Vector3(vector[0], 0, vector[1]), magnitude = direction.length(); shaft.visible = tip.visible = magnitude > .001;
    if (!shaft.visible) return; direction.normalize(); const len = magnitude * length * s, head = Math.min(3.8 * s, len * .27), from = b.v(origin).add(new T.Vector3(0, height * s, 0));
    shaft.scale.y = len - head; shaft.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction); shaft.position.copy(from).addScaledVector(direction, (len - head) / 2);
    tip.quaternion.copy(shaft.quaternion); tip.position.copy(from).addScaledVector(direction, len - head / 2); tip.scale.y = head / (tip.geometry.parameters.height || 1);
    b.outline(shaft, .4); b.outline(tip, .45);
  };
  let state = evaluateWindForces(0), previousWind: readonly number[] = state.wind, previousSelection = 0;
  return { update(_phase, selection) {
    const next = evaluateWindForces(selection); if (next.selected !== previousSelection) { previousWind = state.wind; previousSelection = next.selected; } state = next;
    pose(vectors[0], state.gradient, 24, 0); pose(vectors[1], state.coriolis, 24, 0); pose(vectors[2], state.friction, 24, 0); pose(vectors[3], state.wind, 30, 1.8);
    for (let i = 0; i < 8; i++) {
      const a = (i + .15) / 8 * 28, c = (i + .62) / 8 * 28;
      b.contour([[origin[0] + previousWind[0] * a * s, origin[1] + 1.7 * s, origin[2] + previousWind[1] * a * s], [origin[0] + previousWind[0] * c * s, origin[1] + 1.7 * s, origin[2] + previousWind[1] * c * s]], .25);
    }
    tags[1].visible = state.selected > 0; tags[2].visible = state.selected > 1;
    b.contour(ringPath(origin, 3.1 * s, 'xz'), parcel.userData.modelHovered ? .85 : .5);
    const windTip = b.v(origin).add(new T.Vector3(state.wind[0] * 33 * s, 6 * s, state.wind[1] * 33 * s)); tags[3].position.copy(windTip);
    const relative = tags[3].position.clone().sub(tags[0].position).applyQuaternion(tags[0].quaternion.clone().invert());
    if (Math.abs(relative.x) < 28 * s && Math.abs(relative.y) < 13 * s) {
      const up = new T.Vector3(0, 1, 0).applyQuaternion(tags[0].quaternion);
      tags[3].position.addScaledVector(up, 13 * s - relative.y);
      b.contour([windTip.toArray() as Vec3, tags[3].position.clone().addScaledVector(up, -3.5 * s).toArray() as Vec3], .3);
    }
  }, focusBounds: () => ({ min: p(.01, .26, 0), max: p(1.01, 1.13, 34) }),
    describe: () => ({ kind: 'wind-forces', ...state, windXZ: state.wind, pressureGradientXZ: state.gradient, previousWindXZ: previousWind, sameAirParcel: true, previousWindIsComparisonOnly: true, phaseMeaning: 'static-condition', coriolisPerpendicularToWind: true, frictionOppositeToWind: state.selected > 1, nearSurfaceCrossIsobars: state.selected > 1, forceScaleIsMeasured: false }) };
}

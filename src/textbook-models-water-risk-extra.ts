import { floodBasinWorld } from './textbook-flood-basin-world';
import { createSoilSpecimenFinish } from './textbook-soil-specimen-finish';
import { mountDroughtCrops, mountDroughtSoil } from './textbook-drought-soil';
import { mountDroughtRecorder } from './textbook-hydrology-recorders';
import { THREE as T } from './reference/engine.js';
import { PALETTE as C, LIFT_MARGIN, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { buildDisasterChainWorld } from './textbook-disaster-chain-world';
import { buildSalinityWorld } from './textbook-salinity-world';
import { buildDesalinationInstrumentWorld } from './textbook-desalination-instrument';
import { buildDensityInstrumentWorld } from './textbook-density-world';
import { buildWarehouseWorld } from './textbook-warehouse-world';
import { evaluateDroughtSequence, evaluateFloodSequence } from './textbook-ground-process-model';

/** References are printed textbook pages, not PDF indices (PDF = page + 5).
 * Quantities, dimensions and elapsed animation time below are illustrative.
 * The original textbook page is never sampled, erased or mapped onto a model. */
export const WATER_RISK_EXTRA_METADATA = {
  salinity: { pages: [52, 53], controls: ['蒸发增强', '降水增多', '河流注入'], note: '盐类颗粒表示相对盐量。只比较蒸发、降水或入海径流改变海水量时的盐度趋势；不表示盐度实测值，也不把全球盐度仅归因于温度。' },
  density: { pages: [55], controls: ['相同条件', '只降低温度', '只增加盐度'], note: '等体积海水的质量比较。每次只改变一个条件；一般情况下，降温或增盐会增大密度。天平与颗粒均为关系示意，不给出实际密度、比例或海洋分层预测；深度压力暂不模拟。' },
  desalination: { pages: [63, 64], controls: ['重力排盐', '破碎离心'], note: '按教材两种海冰淡化方法示意盐水与冰分离。保留部分包裹盐水，不表示处理后立即可饮用；时间、转速、温度和产水量均不按真实尺度。高浓度盐水需要妥善处理，不能直接据动画判断生态或经济可行性。' },
  flood: { pages: [100, 101], controls: ['正常水位', '连续强降水'], note: '连续强降水使汇流增加，河水可漫过河岸并淹没低地。只展示一种成因联系；水位和时长不是真实洪水预报，灾害损失还与人口、设施和防御条件有关。' },
  drought: { pages: [101, 102], controls: ['水分充足', '持续少雨'], note: '持续少雨引起土壤缺水、水源减少和作物受影响的关系示意。植株倾垂和水位仅表示趋势，不表示作物产量、旱情阈值或所有地区的响应速度。' },
  'urban-waterlogging': { pages: [96, 97, 98], controls: ['硬化地面', '透水地面', '雨水花园'], note: '相同示意降水下比较地表径流、下渗与蓄积。雨水花园的土壤和排水空间可延缓径流，但不能保证任何暴雨下都不积水；不把教材特定案例的削减率套用于所有城市。' },
  gnss: { pages: [114, 116], controls: ['卫星与地面', '接收定位', '定位助救援'], note: '只用少量卫星展示空间、地面控制和用户三部分的联系，不是实际星座数量或轨道。求救阶段表示定位设备与通信协同，不能理解为任何GNSS接收机都能直接发卫星求救信息；未计算坐标或定位精度。' },
  warehouse: { pages: [120, 121], controls: ['近河低地', '路网节点', '偏远山地'], note: '虚构地形、道路和聚落用于比较储备库的灾害暴露、交通通达和服务范围，不是现实选址结论，也没有计算24小时到达范围或推荐任何真实地点。' },
  'disaster-chain': { pages: [108, 109, 115], controls: ['旱灾关联', '地震关联'], note: '按教材灾害链活动展示两种选定情景：沿海淡水不足后加抽地下水，松软层压密，海水侵入相连含水层；松散陡坡因地震滑移堵河，上游蓄湖，在选定溃决条件下出现下游洪水。并非每次旱灾或地震都会发生这些后果；进度不表示实际时长，不计算概率或预报。' },
} as const;

type World = ReturnType<typeof world>;
const bounded = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const ease = (n: number) => { const q = bounded(n); return q * q * (3 - 2 * q); };

/** One physical tabletop scene, using the same scale regardless of source crop.
 * The host's TextbookIllustration lifts this root with the original Popout. */
function world(b: TextbookGeometry) {
  const s = b.width / 100, back = -LIFT_MARGIN - 78 * s;
  const p = (x: number, z: number, y = 0): Vec3 => [x * s, y * s, back + z * s];
  const box = (x: number, z: number, w: number, d: number, bottom: number, top: number, color = C.paper, edges = true) =>
    b.box(p(x - w / 2, z - d / 2, bottom), p(x + w / 2, z + d / 2, top), color, edges);
  const label = (text: string, x: number, z: number, y: number, width = Math.max(10, text.length * 3.4), height = 4.8) =>
    b.label(text, p(x, z, y), width * s, height * s);
  const movingBox = (w: number, h: number, d: number, color = C.paper) => b.mesh(new T.BoxGeometry(w * s, h * s, d * s), color, false);
  return { b, s, p, box, label, movingBox };
}

function set(mesh: any, q: Vec3) { mesh.position.set(...q); }
function rain(w: World, phase: number, x0: number, x1: number, z: number, top: number, bottom: number, count = 10) {
  const { b, p } = w;
  for (let i = 0; i < count; i++) {
    const q = ((phase * 3 + i / count) % 1 + 1) % 1, x = x0 + (x1 - x0) * i / Math.max(1, count - 1);
    const y = top - q * (top - bottom);
    b.flow.push({ points: [b.v(p(x, z, y)), b.v(p(x - .3, z, Math.max(bottom, y - 2.5)))], width: .5 });
  }
}
function lowCloud(w: World, x: number, z: number, y: number, width = 19) { w.b.cloud(w.p(x, z, y), width * w.s); }
function crop(w: World, x: number, z: number, y: number, color = C.green) {
  const { b, p, s } = w, stem = b.mesh(new T.CylinderGeometry(.11 * s, .14 * s, 7 * s, 5), color, false);
  set(stem, p(x, z, y + 3.5));
  const leaves = [-1,1].map(side=>{
    const verts:number[]=[],indices:number[]=[];
    const twist=.22*Math.sin(x*.43+z*.32),length=3.8+.75*Math.sin(x*.29+z*.4);
    for(let j=0;j<=9;j++){
      const t=j/9,spread=.45*Math.sin(Math.PI*t)**.64;
      const cx=side*t*length,cy=3.0*Math.sin(t*Math.PI*.70)-1.45*t*t;
      for(const lane of [-1,0,1])verts.push(cx*s,(cy+(lane===0?.17*Math.sin(Math.PI*t):0))*s,(twist*t+lane*spread)*s);
      if(j<9){const k=j*3;indices.push(k,k+3,k+1,k+1,k+3,k+4,k+1,k+4,k+2,k+2,k+4,k+5);}
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setIndex(indices);g.computeVertexNormals();
    const m=b.mesh(g,color,false);set(m,p(x,z,y+2.8));m.rotation.y=.35*Math.sin(.75*x+.32*z);return m;
  });
  return { stem, leaves, origin: p(x, z, y) };
}
function field(w: World, x0: number, z0: number, y: number, nx = 5, nz = 3) {
  return Array.from({ length: nx * nz }, (_, i) => crop(w, x0 + (i % nx) * 5.3, z0 + Math.floor(i / nx) * 5.5, y));
}
function setField(w: World, plants: ReturnType<typeof field>, severity: number, wet: any, dry: any) {
  for (let i = 0; i < plants.length; i++) {
    const plant = plants[i], q = severity * (.8 + (i % 3) * .08), material = q > .38 ? dry : wet;
    plant.stem.material = material; plant.stem.scale.y = 1 - q * .45;
    plant.stem.position.y = plant.origin[1] + (3.5 - 1.575 * q) * w.s;
    plant.leaves.forEach((leaf, j) => { leaf.material = material; leaf.rotation.z = (j ? -1 : 1) * q * .65; leaf.scale.y = 1 - q * .3; });
  }
}

/** A horizontal water surface clipped against the actual terrain triangles.
 * The permanent buffer can hold two clipped triangles per source triangle;
 * changing water level never allocates a new geometry or floods high ground. */
function inundationSurface(w: World, height: (x: number, z: number) => number, x0 = 4, x1 = 96, z0 = 9, z1 = 65) {
  const { b, p, s } = w, nx = 68, nz = 44;
  const triangles: Vec3[][] = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const at = (dx: number, dz: number) => { const q = p(x0 + (x1 - x0) * (i + dx) / nx, z0 + (z1 - z0) * (j + dz) / nz); q[1] = height(q[0], q[2]); return q; };
    const a = at(0, 0), c = at(1, 0), d = at(0, 1), e = at(1, 1);
    triangles.push([a, d, c], [c, d, e]);
  }
  const g = new T.BufferGeometry(), attr = new T.Float32BufferAttribute(new Float32Array(triangles.length * 18), 3);
  const normals = new Float32Array(triangles.length * 18); for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  g.setAttribute('position', attr); g.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
  const mesh = b.mesh(g, '#668b88', false, false,'water'); const clear=new T.Color('#547e82'), silty=new T.Color('#84958b'); let lastLevel = NaN;
  return { mesh, set(level: number) {
    if (level === lastLevel) return; lastLevel = level; mesh.material.color.copy(clear).lerp(silty,ease((level-2.9)/4.5)); const h = level * s; let cursor = 0;
    for (const triangle of triangles) {
      const polygon: Vec3[] = [];
      for (let i = 0; i < 3; i++) {
        const a = triangle[i], c = triangle[(i + 1) % 3], aWet = a[1] < h, cWet = c[1] < h;
        if (aWet) polygon.push([a[0], h + .08 * s, a[2]]);
        if (aWet !== cWet) { const q = (h - a[1]) / (c[1] - a[1]); polygon.push([a[0] + (c[0] - a[0]) * q, h + .08 * s, a[2] + (c[2] - a[2]) * q]); }
      }
      for (let i = 1; i < polygon.length - 1; i++) for(const q of [polygon[0],polygon[i],polygon[i+1]]){
        attr.setXYZ(cursor,...q);
        const nx=.045*Math.sin(.32*q[0]/s+.7*q[2]/s),nz=.034*Math.sin(.20*q[0]/s-.73*q[2]/s);
        g.attributes.normal.setXYZ(cursor++,nx,1,nz);
      }
    }
    attr.needsUpdate = true; g.attributes.normal.needsUpdate=true; g.setDrawRange(0, cursor);
    // Unused buffer capacity must not add an unrelated origin to camera fits.
    if (!g.boundingBox) g.boundingBox = new T.Box3();
    if (!g.boundingSphere) g.boundingSphere = new T.Sphere();
    g.boundingBox.set(b.v(p(x0, z0, level)), b.v(p(x1, z1, level + .1)));
    g.boundingBox.getBoundingSphere(g.boundingSphere);
  } };
}

function buildFlood(b: TextbookGeometry): ModelMotion {
  return floodBasinWorld(b);
}

function buildDrought(b: TextbookGeometry): ModelMotion {
  const w = world(b), { s, p, box, label } = w;
  // The cistern has a real open cut. Its lowest remaining water stays visible
  // through the missing front wall as the supply recedes below ground level.
  const ground=b.prism([[4.5,12],[95.5,12],[95.5,66],[88,66],[88,29],[66,29],[66,66],[4.5,66]].map(([x,z]):[number,number]=>{
    const q=p(x,z);return [q[0],q[2]];
  }),0,7*s,C.land,false);
  ground.material=createSoilSpecimenFinish(b.pop,'#9b8769',1,s,'loam');
  const soil=mountDroughtSoil(b,p,s);
  const crops=mountDroughtCrops(b,p);
  // Sectional water source remains visible beside the cultivated ground.
  box(77, 43, 24, 29, 1, 2, C.rock); box(66, 43, 1, 30, 2, 12, C.paper); box(88, 43, 1, 30, 2, 12, C.paper); box(77, 29, 23, 1, 2, 12, C.paper);
  const source = w.movingBox(20, 1, 26, '#658b87');
  b.house(p(84, 14, 7), 8 * s, 6 * s);
  label('农作物', 29, 61, 15, 14); label('水源', 78, 61, 15, 10);
  const shortage = label('土壤缺水', 35, 22, 20, 18), normal = label('水分充足', 35, 22, 20, 18);
  const droughtInput = { kind: 'replay' as const, selection: 1, label: '从少雨开始观察土壤、水源和作物响应' };
  [...soil.members, crops.mesh, source, shortage].forEach(mesh => { mesh.userData.modelInput = droughtInput; });
  normal.userData.modelInput = { kind: 'select', selection: 0, label: '对照水分充足状态' };
  const recorder=mountDroughtRecorder(b,p,s);
  let state = evaluateDroughtSequence(0, 0);
  return {
    update(phase, selection) {
      recorder(phase,selection); state = evaluateDroughtSequence(phase, selection);
      soil.update(state.soilDeficit);
      crops.update(state.cropStress);
      const level = state.sourceLevel; source.scale.y = level; set(source, p(77, 43, 2 + level / 2)); b.outline(source, .5);
      shortage.visible = state.lowRain && state.soilDeficit > .1; normal.visible = !state.lowRain;
      if (selection !== 1) rain(w, phase, 17, 48, 33, 29, 9, 7);
    },
    focusBounds: () => ({min:p(2,9,-3),max:p(98,78,33)}),
    describe: () => ({ kind: 'drought-effects', ...state, severity: state.soilDeficit, lowPrecipitation: state.lowRain, sourceStorage: 'decreases-with-drought', soilWater: 'decreases-with-drought', cropsAffected: state.cropStress > .38 }),
  };
}

function buildUrbanWaterlogging(b: TextbookGeometry): ModelMotion {
  const w = world(b), { s, p, box, label } = w;
  box(50, 39, 92, 55, 0, 3, C.rock);
  box(50, 39, 92, 55, 3, 7, C.land);
  box(25, 39, 42, 55, 7, 11, C.land); box(76, 39, 40, 55, 7, 11, C.land);
  const pavement = box(50, 39, 92, 55, 11, 12, C.rock, false);
  const permeable = box(50, 39, 92, 55, 11, 12, C.green, false);
  const gardenBed = box(51, 41, 11, 36, 7.1, 8, C.green, false);
  const gravel = box(51, 41, 11, 36, 4, 6, '#b8b4a2', false);
  const flowers = field(w, 47, 30, 8, 2, 4), wet = b.material(C.green), dry = b.material(C.gold);
  for (const [x, z] of [[18, 18], [80, 19]]) b.house(p(x, z, 12), 11 * s, 10 * s);
  b.tube([p(51, 54, 4), p(51, 62, 4), p(91, 62, 4)], .7 * s, C.cool);
  // A thin layer becomes visible above the surface, not a pasted blue patch.
  const puddle = w.movingBox(66, 1, 28, C.sea);
  lowCloud(w, 47, 26, 48, 26);
  label('降水', 23, 17, 44, 10); label('地表径流', 80, 56, 21, 18);
  const infiltration = label('下渗', 36, 65, 4, 10), gardenLabel = label('雨水花园', 52, 17, 24, 18);
  label('排水', 87, 67, 5, 10);
  let mode = 0;
  return {
    update(phase, selection) {
      mode = Math.max(0, Math.min(2, selection)); const q = .25 + .75 * ease(phase);
      pavement.visible = mode === 0; permeable.visible = mode === 1; gardenBed.visible = mode === 2; gravel.visible = mode === 2;
      for (const plant of flowers) for (const m of [plant.stem, ...plant.leaves]) m.visible = mode === 2;
      setField(w, flowers, 0, wet, dry);
      infiltration.visible = mode !== 0; gardenLabel.visible = mode === 2;
      const height = [.4 + 2.3 * q, .22 + .55 * q, .15 + .3 * q][mode];
      puddle.scale.y = height; set(puddle, p(51, 44, 12.05 + height / 2)); b.outline(puddle, .45);
      rain(w, phase, 25, 71, 33, 43, 13, 12);
      b.trace([p(28, 37, 12.5 + height), p(61, 52, 12.5 + height), p(89, 59, 12.4)], phase, mode === 0 ? 6 : 2);
      if (mode !== 0) {
        for (const x of mode === 2 ? [48, 53] : [30, 51, 72]) b.trace([p(x, 40, mode === 2 ? 9 : 11.5), p(x, 40, 5), p(x + 5, 48, 3.5)], phase, 2);
        b.trace([p(51, 50, 4), p(51, 62, 4), p(91, 62, 4)], phase * .35, 2);
      }
      if (mode === 0) b.outline(pavement, .5); else if (mode === 1) b.outline(permeable, .5); else { b.outline(gardenBed, .5); b.outline(gravel, .45); }
    },
    describe: () => ({ kind: 'urban-rainfall-partition', surface: ['impervious', 'permeable', 'rain-garden'][mode], sameRainInput: true, infiltration: mode > 0, temporaryStorage: mode > 0, surfacePonding: ['greater', 'less', 'less-with-delayed-release'][mode], quantitativeRunoffModel: false, preventsAllFlooding: false }),
  };
}

function buildGnss(b: TextbookGeometry): ModelMotion {
  const w = world(b), { s, p, box, label } = w;
  const centre = p(48, 34, 27), radius = 22 * s;
  b.sphere(centre, radius, C.sea);
  // The globe meridians are geometry/ink, with no Earth texture.
  for (const angle of [0, Math.PI / 3, Math.PI * 2 / 3]) {
    const points = Array.from({ length: 49 }, (_, i): Vec3 => {
      const a = i / 48 * Math.PI * 2; return [centre[0] + Math.cos(a) * radius * Math.cos(angle), centre[1] + Math.sin(a) * radius, centre[2] + Math.cos(a) * radius * Math.sin(angle)];
    }); b.stroke(points, .38);
  }
  const receiver = p(58, 49, 42), station = p(31, 44, 42);
  b.cylinder(receiver, [receiver[0], receiver[1] + 5 * s, receiver[2]], .25 * s, C.rock);
  b.sphere([receiver[0], receiver[1] + 5.7 * s, receiver[2]], .9 * s, C.red, false);
  b.house(station, 5.5 * s, 4.2 * s);
  const satellites = Array.from({ length: 4 }, (_, i) => ({
    angle: i / 4 * Math.PI * 2 + .27,
    body: w.movingBox(3.5, 3, 3, C.paper),
    wings: [-1, 1].map(() => w.movingBox(6, .45, 3.3, C.cool)),
  }));
  // GNSS spans a taller volume than the tabletop scenes. Give its few labels
  // enough physical height to remain readable in a 1024×768 teaching view.
  const tag = (text: string, x: number, z: number, y: number, width = 37) => b.label(text, p(x, z, y), width * s, 9.2 * s);
  tag('卫星星座', 49, 3, 67); tag('地面监控', 16, 55, 43);
  tag('用户接收', 79, 56, 42); const rescueLabel = tag('定位助救援', 73, 67, 14, 44);
  const rescue = w.movingBox(5, 3, 3, C.warm);
  let mode = 0;
  return {
    update(phase, selection) {
      mode = Math.max(0, Math.min(2, selection)); rescue.visible = mode === 2; rescueLabel.visible = mode === 2;
      satellites.forEach(({ body, wings, angle }, i) => {
        const a = angle + phase * Math.PI * .4, r = 39 * s;
        const at: Vec3 = [centre[0] + Math.cos(a) * r, centre[1] + (23 + Math.sin(a) * 9) * s, centre[2] + Math.sin(a) * r * .72];
        set(body, at); body.rotation.y = -a; b.outline(body, .45);
        wings.forEach((wing, j) => { const side = j ? 1 : -1; set(wing, [at[0] + Math.cos(a) * side * 5 * s, at[1], at[2] + Math.sin(a) * side * 5 * s]); wing.rotation.y = -a; b.outline(wing, .38); });
        if (mode > 0) b.trace([at, [receiver[0], receiver[1] + 5.6 * s, receiver[2]]], phase + i * .1, 2);
        else if (i === 0) b.trace([station, at], phase, 2, 'accent');
      });
      if (mode === 2) {
        const start = p(78, 60, 17), finish = [receiver[0], receiver[1] + 2 * s, receiver[2]] as Vec3;
        const q = ease(phase); set(rescue, start.map((v, i) => v + (finish[i] - v) * q) as Vec3); b.outline(rescue, .5);
        b.trace([receiver, p(74, 58, 39), start], phase, 3, 'accent');
      }
    },
    describe: () => ({ kind: 'gnss-three-segments', mode, displayedSatellites: 4, constellationCountIsSchematic: true, segments: ['space', 'ground-control', 'user'], communicationRequiredForDistress: true, solvedCoordinates: false, actualOrbits: false }),
  };
}

function buildWarehouse(b: TextbookGeometry): ModelMotion {
  const w = world(b), { s, p, box, label } = w;
  const h = (x: number, z: number) => (3 + 13 * Math.exp(-((x / s - 83) ** 2 / 350 + ((z - p(0, 0)[2]) / s - 12) ** 2 / 240))) * s;
  b.terrain(3 * s, 97 * s, p(0, 6)[2], p(0, 67)[2], h, C.green, 40, 24);
  const river = [p(20, 8, 3.3), p(23, 28, 3.3), p(18, 46, 3.3), p(27, 66, 3.3)]; b.tube(river, 2 * s, C.water);
  const sites = [[24, 29], [53, 39], [82, 13]].map(([x, z]) => p(x, z, h(x * s, p(0, z)[2]) / s + .3));
  const towns = [[18, 58], [83, 59], [87, 33]].map(([x, z]) => p(x, z, h(x * s, p(0, z)[2]) / s + .2));
  for (const [i, site] of sites.entries()) {
    const first = b.meshes.length; b.house(site, 8 * s, 6.5 * s);
    const name = ['近河低地', '路网节点', '偏远山地'][i];
    label(name, site[0] / s, (site[2] - p(0, 0)[2]) / s - 8, site[1] / s + 13, 23.4, 6.2);
    b.meshes.slice(first).forEach(mesh => { mesh.userData.modelInput = { kind: 'select', selection: i, label: `比较${name}的地形与路网条件` }; });
  }
  for (const town of towns) { b.house(town, 4.3 * s, 4 * s); b.house([town[0] + 5 * s, town[1], town[2] - 2 * s], 3.4 * s, 3.2 * s); }
  label('受灾聚落', 77, 69, 13, 23.4, 6.2);
  const junction = p(52, 45, 3.8);
  const followTerrain = (points: Vec3[]) => points.flatMap((a, index) => {
    if (index === points.length - 1) return [[a[0], h(a[0], a[2]) + .65 * s, a[2]] as Vec3];
    const c = points[index + 1];
    return Array.from({ length: 12 }, (_, j): Vec3 => { const q = j / 12, x = a[0] + (c[0] - a[0]) * q, z = a[2] + (c[2] - a[2]) * q; return [x, h(x, z) + .65 * s, z]; });
  });
  const routes = sites.map((site, i) => towns.map(town => followTerrain(i === 1 ? [site, junction, town]
    : i === 0 ? [site, p(38, 32), junction, town]
      : [site, p(91, 25), p(76, 34), p(72, 23), p(60, 29), junction, town])));
  for (const route of routes[1]) b.tube(route, .55 * s, C.rock);
  b.tube(routes[0][0].slice(0, 25), .55 * s, C.rock); b.tube(routes[2][0].slice(0, 61), .55 * s, C.rock);
  // This fixed high-water scenario stays visible for every candidate, so a
  // selection cannot make the same lowland exposure physically disappear.
  const exposure = inundationSurface(w, h, 8, 36, 10, 64); exposure.set(4.65);
  label('同一高水位参照', 22, 65, 8, 32.5, 6.2);
  const selected = b.cylinder(p(0, 0, .1), p(0, 0, .7), 6.2 * s, C.gold);
  const supplies = Array.from({ length: 3 }, () => w.movingBox(2.5, 2.5, 2.5, C.warm));
  const curves = routes.map(row => row.map(points => new T.CatmullRomCurve3(points.map(q => b.v(q)), false, 'catmullrom', .15)));
  let mode = 0;
  return {
    update(_phase, selection) {
      mode = Math.max(0, Math.min(2, selection)); selected.position.copy(b.v(sites[mode]).sub(b.v(p(0, 0, .1))));
      routes[mode].forEach((route, i) => {
        b.contour(route.map(q => [q[0], q[1] + .65 * s, q[2]]), .65);
        supplies[i].position.copy(curves[mode][i].getPoint([.26, .51, .78][i])).add(new T.Vector3(0, 1.7 * s, 0)); b.outline(supplies[i], .45);
      });
      if (mode === 0) b.ring([sites[0][0], sites[0][1] + .4 * s, sites[0][2]], 10 * s, 'xz', 'accent');
    },
    focusBounds: () => ({ min: p(1, 2, 0), max: p(99, 74, 36) }),
    describe: () => ({ kind: 'relief-warehouse-location', candidate: ['river-lowland', 'road-junction', 'remote-hill'][mode], settlementCount: towns.length, roadNetworkUsed: true, lowlandExposure: mode === 0, sharedHighWaterScenario: true, roadsFollowRelief: true, routeParcelsAreStatic: true, schematicSiteComparison: true, optimalSiteComputed: false, realLocations: false, timedServiceArea: false }),
  };
}

/** Unknown effects leave the shared dispatcher untouched. */
export function buildWaterRiskExtra(b: TextbookGeometry, effect: string): ModelMotion | null {
  switch (effect) {
    case 'salinity': return buildSalinityWorld(b);
    case 'density': return buildDensityInstrumentWorld(b);
    case 'desalination': return buildDesalinationInstrumentWorld(b);
    case 'flood': return buildFlood(b);
    case 'drought': return buildDrought(b);
    case 'urban-waterlogging': return buildUrbanWaterlogging(b);
    case 'gnss': return buildGnss(b);
    case 'warehouse': return buildWarehouseWorld(b);
    case 'disaster-chain': return buildDisasterChainWorld(b);
    default: return null;
  }
}

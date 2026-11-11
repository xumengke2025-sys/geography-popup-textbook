import { THREE as T } from './reference/engine.js';
import { TextbookGeometry, PALETTE as C, type ModelMotion, type Vec3 } from './textbook-geometry';
import { buildHazeWorld } from './textbook-haze-world';
import { buildAirCountingWorld } from './textbook-air-counting-world';
import { buildHabitableWorld } from './textbook-habitable-world';
import { buildSolarDisturbanceWorld, buildSphereExchangeWorld, buildMarsTransferWorld,
  buildGreenhouseResponseWorld, buildWindForceParcelWorld } from './textbook-sky-causality-world';
import { buildGeologicalSpecimenWorld } from './textbook-geological-specimen-world';
import { buildCosmicInstrumentWorld } from './textbook-cosmic-instrument-world';
import { buildMarsTransferWorld as buildMarsBaseWorld } from './textbook-mars-base-world';

/** Textbook references are printed page numbers (PDF page = printed + 5).
 * All scenes are illustrative paper constructions, with no measured weather,
 * astronomical distance scale, biological growth rate or resource guarantee. */
export const SKY_EXTRA_META = {
  'cosmic-scale': { page: 3, controls: ['地月系', '太阳系', '银河系', '可观测宇宙'], note: '按教材由低到高切换天体系统。大小、间距及公转速度不按比例；星系视图的推钮只转倾教学标本，支架不是天体间的真实连接。', evidence: '正文3—4页：地月系、太阳系、银河系、可观测宇宙。' },
  habitable: { page: 6, controls: ['适宜温度', '液态水', '大气条件'], note: '分项查看地球生命条件及其联系。地球位置、自身体积与质量、安全宇宙环境共同影响这些条件，不把单个条件当作生命必然出现的保证。', evidence: '正文6页：温度、水、大气等条件与位置、体积、质量及安全宇宙环境有关。' },
  'solar-activity': { page: 11, controls: ['较平静', '活动增强'], note: '太阳活动增强时，空间扰动与极光示意随之增强。磁场线、粒子路径和时间均为示意，不预测某次爆发是否引起地面灾害。', evidence: '正文10—13页：黑子、耀斑、日珥、日冕物质抛射；强太阳风扰动磁场与大气。' },
  'geo-time': { page: 16, controls: ['前寒武纪', '古生代', '中生代', '新生代'], note: '切换教材四个主要时期的代表性环境与生物。展台和切换时长不表示各时期持续时间；不是所有地点的固定演化路径。', evidence: '正文15—19页：地质年代表、蓝细菌、古生代海生动物、恐龙、哺乳动物与被子植物。' },
  'external-spheres': { page: 23, controls: ['圈层联系', '水的迁移', '生物联系'], note: '地景中云、水、植物与岩石相互接触；示踪分别显示水的迁移与植物从环境获取水。圈层相互渗透，并不是四个互不接触的外壳。', evidence: '正文23—24页：大气圈、水圈、生物圈与岩石圈相互联系、相互渗透。' },
  'mars-base': { page: 26, controls: ['基地整体', '水的再生', '植物与乘员', '能源供给'], note: '依“绿航星际”四类舱段构建生命保障示意。回路不表示物质完全闭合，也不代表可直接用于火星的工程方案；部分食物仍需补给。', evidence: '正文25—26页：火星自然条件；植物舱、乘员舱、生保舱、资源舱协作。' },
  'air-composition': { page: 28, controls: ['干洁空气', '水汽与杂质'], note: '100个小格表示体积分数：78格氮、21格氧、1格其他气体；小格不是分子数。水汽和杂质另列，数量随地时变化，不纳入干洁空气的固定比例。', evidence: '正文28—29页：25千米以下干洁空气的体积分数及水汽、杂质的作用。' },
  greenhouse: { page: 35, controls: ['无大气对照', '有大气', '有低云'], note: '比较长波直接逸出与被大气吸收后向上、向下再辐射。大气逆辐射补偿地面热量损失，不产生能量；箭头数与粗细不作为能量比例。', evidence: '正文35页：水汽、二氧化碳吸收地面长波，大气逆辐射及浓密低云。' },
  'wind-forces': { page: 39, controls: ['只受气压梯度力', '北半球高空', '北半球近地面', '南半球近地面'], note: '在同一水平面比较理想风向：高空与等压线平行，近地面斜交并由高压侧吹向低压侧。偏向力垂直风向，摩擦力反向；近地面斜交角度为示意，不是固定值。', evidence: '正文39页：图2.14—2.16及南半球近地面风向思考题。' },
  haze: { page: 43, controls: ['排放积聚', '通风扩散', '减少排放'], note: '三次对照从相同初始污染存量开始。改变条件重放：通风将示踪移出观察范围，减排只减少后续排放，已有污染不会立即消失。点、时间和速率均为教学设定，不是AQI或治理时长；湿度和地表等条件也会影响污染。', evidence: '正文42—44页：污染源、气象条件和地表特点共同影响污染；微风静风与治理措施。' },
} as const;

type Layer = any[];
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
function scene(b: TextbookGeometry) {
  const s = b.width / 100;
  return { s, p: (u: number, v: number, h = 0): Vec3 => b.p(u, v, h * s) };
}
function layer(b: TextbookGeometry, create: () => void): Layer { const start = b.meshes.length; create(); return b.meshes.slice(start); }
function show(meshes: Layer, visible: boolean) { meshes.forEach(mesh => { mesh.visible = visible; }); }
function orb(b: TextbookGeometry, at: Vec3, radius: number, color: string, scale: Vec3 = [1, 1, 1], segments = 16) {
  const geometry = new T.SphereGeometry(radius, segments, Math.max(6, Math.round(segments * .6)));
  geometry.scale(...scale); const mesh = b.mesh(geometry, color, false); mesh.position.set(...at); return mesh;
}
function tag(b: TextbookGeometry, text: string, at: Vec3, s: number) { return b.label(text, at, Math.max(13, text.length * 4.8) * s, 6 * s); }
function ringPath(at: Vec3, radius: number, flat = 1, count = 64): Vec3[] {
  return Array.from({ length: count + 1 }, (_, i): Vec3 => { const a = i / count * Math.PI * 2; return [at[0] + Math.cos(a) * radius, at[1], at[2] - Math.sin(a) * radius * flat]; });
}
function paperTree(b: TextbookGeometry, at: Vec3, h: number, broad = false) {
  b.cylinder(at, [at[0], at[1] + h * .8, at[2]], h * .035, C.rock);
  if (broad) orb(b, [at[0], at[1] + h * .8, at[2]], h * .25, C.green, [1.2, 1, 1], 12);
  else for (let i = 0; i < 3; i++) b.cylinder([at[0], at[1] + h * (.18 + i * .19), at[2]], [at[0], at[1] + h * (.75 + i * .1), at[2]], h * (.25 - i * .055), C.green, false, 0);
}
/** Toggleable cloud surfaces must not leave permanent printed contours behind. */
function paperCloud(b: TextbookGeometry, at: Vec3, w: number) {
  for (const [x, y, r] of [[-.3, 0, .24], [0, .07, .31], [.31, -.02, .22]])
    orb(b, [at[0] + x * w, at[1] + y * w, at[2]], r * w, C.paper, [1, .64, .63]);
}
/** Prepare cached contours during construction, never allocate geometry in update. */
function prepareContours(b: TextbookGeometry, meshes: Layer) { meshes.forEach(mesh => b.outline(mesh)); }
function arrow(b: TextbookGeometry, a: Vec3, c: Vec3, radius: number, color: string) {
  const from = b.v(a), to = b.v(c), direction = to.clone().sub(from), length = direction.length();
  const neck = to.clone().addScaledVector(direction.normalize(), -Math.min(length * .3, radius * 4));
  b.cylinder(a, neck.toArray(), radius, color); b.cylinder(neck.toArray(), c, radius * 2.6, color, false, 0);
}
function globe(b: TextbookGeometry, at: Vec3, r: number) {
  orb(b, at, r, C.sea, [1, 1, 1], 24);
  // Curved land patches, rather than a picture on the globe. Coastlines are schematic.
  for (const [phi, phiLength, theta, thetaLength] of [[.25, .7, .55, .95], [2, .6, .7, 1.05], [4.15, .9, .4, .62]]) {
    const g = new T.SphereGeometry(r * 1.008, 12, 8, phi, phiLength, theta, thetaLength); g.translate(...at); b.mesh(g, C.green, false, false);
  }
}

export function buildSkyExtra(b: TextbookGeometry, effect: string): ModelMotion | null {
  switch (effect) {
    case 'cosmic-scale': return buildCosmicInstrumentWorld(b);
    case 'habitable': return buildHabitableWorld(b);
    case 'solar-activity': return buildSolarDisturbanceWorld(b);
    case 'geo-time': return geologicalTime(b);
    case 'external-spheres': return buildSphereExchangeWorld(b);
    case 'mars-base': return buildMarsBaseWorld(b);
    case 'air-composition': return airComposition(b);
    case 'greenhouse': return buildGreenhouseResponseWorld(b);
    case 'wind-forces': return buildWindForceParcelWorld(b);
    case 'haze': return haze(b);
    default: return null;
  }
}

function cosmicScale(b: TextbookGeometry): ModelMotion {
  const { s, p } = scene(b), centers = [p(.14, .80, 15), p(.39, .72, 25), p(.64, .64, 36), p(.87, .56, 49)];
  const radii = [8, 10, 11, 12].map(r => r * s), labels: Layer = [];
  for (let i = 0; i < 4; i++) {
    b.cylinder([centers[i][0], 0, centers[i][2]], [centers[i][0], centers[i][1] - 2 * s, centers[i][2]], .24 * s, C.rock);
    b.tube(ringPath(centers[i], radii[i], .62), .14 * s, C.ink);
    labels.push(tag(b, ['地月系', '太阳系', '银河系', '可观测宇宙'][i], [centers[i][0], centers[i][1] - 10 * s, centers[i][2] + 6 * s], s));
    if (i < 3) b.stroke([centers[i], [centers[i][0] + 9 * s, centers[i][1], centers[i][2]], [centers[i + 1][0] - 10 * s, centers[i + 1][1], centers[i + 1][2]]], .4);
  }
  globe(b, centers[0], 3.4 * s); const moon = orb(b, [centers[0][0] + radii[0], centers[0][1], centers[0][2]], 1.05 * s, C.paper);
  orb(b, centers[1], 2.5 * s, C.gold);
  const planets = [5, 8].map((r, i) => ({ radius: r * s, mesh: orb(b, [centers[1][0] + r * s, centers[1][1], centers[1][2]], (.65 + i * .2) * s, i ? C.sea : C.rock) }));
  for (let arm = 0; arm < 3; arm++) {
    const path = Array.from({ length: 34 }, (_, i): Vec3 => { const a = arm * Math.PI * 2 / 3 + i / 33 * 4, r = (1 + i / 33 * 9) * s; return [centers[2][0] + Math.cos(a) * r, centers[2][1] + .5 * s, centers[2][2] + Math.sin(a) * r * .6]; });
    b.tube(path, .34 * s, C.paper);
  }
  orb(b, centers[2], 1.7 * s, C.gold, [1, .4, 1]);
  for (let i = 0; i < 9; i++) { const a = i * 2.4, r = (3 + i % 3 * 3) * s; orb(b, [centers[3][0] + Math.cos(a) * r, centers[3][1] + Math.sin(i * 1.7) * 3 * s, centers[3][2] + Math.sin(a) * r * .55], (1 + i % 2 * .3) * s, i % 2 ? C.sea : C.paper, [1.4, .35, 1], 10); }
  prepareContours(b, labels); let selected = 0;
  return { update(t, selection) {
    selected = clamp(selection, 0, 3); const a = t * Math.PI * 2;
    moon.position.set(centers[0][0] + Math.cos(a) * radii[0], centers[0][1], centers[0][2] - Math.sin(a) * radii[0] * .62);
    planets.forEach(({ radius, mesh }, i) => mesh.position.set(centers[1][0] + Math.cos(a * (2 - i)) * radius, centers[1][1], centers[1][2] - Math.sin(a * (2 - i)) * radius * .62));
    // The selected system is connected to its immediate larger system. These
    // links communicate membership, not an outward physical journey or scale.
    if (selected < 3) b.trace([centers[selected], [centers[selected][0] + 9 * s, centers[selected][1], centers[selected][2]], [centers[selected + 1][0] - 10 * s, centers[selected + 1][1], centers[selected + 1][2]], centers[selected + 1]], t, 2, 'accent');
    b.ring(centers[selected], radii[selected] * 1.09, 'xz', 'accent'); labels.forEach((label, i) => { if (i === selected) b.outline(label, .65); });
  }, describe: () => ({ kind: 'cosmic-scale', hierarchy: ['earth-moon', 'solar-system', 'milky-way', 'observable-universe'], selected, relationship: 'membership-not-physical-stacked-shells', trueScale: false }) };
}

function habitable(b: TextbookGeometry): ModelMotion {
  const { s, p } = scene(b), earth = p(.56, .78, 24), sun = p(.08, .78, 26);
  globe(b, earth, 15 * s); orb(b, sun, 6 * s, C.gold);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; b.stroke([7, 9].map(r => [sun[0] + Math.cos(a) * r * s, sun[1] + Math.sin(a) * r * s, sun[2]]) as Vec3[], .5); }
  const air = layer(b, () => { for (let i = 0; i < 3; i++) { const g = new T.TorusGeometry(18 * s, .14 * s, 6, 64); g.rotateY(i * Math.PI / 3); g.translate(...earth); b.mesh(g, C.cool, false, false); } });
  const water = orb(b, p(.88, .85, 19), 4.1 * s, C.water, [.8, 1.4, .8]);
  b.cylinder(p(.88, .85, 10), p(.88, .85, 13), 6.5 * s, C.sea);
  const tags = [tag(b, '适宜温度', p(.22, .71, 41), s), tag(b, '液态水', p(.86, .94, 6), s), tag(b, '大气', p(.65, .66, 46), s)];
  prepareContours(b, air); let selected = 0;
  return { update(t, selection) {
    selected = clamp(selection, 0, 2); show(air, selected === 2);
    tags.forEach((mesh, i) => { mesh.visible = i === selected; });
    if (selected === 0) for (let i = 0; i < 3; i++) b.trace([[sun[0] + 7 * s, sun[1] + (i - 1) * 3 * s, sun[2]], [earth[0] - 15 * s, earth[1] + (i - 1) * 3 * s, earth[2]]], t, 2, 'accent');
    if (selected === 1) { b.ring(water.position.toArray(), 5.4 * s, 'xz'); b.trace([p(.85, .85, 11), p(.89, .85, 15), p(.85, .85, 22)], t, 2); }
    if (selected === 2) { b.ring(earth, 18.5 * s, 'xy'); air.forEach(mesh => b.outline(mesh, .4)); }
  }, describe: () => ({ kind: 'habitable-earth', selected, conditions: ['temperature', 'liquid-water', 'atmosphere'], lifeGuaranteed: false, causalScope: 'conditions-not-biogenesis-simulation' }) };
}

function geologicalTime(b: TextbookGeometry): ModelMotion {
  return buildGeologicalSpecimenWorld(b);
}

function airComposition(b: TextbookGeometry): ModelMotion { return buildAirCountingWorld(b); }

function haze(b: TextbookGeometry): ModelMotion {
  return buildHazeWorld(b);
}

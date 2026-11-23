import { drawingGrip } from './textbook-drawing-grip';
/** Textbook printed p.111 / PDF p.116, figures 6.16 and 6.17, visually checked.
 * These are independent places and events. Progress is an observation order;
 * no Yushu rubble is turned into the new Beichuan county town. */
export type RecoveryPoint = [number, number, number];
export type RecoveryCase = 0 | 1;
export interface RecoveryMeshData { positions: number[]; indices: number[] }
export interface RecoveryPart {
  id: string; role: string; stage: number; color: string; mesh: RecoveryMeshData;
}
export interface RecoveryLink {
  id: string; stage: number; color: string; path: RecoveryPoint[];
  meaning: 'support-relationship' | 'life-service-relationship';
}
export const RECOVERY_STOPS = [
  [{ label: '废墟搜救', phase: 0 }, { label: '医疗救助', phase: .5 }, { label: '后勤保障', phase: 1 }],
  [{ label: '异地重建', phase: 0 }, { label: '恢复生活', phase: .5 }, { label: '兼顾防灾', phase: 1 }],
] as const;
export const RECOVERY_REFERENCE = {
  printedPage: 111, pdfPage: 116, source: 'textbook/page-116.webp',
  phaseMeansObservationOrder: true, calibratedTime: false, operationalInstructions: false,
  responseEffectivenessMeasured: false, rescuedPeopleCount: false, economicRecoveryRate: false,
  sameEvent: false, sameLocation: false, rubbleTransformsIntoCity: false,
  independentlyObservedCases: true, siteGeometryIsIllustrative: true,
  emergencyResponsePlanNotSimulated: true, evacuationRoutesNotSpecified: true,
  engineeringSafetyCertified: false, newCityLayoutIsNotSurveyedBeichuan: true,
} as const;
export const RECOVERY_CASES = [
  { id: 'yushu-rescue', title: '玉树 · 灾害救援', figure: '6.16', location: '青海玉树', eventYear: 2010,
    source: { ...RECOVERY_REFERENCE, figure: '6.16', location: '青海玉树', eventYear: 2010, imageContent: '2010年4月，救援队在玉树地震后的废墟中搜救',
      captionConcepts: ['搜索营救', '医疗救助', '后期保障'], photoShowsCraneOperation: false,
      medicalAndSupplyLocationsAreSchematic: true },
    text: [
      '玉树地震后的废墟中，救援队开展搜索营救。人员、医疗与后勤共同支持救援。',
      '医疗救助与搜救相互支持，后方保障为它们提供条件。三者在同一案例中并列观察。',
      '调动人员和物资，为搜救与救助提供保障。三个部分并存，观察进度不代表救援耗时。',
    ],
  },
  { id: 'beichuan-relocation', title: '北川 · 灾后恢复', figure: '6.17', location: '四川北川', eventYear: 2008,
    source: { ...RECOVERY_REFERENCE, figure: '6.17', location: '四川北川', eventYear: 2008, imageContent: '汶川地震后异地修建的北川新县城',
      captionConcepts: ['异地修建', '恢复生产和生活', '增强防灾能力'], depictsOldCounty: false,
      publicSpaceIsConceptual: true, photographProvesSpecificRefugeDesignation: false },
    text: [
      '图6.17是汶川地震后异地修建的北川新县城。这是另一个地点，不是左图废墟的下一阶段。',
      '灾后恢复着眼于生产和生活。住宅与生活设施的联系用于看清这一概念。',
      '重建还可增强防灾能力。开敞空间只作概念提示，不认定照片中某处的实际规划用途。',
    ],
  },
] as const;
export const RECOVERY_LAYOUT = {
  baseOutline: [[7, 5], [93, 5], [97, 9], [97, 69], [93, 73], [7, 73], [3, 69], [3, 9]] as [number, number][],
  track: { start: [12, -9, 83] as RecoveryPoint, end: [88, -9, 83] as RecoveryPoint },
  label: [50, 43, 60] as RecoveryPoint,
  bounds: { min: [-5, -17, -7] as RecoveryPoint, max: [105, 55, 92] as RecoveryPoint },
} as const;
export const RECOVERY_NODES = [
  [{ id: 'rescue-team', point: [43, 9, 37] as RecoveryPoint },
    { id: 'medical-support', point: [76, 14, 51] as RecoveryPoint },
    { id: 'supply-support', point: [78, 7, 18] as RecoveryPoint }],
  [{ id: 'relocated-town', point: [32, 14, 24] as RecoveryPoint },
    { id: 'daily-life-services', point: [71, 17, 24] as RecoveryPoint },
    { id: 'open-public-space', point: [55, 3, 51] as RecoveryPoint }],
] as const;
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
export const recoveryCaseIndex = (selection: number): RecoveryCase => Number.isFinite(selection) && Math.round(selection) >= 1 ? 1 : 0;
const mixPoint = (a: RecoveryPoint, b: RecoveryPoint, t: number): RecoveryPoint => a.map((v, i) => v + (b[i] - v) * t) as RecoveryPoint;
const minus = (a: RecoveryPoint, b: RecoveryPoint): RecoveryPoint => a.map((v, i) => v - b[i]) as RecoveryPoint;
const cross = (a: RecoveryPoint, b: RecoveryPoint): RecoveryPoint => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: RecoveryPoint): RecoveryPoint => { const n = Math.hypot(...a) || 1; return a.map(v => v / n) as RecoveryPoint; };

export function recoveryPrism(outline: readonly (readonly [number, number])[], bottom: number, top: number): RecoveryMeshData {
  const positions: number[] = [], indices: number[] = [], count = outline.length;
  for (const y of [bottom, top]) for (const [x, z] of outline) positions.push(x, y, z);
  for (let i = 1; i < count - 1; i++) indices.push(0, i, i + 1, count, count + i + 1, count + i);
  for (let i = 0; i < count; i++) { const j = (i + 1) % count; indices.push(i, count + i, count + j, i, count + j, j); }
  return { positions, indices };
}
export function recoveryTransform(mesh: RecoveryMeshData, at: RecoveryPoint = [0, 0, 0], rotation: RecoveryPoint = [0, 0, 0]): RecoveryMeshData {
  const positions: number[] = [];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    let [x, y, z] = mesh.positions.slice(i, i + 3);
    [y, z] = [y * Math.cos(rotation[0]) - z * Math.sin(rotation[0]), y * Math.sin(rotation[0]) + z * Math.cos(rotation[0])];
    [x, z] = [x * Math.cos(rotation[1]) + z * Math.sin(rotation[1]), -x * Math.sin(rotation[1]) + z * Math.cos(rotation[1])];
    [x, y] = [x * Math.cos(rotation[2]) - y * Math.sin(rotation[2]), x * Math.sin(rotation[2]) + y * Math.cos(rotation[2])];
    positions.push(x + at[0], y + at[1], z + at[2]);
  }
  return { positions, indices: [...mesh.indices] };
}
export function recoveryBox(center: RecoveryPoint, size: RecoveryPoint, rotation: RecoveryPoint = [0, 0, 0]) {
  const [x, y, z] = size;
  return recoveryTransform(recoveryPrism([[-x / 2, -z / 2], [x / 2, -z / 2], [x / 2, z / 2], [-x / 2, z / 2]], -y / 2, y / 2), center, rotation);
}
export function recoveryMerge(meshes: readonly RecoveryMeshData[]): RecoveryMeshData {
  const positions: number[] = [], indices: number[] = [];
  for (const mesh of meshes) { const offset = positions.length / 3; positions.push(...mesh.positions); indices.push(...mesh.indices.map(i => i + offset)); }
  return { positions, indices };
}
export function recoveryRod(a: RecoveryPoint, b: RecoveryPoint, radius: number, segments = 10): RecoveryMeshData {
  const axis = unit(minus(b, a)), u = unit(cross(axis, Math.abs(axis[1]) > .9 ? [0, 0, 1] : [0, 1, 0])), v = cross(axis, u);
  const positions: number[] = [], indices: number[] = [];
  for (const p of [a, b]) for (let i = 0; i < segments; i++) {
    const angle = i / segments * Math.PI * 2;
    positions.push(...p.map((n, k) => n + radius * (u[k] * Math.cos(angle) + v[k] * Math.sin(angle))));
  }
  positions.push(...a, ...b); const lower = segments * 2, upper = lower + 1;
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    indices.push(i, j, segments + j, i, segments + j, segments + i, lower, j, i, upper, segments + i, segments + j);
  }
  return { positions, indices };
}
function oval(center: RecoveryPoint, radii: RecoveryPoint, rows = 6, columns = 12): RecoveryMeshData {
  const positions: number[] = [center[0], center[1] + radii[1], center[2]], indices: number[] = [];
  for (let row = 1; row < rows; row++) for (let col = 0; col < columns; col++) {
    const phi = row / rows * Math.PI, theta = col / columns * Math.PI * 2;
    positions.push(center[0] + Math.sin(phi) * Math.cos(theta) * radii[0], center[1] + Math.cos(phi) * radii[1], center[2] + Math.sin(phi) * Math.sin(theta) * radii[2]);
  }
  const bottom = positions.length / 3; positions.push(center[0], center[1] - radii[1], center[2]);
  for (let col = 0; col < columns; col++) {
    const next = (col + 1) % columns; indices.push(0, 1 + next, 1 + col);
    for (let row = 0; row < rows - 2; row++) {
      const a = 1 + row * columns + col, b = 1 + row * columns + next;
      indices.push(a, b, b + columns, a, b + columns, a + columns);
    }
    const last = 1 + (rows - 2) * columns; indices.push(last + col, last + next, bottom);
  }
  return { positions, indices };
}
/** Closed gabled cap, used for both modest homes and the schematic aid shelter. */
function roof(center: RecoveryPoint, width: number, depth: number, height: number): RecoveryMeshData {
  const positions = [-width / 2, 0, -depth / 2, width / 2, 0, -depth / 2, 0, height, -depth / 2,
    -width / 2, 0, depth / 2, width / 2, 0, depth / 2, 0, height, depth / 2];
  const indices = [0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4];
  return recoveryTransform({ positions, indices }, center);
}
function createParts(which: RecoveryCase): RecoveryPart[] {
  const pieces: RecoveryPart[] = [];
  const add = (role: string, color: string, stage: number, mesh: RecoveryMeshData) => pieces.push({ id: `${which}-${role}-${pieces.length}`, role, color, stage, mesh });
  const box = (role: string, color: string, stage: number, at: RecoveryPoint, size: RecoveryPoint, rotation?: RecoveryPoint) => add(role, color, stage, recoveryBox(at, size, rotation));
  add('ground-base', which ? '#93977a' : '#95856f', -1, recoveryPrism(RECOVERY_LAYOUT.baseOutline, 0, 2));
  if (which === 0) {
    // The ruin remains throughout. Sloping slabs and irregular remnants are
    // physical solids; no crane, crane cable, disappearing rubble or rebuild.
    for (const [at, size, rotation] of [
      [[12, 11, 25], [3.5, 18, 5], [0, .06, -.12]], [[29, 8.8, 18], [3.2, 13, 4], [0, -.12, .15]],
      [[18.4, 16, 24], [15.4, 2.2, 5], [.04, .05, -.37]], [[21, 7, 40], [28, 2.1, 9], [.12, -.22, .28]],
      [[30, 5.5, 27], [21, 1.8, 8], [-.23, .35, -.16]], [[14, 4, 55], [13, 2, 8], [.07, .38, .20]],
    ] as [RecoveryPoint, RecoveryPoint, RecoveryPoint][]) {
      const w=size[0]/2,d=size[2]/2;
      const outline:[number,number][]=[[-w,-d*.67],[-w*.72,-d],[w*.63,-d],[w,-d*.57],[w*.91,d*.27],[w*.50,d*.82],[w*.18,d],[-w*.84,d*.88]];
      add('concrete-remnant','#9c9788',0,recoveryTransform(recoveryPrism(outline,-size[1]/2,size[1]/2),at,rotation));
    }
    for (let i = 0; i < 10; i++) {
      const at: RecoveryPoint = [13 + (i % 4) * 7, 3.8 + (i % 3) * .65, 25 + Math.floor(i / 4) * 12];
      box('masonry-fragments', i % 3 ? '#a9aca0' : '#b79a7f', 0, at, [3 + i % 3, 2.3, 3.6], [.1, i * .43, .08 * (i % 3)]);
    }
    // Three identifiable responders have stable poses. Their positions do not
    // prescribe a safe route or demonstrate a real rescue procedure.
    for (const [id, at, turn, crouch] of [
      ['searcher-a', [43, 2, 37], -.4, true], ['searcher-b', [51, 2, 48], -.6, false], ['support-worker', [59, 2, 23], .55, false],
    ] as [string, RecoveryPoint, number, boolean][]) {
      const local = (mesh: RecoveryMeshData) => recoveryTransform({indices:mesh.indices,positions:mesh.positions.map(v=>v*.81)},at,[0,turn,0]);
      const hip = crouch ? 4.4 : 6.8, shoulder = hip + 4.1;
      const legs = crouch
        ? [recoveryRod([-1.15, hip, 0], [-1.4, 2.7, 2.1], .75), recoveryRod([-1.4, 2.7, 2.1], [-1.4, 1, -.1], .66), recoveryRod([1.15, hip, 0], [1.4, 1.2, 1.9], .75)]
        : [recoveryRod([-1, hip, 0], [-1.15, .9, 0], .78), recoveryRod([1, hip, 0], [1.15, .9, .35], .78)];
      const sleeves=[recoveryRod([-1.73,shoulder-.72,0],[-2.55,hip+2.3,.36],.76),recoveryRod([-2.55,hip+2.3,.36],[-3.25,hip+1.1,.64],.60),
        recoveryRod([1.73,shoulder-.72,0],[2.77,hip+2.56,.02],.76),recoveryRod([2.77,hip+2.56,.02],[3.5,hip+2,-1.3],.60)];
      add('responder-trousers','#5c655a',0,local(recoveryMerge(legs)));
      add('responder-pack','#7c7152',0,local(recoveryMerge([oval([0,hip+2.3,-1.14],[1.43,1.68,.85],4,9),recoveryBox([0,hip+.81,.06],[3.15,.39,2.5])])));
      add(id, '#b85432', 0, local(recoveryMerge([oval([0,hip+2.3,0],[2.06,2.57,1.28],5,10),...sleeves])));
      add('responder-uniform-trim','#bfb295',0,local(recoveryMerge([oval([0,hip+1,0],[1.95,.26,1.32],4,10),
        recoveryBox([-.99,hip+2.91,1.16],[.94,.8,.20]),recoveryBox([.99,hip+2.91,1.16],[.94,.8,.20])])));
      add('responder-boots', '#586159', 0, local(recoveryMerge([recoveryBox([-1.2, .7, .45], [1.7, 1.2, 2.6]), recoveryBox([1.25, .7, .7], [1.7, 1.2, 2.6])])));
      add('responder-head-hands', '#d2ae8e', 0, local(recoveryMerge([oval([0, shoulder + 1.4, 0], [1.4, 1.65, 1.25]), oval([-3.35, hip + .9, .65], [.65, .7, .65]), oval([3.65, hip + 1.8, -1.35], [.65, .7, .65])])));
      add('responder-helmet', '#bb8048', 0, local(recoveryMerge([oval([0, shoulder + 2.15, -.05], [1.68, 1.15, 1.6]), oval([0,shoulder+1.91,.19],[1.91,.26,1.85],4,12)])));
    }
    // A small open aid shelter and a supply table illustrate textbook concepts,
    // without claiming to reconstruct the photographed on-site arrangement.
    box('medical-floor', '#d4cbb3', 1, [76, 2.5, 51], [24, .8, 17]);
    for (const [x, z] of [[65.5, 44], [86.5, 44], [65.5, 58], [86.5, 58]]) add('medical-support-frame', '#8c998b', 1, recoveryRod([x, 3, z], [x, 16.4, z], .38));
    add('medical-canopy', '#e8e4d1', 1, roof([76, 16, 51], 25, 18, 6));
    box('medical-back-screen', '#dddcc8', 1, [76, 8.5, 43], [21, 11, .5]);
    box('medical-table', '#bdbda8', 1, [76, 8, 49], [12, .9, 4.4]);
    for (const x of [71, 81]) box('medical-table-legs', '#8c998b', 1, [x, 5.6, 49], [.6, 4, 3.3]);
    box('medical-mark', '#a87558', 1, [76, 17.6, 60.1], [3.8, 1.05, .45]);
    box('medical-mark', '#a87558', 1, [76, 17.6, 60.1], [1.05, 3.8, .45]);
    box('supply-platform', '#c5b99c', 2, [78, 2.7, 18], [23, 1, 15]);
    for (const [x, z, y] of [[71, 15, 6], [79, 15, 6], [87, 15, 6], [75, 22, 5], [84, 22, 5]]) {
      box('supply-crates', '#bea878', 2, [x, y, z], [6.5, 5.5, 5]);
      box('crate-bindings', '#8e9981', 2, [x, y + 2.82, z], [.7, .18, 5.1]);
    }
  } else {
    // A separate complete new-town model. Buildings never grow from the ruin,
    // and no phase claims a construction rate or a certified safe layout.
    box('street-west', '#acb1a5', -1, [11, 2.25, 37], [5, .25, 60]);
    box('street-east', '#acb1a5', -1, [91, 2.25, 37], [5, .25, 60]);
    box('street-front', '#acb1a5', -1, [51, 2.25, 66], [85, .25, 5]);
    box('street-cross', '#acb1a5', -1, [51, 2.25, 36], [80, .25, 4.3]);
    box('green-court', '#a9b695', 2, [57, 2.45, 51], [23, .65, 22]);
    box('open-square', '#d3c9aa', 2, [55, 2.83, 51], [15.5, .25, 15.5]);
    for (const [i, x, z] of [[0, 22, 20], [1, 38, 20], [2, 22, 48], [3, 38, 48], [4, 77, 47], [5, 78, 59]]) {
      const h = i % 2 ? 11.8 : 13.2;
      box('housing-walls', '#e2dac6', 1, [x, 2 + h / 2, z], [11, h, 9]);
      add('housing-roofs', '#97684f', 1, roof([x, 2 + h, z], 12.4, 10.4, 3.6));
      for (const dx of [-3, 1.8]) for (const y of [6, 10.6]) box('housing-windows', '#8da49c', 1, [x + dx, y, z + 4.56], [1.9, 2, .15]);
      box('housing-doors', '#a99e85', 1, [x + .2, 4, z + 4.6], [1.9, 3.6, .2]);
    }
    box('life-service-walls', '#d6d1bb', 1, [73, 10.3, 20], [25, 16.6, 17]);
    add('life-service-roof', '#697b71', 1, roof([73, 18.6, 20], 27, 19, 3.2));
    box('life-service-step', '#bcbba7', 1, [73, 3.2, 30.4], [21, 1.1, 4.2]);
    for (const x of [63.5, 69.8, 76.1, 82.5]) {
      box('life-service-windows', '#8fa69d', 1, [x, 13, 28.58], [3.4, 3.3, .18]);
      add('life-service-colonnade', '#dad7c3', 1, recoveryRod([x, 3.7, 30.4], [x, 9.4, 30.4], .48));
    }
    box('life-service-entry', '#8a9a8e', 1, [73, 5.8, 28.65], [3.6, 5.8, .22]);
    for (const [x, z] of [[7, 16], [7, 31], [7, 51], [49, 66], [62, 66], [94, 25], [94, 52], [49, 43], [64, 43]]) {
      add('planted-trunks', '#8c8f72', 2, recoveryRod([x, 2.5, z], [x, 10, z], .4));
      const seed=x*.43+z*.19;
      for(let j=0;j<4;j++){
        const a=j*2.4+seed,r=j===3?.23:1.28,xx=x+Math.cos(a)*r,zz=z+Math.sin(a)*r,yy=j===3?11.8:10.15+.49*Math.cos(seed+j);
        add('planted-trunks','#8c8f72',2,recoveryRod([x,7.5,z],[xx,yy-.21,zz],.24,7));
        add('planted-crowns','#728663',2,oval([xx,yy,zz],[2.02,2.42,1.93],4,8));
      }
    }
  }
  // Parts sharing a role/colour/stage become one draw call, but all sub-solids
  // remain closed. This also fixes every GPU allocation before phase changes.
  const buckets = new Map<string, RecoveryPart[]>();
  for (const piece of pieces) {
    const key = `${piece.role}:${piece.color}:${piece.stage}`;
    buckets.set(key, [...(buckets.get(key) ?? []), piece]);
  }
  return [...buckets.values()].map(group => ({ ...group[0], id: `${which}-${group[0].role}-${group[0].color.slice(1)}`, mesh: recoveryMerge(group.map(p => p.mesh)) }));
}
export const RECOVERY_PARTS = [createParts(0), createParts(1)] as const;
const curved = (a: RecoveryPoint, b: RecoveryPoint, offset: number): RecoveryPoint[] => Array.from({ length: 25 }, (_, i) => {
  const t = i / 24, p = mixPoint(a, b, t); p[1] += Math.sin(t * Math.PI) * 3; p[2] += Math.sin(t * Math.PI) * offset; return p;
});
export const RECOVERY_LINKS: readonly (readonly RecoveryLink[])[] = [
  [{ id: 'medical-support-link', stage: 1, color: '#9d8d6c', path: curved([66, 3.6, 54], [48, 3.6, 42], 5), meaning: 'support-relationship' },
    { id: 'logistic-support-link', stage: 2, color: '#8e9d80', path: curved([69, 3.7, 23], [46, 3.7, 35], -5), meaning: 'support-relationship' }],
  [{ id: 'life-service-link', stage: 1, color: '#a49a75', path: curved([39, 3.2, 30], [64, 3.2, 31], -2), meaning: 'life-service-relationship' }],
];
export function recoveryPathPoint(path: readonly RecoveryPoint[], progress: number): RecoveryPoint {
  if (!path.length) return [0, 0, 0]; if (path.length === 1) return [...path[0]];
  const distances = path.slice(1).map((p, i) => Math.hypot(...minus(p, path[i])));
  let remaining = distances.reduce((sum, n) => sum + n, 0) * clamp(progress);
  for (let i = 0; i < distances.length; i++) {
    if (remaining <= distances[i] || i === distances.length - 1) return mixPoint(path[i], path[i + 1], distances[i] ? clamp(remaining / distances[i]) : 0);
    remaining -= distances[i];
  }
  return [...path.at(-1)!];
}
/** Closed thin paper connection, without arrowheads: it denotes support or
 * everyday service relationships, never a transport or evacuation route. */
export function recoveryLinkMesh(link: RecoveryLink, reveal: number, segments = 24): RecoveryMeshData {
  const positions: number[] = [], indices: number[] = [], end = clamp(reveal), width = .75 * smooth(end / .06), depth = .22 * smooth(end / .06);
  for (let i = 0; i <= segments; i++) {
    const t = end * i / segments, p = recoveryPathPoint(link.path, t);
    const tangent = minus(recoveryPathPoint(link.path, Math.min(1, t + .001)), recoveryPathPoint(link.path, Math.max(0, t - .001)));
    const side = unit(cross(unit(tangent), [0, 1, 0]));
    for (const [w, h] of [[width / 2, depth / 2], [-width / 2, depth / 2], [-width / 2, -depth / 2], [width / 2, -depth / 2]]) positions.push(p[0] + side[0] * w, p[1] + h, p[2] + side[2] * w);
    if (i < segments) for (let j = 0; j < 4; j++) { const a = i * 4 + j, b = i * 4 + (j + 1) % 4; indices.push(a, b, b + 4, a, b + 4, a + 4); }
  }
  const k = segments * 4; indices.push(0, 2, 1, 0, 3, 2, k, k + 1, k + 2, k, k + 2, k + 3);
  return { positions, indices };
}
export function evaluateRecovery(input: number, selected: number = 0) {
  const phase = clamp(input), selection = recoveryCaseIndex(selected), currentCase = RECOVERY_CASES[selection];
  const stageIndex = phase < .25 ? 0 : phase < .75 ? 1 : 2;
  const stage = (selection === 0 ? ['search-rescue', 'medical-support', 'logistics-support'] : ['relocated-town', 'restored-daily-life', 'disaster-capacity-concept'])[stageIndex];
  const blend = smooth(phase <= .5 ? phase * 2 : (phase - .5) * 2);
  const emphasis = phase <= .5 ? [1 - blend, blend, 0] : [0, 1 - blend, blend];
  const nodes = RECOVERY_NODES[selection].map((node, index) => ({ ...node, stageIndex: index, selection, phase: RECOVERY_STOPS[selection][index].phase }));
  const focusPoint = phase <= .5 ? mixPoint(nodes[0].point, nodes[1].point, smooth(phase * 2)) : mixPoint(nodes[1].point, nodes[2].point, smooth((phase - .5) * 2));
  const links = RECOVERY_LINKS[selection].map(link => ({ ...link, reveal: smooth((phase - (link.stage === 1 ? .13 : .56)) / .34) }));
  return { phase, selection, caseIndex: selection, caseId: currentCase.id, title: currentCase.title,
    stage, stageIndex, activeStop: stageIndex, caption: RECOVERY_STOPS[selection][stageIndex].label,
    text: currentCase.text[stageIndex], source: currentCase.source, reference: RECOVERY_REFERENCE,
    phaseMeaning: 'independent-case-observation-order' as const, phaseMeansObservationOrder: true,
    calibratedTime: false, cyclic: false, replacesChoices: false, casesConnectedByTime: false,
    originalPagePreserved: true, independentCases: true, buildingsTransformBetweenCases: false,
    staticSceneRetained: true, rubbleRemoved: false, cranePresent: false,
    operationalInstructions: false, forecast: false, recoveryEffectivenessMeasured: false,
    emphasis, focusPoint, nodes, links, linksAreRoutes: false,
    partIds: RECOVERY_PARTS[selection].map(part => part.id),
    handle: mixPoint(RECOVERY_LAYOUT.track.start, RECOVERY_LAYOUT.track.end, phase),
    label: { text: RECOVERY_STOPS[selection][stageIndex].label, at: RECOVERY_LAYOUT.label, width: 40, height: 11 },
    endpointRetained: phase === 1,
  };
}
export type RecoveryState = ReturnType<typeof evaluateRecovery>;
export function recoveryDiagnostics(state: RecoveryState) { return { ...state }; }
const n = (value: number) => Number(value.toFixed(4));
export function recoveryProject([x, y, z]: RecoveryPoint): [number, number] {
  return [n(30 + x * 5.7 + (z - 37) * .48), n(250 - y * 4.3 + (z - 37) * 1.45)];
}
const tone = (hex: string, factor: number) => `#${hex.slice(1).match(/../g)!.map(s => Math.round(Math.max(0, Math.min(255, parseInt(s, 16) * factor))).toString(16).padStart(2, '0')).join('')}`;
/** Isometric faces come from precisely the same closed meshes as Three.js. */
export function recoverySvg(phase: number, selected: number = 0): string {
  const state = evaluateRecovery(phase, selected), parts = RECOVERY_PARTS[state.selection];
  const faces: { points: RecoveryPoint[]; color: string; depth: number; role: string; id: string }[] = [];
  const add = (mesh: RecoveryMeshData, color: string, role: string, id: string) => {
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const points = mesh.indices.slice(i, i + 3).map(index => mesh.positions.slice(index * 3, index * 3 + 3) as RecoveryPoint);
      const normal = unit(cross(minus(points[1], points[0]), minus(points[2], points[0])));
      const shade = .91 + Math.max(0, normal[1]) * .09 - Math.max(0, normal[0]) * .035;
      faces.push({ points, color: tone(color, shade), role, id, depth: points.reduce((sum, p) => sum + p[2] + p[1] * .28 + p[0] * .06, 0) / 3 });
    }
  };
  for (const part of parts) add(part.mesh, part.color, part.role, part.id);
  for (const link of state.links) if (link.reveal > .003) add(recoveryLinkMesh(link, link.reveal), link.color, 'support-relationship', link.id);
  let scene = faces.sort((a, b) => a.depth - b.depth).map(face =>
    `<polygon data-recovery-part="${face.id}" data-recovery-role="${face.role}" points="${face.points.map(p => recoveryProject(p).join(',')).join(' ')}" fill="${face.color}" stroke="${face.color}" stroke-width=".18"/>`).join('');
  const apron=recoveryProject([3,-6.8,73]),right=recoveryProject([97,-6.8,73]);
  scene=`<path d="M${apron[0]} ${apron[1]-11}H${right[0]}v12l-5 3H${apron[0]+4}Z" fill="#765b42" stroke="#5f5240" stroke-width="1.4"/>`+scene;
  for (const node of state.nodes) {
    const [x, y] = recoveryProject(node.point), active = node.stageIndex === state.stageIndex;
    scene += `<g data-recovery-node="${node.id}" data-recovery-node-stage="${node.stageIndex}" data-specimen-key="" data-keep-phase="" data-model-selection="${state.selection}" role="button" tabindex="0" aria-label="暂停查看${state.title}：${RECOVERY_STOPS[state.selection][node.stageIndex].label}" style="cursor:pointer"><circle cx="${x}" cy="${y}" r="${active ? 15 : 19}" fill="transparent" stroke="${active ? '#b1925a' : 'none'}" stroke-width="1.6"/></g>`;
  }
  const [lx, ly] = recoveryProject(state.label.at), labelWidth = state.label.width * 5.7;
  scene += `<g data-recovery-label="${state.stageIndex}" aria-hidden="true"><rect x="${n(lx - labelWidth / 2)}" y="${n(ly - 22)}" width="${labelWidth}" height="42" rx="2" fill="#e8ddbe" stroke="#947b50" stroke-width="1.5"/><text x="${lx}" y="${n(ly + 8)}" text-anchor="middle" font-size="30">${state.label.text}</text></g>`;
  const a = recoveryProject(RECOVERY_LAYOUT.track.start), b = recoveryProject(RECOVERY_LAYOUT.track.end), handle = recoveryProject(state.handle);
  scene += `<path d="M${a.join(' ')}L${b.join(' ')}" fill="none" stroke="#a29578" stroke-width="1.6"/><path data-recovery-handle="true" d="M${n(handle[0] - 9)} ${n(handle[1] - 6)}h18v8l-9 6-9-6Z" fill="#d6c18e" stroke="#93825e" stroke-width="1.1"/>${drawingGrip('推移观察指针',a,b,state.phase)}`;
  scene+=`<g transform="translate(63 363)" data-model-crank="1" data-radius="24" tabindex="0" role="slider" aria-label="转动观察轮" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(state.phase*100)}"><circle r="31" fill="transparent"/><circle r="24" fill="none" stroke="#6f5d40" stroke-width="6"/><circle r="24" fill="none" stroke="#c6a269" stroke-width="3"/><g transform="rotate(${-state.phase*360})"><path d="M0 24V0L-20 -12M0 0L20 -12" fill="none" stroke="#927347" stroke-width="3.4"/><circle cy="24" r="4.7" fill="#805d3c" stroke="#5b4b36"/></g><circle r="4.2" fill="#a68f63"/></g>`;
  const data = JSON.stringify(recoveryDiagnostics(state)).replace(/&/g, '&amp;').replace(/'/g, '&#39;');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="flat-model-svg flat-explanation-svg" viewBox="0 0 650 430" role="group" data-recovery-phase="${state.phase}" data-recovery-selection="${state.selection}" data-recovery-case="${state.caseId}" data-recovery-stage="${state.stage}" data-recovery-state='${data}' aria-label="${state.title}，${state.caption}。两个独立案例，进度是观察顺序，不是灾后恢复时间。"><title>${state.title} · ${state.caption}</title><g fill="#34413d" stroke-linejoin="round" stroke-linecap="round" font-family="FieldSerif,SimSun,serif">${scene}</g></svg>`;
}
import { evaluateUrbanWater, urbanWaterSvg, urbanWaterProject, URBAN_WATER_STOPS } from './textbook-urban-water-model';

/** Cross-chapter teaching scenes. All coordinates and timings are schematic.
 * Progress is an observation sequence: erosion, a storm and emergency response
 * have different real time scales and must never be read as one clock. */
export type IntegratedEffect = 'basin-system' | 'city-rain-system' | 'quake-response-system';
export type IntegratedPoint = [number, number, number];
export interface IntegratedStop { label: string; phase: number }
/** DOM menus and SVG can read inspection contracts without importing WebGL. */
export const INTEGRATED_INSPECTIONS = {
  'basin-system': [
    { target: 'overview', label: '整体流域' }, { target: 'water', label: '追踪水滴' },
    { target: 'upper', label: '上游' }, { target: 'bend', label: '河曲' },
    { target: 'mouth', label: '河口' }, { target: 'groundwater', label: '地下水' }, { target: 'sediment', label: '水沙去向' },
    { target: 'specimen-open', label: '展开标本' }, { target: 'specimen-closed', label: '合拢标本' },
  ],
  'city-rain-system': [
    { target: 'overview', label: '地表' }, { target: 'underground', label: '打开地下' },
    { target: 'packet-0', label: '追踪水滴' }, { target: 'drain', label: '排水口' }, { target: 'collected', label: '出口' },
  ],
  'quake-response-system': [
    { target: 'overview', label: '整体地景' }, { target: 'remote', label: '影像证据' },
    { target: 'position', label: '定位通信' }, { target: 'roads', label: '道路核验' }, { target: 'warehouses', label: '仓库比较' },
  ],
} as const;
const bounded = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const selectionAt = (v: number, max: number) => Math.round(Math.max(0, Math.min(max, Number.isFinite(v) ? v : 0)));
const smooth = (v: number) => { const q = bounded(v); return q * q * (3 - 2 * q); };
const between = (phase: number, start: number, end: number) => smooth((phase - start) / (end - start));
const mix = (a: IntegratedPoint, b: IntegratedPoint, t: number): IntegratedPoint => a.map((n, i) => n + (b[i] - n) * t) as IntegratedPoint;

export const INTEGRATED_STOPS: Record<IntegratedEffect, readonly IntegratedStop[]> = {
  'basin-system': [
    { label: '降雨初始', phase: 0 }, { label: '坡面汇流', phase: .2 }, { label: '上游携沙', phase: .42 },
    { label: '河曲', phase: .64 }, { label: '河口', phase: .86 }, { label: '归宿', phase: 1 },
  ],
  'city-rain-system': URBAN_WATER_STOPS,
  'quake-response-system': [
    { label: '同一地景', phase: 0 }, { label: '变化证据', phase: .28 }, { label: '定位通信', phase: .54 },
    { label: '道路核验', phase: .7 }, { label: '路线决策', phase: .82 }, { label: '沿线到达', phase: 1 },
  ],
};

/** Long-term landform observation has its own captions, never a storm clock. */
export const BASIN_ACCUMULATION_STOPS: readonly IntegratedStop[] = [
  { label: '既有流域', phase: 0 }, { label: '多次来水', phase: .2 }, { label: '反复搬运', phase: .42 },
  { label: '河曲联系', phase: .64 }, { label: '河口累积', phase: .86 }, { label: '长期结果', phase: 1 },
];

export const INTEGRATED_CONTROLS: Record<IntegratedEffect, readonly string[]> = {
  'basin-system': ['本次水路', '长期累积', '强降水对照'],
  'city-rain-system': ['硬化地面', '透水地面', '雨水花园'],
  // Evidence switches are independent bits, not a list of chronological modes.
  'quake-response-system': [],
};

export const INTEGRATED_REFERENCES = {
  'basin-system': {
    printedPages: [46, 47, 68, 69, 70, 71, 100, 101, 102],
    subjects: ['水循环', '河流地貌', '洪涝'],
    modelType: 'cross-chapter-schematic-basin', realBasin: false, calibratedTime: false,
    measuredWaterVolume: false, sedimentLoadCalculated: false, hydrodynamicFloodPrediction: false,
    interpretation: '同一流域保留既有河谷、河曲与河口；跟踪水与泥沙的联系，不表示一次降水造出所有地貌。前坡为可移动标本切片，开合只帮助观察，不表示真实地貌或水路位移。',
  },
  'city-rain-system': {
    printedPages: [46, 47, 88, 89, 96, 97, 98], subjects: ['水循环', '土壤', '城市内涝问题研究'],
    modelType: 'same-finite-rainfall-comparison', calibratedTime: false, measuredWaterVolume: false,
    interpretation: '复用同一组有限示踪、同一城市场地与出口；数量是示踪符号，不是水量比例或工程设计指标。',
  },
  'quake-response-system': {
    printedPages: [106, 107, 110, 111, 114, 115, 116, 117, 118, 119, 120, 121],
    subjects: ['地震', '防灾减灾', '遥感', '全球卫星导航系统', '地理信息系统', '救灾物资储备库'],
    modelType: 'fictional-observation-verification-and-routing', fictionalLandscape: true,
    earthquakePrediction: false, accuracyCalculated: false, realRoadData: false, realDispatch: false,
    interpretation: '遥感提供变化线索；定位需独立通信才能送达；GIS只在已核验通路中比较示意路线。',
  },
} as const;

/** Proposed anchors for the parent's catalog. These are cross-chapter
 * additions, never captions claimed to appear verbatim on the source page. */
export const INTEGRATED_CATALOG_SUGGESTIONS = [
  { id: 'basin-system', effect: 'basin-system', title: '综合观察　流域里的水与沙', pdf: 52,
    rect: [.06, .48, .87, .4], origin: 'text', marker: [.94, .46], playback: 'once', restartOnSelection: true,
    controls: INTEGRATED_CONTROLS['basin-system'], note: INTEGRATED_REFERENCES['basin-system'].interpretation },
  { id: 'city-rain-system', effect: 'city-rain-system', title: '综合实验　一场雨进入城市', pdf: 102,
    rect: [.12, .28, .78, .44], origin: 'text', marker: [.94, .24], playback: 'once', restartOnSelection: true,
    controls: INTEGRATED_CONTROLS['city-rain-system'], note: INTEGRATED_REFERENCES['city-rain-system'].interpretation },
  { id: 'quake-response-system', effect: 'quake-response-system', title: '综合推演　震后，先看清再抵达', pdf: 125,
    rect: [.1, .22, .8, .48], origin: 'text', marker: [.94, .18], playback: 'once',
    controls: INTEGRATED_CONTROLS['quake-response-system'], restartOnSelection: false,
    note: INTEGRATED_REFERENCES['quake-response-system'].interpretation },
] as const;

export function basinRiverPoint(t0: number): IntegratedPoint {
  const t = bounded(t0), amplitude = 1.8 + 8.2 * Math.sin(Math.PI * t) ** 2;
  return [8 + 91 * t, 4.7 + 23 * (1 - t) ** 1.85,
    34 + amplitude * Math.sin(t * Math.PI * 3 - .4)];
}
export function basinGround(x: number, z: number): number {
  const t = bounded((x - 8) / 91), river = basinRiverPoint(t), distance = Math.abs(z - river[2]);
  const bank = smooth((distance - (1.4 + t * 1.4)) / 12);
  const shoulder = 4.2 + 19 * (1 - t) ** 1.8;
  return river[1] - .8 + shoulder * bank;
}
export function basinFloodLevel(x: number, floodRise: number): number {
  const t = bounded((x - 8) / 91);
  return basinRiverPoint(t)[1] + .15 + bounded(floodRise) * 4.5;
}

/** The SVG and the raised water surface use the same clipped terrain grid.
 * Each output triangle is in basin coordinates; no map-wide blue rectangle. */
export function basinFloodTriangles(inputRise: number): IntegratedPoint[][] {
  const rise = bounded(inputRise);
  if (rise <= .001) return [];
  const nx = 27, nz = 24, triangles: IntegratedPoint[][] = [];
  const clip = (triangle: IntegratedPoint[]) => {
    const out: IntegratedPoint[] = [];
    for (let i = 0; i < 3; i++) {
      const a = triangle[i], b = triangle[(i + 1) % 3];
      const da = a[1] - basinFloodLevel(a[0], rise), db = b[1] - basinFloodLevel(b[0], rise);
      if (da <= 0) out.push(a);
      if ((da < 0) !== (db < 0)) out.push(mix(a, b, da / (da - db)));
    }
    for (let i = 1; i < out.length - 1; i++) triangles.push([out[0], out[i + 1], out[i]]
      .map(point => [point[0], basinFloodLevel(point[0], rise) + .08, point[2]] as IntegratedPoint));
  };
  for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
    const points = [[ix, iz], [ix + 1, iz], [ix + 1, iz + 1], [ix, iz + 1]].map(([x, z]): IntegratedPoint => {
      const xx = 41 + x / nx * 57, zz = 5 + z / nz * 57; return [xx, basinGround(xx, zz), zz];
    });
    clip([points[0], points[1], points[2]]); clip([points[0], points[2], points[3]]);
  }
  return triangles;
}

interface PathKey { at: number; point: IntegratedPoint; compartment: string }
function onPath(keys: PathKey[], phase: number) {
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].at <= phase) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
  const q = b.at > a.at ? smooth((phase - a.at) / (b.at - a.at)) : 0;
  const point = mix(a.point, b.point, q);
  return { point, compartment: a.compartment, trace: [...keys.slice(0, i + 1).map(key => key.point), point],
    complete: phase >= keys.at(-1)!.at };
}
export function basinWaterPath(index: number, selection: number): PathKey[] {
  const j = Math.max(0, Math.min(11, Math.floor(index))), spread = (j % 4 - 1.5) * 2;
  const origin: IntegratedPoint = [104 + j % 3 * 2, 5.2, 25 + Math.floor(j / 3) * 5];
  const river = basinRiverPoint(.035 + j * .006);
  const keys: PathKey[] = [
    { at: 0, point: [river[0] - 1 + spread, 57 + j % 3, river[2] + spread], compartment: 'cloud' },
    { at: .19, point: [river[0] - 1 + spread, basinGround(river[0] - 1 + spread, river[2] + spread) + .8, river[2] + spread], compartment: 'surface' },
    { at: .36, point: [river[0], river[1] + .6, river[2]], compartment: 'river' },
  ];
  if (j >= 9 && selectionAt(selection, 2) !== 2) return [keys[0], keys[1],
    { at: .33, point: [18 + (j - 9) * 2, 17, 63], compartment: 'soil' },
    { at: .58, point: [42 + (j - 9) * 2, 8, 63], compartment: 'groundwater' },
    { at: .82, point: [80 + (j - 9) * 2, 5.5, 63], compartment: 'groundwater' },
    { at: 1, point: [104 + (j - 9) * 2, 5.2, 59], compartment: 'sea' }];
  for (const [at, t] of [[.53, .25], [.64, .46], [.73, .67], [.83, .88]] as const) {
    const point = basinRiverPoint(t + j * .002); point[1] += .6; keys.push({ at, point, compartment: 'river' });
  }
  if (selectionAt(selection, 2) === 2 && j >= 9) {
    const t = .69 + (j - 9) * .045, point = basinRiverPoint(t);
    keys.pop();
    keys.push({ at: .84, point: [point[0], point[1] + 3.5, point[2] + 3], compartment: 'floodplain' },
      { at: 1, point: [point[0] + 2, basinFloodLevel(point[0] + 2, 1) + .3, point[2] + 7], compartment: 'floodplain' });
  } else keys.push({ at: 1, point: [origin[0], 5.2, origin[2]], compartment: 'sea' });
  return keys;
}
export function evaluateBasin(inputPhase: number, inputSelection = 0) {
  const phase = bounded(inputPhase), selection = selectionAt(inputSelection, 2), longTerm = selection === 1;
  const stageIndex = phase < .19 ? 0 : phase < .36 ? 1 : phase < .6 ? 2 : phase < .8 ? 3 : phase < .93 ? 4 : 5;
  const title = (longTerm
    ? ['河谷已经存在，切换到长期观察', '示踪代表多次来水的联系', '长期反复搬运已有松散物质', '河曲侵蚀与堆积的长期联系', '多次来沙，部分累积在河口', '长期累积，沉积体向河口展开']
    : ['同一批降水，从云下开始', '地表与地下，两支水路', '上游水流携带已有松散物质', '河曲外侧侵蚀，内侧堆积', '水入海，部分泥沙留在河口', selection === 2 ? '水位抬升，漫向低平河漫滩' : '水与泥沙，分别保留归宿'])[stageIndex];
  const text = [
    '蓝色标记保留身份，追踪这一批降水的去向，不表示真实水滴大小、雨量或流速。',
    '降水可沿地表汇流，也可下渗。本景追踪进入河道的这一支，未画出的支路仍然存在。',
    '河谷已经存在；本段只观察水流如何搬运已有松散物质，不表示一次降水雕刻出整条河谷。',
    '平原河段呈现既有河曲。一般凹岸侵蚀、凸岸堆积；局部变化与水流、物质条件有关。',
    '进入河口后，流速等条件变化可使部分泥沙沉积。沉积示踪留在落点，不把所有来沙都强制留在河口。',
    selection === 2 ? '强降水对照抬高示意水面，低于水面的地形先被淹；这不是洪水深度、范围或风险预报。' : longTerm ? '此条件的进度表示长期沉积累积；它不是本次降雨的钟表，也不是每次降雨都会形成同样的三角洲。' : '水体和沉积保留在接收端。需要看地貌累积时，另选长期累积，不把一次降雨当成长时期。',
  ][stageIndex];
  const packets = Array.from({ length: 12 }, (_, i) => ({ id: `basin-water-${i}`, ...onPath(basinWaterPath(i, selection), phase) }));
  const sediment = Array.from({ length: 8 }, (_, i) => {
    const initial = basinRiverPoint(.1 + i * .011); initial[1] -= .45;
    const moving = bounded((phase - .43 - i * .008) / (.48 - i * .006));
    const t = .1 + i * .011 + (1 - .1 - i * .011) * smooth(moving), point = basinRiverPoint(t);
    point[1] += .35;
    const deposited = i < 5 && moving >= 1;
    const endpoint: IntegratedPoint = [96 + i * 1.5, 4.95, 25 + i * 3.8];
    if (moving === 0) point.splice(0, 3, ...initial);
    else if (moving > .88) point.splice(0, 3, ...mix(point, i < 5 ? endpoint : [108, 4.9, 35 + i] as IntegratedPoint, smooth((moving - .88) / .12)));
    return { id: `basin-sand-${i}`, point, progress: moving, deposited,
      status: moving === 0 ? 'bed' : deposited ? 'deposited' : moving === 1 ? 'exported' : 'moving' };
  });
  return { kind: 'basin-system' as const, phase, selection, stageIndex, title, caption: title, text,
    packets, sediment, floodRise: selection === 2 ? between(phase, .82, 1) : 0,
    longTerm, timeScale: longTerm ? '长期累积示意' : '本次水路', accumulation: longTerm ? between(phase, .45, 1) : 0,
    stage: (longTerm ? BASIN_ACCUMULATION_STOPS : INTEGRATED_STOPS['basin-system'])[stageIndex].label,
    stops: longTerm ? BASIN_ACCUMULATION_STOPS : INTEGRATED_STOPS['basin-system'],
    reference: INTEGRATED_REFERENCES['basin-system'], calibratedTime: false, differentTimeScales: true,
    waterMarkersAreVolumes: false, sedimentMarkersAreMass: false, formsEntireValleyInOneStorm: false };
}

export type RoadStatus = 'unobserved' | 'pending' | 'blocked' | 'passable';
export const QUAKE_LAYOUT = {
  nodes: {
    a: [10, 3, 45], b: [18, 3, 13], bridge: [49, 3, 43], south: [30, 3, 59],
    east: [76, 3, 57], north: [66, 4, 16], town: [88, 3, 40],
  } as Record<string, IntegratedPoint>,
  satellites: [[23, 68, 5], [49, 75, 20], [90, 69, 9], [105, 66, 61]] as IntegratedPoint[],
  receiver: [88, 8, 40] as IntegratedPoint,
  warehouses: ['a', 'b'],
  roads: [
    { id: 'a-bridge', a: 'a', b: 'bridge', role: 'access' },
    { id: 'bridge-town', a: 'bridge', b: 'town', role: 'damaged-bridge' },
    { id: 'a-south', a: 'a', b: 'south', role: 'detour' },
    { id: 'south-east', a: 'south', b: 'east', role: 'detour' },
    { id: 'east-town', a: 'east', b: 'town', role: 'detour' },
    { id: 'b-north', a: 'b', b: 'north', role: 'alternative' },
    { id: 'north-town', a: 'north', b: 'town', role: 'alternative' },
  ],
};
export interface VerifiedRoad { id: string; a: string; b: string; status: RoadStatus; role?: string }
export const QUAKE_FLAGS = { communication: 1, verified: 2, warehouseB: 4, layers: 8 } as const;
export function quakeResponseActions(selection: number, phase = 1) {
  const value = selectionAt(selection, 15);
  return [
    { id: 'send', label: value & 1 ? '位置已发送' : '发送定位信息', selection: value | 1, enabled: phase >= .49, pressed: !!(value & 1), replay: false },
    { id: 'verify', label: value & 2 ? '保留道路待确认' : '核验绕行线可通行', selection: value ^ 2, enabled: phase >= .62, pressed: !!(value & 2), replay: false },
    { id: 'warehouse-a', label: '比较甲库方案', selection: value & ~4, enabled: true, pressed: !(value & 4), replay: true },
    { id: 'warehouse-b', label: '比较乙库方案', selection: value | 4, enabled: true, pressed: !!(value & 4), replay: true },
    { id: 'layers', label: value & 8 ? '叠合信息层' : '分离信息层', selection: value ^ 8, enabled: true, pressed: !!(value & 8), replay: false },
  ];
}
/** No unknown road is silently made traversable. Lengths compare fictional
 * geometry only; this is neither a fastest-route nor a real safety engine. */
export function confirmedRoute(roads: VerifiedRoad[], origin: string, destination: string): string[] | null {
  if (!(origin in QUAKE_LAYOUT.nodes) || !(destination in QUAKE_LAYOUT.nodes)) return null;
  const distances = new Map<string, number>([[origin, 0]]), previous = new Map<string, string>(), visited = new Set<string>();
  while (true) {
    const next = [...distances].filter(([node]) => !visited.has(node)).sort((a, b) => a[1] - b[1])[0];
    if (!next) return null;
    const [node, distance] = next;
    if (node === destination) {
      const result = [node]; while (result[0] !== origin) result.unshift(previous.get(result[0])!); return result;
    }
    visited.add(node);
    for (const edge of roads.filter(road => road.status === 'passable' && (road.a === node || road.b === node))) {
      const other = edge.a === node ? edge.b : edge.a;
      const a = QUAKE_LAYOUT.nodes[node], b = QUAKE_LAYOUT.nodes[other];
      if (!a || !b) continue;
      const candidate = distance + Math.hypot(...a.map((value, i) => value - b[i]));
      if (candidate < (distances.get(other) ?? Infinity)) { distances.set(other, candidate); previous.set(other, node); }
    }
  }
}
export function integratedRoutePoint(route: readonly IntegratedPoint[], progress: number): IntegratedPoint {
  if (!route.length) return [0, 0, 0];
  if (route.length === 1) return [...route[0]];
  const lengths = route.slice(1).map((point, i) => Math.hypot(...point.map((value, axis) => value - route[i][axis])));
  let target = bounded(progress) * lengths.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (target <= lengths[i] || i === lengths.length - 1) return mix(route[i], route[i + 1], lengths[i] ? bounded(target / lengths[i]) : 0);
    target -= lengths[i];
  }
  return [...route.at(-1)!];
}
export function evaluateQuakeResponse(inputPhase: number, inputSelection = 0) {
  const phase = bounded(inputPhase), selection = selectionAt(inputSelection, 15), origin = selection & 4 ? 'b' : 'a';
  const stageIndex = phase < .18 ? 0 : phase < .42 ? 1 : phase < .62 ? 2 : phase < .76 ? 3 : phase < .9 ? 4 : 5;
  const remoteObserved = phase >= .28, positionKnown = phase >= .49;
  const communicationDelivered = !!(selection & 1) && positionKnown && phase >= .58;
  const roads: VerifiedRoad[] = QUAKE_LAYOUT.roads.map(edge => {
    let status: RoadStatus = phase < .28 ? 'unobserved' : 'pending';
    if (phase >= .62 && edge.role === 'damaged-bridge') status = 'blocked';
    if (phase >= .68 && edge.role === 'access') status = 'passable';
    if (phase >= .7 && (selection & 2) && edge.role !== 'damaged-bridge') status = 'passable';
    return { ...edge, status };
  });
  const route = communicationDelivered ? confirmedRoute(roads, origin, 'town') : null;
  const routePoints = route?.map(id => QUAKE_LAYOUT.nodes[id]) ?? [];
  const rescueProgress = route ? between(phase, .79, 1) : 0;
  const vehicle = route ? integratedRoutePoint(routePoints, rescueProgress) : [...QUAKE_LAYOUT.nodes[origin]] as IntegratedPoint;
  const title = ['一处地景，保留震前参照', '遥感发现变化，仍须核验', '定位与通信分别完成', '地形、灾情、道路在同一位置叠合', route ? '只选已核验可通的路线' : '通路待确认，车辆原地等待', route ? '沿已确认路线接近目标' : '信息仍不完整，继续保留待确认'][stageIndex];
  const text = [
    '甲、乙两处物资库与同一村镇保持在原位。地图、地形和标注表达同一虚构地区，不使用真实灾情。',
    '影像变化可指示需要查看的区域，不能单凭变化图斑断言桥梁可通或建筑安全。',
    '卫星信号供接收机定位；位置还须通过独立通信送达。图中的接收链路不表示精度解算或真实星座。',
    '桥梁状态和候选通路分开核验。待确认不会自动变为畅通，定位成功也不等于可以出发。',
    route ? '绕开已确认中断路段，在已核验路网中连通仓库和目标；这里只比较示意路线，不评定仓库最优。' : '当前没有已核验的完整通路。车辆不走未知道路；可以切换核验条件比较结果。',
    route ? '车辆沿道路接近目标，到达后保留在原地。真实调度还需物资、运力、道路承载与实时安全条件。' : '待确认是有效结果。信息不足时保留不确定性，比给出一条看似精确的路线更重要。',
  ][stageIndex];
  const navigation = QUAKE_LAYOUT.satellites.map((source, i) => {
    const progress = between(phase, .36 + i * .012, .46 + i * .01);
    return { id: `navigation-${i}`, source, target: QUAKE_LAYOUT.receiver, progress,
      point: mix(source, QUAKE_LAYOUT.receiver, progress), arrived: progress === 1 };
  });
  const communication = { progress: selection & 1 ? between(phase, .5, .58) : 0, source: QUAKE_LAYOUT.receiver,
    target: [50, 8, 7] as IntegratedPoint };
  return { kind: 'quake-response-system' as const, phase, selection, stageIndex, stage: INTEGRATED_STOPS['quake-response-system'][stageIndex].label,
    title, caption: title, text, remoteObserved, positionKnown, communicationDelivered, roads, route, routePoints,
    origin, vehicle, rescueProgress, navigation, communication, layersSeparated: !!(selection & 8),
    evidence: { remote: remoteObserved ? 'change-observed' : 'not-observed',
      position: positionKnown ? 'located' : 'not-located', communication: communicationDelivered ? 'delivered' : 'not-delivered',
      detour: phase >= .7 && (selection & 2) ? 'verified-passable' : 'pending', warehouse: origin },
    damage: between(phase, .12, .2), scanning: between(phase, .18, .32),
    pendingRoads: roads.filter(edge => edge.status === 'pending').map(edge => edge.id),
    stops: INTEGRATED_STOPS['quake-response-system'], reference: INTEGRATED_REFERENCES['quake-response-system'],
    transmitsDistressByPassiveGnss: false, unknownRoadsArePassable: false, optimalWarehouseCalculated: false };
}

export function evaluateCityRain(phase: number, selection = 0) {
  const state = evaluateUrbanWater(phase, selection);
  return { ...state, kind: 'city-rain-system' as const, title: state.caption, text: state.text,
    stops: INTEGRATED_STOPS['city-rain-system'], reference: INTEGRATED_REFERENCES['city-rain-system'],
    sameCityGeometry: true, sameRainInput: true, unitsAreSchematic: true };
}
export function evaluateIntegrated(effect: string, phase: number, selection = 0) {
  if (effect === 'basin-system') return evaluateBasin(phase, selection);
  if (effect === 'city-rain-system') return evaluateCityRain(phase, selection);
  if (effect === 'quake-response-system') return evaluateQuakeResponse(phase, selection);
  return null;
}

const COLORS = { ink: '#273d40', paper: '#f4f0e5', water: '#4d8c98', soil: '#cbbd99', grass: '#91aa88', gold: '#b3925a', pending: '#a75541' };
function svgPoint(p: IntegratedPoint): [number, number] { return [70 + p[0] * 4.7 + p[2] * .65, 350 + p[2] * 1.15 - p[1] * 3.1]; }
const coords = (p: IntegratedPoint) => svgPoint(p).map(v => v.toFixed(2)).join(',');
const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const svgInspect = (target: string, label: string, body: string) => `<g data-model-inspection="${target}" data-model-inspect="${target}" role="button" tabindex="0" aria-label="${escape(label)}">${body}</g>`;
function svgText(text: string, at: IntegratedPoint, size = 15) { const [x, y] = svgPoint(at); return `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" fill="${COLORS.ink}">${escape(text)}</text>`; }
function svgShell(effect: string, title: string, body: string, metadata: object) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 500" role="img" aria-label="${escape(title)}" data-integrated-effect="${effect}" data-integrated-state='${escape(JSON.stringify(metadata))}'><style>text{font-family:FieldSans,"Microsoft YaHei",sans-serif} [role=button]{cursor:pointer;outline:none}[role=button]:focus{filter:drop-shadow(0 0 3px #b3925a)}</style><rect x="10" y="10" width="680" height="480" rx="12" fill="#faf7ee" stroke="#d0c7b3"/><g stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;
}
export function integratedSvg(effect: string, phase: number, selection = 0, inspection = 'overview'): string {
  if (effect === 'city-rain-system') {
    const open = inspection !== 'overview';
    const polygon = [[6, 0, 63.7], [92, 0, 63.7], [92, 20.8, 63.7], [6, 20.8, 63.7]].map(point => urbanWaterProject(point as IntegratedPoint).join(',')).join(' ');
    const panel = open ? '' : `<polygon data-underground-side="closed" points="${polygon}" fill="#cbbd99" stroke="#6c7c71"/>`;
    const toggle = svgInspect(open ? 'overview' : 'underground', open ? '合上地下侧面' : '打开地下侧面', `<rect x="272" y="282" width="154" height="36" rx="3" fill="#faf7ee" stroke="#b3925a"/><text x="349" y="306" text-anchor="middle" font-size="20" fill="#273d40">${open ? '合上侧面' : '打开地下'}</text>`);
    return urbanWaterSvg(phase, selection, inspection === 'underground' ? 'overview' : inspection)
      .replace('</svg>', `<g data-integrated-effect="city-rain-system" data-underground-open="${open}">${panel}${toggle}</g></svg>`);
  }
  if (effect === 'basin-system') {
    const state = evaluateBasin(phase, selection), water = state.packets, sediment = state.sediment;
    const lines = Array.from({ length: 24 }, (_, i) => {
      const x = 5 + i * 4, points = Array.from({ length: 21 }, (_, j): IntegratedPoint => [x, basinGround(x, 4 + j * 3), 4 + j * 3]);
      return `<polyline points="${points.map(coords).join(' ')}" fill="none" stroke="#879c7e" stroke-width=".65"/>`;
    }).join('');
    const river = Array.from({ length: 70 }, (_, i) => basinRiverPoint(i / 69));
    const plateau = `<polygon points="${[[4, 0, 3], [99, 0, 3], [99, 0, 67], [4, 0, 67]].map(p => coords(p as IntegratedPoint)).join(' ')}" fill="${COLORS.grass}" stroke="${COLORS.ink}"/>`;
    const currentTrace = water[inspection === 'groundwater' ? 9 : 0].trace.map(coords).join(' ');
    const body = plateau + lines + `<polyline points="${river.map(coords).join(' ')}" fill="none" stroke="${COLORS.water}" stroke-width="9"/>`
      + (state.floodRise > 0 ? `<g data-terrain-clipped-flood="true" fill="${COLORS.water}" opacity=".48">${basinFloodTriangles(state.floodRise).map(triangle => `<polygon points="${triangle.map(coords).join(' ')}"/>`).join('')}</g>` : '')
      + (state.accumulation > 0 ? `<polygon data-long-term-deposit="${state.accumulation}" points="${[[103 - 7 * state.accumulation, 5.3, 29], [103 + 6 * state.accumulation, 5.3, 22], [103 + 6 * state.accumulation, 5.3, 36]].map(point => coords(point as IntegratedPoint)).join(' ')}" fill="${COLORS.soil}" stroke="${COLORS.gold}"/>` : '')
      + `<polyline points="${currentTrace}" fill="none" stroke="${COLORS.water}" stroke-width="1.5" stroke-dasharray="4 5"/>`
      + svgInspect('water', '追踪同一水标记', water.map(token => `<circle cx="${svgPoint(token.point)[0]}" cy="${svgPoint(token.point)[1]}" r="${token.id.endsWith('-0') ? 4.8 : 3}" fill="${COLORS.water}" stroke="#faf7ee"/>`).join(''))
      + svgInspect('sediment', '观察携沙与河口留存', sediment.map(token => `<circle cx="${svgPoint(token.point)[0]}" cy="${svgPoint(token.point)[1]}" r="3.4" fill="${COLORS.gold}" stroke="${COLORS.ink}" stroke-width=".5"/>`).join(''))
      + svgInspect('upper', '观察上游河谷', svgText('上游河谷', [21, 34, 17]))
      + svgInspect('bend', '观察凹岸与凸岸', svgText('河曲', [57, 17, 55]))
      + svgInspect('mouth', '观察河口沉积', svgText('河口', [99, 10, 50]))
      + svgText(state.timeScale, [61, -13, 62], 14)
      + INTEGRATED_CONTROLS['basin-system'].map((label, i) => `<g data-model-selection="${i}" data-model-replay="true" role="button" tabindex="0" aria-label="${label}"><rect x="${60 + i * 210}" y="451" width="195" height="30" rx="3" fill="${state.selection === i ? '#e6dfca' : '#faf7ee'}" stroke="#b3925a"/><text x="${157 + i * 210}" y="471" text-anchor="middle" fill="#273d40" font-size="14">${label}</text></g>`).join('');
    return svgShell(effect, '同一流域的水沙联系，示意模型', body, { phase: state.phase, selection: state.selection, water: water.map(v => ({ id: v.id, point: v.point, compartment: v.compartment })), sediment, floodRise: state.floodRise });
  }
  if (effect === 'quake-response-system') {
    const state = evaluateQuakeResponse(phase, selection), n = QUAKE_LAYOUT.nodes;
    const mapY = [0, 1, 2].map(i => state.layersSeparated ? 18 + i * 10 : 7 + i * .7);
    const roads = state.roads.map(edge => {
      const color = edge.status === 'passable' ? COLORS.water : edge.status === 'blocked' ? COLORS.pending : COLORS.gold;
      const midpoint = mix(n[edge.a], n[edge.b], .5), status = edge.status === 'blocked' ? '中断' : edge.status === 'pending' ? '待确认' : '';
      const height = state.layersSeparated && phase >= .62 ? mapY[2] : 3;
      const a = [...n[edge.a]] as IntegratedPoint, b = [...n[edge.b]] as IntegratedPoint; a[1] = b[1] = height;
      return svgInspect('roads', '查看道路核验状态', `<polyline points="${coords(a)} ${coords(b)}" stroke="${color}" stroke-width="3" fill="none" ${edge.status === 'pending' || edge.status === 'unobserved' ? 'stroke-dasharray="5 5"' : ''}/>${status && edge.role !== 'access' ? svgText(status, [midpoint[0], height + 3, midpoint[2]], 10) : ''}`);
    }).join('');
    const satellites = state.navigation.map(link => {
      const [x, y] = svgPoint(link.source);
      return `<rect x="${x - 7}" y="${y - 3}" width="14" height="6" fill="${COLORS.gold}" stroke="${COLORS.ink}"/>`
        + (link.progress > 0 ? `<polyline points="${coords(link.source)} ${coords(link.point)}" fill="none" stroke="${COLORS.water}" stroke-width="1" stroke-dasharray="3 5"/>` : '');
    }).join('');
    const route = state.route ? `<polyline points="${state.routePoints.map(coords).join(' ')}" fill="none" stroke="${COLORS.water}" stroke-width="7" opacity=".65"/>` : '';
    const warehouses = ['a', 'b'].map((id, i) => { const [x, y] = svgPoint(n[id]); const action = quakeResponseActions(state.selection, state.phase).find(item => item.id === `warehouse-${id}`)!;
      return `<g data-model-selection="${action.selection}" data-model-replay="true" role="button" tabindex="0" aria-label="${action.label}"><path d="M${x - 12} ${y}v-16h24v16Z M${x - 15} ${y - 16}l15-9 15 9" fill="${COLORS.soil}" stroke="${COLORS.ink}"/>${svgText(`${i ? '乙' : '甲'}库`, [n[id][0], 10, n[id][2]], 13)}</g>`;
    }).join('');
    const [tx, ty] = svgPoint(n.town), [vx, vy] = svgPoint(state.vehicle);
    const layers = state.layersSeparated ? mapY.map((height, i) => {
      const available = i === 0 ? state.remoteObserved : i === 1 ? state.positionKnown : phase >= .62;
      return available ? `<g data-map-layer="${i}" data-map-height="${height}"><polygon points="${[[2, height, 4], [106, height, 4], [106, height, 65], [2, height, 65]].map(p => coords(p as IntegratedPoint)).join(' ')}" fill="none" stroke="${COLORS.gold}" stroke-width=".9"/>${svgText(['影像', '位置', '道路'][i], [111, height, 38], 11)}</g>` : '';
    }).join('') : '';
    const body = `<polygon points="${[[3, 0, 5], [106, 0, 5], [106, 0, 66], [3, 0, 66]].map(p => coords(p as IntegratedPoint)).join(' ')}" fill="#dce1cf" stroke="${COLORS.ink}"/>`
      + layers
      + roads + route + warehouses + `<path d="M${tx - 10} ${ty}v-15h21v15Z M${tx - 14} ${ty - 15}l14-10 14 10" fill="#eee2ce" stroke="${COLORS.ink}"/>`
      + satellites + svgInspect('position', '观察定位与独立通信', svgText(state.positionKnown ? '接收机已定位' : '目标村镇', [88, 20, 40], 13))
      + (state.positionKnown ? svgText(state.communicationDelivered ? '位置已送达调度端' : '位置尚未送达调度端', [51, 18, 8], 12) : '')
      + (state.remoteObserved ? svgInspect('remote', '影像变化不等于通行核验', `<polygon points="${[[43, mapY[0], 36], [57, mapY[0], 36], [57, mapY[0], 49], [43, mapY[0], 49]].map(p => coords(p as IntegratedPoint)).join(' ')}" fill="none" stroke="${COLORS.pending}" stroke-dasharray="4 4"/>`) : '')
      + `<rect x="${vx - 6}" y="${vy - 7}" width="12" height="7" rx="1" fill="${COLORS.gold}" stroke="${COLORS.ink}"/>`
      + svgText(state.route ? '已核验路线' : '通路待确认，原地等待', [58, -12, 65], 14)
      + quakeResponseActions(state.selection, state.phase).filter(action => !action.replay).map((action, i) => {
        const label = action.id === 'send' ? state.communicationDelivered ? '位置已送达' : '发送位置' : action.id === 'verify' ? state.selection & 2 ? '恢复待确认' : '核验绕行线' : state.layersSeparated ? '叠合信息层' : '分离信息层';
        return `<g ${action.enabled ? `data-model-selection="${action.selection}"` : ''} role="button" tabindex="${action.enabled ? 0 : -1}" aria-disabled="${!action.enabled}" aria-label="${action.label}"><rect x="${68 + i * 211}" y="451" width="196" height="30" rx="3" fill="#faf7ee" stroke="#b3925a" opacity="${action.enabled ? 1 : .45}"/><text x="${166 + i * 211}" y="471" text-anchor="middle" fill="#273d40" font-size="14">${label}</text></g>`;
      }).join('');
    return svgShell(effect, '虚构震后地景：观测、核验与救援', body, { phase: state.phase, selection: state.selection, roads: state.roads, route: state.route, vehicle: state.vehicle, positionKnown: state.positionKnown, communicationDelivered: state.communicationDelivered });
  }
  return '';
}

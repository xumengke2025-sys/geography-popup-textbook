/** PEP Geography I, pp.46–47 / fig.3.2, checked against page-051/052.webp.
 * Six persistent marks follow selected possible routes. Their number, sizes,
 * timing and separation are explanatory, never a water-budget measurement. */
export type WaterCycleSelection = 0 | 1 | 2;
export type WaterCyclePoint = readonly [number, number, number];
export interface WaterCycleStop { label: string; phase: number }
export const WATER_CYCLE_STOPS: Record<WaterCycleSelection, readonly WaterCycleStop[]> = {
  0: [{ label: '海水蒸发', phase: .18 }, { label: '水汽输送', phase: .34 },
    { label: '凝结成云', phase: .48 }, { label: '陆地降水', phase: .64 },
    { label: '两路回流', phase: .84 }, { label: '回到海洋', phase: 1 }],
  1: [{ label: '蒸发与蒸腾', phase: .26 }, { label: '陆地凝结', phase: .52 },
    { label: '陆地降水', phase: .82 }, { label: '补给陆地', phase: 1 }],
  2: [{ label: '海水蒸发', phase: .26 }, { label: '海上凝结', phase: .52 },
    { label: '海面降水', phase: .86 }, { label: '回到海洋', phase: 1 }],
};
export const WATER_CYCLE_REFERENCE = {
  textbookPages: [46, 47], pdfPages: [51, 52], figure: '3.2',
  cyclesAreIndependentSelections: true, progressMeansTeachingOrder: true,
  sampleCountIsNotWaterAmount: true, branchCountsAreNotRunoffFractions: true,
  vaporIsInvisible: true, vaporMarksAreSymbols: true, cloudIsCondensedLiquidWater: true,
  allWaterFollowsTheseRoutes: false, allPrecipitationFallsImmediately: false,
  measuredFlowRate: false, measuredTime: false, measuredWaterBudget: false,
  subterraneanRoute: 'schematic-cutaway-return-to-lower-river-and-sea',
} as const;
export const WATER_CYCLE_SAMPLE_IDS = ['water-01', 'water-02', 'water-03', 'water-04', 'water-05', 'water-06'] as const;
export const WATER_CYCLE_NAMES = ['海陆间循环', '陆地内循环', '海上内循环'] as const;
export const WATER_CYCLE_LAYOUT = {
  minX: 4, maxX: 97, back: 8, front: 50, seaLevel: 8, bottom: .4,
  trackStart: [12, -11, 66] as WaterCyclePoint, trackEnd: [88, -11, 66] as WaterCyclePoint,
  bounds: { min: [0, -17, 3] as WaterCyclePoint, max: [105, 70, 73] as WaterCyclePoint },
} as const;

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const ease = (n: number) => { const q = clamp(n); return q * q * (3 - 2 * q); };
const blend = (a: number, b: number, n: number) => a + (b - a) * n;
export const normalizeWaterCycleSelection = (n: number): WaterCycleSelection => Math.max(0, Math.min(2, Number.isFinite(n) ? Math.round(n) : 0)) as WaterCycleSelection;
export const waterCycleCoastX = (z: number) => 64 + 1.8 * Math.sin((z - 8) / 42 * Math.PI * 1.2);
export const waterCycleRiverZ = (x: number) => 24 + .43 * (x - 23) + 2 * Math.sin(clamp((x - 23) / 44) * Math.PI);
export const waterCycleRiverLevel = (x: number) => 8 + 18 * (1 - clamp((x - 23) / 44)) ** 2.3;

/** The same valley is cut into the land height field and filled by the river.
 * Coordinates are teaching geometry; no coast or measured elevation is used. */
export function waterCycleTerrainHeight(x: number, z: number) {
  const coast = waterCycleCoastX(z), u = clamp((x - 4) / (coast - 4));
  const raw = 8.2 + 6.6 * (1 - u) + 16 * Math.exp(-((x - 18) ** 2 / 95 + (z - 20) ** 2 / 100))
    + 9 * Math.exp(-((x - 35) ** 2 / 105 + (z - 24) ** 2 / 110));
  // River sections share one X and one level. Cutting by nearest sloping
  // segment shifted the downstream bank and could leave water above it.
  // This cross-section distance gives both banks the exact same water level.
  const nearestX = Math.max(23, Math.min(67, x));
  const distance = Math.hypot(x - nearestX, z - waterCycleRiverZ(nearestX));
  const valley = waterCycleRiverLevel(nearestX) - .65;
  return blend(valley, Math.max(raw, valley + 1.6), ease(distance / 3.4));
}
export function waterCycleRiverSection(x: number) {
  const z = waterCycleRiverZ(x), level = waterCycleRiverLevel(x);
  const edge = (side: number) => {
    let low = 0, high = 3.4;
    for (let i = 0; i < 16; i++) {
      const mid = (low + high) / 2;
      if (waterCycleTerrainHeight(x, z + side * mid) < level) low = mid; else high = mid;
    }
    return z + side * low;
  };
  return { x, level, leftZ: edge(-1), rightZ: edge(1), bed: level - .58 };
}

export interface WaterCycleMesh { positions: number[]; indices: number[] }
export function waterCycleLandMesh(nx = 42, nz = 24): WaterCycleMesh {
  const positions: number[] = [], indices: number[] = [], perimeter: number[] = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const z = 8 + 42 * j / nz, x = 4 + (waterCycleCoastX(z) - 4) * i / nx;
    positions.push(x, waterCycleTerrainHeight(x, z), z);
    if (i < nx && j < nz) { const k = j * (nx + 1) + i; indices.push(k, k + nx + 1, k + 1, k + 1, k + nx + 1, k + nx + 2); }
  }
  for (let i = 0; i <= nx; i++) perimeter.push(i);
  for (let j = 1; j <= nz; j++) perimeter.push(j * (nx + 1) + nx);
  for (let i = nx - 1; i >= 0; i--) perimeter.push(nz * (nx + 1) + i);
  for (let j = nz - 1; j > 0; j--) perimeter.push(j * (nx + 1));
  const bottom = positions.length / 3;
  perimeter.forEach(k => positions.push(positions[k * 3], .4, positions[k * 3 + 2]));
  const center = positions.length / 3; positions.push(32, .4, 29);
  for (let i = 0; i < perimeter.length; i++) {
    const next = (i + 1) % perimeter.length, a = perimeter[i], c = perimeter[next], u = bottom + i, v = bottom + next;
    indices.push(a, c, v, a, v, u, center, u, v);
  }
  return { positions, indices };
}
function closeSections(sections: readonly (readonly WaterCyclePoint[])[]): WaterCycleMesh {
  const positions = sections.flatMap(section => section.flatMap(p => [...p])), indices: number[] = [];
  for (let i = 0; i < sections.length - 1; i++) for (let side = 0; side < 4; side++) {
    const a = i * 4 + side, c = i * 4 + (side + 1) % 4; indices.push(a, c, c + 4, a, c + 4, a + 4);
  }
  const last = (sections.length - 1) * 4;
  indices.push(0, 2, 1, 0, 3, 2, last, last + 1, last + 2, last, last + 2, last + 3);
  return { positions, indices };
}
export function waterCycleSeaMesh(): WaterCycleMesh {
  return closeSections(Array.from({ length: 33 }, (_, i) => {
    const z = 8 + 42 * i / 32, coast = waterCycleCoastX(z);
    return [[coast, 8, z], [coast, .8, z], [97, .8, z], [97, 8, z]] as WaterCyclePoint[];
  }));
}
export function waterCycleRiverMesh(): WaterCycleMesh {
  return closeSections(Array.from({ length: 65 }, (_, i) => {
    const s = waterCycleRiverSection(23 + 44 * i / 64);
    return [[s.x, s.level, s.rightZ], [s.x, s.bed, s.rightZ], [s.x, s.bed, s.leftZ], [s.x, s.level, s.leftZ]] as WaterCyclePoint[];
  }));
}

export type WaterLegKind = 'evaporation' | 'transpiration' | 'vapor-transport' | 'condensation' | 'precipitation' | 'surface-return' | 'subsurface-return' | 'land-storage' | 'sea-storage';
export interface WaterCycleLeg { kind: WaterLegKind; start: number; end: number; points: readonly WaterCyclePoint[] }
export interface WaterCycleSample {
  id: string; index: number; source: 'sea' | 'land-water' | 'plant'; destination: 'sea' | 'land';
  branch: 'surface' | 'subsurface' | 'land-return' | 'sea-return';
  medium: 'liquid' | 'vapor' | 'cloud-water' | 'rain'; currentLeg: WaterLegKind;
  position: WaterCyclePoint; returned: boolean; condensation: number; cloudPresence: number; route: WaterCycleLeg[];
}
export interface WaterCycleLabel { id: string; text: string; at: WaterCyclePoint; width: number }
export const WATER_CYCLE_LABELS: readonly WaterCycleLabel[] = [
  { id: 'sea-evaporation', text: '蒸发', at: [94, 26, 54], width: 17 },
  { id: 'land-evaporation', text: '蒸发', at: [47, 28, 54], width: 17 },
  { id: 'transpiration', text: '植物蒸腾', at: [16, 37, 52], width: 29 },
  { id: 'vapor-symbol', text: '水汽示踪', at: [83, 40, 54], width: 29 },
  { id: 'land-vapor-symbol', text: '水汽示踪', at: [38, 59, 54], width: 29 },
  { id: 'transport', text: '水汽输送', at: [55, 59, 52], width: 31 },
  { id: 'land-cloud', text: '凝结成云', at: [28, 65, 52], width: 31 },
  { id: 'sea-cloud', text: '凝结成云', at: [82, 65, 52], width: 31 },
  { id: 'land-rain', text: '降水', at: [46, 39, 55], width: 17 },
  { id: 'sea-rain', text: '降水', at: [95, 37, 55], width: 17 },
  { id: 'surface', text: '地表径流', at: [49, 22, 57], width: 31 },
  { id: 'subsurface', text: '地下径流', at: [40, 3, 57], width: 31 },
  { id: 'land-end', text: '补给陆地', at: [35, 14, 57], width: 31 },
  { id: 'sea-end', text: '回到海洋', at: [83, 17, 57], width: 31 },
];
export const WATER_CYCLE_PLANTS = [[16, 39], [21, 43], [26, 44]] as const;
/** Cloud lobes are condensed water, separate from the symbolic vapor marks.
 * Both renderers use the same centers, sizes and deterministic presence. */
export const WATER_CYCLE_CLOUD_PARTS = {
  land: [[25, 50, 29, 7], [32, 52, 31, 8], [39, 50, 33, 6], [25, 49, 40, 7], [33, 51, 41, 8], [40, 49, 46, 6.7]],
  sea: [[75, 49, 33, 7], [82, 51, 35, 9], [89, 49, 39, 7]],
} as const;

const leg = (kind: WaterLegKind, start: number, end: number, points: readonly WaterCyclePoint[]): WaterCycleLeg => ({ kind, start, end, points });
const riverPoint = (x: number): WaterCyclePoint => [x, waterCycleRiverLevel(x) + .24, waterCycleRiverZ(x)];
const landRainPoint = (i: number): WaterCyclePoint => i < 3 ? riverPoint(24 + i * 3)
  : [33 + (i - 3) * 4, waterCycleTerrainHeight(33 + (i - 3) * 4, 50) + .25, 50.35];
function routeFor(selection: WaterCycleSelection, i: number) {
  const dx = (i % 3 - 1) * 2.8, dz = Math.floor(i / 3) * 3.2;
  const seaSource: WaterCyclePoint = [82 + dx, 8.45, 33 + dz];
  const plant = WATER_CYCLE_PLANTS[i - 3] ?? WATER_CYCLE_PLANTS[0];
  const landSource: WaterCyclePoint = i < 3 ? riverPoint(32 + i * 2)
    : [plant[0], waterCycleTerrainHeight(plant[0], plant[1]) + 4.2, plant[1]];
  const source = selection === 1 ? landSource : seaSource;
  const rain = selection === 2 ? [80 + dx, 8.45, 39 + dz] as WaterCyclePoint : landRainPoint(i);
  const cloud: WaterCyclePoint = [rain[0], 46.2 + i % 3 * .35, rain[2]];
  const vaporTop: WaterCyclePoint = selection === 0 ? [82 + dx, 46.2, 33 + dz]
    : selection === 1 ? [source[0], 44.8, source[2]] : [82 + dx, 45, 33 + dz];
  const vaporArrival: WaterCyclePoint = [cloud[0], 48.4, cloud[2]];
  if (selection === 0) {
    const returning: WaterCyclePoint[] = i < 3
      ? [rain, ...Array.from({ length: 16 }, (_, k) => riverPoint(24 + i * 3 + (67 - 24 - i * 3) * (k + 1) / 16)), [80 + dx, 8.45, waterCycleRiverZ(67) + dz * .2]]
      : [rain, [rain[0], 8.75, 50.55], [48, 8.45, 50.55], [59, 8.25, 50.55],
        [65, 8.24, waterCycleRiverZ(65)], [80 + dx, 8.45, waterCycleRiverZ(67) + dz * .2]];
    return [leg('evaporation', 0, .18, [source, vaporTop]), leg('vapor-transport', .18, .34, [vaporTop, vaporArrival]),
      leg('condensation', .34, .48, [vaporArrival, cloud]), leg('precipitation', .48, .64, [cloud, rain]),
      leg(i < 3 ? 'surface-return' : 'subsurface-return', .64, 1, returning)];
  }
  const finish: WaterCyclePoint = selection === 2 ? rain : i < 3 ? riverPoint(42 + i * 2)
    : [40 + (i - 3) * 2, waterCycleTerrainHeight(40 + (i - 3) * 2, 50) - .7, 50.55];
  return [leg(selection === 1 && i >= 3 ? 'transpiration' : 'evaporation', 0, .26, [source, vaporTop]),
    leg('vapor-transport', .26, .38, [vaporTop, vaporArrival]), leg('condensation', .38, .52, [vaporArrival, cloud]),
    leg('precipitation', .52, selection === 1 ? .82 : .86, [cloud, rain]),
    leg(selection === 1 ? 'land-storage' : 'sea-storage', selection === 1 ? .82 : .86, 1, [rain, finish])];
}
export function waterCyclePathPoint(path: readonly WaterCyclePoint[], t: number): WaterCyclePoint {
  const q = clamp(t); if (q === 0) return path[0]; if (q === 1) return path[path.length - 1];
  const lengths = path.slice(1).map((p, i) => Math.hypot(...p.map((n, k) => n - path[i][k])));
  let remaining = lengths.reduce((a, b) => a + b, 0) * q;
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      const fraction = remaining / (lengths[i] || 1); return path[i].map((n, k) => blend(n, path[i + 1][k], fraction)) as unknown as WaterCyclePoint;
    }
    remaining -= lengths[i];
  }
  return path[path.length - 1];
}

export interface WaterCycleState {
  phase: number; selection: WaterCycleSelection; cycle: string; stage: string; stageIndex: number; caption: string;
  samples: WaterCycleSample[]; controls: readonly WaterCycleStop[]; labels: WaterCycleLabel[];
  inventory: { source: number; vapor: number; cloud: number; rain: number; surface: number; subsurface: number; returned: number; total: number };
  cloud: { land: number; sea: number }; handle: WaterCyclePoint;
  units: 'finite-symbolic-tracers';
}
export function evaluateWaterCycle(input: number, selected = 0): WaterCycleState {
  const phase = clamp(input), selection = normalizeWaterCycleSelection(selected);
  const stageIndex = selection === 0 ? phase <= .18 ? 0 : phase <= .34 ? 1 : phase <= .48 ? 2 : phase <= .64 ? 3 : phase < 1 ? 4 : 5
    : phase <= .26 ? 0 : phase <= .52 ? 1 : phase <= (selection === 1 ? .82 : .86) ? 2 : 3;
  const stages = selection === 0 ? ['evaporation', 'vapor-transport', 'condensation', 'precipitation', 'runoff', 'complete']
    : ['evaporation-transpiration', 'condensation', 'precipitation', 'complete'];
  const samples = WATER_CYCLE_SAMPLE_IDS.map((id, i): WaterCycleSample => {
    const route = routeFor(selection, i), current = route.find(l => phase <= l.end) ?? route[route.length - 1];
    const fraction = ease((phase - current.start) / (current.end - current.start));
    const condensationLeg = route.find(l => l.kind === 'condensation')!, rainLeg = route.find(l => l.kind === 'precipitation')!;
    const condensation = ease((phase - condensationLeg.start) / (condensationLeg.end - condensationLeg.start));
    const cloudPresence = condensation * (1 - ease((phase - rainLeg.start) / (rainLeg.end - rainLeg.start)));
    const medium = phase === 0 ? 'liquid' : current.kind === 'evaporation' || current.kind === 'transpiration' || current.kind === 'vapor-transport' ? 'vapor'
      : current.kind === 'condensation' ? condensation < .5 ? 'vapor' : 'cloud-water' : current.kind === 'precipitation' && fraction < 1 ? 'rain' : 'liquid';
    return { id, index: i, source: selection === 1 ? i < 3 ? 'land-water' : 'plant' : 'sea', destination: selection === 1 ? 'land' : 'sea',
      branch: selection === 0 ? i < 3 ? 'surface' : 'subsurface' : selection === 1 ? 'land-return' : 'sea-return',
      medium, currentLeg: current.kind, position: waterCyclePathPoint(current.points, fraction),
      returned: phase >= 1 || selection === 2 && phase >= .86, condensation, cloudPresence, route };
  });
  const inventory = { source: 0, vapor: 0, cloud: 0, rain: 0, surface: 0, subsurface: 0, returned: 0, total: samples.length };
  samples.forEach(sample => {
    if (phase === 0) inventory.source++;
    else if (sample.returned) inventory.returned++;
    else if (sample.medium === 'vapor') inventory.vapor++;
    else if (sample.medium === 'cloud-water') inventory.cloud++;
    else if (sample.medium === 'rain') inventory.rain++;
    else if (sample.currentLeg === 'subsurface-return' || sample.currentLeg === 'land-storage' && sample.index >= 3) inventory.subsurface++;
    else inventory.surface++;
  });
  const labelIds = selection === 0 ? [['sea-evaporation', 'vapor-symbol'], ['transport'], ['land-cloud'], ['land-rain'], ['surface', 'subsurface'], ['sea-end']][stageIndex]
    : selection === 1 ? [['land-evaporation', 'transpiration', 'land-vapor-symbol'], ['land-cloud'], ['land-rain'], ['land-end']][stageIndex]
    : [['sea-evaporation', 'vapor-symbol'], ['sea-cloud'], ['sea-rain'], ['sea-end']][stageIndex];
  const amount = samples.reduce((sum, sample) => sum + sample.cloudPresence, 0) / samples.length;
  return { phase, selection, cycle: WATER_CYCLE_NAMES[selection], stage: stages[stageIndex], stageIndex,
    caption: WATER_CYCLE_STOPS[selection][stageIndex].label, samples, controls: WATER_CYCLE_STOPS[selection],
    labels: WATER_CYCLE_LABELS.filter(label => labelIds.includes(label.id)), inventory,
    cloud: { land: selection !== 2 ? amount : 0, sea: selection === 2 ? amount : 0 },
    handle: WATER_CYCLE_LAYOUT.trackStart.map((n, i) => blend(n, WATER_CYCLE_LAYOUT.trackEnd[i], phase)) as unknown as WaterCyclePoint,
    units: 'finite-symbolic-tracers' };
}
export function waterCycleDiagnostics(state: WaterCycleState) { return { ...state, reference: WATER_CYCLE_REFERENCE }; }

const n = (value: number) => Number(value.toFixed(3));
export function waterCycleSvg(phase: number, selection = 0): string {
  const state = evaluateWaterCycle(phase, selection), project = ([x, y, z]: WaterCyclePoint) => [n(50 + 4.95 * x + 1.32 * (50 - z)), n(365 - 4.25 * y + z - 8)];
  const points = (p: readonly WaterCyclePoint[]) => p.map(q => project(q).join(',')).join(' ');
  const polygon = (p: readonly WaterCyclePoint[], fill: string, stroke = '#8b8b74') => `<polygon points="${points(p)}" fill="${fill}" stroke="${stroke}" stroke-width=".55"/>`;
  const land = waterCycleLandMesh(16, 10), sea = waterCycleSeaMesh();
  let scene = '';
  const renderMesh = (mesh: WaterCycleMesh, color: string, topShade = false) => {
    const faces = Array.from({ length: mesh.indices.length / 3 }, (_, k) => {
      const p = mesh.indices.slice(k * 3, k * 3 + 3).map(i => mesh.positions.slice(i * 3, i * 3 + 3) as unknown as WaterCyclePoint);
      return { p, depth: p.reduce((sum, q) => sum + q[2] + q[0] * .04, 0) / 3, k };
    }).sort((a, b) => a.depth - b.depth);
    faces.forEach(({ p, k }) => { scene += polygon(p, topShade ? ['#bdc0a4', '#b3ba9b', '#b9bea1'][k % 3] : color); });
  };
  renderMesh(land, '#b8bda1', true); renderMesh(sea, '#a7c8cb'); renderMesh(waterCycleRiverMesh(), '#75a7af');
  WATER_CYCLE_PLANTS.forEach(([x, z]) => {
    const y = waterCycleTerrainHeight(x, z), [px, py] = project([x, y, z]);
    scene += `<path d="M${px} ${py}v-22m-10 7 10-20 10 20m-8-8 8-16 8 16" fill="#819a7c" stroke="#637d68" stroke-width="1.1"/>`;
  });
  for (const sample of state.samples) {
    for (const leg of sample.route) if (phase > leg.start && ['surface-return', 'subsurface-return', 'vapor-transport'].includes(leg.kind)) {
      const q = clamp((state.phase - leg.start) / (leg.end - leg.start));
      const prefix = Array.from({ length: 17 }, (_, i) => waterCyclePathPoint(leg.points, q * i / 16));
      scene += `<polyline points="${points(prefix)}" fill="none" stroke="${leg.kind === 'subsurface-return' ? '#8c8868' : '#71939a'}" stroke-width="1" stroke-dasharray="${leg.kind === 'vapor-transport' ? '3 6' : '4 3'}"/>`;
    }
  }
  for (const [cloud, amount] of [[0, state.cloud.land], [1, state.cloud.sea]] as const) if (amount > .001) {
    const centers = cloud === 0 ? WATER_CYCLE_CLOUD_PARTS.land : WATER_CYCLE_CLOUD_PARTS.sea;
    centers.forEach(([x, y, z, r]) => {
      const [px, py] = project([x, y, z]), size = .15 + .85 * amount;
      scene += `<ellipse cx="${px}" cy="${py}" rx="${n(r * 4.95 * size)}" ry="${n(r * 2.8 * size)}" fill="#f3efe2" stroke="#b4b9a8" stroke-width=".8"/>`;
    });
  }
  for (const sample of state.samples) {
    const [x, y] = project(sample.position), color = sample.index === 0 ? '#b58b56' : sample.index === 3 ? '#9a735a' : '#477f8b';
    const symbol = sample.medium === 'vapor' ? `<path d="M${x} ${y - 5}l5 5-5 5-5-5Z" fill="none" stroke="${color}" stroke-width="1.7"/>`
      : sample.medium === 'rain' ? `<path d="M${x} ${y - 6}q-5 6-3 9 3 3 6 0 2-3-3-9Z" fill="${color}" stroke="#f5edd7" stroke-width=".7"/>`
      : `<circle cx="${x}" cy="${y}" r="4.5" fill="${color}" stroke="#f5edd7" stroke-width="1"/>`;
    scene += `<g data-water-sample="${sample.id}" data-medium="${sample.medium}" data-position='${JSON.stringify(sample.position)}'>${symbol}</g>`;
  }
  state.labels.forEach(label => {
    const [x, y] = project(label.at), width = label.width * 4.9;
    scene += `<rect x="${n(x - width / 2)}" y="${n(y - 23)}" width="${n(width)}" height="46" rx="2" fill="#f7f1e3"/><text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="32">${label.text}</text>`;
  });
  const handle = project(state.handle), diagnostics = JSON.stringify(waterCycleDiagnostics(state)).replace(/&/g, '&amp;').replace(/'/g, '&#39;');
  const start = project(WATER_CYCLE_LAYOUT.trackStart), end = project(WATER_CYCLE_LAYOUT.trackEnd);
  return `<svg class="flat-model-svg flat-explanation-svg" viewBox="0 0 660 520" role="img" aria-label="${state.cycle}：${state.caption}；六个符号只作示踪" data-water-cycle-phase="${state.phase}" data-water-cycle-selection="${state.selection}" data-water-cycle-stage="${state.stage}" data-water-cycle-state='${diagnostics}'>
  <g font-family="FieldSerif,SimSun,serif" fill="#303a40" stroke-linejoin="round" stroke-linecap="round">${scene}
  <path d="M${start.join(' ')}L${end.join(' ')}" stroke="#aa9c7d" stroke-width="2"/>
  <ellipse data-water-cycle-role="phase-handle" cx="${handle[0]}" cy="${handle[1]}" rx="9" ry="7" fill="#e9d9b7" stroke="#7d806b"/>
  <text x="330" y="507" text-anchor="middle" font-size="32">示踪数量不表示水量</text>
  </g></svg>`;
}

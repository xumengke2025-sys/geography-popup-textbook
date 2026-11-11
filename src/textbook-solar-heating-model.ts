/** PEP Geography I, printed p.9 / PDF p.14 / fig.1.14, visually checked.
 * The drawing and adjacent text identify rooftop heat collection, storage,
 * a pump, pipes and room heating. These are thermal collectors, not the
 * photovoltaic array in the separate fig.1.15 below it.
 * The pipe network is a teaching cutaway, not an installation drawing. */
export type SolarPoint = [number, number, number];
export const SOLAR_HEATING_REFERENCE = {
  printedPage: 9, pdfPage: 14, figure: '1.14', source: 'textbook/page-014.webp',
  title: '家庭太阳能供热系统', phaseMeansElapsedTime: false,
  collectorType: 'solar-thermal-not-photovoltaic',
  equipment: ['屋顶集热器', '储存池', '水泵', '管道', '房间散热器'],
  schematicConnections: true, sharedStorage: true, separateHeatExchangerImplied: false,
  representsAllDomesticWaterUses: false, measuredTemperature: false,
  measuredFlowRate: false, measuredEfficiency: false, predictedHeatingPerformance: false,
  sampleCountsAreWaterVolumes: false, radiationMarksBecomeWater: false,
} as const;
export const SOLAR_HEATING_STOPS = [
  { label: '短波到达', phase: .22, selection: 0 },
  { label: '吸收受热', phase: .44, selection: 1 },
  { label: '水路循环', phase: .72, selection: 2 },
  { label: '室内供热', phase: 1, selection: 3 },
] as const;
export const SOLAR_HEATING_LAYOUT = {
  bounds: { min: [-3, -17, 12] as SolarPoint, max: [107, 91, 72] as SolarPoint },
  trackStart: [12, -11, 66] as SolarPoint, trackEnd: [92, -11, 66] as SolarPoint,
  sun: [10, 70, 39] as SolarPoint, sunRadius: 4,
  tank: { center: [33, 12.5, 48.2] as SolarPoint, radius: 4.5, height: 13 },
  pump: { center: [43, 18, 52] as SolarPoint, radius: 2.45, depth: 2.6 },
} as const;
export const SOLAR_HEATING_ROOFS: readonly (readonly SolarPoint[])[] = [
  [[21, 51, 17], [60, 68, 17], [60, 68, 50], [21, 51, 50]],
  [[60, 68, 17], [99, 51, 17], [99, 51, 50], [60, 68, 50]],
];
export const SOLAR_HEATING_COLLECTOR: readonly SolarPoint[] = [
  [27.3, 54.3, 25], [52, 65.1, 25], [52, 65.1, 47.2], [27.3, 54.3, 47.2],
];
export interface SolarBoxPart {
  id: string; center: SolarPoint; size: SolarPoint; color: string;
  selection?: number; warmth?: 'upper' | 'lower';
}
export const SOLAR_HEATING_BOXES: readonly SolarBoxPart[] = [
  { id: 'foundation', center: [60, 2, 33], size: [78, 4, 34], color: '#b8b19d' },
  { id: 'back-wall', center: [60, 28, 18.7], size: [74, 47, 1.4], color: '#e6e3d3' },
  { id: 'left-wall', center: [23, 28, 34], size: [1.8, 47, 30], color: '#d5d6c3' },
  { id: 'right-wall', center: [96, 28, 34], size: [1.8, 47, 30], color: '#d5d6c3' },
  { id: 'middle-wall', center: [59, 28, 33], size: [1.3, 47, 28], color: '#dbdcc9' },
  { id: 'upper-floor', center: [60, 26, 34], size: [74, 1.8, 30], color: '#d4c8ae' },
  { id: 'attic-floor', center: [60, 51, 33.5], size: [75, 1, 31], color: '#d4c8ae' },
  { id: 'upper-room-back', center: [77, 38.5, 19.6], size: [32, 22.5, .35], color: '#e7e4d5', warmth: 'upper', selection: 3 },
  { id: 'lower-room-back', center: [77, 14.5, 19.6], size: [32, 20, .35], color: '#e7e4d5', warmth: 'lower', selection: 3 },
  { id: 'upper-radiator', center: [82, 36.5, 50.15], size: [12, 8.7, 1.2], color: '#bfc5b6', warmth: 'upper', selection: 3 },
  { id: 'lower-radiator', center: [82, 14, 50.15], size: [12, 8.7, 1.2], color: '#bfc5b6', warmth: 'lower', selection: 3 },
];
export const SOLAR_HEATING_TARGETS = [
  { selection: 0, id: 'sun', label: '太阳短波', at: [10, 70, 42.7] as SolarPoint },
  { selection: 1, id: 'collector', label: '集热受热', at: [41, 60.9, 44] as SolarPoint },
  { selection: 2, id: 'pump', label: '水路循环', at: [43, 18, 53.5] as SolarPoint },
  { selection: 3, id: 'radiator', label: '房间供暖', at: [82, 36.5, 52.5] as SolarPoint },
] as const;
export const SOLAR_HEATING_LABELS = [
  { selection: 0, text: '太阳短波', at: [23, 84, 59] as SolarPoint, width: 40, height: 11.6 },
  { selection: 1, text: '集热受热', at: [59, 82, 59] as SolarPoint, width: 40, height: 11.6 },
  { selection: 2, text: '水路循环', at: [28, -2, 60] as SolarPoint, width: 40, height: 11.6 },
  { selection: 3, text: '房间供暖', at: [82, 61, 60] as SolarPoint, width: 40, height: 11.6 },
] as const;
export type SolarWaterCircuit = 'collection' | 'upper-room' | 'lower-room';
export interface SolarWaterPath { id: SolarWaterCircuit; points: readonly SolarPoint[]; supplyEnd: number }
/** Shared tank/pump junctions belong to a single schematic water network.
 * The two room branches are not separate fluids, and no heat exchanger is
 * introduced. The duplicated end point closes each possible return route. */
export const SOLAR_HEATING_WATER_PATHS: readonly SolarWaterPath[] = [
  { id: 'collection', supplyEnd: 12, points: [
    [33, 8, 52], [23, 8, 52], [23, 48, 52], [28, 54.6, 46],
    [31, 55.9, 46], [31, 55.9, 27], [36, 58.1, 27], [36, 58.1, 46],
    [41, 60.3, 46], [41, 60.3, 27], [46, 62.5, 27], [46, 62.5, 46],
    [51, 64.7, 46], [53, 65.5, 48], [53, 18, 52], [33, 18, 52], [33, 8, 52],
  ] },
  { id: 'upper-room', supplyEnd: 13, points: [
    [33, 18, 52], [43, 18, 52], [68, 18, 52], [68, 40, 52], [77, 40, 52],
    [77, 33, 52], [79.5, 33, 52], [79.5, 40, 52], [82, 40, 52], [82, 33, 52],
    [84.5, 33, 52], [84.5, 40, 52], [87, 40, 52], [87, 33, 52],
    [91, 33, 52], [91, 7, 52], [33, 7, 52], [33, 18, 52],
  ] },
  { id: 'lower-room', supplyEnd: 13, points: [
    [33, 18, 52], [43, 18, 52], [68, 18, 52], [77, 18, 52],
    [77, 10.5, 52], [79.5, 10.5, 52], [79.5, 18, 52], [82, 18, 52], [82, 10.5, 52],
    [84.5, 10.5, 52], [84.5, 18, 52], [87, 18, 52], [87, 10.5, 52],
    [91, 10.5, 52], [91, 7, 52], [33, 7, 52], [33, 18, 52],
  ] },
];
export const SOLAR_HEATING_RAYS = [
  { id: 'shortwave-01', source: [6, 73, 44] as SolarPoint, destination: [32, 56.5, 44] as SolarPoint },
  { id: 'shortwave-02', source: [9, 76, 37] as SolarPoint, destination: [40, 60, 37] as SolarPoint },
  { id: 'shortwave-03', source: [12, 79, 29] as SolarPoint, destination: [48, 63.5, 29] as SolarPoint },
] as const;

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const smooth = (a: number, b: number, value: number) => { const q = clamp((value - a) / (b - a)); return q * q * (3 - 2 * q); };
const lerp = (a: SolarPoint, b: SolarPoint, t: number): SolarPoint => a.map((n, i) => n + (b[i] - n) * t) as SolarPoint;
export function solarHeatingPathPoint(path: readonly SolarPoint[], input: number): SolarPoint {
  const phase = clamp(input); if (phase === 0) return [...path[0]]; if (phase === 1) return [...path.at(-1)!];
  const lengths = path.slice(1).map((point, i) => Math.hypot(...point.map((n, j) => n - path[i][j])));
  let remaining = phase * lengths.reduce((sum, n) => sum + n, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] || i === lengths.length - 1) return lerp(path[i], path[i + 1], lengths[i] ? remaining / lengths[i] : 0);
    remaining -= lengths[i];
  }
  return [...path.at(-1)!];
}
export const SOLAR_HEATING_WATER_MARKS = SOLAR_HEATING_WATER_PATHS.flatMap((path, circuitIndex) =>
  [0, 1].map(index => ({ id: `water-${circuitIndex * 2 + index + 1}`, index: circuitIndex * 2 + index,
    circuit: path.id, route: path.points.map((point, pointIndex) => pointIndex === 0 || pointIndex === path.points.length - 1
      ? [point[0] + index * 1.15, point[1], 51.7 + (circuitIndex - 1) * .4] as SolarPoint : [...point] as SolarPoint),
    start: path.id === 'collection' ? .44 + index * .012 : .75 + index * .012,
    end: path.id === 'collection' ? .72 + index * .012 : .985 + index * .012,
  })));

export function evaluateSolarHeating(input: number) {
  const phase = clamp(input), selection = phase <= .22 ? 0 : phase <= .44 ? 1 : phase <= .75 ? 2 : 3;
  const stage = ['shortwave', 'absorption', 'circulation', 'room-heating'][selection];
  const rays = SOLAR_HEATING_RAYS.map((ray, index) => {
    const progress = smooth(.015 + index * .012, .19 + index * .012, phase);
    return { ...ray, medium: 'radiation' as const, progress, point: lerp(ray.source, ray.destination, progress), absorbed: progress === 1 };
  });
  const collectorWarmth = smooth(.22, .44, phase);
  const water = SOLAR_HEATING_WATER_MARKS.map(mark => {
    const progress = smooth(mark.start, mark.end, phase);
    const warmth = mark.circuit === 'collection' ? smooth(.26, .67, progress) * collectorWarmth
      : phase <= mark.start ? smooth(.65, .735, phase) : 1 - .35 * smooth(.68, 1, progress);
    return { id: mark.id, index: mark.index, medium: 'water' as const, circuit: mark.circuit,
      progress, point: solarHeatingPathPoint(mark.route, progress), warmth,
      started: phase > mark.start, returned: progress === 1, route: mark.route };
  });
  const collection = water.filter(mark => mark.circuit === 'collection');
  const storageWarmth = collection.reduce((sum, mark) => sum + smooth(.88, 1, mark.progress), 0) / collection.length;
  const upperWater = water.filter(mark => mark.circuit === 'upper-room');
  const lowerWater = water.filter(mark => mark.circuit === 'lower-room');
  const roomWarmth = {
    upper: upperWater.reduce((sum, mark) => sum + smooth(.59, 1, mark.progress), 0) / upperWater.length,
    lower: lowerWater.reduce((sum, mark) => sum + smooth(.59, 1, mark.progress), 0) / lowerWater.length,
  };
  return { phase, selection, stage, stageIndex: selection, activeStop: selection,
    caption: SOLAR_HEATING_STOPS[selection].label, phaseMeaning: 'teaching-sequence' as const,
    phaseMeansElapsedTime: false, rays, water, collectorWarmth, storageWarmth, roomWarmth,
    pumpTurning: smooth(.745, .83, phase), closedWaterPaths: true, sharedStorage: true,
    radiationIds: rays.map(ray => ray.id), waterIds: water.map(mark => mark.id),
    retained: { shortwaveArrived: rays.every(ray => ray.absorbed), collectorHeated: collectorWarmth === 1,
      waterReturned: water.filter(mark => mark.returned).length, roomsHeated: roomWarmth.upper === 1 && roomWarmth.lower === 1 },
    targets: SOLAR_HEATING_TARGETS, labels: [SOLAR_HEATING_LABELS[selection]],
    handle: lerp(SOLAR_HEATING_LAYOUT.trackStart, SOLAR_HEATING_LAYOUT.trackEnd, phase),
    units: 'qualitative-teaching-state' as const,
  };
}
export type SolarHeatingState = ReturnType<typeof evaluateSolarHeating>;

export interface SolarMeshData { positions: number[]; indices: number[] }
export function solarHeatingSlab(points: readonly SolarPoint[], thickness = .7): SolarMeshData {
  const positions = [...points.flat(), ...points.flatMap(([x, y, z]) => [x, y - thickness, z])];
  const indices = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; indices.push(i, j, j + 4, i, j + 4, i + 4); }
  return { positions, indices };
}
export function solarHeatingBoxMesh(part: Pick<SolarBoxPart, 'center' | 'size'>): SolarMeshData {
  const [x, y, z] = part.center, [w, h, d] = part.size;
  const positions = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]
    .flatMap(([a, b, c]) => [x + a * w / 2, y + b * h / 2, z + c * d / 2]);
  return { positions, indices: [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 1, 2, 6, 1, 6, 5, 0, 4, 7, 0, 7, 3] };
}
export function solarHeatingProject([x, y, z]: SolarPoint): [number, number] {
  return [37 + 5.7 * x + .55 * (z - 42), 417 - 4.15 * y + .65 * (z - 42)];
}
const n = (value: number) => Number(value.toFixed(3));
const color = (from: string, to: string, value: number) => {
  const a = from.match(/[\da-f]{2}/gi)!.map(v => parseInt(v, 16));
  const b = to.match(/[\da-f]{2}/gi)!.map(v => parseInt(v, 16));
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * value).toString(16).padStart(2, '0')).join('');
};
export function solarHeatingSvg(input: number): string {
  const state = evaluateSolarHeating(input), project = (point: SolarPoint) => solarHeatingProject(point).map(n);
  const selectable = (selection: number, content: string) => `<g data-model-selection="${selection}" role="button" tabindex="0" aria-label="观察${SOLAR_HEATING_STOPS[selection].label}" style="cursor:pointer">${content}</g>`;
  const line = (points: readonly SolarPoint[]) => points.map(point => project(point).join(',')).join(' ');
  const polygon = (points: readonly SolarPoint[], fill: string) => `<polygon points="${line(points)}" fill="${fill}" stroke="#737a68" stroke-width=".8"/>`;
  const drawMesh = (mesh: SolarMeshData, fill: string) => Array.from({ length: mesh.indices.length / 3 }, (_, index) => {
    const points = mesh.indices.slice(index * 3, index * 3 + 3).map(i => mesh.positions.slice(i * 3, i * 3 + 3) as SolarPoint);
    return { points, depth: points.reduce((sum, point) => sum + point[2], 0) / 3 };
  }).sort((a, b) => a.depth - b.depth).map(face => polygon(face.points, fill)).join('');
  let scene = SOLAR_HEATING_BOXES.map(part => {
    const content = drawMesh(solarHeatingBoxMesh(part), part.warmth
      ? color(part.color, part.id.includes('radiator') ? '#b88862' : '#e1ceb0', state.roomWarmth[part.warmth]) : part.color);
    return part.selection === undefined ? content : selectable(part.selection, content);
  }).join('');
  scene += SOLAR_HEATING_ROOFS.map(roof => drawMesh(solarHeatingSlab(roof, 1), '#b8b9a5')).join('');
  scene += selectable(1, drawMesh(solarHeatingSlab(SOLAR_HEATING_COLLECTOR, .7), color('#75928d', '#b49567', state.collectorWarmth)));
  for (const path of SOLAR_HEATING_WATER_PATHS) {
    const split = path.id === 'collection' ? 12 : path.supplyEnd;
    scene += `<polyline points="${line(path.points)}" fill="none" stroke="#f0eadb" stroke-width="5.6"/>`;
    scene += `<polyline points="${line(path.points.slice(0, split + 1))}" fill="none" stroke="${path.id === 'collection' ? '#7c9898' : '#b1876b'}" stroke-width="2.6"/>`;
    scene += `<polyline points="${line(path.points.slice(split))}" fill="none" stroke="${path.id === 'collection' ? '#b1876b' : '#7c9898'}" stroke-width="2.6"/>`;
  }
  const tank = SOLAR_HEATING_LAYOUT.tank, [tx, ty] = project(tank.center);
  scene += selectable(2, `<g data-solar-equipment="storage"><rect x="${n(tx - 23)}" y="${n(ty - 27)}" width="46" height="54" rx="9" fill="${color('#a9b5aa', '#b88d69', state.storageWarmth)}" stroke="#6e7968" stroke-width="1.4"/><ellipse cx="${tx}" cy="${n(ty - 23)}" rx="23" ry="7" fill="#ded8c0" stroke="#6e7968" stroke-width="1"/></g>`);
  const [px, py] = project(SOLAR_HEATING_LAYOUT.pump.center);
  scene += selectable(2, `<circle data-solar-equipment="pump" cx="${px}" cy="${py}" r="12" fill="#a2ae9a" stroke="#687760" stroke-width="1.4"/><path d="M-7 0h14M0-7v14" transform="translate(${px} ${py}) rotate(${n(state.pumpTurning * 125)})" stroke="#ece4cf" stroke-width="2.3"/>`);
  const [sx, sy] = project(SOLAR_HEATING_LAYOUT.sun);
  scene += selectable(0, `<circle data-solar-equipment="sun" cx="${sx}" cy="${sy}" r="20" fill="#d9c17d" stroke="#ad965d" stroke-width="1.2"/>`);
  for (const ray of state.rays) {
    const [x, y] = project(ray.point), path = line([ray.source, ray.point]);
    scene += `<polyline points="${path}" fill="none" stroke="#ba9b61" stroke-width="1.3"/>`;
    scene += `<path data-solar-ray="${ray.id}" data-medium="radiation" data-absorbed="${ray.absorbed}" d="M${x} ${y - 4}l4 4-4 4-4-4Z" fill="#ba9b61" opacity="${ray.absorbed ? .35 : 1}"/>`;
  }
  for (const mark of state.water) {
    const [x, y] = project(mark.point);
    scene += `<circle data-solar-water="${mark.id}" data-medium="water" data-returned="${mark.returned}" data-progress="${mark.progress}" cx="${x}" cy="${y}" r="4.8" fill="${color('#527f95', '#bd7954', mark.warmth)}" stroke="#f4eddc" stroke-width="1.2"/>`;
  }
  for (const label of state.labels) {
    const [x, y] = project(label.at), width = label.width * 5.25;
    scene += selectable(label.selection, `<rect x="${n(x - width / 2)}" y="${n(y - 27)}" width="${width}" height="54" rx="2" fill="#f7f1e3"/><text x="${x}" y="${y}" font-size="36" text-anchor="middle" dominant-baseline="central">${label.text}</text>`);
  }
  const handle = project(state.handle), start = project(SOLAR_HEATING_LAYOUT.trackStart), end = project(SOLAR_HEATING_LAYOUT.trackEnd);
  const diagnostics = JSON.stringify({ ...state, reference: SOLAR_HEATING_REFERENCE }).replace(/&/g, '&amp;').replace(/'/g, '&#39;');
  return `<svg class="flat-model-svg flat-explanation-svg" viewBox="0 0 660 520" role="group" aria-label="家庭太阳能供热：${state.caption}；光与水分别示踪" data-solar-heating-phase="${state.phase}" data-solar-heating-stage="${state.stage}" data-solar-heating-state='${diagnostics}'>
  <g font-family="FieldSerif,SimSun,serif" fill="#303a40" stroke-linecap="round" stroke-linejoin="round">${scene}
  <path d="M${start.join(' ')}L${end.join(' ')}" stroke="#a99b7d" stroke-width="2"/>
  <ellipse data-solar-role="phase-handle" cx="${handle[0]}" cy="${handle[1]}" rx="10" ry="8" fill="#dfc795" stroke="#7e8069"/>
  </g></svg>`;
}

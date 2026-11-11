/** Fig.4.22, printed p.77 / PDF p.82. The diagram remains on the book page.
 * This supplemental relief is a hand-constrained teaching approximation,
 * not a surveyed DEM and not a reconstruction of every small contour. */
export const SLOPE_REFERENCE = Object.freeze({
  printedPage: 77, pdfPage: 82, figure: '4.22',
  title: '黄土高原某地等高线地形示意', source: 'textbook/page-082.webp',
  checkedElevationsM: { jia: 879.0, yi: 885.4 }, checkedContourLabelsM: [800, 850],
  checkedScaleBarM: 75, sourceContourIntervalM: null,
  pointPositions: 'approximately-hand-digitized-from-page',
  mapFramePixelsApprox: { left: 190, top: 422, right: 849, bottom: 925 },
  constraints: ['left-lower-yi', 'right-upper-jia', 'central-longitudinal-gully', 'right-tributary-joins-main-gully'],
  interpolation: 'inverse-distance-to-traced-polylines-and-spot-heights',
  auxiliaryContourIntervalM: 10, auxiliaryContoursAreOriginalTraces: false,
  unknownGullyFloorAndBoundaryElevations: 'teaching-interpolation-only',
  surveyedDEM: false, exactMapScale: false, verticalExaggeration: true,
  phaseMeaning: 'plane-to-relief-observation-progress', landformEvolutionSimulated: false,
  originalMapPreserved: true, slopeAngleFigure423Included: false,
});
export const SLOPE_STOPS = [
  { label: '平面', phase: 0, selection: 0 },
  { label: '抬升', phase: .65, selection: 1 },
  { label: '高差', phase: 1, selection: 2 },
] as const;
export type SlopePoint = [number, number, number];
export type SlopePlanPoint = [number, number];
export interface SlopeMeshData { positions: number[]; indices: number[]; topVertexCount: number; }
export interface SlopeConstraint {
  id: string; kind: 'read-contour' | 'interpolated-gully' | 'interpolated-boundary';
  points: [number, number, number][]; // x, plan z, elevation in metres
}
export const SLOPE_LAYOUT = {
  width: 100, depth: 76.33, displayDatumM: 770, displayBaseY: 2, heightScale: .235,
  track: { start: [14, 1, 91] as SlopePoint, end: [86, 1, 91] as SlopePoint },
  labels: [[14, -8, 94], [50, -8, 94], [86, -8, 94]] as SlopePoint[],
  comparison: { x: 117, z: 39, jiaY: 10, yiY: 26, rulerX: 123, label: [137, 18, 39] as SlopePoint },
} as const;
export const SLOPE_SPOTS = [
  { id: 'jia', name: '甲', elevationM: 879.0, x: 87.9, z: 17.0, labelWidth: 44 },
  { id: 'yi', name: '乙', elevationM: 885.4, x: 18.1, z: 41.45, labelWidth: 44 },
] as const;
const contour = (id: string, elevation: number, points: SlopePlanPoint[]): SlopeConstraint =>
  ({ id, kind: 'read-contour', points: points.map(([x, z]) => [x, z, elevation]) });
/** Only the 800/850 annotations are read values. The visible major bends are
 * traced approximately; fine serrations, cliffs and small tributaries are not
 * claimed as recovered geometry. None of Fig.4.23 is mixed into these data. */
export const SLOPE_CONSTRAINTS: readonly SlopeConstraint[] = [
  contour('left-lower-850', 850, [[0, 29], [9, 24], [15, 28], [22, 27], [27, 31], [30, 41], [28, 49], [24, 53], [17, 54], [9, 53], [3, 50], [0, 47]]),
  contour('right-upper-850', 850, [[67, 0], [62, 3], [59, 11], [58.5, 19], [60, 26], [63, 30.3], [70, 32], [82, 32.3], [100, 32.5]]),
  contour('main-left-bank-800', 800, [[36, 0], [35.5, 10], [36.5, 20], [39, 30], [43, 41], [44.8, 48], [46, 57], [48.5, 63], [48, 69], [51.8, 76.33]]),
  contour('main-right-bank-and-tributary-800', 800, [[48, 0], [46, 10], [46.5, 20], [49, 29], [53, 37], [54, 43], [57, 49], [60, 52], [66, 53], [73, 49], [81, 45], [89, 42], [93, 43], [90, 47], [82, 51], [75, 56], [68, 61], [62, 63], [61, 68], [63, 76.33]]),
  { id: 'main-gully', kind: 'interpolated-gully', points: [[42, 0, 793], [40, 10, 791], [40.8, 20, 789], [43.5, 30, 787], [48, 43, 785], [50.6, 54, 783], [54, 65, 781], [57, 76.33, 778]] },
  { id: 'right-tributary', kind: 'interpolated-gully', points: [[91, 43, 799], [82, 48, 794], [74, 53, 790], [65, 59, 785], [54, 65, 781]] },
  { id: 'north-edge', kind: 'interpolated-boundary', points: [[0, 0, 898], [18, 0, 891], [28, 0, 875], [36, 0, 800], [42, 0, 793], [48, 0, 800], [67, 0, 850], [83, 0, 880], [100, 0, 893]] },
  { id: 'west-edge', kind: 'interpolated-boundary', points: [[0, 0, 898], [0, 15, 878], [0, 29, 850], [0, 47, 850], [0, 61, 837], [0, 76.33, 827]] },
  { id: 'east-edge', kind: 'interpolated-boundary', points: [[100, 0, 893], [100, 17, 882], [100, 32.5, 850], [100, 45, 841], [100, 60, 837], [100, 76.33, 824]] },
  { id: 'south-edge', kind: 'interpolated-boundary', points: [[0, 76.33, 827], [25, 76.33, 823], [40, 76.33, 815], [51.8, 76.33, 800], [57, 76.33, 778], [63, 76.33, 800], [80, 76.33, 817], [100, 76.33, 824]] },
];
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
export const slopeDisplayY = (elevationM: number, phase: number) =>
  SLOPE_LAYOUT.displayBaseY + (elevationM - SLOPE_LAYOUT.displayDatumM) * SLOPE_LAYOUT.heightScale * clamp(phase);
function nearestOnConstraint(x: number, z: number, constraint: SlopeConstraint): { distance: number; elevation: number } {
  let distance = Infinity, elevation = 0;
  for (let i = 1; i < constraint.points.length; i++) {
    const a = constraint.points[i - 1], q = constraint.points[i], dx = q[0] - a[0], dz = q[1] - a[1];
    const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz));
    const d = Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
    if (d < distance) { distance = d; elevation = a[2] + (q[2] - a[2]) * t; }
  }
  return { distance, elevation };
}
/** Static interpolation, with exact spot values. It contains no time, erosion,
 * Gaussian hills, random values or independent renderer-specific heights. */
export function slopeElevationAt(x: number, z: number): number {
  const px = Math.max(0, Math.min(100, Number.isFinite(x) ? x : 0));
  const pz = Math.max(0, Math.min(SLOPE_LAYOUT.depth, Number.isFinite(z) ? z : 0));
  let numerator = 0, denominator = 0;
  for (const spot of SLOPE_SPOTS) {
    const d = Math.hypot(px - spot.x, pz - spot.z);
    if (d < 1e-9) return spot.elevationM;
    const weight = 1.55 / Math.max(.16, d) ** 2.5;
    numerator += weight * spot.elevationM; denominator += weight;
  }
  for (const line of SLOPE_CONSTRAINTS) {
    const nearest = nearestOnConstraint(px, pz, line);
    if (nearest.distance < 1e-9) return nearest.elevation;
    const weight = 1 / Math.max(.16, nearest.distance) ** 2.5;
    numerator += weight * nearest.elevation; denominator += weight;
  }
  return numerator / denominator;
}
const axes = (end: number, divisions: number, extra: number[]) => [...new Set([
  ...Array.from({ length: divisions + 1 }, (_, i) => end * i / divisions), ...extra,
])].sort((a, z) => a - z);
export const SLOPE_X_AXIS = axes(100, 50, SLOPE_SPOTS.map(spot => spot.x));
export const SLOPE_Z_AXIS = axes(SLOPE_LAYOUT.depth, 40, SLOPE_SPOTS.map(spot => spot.z));
export const SLOPE_GRID = SLOPE_Z_AXIS.flatMap(z => SLOPE_X_AXIS.map(x => ({ x, z, elevationM: slopeElevationAt(x, z) })));
const nx = SLOPE_X_AXIS.length, nz = SLOPE_Z_AXIS.length, count = SLOPE_GRID.length;
/** Elevation on the actual piecewise-linear top mesh, also useful for probes
 * and for checking that a derived contour remains attached to that mesh. */
export function slopeTerrainElevationAt(x: number, z: number): number {
  const px = Math.max(0, Math.min(100, x)), pz = Math.max(0, Math.min(SLOPE_LAYOUT.depth, z));
  let i = 0, j = 0;
  while (i < nx - 2 && SLOPE_X_AXIS[i + 1] < px) i++;
  while (j < nz - 2 && SLOPE_Z_AXIS[j + 1] < pz) j++;
  const u = (px - SLOPE_X_AXIS[i]) / (SLOPE_X_AXIS[i + 1] - SLOPE_X_AXIS[i]);
  const v = (pz - SLOPE_Z_AXIS[j]) / (SLOPE_Z_AXIS[j + 1] - SLOPE_Z_AXIS[j]);
  const k = j * nx + i, a = SLOPE_GRID[k].elevationM, b = SLOPE_GRID[k + 1].elevationM;
  const c = SLOPE_GRID[k + nx].elevationM, d = SLOPE_GRID[k + nx + 1].elevationM;
  return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (b - d) * (1 - v) + (c - d) * (1 - u);
}
export const SLOPE_TOP_INDICES: number[] = [];
for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
  const k = j * nx + i; SLOPE_TOP_INDICES.push(k, k + nx, k + 1, k + 1, k + nx, k + nx + 1);
}
export const SLOPE_BOUNDARY_INDICES = [
  ...Array.from({ length: nx }, (_, i) => i),
  ...Array.from({ length: nz - 1 }, (_, i) => (i + 1) * nx + nx - 1),
  ...Array.from({ length: nx - 1 }, (_, i) => (nz - 1) * nx + nx - 2 - i),
  ...Array.from({ length: nz - 2 }, (_, i) => (nz - 2 - i) * nx),
];
/** Shared indexed vertices make top, bottom and all cut faces a closed solid. */
export function slopeReliefMesh(phase: number): SlopeMeshData {
  const positions = SLOPE_GRID.flatMap(({ x, z, elevationM }) => [x, slopeDisplayY(elevationM, phase), z]);
  positions.push(...SLOPE_GRID.flatMap(({ x, z }) => [x, 0, z]));
  const indices = [...SLOPE_TOP_INDICES];
  for (let i = 0; i < SLOPE_TOP_INDICES.length; i += 3) indices.push(count + SLOPE_TOP_INDICES[i], count + SLOPE_TOP_INDICES[i + 2], count + SLOPE_TOP_INDICES[i + 1]);
  for (let i = 0; i < SLOPE_BOUNDARY_INDICES.length; i++) {
    const a = SLOPE_BOUNDARY_INDICES[i], q = SLOPE_BOUNDARY_INDICES[(i + 1) % SLOPE_BOUNDARY_INDICES.length];
    indices.push(a, q, a + count, q, q + count, a + count);
  }
  return { positions, indices, topVertexCount: count };
}
export interface SlopeContour { elevationM: number; sourceLabelRead: boolean; paths: SlopePoint[][]; }
/** Marching triangles intersects the very triangles used by the solid. Each
 * auxiliary line therefore lies on the same terrain, including after seek. */
function contoursAt(elevationM: number): SlopePoint[][] {
  const segments: SlopePoint[][] = [];
  for (let i = 0; i < SLOPE_TOP_INDICES.length; i += 3) {
    const vertices = SLOPE_TOP_INDICES.slice(i, i + 3).map(index => SLOPE_GRID[index]), points: SlopePoint[] = [];
    for (let edge = 0; edge < 3; edge++) {
      const a = vertices[edge], q = vertices[(edge + 1) % 3];
      if ((a.elevationM >= elevationM) === (q.elevationM >= elevationM)) continue;
      const t = (elevationM - a.elevationM) / (q.elevationM - a.elevationM);
      points.push([a.x + (q.x - a.x) * t, elevationM, a.z + (q.z - a.z) * t]);
    }
    if (points.length === 2 && Math.hypot(points[0][0] - points[1][0], points[0][2] - points[1][2]) > 1e-8) segments.push(points);
  }
  const key = (point: SlopePoint) => `${point[0].toFixed(6)}:${point[2].toFixed(6)}`;
  const adjacency = new Map<string, number[]>();
  segments.forEach((segment, index) => segment.forEach(point => { const k = key(point); const list = adjacency.get(k) ?? []; list.push(index); adjacency.set(k, list); }));
  const used = new Set<number>(), paths: SlopePoint[][] = [];
  const walk = (index: number, start: SlopePoint) => {
    const path = [start]; let currentIndex = index, current = start;
    while (!used.has(currentIndex)) {
      used.add(currentIndex); const segment = segments[currentIndex];
      const next = key(segment[0]) === key(current) ? segment[1] : segment[0]; path.push(next);
      const following = adjacency.get(key(next))?.find(candidate => !used.has(candidate));
      if (following === undefined) break;
      current = next; currentIndex = following;
    }
    if (path.length > 1) paths.push(path);
  };
  for (const [node, incident] of adjacency) if (incident.length === 1 && !used.has(incident[0])) walk(incident[0], segments[incident[0]].find(point => key(point) === node)!);
  segments.forEach((segment, index) => { if (!used.has(index)) walk(index, segment[0]); });
  return paths;
}
export const SLOPE_CONTOURS: readonly SlopeContour[] = Array.from({ length: 10 }, (_, i) => 800 + i * 10)
  .map(elevationM => ({ elevationM, sourceLabelRead: elevationM === 800 || elevationM === 850, paths: contoursAt(elevationM) }));
export function evaluateSlopeRelief(input: number) {
  const phase = clamp(input), stageIndex = phase < .3 ? 0 : phase < .85 ? 1 : 2;
  const stage = (['plane', 'raised-relief', 'compare-spots'] as const)[stageIndex];
  const points = SLOPE_SPOTS.map(spot => ({ ...spot, position: [spot.x, slopeDisplayY(spot.elevationM, phase), spot.z] as SlopePoint }));
  return { phase, stage, stageIndex, selection: stageIndex, activeStop: stageIndex,
    caption: stageIndex === 0 ? '看等高线的疏密，辨认中央沟谷。' : stageIndex === 1 ? '同一地形逐渐立起，等高线仍贴着地表。' : '乙比甲高 6.4 米；高差不取决于图上远近。',
    phaseMeaning: 'plane-to-relief-observation-progress' as const, landformEvolutionSimulated: false,
    points, relativeHeightM: 6.4, higherSpotId: 'yi', originalMapPreserved: true,
    comparison: { visible: stageIndex === 2, verticallyMagnified: true, sameReference: 'jia-879.0m',
      jia: [117, 10, 39] as SlopePoint, yi: [117, 26, 39] as SlopePoint, differenceM: 6.4 },
    contourElevationsM: SLOPE_CONTOURS.map(contourLine => contourLine.elevationM),
    sourceContourIntervalM: null, auxiliaryContourIntervalM: 10, surveyedDEM: false,
    interpolationIsFixed: true, verticalExaggeration: true,
  };
}
export type SlopeReliefState = ReturnType<typeof evaluateSlopeRelief>;
export function slopeProject([x, y, z]: SlopePoint): [number, number] {
  return [29 + x * 4.3 + (z - 38) * .6, 285 - y * 4 + (z - 38) * 1.3];
}
const n = (value: number) => Number(value.toFixed(5));
const xy = (point: SlopePoint) => slopeProject(point).map(n).join(',');
const polyline = (points: SlopePoint[], stroke = '#665c49', width = .8) => `<polyline points="${points.map(xy).join(' ')}" fill="none" stroke="${stroke}" stroke-width="${width}"/>`;
const polygonPath = (points: SlopePoint[]) => `M${points.map(xy).join('L')}Z`;
const svgText = (text: string, point: SlopePoint, extra = '', size = 25) => {
  const [x, y] = slopeProject(point); return `<text ${extra} x="${n(x)}" y="${n(y)}" text-anchor="middle" font-size="${size}" fill="#453f34" paint-order="stroke" stroke="#f7f1e3" stroke-width="5">${text}</text>`;
};
/** Same fixed triangles and derived contours as the raised Three.js terrain. */
export function slopeReliefSvg(input: number): string {
  const state = evaluateSlopeRelief(input), point = (index: number): SlopePoint => { const q = SLOPE_GRID[index]; return [q.x, slopeDisplayY(q.elevationM, state.phase), q.z]; };
  let sidePath = '', topPath = '';
  for (let i = SLOPE_BOUNDARY_INDICES.length - 1; i >= 0; i--) {
    const a = point(SLOPE_BOUNDARY_INDICES[i]), q = point(SLOPE_BOUNDARY_INDICES[(i + 1) % SLOPE_BOUNDARY_INDICES.length]);
    sidePath += polygonPath([[a[0], 0, a[2]], [q[0], 0, q[2]], q, a]);
  }
  // The same actual triangles are combined into one calm paper-coloured path.
  // This avoids thousands of DOM nodes during flat-mode seeking on a phone.
  for (let i = 0; i < SLOPE_TOP_INDICES.length; i += 3) {
    topPath += polygonPath(SLOPE_TOP_INDICES.slice(i, i + 3).map(point));
  }
  let body = `<path d="${sidePath}" fill="#b7a17c"/><path data-slope-terrain-triangles="${SLOPE_TOP_INDICES.length / 3}" d="${topPath}" fill="#cbb98f"/>`;
  for (const contourLine of SLOPE_CONTOURS) for (const path of contourLine.paths)
    body += polyline(path.map(([x, elevation, z]) => [x, slopeDisplayY(elevation, state.phase) + .06, z]), '#76684e', contourLine.sourceLabelRead ? 1.15 : .55);
  const boundary = SLOPE_BOUNDARY_INDICES.map(point); boundary.push(boundary[0]); body += polyline(boundary, '#615540', 1.1);
  for (const spot of state.points) {
    const [x, y] = slopeProject(spot.position);
    body += `<g data-slope-spot="${spot.id}" data-model-selection="2" role="button" tabindex="0" aria-label="${spot.name}，海拔${spot.elevationM.toFixed(1)}米；比较甲乙高差"><circle cx="${n(x)}" cy="${n(y)}" r="11" fill="transparent"/><circle cx="${n(x)}" cy="${n(y)}" r="4" fill="#8b5c3d" stroke="#faf5e7" stroke-width="1.2"/>${svgText(`${spot.name} ${spot.elevationM.toFixed(1)}m`, [spot.x, spot.position[1] + 5.8, spot.z])}</g>`;
  }
  if (state.comparison.visible) {
    const c = SLOPE_LAYOUT.comparison;
    body += polyline([[c.rulerX, c.jiaY, c.z], [c.rulerX, c.yiY, c.z]], '#a46d43', 1.5);
    for (const [name, y] of [['甲', c.jiaY], ['乙', c.yiY]] as const) {
      body += polyline([[c.x - 1.5, y, c.z], [c.rulerX + 2, y, c.z]], '#a46d43', 1.2);
      body += svgText(name, [c.x - 5, y + 1, c.z]);
    }
    body += svgText('6.4m', c.label); body += svgText('高差放大', [123, -8, 39], '', 26);
  }
  body += polyline([SLOPE_LAYOUT.track.start, SLOPE_LAYOUT.track.end], '#9b8c6d', 1.3);
  const [hx, hy] = slopeProject([14 + 72 * state.phase, 1, 91]);
  body += `<path data-slope-handle="true" d="M${n(hx - 8)} ${n(hy)}l8-5 8 5-8 5Z" fill="#ddc99e" stroke="#8c7653" stroke-width="1.2"/>`;
  SLOPE_STOPS.forEach((stop, index) => { body += `<g data-slope-node="${index}" data-model-selection="${index}" role="button" tabindex="0" aria-label="${stop.label}">${svgText(stop.label, SLOPE_LAYOUT.labels[index])}</g>`; });
  const diagnostics = JSON.stringify({ phase: state.phase, stageIndex: state.stageIndex, points: state.points, relativeHeightM: state.relativeHeightM, phaseMeaning: state.phaseMeaning, surveyedDEM: false, sourceContourIntervalM: null });
  return `<svg xmlns="http://www.w3.org/2000/svg" class="flat-model-svg flat-explanation-svg" viewBox="0 0 700 420" role="img" aria-label="图4.22约束的教学近似立体地形；竖向夸张，观察抬升不是地形演化" data-slope-state='${diagnostics}' data-slope-original-map-preserved="true"><title>${state.caption}</title><desc>已读甲879.0米、乙885.4米，乙高6.4米。保留中央沟谷与右支沟关系；其他高度和辅助等高线为固定教学插值，不是精确地形复原。</desc>${body}</svg>`;
}

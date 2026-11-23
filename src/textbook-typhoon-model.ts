import { drawingGrip } from './textbook-drawing-grip';
/** PEP Geography I, printed p.103 / PDF p.108, fig.6.5, visually checked.
 * One idealized mature Northern Hemisphere typhoon is opened at the front.
 * Progress reveals simultaneous structures; it is not genesis or a life cycle. */
export type TyphoonPoint = readonly [number, number, number];
export type TyphoonStage = 'surface-inflow' | 'eyewall-ascent' | 'upper-outflow' | 'eye-descent';
export interface TyphoonMesh { positions: number[]; indices: number[] }
export const TYPHOON_STOPS = [
  { label: '低层辐合', phase: .25, selection: 0 },
  { label: '眼墙上升', phase: .5, selection: 1 },
  { label: '高空辐散', phase: .75, selection: 2 },
  { label: '眼内下沉', phase: 1, selection: 3 },
] as const;
export const TYPHOON_REFERENCE = {
  textbookPages: [103], pdfPages: [108], figure: '6.5', hemisphere: 'north',
  rotationView: 'from-above-with-north-up', surfaceRotation: 'counterclockwise',
  matureStructure: true, simultaneousAirMotions: true, progressMeansTeachingOrder: true,
  progressMeansElapsedTime: false, depictsGenesis: false, depictsLifecycle: false,
  changesHemisphere: false, measuredWindSpeed: false, measuredDistance: false,
  measuredTime: false, forecast: false, cloudParticlesAreWaterDropletsAndIce: true, cloudIsNotWaterVapor: true,
  eyeIsRelativelyCloudFree: true, eyeDescentIsNotAllEyewallAirReturning: true,
  cutawayIsAnObservationOpening: true, cutawayIsAnActualGapInTheStorm: false,
} as const;
export const TYPHOON_LAYOUT = {
  center: [50, 40] as const, seaLevel: 2, eyeRadius: 8,
  cutStart: -Math.PI / 4, cutEnd: Math.PI * 5 / 4,
  track: { start: [13, -10, 88] as TyphoonPoint, end: [87, -10, 88] as TyphoonPoint },
  bounds: { min: [-3, -17, -9] as TyphoonPoint, max: [104, 74, 94] as TyphoonPoint },
} as const;
export const TYPHOON_WALL_PROFILE = [
  { y: 4, inner: 8.5, outer: 18.5 }, { y: 13, inner: 9, outer: 20.5 },
  { y: 25, inner: 9.8, outer: 21 }, { y: 35, inner: 10.5, outer: 23.2 },
  { y: 43, inner: 11.3, outer: 27.2 }, { y: 48, inner: 12, outer: 32 },
] as const;
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const distance = (a: TyphoonPoint, b: TyphoonPoint) => Math.hypot(...a.map((v, i) => v - b[i]));
const minus = (a: TyphoonPoint, b: TyphoonPoint): TyphoonPoint => a.map((v, i) => v - b[i]) as unknown as TyphoonPoint;
const cross = (a: TyphoonPoint, b: TyphoonPoint): TyphoonPoint => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: TyphoonPoint): TyphoonPoint => { const d = Math.hypot(...a) || 1; return a.map(v => v / d) as unknown as TyphoonPoint; };
/** +X is east, -Z is north. Increasing angle is counterclockwise on a map. */
export const typhoonPolar = (radius: number, angle: number, y: number): TyphoonPoint =>
  [TYPHOON_LAYOUT.center[0] + radius * Math.cos(angle), y, TYPHOON_LAYOUT.center[1] - radius * Math.sin(angle)];
export function typhoonPathPoint(path: readonly TyphoonPoint[], progress: number): TyphoonPoint {
  if (!path.length) return [0, 0, 0]; if (path.length === 1) return [...path[0]] as unknown as TyphoonPoint;
  const lengths = path.slice(1).map((p, i) => distance(path[i], p));
  let remaining = lengths.reduce((sum, n) => sum + n, 0) * clamp(progress);
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      const t = lengths[i] > 0 ? clamp(remaining / lengths[i]) : 0;
      return path[i].map((n, k) => mix(n, path[i + 1][k], t)) as unknown as TyphoonPoint;
    }
    remaining -= lengths[i];
  }
  return [...path[path.length - 1]] as unknown as TyphoonPoint;
}
const wallAngle = [-Math.PI / 4 + .08, Math.PI / 2, Math.PI * 5 / 4 - .08];
export const TYPHOON_COLUMNS = wallAngle.map((angle, index) => {
  const inflow = Array.from({ length: 33 }, (_, i) => typhoonPolar(mix(44, 20, i / 32), angle - 1.18 * (1 - i / 32), 4));
  const ascent = Array.from({ length: 25 }, (_, i) => {
    const t = i / 24;
    return typhoonPolar(20 + 13.8 * t * t, angle, mix(4, 49, t));
  });
  const outflow = Array.from({ length: 19 }, (_, i) => typhoonPolar(mix(33.8, 45, i / 18), angle, 49 + 4 * smooth(i / 18)));
  return { id: `column-${index}`, angle, inflow, ascent, outflow };
});
export const TYPHOON_EYE_DESCENT: readonly TyphoonPoint[] = [[50, 45, 40], [50, 32, 40], [50, 18, 40], [50, 6, 40]];
export interface TyphoonArrow {
  id: string; stage: TyphoonStage; selection: number; path: readonly TyphoonPoint[];
  reveal: number; tip: TyphoonPoint; width: number; thickness: number; color: string;
}
export const TYPHOON_LABELS = [
  { text: '低层气流', at: [26, 8, 79] as TyphoonPoint, width: 40, height: 12, selection: 0 },
  { text: '眼墙', at: [87, 30, 62] as TyphoonPoint, width: 24, height: 12, selection: 1 },
  { text: '高空辐散', at: [72, 65, 49] as TyphoonPoint, width: 40, height: 12, selection: 2 },
  { text: '台风眼', at: [83, 18, 81] as TyphoonPoint, width: 34, height: 12, selection: 3 },
] as const;
export const TYPHOON_TARGETS = [
  { selection: 0, role: 'low-level-inflow', point: typhoonPathPoint(TYPHOON_COLUMNS[0].inflow, .4) },
  { selection: 1, role: 'eyewall', point: typhoonPathPoint(TYPHOON_COLUMNS[0].ascent, .48) },
  { selection: 2, role: 'upper-outflow', point: typhoonPathPoint(TYPHOON_COLUMNS[0].outflow, .5) },
  { selection: 3, role: 'eye-descent', point: [50, 24, 40] as TyphoonPoint },
] as const;
export function evaluateTyphoon(input: number) {
  const phase = clamp(input), stageIndex = phase <= .25 ? 0 : phase <= .5 ? 1 : phase <= .75 ? 2 : 3;
  const stages: TyphoonStage[] = ['surface-inflow', 'eyewall-ascent', 'upper-outflow', 'eye-descent'];
  const visibility = { inflow: smooth(phase / .25), ascent: smooth((phase - .25) / .25),
    outflow: smooth((phase - .5) / .25), descent: smooth((phase - .75) / .25) };
  const arrows: TyphoonArrow[] = [];
  const add = (id: string, stage: TyphoonStage, selection: number, path: readonly TyphoonPoint[], reveal: number, color: string) =>
    arrows.push({ id, stage, selection, path, reveal, tip: typhoonPathPoint(path, reveal), width: 1.3, thickness: .64, color });
  for (const column of TYPHOON_COLUMNS) {
    add(`${column.id}-inflow`, 'surface-inflow', 0, column.inflow, visibility.inflow, '#6b989a');
    add(`${column.id}-ascent`, 'eyewall-ascent', 1, column.ascent, visibility.ascent, '#b8876c');
    add(`${column.id}-outflow`, 'upper-outflow', 2, column.outflow, visibility.outflow, '#6f9793');
  }
  add('eye-descent', 'eye-descent', 3, TYPHOON_EYE_DESCENT, visibility.descent, '#7e91a8');
  const text = [
    '从上方看，北半球典型台风的近地面气流逆时针向中心辐合。剖切处只是为看清内部打开的观察口。',
    '低层气流到达眼墙附近后上升，云墙围绕着台风眼；教材把最强烈的降水标在旋涡风雨区。',
    '眼墙上升气流与高空向外辐散相联系。已经显示的低层和上升结构保留，这些运动在同一个台风中并存。',
    '台风眼内有下沉气流，常少云、干暖。眼内下沉与眼墙上升并存，不能把本课的揭示顺序当作台风的形成过程。',
  ][stageIndex];
  const handle = TYPHOON_LAYOUT.track.start.map((n, i) => mix(n, TYPHOON_LAYOUT.track.end[i], phase)) as unknown as TyphoonPoint;
  return { phase, stage: stages[stageIndex], stageIndex, selection: stageIndex, caption: TYPHOON_STOPS[stageIndex].label,
    text, hemisphere: 'north' as const, surfaceRotation: 'counterclockwise-from-above' as const,
    surfaceConvergence: true, eyewallAscent: true, upperDivergence: true, eyeDescent: true,
    visibility, arrows, columns: TYPHOON_COLUMNS, eyePath: TYPHOON_EYE_DESCENT, handle,
    labels: [TYPHOON_LABELS[stageIndex]], targets: TYPHOON_TARGETS, allStructuresRetained: true,
    units: 'teaching-reveal' as const, progressMeansElapsedTime: false, depictsGenesis: false, depictsLifecycle: false,
    endpointRetained: phase === 1, reference: TYPHOON_REFERENCE };
}
export type TyphoonState = ReturnType<typeof evaluateTyphoon>;

/** Closed faceted annulus with an open front quarter. The eye is a true hole,
 * not a dark disk painted over a filled cloud. Both cut faces are solid. */
export function typhoonCloudMesh(segments = 36, levels: readonly { y: number; inner: number; outer: number }[] = TYPHOON_WALL_PROFILE): TyphoonMesh {
  const positions: number[] = [], indices: number[] = [];
  for (const profile of levels) for (let i = 0; i <= segments; i++) {
    const angle = mix(TYPHOON_LAYOUT.cutStart, TYPHOON_LAYOUT.cutEnd, i / segments);
    const foldedOuter = profile.outer + .5 * Math.cos(angle * 12);
    positions.push(...typhoonPolar(foldedOuter, angle, profile.y), ...typhoonPolar(profile.inner, angle, profile.y));
  }
  const at = (j: number, i: number, inner = false) => (j * (segments + 1) + i) * 2 + Number(inner);
  const quad = (a: number, b: number, c: number, d: number) => indices.push(a, b, c, a, c, d);
  for (let j = 0; j < levels.length - 1; j++) for (let i = 0; i < segments; i++) {
    quad(at(j, i), at(j, i + 1), at(j + 1, i + 1), at(j + 1, i));
    quad(at(j, i, true), at(j + 1, i, true), at(j + 1, i + 1, true), at(j, i + 1, true));
  }
  for (let i = 0; i < segments; i++) {
    quad(at(0, i), at(0, i, true), at(0, i + 1, true), at(0, i + 1));
    quad(at(levels.length - 1, i), at(levels.length - 1, i + 1), at(levels.length - 1, i + 1, true), at(levels.length - 1, i, true));
  }
  for (let j = 0; j < levels.length - 1; j++) {
    quad(at(j, 0), at(j + 1, 0), at(j + 1, 0, true), at(j, 0, true));
    quad(at(j, segments), at(j, segments, true), at(j + 1, segments, true), at(j + 1, segments));
  }
  return { positions, indices };
}
export function typhoonPrismMesh(outline: readonly (readonly [number, number])[], bottom: number, top: number): TyphoonMesh {
  const positions: number[] = [], indices: number[] = [], count = outline.length;
  for (const y of [bottom, top]) for (const [x, z] of outline) positions.push(x, y, z);
  // Input perimeter is clockwise when viewed from +Y.
  for (let i = 1; i < count - 1; i++) indices.push(0, i, i + 1, count, count + i + 1, count + i);
  for (let i = 0; i < count; i++) { const j = (i + 1) % count; indices.push(i, count + i, count + j, i, count + j, j); }
  return { positions, indices };
}
export const TYPHOON_BASE_OUTLINE = [[7, 5], [93, 5], [97, 9], [97, 75], [93, 79], [7, 79], [3, 75], [3, 9]] as const;
export const TYPHOON_EYE_OUTLINE = Array.from({ length: 32 }, (_, i): readonly [number, number] => {
  const angle = -i / 32 * Math.PI * 2; const p = typhoonPolar(7.7, angle, 0); return [p[0], p[2]];
});
/** A fixed-topology closed paper arrow swept through the same XYZ field. */
export function typhoonArrowMeshData(arrow: TyphoonArrow, segments = 24) {
  const fullLength = arrow.path.slice(1).reduce((sum, p, i) => sum + distance(arrow.path[i], p), 0);
  const visibleLength = fullLength * arrow.reveal, scale = Math.min(1, visibleLength / (arrow.width * 3));
  const headLength = Math.min(visibleLength * .36, arrow.width * 2.7), bodyEnd = Math.max(0, arrow.reveal - headLength / (fullLength || 1));
  const frame = (t: number) => {
    const tangent = unit(minus(typhoonPathPoint(arrow.path, Math.min(1, t + .0001)), typhoonPathPoint(arrow.path, Math.max(0, t - .0001))));
    let side = cross(tangent, arrow.stage === 'surface-inflow' || arrow.stage === 'upper-outflow' ? [0, 1, 0] : [0, 0, 1]);
    if (Math.hypot(...side) < .01) side = cross(tangent, [1, 0, 0]);
    side = unit(side); return { side, normal: unit(cross(side, tangent)) };
  };
  const offset = (p: TyphoonPoint, side: TyphoonPoint, w: number, normal: TyphoonPoint, h: number): TyphoonPoint =>
    p.map((v, k) => v + side[k] * w + normal[k] * h) as unknown as TyphoonPoint;
  const positions: number[] = [], indices: number[] = [], left: TyphoonPoint[] = [], right: TyphoonPoint[] = [];
  const half = arrow.width * scale / 2, depth = arrow.thickness * scale / 2;
  for (let i = 0; i <= segments; i++) {
    const t = bodyEnd * i / segments, p = typhoonPathPoint(arrow.path, t), { side, normal } = frame(t);
    left.push(offset(p, side, half, normal, depth)); right.push(offset(p, side, -half, normal, depth));
    for (const [w, h] of [[half, depth], [-half, depth], [-half, -depth], [half, -depth]]) positions.push(...offset(p, side, w, normal, h));
    if (i < segments) for (let j = 0; j < 4; j++) { const a = i * 4 + j, b = i * 4 + (j + 1) % 4; indices.push(a, b, b + 4, a, b + 4, a + 4); }
  }
  const last = segments * 4; indices.push(0, 2, 1, 0, 3, 2, last, last + 1, last + 2, last, last + 2, last + 3);
  const base = typhoonPathPoint(arrow.path, bodyEnd), { side, normal } = frame(arrow.reveal), headHalf = arrow.width * scale * 1.28;
  const headLeft = offset(base, side, headHalf, normal, 0), headRight = offset(base, side, -headHalf, normal, 0), k = positions.length / 3;
  for (const h of [depth, -depth]) for (const p of [headLeft, arrow.tip, headRight]) positions.push(...offset(p, side, 0, normal, h));
  indices.push(k, k + 2, k + 1, k + 3, k + 4, k + 5);
  for (let i = 0; i < 3; i++) { const j = (i + 1) % 3; indices.push(k + i, k + j, k + j + 3, k + i, k + j + 3, k + i + 3); }
  return { positions, indices, outline: [...left, offset(headLeft, side, 0, normal, depth), offset(arrow.tip, side, 0, normal, depth),
    offset(headRight, side, 0, normal, depth), ...right.reverse()], tipVertices: [k + 1, k + 4] as const };
}
export function typhoonDiagnostics(state: TyphoonState) { return { ...state }; }
const num = (n: number) => Number(n.toFixed(3));
export function typhoonProject([x, y, z]: TyphoonPoint): readonly [number, number] {
  return [num(53 + x * 4.8 + (z - 40) * .75), num(360 - y * 4.1 + (z - 40) * 1.45)];
}
/** One native isometric cutaway, built from the same cloud and arrow vertices. */
export function typhoonSvg(phase: number): string {
  const state = evaluateTyphoon(phase), faces: { points: TyphoonPoint[]; color: string; depth: number; part: string }[] = [];
  const add = (mesh: TyphoonMesh, color: string, part: string) => {
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const points = mesh.indices.slice(i, i + 3).map(index => mesh.positions.slice(index * 3, index * 3 + 3) as unknown as TyphoonPoint);
      faces.push({ points, color, part, depth: points.reduce((sum, p) => sum + p[2] + p[1] * .55 + p[0] * .10, 0) / 3 });
    }
  };
  add(typhoonPrismMesh(TYPHOON_BASE_OUTLINE, 0, 2), '#a9c7c8', 'sea-base');
  add(typhoonCloudMesh(), '#e1e4d9', 'cloud-wall');
  add(typhoonPrismMesh(TYPHOON_EYE_OUTLINE, 2.05, 2.32), '#d7cead', 'eye-footprint');
  for (const arrow of state.arrows) if (arrow.reveal > .001) add(typhoonArrowMeshData(arrow), arrow.color, arrow.id);
  let scene = faces.sort((a, b) => a.depth - b.depth).map(face =>
    `<polygon data-typhoon-part="${face.part}" points="${face.points.map(p => typhoonProject(p).join(',')).join(' ')}" fill="${face.color}" stroke="${face.part === 'cloud-wall' ? '#aab5a6' : '#6f8680'}" stroke-width="${face.part === 'cloud-wall' ? .32 : .45}"/>`).join('');
  for (const stop of state.targets) {
    const [x, y] = typhoonProject(stop.point);
    scene += `<g data-typhoon-node="${stop.selection}" data-model-selection="${stop.selection}" role="button" tabindex="0" aria-label="观察${TYPHOON_STOPS[stop.selection].label}" style="cursor:pointer"><title>观察${TYPHOON_STOPS[stop.selection].label}</title><circle cx="${x}" cy="${y}" r="19" fill="transparent"/></g>`;
  }
  for (const label of state.labels) {
    const [x, y] = typhoonProject(label.at), width = label.width * 4.7;
    scene += `<g data-model-selection="${label.selection}" role="button" tabindex="0" aria-label="观察${label.text}" style="cursor:pointer"><rect x="${num(x - width / 2)}" y="${num(y - 22)}" width="${num(width)}" height="39" rx="2" fill="#f7f1e3"/><text x="${x}" y="${num(y + 7)}" font-size="30" text-anchor="middle">${label.text}</text></g>`;
  }
  const start = typhoonProject(TYPHOON_LAYOUT.track.start), end = typhoonProject(TYPHOON_LAYOUT.track.end), handle = typhoonProject(state.handle);
  scene += `<path d="M${start.join(' ')}L${end.join(' ')}" fill="none" stroke="#9c947b" stroke-width="2"/><path data-typhoon-handle="true" d="M${num(handle[0] - 9)} ${num(handle[1] - 5)}h18v7l-9 7-9-7Z" fill="#d4bd8b" stroke="#8e805f"/>${drawingGrip('推拉台风观测尺',start,end,state.phase)}`;
  const data = JSON.stringify(typhoonDiagnostics(state)).replace(/&/g, '&amp;').replace(/'/g, '&#39;');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="flat-model-svg flat-explanation-svg" viewBox="0 0 620 500" role="group" aria-label="北半球典型成熟台风，同一结构剖切：${state.caption}。进度是讲解顺序，不是形成过程。" data-typhoon-phase="${state.phase}" data-typhoon-stage="${state.stage}" data-typhoon-selection="${state.selection}" data-typhoon-state='${data}'><g fill="#303a40" font-family="FieldSerif,SimSun,serif" stroke-linejoin="round" stroke-linecap="round">${scene}</g></svg>`;
}

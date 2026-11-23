import { drawingGrip } from './textbook-drawing-grip';
/** Textbook p.34 fig.2.9 and p.36 fig.2.11, checked against the local pages.
 * Progress is a teaching reveal, not meteorological time or an energy budget.
 * The original textbook remains on the page below this spatial explanation. */
export type AirProcessEffect = 'heat' | 'circulation';
export type AirPoint = readonly [number, number, number];
export interface AirProcessStop { label: string; phase: number }
export const AIR_PROCESS_STOPS: Record<AirProcessEffect, readonly AirProcessStop[]> = {
  heat: [
    { label: '太阳短波', phase: .28 }, { label: '地面增温', phase: .52 },
    { label: '地面长波', phase: .82 }, { label: '大气吸收', phase: 1 },
  ],
  circulation: [
    { label: '受热均匀', phase: 0 }, { label: '冷热不均', phase: .24 },
    { label: '垂直运动', phase: .50 }, { label: '同高气压', phase: .74 },
    { label: '完整环流', phase: 1 },
  ],
};
export const AIR_PROCESS_REFERENCE = {
  heat: { textbookPage: 34, pdfPage: 39, figure: '2.9',
    scope: 'solar-shortwave-ground-warming-terrestrial-longwave-near-surface-air-absorption',
    backRadiationIncluded: false, quantifiedEnergyBudget: false,
    smallShortwaveAbsorptionAndReflectionNotQuantified: true, wavelengthsToScale: false },
  circulation: { textbookPage: 36, pdfPage: 41, figure: '2.11',
    warmColumn: 'A', coldColumns: ['B', 'C'], pressureComparison: 'same-height-only',
    revealOrderIsTeachingOrder: true, simulatedPressureUnits: false, simulatedTime: false,
    verticalMotionExplanation: 'unequal-heating-and-buoyancy-not-vertical-high-to-low-wind' },
} as const;
export const AIR_PROCESS_TRACK = { start: [12, -12, 68] as AirPoint, end: [88, -12, 68] as AirPoint };
export const AIR_PROCESS_BOUNDS = { min: [0, -17, 8] as AirPoint, max: [107, 74, 73] as AirPoint };

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const smooth = (a: number, z: number, n: number) => {
  const q = clamp((n - a) / (z - a)); return q * q * (3 - 2 * q);
};
const lerpPoint = (a: AirPoint, b: AirPoint, t: number): AirPoint => a.map((n, i) => n + (b[i] - n) * t) as unknown as AirPoint;
const length = (a: AirPoint, b: AirPoint) => Math.hypot(...a.map((n, i) => b[i] - n));
export const airHandlePoint = (phase: number) => lerpPoint(AIR_PROCESS_TRACK.start, AIR_PROCESS_TRACK.end, clamp(phase));
export function airGroundHeight(x: number) {
  const q = clamp((x - 4) / 92); return 3.2 + 3.7 * Math.sin(q * Math.PI) ** 2;
}

/** Arc-length sampling gives the solid arrow, outline and SVG exactly the same tip. */
export function airPathPoint(path: readonly AirPoint[], progress: number): AirPoint {
  if (path.length < 2) return path[0] ?? [0, 0, 0];
  const lengths = path.slice(1).map((point, i) => length(path[i], point));
  let distance = lengths.reduce((a, b) => a + b, 0) * clamp(progress);
  for (let i = 0; i < lengths.length; i++) {
    if (distance <= lengths[i] || i === lengths.length - 1) return lerpPoint(path[i], path[i + 1], distance / (lengths[i] || 1));
    distance -= lengths[i];
  }
  return path[path.length - 1];
}

export interface AirArrow {
  id: string; path: readonly AirPoint[]; reveal: number; width: number; thickness: number;
  color: string; tip: AirPoint;
}
const arrow = (id: string, path: readonly AirPoint[], reveal: number, width: number, color: string): AirArrow =>
  ({ id, path, reveal, width, thickness: .68, color, tip: airPathPoint(path, reveal) });

export type HeatProcessStage = 'shortwave' | 'ground-warming' | 'longwave' | 'air-absorption';
export interface HeatProcessState {
  effect: 'heat'; phase: number; stage: HeatProcessStage; stageIndex: number; caption: string;
  visibility: { shortwave: number; groundWarmth: number; longwave: number; airWarmth: number };
  arrows: AirArrow[];
  keyPositions: { solarSource: AirPoint; solarTip: AirPoint; groundFocus: AirPoint; longwaveSource: AirPoint;
    longwaveTip: AirPoint; airFocus: AirPoint; handle: AirPoint };
  units: 'teaching-reveal';
}
export type CirculationProcessStage = 'uniform' | 'uneven-heating' | 'vertical-motion' | 'pressure-contrast' | 'closed-circulation';
export interface AirColumn {
  id: 'B' | 'A' | 'C'; x: number; relativeWarmth: number;
  nearPressure: 'high' | 'low' | 'equal'; upperPressure: 'high' | 'low' | 'equal';
}
export interface CirculationProcessState {
  effect: 'circulation'; phase: number; stage: CirculationProcessStage; stageIndex: number; caption: string;
  visibility: { thermalContrast: number; vertical: number; pressure: number; horizontal: number };
  columns: AirColumn[]; arrows: AirArrow[];
  isobars: { lower: AirPoint[]; upper: AirPoint[] };
  loops: AirPoint[][];
  keyPositions: { warmUp: AirPoint; leftDown: AirPoint; rightDown: AirPoint; handle: AirPoint };
  comparisonHeights: readonly [12, 51];
  units: 'teaching-reveal';
}
export type AirProcessState = HeatProcessState | CirculationProcessState;

function heatState(phase: number): HeatProcessState {
  const shortwave = smooth(0, .28, phase), groundWarmth = smooth(.28, .52, phase);
  const longwave = smooth(.52, .82, phase), airWarmth = smooth(.65, 1, phase);
  const solarSource: AirPoint = [16, 54, 49], groundFocus: AirPoint = [34, airGroundHeight(34) + .12, 49];
  const longwaveSource: AirPoint = [66, airGroundHeight(66) + .12, 49];
  const longwaveEnd: AirPoint = [79, 44, 49];
  const dx = longwaveEnd[0] - longwaveSource[0], dy = longwaveEnd[1] - longwaveSource[1], d = Math.hypot(dx, dy);
  const path = Array.from({ length: 81 }, (_, i): AirPoint => {
    const t = i / 80, wave = 1.15 * Math.sin(t * Math.PI * 6) * Math.sin(t * Math.PI);
    return [longwaveSource[0] + dx * t - dy / d * wave, longwaveSource[1] + dy * t + dx / d * wave, 49];
  });
  const arrows = [arrow('solar-shortwave', [solarSource, groundFocus], shortwave, 2.3, '#c4a35a'),
    arrow('terrestrial-longwave', path, longwave, 1.75, '#b97450')];
  const stageIndex = phase <= .28 ? 0 : phase <= .52 ? 1 : phase <= .82 ? 2 : 3;
  const stage = (['shortwave', 'ground-warming', 'longwave', 'air-absorption'] as const)[stageIndex];
  return { effect: 'heat', phase, stage, stageIndex,
    caption: ['太阳短波到达地面', '地面吸收，温度升高', '地面以长波向大气辐射', '近地面大气吸收长波'][stageIndex],
    visibility: { shortwave, groundWarmth, longwave, airWarmth }, arrows,
    keyPositions: { solarSource, solarTip: arrows[0].tip, groundFocus, longwaveSource,
      longwaveTip: arrows[1].tip, airFocus: [73, 26, 30], handle: airHandlePoint(phase) }, units: 'teaching-reveal' };
}

/** Two closed cells share the warm central ascent. Their paths are explanatory
 * streamlines, not trajectories or a numerical fluid solution. */
function circulationState(phase: number): CirculationProcessState {
  const thermalContrast = smooth(0, .24, phase), vertical = smooth(.24, .5, phase);
  const pressure = smooth(.5, .74, phase), horizontal = smooth(.74, 1, phase);
  const z = 49, q = (x: number, y: number): AirPoint => [x, y, z];
  const arrows = [
    arrow('warm-ascent', [q(50, 29), q(50, 43)], vertical, 1.65, '#517f83'),
    arrow('left-descent', [q(18, 43), q(18, 29)], vertical, 1.65, '#517f83'),
    arrow('right-descent', [q(82, 43), q(82, 29)], vertical, 1.65, '#517f83'),
    arrow('upper-left', [q(46, 45), q(22, 45)], horizontal, 1.45, '#517f83'),
    arrow('upper-right', [q(54, 45), q(78, 45)], horizontal, 1.45, '#517f83'),
    arrow('lower-left', [q(22, 27), q(46, 27)], horizontal, 1.45, '#517f83'),
    arrow('lower-right', [q(78, 27), q(54, 27)], horizontal, 1.45, '#517f83'),
  ];
  const loop = (side: -1 | 1): AirPoint[] => {
    // Rounded cells meet exactly at the same centre-up segment.
    const corners = side === -1
      ? [[50, 29], [50, 43], [48, 45], [20, 45], [18, 43], [18, 29], [20, 27], [48, 27], [50, 29]]
      : [[50, 29], [50, 43], [52, 45], [80, 45], [82, 43], [82, 29], [80, 27], [52, 27], [50, 29]];
    return corners.map(([x, y]) => q(x, y));
  };
  const columns = (['B', 'A', 'C'] as const).map((id, i): AirColumn => ({ id, x: [18, 50, 82][i],
    relativeWarmth: (i === 1 ? 1 : -1) * thermalContrast,
    nearPressure: thermalContrast === 0 ? 'equal' : i === 1 ? 'low' : 'high',
    upperPressure: thermalContrast === 0 ? 'equal' : i === 1 ? 'high' : 'low' }));
  const isobar = (level: 'lower' | 'upper') => Array.from({ length: 49 }, (_, i): AirPoint => {
    const u = i / 48, bump = Math.sin(u * Math.PI) ** 2 * pressure;
    return [6 + u * 88, level === 'lower' ? 14 - bump * 4.2 : 48 + bump * 4.5, 31];
  });
  const stageIndex = phase === 0 ? 0 : phase <= .24 ? 1 : phase <= .5 ? 2 : phase <= .74 ? 3 : 4;
  const stage = (['uniform', 'uneven-heating', 'vertical-motion', 'pressure-contrast', 'closed-circulation'] as const)[stageIndex];
  return { effect: 'circulation', phase, stage, stageIndex,
    caption: ['受热均匀', 'B、C冷，A暖', '暖处上升，冷处下沉', '同一高度比较相对气压', '上下气流联系成环流'][stageIndex],
    visibility: { thermalContrast, vertical, pressure, horizontal }, columns, arrows,
    isobars: { lower: isobar('lower'), upper: isobar('upper') }, loops: [loop(-1), loop(1)],
    keyPositions: { warmUp: arrows[0].tip, leftDown: arrows[1].tip, rightDown: arrows[2].tip, handle: airHandlePoint(phase) },
    comparisonHeights: [12, 51], units: 'teaching-reveal' };
}

export function evaluateAirProcess(effect: 'heat', phase: number): HeatProcessState;
export function evaluateAirProcess(effect: 'circulation', phase: number): CirculationProcessState;
export function evaluateAirProcess(effect: AirProcessEffect, phase: number): AirProcessState;
export function evaluateAirProcess(effect: AirProcessEffect, phase: number): AirProcessState {
  return effect === 'heat' ? heatState(clamp(phase)) : circulationState(clamp(phase));
}

/** A closed, fixed-topology shaft and triangular paper arrowhead. The SVG uses
 * this same outline; only small text labels need raster textures in 3-D. */
export function airArrowMeshData(a: AirArrow, segments = 24) {
  const fullLength = a.path.slice(1).reduce((sum, p, i) => sum + length(a.path[i], p), 0);
  const end = clamp(a.reveal), tip = airPathPoint(a.path, end), visibleLength = fullLength * end;
  const scale = Math.min(1, visibleLength / Math.max(1, a.width * 3));
  const headLength = Math.min(visibleLength * .42, a.width * 2.7);
  const bodyEnd = Math.max(0, end - headLength / (fullLength || 1));
  const normalAt = (t: number): AirPoint => {
    const p = airPathPoint(a.path, Math.max(0, t - .001)), q = airPathPoint(a.path, Math.min(1, t + .001));
    const d = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    return [-(q[1] - p[1]) / d, (q[0] - p[0]) / d, 0];
  };
  const positions: number[] = [], indices: number[] = [], left: AirPoint[] = [], right: AirPoint[] = [];
  const half = a.width * scale / 2, depth = a.thickness * scale / 2;
  for (let i = 0; i <= segments; i++) {
    const t = bodyEnd * i / segments, p = airPathPoint(a.path, t), n = normalAt(t);
    const l: AirPoint = [p[0] + n[0] * half, p[1] + n[1] * half, p[2]];
    const r: AirPoint = [p[0] - n[0] * half, p[1] - n[1] * half, p[2]];
    left.push(l); right.push(r);
    for (const [point, dz] of [[l, depth], [r, depth], [r, -depth], [l, -depth]] as const)
      positions.push(point[0], point[1], point[2] + dz);
    if (i < segments) for (let side = 0; side < 4; side++) {
      const u = i * 4 + side, v = i * 4 + (side + 1) % 4;
      indices.push(u, v, v + 4, u, v + 4, u + 4);
    }
  }
  const last = segments * 4;
  indices.push(0, 2, 1, 0, 3, 2, last, last + 1, last + 2, last, last + 2, last + 3);
  const base = airPathPoint(a.path, bodyEnd), normal = normalAt(end), headHalf = a.width * scale * 1.28;
  const headLeft: AirPoint = [base[0] + normal[0] * headHalf, base[1] + normal[1] * headHalf, base[2]];
  const headRight: AirPoint = [base[0] - normal[0] * headHalf, base[1] - normal[1] * headHalf, base[2]];
  const k = positions.length / 3;
  for (const dz of [depth, -depth]) for (const point of [headLeft, tip, headRight]) positions.push(point[0], point[1], point[2] + dz);
  indices.push(k, k + 2, k + 1, k + 3, k + 4, k + 5);
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3; indices.push(k + i, k + j, k + j + 3, k + i, k + j + 3, k + i + 3);
  }
  return { positions, indices, outline: [...left, headLeft, tip, headRight, ...right.reverse()], tip };
}

export function airProcessDiagnostics(s: AirProcessState) {
  return { effect: s.effect, phase: s.phase, stage: s.stage, stageIndex: s.stageIndex, caption: s.caption,
    visibility: { ...s.visibility }, keyPositions: s.keyPositions, units: s.units,
    arrowTips: s.arrows.map(a => ({ id: a.id, reveal: a.reveal, tip: a.tip })),
    ...(s.effect === 'circulation' ? { columns: s.columns, comparisonHeights: s.comparisonHeights,
      isobars: s.isobars, loops: s.loops } : {}) };
}

const num = (value: number) => Number(value.toFixed(3));
const colorBlend = (from: string, to: string, t: number) => {
  const a = from.match(/[a-f\d]{2}/gi)!.map(s => parseInt(s, 16)), b = to.match(/[a-f\d]{2}/gi)!.map(s => parseInt(s, 16));
  return `#${a.map((n, i) => Math.round(n + (b[i] - n) * clamp(t)).toString(16).padStart(2, '0')).join('')}`;
};
function bathEngraving(warm: boolean) {
  const bowl = warm
    ? '<path d="M-39 -24Q0 -13 39 -24L34 -18Q0 -8 -34 -18Z" fill="#a96945"/><path d="M-32 -22Q0 -17 32 -22" fill="none" stroke="#ead1a1"/><path d="M-24 -17l-5 24m53-24 5 24" fill="none" stroke-width="3"/><path d="M-10 6Q-15 1 -8 -3H8Q15 1 10 6Z" fill="#6c847b"/><path d="M-3 -3Q-6 -9 1 -16Q0 -11 4 -9Q6 -5 2 -3Z" fill="#df9e47" stroke="none"/>'
    : '<path d="M-35 -11Q0 -18 35 -11L31 2Q0 11 -31 2Z" fill="#ac8351"/><ellipse cy="-11" rx="35" ry="6.5" fill="#83aeb0"/><path d="M-22 -12l1 -8 11 -4 8 4 -1 10 -11 2Z M3 -11l-2 -10 9 -6 13 4 2 10 -10 4Z" fill="#d2e5df" stroke="#759d9c"/><path d="M-20 -19l8 3 10 -4m-10 4 -1 8m15 -12 11 4 11 -6m-11 6 2 7" fill="none" stroke="#9ebdb8"/>';
  return '<g stroke="#725c40" stroke-width="1.5">' + bowl + '</g>';
}

export function airProcessSvg(effect: AirProcessEffect, phase: number): string {
  const s = evaluateAirProcess(effect, phase), x = (n: number) => num(30 + n * 5.65), y = (n: number) => num(374 - n * 4.7);
  const points = (path: readonly AirPoint[]) => path.map(p => `${x(p[0])},${y(p[1])}`).join(' ');
  const text = (value: string, at: AirPoint, size = 30) => `<text x="${x(at[0])}" y="${y(at[1])}" text-anchor="middle" font-size="${size}">${value}</text>`;
  let scene = '';
  if (s.effect === 'heat') {
    const ground = Array.from({ length: 49 }, (_, i): AirPoint => [4 + 92 * i / 48, airGroundHeight(4 + 92 * i / 48), 0]);
    scene += `<path d="M${x(4)} ${y(0)}L${points(ground)}L${x(96)} ${y(0)}Z" fill="${colorBlend('#c7bba3', '#bd8960', s.visibility.groundWarmth)}" stroke="#7b7a69" stroke-width="1.4"/>`;
    for (const h of [18, 30, 42]) {
      const path = Array.from({ length: 49 }, (_, i): AirPoint => [6 + 88 * i / 48, h + 3.5 * Math.sin(i / 48 * Math.PI), 0]);
      scene += `<polyline points="${points(path)}" fill="none" stroke="#b3c8c4" stroke-width="1.5"/>`;
    }
    for (let i = 0; i < 9; i++) {
      const px = x(69 + i % 3 * 4.3), py = y(16 + Math.floor(i / 3) * 7.3);
      scene += `<path d="M${px} ${py - 3.4}l3.4 3.4-3.4 3.4-3.4-3.4Z" fill="${colorBlend('#afc2bd', '#bf916f', s.visibility.airWarmth)}"/>`;
    }
    scene += `<path d="M${x(8)} ${y(0)}V${y(57)}H${x(12)}" fill="none" stroke="#55635a" stroke-width="5"/>
      <g transform="translate(${x(16)} ${y(54)}) rotate(58)"><path d="M-53 -11H-27L-5 -24H0V24H-5L-27 11H-53Z" fill="#41534c" stroke="#765f40" stroke-width="2"/><path d="M-53 -12V12M-31 -12V12M-6 -23V23" stroke="#c0a168" stroke-width="3"/><ellipse rx="5.8" ry="22" fill="#c4b9a2" stroke="#8b734c"/><ellipse rx="2.3" ry="10" fill="#d6a15b"/></g>`;
    for(const [column,response] of [[34,s.visibility.groundWarmth],[83,s.visibility.airWarmth]]) {
      const cx=x(column),cy=y(column===34?11:27);
      scene+=`<circle cx="${cx}" cy="${cy}" r="15" fill="#ad8a53" stroke="#675d46" stroke-width="1.3"/><circle cx="${cx}" cy="${cy}" r="12" fill="#e4d7b7"/><path d="M${cx-9} ${cy-4}l2 1m7-7v3m9 2-2 1" stroke="#796c54"/><path transform="rotate(${-25+response*62} ${cx} ${cy})" d="M${cx} ${cy+3}v-12" stroke="#47524b" stroke-width="1.7"/>`;
    }
    scene+=`<rect x="${x(5)}" y="${y(.05)}" width="${x(95)-x(5)}" height="40" rx="4" fill="#654a34" stroke="#906f47"/>`;
    for(const [i,caption] of ['短波','地面','长波','大气'].entries()){
      const cx=x(18+i*21.33);
      scene+=`<g data-model-selection="${i}" data-specimen-key="" role="button" tabindex="0" aria-label="定位到${AIR_PROCESS_STOPS.heat[i].label}"><rect x="${cx-44}" y="${y(-.65)}" width="88" height="31" rx="3" fill="${s.stageIndex===i?'#d8c59c':'#ebdec0'}" stroke="#a98b58" stroke-width="2"/><text x="${cx}" y="${y(-5.32)}" text-anchor="middle" font-size="21">${caption}</text></g>`;
    }
  } else {
    scene += `<rect x="${x(4)}" y="${y(3)}" width="${x(96) - x(4)}" height="${y(0) - y(3)}" fill="#bdb5a0" stroke="#7b7a69"/>`;
    s.columns.forEach((c, i) => {
      if (s.visibility.thermalContrast > 0) {
        scene += `<g data-air-bath="${i === 1 ? 'warm' : 'cold'}" transform="translate(${x(c.x)},${y(3.5)})" opacity="${num(s.visibility.thermalContrast)}">${bathEngraving(i === 1)}</g>`;
      }
      scene += text(s.visibility.thermalContrast > 0 ? `${c.id} · ${i === 1 ? '暖' : '冷'}` : c.id, [c.x, -4, 0]);
    });
    for (const path of [s.isobars.lower, s.isobars.upper]) scene += `<polyline points="${points(path)}" fill="none" stroke="#9eb9ba" stroke-width="2"/>`;
    for (const a of s.arrows) {
      if (a.reveal < .001) continue;
      const start = a.path[0], end = a.path[a.path.length - 1];
      const dx = end[0] - start[0], dy = end[1] - start[1], length = Math.hypot(dx, dy);
      const path = Array.from({ length: 29 }, (_, i): AirPoint => {
        const t = i / 28, wave = .85 * Math.sin(t * 10 - s.phase * 9) + 2.9;
        return [start[0] + dx * t - dy / length * wave, start[1] + dy * t + dx / length * wave, 0];
      });
      scene += `<polyline data-air-tracer="${a.id}" points="${points(path)}" fill="none" stroke="#7e9186" stroke-width="2.3" opacity="${num(.8 * a.reveal)}" stroke-dasharray="8 4 2 4" stroke-dashoffset="${num(-55 * s.phase)}"/>`;
    }
    if (s.visibility.pressure > 0) {
      for (const h of s.comparisonHeights) scene += `<path d="M${x(8)} ${y(h)}H${x(92)}" stroke="#9c9f91" stroke-width="1" stroke-dasharray="5 7"/>`;
      s.columns.forEach(c => {
        for (const [h, value] of [[12, c.nearPressure], [51, c.upperPressure]] as const) scene += `<rect x="${x(c.x) - 15}" y="${y(h) - 20}" width="30" height="29" fill="#f7f1e3"/>${text(value === 'high' ? '高' : '低', [c.x, h - .7, 0])}`;
      });
      scene += text('相对气压 · 同高比较', [50, 63, 0]);
    }
    if (s.visibility.horizontal > 0) for (const loop of s.loops) scene += `<polyline points="${points(loop)}" fill="none" stroke="#739291" stroke-width="1.2" opacity="${num(s.visibility.horizontal)}"/>`;
  }
  for (const a of s.arrows) if (a.reveal > .001) {
    const mesh = airArrowMeshData(a);
    scene += `<polygon data-air-arrow="${a.id}" data-reveal="${a.reveal}" data-tip='${JSON.stringify(a.tip)}' points="${points(mesh.outline)}" fill="${a.color}" stroke="#566c68" stroke-width=".8"/>`;
  }
  const handle = airHandlePoint(s.phase), diagnostics = JSON.stringify(airProcessDiagnostics(s)).replace(/&/g, '&amp;').replace(/'/g, '&#39;');
  return `<svg class="flat-model-svg flat-explanation-svg" viewBox="0 0 660 534" role="group" aria-label="${s.caption}，进度表示讲解顺序" data-air-effect="${s.effect}" data-air-phase="${s.phase}" data-air-stage="${s.stage}" data-air-state='${diagnostics}'>
    <g font-family="FieldSerif,SimSun,serif" fill="#303a40" stroke-linecap="round" stroke-linejoin="round">${scene}
    <path d="M${x(12)} ${y(-12)}H${x(88)}" fill="none" stroke="#a59b82" stroke-width="2"/>
    <ellipse data-air-role="phase-handle" cx="${x(handle[0])}" cy="${y(handle[1])}" rx="9" ry="7" fill="#e8d9b8" stroke="#7c806c"/>${drawingGrip('推拉热力过程标尺',[x(12),y(-12)],[x(88),y(-12)],s.phase)}
    <text x="330" text-anchor="middle" font-size="30" pointer-events="none"><tspan x="330" y="479">${effect === 'heat' ? '两类辐射的主路径示意' : '分步显示是讲解顺序'}</tspan><tspan x="330" y="518">${effect === 'heat' ? '不表示能量比例' : '气压只在同一高度比较'}</tspan></text>
    </g></svg>`;
}

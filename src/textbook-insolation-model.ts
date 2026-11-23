import hemispheres from './assets/solar-instrument/observation-hemispheres.json';
import { recorderWheel } from './textbook-recorder-drawings';
import { drawingGrip } from './textbook-drawing-grip';
/** A geometric supplement to textbook p.9, not a 3-D reconstruction of
 * Fig.1.12 (annual radiation above the atmosphere). The Sun is fixed over
 * the equator. We compare local-noon incidence at 0–65° north, isolating
 * angle of incidence from day length, season and atmospheric effects.
 * Coordinates and beam width below are teaching dimensions, not readings. */
export type InsolationPoint = [number, number, number];
export const INSOLATION_REFERENCE = {
  printedPages: [9], pdfPages: [14], figure: '1.12',
  source: '人教版《地理 必修 第一册》第9页思考题；图1.12为北半球大气上界年太阳辐射量柱图。',
  note: '本模型固定太阳直射赤道，对照各纬度局地正午的入射几何，只解释入射角一项原因；不显示年总辐射量，也不代表所有季节的纬度分布。',
  directReconstructionOfOriginalFigure: false,
  subsolarLatitudeDegrees: 0, localNoonGeometry: true,
  annualRadiationCalculated: false, seasonalDistribution: false,
  dayLengthCalculated: false, atmosphereCalculated: false,
  beamDimensionsAreTeachingCoordinates: true,
} as const;
const rad = Math.PI / 180;
export const INSOLATION_STOPS = [
  { selection: 0, label: '低纬度', phase: 0, latitudeDegrees: 0 },
  { selection: 1, label: '中纬度', phase: Math.sin(40 * rad) / Math.sin(65 * rad), latitudeDegrees: 40 },
  { selection: 2, label: '高纬度', phase: 1, latitudeDegrees: 65 },
] as const;
export const INSOLATION_LAYOUT = {
  center: [64, 29, 28] as InsolationPoint,
  radius: 23, halfBeam: 1.6, sourceDistance: 58,
  maxLatitudeDegrees: 65,
  sunward: [-.86, 0, Math.sqrt(1 - .86 ** 2)] as InsolationPoint,
  labels: {
    beam: { text: '等宽光束', at: [20, 62, 60] as InsolationPoint, width: 35, height: 8 },
    footprint: { text: '照射范围', at: [85, 58, 48] as InsolationPoint, width: 35, height: 8 },
    latitude: { at: [86, 3, 55] as InsolationPoint, width: 30, height: 8 },
  },
  patchRows: 24, patchColumns: 8,
  bounds: { min: [-1, -3, 4] as InsolationPoint, max: [106, 68, 67] as InsolationPoint },
};
const L = INSOLATION_LAYOUT;
const clamp = (v: number) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
const tangent: InsolationPoint = [L.sunward[2], 0, -L.sunward[0]];
const dot = (a: InsolationPoint, b: InsolationPoint) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: InsolationPoint, b: InsolationPoint): InsolationPoint => a.map((v, i) => v - b[i]) as InsolationPoint;
const cross = (a: InsolationPoint, b: InsolationPoint): InsolationPoint => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export function insolationSource(height: number, transverse = 0): InsolationPoint {
  return L.center.map((v, i) => v + L.sunward[i] * L.sourceDistance + tangent[i] * transverse + (i === 1 ? height : 0)) as InsolationPoint;
}
/** First intersection of a parallel ray with the illuminated hemisphere.
 * All four corners remain below the polar tangent at 65°, so no clamp or
 * moving beam boundary is needed. Its source cross-section is always 3.2². */
export function insolationHit(height: number, transverse = 0): InsolationPoint {
  const along = Math.sqrt(L.radius ** 2 - height ** 2 - transverse ** 2);
  return L.center.map((v, i) => v + L.sunward[i] * along + tangent[i] * transverse + (i === 1 ? height : 0)) as InsolationPoint;
}
export interface InsolationRay {
  id: string; verticalOffset: number; transverseOffset: number;
  source: InsolationPoint; hit: InsolationPoint;
}
export interface InsolationState {
  phase: number; height: number; latitude: number; latitudeDegrees: number;
  selection: 0 | 1 | 2; stage: 0 | 1 | 2; stageIndex: 0 | 1 | 2;
  label: string; caption: string; phaseMeaning: 'observation-latitude';
  beamWidth: number; beamHeight: number; beamCrossSectionArea: number;
  incidenceCosine: number; footprintArcLength: number; footprintArea: number;
  sourceCenter: InsolationPoint; hitCenter: InsolationPoint;
  rays: InsolationRay[];
  patch: { points: InsolationPoint[]; indices: number[]; boundary: InsolationPoint[]; rows: number; columns: number };
}
const rayOffsets = [[0, 0], [-L.halfBeam, -L.halfBeam], [-L.halfBeam, L.halfBeam], [L.halfBeam, -L.halfBeam], [L.halfBeam, L.halfBeam]];
export function evaluateInsolation(phase: number): InsolationState {
  const t = clamp(phase), height = t * L.radius * Math.sin(L.maxLatitudeDegrees * rad);
  const latitude = Math.asin(height / L.radius), degrees = latitude / rad;
  const selection = (degrees < 30 ? 0 : degrees < 60 ? 1 : 2) as 0 | 1 | 2;
  const rows = L.patchRows, columns = L.patchColumns, points: InsolationPoint[] = [], indices: number[] = [];
  for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
    points.push(insolationHit(height - L.halfBeam + 2 * L.halfBeam * row / rows, -L.halfBeam + 2 * L.halfBeam * col / columns));
    if (row < rows && col < columns) {
      const a = row * (columns + 1) + col;
      indices.push(a, a + 1, a + columns + 1, a + 1, a + columns + 2, a + columns + 1);
    }
  }
  const boundary: InsolationPoint[] = [];
  for (let col = 0; col <= columns; col++) boundary.push(points[col]);
  for (let row = 1; row <= rows; row++) boundary.push(points[row * (columns + 1) + columns]);
  for (let col = columns - 1; col >= 0; col--) boundary.push(points[rows * (columns + 1) + col]);
  for (let row = rows - 1; row > 0; row--) boundary.push(points[row * (columns + 1)]);
  let footprintArea = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = points[indices[i]], b = points[indices[i + 1]], c = points[indices[i + 2]];
    footprintArea += Math.hypot(...cross(sub(b, a), sub(c, a))) / 2;
  }
  return {
    phase: t, height, latitude, latitudeDegrees: degrees, selection, stage: selection, stageIndex: selection,
    label: INSOLATION_STOPS[selection].label,
    caption: `${INSOLATION_STOPS[selection].label}：同样宽的平行光束，斜照时覆盖的地表范围更大。`,
    phaseMeaning: 'observation-latitude',
    beamWidth: 2 * L.halfBeam, beamHeight: 2 * L.halfBeam, beamCrossSectionArea: (2 * L.halfBeam) ** 2,
    incidenceCosine: Math.cos(latitude),
    footprintArcLength: L.radius * (Math.asin((height + L.halfBeam) / L.radius) - Math.asin((height - L.halfBeam) / L.radius)),
    footprintArea, sourceCenter: insolationSource(height), hitCenter: insolationHit(height),
    rays: rayOffsets.map(([v, w], i) => ({ id: `parallel-ray-${i}`, verticalOffset: v, transverseOffset: w,
      source: insolationSource(height + v, w), hit: insolationHit(height + v, w) })),
    patch: { points, indices, boundary, rows, columns },
  };
}

/** The same physical coordinates viewed from the illuminated front-left. */
export function insolationProject([x, y, z]: InsolationPoint): [number, number] {
  const yaw = -.36, pitch = .16, scale = 5.5;
  return [442 + ((x - L.center[0]) * Math.cos(yaw) - (z - L.center[2]) * Math.sin(yaw)) * scale,
    282 - (y - L.center[1]) * Math.cos(pitch) * scale
      + ((x - L.center[0]) * Math.sin(yaw) + (z - L.center[2]) * Math.cos(yaw)) * Math.sin(pitch) * scale];
}
const visible = (p: InsolationPoint) => dot(sub(p, L.center), [Math.sin(-.36) * Math.cos(.16), Math.sin(.16), Math.cos(-.36) * Math.cos(.16)]) > -.1;
const path = (points: InsolationPoint[]) => points.map((p, i) => `${i ? 'L' : 'M'}${insolationProject(p).map(v => +v.toFixed(3)).join(',')}`).join('');
const action = (selection: number, label: string) => `data-model-selection="${selection}" role="button" tabindex="0" data-specimen-key="" aria-label="${label}"`;
const txt = (at: InsolationPoint, label: string) => {
  const [x, y] = insolationProject(at);
  return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="FieldSerif,SimSun,serif" font-size="36" fill="#3e4947" stroke="#f7f1e3" stroke-width="7" paint-order="stroke">${label}</text>`;
};
export function insolationSvg(phase: number): string {
  const state = evaluateInsolation(phase), [cx, cy] = insolationProject(L.center);
  const sourceLow=insolationSource(0),[sx,sy]=insolationProject(sourceLow);
  const bottom=insolationProject([sourceLow[0],3,sourceLow[2]])[1];
  let body=`<path d="M${sx-31} ${bottom}L${cx+24} ${cy+124}l32 9L${sx-10} ${bottom+17}Z" fill="#68503b" stroke="#51422f" stroke-width="2"/>
    <path d="M${sx-24} ${bottom-2}L${cx+23} ${cy+123}" stroke="#ae925b" stroke-width="4"/>
    <path d="M${sx-11} ${bottom-2}V${sy-134}m20 130V${sy-130}" fill="none" stroke="#69756c" stroke-width="4"/>
    <path d="M${cx} ${cy-139}a139 139 0 0 1 0 278" fill="none" stroke="#ae905a" stroke-width="8"/>`;
  body+=`<circle data-insolation-earth="true" cx="${cx}" cy="${cy}" r="${L.radius * 5.5}" fill="#70999a" stroke="#52645e" stroke-width="1.8"/><g transform="translate(${cx} ${cy}) scale(${L.radius*5.5/100})"><path d="${hemispheres.insolation.land}" fill="#cbb88e" fill-rule="evenodd" stroke="#988961" stroke-width=".45"/><path d="${hemispheres.insolation.night}" fill="#15363d" opacity=".45"/></g>`;
  // Only the visible hemisphere is inked; three sparse latitude lines keep
  // the illumination patch readable, without an opaque grid on the globe.
  for (const latitude of [-40, 0, 40]) {
    const a = latitude * rad, ring: InsolationPoint[] = [];
    for (let i = 0; i <= 128; i++) {
      const lon = i / 128 * 2 * Math.PI;
      const p: InsolationPoint = [L.center[0] + Math.cos(a) * Math.cos(lon) * L.radius,
        L.center[1] + Math.sin(a) * L.radius, L.center[2] + Math.cos(a) * Math.sin(lon) * L.radius];
      if (visible(p)) ring.push(p); else if (ring.length > 1) { body += `<path d="${path(ring)}" fill="none" stroke="#829b92" stroke-width="1"/>`; ring.length = 0; }
    }
    if (ring.length > 1) body += `<path d="${path(ring)}" fill="none" stroke="#829b92" stroke-width="1"/>`;
  }
  body += `<path data-insolation-footprint="true" d="${path(state.patch.boundary)}Z" fill="#d7ab55" stroke="#a47a35" stroke-width="1.8"/>`;
  for (const ray of state.rays) {
    const a = insolationProject(ray.source), b = insolationProject(ray.hit);
    const arrow = a.map((v, i) => v + (b[i] - v) * .60), angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
    body += `<path data-insolation-ray="${ray.id}" d="${path([ray.source, ray.hit])}" fill="none" stroke="#b58e43" stroke-width="2.3"/>`;
    body += `<path d="M${arrow[0] - 8 * Math.cos(angle) + 4 * Math.sin(angle)},${arrow[1] - 8 * Math.sin(angle) - 4 * Math.cos(angle)}L${arrow.join(',')}L${arrow[0] - 8 * Math.cos(angle) - 4 * Math.sin(angle)},${arrow[1] - 8 * Math.sin(angle) + 4 * Math.cos(angle)}" fill="none" stroke="#a47a35" stroke-width="2"/>`;
  }
  INSOLATION_STOPS.forEach(stop => {
    const point = insolationHit(stop.phase * L.radius * Math.sin(L.maxLatitudeDegrees * rad)), [x, y] = insolationProject(point);
    body += `<g data-insolation-node="${stop.selection}" ${action(stop.selection, `${stop.label}，北纬${stop.latitudeDegrees}度`)}><circle cx="${x}" cy="${y}" r="15" fill="#f7f1e3" fill-opacity=".01"/><circle cx="${x}" cy="${y}" r="${stop.selection === state.selection ? 4.7 : 3.6}" fill="${stop.selection === state.selection ? '#9a7133' : '#506b65'}" stroke="#f7f1e3" stroke-width="1.7"/></g>`;
  });
  const start = insolationSource(0), end = insolationSource(L.radius * Math.sin(65 * rad));
  body += `<path data-insolation-height-track="true" d="${path([start, end])}" fill="none" stroke="#958d78" stroke-width="1.4"/>`;
  const [hx, hy] = insolationProject(state.sourceCenter);
  body+=`<g transform="translate(${hx} ${hy})"><rect x="-15" y="-11" width="27" height="22" rx="3" fill="#997e50" stroke="#60513a" stroke-width="2"/><path d="M4 -8h13v16H4" fill="#5a6860" stroke="#625640"/></g>`;
  body+=recorderWheel(sx-27,bottom-30,18,state.phase,'转动升降手轮');
  body += `<path data-insolation-height-handle="true" d="M${hx - 7},${hy - 6}h14v12h-14Z" fill="#dbc38c" stroke="#8d784b" stroke-width="1.5"/>${drawingGrip('升降平行光源',insolationProject(start),insolationProject(end),state.phase)}`;
  body += txt(L.labels.beam.at, L.labels.beam.text) + txt(L.labels.footprint.at, L.labels.footprint.text)
    + `<g ${action(state.selection, `${state.label}节点`)}>${txt(L.labels.latitude.at, state.label)}</g>`;
  return `<svg class="flat-model-svg flat-explanation-svg" viewBox="0 0 720 480" role="img" aria-label="等宽太阳光在不同纬度的照射范围" data-insolation-phase="${state.phase}" data-insolation-latitude="${state.latitudeDegrees}" data-insolation-selection="${state.selection}"><title>${INSOLATION_REFERENCE.note}滑动改变观察纬度，不表示时间。</title>${body}</svg>`;
}
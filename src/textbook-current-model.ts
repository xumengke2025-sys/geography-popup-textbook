import { evaluateWave, waveParticleAt, WAVE_GEOMETRY, WAVE_REFERENCE } from './textbook-wave-model';

/** Checked against PDF pages 65–67. Fig.3.26 is a satellite image of plankton
 * at a current confluence off southeastern Argentina. It does not show the
 * Gulf Stream, supply current-direction arrows or define the path below. */
export const CURRENT_REFERENCE = Object.freeze({
  printedPage: 61, pdfPage: 66, figure: '3.26', title: '洋流交汇海域浮游生物的卫星影像',
  source: 'textbook/page-066.webp', imageRegion: '阿根廷东南沿海', imageHasDirectionArrows: false,
  principle: '海水常年比较稳定地沿一定方向作大规模流动',
  modelType: 'local-directional-advection-teaching-example', notGeoreferenced: true,
  namedCurrent: null, actualCoastline: false, actualTrajectory: false,
  measuredSpeed: false, measuredTemperature: false, calibratedTime: false,
  globalClosedCirculation: false, confluenceOrEcologySimulated: false,
});
export const CURRENT_STOPS = [
  { label: '起点', phase: 0, selection: 0 },
  { label: '前移', phase: .5, selection: 1 },
  { label: '末位置', phase: 1, selection: 2 },
] as const;
export type CurrentPoint = [number, number, number];
export interface CurrentMeshData { positions: number[]; indices: number[]; }
export const CURRENT_SAMPLE_COUNT = 12;
export const CURRENT_TRAVEL = .825;
export const CURRENT_LAYOUT = {
  sea: { minX: 4, maxX: 97, minZ: 8, maxZ: 55, bottom: .8, top: 8.5 },
  coast: [[4, 8], [18, 8], [20, 18], [17.5, 31], [20.5, 43], [18, 55], [4, 55]] as [number, number][],
  track: { start: [12, 1, 66] as CurrentPoint, end: [88, 1, 66] as CurrentPoint },
  labels: [[14, -8, 69], [50, -8, 69], [86, -8, 69]] as CurrentPoint[],
  waveCenter: [78, 21, 54] as CurrentPoint,
  waveLabel: [78, 30, 54] as CurrentPoint,
} as const;
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const cubic = (t: number): CurrentPoint => {
  const u = 1 - t;
  return [25 * u ** 3 + 3 * 46 * u * u * t + 3 * 63 * u * t * t + 89 * t ** 3,
    9.05, 45 * u ** 3 + 3 * 43 * u * u * t + 3 * 32 * u * t * t + 16 * t ** 3];
};
const route = Array.from({ length: 257 }, (_, i) => cubic(i / 256));
const lengths = [0];
for (let i = 1; i < route.length; i++) lengths.push(lengths[i - 1] + Math.hypot(...route[i].map((value, axis) => value - route[i - 1][axis])));
export const CURRENT_PATH_LENGTH = lengths.at(-1)!;

/** One open, arc-length-parametrized route. No renderer owns a second route,
 * and no token wraps from the end back to its starting position. */
export function currentPathPoint(input: number, lane = 0): CurrentPoint {
  const distance = clamp(input) * CURRENT_PATH_LENGTH;
  let low = 0, high = lengths.length - 1;
  while (high - low > 1) { const mid = Math.floor((low + high) / 2); if (lengths[mid] <= distance) low = mid; else high = mid; }
  const a = route[low], z = route[high], span = lengths[high] - lengths[low];
  const mix = span ? (distance - lengths[low]) / span : 0;
  const dx = z[0] - a[0], dz = z[2] - a[2], len = Math.hypot(dx, dz) || 1;
  const offset = Number.isFinite(lane) ? lane : 0;
  return [a[0] + dx * mix - dz / len * offset, 9.05, a[2] + dz * mix + dx / len * offset];
}
export function currentPathTangent(input: number): CurrentPoint {
  const p = clamp(input), a = currentPathPoint(Math.max(0, p - .0001)), b = currentPathPoint(Math.min(1, p + .0001));
  const dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz) || 1;
  return [dx / length, 0, dz / length];
}
export const CURRENT_SAMPLES = Array.from({ length: CURRENT_SAMPLE_COUNT }, (_, index) => {
  const row = index % 4, laneIndex = Math.floor(index / 4), lane = (laneIndex - 1) * 3;
  const startProgress = .02 + row * .045, endProgress = startProgress + CURRENT_TRAVEL;
  return Object.freeze({ id: `current-water-${index}`, index, lane, laneIndex, row, startProgress, endProgress,
    color: index === 0 ? '#b78d58' : ['#648f99', '#789fa5', '#8eaeb0'][laneIndex],
    origin: currentPathPoint(startProgress, lane), destination: currentPathPoint(endProgress, lane) });
});

/** The small comparison reuses the established ideal-wave particle, including
 * its exact cycle endpoint. It is a kinematic reference, not a second current. */
export function currentWaveComparisonPoint(phase: number): CurrentPoint {
  const state = evaluateWave(phase, 1), point = waveParticleAt(state, WAVE_GEOMETRY.particleRestX);
  return [CURRENT_LAYOUT.waveCenter[0] + (point.x - WAVE_GEOMETRY.particleRestX) * .48,
    CURRENT_LAYOUT.waveCenter[1] + (point.height - WAVE_GEOMETRY.meanHeight) * .48,
    CURRENT_LAYOUT.waveCenter[2]];
}
export const CURRENT_WAVE_ORBIT = Array.from({ length: 97 }, (_, i) => currentWaveComparisonPoint(i / 96));

export function evaluateOceanCurrent(input: number) {
  const phase = clamp(input), stageIndex = phase < .25 ? 0 : phase < .75 ? 1 : 2;
  const stage = (['origin', 'advecting', 'retained-position'] as const)[stageIndex];
  const caption = stageIndex === 0 ? '标记同一组水体，记住它们的起点。'
    : stageIndex === 1 ? '同一组水体整体沿一定方向前移。'
      : phase === 1 ? '保留同一组水体的末位置，与起点对照。' : '水体继续前移，可随时暂停并与起点对照。';
  const samples = CURRENT_SAMPLES.map(sample => {
    const progress = sample.startProgress + CURRENT_TRAVEL * phase, point = currentPathPoint(progress, sample.lane);
    return { ...sample, progress, point, position: point, tangent: currentPathTangent(progress),
      displacement: point.map((value, i) => value - sample.origin[i]) as CurrentPoint,
      traveledPathFraction: CURRENT_TRAVEL * phase, retained: true, endpointReached: phase === 1 };
  });
  const wavePoint = currentWaveComparisonPoint(phase), waveOrigin = currentWaveComparisonPoint(0);
  const tracked = samples[0];
  const trace = Array.from({ length: 65 }, (_, i) => currentPathPoint(tracked.startProgress + CURRENT_TRAVEL * phase * i / 64, tracked.lane));
  return { phase, stage, stageIndex, selection: stageIndex, activeStop: stageIndex, caption,
    phaseMeaning: 'uncalibrated-observation-progress' as const, phaseIsCalibratedTime: false,
    samples, sampleCount: CURRENT_SAMPLE_COUNT, retainedCount: CURRENT_SAMPLE_COUNT,
    trackedSampleId: tracked.id, trace, direction: 'along-one-open-path' as const,
    complete: phase === 1, wraps: false, respawns: false,
    notGeoreferenced: true, actualCoastline: false, actualTrajectory: false, namedCurrent: null,
    measuredSpeed: false, measuredTemperature: false, arrivalDates: false, globalClosedCirculation: false,
    comparison: { kind: 'ideal-wave-closed-orbit' as const, source: WAVE_REFERENCE,
      point: wavePoint, origin: waveOrigin, displacement: wavePoint.map((value, i) => value - waveOrigin[i]) as CurrentPoint,
      closedOrbit: true, endpointReturnsToOrigin: true, oceanCurrentUsesThisOrbit: false,
      currentNetDisplacement: tracked.displacement, sameCalibratedDuration: false },
  };
}
export type OceanCurrentState = ReturnType<typeof evaluateOceanCurrent>;

function prism(footprint: readonly [number, number][], bottom: number, top: number): CurrentMeshData {
  const positions: number[] = [], indices: number[] = [], count = footprint.length;
  for (const y of [bottom, top]) for (const [x, z] of footprint) positions.push(x, y, z);
  for (let i = 1; i < count - 1; i++) indices.push(0, i, i + 1, count, count + i + 1, count + i);
  for (let i = 0; i < count; i++) { const next = (i + 1) % count; indices.push(i, i + count, next, next, i + count, next + count); }
  return { positions, indices };
}
export const currentSeaMesh = () => prism([[4, 8], [97, 8], [97, 55], [4, 55]], .8, 8.5);
export const currentCoastMesh = () => prism(CURRENT_LAYOUT.coast, .8, 12.8);
/** A closed thin paper ribbon is solely a teaching guide to the local flow. */
export function currentRibbonMesh(): CurrentMeshData {
  const positions: number[] = [], indices: number[] = [], segments = 64;
  for (let i = 0; i <= segments; i++) {
    const left = currentPathPoint(i / segments, -5.3), right = currentPathPoint(i / segments, 5.3);
    positions.push(left[0], 8.62, left[2], right[0], 8.62, right[2], left[0], 8.78, left[2], right[0], 8.78, right[2]);
    if (i < segments) {
      const k = i * 4;
      indices.push(k, k + 4, k + 1, k + 1, k + 4, k + 5,
        k + 2, k + 3, k + 6, k + 3, k + 7, k + 6,
        k, k + 2, k + 4, k + 2, k + 6, k + 4,
        k + 1, k + 5, k + 3, k + 3, k + 5, k + 7);
    }
  }
  const end = segments * 4;
  indices.push(0, 1, 2, 1, 3, 2, end, end + 2, end + 1, end + 1, end + 2, end + 3);
  return { positions, indices };
}

export function currentProject([x, y, z]: CurrentPoint): [number, number] {
  return [35 + x * 5.7 + (z - 32) * .4, 300 - y * 4.2 + (z - 32) * 1.6];
}
const n = (value: number) => Number(value.toFixed(5));
const xy = (point: CurrentPoint) => currentProject(point).map(n).join(',');
const polygon = (points: CurrentPoint[], color: string, width = .9) => `<polygon points="${points.map(xy).join(' ')}" fill="${color}" stroke="#647d7b" stroke-width="${width}"/>`;
const line = (points: CurrentPoint[], color = '#708a88', width = .9) => `<polyline points="${points.map(xy).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
const svgPoint = (point: CurrentPoint, radius: number, color: string, attrs = '') => {
  const [x, y] = currentProject(point); return `<ellipse ${attrs} cx="${n(x)}" cy="${n(y)}" rx="${radius}" ry="${n(radius * .67)}" fill="${color}" stroke="#596e6a" stroke-width="1.1"/>`;
};
/** All water marks, the optional wave reference and the open route are native
 * vector geometry. No satellite image is sampled into the supplemental model. */
export function oceanCurrentSvg(phase: number): string {
  const state = evaluateOceanCurrent(phase), sea = CURRENT_LAYOUT.sea;
  let body = polygon([[4, sea.top, 8], [97, sea.top, 8], [97, sea.top, 55], [4, sea.top, 55]], '#a9c8cb')
    + polygon([[4, sea.bottom, 55], [97, sea.bottom, 55], [97, sea.top, 55], [4, sea.top, 55]], '#9bb9be')
    + polygon([[97, sea.bottom, 55], [97, sea.bottom, 8], [97, sea.top, 8], [97, sea.top, 55]], '#90afb5');
  body += polygon(CURRENT_LAYOUT.coast.map(([x, z]) => [x, 12.8, z] as CurrentPoint), '#c7bea0');
  body += polygon([[4, .8, 55], [18, .8, 55], [18, 12.8, 55], [4, 12.8, 55]], '#b8aa8d');
  const ribbon = [...Array.from({ length: 65 }, (_, i) => { const p = currentPathPoint(i / 64, -5.3); return [p[0], 8.8, p[2]] as CurrentPoint; }),
    ...Array.from({ length: 65 }, (_, i) => { const p = currentPathPoint(1 - i / 64, 5.3); return [p[0], 8.8, p[2]] as CurrentPoint; })];
  body += polygon(ribbon, '#a1c0c2', .45);
  for (const t of [.38, .73]) {
    const c = currentPathPoint(t), tangent = currentPathTangent(t), side: CurrentPoint = [-tangent[2], 0, tangent[0]];
    body += line([[c[0] - tangent[0] * 2 + side[0], 9.0, c[2] - tangent[2] * 2 + side[2]], c,
      [c[0] - tangent[0] * 2 - side[0], 9.0, c[2] - tangent[2] * 2 - side[2]]], '#507e89', 1.4);
  }
  const tracked = state.samples[0];
  body += `<g data-current-origin="${tracked.id}" data-model-selection="0" role="button" tabindex="0" aria-label="回到这组水体的起点">${svgPoint(tracked.origin, 9, '#f0ead9')}</g>`;
  body += `<g data-current-destination="${tracked.id}" data-model-selection="2" role="button" tabindex="0" aria-label="查看这组水体的末位置">${svgPoint(tracked.destination, 9, '#cbd4c6')}</g>`;
  body += line(state.trace, '#a37d4c', 1.1);
  for (const sample of state.samples) body += `<g data-current-sample="${sample.id}" data-current-progress="${sample.progress}" data-position='${JSON.stringify(sample.point)}' data-model-selection="1" role="button" tabindex="0" aria-label="追踪同一组定向前移的水体">${svgPoint(sample.point, sample.index === 0 ? 6.8 : 5.3, sample.color)}</g>`;
  body += line(CURRENT_WAVE_ORBIT, '#96866c', 1);
  const [wx, wy] = currentProject(state.comparison.point);
  body += `<circle data-current-wave-reference="true" data-position='${JSON.stringify(state.comparison.point)}' cx="${n(wx)}" cy="${n(wy)}" r="4.2" fill="#c6ac7c" stroke="#806f52" stroke-width="1"/>`;
  const [wlx, wly] = currentProject(CURRENT_LAYOUT.waveLabel);
  body += `<text x="${n(wlx)}" y="${n(wly)}" text-anchor="middle" font-size="25" fill="#374444" paint-order="stroke" stroke="#f7f1e3" stroke-width="4">往复参照</text>`;
  body += line([CURRENT_LAYOUT.track.start, CURRENT_LAYOUT.track.end], '#a59b85', 1.2);
  const handle: CurrentPoint = [12 + 76 * state.phase, 1, 66], [hx, hy] = currentProject(handle);
  body += `<path data-current-handle="true" d="M${n(hx - 9)} ${n(hy)}l9-6 9 6-9 6Z" fill="#e1d1ab" stroke="#8e8064" stroke-width="1.2"/>`;
  CURRENT_STOPS.forEach((stop, i) => {
    const [x, y] = currentProject(CURRENT_LAYOUT.labels[i]);
    body += `<g data-current-node="${i}" data-model-selection="${i}" role="button" tabindex="0" aria-label="${stop.label}"><text x="${n(x)}" y="${n(y)}" text-anchor="middle" font-size="25" fill="#374444" paint-order="stroke" stroke="#f7f1e3" stroke-width="4">${stop.label}</text></g>`;
  });
  const diagnostics = JSON.stringify({ phase: state.phase, stageIndex: state.stageIndex, samples: state.samples.map(sample => ({ id: sample.id, progress: sample.progress, point: sample.point })), comparison: { point: state.comparison.point, closedOrbit: true } });
  return `<svg xmlns="http://www.w3.org/2000/svg" class="flat-model-svg flat-explanation-svg" viewBox="0 0 700 430" role="group" data-current-phase="${state.phase}" data-current-stage="${state.stage}" data-current-state='${diagnostics}' data-current-not-georeferenced="true" aria-label="${state.caption} 局部海域教学示意，不是实际海岸或实测洋流路径。小圆轨道为理想波浪同一水质点的往复参照。"><title>洋流：追踪同一组定向前移的水体</title><g stroke-linejoin="round" stroke-linecap="round" font-family="FieldSerif,SimSun,serif">${body}</g></svg>`;
}

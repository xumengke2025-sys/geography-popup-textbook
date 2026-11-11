/** PEP Geography I, printed p.104 / PDF p.109, visually checked.
 * A cutaway makes invisible cold air legible. Coordinates and the relative
 * warmth indicator are teaching settings, never a forecast or thermometer. */
export type ColdWavePoint = readonly [number, number, number];
export interface ColdWaveMesh { positions: number[]; indices: number[] }
export type ColdWaveStage = 'before' | 'approaching' | 'arriving' | 'covered';
export const COLD_WAVE_STOPS = [
  { label: '到来前', phase: 0, selection: 0 },
  { label: '接近观察点', phase: .35, selection: 1 },
  { label: '到达观察点', phase: .62, selection: 2 },
  { label: '推进后', phase: 1, selection: 3 },
] as const;
export const COLD_WAVE_REFERENCE = {
  textbookPages: [104], pdfPages: [109], source: 'textbook/page-109.webp', figures: ['6.7', '6.8'],
  concept: '强冷空气入侵与同一地点降温、大风的联系',
  airVolumeIsTeachingCutaway: true, coldAirIsActuallyVisible: false,
  temperatureIsQualitative: true, measuredTemperature: false, measuredWindSpeed: false,
  measuredTime: false, realGeographicDirection: false, forecast: false,
  frostGuaranteed: false, cropDamageGuaranteed: false, snowGuaranteed: false,
  reproducesPhotographedDisaster: false,
} as const;
export const COLD_WAVE_LAYOUT = {
  ground: 3, sourceX: 3, frontStart: 26, frontEnd: 99, wedgeRamp: 23, wedgeHeight: 17,
  farZ: 21, nearZ: 71, observation: [61, 3, 65] as ColdWavePoint,
  flagAnchor: [61, 28, 65] as ColdWavePoint,
  gauge: { x: 61, z: 68, bottom: 6, top: 22 },
  // Keep the moving pull-tab in a foreground lane below the fixed warmth
  // gauge, so it never sweeps across its cold/warm labels during a seek.
  track: { start: [26, -3, 86] as ColdWavePoint, end: [99, -3, 86] as ColdWavePoint },
  bounds: { min: [-7, -8, 9] as ColdWavePoint, max: [112, 42, 90] as ColdWavePoint },
} as const;
export const COLD_WAVE_LABELS = [
  { text: '冷空气', at: [17, 29, 29] as ColdWavePoint, width: 27, height: 9, selection: 1 },
  { text: '同一观察点', at: [63, 36, 65] as ColdWavePoint, width: 34, height: 8, selection: 2 },
  { text: '暖', at: [68, 22, 69] as ColdWavePoint, width: 8.6, height: 7.5, selection: 3 },
  { text: '冷', at: [68, 6, 69] as ColdWavePoint, width: 8.6, height: 7.5, selection: 3 },
] as const;
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const point = (a: ColdWavePoint, b: ColdWavePoint, t: number): ColdWavePoint => a.map((n, i) => mix(n, b[i], t)) as unknown as ColdWavePoint;
const colorMix = (a: string, b: string, t: number) => '#' + [0, 1, 2].map(i =>
  Math.round(mix(parseInt(a.slice(1 + i * 2, 3 + i * 2), 16), parseInt(b.slice(1 + i * 2, 3 + i * 2), 16), t)).toString(16).padStart(2, '0')).join('');

export function coldWavePrism(outline: readonly (readonly [number, number])[], bottom: number, top: number): ColdWaveMesh {
  const positions: number[] = [], indices: number[] = [], n = outline.length;
  for (const y of [bottom, top]) for (const [x, z] of outline) positions.push(x, y, z);
  for (let i = 1; i < n - 1; i++) indices.push(0, i, i + 1, n, n + i + 1, n + i);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; indices.push(i, n + i, n + j, i, n + j, j); }
  return { positions, indices };
}
export const coldWaveBox = (a: ColdWavePoint, b: ColdWavePoint) => coldWavePrism(
  [[a[0], a[2]], [b[0], a[2]], [b[0], b[2]], [a[0], b[2]]], a[1], b[1]);
const merge = (parts: readonly ColdWaveMesh[]): ColdWaveMesh => {
  const positions: number[] = [], indices: number[] = [];
  for (const part of parts) { const offset = positions.length / 3; positions.push(...part.positions); indices.push(...part.indices.map(i => i + offset)); }
  return { positions, indices };
};
function roof(): ColdWaveMesh {
  return { positions: [77, 11, 30, 89, 11, 30, 83, 17, 30, 77, 11, 40, 89, 11, 40, 83, 17, 40],
    indices: [0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3] };
}
export const COLD_WAVE_PARTS = [
  { id: 'land-base', color: '#c4b498', mesh: coldWavePrism([[5, 18], [92, 18], [98, 24], [98, 66], [92, 72], [5, 72], [1, 68], [1, 24]], -1, 3) },
  { id: 'field-bed', color: '#acb69a', mesh: coldWaveBox([28, 3.03, 46], [85, 3.38, 63]) },
  { id: 'house', color: '#efe8d7', mesh: coldWaveBox([78, 3, 31], [88, 11.1, 39]) },
  { id: 'roof', color: '#a77a64', mesh: roof() },
  { id: 'door', color: '#9e9b86', mesh: coldWaveBox([82, 3.02, 39.03], [84, 8, 39.24]) },
  { id: 'pole', color: '#9c8d70', mesh: coldWaveBox([60.72, 3, 64.72], [61.28, 28.7, 65.28]) },
  { id: 'gauge-case', color: '#f0ebdc', mesh: coldWaveBox([58.7, 5, 67.4], [63.3, 24, 68.1]) },
  { id: 'gauge-channel', color: '#b9b9ac', mesh: coldWaveBox([60.46, 6, 68.15], [61.54, 22.8, 68.32]) },
] as const;
export const COLD_WAVE_PLANTS = [46, 52, 58, 68, 75].map((x, id) => ({ id, base: [x, 3.38, 58 + (id % 2) * 2.4] as ColdWavePoint, height: 10 + id % 3 }));
export function coldAirDepthAt(x: number, frontX: number): number {
  return COLD_WAVE_LAYOUT.wedgeHeight * smooth((frontX - x) / COLD_WAVE_LAYOUT.wedgeRamp);
}
export function coldWaveLocalResponse(x: number, frontX: number) {
  const behindFront = frontX - x, coldFraction = smooth(behindFront / COLD_WAVE_LAYOUT.wedgeRamp);
  return { arrived: behindFront > 0, coldFraction, warmth: 1 - coldFraction * .76,
    wind: .9 * smooth(behindFront / 13), coldDepth: coldAirDepthAt(x, frontX) };
}
/** A shallow, closed wedge: its top slopes down into a zero-height nose. */
export function coldWaveWedgeMesh(frontX: number, segments = 20): ColdWaveMesh {
  const l = COLD_WAVE_LAYOUT, positions: number[] = [], indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const x = mix(l.sourceX, frontX, i / segments), h = coldAirDepthAt(x, frontX), y = l.ground + .12;
    positions.push(x, y, l.farZ, x, y + h, l.farZ, x, y + h, l.nearZ, x, y, l.nearZ);
    if (i < segments) for (let j = 0; j < 4; j++) { const a = i * 4 + j, b = i * 4 + (j + 1) % 4; indices.push(a, b, b + 4, a, b + 4, a + 4); }
  }
  indices.push(0, 3, 2, 0, 2, 1); const end = segments * 4;
  indices.push(end, end + 1, end + 2, end, end + 2, end + 3);
  return { positions, indices };
}
function flagMesh(phase: number, wind: number, segments = 10) {
  const anchor = COLD_WAVE_LAYOUT.flagAnchor, positions: number[] = [], indices: number[] = [];
  const surface = (u: number, v: number): ColdWavePoint => [anchor[0] + u * (1.3 + 12 * wind),
    anchor[1] - .7 - v * 4.1 - (1 - wind) * 6 * u - wind * .65 * Math.sin(u * Math.PI),
    anchor[2] + wind * .65 * Math.sin(u * 7 - phase * 8) * u];
  for (let i = 0; i <= segments; i++) {
    for (const [v, side] of [[1, -.09], [0, -.09], [0, .09], [1, .09]]) {
      const p = surface(i / segments, v); positions.push(p[0], p[1], p[2] + side);
    }
    if (i < segments) for (let j = 0; j < 4; j++) { const a = i * 4 + j, b = i * 4 + (j + 1) % 4; indices.push(a, b, b + 4, a, b + 4, a + 4); }
  }
  const end = segments * 4; indices.push(0, 3, 2, 0, 2, 1, end, end + 1, end + 2, end, end + 2, end + 3);
  return { mesh: { positions, indices }, tip: surface(1, .5), anchor, extension: 1.3 + 12 * wind, droop: (1 - wind) * 6 };
}
function plantMesh(base: ColdWavePoint, height: number, wind: number) {
  const points = Array.from({ length: 7 }, (_, i): ColdWavePoint => {
    const t = i / 6; return [base[0] + 4.6 * wind * t * t, base[1] + height * t * (1 - .06 * wind * t), base[2]];
  });
  const positions: number[] = [], indices: number[] = [], sides = 6;
  for (let i = 0; i < points.length; i++) {
    const [x, y, z] = points[i];
    for (let j = 0; j < sides; j++) positions.push(x + .17 * Math.cos(j / sides * Math.PI * 2), y, z + .17 * Math.sin(j / sides * Math.PI * 2));
    if (i < points.length - 1) for (let j = 0; j < sides; j++) { const a = i * sides + j, b = i * sides + (j + 1) % sides; indices.push(a, b + sides, b, a, a + sides, b + sides); }
  }
  for (let j = 1; j < sides - 1; j++) { indices.push(0, j, j + 1); const k = (points.length - 1) * sides; indices.push(k, k + j + 1, k + j); }
  const leaves = [-1, 1].map((direction, i) => {
    const at = points[i + 3], tip: ColdWavePoint = [at[0] + direction * 3.5 + wind * 1.2, at[1] + 2 - wind * .8, at[2] + direction * 1.1];
    const middle = point(at, tip, .52);
    return { positions: [...at, middle[0], middle[1], middle[2] - .8, ...tip, middle[0], middle[1], middle[2] + .8], indices: [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2] };
  });
  return { mesh: merge([{ positions, indices }, ...leaves]), points, top: points[points.length - 1], lean: 4.6 * wind };
}
function flowMesh(frontX: number, z: number) {
  const start = frontX - 23, end = frontX - 10, width = .48;
  return coldWavePrism([[start, z - width], [end - 2.9, z - width], [end - 2.9, z - 1.55], [end, z],
    [end - 2.9, z + 1.55], [end - 2.9, z + width], [start, z + width]], 4.1, 4.55);
}
export function evaluateColdWave(input: number) {
  const l = COLD_WAVE_LAYOUT, phase = clamp(input), frontX = mix(l.frontStart, l.frontEnd, phase);
  const arrivalPhase = (l.observation[0] - l.frontStart) / (l.frontEnd - l.frontStart);
  const stageIndex = phase < .22 ? 0 : phase <= arrivalPhase ? 1 : phase < .8 ? 2 : 3;
  const stages: ColdWaveStage[] = ['before', 'approaching', 'arriving', 'covered'];
  const local = coldWaveLocalResponse(l.observation[0], frontX), flag = flagMesh(phase, local.wind);
  const plants = COLD_WAVE_PLANTS.map(plant => ({ ...plant, ...coldWaveLocalResponse(plant.base[0], frontX),
    ...plantMesh(plant.base, plant.height, coldWaveLocalResponse(plant.base[0], frontX).wind), healthy: true }));
  const level = .88 - .65 * local.coldFraction, fillTop = mix(l.gauge.bottom, l.gauge.top, level);
  const indicatorColor = colorMix('#bd8b64', '#7198a9', local.coldFraction);
  const front: ColdWavePoint = [frontX, l.ground + .12, l.nearZ];
  const handle = point(l.track.start, l.track.end, phase);
  const text = [
    '先看同一观察点：风旗垂下，冷热柱尚未下降。',
    '前缘接近，沿途植株开始轻弯；观察点还未降温。',
    '前缘越过观察点，风旗伸展，冷热柱随之下降。',
    '同一观察点已降温，保留结果，可回拖比较。',
  ][stageIndex];
  return { kind: 'cold-wave' as const, phase, stage: stages[stageIndex], stageIndex, selection: stageIndex,
    caption: COLD_WAVE_STOPS[stageIndex].label, text, advance: phase, advancing: phase > 0 && phase < 1,
    frontX, front, arrivalPhase, observation: { point: l.observation, ...local, level, fillTop, indicatorColor },
    flag, plants, handle, geometry: { wedge: coldWaveWedgeMesh(frontX), flag: flag.mesh,
      gaugeFill: coldWaveBox([60.63, l.gauge.bottom, 68.35], [61.37, fillTop, 68.52]),
      flows: [31, 45, 58].map(z => flowMesh(frontX, z)) },
    units: 'qualitative-teaching-model' as const, endpointRetained: phase === 1, cyclic: false,
    schematicDirection: true, definedByActualCoolingThreshold: false, cropDamageGuaranteed: false,
    frostGuaranteed: false, measuredTemperature: false, measuredWindSpeed: false, forecast: false,
    source: COLD_WAVE_REFERENCE, reference: COLD_WAVE_REFERENCE };
}
export type ColdWaveState = ReturnType<typeof evaluateColdWave>;
const num = (n: number) => Number(n.toFixed(3));
export function coldWaveProject([x, y, z]: ColdWavePoint): readonly [number, number] {
  return [num(60 + x * 4.55 + (z - 45) * .93), num(306 - y * 4.15 + (z - 45) * 1.38)];
}
/** Native vector cutaway from the same vertices, including the responding
 * cloth, plants and the qualitative indicator; no screenshot or raster art. */
export function coldWaveSvg(phase: number, _selection?: number): string {
  const s = evaluateColdWave(phase), polygon = (points: readonly ColdWavePoint[]) => points.map(p => coldWaveProject(p).join(',')).join(' ');
  const scene: string[] = [];
  const draw = (mesh: ColdWaveMesh, color: string, role: string, selection?: number, opacity = 1) => {
    const faces: { points: ColdWavePoint[]; depth: number; shade: number }[] = [];
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const points = mesh.indices.slice(i, i + 3).map(j => mesh.positions.slice(j * 3, j * 3 + 3) as unknown as ColdWavePoint);
      const [a, b, c] = points, u = b.map((n, k) => n - a[k]), v = c.map((n, k) => n - a[k]);
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      if (-3.8 * n[0] + 6.3 * n[1] + 20 * n[2] <= 1e-7) continue;
      faces.push({ points, depth: points.reduce((sum, p) => sum + p[2] + p[1] * .31 - p[0] * .12, 0), shade: n[1] > 0 ? 0 : .1 });
    }
    const attrs = selection === undefined ? '' : ` data-model-selection="${selection}" tabindex="0" role="button" aria-label="观察${COLD_WAVE_STOPS[selection].label}"`;
    scene.push(`<g data-cold-wave-part="${role}"${attrs} opacity="${opacity}">${faces.sort((a, b) => a.depth - b.depth).map(f =>
      `<polygon points="${polygon(f.points)}" fill="${colorMix(color, '#626c65', f.shade)}" stroke="${opacity < 1 ? '#6e929c' : '#7a8071'}" stroke-width=".55" stroke-linejoin="round"/>`).join('')}</g>`);
  };
  for (const part of COLD_WAVE_PARTS.filter(p => p.id === 'land-base' || p.id === 'field-bed')) draw(part.mesh, part.color, part.id, 0);
  draw(s.geometry.wedge, '#a7c0cd', 'cold-air-wedge', 1, .4);
  for (const [i, mesh] of s.geometry.flows.entries()) draw(mesh, '#739aa4', `flow-${i}`, 1);
  for (const part of COLD_WAVE_PARTS.filter(p => p.id !== 'land-base' && p.id !== 'field-bed')) draw(part.mesh, part.color, part.id, part.id.startsWith('gauge') ? 3 : 0);
  for (const plant of s.plants) draw(plant.mesh, '#7f9575', `plant-${plant.id}`, 2);
  draw(s.geometry.gaugeFill, s.observation.indicatorColor, 'relative-warmth', 3);
  draw(s.geometry.flag, '#bc8a6a', 'wind-flag', 2);
  const frontTop = Array.from({ length: 21 }, (_, i): ColdWavePoint => {
    const x = mix(COLD_WAVE_LAYOUT.sourceX, s.frontX, i / 20);
    return [x, COLD_WAVE_LAYOUT.ground + .12 + coldAirDepthAt(x, s.frontX), COLD_WAVE_LAYOUT.nearZ];
  });
  scene.push(`<polyline points="${polygon(frontTop)}" fill="none" stroke="#6f909a" stroke-width="1.7" stroke-linejoin="round"/>`);
  for (const label of COLD_WAVE_LABELS) {
    const [x, y] = coldWaveProject(label.at), width = Math.max(label.width * 4.1, label.text.length * 30 + 14);
    scene.push(`<g data-model-selection="${label.selection}" tabindex="0" role="button" aria-label="观察${COLD_WAVE_STOPS[label.selection].label}"><rect x="${num(x - width / 2)}" y="${num(y - 25)}" width="${num(width)}" height="46" rx="1.5" fill="#f7f2e5"/><text x="${x}" y="${num(y + 10)}" text-anchor="middle" font-size="30" fill="#475b57">${label.text}</text></g>`);
  }
  const [hx, hy] = coldWaveProject(s.handle), [fx, fy] = coldWaveProject(s.front);
  scene.push(`<path d="M${fx} ${fy}L${hx} ${hy - 25}" fill="none" stroke="#7a8b82" stroke-width="1"/><g data-cold-wave-part="front-pull-tab" data-phase="${s.phase}" data-model-selection="2" tabindex="0" role="button" aria-label="定位到冷空气到达观察点"><rect x="${hx - 38}" y="${hy - 25}" width="76" height="46" rx="1.5" fill="#e2d3b4" stroke="#a5997f"/><text x="${hx}" y="${hy + 10}" text-anchor="middle" font-size="30" fill="#475b57">前缘</text></g>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" class="flat-model-svg cold-wave-svg" viewBox="0 0 640 430" role="img" aria-label="冷空气推进后同一观察点降温与风响应的立体剖面示意，冷热与方向均为教学示意" data-kind="cold-wave" data-phase="${s.phase}" data-stage="${s.stage}" data-selection="${s.selection}" data-front-x="${num(s.frontX)}" data-warmth="${num(s.observation.warmth)}"><title>同一观察点：${s.caption}</title>${scene.join('')}</svg>`;
}

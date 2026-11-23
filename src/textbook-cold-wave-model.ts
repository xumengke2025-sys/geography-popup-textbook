import { drawingGrip } from './textbook-drawing-grip';
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
  const across = 6, stride = 2*(across+1);
  for (let i = 0; i <= segments; i++) {
    const x = mix(l.sourceX, frontX, i/segments), depth = coldAirDepthAt(x, frontX), floor = l.ground + .12;
    for (const top of [true, false]) for (let j=0; j<=across; j++) {
      const v = top ? j/across : 1-j/across;
      const wave = Math.sin(Math.PI*v)*(.051*Math.sin(x*.13+v*3.5)+.039*Math.sin(x*.27-v*6.3));
      positions.push(x, floor+(top ? depth*(1+wave) : 0), mix(l.farZ,l.nearZ,v));
    }
    if (i < segments) for (let j=0;j<stride;j++) {
      const a = i*stride+j, b = i*stride+(j+1)%stride;
      indices.push(a,b,b+stride,a,b+stride,a+stride);
    }
  }
  for (let j=0;j<across;j++) {
    const a=j,b=j+1,c=stride-2-j,d=stride-1-j,end=segments*stride;
    indices.push(a,d,c,a,c,b, end+a,end+b,end+c,end+a,end+c,end+d);
  }
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
  const leaves = Array.from({length:6},(_,i)=>{
    const side = i%2===0 ? -1 : 1, at=points[i], reach=(4.2-i*.32);
    const vertices:number[]=[], faces:number[]=[];
    // Two folded leaf blades meet along a midrib. The base follows the stalk
    // and the elastic deflection increases toward the drooping tip.
    for (let j=0;j<=5;j++) {
      const u=j/5, fold=Math.sin(Math.PI*u);
      const x=at[0]+(side*reach+wind*1.9)*u, y=at[1]+3.4*Math.sin(u*2.22)-wind*.83*u*u;
      const z=at[2]+side*(i%3===0?-1:1)*u*1.64;
      vertices.push(x,y-fold*.38,z-fold*.58,x,y,z,x,y-fold*.32,z+fold*.58);
      if (j) {const k=3*j;faces.push(k-3,k,k-2,k-2,k,k+1,k-2,k+1,k-1,k-1,k+1,k+2);}
    }
    return { positions:vertices, indices:faces };
  });
  return { mesh: merge([{ positions, indices }, ...leaves]), points, top: points[points.length - 1], lean: 4.6 * wind };
}
function flowMesh(frontX: number, z: number) {
  const start = frontX - 23, end = frontX - 10, width = .48;
  const arrow=coldWavePrism([[start,z-width],[end-2.9,z-width],[end-2.9,z-1.55],[end,z],
    [end-2.9,z+1.55],[end-2.9,z+width],[start,z+width]],0,.42);
  // Place the suspended tracers inside the approaching air. Each arrow
  // descends with the local cold layer toward its narrowing leading edge.
  for(let i=0;i<arrow.positions.length;i+=3) {
    const depth=coldAirDepthAt(arrow.positions[i],frontX);
    arrow.positions[i+1]+=COLD_WAVE_LAYOUT.ground+.53+depth*(.28+(z-31)*.009);
  }
  return arrow;
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
      `<polygon points="${polygon(f.points)}" fill="${colorMix(color, '#626c65', f.shade)}" stroke="${opacity < 1 || role.startsWith('plant-') ? 'none' : colorMix(color,'#626c65',f.shade)}" stroke-width=".55" stroke-linejoin="round"/>`).join('')}</g>`);
  };
  for (const part of COLD_WAVE_PARTS.filter(p => p.id === 'land-base' || p.id === 'field-bed')) draw(part.mesh, part.color, part.id, 0);
  const underside = (z:number,offset:number) => Array.from({length:49},(_,i):ColdWavePoint => {
    const x=5+i*87/48;return [x,offset+.19*Math.sin(x*.26)+.079*Math.sin(x*.73),z];
  });
  const path=(points:readonly ColdWavePoint[],ink:string,width:number) =>
    `<polyline points="${polygon(points)}" stroke="${ink}" stroke-width="${width}" stroke-linejoin="round" fill="none"/>`;
  scene.push(path(underside(72,-.24),'#927759',1.1),path(underside(72,1.42),'#998368',1.7));
  for (let row=0;row<5;row++) {
    const z=48+3.12*row;
    scene.push(path([[29,3.44,z],[44,3.44,z+.21],[60,3.44,z],[84,3.44,z+.13]],'#8e8468',1.5));
  }
  draw(s.geometry.wedge, '#a7c0cd', 'cold-air-wedge', 1, .4);
  for (const [i, mesh] of s.geometry.flows.entries()) draw(mesh, '#739aa4', `flow-${i}`, 1);
  for (const part of COLD_WAVE_PARTS.filter(p => p.id === 'pole' || p.id.startsWith('gauge'))) draw(part.mesh, part.color, part.id, part.id.startsWith('gauge') ? 3 : 2);
  for (const x of [78.6,87.4]) for (const z of [31.2,38.8]) draw(coldWaveBox([x-.21,3,z-.21],[x+.21,6.6,z+.21]),'#cdc6ae','screen-leg',0);
  draw(coldWaveBox([78.2,6.6,30.9],[87.8,12.3,39.1]),'#ceccb9','house',0);
  for(let j=0;j<7;j++) {
    const y=7.1+j*.68;scene.push(path([[78.2,y,30.9],[78.2,y,39.2],[87.9,y,39.2]],'#808479',1.25));
  }
  const canopy=(y:number, ink:string) => {
    const top:ColdWavePoint[]=[[77.3,y,30],[88.7,y,30],[88.7,y+1.43,35],[77.3,y+1.43,35]];
    const slope:ColdWavePoint[]=[top[3],top[2],[88.7,y,40],[77.3,y,40]];
    scene.push(`<polygon points="${polygon(top)}" fill="${ink}" stroke="#64675b"/><polygon points="${polygon(slope)}" fill="${ink}" stroke="#64675b"/>`);
  };
  canopy(12.63,'#c9c5b3'); canopy(13.8,'#89958e');
  for (const plant of s.plants) draw(plant.mesh, '#7f9575', `plant-${plant.id}`, 2);
  draw(s.geometry.gaugeFill, s.observation.indicatorColor, 'relative-warmth', 3);
  draw(s.geometry.flag, '#bc8a6a', 'wind-flag', 2);
  const frontTop = Array.from({ length: 21 }, (_, i): ColdWavePoint => {
    const x = mix(COLD_WAVE_LAYOUT.sourceX, s.frontX, i / 20);
    return [x, COLD_WAVE_LAYOUT.ground + .12 + coldAirDepthAt(x, s.frontX), COLD_WAVE_LAYOUT.nearZ];
  });
  scene.push(`<polyline points="${polygon(frontTop)}" fill="none" stroke="#6f909a" stroke-width="1.7" stroke-linejoin="round"/>`);
  for (const label of COLD_WAVE_LABELS) {
    const [x,y]=coldWaveProject(label.at), width=label.text.length*19+19;
    scene.push(`<g class="cold-reading" data-model-selection="${label.selection}" tabindex="0" role="button" aria-label="观察${COLD_WAVE_STOPS[label.selection].label}"><rect x="${x-width/2}" y="${y-15}" width="${width}" height="28" rx="3" fill="#e7dfcc" style="--plate-left:${x-label.text.length*14.5-8}px;--plate-width:${label.text.length*29+16}px" stroke="#aa956c"/><text x="${x}" y="${y+6}" text-anchor="middle" font-size="18" fill="#494d40">${label.text}</text></g>`);
  }
  const [hx,hy]=coldWaveProject(s.handle), [fx,fy]=coldWaveProject(s.front);
  const [railStart]=coldWaveProject(COLD_WAVE_LAYOUT.track.start), [railEnd]=coldWaveProject(COLD_WAVE_LAYOUT.track.end);
  scene.push(`<g stroke="#837b65" stroke-width="3"><path d="M${railStart-6} ${hy-2}H${railEnd+6}m0 7H${railStart-6}"/></g>
    <path d="M${fx} ${fy}L${hx} ${hy-6}" stroke="#9d7550" stroke-width="2.4" fill="none"/>
    <g data-cold-wave-part="front-pull-tab" data-phase="${s.phase}" data-model-selection="2" tabindex="0" role="button" aria-label="定位到冷空气到达观察点">
      <rect x="${hx-15}" y="${hy-5}" width="30" height="12" rx="3" fill="#b39b65" stroke="#776447"/>
      <ellipse cx="${hx}" cy="${hy-5}" rx="11" ry="8" fill="#4b808b" stroke="#314f54"/><path d="M${hx-6} ${hy-7}q6-4 11 0" stroke="#acc2b7" fill="none"/></g>
    ${drawingGrip('推移冷空气前缘',coldWaveProject(COLD_WAVE_LAYOUT.track.start),coldWaveProject(COLD_WAVE_LAYOUT.track.end),s.phase)}`);
  const names=['到来前','接近','到达','推进后'];
  scene.push(`<rect x="53" y="392" width="524" height="32" rx="3" fill="#786248" stroke="#524431"/>`);
  names.forEach((name,i)=>{
    scene.push(`<g transform="translate(${126+i*126} 408)" data-specimen-key data-model-selection="${i}" tabindex="0" role="button" aria-label="${COLD_WAVE_STOPS[i].label}"><rect x="-53" y="-13" width="106" height="26" rx="2" fill="${i===s.selection?'#ddd1ab':'#e9e0c9'}" stroke="#aa986e"/><text text-anchor="middle" y="6" font-size="18" fill="#4b4436">${name}</text></g>`);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" class="flat-model-svg cold-wave-svg" viewBox="0 0 640 430" role="img" aria-label="冷空气推进后同一观察点降温与风响应的立体剖面示意，冷热与方向均为教学示意" data-kind="cold-wave" data-phase="${s.phase}" data-stage="${s.stage}" data-selection="${s.selection}" data-front-x="${num(s.frontX)}" data-warmth="${num(s.observation.warmth)}"><title>同一观察点：${s.caption}</title><style>@media(max-width:480px){.cold-wave-svg text{font-size:28px}.cold-reading rect{x:var(--plate-left);width:var(--plate-width)}}</style>${scene.join('')}</svg>`;
}

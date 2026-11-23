/** Textbook p.57 / PDF p.62, fig.3.20. A periodic deep-water wave is used
 * only to distinguish travelling shape from an individual water particle.
 * This Gerstner-type illustration omits wind, currents, breaking, Stokes
 * drift and near-shore changes. All lengths and the one-cycle phase are
 * schematic; the marker is a water-particle symbol, not a real buoy. */
export const WAVE_REFERENCE = Object.freeze({ textbookPage: 57, pdfPage: 62, figure: '3.20',
  quantities: 'schematic', model: 'ideal-periodic-deep-water', includesCurrent: false,
  includesBreaking: false, includesStokesDrift: false, markerIsRealBuoy: false });
export const WAVE_GEOMETRY = Object.freeze({ width: 100, depth: 38, meanHeight: 19,
  amplitude: 5.8, wavelength: 48, particleRestX: 57 });
export interface WavePoint { x: number; height: number }
export interface WaveState {
  phase: number;
  cyclePhase: number;
  selection: 0 | 1;
  amplitude: number;
  wavelength: number;
  waveHeight: number;
  meanHeight: number;
  direction: 1;
  particle: WavePoint;
  caption: string;
}
const TAU = Math.PI * 2, K = TAU / WAVE_GEOMETRY.wavelength;
const clamp = (n: number) => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
/** The same labelled material point follows a closed orbit. Depth is a
 * nonnegative distance below the mean surface; orbital radius decays down. */
export function waveParticleAt(state: Pick<WaveState, 'cyclePhase'>, restX: number, depth = 0): WavePoint {
  const d = Math.max(0, Number.isFinite(depth) ? depth : 0);
  const radius = WAVE_GEOMETRY.amplitude * Math.exp(-K * d);
  const angle = K * restX - TAU * state.cyclePhase;
  return { x: restX - radius * Math.sin(angle), height: WAVE_GEOMETRY.meanHeight - d + radius * Math.cos(angle) };
}
/** Invert the monotone surface material coordinate so the fixed cutaway
 * walls and the particle use exactly the same wave, including steep crests.
 * kA < 1 guarantees one root. Bracketing prevents overshoot at any phase. */
export function waveHeightAt(state: Pick<WaveState, 'cyclePhase'>, x: number): number {
  const a = WAVE_GEOMETRY.amplitude;
  let lo = x - a, hi = x + a;
  for (let i = 0; i < 40; i++) {
    const q = (lo + hi) * .5;
    if (waveParticleAt(state, q).x < x) lo = q; else hi = q;
  }
  return waveParticleAt(state, (lo + hi) * .5).height;
}
export function evaluateWave(input: number, selection = 0): WaveState {
  const phase = clamp(input), cyclePhase = phase === 1 ? 0 : phase;
  const state: WaveState = { phase, cyclePhase, selection: selection === 1 ? 1 : 0,
    amplitude: WAVE_GEOMETRY.amplitude, wavelength: WAVE_GEOMETRY.wavelength,
    waveHeight: WAVE_GEOMETRY.amplitude * 2, meanHeight: WAVE_GEOMETRY.meanHeight,
    direction: 1, particle: { x: 0, height: 0 },
    caption: selection === 1 ? '追踪同一水质点：它作闭合往复运动，波形继续向前。' : '波形向前传播；橙点表示同一水质点。' };
  state.particle = waveParticleAt(state, WAVE_GEOMETRY.particleRestX);
  return state;
}
/** Observation overlays keep both material identities at their own equilibrium
 * positions. The deeper orbit uses the same wave and its exponential decay. */
export function evaluateWaveInspection(input: number, target = 'overview') {
  const inspection = ['displacement', 'depth-pair'].includes(target) ? target : 'overview';
  const state = evaluateWave(input), restX = WAVE_GEOMETRY.particleRestX, depth = 8;
  const surface = { id: 'surface-water-point', depth: 0, rest: { x: restX, height: state.meanHeight }, point: state.particle,
    radius: state.amplitude };
  const deep = { id: 'deep-water-point', depth, rest: { x: restX, height: state.meanHeight - depth },
    point: waveParticleAt(state, restX, depth), radius: state.amplitude * Math.exp(-K * depth) };
  return { inspection, phase: state.phase, points: inspection === 'depth-pair' ? [surface, deep] : [surface],
    displacementVisible: inspection !== 'overview', depthsAreSchematic: true, changesWave: false };
}
/** A fixed projection, also used for SVG probe coordinates and its marker. */
export function waveProject(x: number, v: number, height: number): [number, number] {
  return [48 + x * 4.7 + (1 - v) * 65, 274 - height * 5.2 - (1 - v) * 44];
}
const fmt = (n: number) => Number(n.toFixed(6));
const pair = (point: [number, number]) => point.map(fmt).join(',');
export function waveSvg(phase: number, selection = 0, target = 'overview'): string {
  const state = evaluateWave(phase, selection), observation = evaluateWaveInspection(phase, target), nx = 128;
  // One inversion per X sample, shared by all depth strips and cut faces.
  // SVG mode can therefore play continuously without re-solving each cell.
  const heights = Array.from({ length: nx + 1 }, (_, i) => waveHeightAt(state, i / nx * 100));
  const colors = Array.from({ length: nx }, (_, i) => {
    const shade = Math.max(.76, Math.min(1.14, .99 - (heights[i + 1] - heights[i]) * .13));
    return `rgb(${[160, 202, 201].map(c => Math.round(c * shade)).join(',')})`;
  });
  const at = (x: number, v: number, height = heights[Math.round(x / 100 * nx)]) => waveProject(x, v, height);
  const front = Array.from({ length: nx + 1 }, (_, i) => at(i / nx * 100, 1));
  const back = Array.from({ length: nx + 1 }, (_, i) => at(i / nx * 100, 0));
  const right = [at(100, 0), at(100, 1), at(100, 1, 0), at(100, 0, 0)];
  const face = `M${front.map(pair).join('L')}L${pair(at(100,1,0))}L${pair(at(0,1,0))}Z`;
  let body = `<defs><linearGradient id="wave-cut" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#c0dcd4"/><stop offset=".42" stop-color="#8cb8b7"/><stop offset="1" stop-color="#537e86"/></linearGradient>
    <linearGradient id="wave-base" x2="0" y2="1"><stop stop-color="#d6c38d"/><stop offset=".26" stop-color="#ac9460"/><stop offset=".57" stop-color="#786544"/><stop offset="1" stop-color="#bda77c"/></linearGradient>
    <clipPath id="wave-cut-face"><path d="${face}"/></clipPath></defs>
    <path d="M48 274h470l65-44v5l-65 45H48Z" fill="url(#wave-base)" stroke="#77694e"/>
    <path d="M${right.map(pair).join('L')}Z" fill="#648e94" stroke="#435f67" stroke-width="1"/>
    <path d="${face}" fill="url(#wave-cut)" stroke="#435f67" stroke-width="1.1"/> `;
  // Material rows are photographed at the same phase as the marked particle.
  // The deeper rows flatten because their orbital excursions are smaller.
  body += '<g clip-path="url(#wave-cut-face)" fill="none">';
  for(const depth of [3,6,10,15]){
    const row=Array.from({length:91},(_,i)=>{
      const q=waveParticleAt(state,-8+i*1.3,depth);
      return pair(waveProject(q.x,1,q.height));
    });
    body+=`<path d="M${row.join('L')}" stroke="#d9e7da" opacity=".48" stroke-width=".95"/>`;
  }
  body+='</g>';
  // Projection is affine in depth. One strip for each X interval exactly
  // covers the former nine coplanar tiles and removes their raster seams.
  for(let i=0;i<nx;i++){
    body+=`<polygon points="${[back[i],back[i+1],front[i+1],front[i]].map(pair).join(' ')}" fill="${colors[i]}" stroke="${colors[i]}" stroke-width=".4"/>`;
  }
  for (const v of [0, .5, 1]) body += `<path d="M${(v === 0 ? back : v === 1 ? front : Array.from({ length: nx + 1 }, (_, i) => at(i / nx * 100, v))).map(pair).join('L')}" fill="none" stroke="#416b76" stroke-width="${v === 1 ? 1.6 : .8}"/>`;
  const rest = WAVE_GEOMETRY.particleRestX, marker = waveProject(state.particle.x, 1.008, state.particle.height);
  if (state.selection === 1) {
    const orbit = Array.from({ length: 97 }, (_, i) => { const point = waveParticleAt({ cyclePhase: i / 96 }, rest); return waveProject(point.x, 1.012, point.height); });
    const center = waveProject(rest, 1.012, state.meanHeight);
    body += `<path data-wave-orbit="closed" d="M${orbit.map(pair).join('L')}Z" fill="none" stroke="#a36548" stroke-width="1.45" stroke-dasharray="3 3"/><path d="M${fmt(center[0] - 3)},${fmt(center[1])}h6M${fmt(center[0])},${fmt(center[1] - 3)}v6" stroke="#a36548" stroke-width="1"/>`;
  }
  if (observation.displacementVisible) for (const sample of observation.points) {
    const rest = waveProject(sample.rest.x, 1.015, sample.rest.height), q = waveProject(sample.point.x, 1.015, sample.point.height);
    const corner = waveProject(sample.point.x, 1.015, sample.rest.height), orbit = Array.from({ length: 65 }, (_, i) => {
      const point = waveParticleAt({ cyclePhase: i / 64 }, sample.rest.x, sample.depth); return waveProject(point.x, 1.015, point.height);
    });
    body += `<g data-wave-displacement="${sample.id}"><path d="M${orbit.map(pair).join('L')}Z" fill="none" stroke="#a36548" stroke-width="1" stroke-dasharray="3 4"/><path d="M${pair(rest)}L${pair(corner)}L${pair(q)}" fill="none" stroke="#a36548" stroke-width="1.6"/><path d="M${fmt(rest[0] - 4)} ${fmt(rest[1])}h8m-4-4v8" stroke="#6e7365" stroke-width="1.2"/>${sample.depth ? `<circle data-wave-particle="deep" cx="${fmt(q[0])}" cy="${fmt(q[1])}" r="5.5" fill="#6b8d81" stroke="#405e5c"/>` : ''}</g>`;
  }
  body += `<path d="M102,59H245m-10,-7l10,7l-10,7" fill="none" stroke="#416b76" stroke-width="2"/><text x="174" y="40" text-anchor="middle" fill="#303a40" font-size="25" font-family="FieldSerif,SimSun,serif">波向前传播</text>`;
  body += `<g role="button" tabindex="0" data-model-inspection="displacement" data-model-inspection-toggle="overview" aria-pressed="${observation.inspection === 'displacement'}" aria-label="量看同一水质点相对固定位置的位移；再次选择收起"><circle cx="${fmt(marker[0])}" cy="${fmt(marker[1])}" r="22" fill="transparent"/><circle data-wave-particle="surface" data-rest-x="${rest}" data-x="${fmt(state.particle.x)}" data-height="${fmt(state.particle.height)}" cx="${fmt(marker[0])}" cy="${fmt(marker[1])}" r="6" fill="#b57751" stroke="#614b3d" stroke-width="1.4"/></g>`;
  const deep = waveProject(observation.points.at(-1)!.rest.x, 1.02, state.meanHeight - 8);
  body += `<g role="button" tabindex="0" data-model-inspection="depth-pair" data-model-inspection-toggle="overview" aria-label="比较同一波浪中表层和深处水质点的运动"><circle cx="${fmt(deep[0])}" cy="${fmt(deep[1])}" r="20" fill="transparent"/><path d="M${fmt(deep[0] - 5)} ${fmt(deep[1])}h10m-5-5v10" fill="none" stroke="#6b8d81" stroke-width="1.7"/></g>`;
  body += `<path pointer-events="none" d="M${pair(marker)}L443,88" fill="none" stroke="#a36548" stroke-width="1"/><text pointer-events="none" x="487" y="79" text-anchor="middle" fill="#303a40" font-size="25" font-family="FieldSerif,SimSun,serif">水质点</text>`;
  const probes = [0, 25, 50, 75, 100].map(x => ({ x, height: fmt(waveHeightAt(state, x)) }));
  return `<svg xmlns="http://www.w3.org/2000/svg" class="flat-model-svg flat-explanation-svg" viewBox="0 0 640 325" role="group" data-inspection="${observation.inspection}" data-wave-observation='${JSON.stringify(observation)}' data-wave-phase="${fmt(state.phase)}" data-wave-selection="${state.selection}" data-wave-height="${state.waveHeight}" data-height-probes='${JSON.stringify(probes)}' aria-label="波形向右传播；橙点是同一水质点的示意，作闭合往复运动。理想深水周期波，不含洋流、破碎和近岸变化，不表示实测浪高、周期，也不是实际浮标运动。"><title>波浪：传播的波形与往复的水质点</title><g stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;
}

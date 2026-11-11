/** Textbook pp.91–92: an illustrative transport/sorting relationship, not
 * a complete soil-forming model or a calibrated erosion/soil-formation rate. */
export type SoilGrainSize = 'coarse' | 'medium' | 'fine';
export interface SoilSortingGrain {
  id: number;
  size: SoilGrainSize;
  radius: number;
  u: number;
  v: number;
  height: number;
  travel: number;
  deposited: boolean;
}
export interface SoilWaterTracer { lane: number; u: number; v: number; height: number; tailU: number }
export interface SoilSortingState {
  phase: number;
  stage: 'ready' | 'transport' | 'settled';
  grains: SoilSortingGrain[];
  deposited: number;
  water: { active: boolean; reach: number; strength: number; tracers: SoilWaterTracer[] };
}
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const smooth = (a: number, z: number, n: number) => { const t = clamp((n - a) / (z - a)); return t * t * (3 - 2 * t); };
const seed = (n: number) => { const p = Math.sin(n * 127.1 + 31.7) * 43758.5453; return p - Math.floor(p); };
export const SOIL_SORTING_REFERENCE = { textbookPages: [91, 92], pdfPages: [96, 97], quantities: 'schematic',
  scope: 'one-example-of-water-transport-and-particle-sorting', notAllSoilFormationFactors: true } as const;
export const SOIL_GRAIN_COLORS: Record<SoilGrainSize, string> = { coarse: '#9c8569', medium: '#b59970', fine: '#c5ad82' };
export const SOIL_SORTING_LABELS = ['山顶 · 较粗', '山前', '低地 · 较细'] as const;
export const SOIL_SORTING_POOL = Array.from({ length: 54 }, (_, id) => {
  const group = Math.floor(id / 18), size = (['coarse', 'medium', 'fine'] as const)[group];
  return Object.freeze({ id, size, lane: id % 3, startU: .065 + seed(id + 1) * .105,
    endU: [.23, .49, .79][group] + seed(id + 103) * [.115, .155, .145][group],
    radius: [1.55, .91, .49][group] * (.83 + seed(id + 51) * .32),
    spread: (seed(id + 71) - .5) * .10,
    start: .055 + seed(id + 193) * .055, end: [.40, .65, .89][group] + seed(id + 151) * .035 });
});
export function soilSortingChannel(u: number, lane: number): number {
  return .27 + lane * .235 + Math.sin(u * 8 + lane * .8) * .026;
}
export function soilSortingHeight(u: number, v: number): number {
  const slope = 1 - smooth(.035, .84, u);
  const relief = Math.sin(v * Math.PI) ** 2 * (1.1 + 2.1 * slope) + Math.sin(u * 13 + v * 5) * .65 * slope;
  return 3.4 + 35 * slope ** 1.2 + relief;
}
export function evaluateSoilSorting(input: number): SoilSortingState {
  const phase = clamp(input);
  const grains = SOIL_SORTING_POOL.map(p => {
    const travel = smooth(p.start, p.end, phase), u = p.startU + (p.endU - p.startU) * travel;
    const v = soilSortingChannel(u, p.lane) + p.spread * (.55 + travel * .45);
    return { id: p.id, size: p.size, radius: p.radius, u, v, height: soilSortingHeight(u, v), travel,
      deposited: phase >= p.end };
  });
  // Water covers the initially mixed material before any grain starts moving.
  const reach = .19 + .81 * smooth(0, .52, phase), strength = smooth(0, .085, phase) * (1 - smooth(.83, .98, phase));
  const active = strength > .001;
  const tracers: SoilWaterTracer[] = active ? Array.from({ length: 12 }, (_, id) => {
    const lane = id % 3, q = (phase * 1.8 + Math.floor(id / 3) / 4) % 1;
    const u = .035 + .93 * reach * q, v = soilSortingChannel(u, lane);
    return { lane, u, v, height: soilSortingHeight(u, v), tailU: Math.max(.025, u - .025) };
  }) : [];
  return { phase, stage: phase <= .055 ? 'ready' : phase >= .98 ? 'settled' : 'transport', grains,
    deposited: grains.filter(p => p.deposited).length, water: { active, reach, strength, tracers } };
}

export function soilSortingProject(u: number, v: number, height: number): [number, number] {
  return [54 + u * 496 + v * 50, 201 + v * 75 - height * 3.55];
}
const number = (n: number) => Number(n.toFixed(6));
const pair = (p: [number, number]) => p.map(number).join(',');
export function soilSortingSvg(phase: number): string {
  const state = evaluateSoilSorting(phase), project = soilSortingProject;
  const front = Array.from({ length: 49 }, (_, i) => project(i / 48, 1, soilSortingHeight(i / 48, 1)));
  let body = `<path d="M${front.map(pair).join('L')}L${pair(project(1, 1, 0))}L${pair(project(0, 1, 0))}Z" fill="#b3a28a" stroke="#5c6054" stroke-width="1.2"/>`;
  const left = [project(0, 0, 0), project(0, 1, 0), project(0, 1, soilSortingHeight(0, 1)), project(0, 0, soilSortingHeight(0, 0))];
  body += `<polygon points="${left.map(pair).join(' ')}" fill="#a8967e" stroke="#5c6054" stroke-width="1.2"/>`;
  for (let v = 0; v < 12; v++) for (let u = 0; u < 48; u++) {
    const corners = [[u / 48, v / 12], [(u + 1) / 48, v / 12], [(u + 1) / 48, (v + 1) / 12], [u / 48, (v + 1) / 12]];
    body += `<polygon points="${corners.map(([x, z]) => pair(project(x, z, soilSortingHeight(x, z)))).join(' ')}" fill="#d0c3a6"/>`;
  }
  for (let i = 0; i < 8; i++) {
    const u = .035 + i * .13;
    const line = Array.from({ length: 31 }, (_, j) => pair(project(u, j / 30, soilSortingHeight(u, j / 30) + .05)));
    body += `<path d="M${line.join('L')}" fill="none" stroke="#777f69" stroke-width=".7" opacity=".34"/>`;
  }
  if (state.water.active) {
    for (let lane = 0; lane < 3; lane++) {
      const line = Array.from({ length: 65 }, (_, i) => {
        const u = .025 + i / 64 * .94 * state.water.reach, v = soilSortingChannel(u, lane);
        return pair(project(u, v, soilSortingHeight(u, v) + .18));
      });
      body += `<path data-soil-water="${lane}" d="M${line.join('L')}" fill="none" stroke="#85aab0" stroke-width="${number(4.5 * state.water.strength)}" stroke-linecap="round"/>`;
    }
    for (const tracer of state.water.tracers) {
      const a = project(tracer.tailU, soilSortingChannel(tracer.tailU, tracer.lane), soilSortingHeight(tracer.tailU, soilSortingChannel(tracer.tailU, tracer.lane)) + .4);
      const z = project(tracer.u, tracer.v, tracer.height + .4), dx = z[0] - a[0], dy = z[1] - a[1], length = Math.hypot(dx, dy) || 1;
      const wing = (side: number): [number, number] => [z[0] - dx / length * 4 + dy / length * side * 2.1, z[1] - dy / length * 4 - dx / length * side * 2.1];
      body += `<path d="M${pair(wing(1))}L${pair(z)}L${pair(wing(-1))}" fill="none" stroke="#416f7b" stroke-width="1.1"/>`;
    }
  }
  for (const grain of [...state.grains].sort((a, b) => a.v - b.v)) {
    const p = project(grain.u, grain.v, grain.height + grain.radius * .4), r = grain.radius * 3.1;
    const outline = Array.from({ length: 6 }, (_, i): [number, number] => {
      const a = i / 6 * Math.PI * 2, s = .86 + seed(grain.id * 7 + i) * .22;
      return [p[0] + Math.cos(a) * r * s, p[1] + Math.sin(a) * r * .7 * s];
    });
    body += `<polygon data-soil-grain="${grain.id}" data-size="${grain.size}" data-u="${number(grain.u)}" data-v="${number(grain.v)}" data-height="${number(grain.height)}" data-deposited="${grain.deposited}" points="${outline.map(pair).join(' ')}" fill="${SOIL_GRAIN_COLORS[grain.size]}" stroke="#665e4c" stroke-width="${grain.size === 'fine' ? .5 : .8}"/>`;
  }
  for (const [i, u] of [.15, .55, .88].entries()) {
    const [x, y] = project(u, 1.22, 0);
    body += `<text x="${number(x)}" y="${number(y + 24)}" text-anchor="middle" fill="#303a40" font-size="${i === 1 ? 24 : 23}" font-family="FieldSerif,SimSun,serif">${SOIL_SORTING_LABELS[i]}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" class="flat-model-svg flat-explanation-svg" viewBox="0 0 640 390" role="img" data-soil-sorting="${state.stage}" data-phase="${number(state.phase)}" aria-label="山地到低地的颗粒搬运分选示意，粗颗粒较早停留，细颗粒随水流移动更远。不是全部成土因素，不表示真实侵蚀或成土速率。"><title>地貌与颗粒：山顶到低地的搬运分选示意</title><g stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;
}

/** Textbook p.89, fig.5.16. This is a controlled, freely drained teaching
 * comparison. Water portions and all rates are schematic, never field data. */
export const SOIL_TEXTURE_TYPES = [
  { id: 'sand', name: '砂土', color: '#c3af86', side: '#a5936e', columns: 4, rows: 7, grainRadius: .095, retainedCount: 6, transit: .23 },
  { id: 'loam', name: '壤土', color: '#a68e6b', side: '#8a765a', columns: 6, rows: 10, grainRadius: .066, retainedCount: 21, transit: .34 },
  { id: 'clay', name: '黏土', color: '#a47b62', side: '#89634e', columns: 10, rows: 16, grainRadius: .043, retainedCount: 28, transit: .46 },
] as const;
export const SOIL_TEXTURE_REFERENCE = {
  textbookPages: [89], pdfPages: [94], figure: '5.16', quantities: 'schematic',
  conditions: 'same-initial-conditions-same-rainfall-free-drainage',
  notMeasuredRates: true, notFieldWaterCapacity: true, notIrrigationAdvice: true,
} as const;
export const SOIL_TEXTURE_WATER_COUNT = 36;
export const SOIL_TEXTURE_COLLECTOR_FLOOR = 1.37;
export const SOIL_TEXTURE_COLLECTOR_RANGE = .21;
export type SoilTextureWaterStatus = 'waiting' | 'falling' | 'infiltrating' | 'dripping' | 'retained' | 'collected';
export interface SoilTextureGrain { id: number; u: number; depth: number; v: number; radius: number; shade: number }
export interface SoilTextureWater {
  id: number; lane: number; u: number; depth: number; status: SoilTextureWaterStatus;
  radius: number; travel: number; release: number; impact: number; arrival: number;
  amount: number; collectedFraction: number;
}
export interface SoilTextureInventory {
  waiting: number; falling: number; infiltrating: number; dripping: number; retained: number; collected: number; total: number;
}
export interface SoilTextureSample {
  index: number; name: string; portions: SoilTextureWater[]; inventory: SoilTextureInventory;
  reservoir: number; collected: number; collectorLevelDepth: number;
}
export interface SoilTextureState {
  phase: number; selection: number; stage: 'ready' | 'raining' | 'draining' | 'retained';
  rain: { released: number; waiting: number; inAir: number; total: number };
  samples: SoilTextureSample[];
}
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const smooth = (a: number, z: number, n: number) => { const t = clamp((n - a) / (z - a)); return t * t * (3 - 2 * t); };
const seed = (n: number) => { const p = Math.sin(n * 127.1 + 43.7) * 43758.5453; return p - Math.floor(p); };
export const normalizeSoilTextureSelection = (selection: number) => Number.isFinite(selection) ? Math.max(0, Math.min(2, Math.round(selection))) : 0;

/** Immutable soil particles. Two depths make real pore spaces, not a texture. */
export const SOIL_TEXTURE_GRAINS: readonly SoilTextureGrain[][] = SOIL_TEXTURE_TYPES.map((sample, index) => {
  const grains: SoilTextureGrain[] = [];
  for (let layer = 0; layer < 2; layer++) for (let row = 0; row < sample.rows; row++) for (let column = 0; column < sample.columns; column++) {
    const id = grains.length, mixed = index === 1 ? [.98, .67, .47][id % 3] : .90 + seed(id + index * 71) * .10;
    grains.push(Object.freeze({ id, u: (column + .5) / sample.columns + Math.sin(row * 1.7) * [.004, .002, .001][index],
      depth: (row + .5) / sample.rows, v: layer === 0 ? .94 : .31,
      radius: sample.grainRadius * mixed, shade: id % 3 }));
  }
  return Object.freeze(grains) as unknown as SoilTextureGrain[];
});

export const SOIL_TEXTURE_RAIN_POOL = Array.from({ length: SOIL_TEXTURE_WATER_COUNT }, (_, id) => Object.freeze({
  id, lane: id % 3, release: .025 + id / (SOIL_TEXTURE_WATER_COUNT - 1) * .32,
  retainedRank: id * 13 % SOIL_TEXTURE_WATER_COUNT, targetDepth: .12 + seed(id + 155) * .75,
  transitVariation: seed(id + 199) * .025,
}));

/** Paths occupy the gaps between grain columns. Narrower gaps contain smaller
 * water markers; these sizes show relationships, not measured pore diameters. */
export function soilTextureWaterU(index: number, lane: number, depth: number): number {
  const lanes = [[.25, .50, .75], [1 / 6, .50, 5 / 6], [.20, .50, .80]][index] ?? [.25, .50, .75];
  return lanes[lane] + Math.sin(depth * Math.PI * 2 * SOIL_TEXTURE_TYPES[index].rows + lane * .7) * [.007, .004, .002][index];
}

export function evaluateSoilTexture(input: number, selected = 0): SoilTextureState {
  const phase = clamp(input), selection = normalizeSoilTextureSelection(selected);
  const samples = SOIL_TEXTURE_TYPES.map((sample, index): SoilTextureSample => {
    const portions = SOIL_TEXTURE_RAIN_POOL.map(p => {
      const impact = p.release + .065, retained = p.retainedRank < sample.retainedCount;
      const transit = sample.transit + p.transitVariation;
      const soilArrival = impact + transit * (retained ? p.targetDepth : 1);
      const arrival = soilArrival + (retained ? 0 : .055);
      const status: SoilTextureWaterStatus = phase <= p.release ? 'waiting' : phase < impact ? 'falling'
        : phase < soilArrival ? 'infiltrating' : retained ? 'retained' : phase < arrival + .014 ? 'dripping' : 'collected';
      const collectedFraction = retained ? 0 : smooth(arrival, arrival + .014, phase);
      const travel = smooth(impact, soilArrival, phase);
      const depth = status === 'waiting' ? -.28 : status === 'falling' ? -.28 * (1 - smooth(p.release, impact, phase))
        : travel * (retained ? p.targetDepth : 1);
      return { id: p.id, lane: p.lane, depth, u: soilTextureWaterU(index, p.lane, clamp(depth)), status, travel,
        radius: status === 'falling' ? .025 : [.024, .021, .018][index], release: p.release, impact, arrival,
        amount: 1 - collectedFraction, collectedFraction };
    });
    const inventory: SoilTextureInventory = { waiting: 0, falling: 0, infiltrating: 0, dripping: 0, retained: 0, collected: 0, total: SOIL_TEXTURE_WATER_COUNT };
    for (const portion of portions) {
      if (portion.status === 'dripping') { inventory.dripping += portion.amount; inventory.collected += portion.collectedFraction; }
      else inventory[portion.status]++;
    }
    const collected = inventory.collected / SOIL_TEXTURE_WATER_COUNT;
    const collectorLevelDepth = SOIL_TEXTURE_COLLECTOR_FLOOR - SOIL_TEXTURE_COLLECTOR_RANGE * collected;
    for (const portion of portions) {
      if (portion.status === 'dripping') portion.depth = 1 + (collectorLevelDepth - 1) * smooth(portion.arrival - .055, portion.arrival, phase);
      if (portion.status === 'collected') portion.depth = collectorLevelDepth;
    }
    return { index, name: sample.name, portions, inventory, reservoir: inventory.waiting / SOIL_TEXTURE_WATER_COUNT, collected, collectorLevelDepth };
  });
  const inventory = samples[0].inventory;
  return { phase, selection, samples,
    stage: phase <= .025 ? 'ready' : phase < .41 ? 'raining' : samples.every(s => s.inventory.retained + s.inventory.collected === SOIL_TEXTURE_WATER_COUNT) ? 'retained' : 'draining',
    rain: { released: SOIL_TEXTURE_WATER_COUNT - inventory.waiting, waiting: inventory.waiting, inAir: inventory.falling, total: SOIL_TEXTURE_WATER_COUNT },
  };
}

export function soilTextureProject(index: number, u: number, depth: number, v = 1): [number, number] {
  return [[111, 320, 529][index] + (u - .5) * 134 + (1 - v) * 18, 108 + depth * 164 - (1 - v) * 10];
}
const number = (n: number) => Number(n.toFixed(6));
const pair = (p: [number, number]) => p.map(number).join(',');
const polygon = (p: [number, number][]) => p.map(pair).join(' ');

/** The SVG is a live vector view of the same finite portions and fixed grains. */
export function soilTextureSvg(phase: number, selection = 0): string {
  const state = evaluateSoilTexture(phase, selection), project = soilTextureProject;
  const action = (i: number) => `data-model-selection="${i}" role="button" tabindex="0" aria-label="观察${SOIL_TEXTURE_TYPES[i].name}，保留同一场降水进度" aria-pressed="${state.selection === i}"`;
  let body = '';
  // A single equal-rain reservoir feeds the three columns, and visibly empties.
  body += '<path d="M38 42H611V69H38Z" fill="#f1ecdd" stroke="#777565" stroke-width="1.2"/>';
  for (let i = 0; i < 3; i++) {
    const x = [111, 320, 529][i], level = state.samples[i].reservoir;
    if (level > 0) body += `<rect data-texture-reservoir="${i}" x="${x - 64}" y="${number(65 - 18 * level)}" width="128" height="${number(18 * level)}" fill="#a0bec1"/>`;
    body += `<path d="M${x - 68} 42v27m136-27v27M${x - 3} 69v7h6v-7" fill="none" stroke="#777565" stroke-width=".9"/>`;
  }
  for (const sample of state.samples) {
    const i = sample.index, type = SOIL_TEXTURE_TYPES[i], left = project(i, 0, 0), right = project(i, 1, 0), bottom = project(i, 1, 1), back = project(i, 1, 0, 0), bottomBack = project(i, 1, 1, 0);
    body += `<g ${action(i)} data-soil-texture-part="sample" data-soil-texture-sample="${i}"><polygon points="${polygon([right, back, bottomBack, bottom])}" fill="${type.side}" opacity=".40" stroke="#797262" stroke-width=".8"/><rect x="${number(left[0])}" y="${number(left[1])}" width="134" height="164" fill="#eee6d5" stroke="#797262" stroke-width="1"/>`;
    for (const grain of SOIL_TEXTURE_GRAINS[i].filter(p => p.v > .5)) {
      const p = project(i, grain.u, grain.depth, 1), r = grain.radius * 134;
      const outline = Array.from({ length: 7 }, (_, j): [number, number] => { const a = j / 7 * Math.PI * 2, variation = .9 + seed(grain.id * 7 + j) * .15; return [p[0] + Math.cos(a) * r * variation, p[1] + Math.sin(a) * r * .77 * variation]; });
      body += `<polygon data-soil-texture-grain="${i}-${grain.id}" points="${polygon(outline)}" fill="${grain.shade === 1 ? type.side : type.color}" stroke="#77694f" stroke-width="${i === 2 ? .35 : .55}"/>`;
    }
    body += '</g>';
    const a = project(i, .05, 1.10), z = project(i, .95, SOIL_TEXTURE_COLLECTOR_FLOOR);
    const levelY = project(i, 0, sample.collectorLevelDepth)[1];
    body += `<path d="M${number(a[0])},${number(a[1])}V${number(z[1] + 2)}H${number(z[0])}V${number(a[1])}" fill="#f1ecdd" stroke="#797565" stroke-width="1.1"/>`;
    if (sample.collected > 0) body += `<rect data-soil-texture-collection="${i}" data-fraction="${number(sample.collected)}" x="${number(a[0] + 2)}" y="${number(levelY)}" width="${number(z[0] - a[0] - 4)}" height="${number(z[1] - levelY)}" fill="#89adb5"/>`;
    for (const water of sample.portions) {
      if (water.status === 'waiting' || water.status === 'collected') continue;
      const p = project(i, water.u, water.depth, 1), r = water.radius * 134 * Math.cbrt(water.amount);
      body += `<ellipse data-soil-texture-water="${i}-${water.id}" data-sample="${i}" data-water-id="${water.id}" data-u="${number(water.u)}" data-depth="${number(water.depth)}" data-status="${water.status}" data-amount="${number(water.amount)}" cx="${number(p[0])}" cy="${number(p[1])}" rx="${number(r)}" ry="${number(r * (water.status === 'falling' || water.status === 'dripping' ? 1.4 : .75))}" fill="#538797" stroke="#426d78" stroke-width=".45"/>`;
    }
    body += `<g ${action(i)} data-soil-texture-part="label"><text x="${[111, 320, 529][i]}" y="375" text-anchor="middle" fill="#303a40" font-size="27" font-family="FieldSerif,SimSun,serif">${type.name}</text>${state.selection === i ? `<path d="M${[111, 320, 529][i] - 32} 384h64" stroke="#a36c50" stroke-width="1.8"/>` : ''}</g>`;
  }
  body += '<g data-model-replay="true" data-soil-texture-part="replay" role="button" tabindex="0" aria-label="重新播放同一场示意降水"><path d="M282 2h76v32h-76Z" fill="#f7f0df" stroke="#9a927d" stroke-width="1"/><path d="M332 12a12 12 0 1 0-2 15m2-15v9h-9" fill="none" stroke="#5d7777" stroke-width="1.4"/><path d="M302 9c-2 6-6 9-6 12a6 6 0 0 0 12 0c0-3-4-6-6-12Z" fill="#87a7af"/></g>';
  return `<svg xmlns="http://www.w3.org/2000/svg" class="flat-model-svg flat-explanation-svg" viewBox="0 0 640 400" role="group" data-soil-texture="${state.stage}" data-phase="${number(state.phase)}" aria-label="砂土、壤土、黏土接受同一场示意降水，比较孔隙中的下渗、土中留存和下部收集。水份额、颗粒、速度和保水量均为教学设定，不是实测值，也不用于确定灌溉量。下部自由排水，不表示所有田间条件。点击土柱只强调观察对象，点击上方小纸签可重播。"><title>图5.16 砂土、壤土和黏土的同雨对照示意</title><g stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
}

/** Textbook pp.52–53: an isolated parcel of sea water, with one condition
 * changed per trial. All amounts and schedules are dimensionless teaching
 * settings. Salt marks represent dissolved salt, never settling crystals. */
export const SALINITY_REFERENCE = {
  pages: [52, 53], initialWater: 54, saltMass: 2, transferWater: 18,
  saltMarks: 24, portionCount: 18, measured: false,
} as const;
export const SALINITY_MODES = ['蒸发增强', '降水增多', '河流注入'] as const;
export type SalinityMode = 0 | 1 | 2;
const clamp = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
const smooth = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t); };

export function evaluateSalinity(phase: number, selection = 0) {
  const t = clamp(phase), mode = Math.min(2, Math.max(0, Math.trunc(Number.isFinite(selection) ? selection : 0))) as SalinityMode;
  const portions = Array.from({ length: SALINITY_REFERENCE.portionCount }, (_, id) => {
    const release = .08 + id / (SALINITY_REFERENCE.portionCount - 1) * .54;
    const departed = smooth((t - release) / .045), arrived = smooth((t - release - .16) / .045);
    return { id, release, departed, arrived, inTransit: departed - arrived,
      progress: clamp((t - release - .0225) / .16) };
  });
  const released = portions.reduce((sum, p) => sum + p.departed, 0);
  const arrived = portions.reduce((sum, p) => sum + p.arrived, 0);
  const inTransit = released - arrived;
  const water = SALINITY_REFERENCE.initialWater + (mode === 0 ? -released : arrived);
  const source = mode === 0 ? 0 : SALINITY_REFERENCE.transferWater - released;
  const removed = mode === 0 ? arrived : 0;
  const salt = SALINITY_REFERENCE.saltMass, concentration = salt / (water + salt);
  const initialConcentration = salt / (SALINITY_REFERENCE.initialWater + salt);
  const change = water - SALINITY_REFERENCE.initialWater;
  const tendency = change < -1e-8 ? '升高' : change > 1e-8 ? '降低' : '未变';
  const stage = t < .08 ? 'ready' : t < .825 ? 'transferring' : 'complete';
  const caption = `${SALINITY_MODES[mode]}：${tendency === '未变' ? '从相同海水开始' : `盐量不变，盐度${tendency}`}`;
  return { phase: t, mode, portions, water, salt, released, arrived, inTransit, source, removed,
    totalWater: water + source + removed + inTransit,
    expectedTotalWater: SALINITY_REFERENCE.initialWater + (mode === 0 ? 0 : SALINITY_REFERENCE.transferWater),
    concentration, initialConcentration, relativeConcentration: concentration / initialConcentration,
    /** A level/volume proxy; neither density nor temperature is being solved. */
    waterLevel: 14 + change * .29, initialLevel: 14, tendency, stage, caption,
    units: 'dimensionless-teaching-only', measuredSalinity: false, dissolvedSalt: true };
}
export type SalinityState = ReturnType<typeof evaluateSalinity>;

/** All views place each same finite water portion from this normalized path.
 * Evaporation goes up without carrying salt. Rain and river water reach the
 * basin before they raise its level. Returning the timeline is inspection. */
export function salinityPortionPoint(state: SalinityState, id: number): [number, number, number] {
  const p = state.portions[id], q = p.progress, lane = id % 6, row = Math.floor(id / 6);
  const surface = 3 + state.waterLevel;
  if (state.mode === 0) return [30 + lane * 8 + Math.sin(q * Math.PI) * 2, surface + 30 * q, 46 - row * 6 - q * 3];
  if (state.mode === 1) return [35 + lane * 7, 49 + (surface - 49) * q, 34 + row * 6];
  const path = [[5, 34, 18], [8, 30.5, 25], [12, 27.3, 32], [18, 24.2, 38], [30, surface, 42]];
  const segment = Math.min(path.length - 2, Math.floor(q * (path.length - 1)));
  const u = q * (path.length - 1) - segment;
  return path[segment].map((n, i) => n + (path[segment + 1][i] - n) * u) as [number, number, number];
}

export function salinitySvg(phase: number, selection = 0) {
  const s = evaluateSalinity(phase, selection), level = s.waterLevel * 6.2, y = 321 - level;
  const label = (text: string, x: number, y: number, size = 20) => `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" fill="#303a40" font-family="FieldSerif,SimSun,serif">${text}</text>`;
  const salt = Array.from({ length: SALINITY_REFERENCE.saltMarks }, (_, i) => {
    const x = 168 + i % 6 * 64, yy = 318 - level * (.13 + Math.floor(i / 6) * .21);
    return `<path d="M${x},${yy - 3.4}l3.4,3.4 -3.4,3.4 -3.4,-3.4Z" fill="#a58a56"/>`;
  }).join('');
  const portions = s.portions.filter(p => p.inTransit > .001).map(p => {
    const [x, h] = salinityPortionPoint(s, p.id), screenX = 90 + x * 5, yy = 339 - h * 5.5;
    return `<ellipse cx="${screenX}" cy="${yy}" rx="3.1" ry="${3 + p.inTransit * 2.5}" fill="#5f94a2" opacity="${Math.min(1, p.inTransit * 2)}"/>`;
  }).join('');
  const cause = s.mode === 0
    ? `<circle cx="330" cy="76" r="20" fill="#d6b46e"/><g stroke="#b5955b" stroke-width="2">${Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2; return `<path d="M${330 + Math.cos(a) * 27},${76 + Math.sin(a) * 27}L${330 + Math.cos(a) * 34},${76 + Math.sin(a) * 34}"/>`; }).join('')}</g>`
    : s.mode === 1 ? '<path d="M258,103C241,83 259,59 281,65C291,34 335,37 345,58C374,43 405,71 391,94C407,107 387,119 373,115H278C264,118 258,112 258,103Z" fill="#f7f1e3" stroke="#73796e" stroke-width="1.5"/>' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 390" class="flat-model-svg flat-explanation-svg" role="img" aria-label="${s.caption}" data-model="salinity" data-water="${s.water}" data-salt="${s.salt}" data-concentration="${s.concentration}" data-phase="${s.phase}">
    <rect width="640" height="390" fill="#f7f1e3"/>
    <path d="M45,306V185L66,143 95,176 125,242 146,306Z" fill="#c5c5a8" stroke="#6d776b" stroke-width="1.2"/>
    ${s.mode === 2 ? '<path d="M62,175Q81,194 90,225T150,273" fill="none" stroke="#88b2b8" stroke-width="7"/>' : ''}
    <path d="M133,323V161H551V323Z" fill="#e9e1cb" stroke="#646f6c" stroke-width="1.7"/>
    <path d="M140,${y}H544V321H140Z" fill="#b0cbd0"/>
    <path d="M140,${y}H544" stroke="#548594" stroke-width="2"/>
    <path d="M133,${321 - 14 * 6.2}H551" stroke="#7d8275" stroke-dasharray="4 7" stroke-width="1"/>
    ${salt}${cause}${portions}
    ${label('盐量不变', 227, 365)}${label(`盐度${s.tendency}`, 450, 365)}
  </svg>`;
}

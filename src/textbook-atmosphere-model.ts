/** Textbook p.31–32, fig.2.5: one continuous vertical observation window.
 * Height and the horizontal temperature coordinate are teaching coordinates,
 * not kilometres, degrees or a global standard atmospheric profile. */
export type AtmospherePoint = readonly [number, number, number];
export type AtmosphereLayerId = 'troposphere' | 'stratosphere' | 'upper-atmosphere';
export type TemperatureTendency = 'decreasing' | 'little-change' | 'increasing';

export const ATMOSPHERE_REFERENCE = {
  textbookPages: [31, 32], pdfPages: [36, 37], figure: '2.5',
  heightScale: 'teaching-normalized', temperatureScale: 'qualitative-only',
  calibratedHeight: false, calibratedTemperature: false, heightIsTime: false,
  layerBoundariesVaryWithLatitudeAndConditions: true,
  textbookHeightLabelsAreNotGlobalConstants: true,
  upperTemperatureProfile: 'decreases-then-increases',
  upperBoundaryIsTeachingWindow: true,
  troposphereMotion: 'vertical-dominant', stratosphereMotion: 'horizontal-dominant',
  stratosphereConvectionImpossible: false, weatherPrediction: false,
  auroraAssociationIsNotOccurrenceAtEveryHeight: true,
} as const;

/** These fractions are layout decisions, not a conversion of the 12/50 km
 * marks in the textbook. The model top is not the edge of the atmosphere. */
export const ATMOSPHERE_BOUNDARIES = [0, .24, .56, 1] as const;
export const ATMOSPHERE_STOPS = [
  { label: '对流层', phase: .12, selection: 0 },
  { label: '平流层', phase: .42, selection: 1 },
  { label: '高层大气', phase: .82, selection: 2 },
] as const;
export const ATMOSPHERE_TRACK = {
  start: [12, 9, 49] as AtmospherePoint, end: [12, 91, 49] as AtmospherePoint,
};
export const ATMOSPHERE_BOUNDS = {
  min: [4, -9, 12] as AtmospherePoint, max: [114, 108, 56] as AtmospherePoint,
};
export const ATMOSPHERE_LAYERS = [
  { id: 'troposphere', label: '对流层', bottom: 0, top: .24, color: '#b8ceca',
    temperatureTrend: 'decreasing', motion: 'vertical-dominant',
    feature: '气温总体随高度升高而降低，以垂直运动为主。',
    evidence: '云、雨等天气现象多发生在这一层。' },
  { id: 'stratosphere', label: '平流层', bottom: .24, top: .56, color: '#d0d9cd',
    temperatureTrend: 'increasing', motion: 'horizontal-dominant',
    feature: '下部气温变化较小，上部随高度升高而升高。',
    evidence: '以水平运动为主，不等于完全没有垂直运动。' },
  { id: 'upper-atmosphere', label: '高层大气', bottom: .56, top: 1, color: '#e1e4d9',
    temperatureTrend: 'complex', motion: 'not-modelled',
    feature: '气温变化复杂，图中先下降，随后上升。',
    evidence: '高层大气中有电离等现象，极光与其有关。' },
] as const;

// Dimensionless shape of the explanatory temperature curve. The lower
// stratosphere has a short nearly uniform segment; the upper atmosphere has
// a reversal. No part of this table is displayed as observed temperature.
const TEMPERATURE_KNOTS = [[0, .82], [.24, .2], [.30, .2], [.56, .69], [.76, .08], [1, .91]] as const;
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const smooth = (t: number) => t * t * (3 - 2 * t);
export const atmosphereHeight = (phase: number) => 9 + 82 * clamp(phase);

export function atmosphereRelativeTemperature(phase: number): number {
  const t = clamp(phase);
  for (let i = 1; i < TEMPERATURE_KNOTS.length; i++) {
    const a = TEMPERATURE_KNOTS[i - 1], z = TEMPERATURE_KNOTS[i];
    if (t === z[0]) return z[1];
    if (t <= z[0]) return a[1] + (z[1] - a[1]) * smooth((t - a[0]) / (z[0] - a[0]));
  }
  return TEMPERATURE_KNOTS[TEMPERATURE_KNOTS.length - 1][1];
}
export function atmosphereProfilePoint(phase: number): AtmospherePoint {
  return [43 + 27 * atmosphereRelativeTemperature(phase), atmosphereHeight(phase), 49];
}
export function atmosphereHandlePoint(phase: number): AtmospherePoint {
  return [12, atmosphereHeight(phase), 49];
}
export const ATMOSPHERE_PROFILE: readonly AtmospherePoint[] =
  Array.from({ length: 101 }, (_, i) => atmosphereProfilePoint(i / 100));

export interface AtmosphereState {
  phase: number; stage: AtmosphereLayerId; stageIndex: number; selection: number;
  selectedLayer: AtmosphereLayerId; layerLabel: string; caption: string;
  layerBounds: { bottom: number; top: number };
  relativeTemperature: number; temperatureTrend: 'decreasing' | 'increasing' | 'complex';
  localTemperatureTendency: TemperatureTendency;
  motion: 'vertical-dominant' | 'horizontal-dominant' | 'not-modelled';
  feature: string; evidence: string; profilePoint: AtmospherePoint;
  probe: AtmospherePoint; handle: AtmospherePoint;
  normalizedHeight: number; units: 'schematic-height';
}

export function evaluateAtmosphere(phase: number): AtmosphereState {
  const t = clamp(phase), selection = t < .24 ? 0 : t < .56 ? 1 : 2;
  const layer = ATMOSPHERE_LAYERS[selection];
  const below = atmosphereRelativeTemperature(Math.max(0, t - .0001));
  const above = atmosphereRelativeTemperature(Math.min(1, t + .0001));
  const difference = above - below;
  return { phase: t, normalizedHeight: t, stage: layer.id, stageIndex: selection, selection,
    selectedLayer: layer.id, layerLabel: layer.label, caption: `${layer.label} · 垂直观察`,
    layerBounds: { bottom: layer.bottom, top: layer.top }, relativeTemperature: atmosphereRelativeTemperature(t),
    temperatureTrend: layer.temperatureTrend,
    localTemperatureTendency: Math.abs(difference) < 1e-7 ? 'little-change' : difference > 0 ? 'increasing' : 'decreasing',
    motion: layer.motion, feature: layer.feature, evidence: layer.evidence,
    profilePoint: atmosphereProfilePoint(t), probe: atmosphereProfilePoint(t), handle: atmosphereHandlePoint(t),
    units: 'schematic-height' };
}

export function atmosphereDiagnostics(state: AtmosphereState) {
  return { ...state, layerOrder: ATMOSPHERE_LAYERS.map(layer => layer.id),
    heightIsTime: false, calibratedHeight: false, calibratedTemperature: false,
    upperTemperatureMonotonic: false, upperBoundaryIsTeachingWindow: true,
    motionIsDominantNotExclusive: true, weatherPrediction: false };
}

const num = (n: number) => Number(n.toFixed(3));
/** Native geometry, with exactly the same profile and probe as the solid.
 * The short descriptive note is supplied by the surrounding lesson UI. */
export function atmosphereSvg(phase: number): string {
  const state = evaluateAtmosphere(phase), x = (n: number) => num(22 + n * 5.6), y = (n: number) => num(494 - n * 4.3);
  const text = (value: string, px: number, py: number, size = 32) =>
    `<text x="${x(px)}" y="${y(py)}" font-size="${size}" text-anchor="middle">${value}</text>`;
  const points = (path: readonly AtmospherePoint[]) => path.map(p => `${x(p[0])},${y(p[1])}`).join(' ');
  let scene = '';
  for (let index = 0; index < ATMOSPHERE_LAYERS.length; index++) {
    const layer = ATMOSPHERE_LAYERS[index], low = atmosphereHeight(layer.bottom), high = atmosphereHeight(layer.top);
    scene += `<g data-atmosphere-layer="${layer.id}" data-selected="${state.selection === index}" data-model-selection="${index}" role="button" tabindex="0" aria-label="观察${layer.label}高度" style="cursor:pointer">
      <path d="M${x(18)} ${y(low)}H${x(77)}V${y(high)}H${x(18)}Z" fill="${layer.color}" fill-opacity="${state.selection === index ? .78 : .40}" stroke="#9cae9f" stroke-width="1.1"/>
      ${text(layer.label, 94, (low + high) / 2 - 1)}
      <path d="M${x(79)} ${y((low + high) / 2)}H${x(82)}" stroke="#8c9b8d" stroke-width="1.3"/>
    </g>`;
  }
  // Sparse directional marks explain dominant movement without becoming a
  // simulated wind field or implying an absence of other vertical motions.
  scene += `<g stroke="#638e8d" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M${x(25)} ${y(14)}V${y(24)}m-5 7 5-7 5 7"/>
    <path d="M${x(34)} ${y(24)}V${y(14)}m-5-7 5 7 5-7"/>
    <path d="M${x(23)} ${y(39)}H${x(36)}m-7-5 7 5-7 5"/>
    <path d="M${x(36)} ${y(48)}H${x(23)}m7-5-7 5 7 5"/>
  </g>`;
  scene += `<path d="M${x(24)} ${y(78)}Q${x(29)} ${y(84)} ${x(33)} ${y(79)}T${x(40)} ${y(82)}" fill="none" stroke="#8fa895" stroke-width="5"/>
    <path d="M${x(16)} ${y(8)}H${x(77)}V${y(3)}H${x(16)}Z" fill="#bdb297" stroke="#8d8e79" stroke-width="1.2"/>
    <path d="M${x(20)} ${y(8)}l${x(26) - x(20)} ${y(13) - y(8)} ${x(32) - x(26)} ${y(8) - y(13)}" fill="#c8c7ad" stroke="#8c9988" stroke-width="1"/>
    <polyline data-atmosphere-profile="temperature" points="${points(ATMOSPHERE_PROFILE)}" fill="none" stroke="#ad7155" stroke-width="3.5"/>
    <path d="M${x(12)} ${y(9)}V${y(91)}" stroke="#a59b80" stroke-width="2"/>
    <path data-atmosphere-probe="height" d="M${x(13)} ${y(state.probe[1])}H${x(state.probe[0])}" stroke="#7d8d78" stroke-width="1.8"/>
    <ellipse data-atmosphere-handle="height" cx="${x(state.handle[0])}" cy="${y(state.handle[1])}" rx="9" ry="7" fill="#e5d6b2" stroke="#78856e" stroke-width="1.5"/>
    <circle data-atmosphere-probe="temperature" cx="${x(state.probe[0])}" cy="${y(state.probe[1])}" r="7" fill="#b27c5c" stroke="#faf6e9" stroke-width="2"/>
    ${text('气温变化示意', 50, 101, 30)}${text('较冷', 43, -3, 30)}${text('较暖', 70, -3, 30)}
    <text x="340" y="562" text-anchor="middle" font-size="30">高度和温度未按实际数值标定</text>`;
  const diagnostics = JSON.stringify(atmosphereDiagnostics(state)).replace(/&/g, '&amp;').replace(/'/g, '&#39;');
  return `<svg class="flat-model-svg flat-explanation-svg" viewBox="0 0 680 580" role="group"
    aria-label="${state.layerLabel}，${state.feature}高度和温度均为示意。"
    data-atmosphere-phase="${state.phase}" data-atmosphere-layer="${state.selectedLayer}" data-atmosphere-state='${diagnostics}'>
    <g fill="#303a40" font-family="FieldSerif,SimSun,serif">${scene}</g></svg>`;
}

/** PEP Geography I, printed p.50 / PDF p.55, fig.3.8, visually checked.
 * The original is one low-latitude Pacific station at 170°W. The anchors
 * below are an approximate manual reading of its printed curve, not a new
 * observation dataset. The printed axis reaches 6 km; its curve ends near
 * 5 km, so this model never extrapolates that curve to the final axis tick. */
export type TemperaturePoint = [number, number, number];
export interface TemperatureMeshData { positions: number[]; indices: number[]; colors?: number[] }

export const TEMPERATURE_REFERENCE = Object.freeze({
  printedPage: 50, pdfPage: 55, figure: '3.8', source: 'textbook/page-055.webp',
  title: '太平洋西经170°低纬度某个观测站水温随深度变化的曲线',
  location: '太平洋西经170°低纬度某个观测站',
  modelType: 'approximate-reading-of-printed-vertical-profile',
  approximateReadGraph: true, newObservations: false, preciseMeasuredDataset: false,
  appliesToAllOceans: false, predictsTemperature: false,
  phaseIsTime: false, phaseMeaning: 'observation-depth',
  stagesAreObservationNotes: true, thermoclineBoundaryClaimed: false,
  temperatureAxisC: [0, 10, 20, 30], depthAxisKm: [0, 1, 2, 3, 4, 5, 6],
  curveMaxDepthKm: 5, extrapolateBelowCurve: false,
  waterColor: 'qualitative-warm-to-cool-reading-aid', horizontalDistanceIsReal: false,
});

/** Approximate graphic anchors only. Fractional values support a continuous
 * drawn shape; they must not be presented as precise station measurements. */
export const TEMPERATURE_GRAPH_READINGS: readonly (readonly [depthKm: number, approximateC: number])[] = [
  [0, 27], [.1, 22], [.2, 17], [.35, 12], [.5, 8.5], [.75, 5.5],
  [1, 4], [1.25, 3.5], [1.5, 3.1], [2, 2.4], [2.5, 1.6], [3, 1.2], [4, .8], [5, .4],
];
export const TEMPERATURE_STOPS = [
  { label: '表层', phase: 0, selection: 0, depthKm: 0 },
  { label: '约1000米', phase: .2, selection: 1, depthKm: 1 },
  { label: '深层', phase: 1, selection: 2, depthKm: 5 },
] as const;
export const TEMPERATURE_NOTES = ['表层水温较高', '千米内变化较大', '深层变化较小'] as const;
export const TEMPERATURE_LAYOUT = {
  bounds: { min: [-6, -41, 8] as TemperaturePoint, max: [114, 118, 77] as TemperaturePoint },
  water: { minX: 18, maxX: 90, minZ: 12, maxZ: 54, bottom: 4, top: 64 },
  temperatureAxis: { minX: 18, maxX: 90, y: 68, z: 59 },
  depthAxis: { x: 12, z: 59, maxKm: 6 },
  curveZ: 60.5, probeX: 95, probeZ: 62,
  track: { start: [14, -18, 70] as TemperaturePoint, end: [94, -18, 70] as TemperaturePoint },
  nodeLabels: [[12, -29, 70], [54, -29, 70], [96, -29, 70]] as TemperaturePoint[],
  currentLabel: { at: [54, 108, 66] as TemperaturePoint, width: 80, height: 11.6 },
  temperatureUnit: [58, 92, 62] as TemperaturePoint,
} as const;

const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const slopes = TEMPERATURE_GRAPH_READINGS.slice(1).map((point, i) =>
  (point[1] - TEMPERATURE_GRAPH_READINGS[i][1]) / (point[0] - TEMPERATURE_GRAPH_READINGS[i][0]));
// Shape-preserving Hermite tangents keep the curve smooth and monotonic.
// No Catmull-Rom overshoot can create a false warm layer between anchors.
const tangents = TEMPERATURE_GRAPH_READINGS.map((point, i) => {
  if (i === 0) return slopes[0];
  if (i === TEMPERATURE_GRAPH_READINGS.length - 1) return slopes.at(-1)!;
  if (slopes[i - 1] * slopes[i] <= 0) return 0;
  const before = point[0] - TEMPERATURE_GRAPH_READINGS[i - 1][0];
  const after = TEMPERATURE_GRAPH_READINGS[i + 1][0] - point[0];
  const w1 = 2 * after + before, w2 = after + 2 * before;
  return (w1 + w2) / (w1 / slopes[i - 1] + w2 / slopes[i]);
});
export function approximateTemperatureAtDepth(inputDepthKm: number): number {
  const depthKm = clamp(inputDepthKm / TEMPERATURE_REFERENCE.curveMaxDepthKm) * TEMPERATURE_REFERENCE.curveMaxDepthKm;
  if (depthKm === 0) return TEMPERATURE_GRAPH_READINGS[0][1];
  for (let i = 1; i < TEMPERATURE_GRAPH_READINGS.length; i++) {
    const a = TEMPERATURE_GRAPH_READINGS[i - 1], b = TEMPERATURE_GRAPH_READINGS[i];
    if (depthKm > b[0]) continue;
    const span = b[0] - a[0], t = (depthKm - a[0]) / span;
    return (2 * t ** 3 - 3 * t ** 2 + 1) * a[1] + (t ** 3 - 2 * t ** 2 + t) * span * tangents[i - 1]
      + (-2 * t ** 3 + 3 * t ** 2) * b[1] + (t ** 3 - t ** 2) * span * tangents[i];
  }
  return TEMPERATURE_GRAPH_READINGS.at(-1)![1];
}
export const temperatureDepthY = (depthKm: number) => TEMPERATURE_LAYOUT.water.top - 12 * depthKm;
export const temperatureAxisX = (approximateC: number) => 18 + 72 * approximateC / 30;
export function temperatureProfilePoint(phase: number): TemperaturePoint {
  const depthKm = clamp(phase) * TEMPERATURE_REFERENCE.curveMaxDepthKm;
  return [temperatureAxisX(approximateTemperatureAtDepth(depthKm)), temperatureDepthY(depthKm), TEMPERATURE_LAYOUT.curveZ];
}
export const TEMPERATURE_PROFILE_CURVE: readonly TemperaturePoint[] =
  Array.from({ length: 201 }, (_, i) => temperatureProfilePoint(i / 200));
export const temperatureWaterColor = (depthKm: number): [number, number, number] => {
  const warmth = clamp(approximateTemperatureAtDepth(depthKm) / 27);
  return [(.63 + .17 * warmth), (.75 + .005 * warmth), (.77 - .14 * warmth)];
};
export function evaluateTemperatureProfile(input: number) {
  const phase = clamp(input), depthKm = phase * TEMPERATURE_REFERENCE.curveMaxDepthKm;
  const stageIndex = depthKm < .3 ? 0 : depthKm <= 1.2 ? 1 : 2;
  const approxTemperatureC = approximateTemperatureAtDepth(depthKm), point = temperatureProfilePoint(phase);
  const stage = (['surface', 'upper-kilometre', 'deep-water'] as const)[stageIndex];
  const handle: TemperaturePoint = [14 + 80 * phase, -18, 70];
  const probe: TemperaturePoint = [TEMPERATURE_LAYOUT.probeX, point[1], TEMPERATURE_LAYOUT.probeZ];
  const depthReading = depthKm === 0 ? '表层' : `约${Math.max(10, Math.round(depthKm * 100) * 10)}米`;
  const temperatureReading = approxTemperatureC < 1 ? '接近0°C' : `约${Math.round(approxTemperatureC)}°C`;
  return { phase, stage, stageIndex, selection: stageIndex, activeStop: stageIndex,
    depthKm, depthM: depthKm * 1000, approxTemperatureC, depthReading, temperatureReading,
    caption: `${depthReading} · ${temperatureReading}`, note: TEMPERATURE_NOTES[stageIndex],
    phaseMeaning: 'observation-depth' as const, phaseIsTime: false,
    curveIsFixed: true, newObservations: false, preciseMeasuredDataset: false,
    extrapolatesBelowCurve: false, source: TEMPERATURE_REFERENCE,
    point, profilePoint: point, probe, sliceY: point[1], handle,
    waterColor: temperatureWaterColor(depthKm), complete: phase === 1,
    units: 'approximate-printed-km-and-celsius' as const,
  };
}
export type TemperatureProfileState = ReturnType<typeof evaluateTemperatureProfile>;

/** A fixed surface reference makes the depth reading a spatial comparison,
 * rather than a second time control. All values remain approximate graph reads. */
export function evaluateTemperatureInspection(input: number, target = 'overview') {
  const state = evaluateTemperatureProfile(input), inspection = target === 'surface-compare' ? target : 'overview';
  const surface = evaluateTemperatureProfile(0);
  return { inspection, phase: state.phase, active: inspection === 'surface-compare',
    current: state.point, reference: surface.point,
    referenceAtDepth: [surface.point[0], state.point[1], state.point[2]] as TemperaturePoint,
    approximateDifferenceC: surface.approxTemperatureC - state.approxTemperatureC,
    curveIsFixed: true, valuesAreApproximateGraphReads: true, changesDepth: false };
}

/** A closed, vertically sampled solid. Vertex colors read the same fixed
 * profile as the probe; they never animate the ocean's temperature. */
export function temperatureWaterMesh(): TemperatureMeshData {
  const positions: number[] = [], indices: number[] = [], colors: number[] = [], segments = 100;
  const { minX, maxX, minZ, maxZ } = TEMPERATURE_LAYOUT.water;
  const footprint = [[minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ]];
  for (let i = 0; i <= segments; i++) {
    const depth = 5 * i / segments, y = temperatureDepthY(depth), color = temperatureWaterColor(depth);
    for (const [x, z] of footprint) { positions.push(x, y, z); colors.push(...color); }
    if (i < segments) for (let side = 0; side < 4; side++) {
      const a = i * 4 + side, b = i * 4 + (side + 1) % 4;
      indices.push(a, a + 4, b, b, a + 4, b + 4);
    }
  }
  indices.push(0, 1, 2, 0, 2, 3);
  const end = segments * 4; indices.push(end, end + 2, end + 1, end, end + 3, end + 2);
  return { positions, indices, colors };
}
export function temperatureProject([x, y, z]: TemperaturePoint): [number, number] {
  return [34 + 5.4 * x + .35 * (z - 54), 468 - 4.1 * y + 1.1 * (z - 54)];
}
const n = (value: number) => Number(value.toFixed(4));
const svgPoint = (point: TemperaturePoint) => temperatureProject(point).map(n);
const pathPoints = (points: readonly TemperaturePoint[]) => points.map(point => svgPoint(point).join(',')).join(' ');
const rgb = (values: readonly number[]) => `rgb(${values.map(value => Math.round(value * 255)).join(',')})`;
const selectable = (selection: number, body: string, label: string) =>
  `<g data-model-selection="${selection}" role="button" tabindex="0" aria-label="${label}" style="cursor:pointer">${body}</g>`;

/** Native SVG uses the same graph, observation depth and water color. The
 * opaque strips are a vector cross-section, not images or timed animation. */
export function temperatureProfileSvg(input: number, target = 'overview'): string {
  const state = evaluateTemperatureProfile(input), observation = evaluateTemperatureInspection(input, target), water = TEMPERATURE_LAYOUT.water;
  const polygon = (points: TemperaturePoint[], color: string, attrs = '') => `<polygon ${attrs} points="${pathPoints(points)}" fill="${color}"/>`;
  const text = (content: string, at: TemperaturePoint, size = 30) => {
    const [x, y] = svgPoint(at); return `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="central" fill="#303a40" paint-order="stroke" stroke="#f7f1e3" stroke-width="3">${content}</text>`;
  };
  let scene = polygon([[18, 64, 12], [90, 64, 12], [90, 64, 54], [18, 64, 54]], rgb(temperatureWaterColor(0)), 'data-temperature-water-top="true"'), side = '';
  for (let i = 0; i < 100; i++) {
    const depthA = i / 20, depthB = (i + 1) / 20, yA = temperatureDepthY(depthA), yB = temperatureDepthY(depthB);
    side += polygon([[90, yA, 54], [90, yA, 12], [90, yB, 12], [90, yB, 54]], rgb(temperatureWaterColor((depthA + depthB) / 2).map(c => c * .93)));
    scene += polygon([[18, yA, 54], [90, yA, 54], [90, yB, 54], [18, yB, 54]], rgb(temperatureWaterColor((depthA + depthB) / 2)));
  }
  scene += `<g data-model-inspection="surface-compare" data-model-inspection-toggle="overview" role="button" tabindex="0" aria-label="保留表层水温作固定参照，比较当前深度">${side}</g>`;
  scene += `<polyline points="${pathPoints([[18, 4, 54], [90, 4, 54], [90, 64, 54], [18, 64, 54], [18, 4, 54]])}" fill="none" stroke="#788f8b" stroke-width="1.4"/>`;
  const axisX = 12, z = 59;
  scene += `<polyline points="${pathPoints([[18, 68, z], [90, 68, z]])}" fill="none" stroke="#657e7c" stroke-width="1.4"/>`;
  scene += `<polyline points="${pathPoints([[axisX, 64, z], [axisX, -8, z]])}" fill="none" stroke="#657e7c" stroke-width="1.4"/>`;
  for (const temp of TEMPERATURE_REFERENCE.temperatureAxisC) {
    const x = temperatureAxisX(temp);
    scene += `<polyline points="${pathPoints([[x, 68, z], [x, 66.8, z]])}" fill="none" stroke="#657e7c" stroke-width="1.4"/>`;
    scene += text(String(temp), [x, 76, 62]);
  }
  for (const depth of TEMPERATURE_REFERENCE.depthAxisKm) {
    const y = temperatureDepthY(depth);
    scene += `<polyline points="${pathPoints([[axisX, y, z], [axisX + 1.5, y, z]])}" fill="none" stroke="#657e7c" stroke-width="1.2"/>`;
    scene += text(String(depth), [4.5, y, 62]);
  }
  scene += text('km', [0, 76, 62], 28) + text('温度 / °C', TEMPERATURE_LAYOUT.temperatureUnit, 30);
  scene += `<polyline data-temperature-profile="fixed" points="${pathPoints(TEMPERATURE_PROFILE_CURVE)}" fill="none" stroke="#397f91" stroke-width="3"/>`;
  if (observation.active) {
    const reference = [...observation.reference] as TemperaturePoint, current = [...state.point] as TemperaturePoint;
    reference[2] = current[2] = 64;
    const corner: TemperaturePoint = [reference[0], current[1], 64];
    scene += `<g data-temperature-reference="surface"><polyline points="${pathPoints([reference, corner, current])}" fill="none" stroke="#a57a45" stroke-width="2.3" stroke-dasharray="5 4"/>${[reference, current].map(point => {
      const [x, y] = svgPoint(point); return `<path d="M${x - 5} ${y - 7}v14m10-14v14" fill="none" stroke="#a57a45" stroke-width="2"/>`;
    }).join('')}</g>`;
  }
  // The whole slice and its protruding front edge share the probe's y.
  scene += polygon([[17.5, state.sliceY, 53.8], [90.5, state.sliceY, 53.8], [90.5, state.sliceY, 59.3], [17.5, state.sliceY, 59.3]], '#d5c39e', 'data-temperature-depth-slice="true"');
  scene += `<polyline points="${pathPoints([state.point, state.probe])}" fill="none" stroke="#a98551" stroke-width="2"/>`;
  const [px, py] = svgPoint(state.point), [qx, qy] = svgPoint(state.probe);
  scene += `<circle data-temperature-curve-probe="true" data-position='${JSON.stringify(state.point)}' cx="${px}" cy="${py}" r="6" fill="#b58b54" stroke="#faf4e4" stroke-width="1.7"/>`;
  scene += `<polyline points="${pathPoints([[95, 64, 62], [95, 4, 62]])}" fill="none" stroke="#a69b80" stroke-width="1.3"/>`;
  scene += `<circle data-temperature-depth-probe="true" data-position='${JSON.stringify(state.probe)}' cx="${qx}" cy="${qy}" r="7" fill="#d4be8d" stroke="#827b60" stroke-width="1.4"/>`;
  TEMPERATURE_STOPS.forEach(stop => {
    const [x, y] = svgPoint(temperatureProfilePoint(stop.phase));
    scene += selectable(stop.selection, `<circle data-temperature-node="${stop.selection}" cx="${x}" cy="${y}" r="19" fill="transparent"/><circle cx="${x}" cy="${y}" r="4" fill="#f0e5cc" stroke="#628984" stroke-width="1.1"/>`, `观察${stop.label}，近似读图`);
  });
  const [labelX, labelY] = svgPoint(TEMPERATURE_LAYOUT.currentLabel.at);
  scene += `<g data-temperature-current-label="true"><rect x="${labelX - 222}" y="${labelY - 25}" width="444" height="50" rx="2" fill="#f7f1e3"/>${text(observation.active ? '固定表层参照' : state.note, TEMPERATURE_LAYOUT.currentLabel.at, 32)}</g>`;
  scene += `<polyline points="${pathPoints([TEMPERATURE_LAYOUT.track.start, TEMPERATURE_LAYOUT.track.end])}" fill="none" stroke="#a79b7f" stroke-width="1.8"/>`;
  const [hx, hy] = svgPoint(state.handle);
  scene += `<path data-temperature-handle="depth" d="M${hx - 10} ${hy}l10-7 10 7-10 7Z" fill="#ddc797" stroke="#887d62" stroke-width="1.2"/>`;
  TEMPERATURE_STOPS.forEach((stop, index) => {
    scene += selectable(index, text(stop.label, TEMPERATURE_LAYOUT.nodeLabels[index], 30), `观察${stop.label}，进度表示深度`);
  });
  const diagnostics = JSON.stringify(state).replace(/&/g, '&amp;').replace(/'/g, '&#39;');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="flat-model-svg flat-explanation-svg" viewBox="0 0 670 650" role="group" aria-label="${state.caption}。原教材曲线近似读图，观察进度表示深度，并非水温随时间变化。" data-inspection="${observation.inspection}" data-temperature-observation='${JSON.stringify(observation)}' data-temperature-phase="${state.phase}" data-temperature-stage="${state.stage}" data-temperature-state='${diagnostics}'><title>海水温度随深度变化：原教材图3.8近似读图</title><desc>原图近似读图，说明和读数随旁注呈现。</desc><g stroke-linecap="round" stroke-linejoin="round" font-family="FieldSerif,SimSun,serif">${scene}</g></svg>`;
}

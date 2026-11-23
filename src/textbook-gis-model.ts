import { surveyRailDrawing } from './textbook-survey-rail-drawing';

/** Textbook p.117 / PDF p.122 / fig.6.26.
 * These are positions in a printed explanatory drawing, not real GIS data.
 * The 33 symbols were located in page-122.webp; the three curved boundaries
 * were traced from its administrative-area layer. See output/gis-source-trace.json.
 * Counts are always derived from point-in-polygon membership, never supplied.
 */
export type GisPoint = readonly [number, number];
export type GisRegionId = 1 | 2 | 3;

export const GIS_PHASES = {
  separated: 0,
  aligned: .52,
  analysisStart: .56,
  regionStarts: [.56, .67, .79],
  regionEnds: [.67, .79, .90],
  result: .90,
} as const;

export const GIS_REFERENCE = {
  textbookPage: 117, pdfPage: 122, figure: '6.26', image: 'textbook/page-122.webp',
  imagePixels: [1530, 2147], stationLayerY: [970, 1147], regionLayerY: [1251, 1427],
  coordinateMeaning: 'positions-traced-from-the-textbook-diagram',
} as const;

const clamp = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
const smooth = (a: number, z: number, n: number) => {
  const q = clamp((n - a) / (z - a)); return q * q * (3 - 2 * q);
};

/** Undo the illustration's trapezoid. A shared map coordinate is used by all
 * layers; no rendered model samples the reference bitmap. */
function deproject([x, y]: GisPoint, top: number, bottom: number): GisPoint {
  const v = (y - top) / (bottom - top);
  const left = 419.5 + (254 - 419.5) * v;
  const right = 789.5 + (634.5 - 789.5) * v;
  return [clamp((x - left) / (right - left)), clamp(v)];
}
const regionPoint = (p: GisPoint) => deproject(p, 1251, 1427);
const regionPath = (p: readonly GisPoint[]) => p.map(regionPoint);

// One shared polyline per internal boundary removes the anti-aliased gaps of
// separate colour masks. Samples follow the printed curves, not count targets.
const seam13 = regionPath([
  [520.5, 1251], [519, 1263], [514, 1283], [506, 1299], [494, 1316], [489, 1322],
]);
const seam12 = regionPath([
  [489, 1322], [470.5, 1335], [447, 1345], [436, 1347.5], [393, 1347.5], [355, 1341.5],
]);
// Last point is exactly on the common sheet edge, rather than a pixel inset.
seam12.push([0, (1335.5 - 1251) / 176]);
const seam23 = regionPath([
  [489, 1322], [526, 1336], [541.5, 1346.5], [551.5, 1356.5], [560.5, 1370],
  [567.5, 1389], [570, 1407], [568.5, 1427],
]);

export const GIS_REGIONS: readonly {
  id: GisRegionId; color: string; stationColor: string; polygon: readonly GisPoint[]; label: GisPoint;
}[] = [
  { id: 1, color: '#cda7a5', stationColor: '#8a514d', polygon: [[0, 0], ...seam13, ...seam12.slice(1)], label: [.14, .23] },
  { id: 2, color: '#9bbcc3', stationColor: '#376d7b', polygon: [...seam12].reverse().concat(seam23.slice(1), [[0, 1]]), label: [.33, .76] },
  { id: 3, color: '#b8c69b', stationColor: '#5c754b', polygon: [...seam13, ...seam23.slice(1), [1, 1], [1, 0]], label: [.74, .45] },
];

// Bounding-box centres of all 33 rain-station symbols in the upper source
// layer. Their ordering is only for the explanation's top-to-bottom scan.
const stationPixels: readonly GisPoint[] = [
  [448.5, 981], [747, 983], [547, 983.5], [614, 984], [684, 984.5],
  [482.5, 1002.5], [397, 1014.5], [573, 1021], [714, 1025.5], [523, 1026.5],
  [654.5, 1029.5], [456, 1040.5], [415, 1044.5], [490, 1059.5], [567, 1066.5],
  [672, 1074.5], [620, 1079.5], [339, 1080], [533, 1082], [380, 1084.5],
  [445, 1085.5], [497, 1094.5], [403, 1104.5], [471, 1104.5], [346, 1110.5],
  [524, 1113.5], [586, 1123.5], [549, 1127], [625, 1127], [304, 1128.5],
  [379, 1128.5], [445, 1128.5], [494, 1130.5],
];
export const GIS_STATIONS = stationPixels.map((pixel, i) => ({
  id: `station-${String(i + 1).padStart(2, '0')}`, pixel, point: deproject(pixel, 970, 1147),
}));

export function pointInGisPolygon([x, y]: GisPoint, polygon: readonly GisPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j], b = polygon[i], dx = b[0] - a[0], dy = b[1] - a[1];
    const cross = (x - a[0]) * dy - (y - a[1]) * dx;
    if (Math.abs(cross) < 1e-10 && x >= Math.min(a[0], b[0]) - 1e-10 && x <= Math.max(a[0], b[0]) + 1e-10
      && y >= Math.min(a[1], b[1]) - 1e-10 && y <= Math.max(a[1], b[1]) + 1e-10) return true;
    if ((a[1] > y) !== (b[1] > y) && x < a[0] + (y - a[1]) * dx / dy) inside = !inside;
  }
  return inside;
}

export function gisRegionAt(point: GisPoint): GisRegionId | null {
  // On a shared boundary, lowest region ID is the documented tie breaker.
  return GIS_REGIONS.find(region => pointInGisPolygon(point, region.polygon))?.id ?? null;
}

export const GIS_MEMBERSHIP = GIS_STATIONS.map(station => ({ ...station, region: gisRegionAt(station.point) }));
export const GIS_COUNTS = GIS_REGIONS.map(region => ({
  id: region.id, count: GIS_MEMBERSHIP.filter(station => station.region === region.id).length,
}));

/** Pure, seekable state. `selection` is intentionally not an input: the host's
 * two controls seek phase 0 and phase 1; scrubbing can visit every in-between. */
export function evaluateGis(input: number) {
  const phase = clamp(input), overlay = smooth(0, GIS_PHASES.aligned, phase);
  const stations = GIS_MEMBERSHIP.map(station => {
    if (station.region === null) return { ...station, match: 0, counted: false };
    const regionIndex = station.region - 1;
    const peers = GIS_MEMBERSHIP.filter(item => item.region === station.region);
    const rank = peers.findIndex(item => item.id === station.id);
    const start = GIS_PHASES.regionStarts[regionIndex], end = GIS_PHASES.regionEnds[regionIndex];
    const step = (end - start) / peers.length, a = start + rank * step, z = a + step * .85;
    return { ...station, match: smooth(a, z, phase), counted: phase >= z };
  });
  const counts = GIS_REGIONS.map((region, i) => ({
    id: region.id,
    count: stations.filter(station => station.region === region.id && station.counted).length,
    visible: phase >= GIS_PHASES.regionStarts[i],
    complete: phase >= GIS_PHASES.regionEnds[i],
  }));
  const active = GIS_REGIONS.find((_, i) => phase >= GIS_PHASES.regionStarts[i] && phase < GIS_PHASES.regionEnds[i])?.id ?? null;
  return {
    phase, overlay, stations, counts, activeRegion: active,
    stage: phase === 0 ? 'separated' : phase < GIS_PHASES.aligned ? 'aligning'
      : phase < GIS_PHASES.analysisStart ? 'aligned' : phase < GIS_PHASES.result ? 'classifying' : 'result',
    layers: {
      regions: { y: 3, z: (1 - overlay) * 12 },
      stations: { y: 37 - overlay * 32.2, z: (1 - overlay) * -12 },
    },
    vellumOpacity: .80 - .73 * overlay,
    resultReady: phase >= GIS_PHASES.result,
  };
}
export type GisState = ReturnType<typeof evaluateGis>;

/** Independently drawn fallback; the same coordinates, membership and process
 * as the real 3-D layers. Only one set of station symbols is ever emitted. */
export function gisSvg(phase: number, _selection = 0, inspection = 'overview'): string {
  const s = evaluateGis(phase);
  const inspectedRegion = /^region-[012]$/.test(inspection) ? Number(inspection.slice(-1)) + 1 : null;
  const project = ([u, v]: GisPoint, layer: 'regions' | 'stations'): GisPoint =>
    [90 + u * 470 + (1 - v) * 96, 224 + v * 130 + s.layers[layer].z * 1.7 - s.layers[layer].y * 4];
  const poly = (points: readonly GisPoint[], layer: 'regions' | 'stations', dy = 0) => points.map(p => {
    const q = project(p, layer); return `${q[0].toFixed(2)},${(q[1] + dy).toFixed(2)}`;
  }).join(' ');
  const border: readonly GisPoint[] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const registration = (layer:'regions'|'stations') => [13,87].map(x=>{
    const [cx,cy]=project([(x-7)/86,57.1/54],layer);
    const body=layer==='regions'
      ? '<path d="M-4 0v-5l3-5h2l3 5v5Z" fill="#b2854c" stroke="#735633"/>'
      : '<ellipse rx="7" ry="4" fill="none" stroke="#997344" stroke-width="3"/>';
    return `<g transform="translate(${cx} ${cy})" pointer-events="none" aria-hidden="true"><path d="M2-7L0 0" stroke="#967243" stroke-width="3"/>${body}</g>`;
  }).join('');
  const labels = GIS_REGIONS.map(region => {
    const [x, y] = project(region.label, 'regions');
    return `<text x="${x}" y="${y + 6}" text-anchor="middle" font-size="23" opacity="${1 - smooth(.40, .56, s.phase)}">${region.id}</text>`;
  }).join('');
  const regions = GIS_REGIONS.map(region => `<polygon data-region="${region.id}" data-model-inspection="region-${region.id - 1}" data-model-inspect="region-${region.id - 1}" role="button" tabindex="0" aria-label="观察${region.id}区" points="${poly(region.polygon, 'regions')}" fill="${region.color}" stroke="#6f7a71" stroke-width="${inspectedRegion === region.id ? 4 : s.activeRegion === region.id ? 2.6 : 1}"/>`).join('');
  const stations = s.stations.map(station => {
    const [x, y] = project(station.point, 'stations');
    const region = GIS_REGIONS.find(r => r.id === station.region);
    return `<g data-station="${station.id}" data-region="${station.region}" data-counted="${station.counted}" ${station.region !== null ? `data-model-inspection="region-${station.region - 1}" data-model-inspect="region-${station.region - 1}" role="button" tabindex="0" aria-label="观察${station.region}区雨量站"` : ''} transform="translate(${x.toFixed(2)} ${y.toFixed(2)})">
      ${inspectedRegion !== null && inspectedRegion === station.region ? '<circle r="8" fill="none" stroke="#536c69" stroke-width="1.8"/>' : ''}
      ${station.match > 0 && station.match < 1 ? `<circle r="8" fill="none" stroke="${region?.stationColor}" opacity="${Math.sin(station.match * Math.PI)}"/>` : ''}
      <path d="M0-6C-1-3-4 .3-4 2.2A4 4 0 0 0 4 2.2C4 .3 1-3 0-6Z" fill="${station.counted ? region?.stationColor : '#648d9d'}" stroke="#455c60" stroke-width=".6"/>
    </g>`;
  }).join('');
  const totals = s.counts.map((region, i) => {
    const x=150+i*210,focus=region.id===inspectedRegion?'overview':`region-${i}`;
    return `<g data-model-inspection="${focus}" role="button" tabindex="0" aria-label="${focus==='overview'?'返回整体':`观察${region.id}区`}">
      <rect x="${x-65}" y="397" width="130" height="49" fill="transparent"/>
      <text data-region-count="${region.id}" x="${x}" y="425" text-anchor="middle" font-size="25">${region.id}区 ${region.visible?region.count:'—'}</text></g>`;
  }).join('');
  const caption = s.stage === 'separated' ? '雨量站图与行政区图分离' : s.stage === 'aligning' ? '同一位置的图层逐渐对齐'
    : s.stage === 'aligned' ? '图层已叠合' : s.stage === 'classifying' ? '按行政区归属雨量站' : '叠合得到各行政区雨量站个数';
  // Fade the two source-sheet titles before their planes overlap. Keeping
  // both titles until alignment makes them collide halfway through a seek.
  const titleAlpha = 1 - smooth(.20, .36, s.phase);
  return `<svg class="flat-model-svg flat-explanation-svg" viewBox="0 0 720 508" role="group" aria-label="${caption}" data-inspection="${inspectedRegion === null ? 'overview' : `region-${inspectedRegion - 1}`}" data-gis-stage="${s.stage}" data-station-count="${s.stations.length}">
    <g font-family="FieldSerif,SimSun,serif" fill="#303a40" stroke-linejoin="round">
      <g fill="#344c40" stroke="#6e5d42" stroke-width="2" pointer-events="none">
        <path d="M164 227V36Q164 23 174 25Q183 24 183 36L181 190Q180 207 197 218V227ZM637 227V36Q637 23 647 25Q656 24 656 36L654 190Q653 207 670 218V227Z"/>
        <path d="M173 37H647V46H173Z" fill="#75563c"/><path d="M170 33H649" stroke="#bb9c61" stroke-width="5"/>
        ${[0,1].map(i=>{const [x,y]=project([i,0],'stations'),cx=i?660:181;return `<circle cx="${cx}" cy="33" r="7" fill="#b29458"/><path d="M${cx+4} 35L${x} ${y}" stroke="#715d43" stroke-width="2.4"/>`}).join('')}
      </g>
      <polygon points="${poly(border, 'regions', 5)}" fill="#c9c1ae" stroke="#7c7d70"/>
      ${regions}${labels}${registration('regions')}
      <polygon pointer-events="none" points="${poly(border, 'stations', 3)}" fill="#e8e9dd" fill-opacity="${s.vellumOpacity}" stroke="#8d9b96" stroke-width="1.2"/>
      <polygon pointer-events="none" points="${poly(border, 'stations')}" fill="#edf0e7" fill-opacity="${s.vellumOpacity}" stroke="#6f827f" stroke-width="1.2"/>
      ${stations}${registration('stations')}
      <g opacity="${titleAlpha}" font-size="20"><text x="26" y="${project([0, .4], 'stations')[1]}">雨量站</text><text x="26" y="${project([0, .4], 'regions')[1]}">行政区</text></g>
      <g pointer-events="none"><rect x="58" y="394" width="600" height="56" rx="7" fill="#544334" stroke="#846b45"/>
        ${s.counts.map((region,i)=>{const x=150+210*i,total=GIS_COUNTS[i].count,step=4.7,gap=112-(total-1)*step;
          return `<rect x="${x-65}" y="397" width="130" height="36" rx="4" fill="#e2d7bc"/><path d="M${x-61} 441h122" stroke="#b69a64" stroke-width="2.2"/>`+
            Array.from({length:total},(_,j)=>`<ellipse cx="${x-56+j*step+(j<region.count?0:gap)}" cy="441" rx="2.1" ry="4" fill="${GIS_REGIONS[i].stationColor}"/>`).join('');
        }).join('')}</g>
      ${totals}
      ${surveyRailDrawing([91,471],[564,471],phase,82,'推拉地图套准滑柄','data-gis-slide=""',4.35)}
    </g></svg>`;
}

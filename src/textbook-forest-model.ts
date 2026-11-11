import { buildCrownSurface } from './textbook-natural-form-geometry';

/** Textbook p.83 / PDF p.88, fig.5.2 was checked against the local page.
 * This is one forest, viewed from its crown towards the ground. The slider
 * never represents growth, succession or elapsed time. Heights, colours and
 * the light curve below are schematic, not field measurements. */
export const FOREST_REFERENCE = Object.freeze({
  printedPage: 83, pdfPage: 88, figure: '5.2', title: '森林中的成层现象',
  source: 'textbook/page-088.webp', phaseMeaning: 'vertical-observation-position',
  phaseMeansElapsedTime: false, depictsGrowth: false, depictsSuccession: false,
  heightsAreMeasured: false, lightIsMeasured: false,
});

export const FOREST_STOPS = [
  { label: '乔木层', phase: 0, selection: 0 },
  { label: '灌木层', phase: .5, selection: 1 },
  { label: '草本层', phase: 1, selection: 2 },
] as const;
export type ForestPoint = [number, number, number];
export type ForestLayer = 0 | 1 | 2;
export interface ForestPlant { id: string; layer: ForestLayer; x: number; z: number; height: number; seed: number; }
type PartBase = { id: string; plantId: string; layer: ForestLayer; color: string };
export type ForestPart = PartBase & (
  | { kind: 'rod'; role: 'trunk' | 'branch' | 'stem'; start: ForestPoint; end: ForestPoint; radius: number; topRadius: number }
  | { kind: 'crown'; role: 'crown'; center: ForestPoint; radii: ForestPoint; seed: number }
  | { kind: 'leaf'; role: 'leaf'; points: ForestPoint[]; thickness: number }
);
export interface ForestMeshData { positions: number[]; indices: number[]; }

export const FOREST_LAYOUT = {
  ground: { min: [3, 0, 18] as ForestPoint, max: [84, 1.4, 57] as ForestPoint },
  observation: { minX: 2.5, maxX: 86, minZ: 17, maxZ: 59 },
  track: { start: [91, 42, 64] as ForestPoint, end: [91, 3, 64] as ForestPoint },
  labels: [[106.7, 42, 64.68], [106.7, 22.5, 64.68], [106.7, 3, 64.68]] as ForestPoint[],
} as const;

/** All stages retain these identities and exactly these static structures. */
export const FOREST_PLANTS: readonly ForestPlant[] = [
  ...[[15, 28, 43], [34, 22, 48], [57, 28, 45], [76, 35, 39], [45, 43, 34]].map(([x, z, height], i) =>
    ({ id: `tree-${i}`, layer: 0 as const, x, z, height, seed: i + 2 })),
  ...[[9, 47, 16], [25, 44, 23], [39, 36, 18], [60, 46, 21], [77, 50, 16], [68, 32, 17]].map(([x, z, height], i) =>
    ({ id: `shrub-${i}`, layer: 1 as const, x, z, height, seed: i + 11 })),
  ...[[7, 54, 3.2], [16, 52, 4.1], [22, 54, 3.7], [31, 50, 4.5], [38, 55, 3.4],
    [45, 51, 4.4], [53, 54, 3.8], [63, 53, 4.2], [72, 55, 3.2], [80, 54, 3.5],
    [21, 35, 3.8], [49, 34, 3.2], [57, 37, 4], [73, 42, 3.7]].map(([x, z, height], i) =>
    ({ id: `herb-${i}`, layer: 2 as const, x, z, height, seed: i + 21 })),
].map(plant => Object.freeze(plant));

function makeForestParts(): ForestPart[] {
  const parts: ForestPart[] = [];
  for (const plant of FOREST_PLANTS) {
    const { x, z, height: h, layer, seed, id: plantId } = plant, ground = 1.4;
    const base = { plantId, layer };
    const rod = (role: 'trunk' | 'branch' | 'stem', a: ForestPoint, end: ForestPoint, radius: number, topRadius = radius * .48) =>
      parts.push({ ...base, kind: 'rod', role, id: `${plantId}-${role}-${parts.length}`, start: a, end, radius, topRadius,
        color: layer === 2 ? '#84936c' : '#806b51' });
    const crown = (center: ForestPoint, radii: ForestPoint, variant: number) => parts.push({ ...base, kind: 'crown', role: 'crown',
      id: `${plantId}-crown-${variant}`, center, radii, seed: seed + variant * .7,
      color: (layer === 0 ? ['#71866e', '#829777', '#99a780'] : ['#899a71', '#a1ad80', '#93a378'])[variant % 3] });
    if (layer === 0) {
      rod('trunk', [x, ground, z], [x + .5, ground + h * .77, z], h * .022, h * .009);
      for (const side of [-1, 1]) rod('branch', [x + .2, ground + h * .48, z],
        [x + side * h * .12, ground + h * .76, z + side * h * .045], h * .009);
      crown([x, ground + h * .8, z], [h * .185, h * .205, h * .15], 0);
      crown([x - h * .115, ground + h * .72, z + h * .035], [h * .135, h * .14, h * .12], 1);
      crown([x + h * .125, ground + h * .755, z - h * .02], [h * .12, h * .155, h * .115], 2);
    } else if (layer === 1) {
      for (let j = 0; j < 3; j++) {
        const dx = (j - 1) * h * .16, dz = j === 1 ? -.7 : .5;
        rod('stem', [x + dx * .25, ground, z], [x + dx, ground + h * (.72 + j * .025), z + dz], h * .018);
        crown([x + dx, ground + h * (.66 + j * .045), z + dz], [h * .245, h * .28, h * .22], j);
      }
    } else {
      rod('stem', [x, ground, z], [x + .1, ground + h, z], .105, .045);
      for (let j = 0; j < 4; j++) {
        const angle = j * 2.399 + seed * .3, dx = Math.cos(angle), dz = Math.sin(angle);
        const spread = h * (.48 + (j % 2) * .08), y = ground + h * (.2 + j * .12);
        const start: ForestPoint = [x, y, z], tip: ForestPoint = [x + dx * spread, y + h * .51, z + dz * spread];
        const mid: ForestPoint = [(start[0] + tip[0]) / 2, y + h * .38, (start[2] + tip[2]) / 2];
        const w = h * .14;
        parts.push({ ...base, kind: 'leaf', role: 'leaf', id: `${plantId}-leaf-${j}`,
          points: [start, [mid[0] - dz * w, mid[1], mid[2] + dx * w], tip,
            [mid[0] + dz * w, mid[1], mid[2] - dx * w]], thickness: .09, color: j % 2 ? '#b7c19e' : '#a6b38e' });
      }
    }
  }
  return parts;
}
export const FOREST_PARTS: readonly ForestPart[] = makeForestParts();

/** Fixed tessellation is shared by the solid model and the SVG silhouettes. */
export function forestPartMeshData(part: ForestPart): ForestMeshData {
  const positions: number[] = [], indices: number[] = [];
  if (part.kind === 'crown') {
    // Botanical lobes share the atlas's natural-form vocabulary. The plant
    // identities, centres and stratum assignments remain unchanged.
    const surface = buildCrownSurface(part.layer === 0 ? 'deciduous' : 'shrub', part.seed);
    const low = part.layer === 0 ? -.44 : -.40, high = part.layer === 0 ? .60 : .48;
    for (let i = 0; i < surface.positions.length; i += 3) {
      positions.push(part.center[0] + surface.positions[i] * part.radii[0],
        part.center[1] + ((surface.positions[i + 1] - low) / (high - low) * 2 - 1) * part.radii[1],
        part.center[2] + surface.positions[i + 2] * part.radii[2]);
    }
    indices.push(...surface.indices);
  } else if (part.kind === 'rod') {
    const d = part.end.map((v, i) => v - part.start[i]), length = Math.hypot(...d);
    const axis = d.map(v => v / length), helper = Math.abs(axis[1]) > .8 ? [1, 0, 0] : [0, 1, 0];
    const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const u0 = cross(axis, helper), ul = Math.hypot(...u0), u = u0.map(v => v / ul), v = cross(axis, u), count = 8;
    for (let end = 0; end < 2; end++) for (let j = 0; j < count; j++) {
      const angle = j / count * Math.PI * 2, radius = end ? part.topRadius : part.radius, center = end ? part.end : part.start;
      positions.push(...center.map((c, i) => c + radius * (u[i] * Math.cos(angle) + v[i] * Math.sin(angle))));
    }
    positions.push(...part.start, ...part.end);
    for (let j = 0; j < count; j++) {
      const next = (j + 1) % count;
      indices.push(j, next, j + count, next, next + count, j + count,
        count * 2, next, j, count * 2 + 1, j + count, next + count);
    }
  } else {
    const [a, c, d] = part.points, u = c.map((v, i) => v - a[i]), v = d.map((value, i) => value - a[i]);
    const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const length = Math.hypot(...normal) || 1, count = part.points.length;
    for (const side of [-1, 1]) for (const p of part.points) positions.push(...p.map((value, i) => value + side * normal[i] / length * part.thickness / 2));
    indices.push(0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7);
    for (let j = 0; j < count; j++) { const next = (j + 1) % count; indices.push(j, next, j + count, next, next + count, j + count); }
  }
  return { positions, indices };
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
export function evaluateForest(input: number) {
  const phase = clamp(input), selection: ForestLayer = phase < .25 ? 0 : phase < .75 ? 1 : 2;
  // A linear height rail permits exact forward and backward pointer seeking.
  const observationHeight = 42 - 39 * phase;
  const relativeLight = .16 + .84 * (observationHeight - 3) / 39;
  const stage = (['canopy', 'shrub', 'forest-floor'] as const)[selection];
  const caption = [
    '乔木伸展树冠，占据较高的垂直空间。',
    '沿同一林地向下观察，灌木分布在树冠之下。',
    '到达林下，光照减弱，仍有适应该条件的草本植物。',
  ][selection];
  return { phase, selection, stageIndex: selection, activeStop: selection, selectedLayer: FOREST_STOPS[selection].label, stage, caption,
    observationHeight, relativeLight, lightLabel: (['较强', '减弱', '较弱'] as const)[selection],
    probe: [44.25, observationHeight, 38] as ForestPoint,
    handle: [91, observationHeight, 64] as ForestPoint,
    plants: FOREST_PLANTS, parts: FOREST_PARTS, allLayersRetained: true, plantStructuresAreStatic: true,
    phaseMeaning: 'vertical-observation-position' as const, phaseMeansElapsedTime: false,
    depictsGrowth: false, depictsSuccession: false, heightsAreMeasured: false, lightIsMeasured: false,
  };
}
export type ForestState = ReturnType<typeof evaluateForest>;

export function forestProject([x, y, z]: ForestPoint): [number, number] {
  return [35 + x * 5.25 + (z - 37) * .58, 342 - y * 4.8 + (z - 37) * .9];
}
const n = (value: number) => Number(value.toFixed(3));
const xy = (point: ForestPoint) => forestProject(point).map(n).join(',');
const polygon = (points: ForestPoint[], color: string, width = .8) => `<polygon points="${points.map(xy).join(' ')}" fill="${color}" stroke="#6c7663" stroke-width="${width}"/>`;
function hull(points: [number, number][]) {
  const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (a: number[], b: number[], c: number[]) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const half = (list: [number, number][]) => { const result: [number, number][] = []; for (const p of list) { while (result.length > 1 && cross(result.at(-2)!, result.at(-1)!, p) <= 0) result.pop(); result.push(p); } return result; };
  return half(sorted).slice(0, -1).concat(half(sorted.slice().reverse()).slice(0, -1));
}

/** Native vector fallback: the same plant identities, solid-part coordinates,
 * height and probe state, rather than an image of the textbook illustration. */
export function forestSvg(phase: number): string {
  const state = evaluateForest(phase), y = state.observationHeight;
  let body = polygon([[3, 1.4, 18], [84, 1.4, 18], [84, 1.4, 57], [3, 1.4, 57]], '#c4c5a6')
    + polygon([[3, 0, 57], [84, 0, 57], [84, 1.4, 57], [3, 1.4, 57]], '#d3c5a9');
  for (const plant of FOREST_PLANTS.slice().sort((a, b) => a.z - b.z)) {
    let plantBody = '';
    for (const part of FOREST_PARTS.filter(p => p.plantId === plant.id)) {
      if (part.kind === 'rod') plantBody += `<polyline points="${xy(part.start)} ${xy(part.end)}" fill="none" stroke="${part.color}" stroke-width="${n(Math.max(.9, part.radius * 7.8))}"/>`;
      else if (part.kind === 'leaf') plantBody += polygon(part.points, part.color, .55);
      else {
        const data = forestPartMeshData(part), points: [number, number][] = [];
        for (let i = 0; i < data.positions.length; i += 3) points.push(forestProject(data.positions.slice(i, i + 3) as ForestPoint));
        plantBody += `<polygon points="${hull(points).map(p => p.map(n).join(',')).join(' ')}" fill="${part.color}" stroke="#6c7663" stroke-width=".85"/>`;
      }
    }
    body += `<g data-forest-plant="${plant.id}" data-forest-layer="${plant.layer}" data-model-selection="${plant.layer}" role="button" tabindex="0" aria-label="查看${FOREST_STOPS[plant.layer].label}" style="cursor:pointer">${plantBody}</g>`;
  }
  const { minX, maxX, minZ, maxZ } = FOREST_LAYOUT.observation;
  const plane: ForestPoint[] = [[minX, y, minZ], [maxX, y, minZ], [maxX, y, maxZ], [minX, y, maxZ]];
  body += `<polygon data-forest-observation-plane="true" data-height="${n(y)}" points="${plane.map(xy).join(' ')}" fill="#bfa66d" fill-opacity=".055" stroke="#b29963" stroke-width="1"/>`;
  const [hx, hy] = forestProject(state.handle);
  body += `<polyline points="${xy(FOREST_LAYOUT.track.start)} ${xy(FOREST_LAYOUT.track.end)}" fill="none" stroke="#a99b7c" stroke-width="1.2"/>`
    + `<path data-forest-handle="true" d="M${n(hx - 9)} ${n(hy)}l9-6 9 6-9 6Z" fill="#d4bd88" stroke="#8f805f" stroke-width="1"/>`;
  FOREST_STOPS.forEach((stop, i) => {
    const [x, labelY] = forestProject(FOREST_LAYOUT.labels[i]);
    body += `<g data-forest-node="${i}" data-model-selection="${i}" role="button" tabindex="0" aria-label="观察${stop.label}" style="cursor:pointer"><text x="${n(x)}" y="${n(labelY)}" font-size="22" text-anchor="middle" fill="#374138" paint-order="stroke" stroke="#f7f1e3" stroke-width="4">${stop.label}</text></g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" class="flat-model-svg flat-explanation-svg" viewBox="0 0 680 420" role="group" data-forest-phase="${n(state.phase)}" data-forest-stage="${state.stage}" data-forest-selection="${state.selection}" data-forest-height="${n(y)}" data-forest-light="${n(state.relativeLight)}" aria-label="${state.caption} 同一片森林始终保留；滑动只改变观察位置，光照为相对示意。"><title>森林中的成层现象</title><g stroke-linejoin="round" stroke-linecap="round" font-family="FieldSerif,SimSun,serif">${body}</g></svg>`;
}

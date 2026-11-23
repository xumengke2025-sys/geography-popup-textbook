/** Textbook p.74 / fig.4.16: undercutting, collapse and a retreating cliff.
 * All coordinates and progress intervals below are teaching geometry, not
 * measured rock strength, elapsed years, erosion rates or a coastal forecast.
 * The other coastal landforms remain separate examples, not later stages. */
export const COASTAL_PROCESS_REFERENCE = Object.freeze({
  textbookPage: 74, figure: '4.16', measuredRates: false,
  progressMeansElapsedYears: false, allCoastsFollowThisSequence: false,
});

export const COASTAL_PROCESS_GEOMETRY = Object.freeze({
  minX: 7, maxX: 93, backZ: 4, coreFrontZ: 19, initialFrontZ: 29,
  platformFrontZ: 58, seaHeight: 3.15, maxUndercut: 9.05,
});
export const coastalArchProfile: ReadonlyArray<readonly [number,number]> = [[-14,0],[-13,6],[-11.8,11],[-12.1,13.3],[-9.7,16.1],[-7.6,16.7],
    [-5.8,18.7],[-2.5,18.1],[-.8,19.2],[3.2,17.9],[5.4,18.2],[8.9,16],
    [10.8,13.3],[10.3,10.5],[12.3,7.8],[12.8,3.3],[14,0],[7.1,0],
    [6.1,3.4],[6.7,6.7],[5.3,9.2],[3,11.8],[.4,12.2],[-1.4,11.4],[-3.2,11.6],
    [-5.1,9.2],[-5.8,7],[-6.9,6.4],[-6.7,3.1],[-7.7,0]];

export type CoastalPoint = [number, number, number];
export interface CoastalMeshData { positions: number[]; indices: number[]; }
export interface CoastalCollapseBlock {
  id: number; minX: number; maxX: number; fall: number; crack: number;
  state: 'attached' | 'falling' | 'deposited';
  angle: number; pivot: CoastalPoint; translation: CoastalPoint;
  exposedPlatform: number;
}
export interface CoastalProcessState {
  phase: number; stage: 'undercut' | 'fracture' | 'collapse' | 'platform';
  caption: string; undercut: number; blocks: CoastalCollapseBlock[];
  inventory: { attached: number; falling: number; deposited: number; total: number };
  exposedPlatform: number;
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const smooth = (a: number, b: number, t: number) => { const q = clamp((t - a) / (b - a)); return q * q * (3 - 2 * q); };
const G = COASTAL_PROCESS_GEOMETRY;
const boundaries = [G.minX, 35, 64, G.maxX];
const collapseStarts = [.49, .55, .60];
const collapseEnds = [.75, .82, .88];
const finalAngles = [1.35, 1.43, 1.32];
const notchWeights = [0, 0, .83, 1, .78, 0, 0];

export const coastalShoreOffset = (x: number) => 2.05*Math.sin(x*.085)+.82*Math.sin(x*.24)+.32*Math.cos(x*.51);
export const coastalRockTop = (x: number) => 25.8+2.1*Math.sin(x*.13)+1.25*Math.cos(x*.31)+.52*Math.sin(x*.68);
/** The gently seaward-sloping platform never moves or grows during collapse. */
export const coastalPlatformHeight = (z: number) => 3.82 - .027 * (z - G.backZ);

function blockRestPoint(x: number, layer: number, front: boolean, undercut: number): CoastalPoint {
  // Both neighbours meet on the same inclined joint. The cut leans through
  // the thickness of the cliff instead of splitting the shore into cuboids.
  const reach = Math.sin(Math.PI*(x-G.minX)/(G.maxX-G.minX));
  const jointX = front ? x+reach*(2.4*Math.sin(x*.09)+(layer/6-.5)*4.1) : x;
  const back = G.coreFrontZ + coastalShoreOffset(x);
  const crownLip = layer>=5 ? (layer-4)*(.48+.57*Math.sin(x*.21)) : 0;
  const z = front ? G.initialFrontZ + coastalShoreOffset(x) + crownLip - undercut * notchWeights[layer] : back;
  const heights = [coastalPlatformHeight(z), 4.05, 5.05, 6.45, 8.25, 10.4, coastalRockTop(x)];
  return [jointX, heights[layer], z];
}

/** A y-monotone section is joined through matching vertices. Every body has
 * actual front/back/top/bottom/cut faces and a fixed, closed index buffer. */
function sectionSolid(minX: number, maxX: number, sections: number, layers: number,
  point: (x: number, layer: number, front: boolean) => CoastalPoint): CoastalMeshData {
  const positions: number[] = [], indices: number[] = [];
  const index = (i: number, j: number, side: number) => (i * layers + j) * 2 + side;
  const quad = (a: number, b: number, c: number, d: number) => indices.push(a, c, b, a, d, c);
  for (let i = 0; i <= sections; i++) for (let j = 0; j < layers; j++) {
    const x = minX + (maxX - minX) * i / sections;
    positions.push(...point(x, j, false), ...point(x, j, true));
  }
  for (let i = 0; i < sections; i++) {
    for (let j = 0; j < layers - 1; j++) {
      quad(index(i, j, 0), index(i + 1, j, 0), index(i + 1, j + 1, 0), index(i, j + 1, 0));
      quad(index(i, j, 1), index(i, j + 1, 1), index(i + 1, j + 1, 1), index(i + 1, j, 1));
    }
    quad(index(i, 0, 0), index(i, 0, 1), index(i + 1, 0, 1), index(i + 1, 0, 0));
    quad(index(i, layers - 1, 0), index(i + 1, layers - 1, 0), index(i + 1, layers - 1, 1), index(i, layers - 1, 1));
  }
  for (let j = 0; j < layers - 1; j++) {
    quad(index(0, j, 0), index(0, j + 1, 0), index(0, j + 1, 1), index(0, j, 1));
    quad(index(sections, j, 0), index(sections, j, 1), index(sections, j + 1, 1), index(sections, j + 1, 0));
  }
  return { positions, indices };
}

export function transformCoastalBlock(point: CoastalPoint, block: CoastalCollapseBlock): CoastalPoint {
  const y = point[1] - block.pivot[1], z = point[2] - block.pivot[2];
  return [point[0] + block.translation[0],
    block.pivot[1] + y * Math.cos(block.angle) - z * Math.sin(block.angle) + block.translation[1],
    block.pivot[2] + y * Math.sin(block.angle) + z * Math.cos(block.angle) + block.translation[2]];
}

export function evaluateCoastalProcess(progress: number): CoastalProcessState {
  const phase = clamp(progress), undercut = G.maxUndercut * smooth(.045, .425, phase);
  const blocks = collapseStarts.map((start, id): CoastalCollapseBlock => {
    const minX = boundaries[id], maxX = boundaries[id + 1], centerX = (minX + maxX) / 2;
    const fall = smooth(start, collapseEnds[id], phase), crack = smooth(start - .10, start - .012, phase);
    const toe = G.initialFrontZ + coastalShoreOffset(centerX);
    const block: CoastalCollapseBlock = { id, minX, maxX, fall, crack,
      state: phase >= collapseEnds[id] ? 'deposited' : phase > start ? 'falling' : 'attached',
      angle: finalAngles[id] * fall, pivot: [centerX, coastalPlatformHeight(toe), toe],
      translation: [(id - 1) * .45 * fall, 0, .42 * crack + (1.55 + id * .2) * fall], exposedPlatform: 0 };
    // A contact correction prevents the rotating finite slab entering the fixed
    // platform. It is geometry support, not a simulated rigid-body calculation.
    let clearance = 0, nearest = Infinity;
    for (let i = 0; i <= 9; i++) for (let j = 0; j < notchWeights.length; j++) for (const front of [false, true]) {
      const q = transformCoastalBlock(blockRestPoint(minX + (maxX - minX) * i / 9, j, front, undercut), block);
      clearance = Math.max(clearance, coastalPlatformHeight(q[2]) - q[1]); nearest = Math.min(nearest, q[2] - (G.coreFrontZ + coastalShoreOffset(q[0])));
    }
    block.translation[1] = Math.max(0, clearance);
    block.exposedPlatform = Math.max(0, nearest);
    return block;
  });
  const stage = phase < .39 ? 'undercut' : phase < collapseStarts[0] ? 'fracture' : phase < collapseEnds[2] ? 'collapse' : 'platform';
  const caption = { undercut: '浪蚀掏空崖脚', fracture: '上部岩体失去支撑', collapse: '岩块断裂、崩落', platform: '岸壁后退，平台留在原位' }[stage];
  const inventory = { attached: blocks.filter(b => b.state === 'attached').length,
    falling: blocks.filter(b => b.state === 'falling').length,
    deposited: blocks.filter(b => b.state === 'deposited').length, total: blocks.length };
  return { phase, stage, caption, undercut, blocks, inventory,
    exposedPlatform: blocks.reduce((sum, b) => sum + b.exposedPlatform * (b.maxX - b.minX), 0) / (G.maxX - G.minX) };
}

/** Permanent bedrock: neither an inward translation nor a scale animation. */
export function coastalCoreGeometry(): CoastalMeshData {
  return sectionSolid(G.minX, G.maxX, 30, 2, (x, layer, front) => {
    const z = front ? G.coreFrontZ + coastalShoreOffset(x) : G.backZ;
    return [x, layer ? coastalRockTop(x) : coastalPlatformHeight(z), z];
  });
}

export function coastalPlatformGeometry(): CoastalMeshData {
  return sectionSolid(3, 97, 22, 2, (x, layer, front) => {
    const z = front ? G.platformFrontZ + .3 * Math.sin(x * .2) : 2;
    return [x, layer ? coastalPlatformHeight(z) : .8, z];
  });
}

export function coastalBlockGeometry(state: CoastalProcessState, blockId: number): CoastalMeshData {
  const block = state.blocks[blockId];
  const geometry = sectionSolid(block.minX, block.maxX, 9, notchWeights.length,
    (x, layer, front) => transformCoastalBlock(blockRestPoint(x, layer, front, state.undercut), block));
  return geometry;
}

/** Sparse ink contours also share the exact notch and the rigid slab motion. */
export function coastalBlockContours(state: CoastalProcessState, blockId: number): CoastalPoint[][] {
  const b = state.blocks[blockId], to = (x: number, layer: number, front: boolean) => transformCoastalBlock(blockRestPoint(x, layer, front, state.undercut), b);
  const contours: CoastalPoint[][] = [b.minX, b.maxX].map(x => [
    to(x, 0, false), ...notchWeights.map((_, j) => to(x, j, true)), to(x, notchWeights.length - 1, false), to(x, 0, false),
  ]);
  for (const layer of [0, 3, 5, 6]) contours.push(Array.from({ length: 10 }, (_, i) => to(b.minX + (b.maxX - b.minX) * i / 9, layer, true)));
  contours.push(Array.from({ length: 10 }, (_, i) => to(b.minX + (b.maxX - b.minX) * i / 9, 6, false)));
  return contours;
}

const fmt = (n: number) => Number(n.toFixed(4));
/** The vector fallback projects the same finite bodies, not a second movie. */
export function coastalProcessSvg(progress: number): string {
  const state = evaluateCoastalProcess(progress);
  const project = ([x, y, z]: CoastalPoint): [number, number] => [58 + x * 4.4 + z * 1.37, 219 - y * 4.9 + z * 1.05 - x * .18];
  const path = (points: CoastalPoint[], fill: string, stroke = '#655e51', width = 1.15) => `<path d="M${points.map(p => project(p).map(fmt).join(',')).join('L')}Z" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
  const wire = (points: CoastalPoint[], color = '#655e51', width = 1) => `<path d="M${points.map(p => project(p).map(fmt).join(',')).join('L')}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
  const meshFaces = (geometry: CoastalMeshData, color: string) => {
    const points: CoastalPoint[] = [];
    for (let i = 0; i < geometry.positions.length; i += 3) points.push(geometry.positions.slice(i, i + 3) as CoastalPoint);
    const faces: { order: number; points: CoastalPoint[]; shade: boolean }[] = [];
    for (let i = 0; i < geometry.indices.length; i += 3) {
      const f = geometry.indices.slice(i, i + 3).map(k => points[k]);
      const a = f[0], b = f[1], c = f[2], nx = (b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),
        ny = (b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]), nz = (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
      // The signed screen cross product keeps the visible side of each closed
      // solid. Winding is shared with the WebGL geometry and checked in tests.
      const pa = project(a), pb = project(b), pc = project(c);
      if ((pb[0]-pa[0])*(pc[1]-pa[1])-(pb[1]-pa[1])*(pc[0]-pa[0]) >= 0) continue;
      faces.push({ order: f.reduce((sum, p) => sum + p[2] - p[0] * .18 + p[1] * .08, 0) / 3, points: f, shade: Math.abs(nx) > Math.abs(ny) + Math.abs(nz) * .1 });
    }
    return faces.sort((a, b) => a.order - b.order).map(f => path(f.points, f.shade ? '#a99b84' : color, 'none')).join('');
  };
  let body = path([[3, .8, 2], [97, .8, 2], [97, .8, 61], [3, .8, 61]], '#b8b2a2');
  body += meshFaces(coastalPlatformGeometry(), '#c4b59b');
  const waterline=G.backZ+(3.82-G.seaHeight)/.027;
  body += '<g opacity=".69">'+path([[3,G.seaHeight,waterline],[97,G.seaHeight,waterline],[97,G.seaHeight,61],[3,G.seaHeight,61]],'#84b3b9','none')+'</g>';
  body += meshFaces(coastalCoreGeometry(), '#b7a991');
  for (const block of state.blocks) {
    body += `<g data-coastal-block="${block.id}" data-state="${block.state}" data-fall="${fmt(block.fall)}">` + meshFaces(coastalBlockGeometry(state, block.id), '#c4b39a');
    body += coastalBlockContours(state, block.id).map(points => wire(points, '#625d52', 1.1)).join('') + '</g>';
  }
  for (const x of [G.minX, G.maxX]) body += wire([[x, coastalRockTop(x), G.backZ], [x, coastalRockTop(x), G.coreFrontZ + coastalShoreOffset(x)], [x, coastalPlatformHeight(G.coreFrontZ), G.coreFrontZ + coastalShoreOffset(x)]]);
  for (let j = 0; j < 3; j++) {
    const z = 57 - ((state.phase * 3.1 + j / 3) % 1) * 20;
    body += wire(Array.from({ length: 28 }, (_, i): CoastalPoint => [8 + i * 3.15, G.seaHeight + .08, z + .45 * Math.sin(i * .45)]), '#73969e', 1.15);
  }
  const probes = state.blocks.map(b => ({ id: b.id, state: b.state, fall: fmt(b.fall), translation: b.translation.map(fmt), angle: fmt(b.angle) }));
  body += '<text x="95" y="81" fill="#303a40" font-size="34" font-family="FieldSerif,SimSun,serif">海蚀崖</text>';
  if (state.exposedPlatform > 2) body += '<text x="420" y="308" fill="#303a40" font-size="34" font-family="FieldSerif,SimSun,serif">原位平台</text>';
  body += `<text x="320" y="366" text-anchor="middle" fill="#303a40" font-size="34" font-family="FieldSerif,SimSun,serif">${state.caption}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="flat-model-svg flat-explanation-svg" viewBox="0 0 640 390" role="img" data-coastal-process="${state.stage}" data-phase="${fmt(state.phase)}" data-undercut="${fmt(state.undercut)}" data-block-probes='${JSON.stringify(probes)}' aria-label="海蚀崖与海蚀平台：浪蚀掏空崖脚，上部岩块断裂崩落，岸壁后退，平台留在原位；示意进度不表示真实年限或侵蚀速率，其他海岸形态不是必经阶段。"><title>图4.16 海蚀崖与平台的形成过程</title><g stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;
}

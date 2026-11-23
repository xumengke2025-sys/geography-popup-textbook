import { drawingGrip } from './textbook-drawing-grip';
import { botanicalBlade } from './textbook-botanical-blade';
const broadBlade=botanicalBlade(false);

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
export interface ForestMeshData { positions: number[]; indices: number[]; sprayEnds?: number[]; }

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
      rod('trunk', [x, ground, z], [x + .5, ground + h * .88, z], h * .022, h * .006);
      // A rising series of forked boughs leaves windows through the canopy.
      // Each terminal mass is supported by the fork that locates it.
      for (let j = 0; j < 9; j++) {
        const level = j / 8, angle = seed + j * 2.39996 + .34*Math.sin(seed*.8+3.7*j);
        const reach = h * (.213 - .102 * level)*(.93+.15*Math.cos(seed+j*1.87));
        const root: ForestPoint = [x + .5 * level, ground + h * (.48 + .38 * level), z];
        const elbow: ForestPoint = [root[0]+Math.cos(angle)*reach*.54,root[1]+h*.09,root[2]+Math.sin(angle)*reach*.54];
        rod('branch',root,elbow,h*(.011-.005*level));
        for (const side of [-1,1]) {
          const yaw = angle + side * .52;
          const tip: ForestPoint = [elbow[0]+Math.cos(yaw)*reach*.64, elbow[1]+h*(.046+.018*side), elbow[2]+Math.sin(yaw)*reach*.64];
          rod('branch',elbow,tip,h*.0045,h*.0017);
          crown(tip,[h*(.119+.013*Math.cos(seed+j)),h*(.066+.011*Math.sin(j+seed)),h*(.104+.013*Math.cos(3*j+seed))],2*j+(side+1)/2);
        }
      }
    } else if (layer === 1) {
      for (let j = 0; j < 3; j++) {
        const dx = (j - 1) * h * .16, dz = j === 1 ? -.7 : .5;
        rod('stem', [x + dx * .25, ground, z], [x + dx, ground + h * (.72 + j * .025), z + dz], h * .018);
        for (const sign of [-1,1]) {
          const yaw=seed+j*2.13+sign*.82,root:ForestPoint=[x+dx*.66,ground+h*(.39+.068*j),z+dz*.68];
          const tip:ForestPoint=[x+dx+h*.18*Math.cos(yaw),ground+h*(.66+.05*j+.036*sign),z+dz+h*.21*Math.sin(yaw)];
          rod('branch',root,tip,h*.012,h*.0022);
          crown(tip,[h*(.168+.022*Math.cos(seed)),h*.165,h*.17],(j*2+(sign+1)/2));
        }
      }
    } else {
      rod('stem', [x, ground, z], [x + .1, ground + h, z], .105, .045);
      for (let j = 0; j < 6; j++) {
        const angle = j * 2.399 + seed * .3, dx = Math.cos(angle), dz = Math.sin(angle);
        const spread = h * (.48 + (j % 2) * .08), y = ground + h * (.14 + j * .10);
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
    const blade = broadBlade;
    const sprayEnds: number[] = [];
    const [cx,cy,cz] = part.center, [rx,ry,rz] = part.radii;
    for(let twig=0;twig<8;twig++){
      const yaw=part.seed+twig*2.39996+.31*Math.sin(2.13*twig+part.seed), level=twig/7;
      const span=(.95-.40*level)*(.89+.14*Math.cos(twig+part.seed)), lift=-.36+1.19*level;
      const tip: ForestPoint=[cx+rx*span*Math.cos(yaw),cy+ry*lift,cz+rz*span*Math.sin(yaw)];
      const stem=forestPartMeshData({...part,kind:'rod',role:'branch',start:part.center,end:tip,radius:rx*.029,topRadius:rx*.012});
      const offset=positions.length/3;
      positions.push(...stem.positions);indices.push(...stem.indices.map(k=>k+offset));
      for(let pair=0;pair<3;pair++)for(const side of [-1,1]){
        const q=.25+pair*.34, dir=yaw+side*(1.10-.21*pair), length=.51+.08*Math.sin(twig+part.seed);
        const alongX=Math.cos(dir), alongZ=Math.sin(dir), start=positions.length/3;
        for(let i=0;i<blade.positions.length;i+=3){
          const t=blade.positions[i],along=t*length,across=blade.positions[i+2]*.93;
          positions.push(cx+(tip[0]-cx)*q+rx*(along*alongX-across*alongZ),
            cy+(tip[1]-cy)*q+ry*(blade.positions[i+1]*1.7+.17*Math.sin(t*Math.PI)+(.16*Math.cos(twig*2.36+pair+part.seed)-.09)*t+across*.53*Math.sin(dir+part.seed)),
            cz+(tip[2]-cz)*q+rz*(along*alongZ+across*alongX));
        }
        indices.push(...blade.indices.map(k=>k+start));
      }
      sprayEnds.push(positions.length);
    }
    return {positions, indices, sprayEnds};
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
function forestSpecimenSvg(): string {
  let body = '<path d="M35 355L469 360 506 345 503 369 464 383 38 375Z" fill="#725940" stroke="#5c4b38"/><path d="M36 361l428 9 39-17" fill="none" stroke="#bd9e66" stroke-width="3"/>'
    + polygon([[3, 1.4, 18], [84, 1.4, 18], [84, 1.4, 57], [3, 1.4, 57]], '#c4c5a6')
    + polygon([[3, 0, 57], [84, 0, 57], [84, 1.4, 57], [3, 1.4, 57]], '#d3c5a9');
  for(let j=0;j<90;j++){
    const u=(j*.618034)%1,v=(j*.41793)%1,x=4+u*78,z=19+v*36;
    body+=polygon([[x,1.55,z],[x+.25,1.64,z+.20],[x+.71,1.58,z+.11],[x+.22,1.55,z-.15]],j%2?'#aa9a72':'#8b8066',.15);
  }
  for (const plant of FOREST_PLANTS.slice().sort((a, b) => a.z - b.z)) {
    let plantBody = '';
    for (const part of FOREST_PARTS.filter(p => p.plantId === plant.id)) {
      if (part.kind === 'rod') plantBody += `<polyline points="${xy(part.start)} ${xy(part.end)}" fill="none" stroke="${part.color}" stroke-width="${n(Math.max(.9, part.radius * 7.8))}"/>`;
      else if (part.kind === 'leaf') plantBody += polygon(part.points, part.color, .55);
      else {
        const data = forestPartMeshData(part);
        let start = 0;
        const sprays: string[] = [];
        for (const end of data.sprayEnds ?? [data.positions.length]){
          const points: [number,number][] = [];
          for(let i=start;i<end;i+=3)points.push(forestProject(data.positions.slice(i,i+3) as ForestPoint));
          sprays.push('M'+hull(points).map(p=>p.map(n).join(',')).join('L')+'Z');
          start=end;
        }
        plantBody += `<path d="${sprays.join('')}" fill="${part.color}" stroke="#6c7663" stroke-width=".36"/>`;
      }
    }
    body += `<g data-forest-plant="${plant.id}" data-forest-layer="${plant.layer}" data-model-selection="${plant.layer}" role="button" tabindex="0" aria-label="查看${FOREST_STOPS[plant.layer].label}" style="cursor:pointer">${plantBody}</g>`;
  }
  return body;
}

let specimenSvg: string | undefined;
export function forestSvg(phase: number): string {
  const state = evaluateForest(phase), y = state.observationHeight;
  let body = specimenSvg ??= forestSpecimenSvg();
  const { minX, maxX, minZ, maxZ } = FOREST_LAYOUT.observation;
  const plane: ForestPoint[] = [[minX, y, minZ], [maxX, y, minZ], [maxX, y, maxZ], [minX, y, maxZ]];
  body += `<polygon data-forest-observation-plane="true" data-height="${n(y)}" points="${plane.map(xy).join(' ')}" fill="#bfa66d" fill-opacity=".055" stroke="#b29963" stroke-width="1"/>`;
  const [hx, hy] = forestProject(state.handle);
  const [gx,gy]=forestProject([0,42,63]),[gx2,gy2]=forestProject([0,3,63]);
  body+=`<path d="M${gx} ${gy}L${gx2} ${gy2}" stroke="#8e7958" stroke-width="7"/>`;
  for(let i=0;i<12;i++){const t=i/11,Y=gy+(gy2-gy)*t;body+=`<path d="M${gx-1} ${Y}h4" stroke="rgb(${196-86*t},${183-76*t},${123-33*t})" stroke-width="11"/>`;}
  body+=`<path d="M${gx-7} ${gy+(gy2-gy)*state.phase}h14" stroke="#ded8b9" stroke-width="5"/>`;
  body += `<polyline points="${xy(FOREST_LAYOUT.track.start)} ${xy(FOREST_LAYOUT.track.end)}" fill="none" stroke="#a58b61" stroke-width="4"/>`
    + `<path data-forest-handle="true" d="M${n(hx-8)} ${n(hy-6)}h16l4 6-4 6h-16l-4-6Z" fill="#b29967" stroke="#796a52" stroke-width="1.3"/>${drawingGrip('升降林层测架',forestProject(FOREST_LAYOUT.track.start),forestProject(FOREST_LAYOUT.track.end),state.phase)}`;
  FOREST_STOPS.forEach((stop, i) => {
    const [x, labelY] = forestProject(FOREST_LAYOUT.labels[i]);
    body += `<g data-forest-node="${i}" data-model-selection="${i}" role="button" tabindex="0" aria-label="观察${stop.label}" style="cursor:pointer"><rect x="${n(x-44)}" y="${n(labelY-18)}" width="88" height="29" rx="2" fill="#e5dbc1" stroke="#9d865c" stroke-width="2"/><text x="${n(x)}" y="${n(labelY+3)}" font-size="21" text-anchor="middle" fill="#374138" >${stop.label}</text></g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" class="flat-model-svg forest-comparator-drawing" viewBox="0 0 680 420" role="group" data-forest-phase="${n(state.phase)}" data-forest-stage="${state.stage}" data-forest-selection="${state.selection}" data-forest-height="${n(y)}" data-forest-light="${n(state.relativeLight)}" aria-label="${state.caption} 同一片森林始终保留；滑动只改变观察位置，光照为相对示意。"><title>森林中的成层现象</title><style>@media(max-width:480px){.forest-comparator-drawing text{font-size:29px}}</style><g stroke-linejoin="round" stroke-linecap="round" font-family="FieldSerif,SimSun,serif">${body}</g></svg>`;
}

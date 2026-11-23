/** Textbook p.108: a coherent body slides along a slip surface; a debris flow
 * is water-bearing loose material moving along a mountain gully. These are
 * independent schematic trials, not successive stages of one disaster.
 * Coordinates, finite stock, and phase have no field-measurement units. */
export type LandslidePoint = [number, number, number];
export type LandslideMode = 'landslide' | 'debris-flow';
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const smooth = (n: number) => { const q = clamp(n); return q * q * (3 - 2 * q); };
const interval = (n: number, a: number, z: number) => smooth((n - a) / (z - a));
export const LANDSLIDE_LAYOUT = { left: 6, right: 96, back: 8, front: 62, sourceX: 24, toeX: 78,
  centerZ: 35, flowRows: 12, flowColumns: 10, flowBulkVolume: 340, coarseCount: 24 } as const;
export const LANDSLIDE_REFERENCE = { printedPages: [108], illustration: '图6.12—6.13',
  units: 'uncalibrated-teaching-geometry', separateTrials: true, prediction: false } as const;

/** A straight upper slope joins a flat foot with continuous height and grade. */
export function landslideGrade(x: number): number {
  if (x <= 56) return 6.68 + (56 - x) * .46;
  if (x >= 72) return 3;
  const q = (x - 56) / 16;
  return 6.68 - .46 * 16 * (q - q ** 3 + .5 * q ** 4);
}
export function debrisChannelZ(x: number): number { return 35 + 2.6 * Math.sin((x - 17) / 60 * Math.PI); }
export function landslideScarp(x:number,z:number) {
  const across=Math.abs(z-LANDSLIDE_LAYOUT.centerZ);
  const rim=Math.min(15.7,15.7-.025*across*across+.75*Math.sin(.56*z)+.31*Math.cos(.81*z));
  const depth=Math.hypot(Math.max(0,rim-x),Math.max(0,across-9.84));
  const extent=(1-smooth((x-23)/11))*(1-smooth((across-10.4)/8.5));
  const face=smooth(depth/1.14)*(1-smooth((depth-1.13)/4.1))*extent;
  const joint=.5+.5*Math.cos(z*1.72+x*.46+.51*Math.sin(.88*z));
  const relief=face*(4.1+.82*Math.sin(.29*z)-.9*joint**5);
  return {face,relief};
}
export function landslideGround(x: number, z: number, mode: LandslideMode): number {
  // The coherent specimen runs on its original slip surface. Beyond its
  // footprint, resistant spurs border the runout and taper into the foot.
  const side = smooth((Math.abs(z-LANDSLIDE_LAYOUT.centerZ)-10)/10);
  const spur = 10.6*Math.exp(-(((x-23+.32*z)/18)**2+((z-14)/9)**2))
    + 6.7*Math.exp(-(((x-43-.17*z)/17)**2+((z-54)/10)**2))
    + 4.3*Math.exp(-(((x-63)/13)**2+((z-16)/10)**2));
  const relief = side*(spur+1.15*(1+Math.sin(.19*x+.29*z))*(1-interval(x,45,79)));
  if (mode === 'landslide') {
    return landslideGrade(x)+relief+landslideScarp(x,z).relief;
  }
  const offset = Math.abs(z - debrisChannelZ(x)), bank = smooth((offset - 4.7) / 11);
  return landslideGrade(x) + relief + 6.2 * bank * (1 - interval(x, 57, 78));
}
const footprint: readonly (readonly [number, number])[] = [
  [-8.5, -4], [-8, -8], [3.2, -9.5], [8.5, -6], [7.8, 7.8], [2.5, 9.3], [-7, 8.2], [-8.5, 2.5],
];
const polygonArea = (p: readonly (readonly [number, number])[]) => Math.abs(p.reduce((a, q, i) => {
  const r = p[(i + 1) % p.length]; return a + q[0] * r[1] - r[0] * q[1];
}, 0)) / 2;
export const SLIDE_BODY_VOLUME = polygonArea(footprint) * 3.2;

// Small rooted tufts are landmarks on the coherent piece. Both views use
// the same leaf midribs and the same rigid pose as the upper slip material.
export const slideLeaves = [[-4,-3,2.1],[.8,-4.7,1.55],[3.7,2.9,1.85],[-3.4,5.1,1.25]].flatMap(([x,z,h],i)=>
  Array.from({length:7},(_,j)=>{
    const angle=i*.73+j*2.4,dx=Math.cos(angle),dz=Math.sin(angle),length=h*(.81+.18*Math.cos(j+i));
    const halfWidth=.13*h;
    return [[x,3.2,z],[x+length*.42*dx-halfWidth*dz,3.2+length*.68,z+length*.42*dz+halfWidth*dx],
      [x+length*dx,3.2+length*(.83+.16*Math.sin(j)),z+length*dz],
      [x+length*.42*dx+halfWidth*dz,3.2+length*.68,z+length*.42*dz-halfWidth*dx],
      [x+length*.42*dx,3.2+length*.77,z+length*.42*dz]] as LandslidePoint[];
  }));

function slideBody(phase: number) {
  const travel = interval(phase, .06, .84), x = 24 + 54 * travel;
  const derivative = x <= 56 ? -.46 : x >= 72 ? 0 : -.46 * (1 - smooth((x - 56) / 16));
  const pitch = Math.atan(derivative), c = Math.cos(pitch), s = Math.sin(pitch);
  // A rigid slab rests above every point under its footprint at the slope/foot
  // transition. Its eight corners, thickness, and volume never change.
  let support = -Infinity;
  for (let i = 0; i <= 32; i++) {
    const dx = -8.5 + 17 * i / 32;
    support = Math.max(support, landslideGrade(x + dx * c) - dx * s);
  }
  const at = (u: number, v: number, h: number): LandslidePoint => [x + u * c - h * s, support + u * s + h * c + .025, 35 + v];
  return { travel, x, z: 35, y: support + .025, pitch, volume: SLIDE_BODY_VOLUME,
    lower: footprint.map(([u, v]) => at(u, v, 0)), upper: footprint.map(([u, v]) => at(u, v, 3.2)),
    seams: [[[-6, -3], [-1, -1], [3, -2], [6, 0]], [[-5, 5], [-2, 4], [2, 5]]].map(line => line.map(([u, v]) => at(u, v, 3.24))),
  };
}

const clastCells=[[1,2],[1,6],[2,8],[3,1],[3,4],[3,7],[4,8],[5,2],[5,7],[6,3],[6,6],[7,1],
      [7,4],[7,9],[8,6],[8,8],[9,2],[9,5],[10,1],[10,7],[11,3],[11,8],[12,2],[12,6]];

interface FlowVertex { x: number; z: number; bottom: number; profile: number }
const triangleArea = (a: FlowVertex, b: FlowVertex, c: FlowVertex) =>
  Math.abs((b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z)) / 2;

/** One fixed-topology, closed mud/water volume. The leading edge reaches the
 * foot before the tail; widening there reduces depth instead of creating mud.
 * Coarse fragments are permanent occupants of the same finite moving stock. */
function debrisBody(phase: number) {
  const rows = LANDSLIDE_LAYOUT.flowRows, columns = LANDSLIDE_LAYOUT.flowColumns, raw: FlowVertex[] = [];
  const rowStates = Array.from({ length: rows + 1 }, (_, i) => {
    const u = i / rows, q = interval(phase, .04 + (1 - u) * .10, .74 + (1 - u) * .18);
    const x = 18 + 12 * u + (50 + 11 * u) * q, spread = interval(x, 59, 80);
    const width = 8.4 + spread * (5 + 18 * u);
    return { u, q, x, spread, width, center: debrisChannelZ(x) };
  });
  for (const row of rowStates) for (let j = 0; j <= columns; j++) {
    const v=j/columns, edge=Math.abs(2*v-1), tip=smooth((row.u-.44)/.56);
    const x=row.x+row.spread*(.54*Math.sin(2*Math.PI*v)-3.45*edge**1.45*tip);
    const neck=(.49+.51*Math.sin(Math.PI*(.09+.78*row.u)))*(1+.08*Math.sin(row.u*15.7));
    const taper=neck+(1-neck)*tip;
    const z=row.center+(v-.5)*row.width*(1-row.spread+row.spread*taper)
      +row.spread*.76*edge*Math.sin(row.u*9.7+2*Math.PI*v);
    raw.push({ x, z, bottom: landslideGround(x, z, 'debris-flow') + .045,
      profile: .32 + .68 * Math.sin(Math.PI * v) * (.62 + .38 * Math.sin(Math.PI * row.u)) });
  }
  const indices: number[] = []; let weightedArea = 0;
  for (let i = 0; i < rows; i++) for (let j = 0; j < columns; j++) {
    const a = i * (columns + 1) + j, b = a + columns + 1, c = a + 1, d = b + 1;
    indices.push(a, b, c, c, b, d);
    for (const [a0, a1, a2] of [[a, b, c], [c, b, d]]) {
      const v0 = raw[a0], v1 = raw[a1], v2 = raw[a2];
      weightedArea += triangleArea(v0, v1, v2) * (v0.profile + v1.profile + v2.profile) / 3;
    }
  }
  const thicknessScale = LANDSLIDE_LAYOUT.flowBulkVolume / weightedArea;
  const bottom: LandslidePoint[] = raw.map(v => [v.x, v.bottom, v.z]);
  const top: LandslidePoint[] = raw.map(v => [v.x, v.bottom + v.profile * thicknessScale, v.z]);
  const boundary = [
    ...Array.from({ length: rows + 1 }, (_, i) => i * (columns + 1)),
    ...Array.from({ length: columns }, (_, j) => rows * (columns + 1) + j + 1),
    ...Array.from({ length: rows }, (_, i) => (rows - 1 - i) * (columns + 1) + columns),
    ...Array.from({ length: columns - 1 }, (_, j) => columns - 1 - j),
  ];
  // Fixed surface-grid occupants put every stone on the actual mud surface
  // used by both renderers, not on a separate animated trajectory.
  const coarse = Array.from({ length: LANDSLIDE_LAYOUT.coarseCount }, (_, id) => {
    const [row,col]=clastCells[id];
    const at = top[row * (columns + 1) + col];
    return { id, center: [at[0], at[1] + .12, at[2]] as LandslidePoint,
      radius: .62 + id % 3 * .14, angle: .31 * id, embedded: true };
  });
  const front = rowStates.at(-1)!, tail = rowStates[0];
  return { rows, columns, top, bottom, indices, boundary, coarse, thicknessScale, weightedArea,
    volume: weightedArea * thicknessScale, bulkVolume: LANDSLIDE_LAYOUT.flowBulkVolume,
    front: front.x, tail: tail.x, sourceEmpty: tail.q >= 1, fanWidth: front.width,
    deposited: phase >= .92, containsWater: true, finiteStock: true,
  };
}

export function evaluateLandslide(input: number, selection = 0) {
  const phase = clamp(input), mode: LandslideMode = selection === 1 ? 'debris-flow' : 'landslide';
  const slide = slideBody(phase), debris = debrisBody(phase);
  const stopped = mode === 'landslide' ? slide.travel === 1 : debris.deposited;
  const stage = stopped ? 'deposited' : phase <= (mode === 'landslide' ? .06 : .04) ? 'initial' : 'moving';
  const caption = mode === 'landslide'
    ? { initial: '滑坡：坡上的连贯滑体', moving: '滑坡：沿滑动面整体下移', deposited: '滑坡：滑体停留在坡脚' }[stage]
    : { initial: '泥石流：沟谷中的含水碎屑', moving: '泥石流：沿沟道下行并展宽', deposited: '泥石流：碎屑停留在坡脚' }[stage];
  return { phase, selection: mode === 'debris-flow' ? 1 : 0, mode, stage, caption, slide, debris,
    stockVolume: mode === 'landslide' ? slide.volume : debris.volume,
    reference: LANDSLIDE_REFERENCE, coherentSlide: true, finiteMaterial: true,
    separateTrials: true, rainTriggerSimulated: false, realFailureThreshold: false,
  };
}
export type LandslideState = ReturnType<typeof evaluateLandslide>;

const n = (v: number) => Number(v.toFixed(3));
/** Native geometry, not a page-image overlay. Projection, material footprint,
 * rocks and final deposit read exactly the same state as the Three.js model. */
export function landslideSvg(phase: number, selection = 0): string {
  const s = evaluateLandslide(phase, selection);
  const project = ([x, y, z]: readonly number[]) => [n(52 + x * 5.3 + (z - 35) * 1.05), n(288 - y * 5 + (z - 35) * 1.1)];
  const pt = (p: readonly number[]) => project(p).join(',');
  const poly = (p: readonly (readonly number[])[], fill: string, stroke = '#8a8875', width = .65) =>
    `<polygon points="${p.map(pt).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
  const floor = [[6, 0, 8], [96, 0, 8], [96, 0, 62], [6, 0, 62]];
  let terrain = '';
  // Depth order is stable; the solid front cut face preserves its real slope.
  for (const [a, z] of [[6, 62], [96, 62]]) {
    const path = Array.from({ length: 35 }, (_, i) => {
      const x = a === 6 ? 6 + 90 * i / 34 : 96, zz = a === 6 ? z : 62 - 54 * i / 34;
      return [x, landslideGround(x, zz, s.mode), zz];
    });
    terrain += poly([[...path[0].slice(0, 1), 0, path[0][2]], ...path, [path.at(-1)![0], 0, path.at(-1)![2]]], '#b8ac90');
  }
  for (let j = 0; j < 18; j++) for (let i = 0; i < 30; i++) {
    const x = 6 + 90 * i / 30, z = 8 + 54 * j / 18, at = (xx: number, zz: number) => [xx, landslideGround(xx, zz, s.mode), zz];
    const across=landslideGround(x+3,z,s.mode)-landslideGround(x,z,s.mode);
    const along=landslideGround(x,z+3,s.mode)-landslideGround(x,z,s.mode);
    const light=Math.max(.78,Math.min(1.11,.97-.047*across-.043*along));
    const outer=smooth((Math.abs(z-35)-5)/15);
    const fill=[197-27*outer,184-7*outer,156-21*outer].map(c=>Math.round(c*light));
    terrain += poly([at(x, z), at(x + 3, z), at(x + 3, z + 3), at(x, z + 3)],`rgb(${fill.join(',')})`, 'none');
  }
  const scar = footprint.map(([u, v]) => [24 + u, landslideGrade(24 + u) + .055, 35 + v]);
  let material = '', labels = '';
  if (s.mode === 'landslide') {
    terrain += poly(scar, '#d6c4a3', '#a09379', .8);
    const { lower, upper } = s.slide;
    for (let i = 0; i < lower.length; i++) {
      const j = (i + 1) % lower.length;
      material += poly([lower[i], lower[j], upper[j], upper[i]], '#ae9e82', '#6e7263', 1);
    }
    material += poly(upper, '#c6b694', '#626e5f', 1.25);
    const {x,y,z,pitch}=s.slide,c=Math.cos(pitch),sn=Math.sin(pitch);
    for(const leaf of slideLeaves){
      material+=poly(leaf.slice(0,4).map(([u,h,v])=>[x+u*c-h*sn,y+u*sn+h*c,z+v]),'#77805d','none');
    }
    for (const seam of s.slide.seams) material += `<polyline points="${seam.map(pt).join(' ')}" fill="none" stroke="#807d68" stroke-width="1.2"/>`;
    const at = project([s.slide.x, s.slide.y + 11, 35]);
    labels = `<text x="${at[0]}" y="${at[1]}" text-anchor="middle">滑体</text>`;
    if (s.slide.travel > .25) { const q = project([23, landslideGrade(23) + 3, 18]); labels += `<text x="${q[0]}" y="${q[1]}" text-anchor="middle">滑动面</text>`; }
  } else {
    const f = s.debris;
    for (let i = 0; i < f.boundary.length; i++) {
      const a = f.boundary[i], b = f.boundary[(i + 1) % f.boundary.length];
      material += poly([f.bottom[a], f.bottom[b], f.top[b], f.top[a]], '#8e9f98', '#71857f', .6);
    }
    for (let i = 0; i < f.indices.length; i += 3) material += poly(f.indices.slice(i, i + 3).map(k => f.top[k]), '#a4ada0', 'none');
    material += `<polyline points="${[...f.boundary, f.boundary[0]].map(k => pt(f.top[k])).join(' ')}" fill="none" stroke="#5a7a79" stroke-width="1.1"/>`;
    for (const rock of [...f.coarse].sort((a, b) => a.center[2] - b.center[2])) {
      const [x, y] = project(rock.center), r = rock.radius * 4.7;
      material += `<path d="M${n(x - r)},${y}l${n(r * .55)},${n(-r * .9)} ${n(r * 1.05)},${n(-r * .05)} ${n(r * .5)},${n(r * .8)} ${n(-r * .9)},${n(r * .55)}Z" fill="#bba88a" stroke="#6c7769" stroke-width=".9"/>`;
    }
    const q = project([(f.front + f.tail) / 2, landslideGrade((f.front + f.tail) / 2) + 12, 35]);
    // Reserve a separate upper label band as the material reaches the foot.
    // The two baselines stay at least 72 viewBox units apart at mobile size.
    const materialLabelY = Math.min(q[1], 181);
    labels = `<text x="${q[0]}" y="${materialLabelY}" text-anchor="middle">含水碎屑</text>`;
    if (s.phase > .58) { const p = project([81, 12, 58]); labels += `<text x="${p[0]}" y="${p[1]}" text-anchor="middle">坡脚堆积</text>`; }
  }
  const handleX = n(121 + s.phase * 390);
  return `<svg class="flat-model-svg flat-explanation-svg" viewBox="0 0 660 400" role="img" aria-label="${s.caption}" data-landslide-mode="${s.mode}" data-landslide-phase="${s.phase}" data-landslide-stage="${s.stage}" data-landslide-stock="${s.stockVolume}" data-landslide-front="${s.mode === 'landslide' ? s.slide.x : s.debris.front}" data-landslide-coarse="${s.debris.coarse.length}"><g stroke-linejoin="round" stroke-linecap="round" font-family="FieldSerif,SimSun,serif" fill="#303a40">${poly(floor, '#b8ac90')}${terrain}${material}<g font-size="25" paint-order="stroke" stroke="#f7f1e3" stroke-width="5">${labels}</g><path d="M121 355H511" stroke="#9d9e8a" stroke-width="1.5"/><path d="M121 350v10m390-10v10" stroke="#777f70" stroke-width="1.5"/><path d="M${handleX} 348l8 7-8 7-8-7Z" fill="#af8b62" stroke="#716c58" stroke-width="1.2"/><text x="330" y="47" text-anchor="middle" font-size="28">${s.mode === 'landslide' ? '滑坡' : '泥石流'}</text></g></svg>`;
}

/** Textbook pp.66–68, especially fig.4.2: soluble rock is dissolved and
 * removed. These six starting landscapes are comparisons, not six equal
 * intervals through which every karst landscape must pass. Coordinates,
 * rainfall and progress are deliberately schematic rather than calibrated. */
export const KARST_NAMES = ['溶沟', '洼地', '峰丛', '峰林', '孤峰', '残丘'] as const;
export const KARST_REFERENCE = Object.freeze({ textbookPages: [66, 67, 68], pdfPages: [71, 72, 73],
  figure: '4.2', quantities: 'schematic', universalTimeSequence: false,
  rockIsDissolvedAndRemoved: true, cavePrecipitationIsSeparate: true });
export interface KarstPoint { u: number; v: number; height: number }
export interface KarstWaterPath { lane: number; points: KarstPoint[]; inlet: KarstPoint }
export interface KarstState {
  phase: number;
  selection: number;
  name: typeof KARST_NAMES[number];
  erosion: number;
  jointWidth: number;
  waterStrength: number;
  paths: KarstWaterPath[];
}
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const smooth = (a: number, z: number, n: number) => { const t = clamp((n - a) / (z - a)); return t * t * (3 - 2 * t); };
type Peak = readonly [number, number, number, number, number];
// u, v, height, horizontal radius, profile power. The first and second
// comparison have no free-standing peaks; the others begin with residual rock.
const PEAKS: readonly (readonly Peak[])[] = [[], [],
  [[.20, .25, 23, .245, 1.3], [.48, .22, 27, .25, 1.3], [.76, .28, 22, .235, 1.3], [.32, .65, 21, .26, 1.3], [.68, .67, 24, .25, 1.3]],
  [[.20, .25, 29, .13, 2.3], [.59, .23, 32, .135, 2.3], [.37, .69, 26, .12, 2.3], [.79, .68, 28, .125, 2.3]],
  [[.48, .42, 32, .185, 2.2], [.81, .76, 6, .11, 1.5]],
  [[.37, .43, 10, .205, 1.55], [.75, .70, 5.5, .155, 1.55]],
];
export const KARST_PEAKS = PEAKS;
export function karstJointU(lane: number, v: number): number {
  const main = .52 + Math.sin(v * 6 + .5) * .037 - v * .015;
  if (lane === 1) return main;
  const merge = lane === 0 ? smooth(.45, .90, v) : smooth(.62, .98, v);
  const branch = lane === 0 ? .14 + .16 * v + .04 * Math.sin(v * 4.8)
    : .87 - .16 * v + .033 * Math.sin(v * 5.3 + 1.2);
  return branch + (main - branch) * merge;
}
export function karstJointV(lane: number, u: number): number {
  return lane === 0 ? .24 + .11 * u + .035 * Math.sin(u * 6 + .4)
    : .65 + .08 * Math.sin(u * 4.8 + 1.6);
}
export function karstTransverseRange(lane: number): [number, number] {
  return lane === 0 ? [.06, .67] : [.48, .97];
}
function jointMask(u: number, v: number, width: number): number {
  let mask = 0;
  for (let lane = 0; lane < 3; lane++) {
    const spread = width * (.82 + .17 * Math.sin(v * 7 + lane * 1.2));
    const depth = [.76, 1, .62][lane] * (.90 + .10 * Math.cos(v * 5 + lane * .8));
    mask = Math.max(mask, depth * Math.exp(-Math.pow((u - karstJointU(lane, v)) / spread, 2)));
  }
  for (let lane = 0; lane < 2; lane++) {
    const [start, end] = karstTransverseRange(lane);
    const edge = smooth(start, start + .06, u) * (1 - smooth(end - .06, end, u));
    mask = Math.max(mask, edge * [.37, .26][lane] * Math.exp(-Math.pow((v - karstJointV(lane, u)) / (width * .65), 2)));
  }
  return mask;
}
function peakField(selection: number, u: number, v: number): number {
  let peak = 0;
  for (const [x, z, height, radius, power] of PEAKS[selection]) {
    const a=(u-x)/radius, b=(v-z)*.86/radius;
    const skewX=a+.14*b+.14*Math.sin(2.9*b+11*x);
    const skewZ=b-.10*a+.12*Math.sin(2.4*a+13*z);
    const distance=Math.sqrt(skewX*skewX+skewZ*skewZ);
    if(distance>3.8) continue;
    const aspect=Math.atan2(skewZ,skewX), shoulder=Math.min(1,distance*1.8);
    // Steep residual towers retain joint-controlled faces. Their rain flutes
    // follow each face downhill and broaden toward its foot.
    const facets=.095*Math.cos(aspect*3+17*x)+.087*Math.cos(aspect*5+12*z);
    const hollow=Math.max(0,Math.cos(aspect*9+.7*Math.sin(aspect*4)+14*x))**4;
    const radiusAtAzimuth=1+shoulder*(facets-.087*hollow);
    const profile=selection===3||selection===4 ? power+.78 : power+.22;
    peak=Math.max(peak,height*Math.exp(-Math.pow(distance/radiusAtAzimuth,profile)));
  }
  return peak;
}
/** The initial rock and its lithological response are fixed for each sample.
 * The WebGL mesh can prepare them once when a different specimen is fitted. */
export function karstSource(k:number,u:number,v:number) {
  const initialJoint=jointMask(u,v,.012);
  const ripple=.33*Math.sin(u*17+v*4)*Math.sin(v*11);
  if(k===0) {
    const run=u+.020*Math.sin(7*v+6*u)+.008*Math.sin(22*v-6*u);
    const runnel=Math.max(0,Math.cos(79*run+1.06*Math.sin(17*run)))**5;
    const persistence=.33+.67*Math.sin(v*3.2+.8*u)**2;
    const initial=26-v*3.4+ripple*1.7+.65*Math.sin(u*9+v*3)-initialJoint*.9-1.38*runnel*persistence;
    return { initial, loss:.6, fracture:9.4, bowlRadius:0 };
  }
  if(k===1) {
    const radius=Math.hypot((u-.52)*.95,(v-.64)*.90);
    const bowl=Math.exp(-Math.pow(radius/.255,4));
    return { initial:25-v*2.4+ripple-9*bowl-.6*initialJoint,loss:.6,fracture:3.7,bowlRadius:radius };
  }
  const peak=peakField(k,u,v), maximum=k===2?27:k===5?10:32;
  const valley=Math.exp(-peak/(maximum*.35));
  const base=(k===2?8.6:k===3?5.7:k===4?4.7:3.6)-1.3*v;
  const initial=base+peak+ripple*.45-initialJoint*(k===2?1.1:.45);
  const loss=(k===5?.34:.65)+(k===2?5.4:k===3?3.8:k===4?2.3:1.35)*valley;
  return {initial,loss,fracture:k===2?6.8:k===3?5.5:k===4?4.2:2.5,bowlRadius:0};
}

/** The same cut is recovered at every seek. All time-dependent losses grow
 * monotonically, so a residual summit never rises as its valley dissolves. */
export function karstHeight(state: Pick<KarstState,'selection'|'erosion'|'jointWidth'>,u:number,v:number,
  source=karstSource(state.selection,u,v)) {
  const e=state.erosion;
  const bowl=state.selection===1 ? 12.6*Math.exp(-Math.pow(source.bowlRadius/(.255+e*.145),4)) : 0;
  const joint=jointMask(u,v,state.jointWidth);
  return Math.max(state.selection<2?3.2:1.8,source.initial-e*(source.loss+bowl+source.fracture*joint));
}
function waterPath(state: KarstState, lane: number): KarstWaterPath {
  // Starting on an exposed shoulder makes the connection visible. Each next
  // point is a downhill neighbour of the actual current surface; an enclosed
  // low point drains into a fissure rather than being forced uphill to an exit.
  const shoulders = state.selection === 3 ? [[.20, .33], [.37, .75], [.79, .75]]
    : state.selection === 4 ? [[.43, .48], [.56, .47], [.81, .79]]
    : state.selection === 5 ? [[.30, .47], [.43, .48], [.74, .75]]
    : state.selection === 2 ? [[.20, .31], [.32, .73], [.68, .76]]
    : state.selection === 1 ? [[.13, .15], [.52, .12], [.87, .83]]
    : [[karstJointU(0, .15), .15], [karstJointU(1, .47), .47], [karstJointU(2, .82), .82]];
  let [u, v] = shoulders[lane], height = karstHeight(state, u, v);
  const points: KarstPoint[] = [{ u, v, height }];
  for (let step = 0; step < 76; step++) {
    const eps = .0015;
    const gx = karstHeight(state, u + eps, v) - karstHeight(state, u - eps, v);
    const gz = (karstHeight(state, u, v + eps) - karstHeight(state, u, v - eps)) / (.66 * .66);
    const length = Math.hypot(gx, gz);
    if (length < .000001) break;
    let accepted = false;
    // A smooth downhill gradient avoids the 16-direction snapping that could
    // make a water path jump when the phase slider moves by a tiny amount.
    // Backtracking also prevents a thin fissure from being jumped across.
    for (let attempt = 0; attempt < 9; attempt++) {
      const stride = .015 / 2 ** attempt, x = clamp(u - gx / length * stride), z = clamp(v - gz / length * stride);
      const nextHeight = karstHeight(state, x, z), halfHeight = karstHeight(state, (u + x) / 2, (v + z) / 2);
      if (height > halfHeight + .000005 && halfHeight > nextHeight + .000005) {
        u = x; v = z; height = nextHeight; points.push({ u, v, height }); accepted = true; break;
      }
    }
    if (!accepted) break;
    if (u <= .005 || u >= .995 || v >= .995) break;
  }
  return { lane, points, inlet: points[points.length - 1] };
}
export function evaluateKarst(input: number, selection = 0): KarstState {
  const phase = clamp(input), selected = Math.max(0, Math.min(5, Math.round(Number.isFinite(selection) ? selection : 0)));
  const erosion = smooth(.09, .96, phase);
  const state: KarstState = { phase, selection: selected, name: KARST_NAMES[selected], erosion,
    jointWidth: .013 + erosion * (selected === 0 ? .022 : .034),
    waterStrength: smooth(.015, .08, phase) * (1 - smooth(.91, .995, phase)), paths: [] };
  state.paths = Array.from({ length: 3 }, (_, lane) => waterPath(state, lane));
  return state;
}
/** The tracer first falls onto the source, then follows the same downhill
 * surface, then passes below its local fissure mouth. */
export function karstWaterPoint(state: KarstState, lane: number, input: number): KarstPoint & { stage: 'rain' | 'surface' | 'infiltration' } {
  const path = state.paths[Math.max(0, Math.min(2, lane))], t = clamp(input), first = path.points[0], last = path.inlet;
  if (t < .20) return { ...first, height: first.height + .22 + 12 * (1 - t / .2), stage: 'rain' };
  if (t >= .88) return { ...last, height: last.height + .18 - (t - .88) / .12 * 4.2, stage: 'infiltration' };
  const q = (t - .20) / .68 * (path.points.length - 1), index = Math.min(path.points.length - 2, Math.floor(q));
  if (path.points.length < 2) return { ...last, height: last.height + .18, stage: 'surface' };
  const a = path.points[index], z = path.points[index + 1], mix = q - index;
  const u = a.u + (z.u - a.u) * mix, v = a.v + (z.v - a.v) * mix;
  return { u, v, height: karstHeight(state, u, v) + .18, stage: 'surface' };
}
export function karstProject(u: number, v: number, height: number): [number, number] {
  return [61 + u * 445 + v * 78, 159 + v * 135 - height * 3.55];
}
const fmt = (n: number) => Number(n.toFixed(5));
const pair = (p: [number, number]) => p.map(fmt).join(',');
export function karstSvg(phase: number, selection: number): string {
  const state = evaluateKarst(phase, selection), project = karstProject, nx = 38, nz = 25;
  const at = (u: number, v: number, lift = 0) => project(u, v, karstHeight(state, u, v) + lift);
  const front = Array.from({ length: nx + 1 }, (_, i) => at(i / nx, 1));
  const right = Array.from({ length: nz + 1 }, (_, i) => at(1, i / nz));
  let body = `<path d="M${right.map(pair).join('L')}L${pair(project(1, 1, 0))}L${pair(project(1, 0, 0))}Z" fill="#aa9d85" stroke="#60645b" stroke-width="1.1"/>`;
  body += `<path d="M${front.map(pair).join('L')}L${pair(project(1, 1, 0))}L${pair(project(0, 1, 0))}Z" fill="#b8ad94" stroke="#60645b" stroke-width="1.1"/>`;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const u = i / nx, v = j / nz, du = 1 / nx, dv = 1 / nz;
    const slope = (karstHeight(state, u + du, v) - karstHeight(state, u, v)) * .014
      - (karstHeight(state, u, v + dv) - karstHeight(state, u, v)) * .018;
    const shade = Math.max(.75, Math.min(1.035, .97 + slope));
    const fill = `rgb(${[206, 197, 171].map(c => Math.round(c * shade)).join(',')})`;
    body += `<polygon points="${[at(u, v), at(u + du, v), at(u + du, v + dv), at(u, v + dv)].map(pair).join(' ')}" fill="${fill}" stroke="${fill}" stroke-width=".45"/>`;
  }
  for (let lane = 0; lane < 3; lane++) {
    const line = Array.from({ length: 59 }, (_, i) => { const v = i / 58; return pair(at(karstJointU(lane, v), v, .03)); });
    body += `<path d="M${line.join('L')}" fill="none" stroke="#756e59" stroke-width=".8" opacity=".56"/>`;
  }
  for (let lane = 0; lane < 2; lane++) {
    const [start, end] = karstTransverseRange(lane);
    const line = Array.from({ length: 49 }, (_, i) => { const u = start + (end - start) * i / 48; return pair(at(u, karstJointV(lane, u), .03)); });
    body += `<path d="M${line.join('L')}" fill="none" stroke="#756e59" stroke-width=".8" opacity=".56"/>`;
  }
  if (state.waterStrength > .001) for (const path of state.paths) {
    body += `<path data-karst-water="${path.lane}" d="M${path.points.map(p => pair(project(p.u, p.v, p.height + .2))).join('L')}" fill="none" stroke="#7a9fa5" stroke-width="${fmt(2.9 * state.waterStrength)}" stroke-linecap="round"/>`;
    for (let j = 0; j < 4; j++) {
      const t = (state.phase * 2.1 + j / 4 + path.lane * .09) % 1;
      const a = karstWaterPoint(state, path.lane, Math.max(0, t - .038)), z = karstWaterPoint(state, path.lane, t);
      if (z.stage === 'infiltration' && z.height < path.inlet.height - .35) continue;
      body += `<path d="M${pair(project(a.u, a.v, a.height))}L${pair(project(z.u, z.v, z.height))}" fill="none" stroke="#4b7e88" stroke-width="1.8" stroke-linecap="round"/>`;
    }
    for (let j = 0; j < 3; j++) {
      const t = ((state.phase * 4 + j / 3 + path.lane * .11) % 1) * .2;
      const a = karstWaterPoint(state, path.lane, Math.max(0, t - .027)), z = karstWaterPoint(state, path.lane, t);
      body += `<path d="M${pair(project(a.u, a.v, a.height))}L${pair(project(z.u, z.v, z.height))}" fill="none" stroke="#5d8b94" stroke-width="1.35" stroke-linecap="round"/>`;
    }
  }
  body += `<path d="M${front.map(pair).join('L')}" fill="none" stroke="#60645b" stroke-width="1.25"/>`;
  const probes = [[.2, .25], [.52, .55], [.8, .72]].map(([u, v]) => ({ u, v, height: fmt(karstHeight(state, u, v)) }));
  return `<svg xmlns="http://www.w3.org/2000/svg" class="flat-model-svg flat-explanation-svg" viewBox="0 0 640 350" role="img" data-karst-form="${state.selection}" data-phase="${fmt(state.phase)}" data-erosion="${fmt(state.erosion)}" data-height-probes='${JSON.stringify(probes)}' aria-label="${state.name}的裂隙溶蚀示意。雨水沿地表低处和裂隙进入，岩石物质溶解并被带走，岩体只会降低。六种形态是条件比较，不是所有地区必经的等时序列；不表示真实速率。"><title>${state.name} · 裂隙引导溶蚀</title><g stroke-linecap="round" stroke-linejoin="round">${body}<text x="320" y="329" text-anchor="middle" fill="#303a40" font-size="25" font-family="FieldSerif,SimSun,serif">${state.name}</text></g></svg>`;
}

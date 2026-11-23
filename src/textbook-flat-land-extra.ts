import { terrainSurveyDrawing } from './textbook-terrain-survey-drawing';
import { vegetationDrawing } from './textbook-vegetation-drawing';
import { karstObserverDrawing } from './textbook-karst-observer-drawing';
import { aeolianHandPanel } from './textbook-aeolian-hand-panel';
import { valleyDrawing } from './textbook-valley-drawing';
import { beachGrain, beachGrains, beachHeight, beachShore, beachSwash, beachWaterLevel } from './textbook-beach-profile';
import type { Figure } from './textbook-catalog';
import { evaluateSoilTransferDetail } from './textbook-soil-transfer-detail-model';
import { DELTA_MOUTH, DELTA_TOP, deltaBranchPoint, deltaMainPoint, evaluateDeltaDeposition } from './textbook-delta-model';
import { soilSortingSvg } from './textbook-soil-sorting-model';
import { coastalArchProfile, coastalProcessSvg } from './textbook-coastal-process-model';
import { evaluateAeolian } from './textbook-aeolian-model';

/** Readable, independently drawn fallback for the additional chapter 4/5
 * models. No textbook crop, bitmap or external resource is used here. */
export function flatLandExtra(f: Figure, phase: number, selection: number, inspection = 'overview'): string | null {
  const t = clamp(phase), n = Math.max(0, Math.round(selection));
  switch (f.effect as string) {
    case 'river-valley': return valleyDrawing(t, Math.min(1, n));
    case 'delta': return deltaSvg(t, Math.min(2, n));
    case 'aeolian': return aeolianSvg(phase, selection);
    case 'coastal-landform': return coastalSvg(t, Math.min(3, n));
    case 'terrain-observation': return terrainSvg(t, Math.min(3, n));
    case 'vegetation': return vegetationSvg(t, Math.min(6, n), inspection);
    case 'soil-factors': return soilSvg(t, Math.min(4, n));
    case 'karst-livelihood': return karstObserverDrawing(false,t,Math.min(3,n));
    default: return null;
  }
}

const C = { ink: '#303a40', sea: '#a7c6ce', water: '#669da9', land: '#c6b69a', rock: '#b6a88f', green: '#a0af8e', dark: '#718973', warm: '#b58259', paper: '#f7f1e3' };
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const cycle = (n: number) => ((n % 1) + 1) % 1;
const smooth = (a: number, c: number, n: number) => { const q = clamp((n - a) / (c - a)); return q * q * (3 - 2 * q); };
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const text = (x: number, y: number, value: string, size = 26, anchor = 'middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${C.ink}" font-size="${size}" font-family="FieldSerif,SimSun,serif">${esc(value)}</text>`;
const path = (d: string, fill = 'none', stroke = C.ink, width = 1.5) => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
const circle = (x: number, y: number, r: number, fill: string, stroke = 'none') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}"/>`;
const svg = (title: string, body: string, height = 390) => `<svg xmlns="http://www.w3.org/2000/svg" class="flat-model-svg flat-explanation-svg" viewBox="0 0 640 ${height}" role="${height === 390 ? 'img' : 'group'}" aria-label="${esc(title)}"><title>${esc(title)}</title><g stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
type P = [number, number];
function arrow(a: P, c: P, color = C.water, width = 2.7) {
  const angle = Math.atan2(c[1] - a[1], c[0] - a[0]), size = 9;
  const back: P = [c[0] - Math.cos(angle) * size, c[1] - Math.sin(angle) * size];
  return path(`M${a}L${c}M${back[0] + Math.sin(angle) * 5},${back[1] - Math.cos(angle) * 5}L${c}L${back[0] - Math.sin(angle) * 5},${back[1] + Math.cos(angle) * 5}`, 'none', color, width);
}
function flow(points: P[], t: number, count = 4, color = C.water) {
  let out = path(`M${points.join('L')}`, 'none', color, 1.3);
  for (let i = 0; i < count; i++) {
    const q = cycle(t + i / count) * (points.length - 1), index = Math.min(points.length - 2, Math.floor(q)), p = q - index, a = points[index], c = points[index + 1];
    const x = a[0] + (c[0] - a[0]) * p, y = a[1] + (c[1] - a[1]) * p, length = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
    out += arrow([x - (c[0] - a[0]) / length * 12, y - (c[1] - a[1]) / length * 12], [x, y], color, 2.3);
  }
  return out;
}
function broadTree(x: number, ground: number, height: number, color = C.dark, leafiness = 1) {
  return path(`M${x},${ground}V${ground - height * .8}M${x},${ground - height * .5}l${height * .14},${-height * .15}`, 'none', '#8b816b', Math.max(2, height * .037))
    + (leafiness > .07 ? `<ellipse cx="${x}" cy="${ground - height * .78}" rx="${height * .28}" ry="${height * .25 * leafiness}" fill="${color}" stroke="${C.ink}" stroke-width="1.2"/>` : '');
}
function conifer(x: number, ground: number, h: number) {
  return path(`M${x},${ground}V${ground - h}`, 'none', '#8b816b', 2.8) + [0, 1, 2].map(i => {
    const y = ground - h * (.25 + i * .22), r = h * (.25 - i * .055); return path(`M${x - r},${y}L${x},${y - h * .42}L${x + r},${y}Z`, C.dark);
  }).join('');
}

function deltaSvg(t: number, n: number) {
  const state = evaluateDeltaDeposition(t), point = (u: number, v: number): P => [50 + u * 540, 25 + v * 300];
  const main: P[] = Array.from({ length: 33 }, (_, i) => { const p = deltaMainPoint(i / 32); return point(...p); });
  const apron = (scale: number) => {
    const rim = state.shoreline.map(([u,v])=>point(DELTA_MOUTH[0]+(u-DELTA_MOUTH[0])*scale, DELTA_MOUTH[1]+(v-DELTA_MOUTH[1])*scale));
    return `M${rim.join('L')}Z`;
  };
  const bed = path(apron(1.1),'#b5a184',C.ink,1) + path(apron(.92),'#d6c09a','none');
  let channels = '';
  for (let i = 0; i < 3; i++) {
    const front = state.branches[i].front;
    if (state.branches[i].deposition > .02) {
      const route: P[] = Array.from({ length: 25 }, (_, j) => { const p = deltaBranchPoint(i, Math.max(.02, front - .09) * j / 24); return point(...p); });
      channels += path(`M${route.join('L')}`, 'none', C.water, 6);
      if (n > 0) channels += flow(route, t * 1.6, 1);
    }
  }
  const sediment = state.grains.map(grain => {
    if (grain.stage === 'waiting') return '';
    const p = point(grain.position[0], grain.position[2]), y = p[1] - (grain.position[1] - DELTA_TOP) * 5.4;
    const guide = grain.stage === 'settling' ? path(`M${p[0]},${p[1] - (9.05 - DELTA_TOP) * 5.4}V${y}`, 'none', '#a28b65', .8) : '';
    return `<g data-delta-grain="${grain.id}" data-stage="${grain.stage}" data-size="${grain.grainClass}">${guide}${circle(p[0], y, grain.radius * 4.4, ['#8d7856', '#a68b61', '#b39a71'][grain.id % 3], grain.stage === 'deposited' ? '#78684d' : 'none')}</g>`;
  }).join('');
  const sorting = (n === 1 && state.deposition > .2 ? text(128, 219, '较粗', 25) : '')
    + (n === 1 && state.grains.some(g => g.grainClass === 'fine' && (g.stage === 'settling' || g.stage === 'deposited')) ? text(529, 309, '较细', 25) : '');
  const keys=['平原','沉积','岸线'].map((name,i)=>{
    const x=70+i*94;
    return `<g tabindex="0" role="button" aria-label="观察${name}" aria-pressed="${n===i}" data-model-selection="${i}" data-specimen-key transform="translate(${x} 399)">
      <rect x="-42" y="-43" width="84" height="86" rx="6" fill="transparent"/>
      <rect x="-41" y="-27" width="82" height="54" rx="6" fill="#6c573b"/><rect x="-40" y="${n===i?-22:-28}" width="80" height="47" rx="5" fill="${n===i?'#c6bda4':'#f2e5c6'}" stroke="#a78953" stroke-width="3"/>
      ${text(0,n===i?11:6,name,29)}</g>`;
  }).join('');
  const x=357+t*213;
  const control=`<g data-phase-track="delta-rack" data-track-start="357" data-track-end="570" tabindex="0" role="slider" aria-label="推拉木柄给沙" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(t*100)}">
    <rect x="315" y="351" width="298" height="90" rx="8" fill="transparent"/><path d="M344 389H584M344 398H584" stroke="#acb5aa" stroke-width="4"/>
    <path d="M344 382v24m240-24v24" stroke="#9b8152" stroke-width="6"/>
    <g transform="translate(${x} 395)"><rect x="-13" y="-17" width="26" height="35" rx="3" fill="#b48d53" stroke="#5a4934" stroke-width="3"/><ellipse cy="-7" rx="15.5" ry="15" fill="#6a462d" stroke="#493728" stroke-width="3"/><path d="M-8 -12q4 -6 11 -3" fill="none" stroke="#aa7b51" stroke-width="2"/></g></g>`;
  return `<svg class="flat-model-svg flat-explanation-svg delta-flume-drawing" viewBox="0 0 640 481" role="group" aria-label="推拉木柄观察河口搬运、沉积和岸线推进" xmlns="http://www.w3.org/2000/svg"><title>河口水沙槽</title><defs>
    <linearGradient id="delta-water" x2=".34" y2="1"><stop stop-color="#a1b3a0"/><stop offset=".48" stop-color="#91b4b4"/><stop offset="1" stop-color="#7598a0"/></linearGradient></defs>
    <g data-delta-deposited="${state.deposited}" data-delta-deposition="${state.deposition}" stroke-linejoin="round" stroke-linecap="round">`
    +path('M28 14H612V445H28Z','#654d37','#513f30',3)+path('M34 18H606V438H34Z','#304c46','#bb9b61',3)
    +path('M45 27H595V339H45Z','url(#delta-water)','#706444',3)+bed
    +path('M45 27H595V119Q558 140 520 125T443 123T374 128T310 127T231 126T154 126T45 122Z','#a8a884','none')
    +path(`M${main.join('L')}`,'none',C.water,10)+channels+flow(main,t*2.5,2)+sediment+sorting
    +`<path d="M288 25q21 -9 44 0l-9 17-4 8h-18l-4-8Z" fill="#b68755" stroke="#674c34" stroke-width="2"/><ellipse cx="310" cy="24" rx="23" ry="5" fill="#75543b" stroke="#c2a071" stroke-width="2"/>
      ${keys}${control}<g pointer-events="none">${text(464,458,'推拉给沙',29)}</g></g></svg>`;

}

function aeolianSvg(t: number, n: number) {
  const state = evaluateAeolian(t, n);
  n = state.selection;
  const winds = [106, 170, 234].map((y, j) => flow([[42, y], [600, y]], state.windPhase + j * .09, 3, '#58838a')).join('');
  let body = '', labels = '';
  if (n === 0) {
    // Keep the original editorial silhouette, with the actual lathe's neck
    // radius multiplier rather than a second, unrelated erosion formula.
    const neck = 39 * state.neckScale;
    body = path(`M228 285L${320 - neck} 231Q${320 - neck - 5} 206 ${320 - neck} 187L242 170Q208 144 232 108Q259 75 321 79Q392 76 411 113Q435 149 396 172L${320 + neck} 189Q${320 + neck + 5} 218 ${320 + neck} 231L411 285Z`, C.rock);
    labels = text(320, 366, '风蚀蘑菇', 29) + text(476, 219, '下部侵蚀较强') + text(105, 65, '主风向');
  } else if (n === 1) {
    body = [0, 1, 2].map((i) => {
      const y = 142 + i * 66, start = 95 + i * 9, end = 553 - i * 17;
      return path(`M${start},${y}L${start + 27},${y - 29}L${end - 29},${y - 36}L${end},${y - 12}L${end - 13},${y + 8}L${start + 18},${y + 14}Z`, C.rock)
        + path(`M${start + 27},${y - 29}L${end - 29},${y - 36}M${start + 18},${y + 14}L${end - 13},${y + 8}`, 'none', '#8f8876', 1);
    }).join('');
    labels = text(320, 366, '雅丹', 29) + text(320, 66, '垄脊顺着主风向') + text(525, 318, '沟槽');
  } else {
    const dx = state.duneOffset * 4;
    body = `<g transform="translate(${dx} 0)">${path('M466 76Q222 51 173 172Q225 298 466 270Q348 234 338 173Q351 112 466 76Z', '#d4bd90')}${path('M465 76Q283 112 276 173Q288 228 466 270', 'none', '#98856c', 1.7)}</g>`;
    body += path('M114 319Q238 308 354 277L403 319Z', '#d4bd90') + arrow([72, 306], [182, 306]);
    if (state.stabilized) body += [0, 1, 2, 3].map(i => broadTree(278 + i * 26, 171 + Math.sin(i) * 24, 26, C.dark) + path(`M${278 + i * 26},${171 + Math.sin(i) * 24}l-8 22m8-22 10 18`, 'none', '#8b826a', 1.2)).join('');
    labels = text(320, 373, n === 3 ? '植被固沙' : '新月形沙丘', 29) + text(141, 292, n === 3 ? '根系固定' : '迎风坡缓') + text(493, 312, n === 3 ? '风沙受阻' : '背风坡陡');
  }
  return svg(['风蚀蘑菇，下部侵蚀较强', '雅丹垄脊与主风向一致', '新月形沙丘，迎风坡缓，背风坡陡', '植被使流沙受到固定'][n] + '；四种类型独立对照，距离与时间均为示意',
    `<g data-aeolian-form="${state.form}" data-aeolian-phase="${state.phase}" data-aeolian-erosion="${state.erosion}" data-aeolian-neck-scale="${state.neckScale}" data-aeolian-dune-offset="${state.duneOffset}">`
    + path('M40 336H600', 'none', '#b3a78d') + winds
    + `<g data-model-replay="true" data-model-selection="${n}" role="button" tabindex="0" aria-label="从头观察${state.title}示意">${body}</g>` + labels + '</g>' + aeolianHandPanel(state.phase, n), 534);
}

function beachSvg(t:number){
  const project=(u:number,v:number,h=beachHeight(u,v)):P=>[105+451*u-59*v,128+40*u+138*v-h*6];
  const across=(v:(u:number)=>number,height?:(u:number,v:number)=>number):P[]=>
    Array.from({length:41},(_,i)=>{const u=i/40,z=v(u);return project(u,z,height?.(u,z));});
  const strip=(back:P[],front:P[],color:string)=>path('M'+[...back,...front.slice().reverse()].join('L')+'Z',color,'none');
  const rear=across(()=>0),berm=across(u=>beachShore(u)-.29),wet=across(u=>beachShore(u)-.17);
  const swash=across(u=>beachSwash(u,t)),shore=across(beachShore),front=across(()=>1);
  const side=Array.from({length:34},(_,i)=>project(0,i/33));
  let body=strip(side,side.map((_,i)=>project(0,i/33,.24)),'#ac9476')
    +strip(front,across(()=>1,()=>.24),'#b69d7e')
    +strip(rear,berm,'#e7d2a7')+strip(berm,wet,'#dcc29a')
    +strip(wet,swash,'#ba9e7e')+strip(swash,shore,'#a8b6a5')
    +strip(shore,across(()=>1,()=>beachWaterLevel),'#91b7b8')
    +strip(across(()=>1,()=>beachWaterLevel),front,'#7fa2a1')
    +strip(side.slice(Math.ceil(beachShore(0)*33)),side.slice(Math.ceil(beachShore(0)*33)).map((_,i)=>project(0,(Math.ceil(beachShore(0)*33)+i)/33,beachWaterLevel)),'#86a9a9')
    +path('M'+swash.join('L'),'none','#f6f0db',2.4);
  beachGrains.forEach((spec,j)=>{
    const grain=beachGrain(j,t),[x,y]=project(grain.u,grain.v,grain.height+spec.radius*.4);
    const rotation=-grain.angle*180/Math.PI;
    body+=`<ellipse cx="${x}" cy="${y}" rx="${spec.radius*4.4*spec.elongation}" ry="${spec.radius*3.5}" transform="rotate(${rotation} ${x} ${y})" fill="${spec.color}" opacity="${grain.height<beachWaterLevel?.43:1}"/>`;
  });
  for(const [label,x,y,u,v] of [['滩肩',130,46,.23,beachShore(.23)-.29],['湿沙',464,87,.75,beachShore(.75)-.11],['海岸堆积',348,356,.53,beachShore(.53)-.09]] as const){
    const anchor=project(u,v);
    body+=path(`M${x} ${y<150?y+8:y-27}L${anchor}`,'none','#766952',1.2)+text(x,y,label);
  }
  return svg('海滩的滩肩、湿岸与海岸堆积，颗粒随波上移后留在滩面',body);
}

function coastalSvg(t: number, n: number) {
  if (n === 0) return coastalProcessSvg(t);
  if (n === 3) return beachSvg(t);
  const cliff = `<g>${path('M42 82L77 68 109 77 137 69 174 83 198 92V269H42Z', C.rock)}${path('M47 132L191 146M47 181L191 193M47 230L191 241', 'none', '#998a74', 1)}</g>`;
  const archFace=(offset:number)=>'M'+coastalArchProfile.map(([x,y])=>[290+x*4.2+offset,272-y*7.3-offset*.55].join(',')).join('L')+'Z';
  const arch=path(archFace(9),'#a2927c')+path(archFace(0),C.rock);
  const seaStack = path('M400 275L407 254 405 242 411 202 411 177 417 165 433 159 442 167 441 190 446 221 444 250 451 275Z', C.rock);
  const beach = path('M493 275Q522 270 545 253T585 236V319Q548 309 524 288Z', '#d8c7a0');
  const waves = [0, 1, 2].map(j => {
    const y = 318 - cycle(t * .55 + j / 3) * 37; return path(`M48 ${y}q28-7 54 0t54 0m24 0q28-7 54 0t54 0m24 0q28-7 54 0t54 0`, 'none', '#6f969d', 1.4);
  }).join('');
  const names = [['海蚀崖', '海蚀平台', '海浪侵蚀'], ['海蚀拱桥', '海浪贯通', '岩石海岸'], ['海蚀柱', '海浪侵蚀', '岩石海岸'], ['海滩', '海岸堆积', '陆地']][n];
  return svg(names.join('，') + '，并非每处海岸必然经历同样顺序', path('M40 273H600V330H40Z', C.sea, 'none') + path('M40 266H225L218 280H40Z', '#c3b69b') + cliff + arch + seaStack + beach + waves
    + text(320, 373, names[0], 29) + text(n === 0 ? 255 : n === 3 ? 490 : 316, n === 0 ? 245 : 98, names[1]) + text(119, 43, names[2])
    + flow([[n === 3 ? 548 : n === 2 ? 428 : 289, 324], [n === 3 ? 560 : n === 2 ? 428 : 289, 278]], t, 2));
}

function terrainSvg(t:number,n:number) {
  return terrainSurveyDrawing(t,n);
}

function vegetationSvg(t:number,n:number,inspection:string) {
  return vegetationDrawing(t,n,inspection);
}

function soilSvg(t: number, n: number) {
  if (n === 4) return soilSortingSvg(t);
  const state = evaluateSoilTransferDetail(t, n), depth = state.soilDepth * 62 / 6, top = 233 - depth;
  const organicFraction = .28 + (n === 1 ? .1 * state.received : 0);
  const project = (u: number, h: number): [number, number] => [20 + 600 * u, h <= 8 ? 330 - h * 49 / 8 : h <= 14 ? 281 - (h - 8) * 8 : 233 - (h - 14) * 62 / 6];
  const rock = path('M104 281H536V330H104Z', '#999280'), parent = path('M104 233H536V281H104Z', '#b7a687');
  const soil = path(`M104 ${top}H536V233H104Z`, '#ad8f6b') + path(`M104 ${top}H536V${top + depth * organicFraction}H104Z`, '#8e795d');
  const plant = broadTree(320, top, 70, '#879d78') + path(`M320 ${top}l-10 27-17 31m27-58 13 29 20 22m-33-51 2 60`, 'none', '#7d7960', 1.8);
  let action = '', names: string[];
  if (n === 0) {
    state.receiverPatches.forEach((patch, column) => {
      const departed = (state.particles[column].travel + state.particles[column + 6].travel) / 2, h = 1.2 + (8.8 + column % 2 * .4) * (1 - departed);
      const [x, y] = project(patch.u, 6.8 + h), base = project(patch.u, 6.8)[1];
      action += path(`M${x - 14} ${base}L${x - 12} ${y + 8} ${x + 2} ${y} ${x + 13} ${y + 10} ${x + 17} ${base}Z`, '#999280', '#6f7369', 1.1);
    });
    action += arrow([72, 218], [72, 276], C.warm); names = ['岩石风化', '成土母质', '土壤'];
  } else if (n === 1) {
    action += flow([[277, 249], [298, top + 21], [320, top], [320, top - 45]], t, 3, C.warm)
      + flow([[383, top - 26], [399, top], [366, top + 15]], t + .2, 2, C.warm);
    names = ['吸收', '枯落与分解', '养分归还'];
  } else if (n === 2) {
    action += path('M109 77q-9-30 17-37 15-26 37-4 31-3 31 25 8 24-14 26H109Z', C.paper, '#a0aba0') + circle(506, 57, 17, '#c9a76c');
    if (state.water.rain) for (let i = 0; i < 4; i++) action += flow([[120 + i * 19, 95], [120 + i * 19, 95 + (top - 99) * state.water.rainReach]], t + i * .13, 2);
    if (state.water.active) for (let i = 0; i < 3; i++) action += flow([[421 + i * 30, top + 3], [421 + i * 30, project(0, state.water.front)[1]]], t + i * .17, 2);
    names = ['温度与降水', '风化', '淋溶'];
  } else {
    action += path(`M104 ${top + depth * .4}H536M104 ${top + depth * .73}H536`, 'none', '#7b705c', 1.1) + arrow([571, 233], [571, top], C.warm);
    names = ['时间积累', '土层增厚', '层次分化'];
  }
  if (n < 3) {
    state.receiverPatches.forEach(patch => {
      if (patch.amount <= .004) return;
      const [x, base] = project(patch.u, patch.base), high = project(patch.u, patch.base + patch.growth * patch.amount)[1], color = n === 0 ? '#c4ae84' : n === 1 ? '#6d694d' : '#b29b69';
      action += `<g data-soil-receiver="${patch.column}" data-received="${patch.amount.toFixed(5)}">${path(`M${x - 27} ${base}Q${x - 23} ${high - 2} ${x + 5} ${high}Q${x + 23} ${high + 2} ${x + 27} ${base}Z`, color, '#80775e', 1)}</g>`;
    });
    state.particles.forEach(particle => {
      const [x, y] = project(particle.u, particle.h), color = n === 0 ? '#a79b80' : n === 1 ? particle.arrived ? '#75694c' : '#b9a068' : '#b69b65';
      const marker = n === 1 ? `<ellipse cx="${x}" cy="${y}" rx="8" ry="${2.7 + particle.incorporation * 2}" fill="${color}" stroke="#71664c" stroke-width="1.1" transform="rotate(${particle.travel * 72 + particle.id * 29} ${x} ${y})"/>`
        : path(`M${x - 7} ${y - 4}l6-4 8 4 1 6-10 3-7-4Z`, color, '#82775f', 1);
      action += `<g data-soil-packet="${particle.id}" data-stage="${particle.stage}">${marker}</g>`;
    });
  }
  return svg(`土壤形成：${names.join('，')}。厚度与时间均为示意`, rock + parent + soil + plant + action
    + text(320, 374, names[0], 29) + text(n === 2 ? 70 : 171, n === 2 ? 268 : 115, names[1]) + text(n === 1 ? 470 : 493, n === 1 ? 129 : n === 2 ? 212 : 107, names[2]));
}


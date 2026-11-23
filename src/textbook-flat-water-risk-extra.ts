import { floodSectionDrawing } from './textbook-flood-basin-drawing';
import { hydrologyDrawing } from './textbook-recorder-drawings';
import { WAREHOUSE_SITES, WAREHOUSE_TOWNS, WAREHOUSE_WATER_LEVEL, warehouseHeight, warehouseRiverX, warehouseRoutes } from './textbook-warehouse-relief';
import type { Figure } from './textbook-catalog';
import { disasterChainSvg } from './textbook-disaster-chain-model';
import { salinitySvg } from './textbook-salinity-model';
import { evaluateDesalination, desalinationPocketProjection } from './textbook-desalination-model';
import { evaluateDensityComparison, evaluateDroughtSequence, evaluateFloodSequence } from './textbook-ground-process-model';

/** Pure SVG counterparts of textbook-models-water-risk-extra.ts. All lengths,
 * elapsed time and concentrations are illustrative, never measured readings. */
const P = { paper: '#f7f1e3', ink: '#303a40', sea: '#a7c6ce', water: '#669da9', land: '#c6b69a', rock: '#b4b1a3', green: '#a8b197', dry: '#bb985c', warm: '#c18358', cool: '#6a99aa', red: '#a85b48' };
type Pt = [number, number];
const q01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const ease = (n: number) => { const q = q01(n); return q * q * (3 - 2 * q); };
const escaped = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
const points = (p: Pt[]) => p.map(q => q.map(v => v.toFixed(2)).join(',')).join(' ');
const shape = (p: Pt[], fill = P.land, stroke = P.ink, width = 1.7) => `<polygon points="${points(p)}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"/>`;
const rect = (x: number, y: number, w: number, h: number, fill = P.paper, stroke = P.ink, r = 0) => `<rect x="${x}" y="${y}" width="${w}" height="${Math.max(0, h)}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.7"/>`;
const circle = (x: number, y: number, r: number, fill = P.paper, stroke = P.ink) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>`;
const line = (a: Pt, b: Pt, color = P.ink, width = 1.6) => `<path d="M${a.join(',')}L${b.join(',')}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
const label = (s: string, x: number, y: number, anchor = 'middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="FieldSerif,SimSun,serif" font-size="26" fill="${P.ink}" paint-order="stroke" stroke="${P.paper}" stroke-width="5" stroke-linejoin="round">${escaped(s)}</text>`;
function along(path: Pt[], t: number): Pt {
  const lengths = path.slice(1).map((q, i) => Math.hypot(q[0] - path[i][0], q[1] - path[i][1]));
  let d = q01(t) * lengths.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (d <= lengths[i] || i === lengths.length - 1) { const a = path[i], b = path[i + 1], q = lengths[i] ? d / lengths[i] : 0; return [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q]; }
    d -= lengths[i];
  }
  return path[0];
}
function trace(path: Pt[], t: number, id: string, color = P.water, count = 3) {
  const marker = color === P.red ? `${id}-red` : `${id}-flow`;
  return `<polyline points="${points(path)}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" marker-end="url(#${marker})"/>` + Array.from({ length: count }, (_, i) => {
    const q = along(path, ((t + i / count) % 1 + 1) % 1); return circle(q[0], q[1], 3.3, color, 'none');
  }).join('');
}
function cloud(x: number, y: number, k = 1) {
  return `<g transform="translate(${x},${y}) scale(${k})"><path d="M-49,12C-67,8 -61,-15 -42,-17C-31,-43 -2,-43 9,-25C34,-44 55,-22 49,-6C75,-4 73,19 52,21L-41,21C-51,21 -56,18 -49,12Z" fill="${P.paper}" stroke="${P.ink}" stroke-width="1.8"/></g>`;
}
function rain(x0: number, x1: number, top: number, bottom: number, t: number, n = 9) {
  return Array.from({ length: n }, (_, i) => {
    const x = x0 + (x1 - x0) * i / Math.max(1, n - 1), y = top + ((t * 3 + i / n) % 1) * (bottom - top);
    return line([x, y], [x - 2, Math.min(bottom, y + 12)], P.water, 2);
  }).join('');
}
function house(x: number, y: number, k = 1) {
  return `<g transform="translate(${x},${y}) scale(${k})">${rect(-19, -27, 38, 27)}${shape([[-25, -27], [0, -46], [25, -27]], P.land)}${rect(-4, -16, 8, 16, P.rock)}</g>`;
}
function plants(t: number, x0: number, y0: number, nx = 6, nz = 2, k = 1) {
  return Array.from({ length: nx * nz }, (_, i) => {
    const x = x0 + (i % nx) * 24 * k, y = y0 + Math.floor(i / nx) * 21 * k, h = (29 - t * 12) * k, bend = t * 12 * k;
    return `<g stroke="${t > .38 ? P.dry : '#718973'}" stroke-width="${2.4 * k}" fill="none" stroke-linecap="round"><path d="M${x},${y}Q${x + bend},${y - h / 2} ${x + bend},${y - h}"/><path d="M${x + bend / 2},${y - h / 2}q${-11 * k},${-12 * k + t * 12 * k} ${-13 * k},${-5 * k + t * 12 * k}M${x + bend / 2},${y - h / 2}q${12 * k},${-11 * k + t * 12 * k} ${14 * k},${-4 * k + t * 11 * k}"/></g>`;
  }).join('');
}
function wrap(title: string, body: string, id: string, height = 390) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 ${height}" class="flat-model-svg flat-explanation-svg" role="${height===390?'img':'group'}" aria-label="${escaped(title)}"><defs><marker id="${id}-flow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto"><path d="M0,0L10,5L0,10Z" fill="${P.water}"/></marker><marker id="${id}-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto"><path d="M0,0L10,5L0,10Z" fill="${P.red}"/></marker></defs><rect width="640" height="390" fill="${P.paper}"/>${body}</svg>`;
}

function density(_t: number, mode: number) {
  const state = evaluateDensityComparison(mode), angle = -state.angle;
  let body = rect(266, 328, 108, 12, P.land) + shape([[293, 329], [312, 142], [328, 142], [347, 329]], P.paper);
  const ends: Pt[] = [-1, 1].map(side => [320 + side * 177 * Math.cos(angle), 144 + side * 177 * Math.sin(angle)]);
  body += line(ends[0], ends[1], P.rock, 10) + circle(320, 144, 8, P.ink);
  const dialPoint = (a:number,r:number):Pt => [320-Math.sin(a)*r,144+Math.cos(a)*r];
  const arc = (r:number) => Array.from({length:25},(_,i)=>dialPoint((i-12)*.045,r));
  body += shape([...arc(103),...arc(73).reverse()],'#aa8149');
  body += shape([...arc(99),...arc(77).reverse()],'#ebe1c9');
  for(let i=-4;i<=4;i++) body+=line(dialPoint(i*.105,i%2?88:82),dialPoint(i*.105,97),P.ink,i?1.1:2);
  body+=shape([[317,144],dialPoint(angle,94),[323,144]],P.ink)+circle(320,144,5,'#ad8448');
  ends.forEach(([x, y], i) => {
    body += line([x, y], [x - 53, y + 114]) + line([x, y], [x + 53, y + 114]);
    body += rect(x - 57, y + 114, 114, 7, P.paper);
    const color = i === 1 && mode === 1 ? P.cool : P.sea;
    body += shape([[x - 44, y + 107], [x - 44, y + 44], [x + 42, y + 44], [x + 42, y + 107]], color);
    body += shape([[x - 44, y + 44], [x - 25, y + 31], [x + 59, y + 31], [x + 42, y + 44]], color);
    body += shape([[x + 42, y + 44], [x + 59, y + 31], [x + 59, y + 94], [x + 42, y + 107]], color);
    const n = state.massTokens[i];
    for (let j = 0; j < n; j++) body += rect(x - 33 + (j % 4) * 20, y + 98 - Math.floor(j / 4) * 15, 5, 5, P.ink, 'none');
  });
  return body + label('等体积比较', 320, 49) + label('对照', 151, 368) + label(['条件相同', '温度降低', '盐度增加'][mode], 493, 368);
}

function desalination(t: number, mode: number, id: string) {
  const state = evaluateDesalination(t, mode), q = state.progress;
  const pockets = state.pockets.map(pocket => {
    const [x, y] = desalinationPocketProjection(pocket.point);
    return `<g data-brine-pocket="${pocket.id}" data-retained="${pocket.retained}" data-collected="${pocket.inCollector}">${rect(x - 3, y - 3.5, 6, 7, P.dry, 'none')}</g>`;
  }).join('');
  let body = shape([[90, 332], [121, 308], [526, 308], [555, 332], [524, 351], [120, 351]], P.land);
  body += rect(121, 273, 405, 58, P.paper) + rect(128, 316 - q * 21, 391, 9 + q * 21, P.sea, 'none');
  if (mode === 0) {
    body += rect(217, 222, 8, 61, P.rock) + rect(411, 222, 8, 61, P.rock);
    body += shape([[220, 220], [220, 102], [403, 102], [403, 220]], '#dce6df');
    body += shape([[220, 102], [247, 84], [432, 84], [403, 102]], '#e7ede5');
    body += pockets;
    for (const x of [256, 312, 369]) body += trace([[x, 198], [x + 3, 247], [x, 294]], t, id, P.water, 2);
  } else {
    body += `<ellipse cx="320" cy="115" rx="115" ry="38" fill="${P.paper}" stroke="${P.ink}" stroke-width="1.8"/>`;
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2 + t * Math.PI * 4, x = 320 + Math.cos(a) * 67, y = 178 + Math.sin(a) * 35;
      body += `<g transform="translate(${x},${y}) rotate(${-a * 180 / Math.PI})">${rect(-12, -11, 24, 22, '#dce6df')}</g>`;
    }
    body += pockets;
    for (const x of [210, 249, 391, 430]) body += line([x, 114], [x, 253], P.rock, 2);
    body += `<ellipse cx="320" cy="253" rx="115" ry="38" fill="none" stroke="${P.ink}" stroke-width="1.8"/>`;
    body += trace([[270, 185], [173, 221], [166, 303]], t, id, P.water, 2) + trace([[370, 185], [468, 221], [475, 303]], t, id, P.water, 2);
  }
  return body + label('海冰', 107, 155) + label('盐水收集', 485, 378) + label(mode ? '破碎离心' : '重力排盐', 485, 60);
}

function drought(t: number, mode: number) {
  const state = evaluateDroughtSequence(t, mode), severity = state.soilDeficit, level = state.sourceLevel;
  let body = shape([[55, 276], [79, 242], [570, 242], [597, 276], [574, 326], [76, 326]], P.land);
  body += rect(90, 238, 252, 63, severity > .35 ? P.land : P.green);
  body += plants(state.cropStress, 104, 259, 8, 2, .97);
  body += rect(425, 232, 127, 95, P.paper) + rect(434, 318 - level * 9, 109, level * 9, P.sea, 'none');
  body += house(513, 183, .85);
  if (severity > .12) for (const path of ['M113,303l38,-13 24,16 36,-15', 'M151,290l13,-19 26,-8', 'M256,298l-17,-24 18,-16']) body += `<path d="${path}" stroke="${P.ink}" stroke-width="${.5 + severity * 1.6}" fill="none"/>`;
  if (!state.lowRain) body += cloud(226, 86, .92) + rain(167, 292, 122, 212, t, 9);
  return body + label(mode ? severity > .1 ? '土壤缺水' : '降水偏少' : '水分充足', 233, 51) + label('农作物', 200, 366) + label('水源', 490, 366);
}

function urban(t: number, mode: number, id: string) {
  const q = .25 + .75 * ease(t), waterH = [.4 + 2.3 * q, .22 + .55 * q, .15 + .3 * q][mode] * 7;
  let body = rect(67, 217, 513, 110, P.land) + rect(67, 303, 513, 24, P.rock);
  body += house(116, 207, 1.02) + house(527, 207, 1.02) + cloud(322, 75, 1.1);
  if (mode < 2) body += rect(67, 208, 513, 9, mode ? P.green : P.rock);
  else {
    body += rect(67, 208, 225, 9, P.rock) + rect(363, 208, 217, 9, P.rock);
    body += shape([[292, 210], [307, 247], [347, 247], [363, 210]], P.green);
    body += rect(307, 249, 40, 38, P.rock) + plants(0, 313, 244, 2, 1, .58);
  }
  body += rect(169, 207 - waterH, 315, waterH, P.sea, 'none') + rain(236, 403, 110, 187, t, 12);
  body += trace([[177, 199 - waterH], [414, 199 - waterH], [552, 210]], t, id, P.water, mode ? 2 : 6);
  body += `<path d="M328,282V311H569" fill="none" stroke="${P.cool}" stroke-width="9"/>`;
  if (mode) {
    for (const x of mode === 2 ? [315, 339] : [181, 327, 456]) body += trace([[x, mode === 2 ? 245 : 221], [x, 272], [x + 13, 293]], t, id, P.water, 2);
    body += trace([[328, 290], [328, 311], [565, 311]], t * .35, id, P.water, 2);
  }
  return body + label('降水', 204, 57) + label('地表径流', 476, 169) + label('排水', 546, 365) + (mode ? label('下渗', 215, 285) : '') + (mode === 2 ? label('雨水花园', 328, 172) : '');
}

function gnss(t: number, mode: number, id: string) {
  const center: Pt = [307, 232], receiver: Pt = [369, 143], station: Pt = [224, 188];
  let body = circle(...center, 106, P.sea) + `<ellipse cx="307" cy="232" rx="42" ry="106" fill="none" stroke="${P.ink}" stroke-width="1.2"/><ellipse cx="307" cy="232" rx="106" ry="38" fill="none" stroke="${P.ink}" stroke-width="1.2"/>`;
  body += house(...station, .47) + line(receiver, [receiver[0], receiver[1] - 20], P.ink, 3) + circle(receiver[0], receiver[1] - 23, 5, P.red);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + .27 + t * Math.PI * .4, at: Pt = [307 + Math.cos(a) * 216, 158 + Math.sin(a) * 94];
    body += `<g transform="translate(${at[0]},${at[1]}) rotate(${-a * 30})">${rect(-10, -9, 20, 18)}${rect(-43, -6, 28, 12, P.cool)}${rect(15, -6, 28, 12, P.cool)}${line([-15, 0], [-10, 0])}${line([10, 0], [15, 0])}</g>`;
    if (mode) body += trace([at, [receiver[0], receiver[1] - 19]], t + i * .1, id, P.water, 2);
    else if (i === 0) body += trace([station, at], t, id, P.red, 2);
  }
  if (mode === 2) {
    const path: Pt[] = [[447, 293], [415, 221], receiver], at = along(path, ease(t));
    body += trace([receiver, [467, 212], [482, 284]], t, id, P.red, 3) + rect(at[0] - 10, at[1] - 7, 20, 14, P.warm);
  }
  return body + label('卫星星座', 307, 52) + label('地面监控', 151, 346) + label('用户接收', 503, 315) + (mode === 2 ? label('定位助救援', 469, 378) : '');
}

function warehouse(mode: number) {
  const project = ([x,z]: Pt): Pt => [28 + x * 5.9, 53 + z * 4.55];
  const routes = [0,1,2].map(warehouseRoutes);
  const road = (path: Pt[], color: string, width: number) =>
    `<polyline points="${points(path.map(project))}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
  let body = rect(45.7,80.3,554.6,282.1,'#bdc7a6',P.rock,3);
  // Intersect the illustrated high-water level with the same incised relief as the 3D map.
  const bank = (side: number): Pt[] => Array.from({length:63},(_,i)=>{
    const z=6+i, center=warehouseRiverX(z);
    let wet=center, dry=center+side*15;
    for(let step=0;step<9;step++){
      const mid=(wet+dry)/2;
      if(warehouseHeight(mid,z)<=WAREHOUSE_WATER_LEVEL) wet=mid;
      else dry=mid;
    }
    return project([wet,z]);
  });
  const contour=(elevation:number):Pt[]=>Array.from({length:80},(_,i)=>{
    const angle=2*Math.PI*i/80, dx=Math.cos(angle), dz=Math.sin(angle);
    let inside=0, outside=48;
    for(let step=0;step<10;step++){
      const r=(inside+outside)/2;
      if(warehouseHeight(83+r*dx,12+r*dz)>elevation) inside=r;
      else outside=r;
    }
    return project([83+inside*dx,12+inside*dz]);
  });
  body+='<defs><clipPath id="warehouse-relief-bounds"><rect x="45.7" y="80.3" width="554.6" height="282.1"/></clipPath></defs><g clip-path="url(#warehouse-relief-bounds)">';
  for(const [i,elevation] of [7,10,13,16].entries()){
    body+=shape(contour(elevation),['#bdbea0','#c2b99a','#ccbd9d','#d7c7ab'][i],'#92997d',.85);
  }
  body+='</g>';
  for(const row of routes) for(const route of row) body+=road(route,'#ede0bf',7);
  for(const route of routes[mode]) body+=road(route,'#964d36',3.4);
  body+=shape([...bank(-1),...bank(1).reverse()],'#94bfc1','#688e91',1);
  WAREHOUSE_TOWNS.forEach(([x,z])=>{
    const town=project([x,z]);
    body+=house(town[0]-12,town[1]-5,.33)+house(town[0]+8,town[1]-10,.30)+house(town[0]+19,town[1]+3,.23)+house(town[0]-5,town[1]+5,.29);
  });
  WAREHOUSE_SITES.forEach((site,index)=>{
    const [x,y]=project(site);
    const roof=index===mode?'#964d36':'#52675f';
    body+=`<g data-model-selection="${index}" data-specimen-key="" data-keep-phase="" role="button" tabindex="0" aria-label="比较${['近河低地','路网节点','偏远山地'][index]}库址" aria-pressed="${mode===index}"><rect x="${x-40}" y="${y-45}" width="80" height="75" fill="transparent"/><g transform="translate(${x} ${y})">`+rect(-20,-7,40,25,'#d8c8a9')
      +shape([[-23,-6],[-17,-21],[16,-21],[23,-6]],roof)
      +rect(-6,1,12,17,'#42554c')+shape([[-6,18],[6,18],[8,26],[-8,26]],'#b7b3a1')+'</g>';
    body+=label(['甲 · 近河','乙 · 路口','丙 · 山地'][index],x,y-28)+'</g>';
  });
  return body+label('受灾聚落',489,377);
}
export function flatWaterRiskExtra(f: Figure, phase: number, selection: number): string | null {
  const effect = String(f.effect), t = q01(phase), id = `water-risk-${effect}`;
  const mode = Math.max(0, Math.min(['desalination', 'flood', 'drought', 'disaster-chain'].includes(effect) ? 1 : 2, Math.trunc(Number.isFinite(selection) ? selection : 0)));
  let body: string;
  switch (effect) {
    case 'salinity': return salinitySvg(t, mode);
    case 'density': body = density(t, mode); break;
    case 'desalination': body = desalination(t, mode, id); break;
    case 'flood': body = floodSectionDrawing(t, mode); break;
    case 'drought': body = drought(t, mode); break;
    case 'urban-waterlogging': body = urban(t, mode, id); break;
    case 'gnss': body = gnss(t, mode, id); break;
    case 'warehouse': body = warehouse(mode); break;
    case 'disaster-chain': return disasterChainSvg(t, mode);
    default: return null;
  }
  if(effect==='flood'||effect==='drought') return wrap(f.title,body+hydrologyDrawing(t,mode,effect==='flood'),id,518);
  return wrap(f.title, body, id);
}
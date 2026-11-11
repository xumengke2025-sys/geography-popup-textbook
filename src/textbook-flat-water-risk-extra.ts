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
function wrap(title: string, body: string, id: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 390" class="flat-model-svg flat-explanation-svg" role="img" aria-label="${escaped(title)}"><defs><marker id="${id}-flow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto"><path d="M0,0L10,5L0,10Z" fill="${P.water}"/></marker><marker id="${id}-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto"><path d="M0,0L10,5L0,10Z" fill="${P.red}"/></marker></defs><rect width="640" height="390" fill="${P.paper}"/>${body}</svg>`;
}

function density(_t: number, mode: number) {
  const state = evaluateDensityComparison(mode), angle = -state.angle;
  let body = rect(266, 328, 108, 12, P.land) + shape([[293, 329], [312, 142], [328, 142], [347, 329]], P.paper);
  const ends: Pt[] = [-1, 1].map(side => [320 + side * 177 * Math.cos(angle), 144 + side * 177 * Math.sin(angle)]);
  body += line(ends[0], ends[1], P.rock, 10) + circle(320, 144, 8, P.ink);
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

function flood(t: number, mode: number, id: string) {
  const state = evaluateFloodSequence(t, mode), waterY = 338 - (state.waterLevel - 2) * 12;
  let body = shape([[48, 312], [55, 182], [104, 111], [163, 177], [204, 159], [253, 247], [325, 275], [592, 277], [592, 339], [48, 339]], P.green);
  body += `<path d="M250,162Q298,219 312,265Q336,286 324,338" fill="none" stroke="${P.water}" stroke-width="26"/>`;
  body += rect(347, 307, 227, 8, P.rock);
  body += house(401, 299, .82) + house(479, 300, .9) + house(547, 300, .72);
  if (state.rise > 0) body += rect(283, waterY, 299, 339 - waterY, P.sea, 'none');
  body += cloud(186, 75, .86) + cloud(329, 71, .88);
  if (state.heavyRain) body += rain(138, 364, 106, 207, t, 15);
  if (state.runoff > 0) body += `<g opacity="${state.runoff}">${trace([[176, 165], [232, 231], [305, 274], [326, 322]], t, id, P.water, 4)}</g>`;
  body += trace([[257, 190], [291, 243], [313, 286], [324, 329]], t, id, P.water, mode ? 5 : 3);
  return body + label('河道', 271, 369) + label('低洼聚落', 486, 369) + (mode ? label('连续强降水', 307, 52) : '');
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

function warehouse(t: number, mode: number, id: string) {
  const sites: Pt[] = [[152, 171], [320, 240], [481, 134]], towns: Pt[] = [[137, 311], [472, 315], [537, 237]], junction: Pt = [321, 277];
  let body = shape([[51, 310], [69, 113], [214, 79], [365, 112], [480, 68], [573, 163], [591, 329], [57, 329]], P.green);
  body += shape([[402, 169], [480, 71], [547, 148], [572, 195], [485, 189]], P.land);
  body += `<path d="M139,102Q171,164 141,219T160,328" fill="none" stroke="${P.water}" stroke-width="15"/>`;
  const routes = sites.map((site, i) => towns.map(town => i === 1 ? [site, junction, town] : [site, i === 0 ? [242, 218] as Pt : [439, 212] as Pt, junction, town]));
  for (const route of routes[1]) body += `<polyline points="${points(route)}" fill="none" stroke="${P.rock}" stroke-width="7"/>`;
  for (const i of [0, 2]) body += `<polyline points="${points(routes[i][0].slice(0, 3))}" fill="none" stroke="${P.rock}" stroke-width="7"/>`;
  sites.forEach((site, i) => { body += house(...site, .7) + (i === mode ? circle(site[0], site[1] + 3, 29, 'none', P.warm) : ''); });
  towns.forEach(town => { body += house(...town, .47) + house(town[0] + 18, town[1] - 7, .34); });
  routes[mode].forEach((route, i) => { const at = along(route, t); body += trace(route, t + i * .1, id, P.water, 3) + rect(at[0] - 5, at[1] - 7, 10, 10, P.warm); });
  if (mode === 0) body += `<ellipse cx="152" cy="174" rx="48" ry="19" fill="none" stroke="${P.red}" stroke-width="1.8" stroke-dasharray="5 5"/>`;
  return body + label('近河低地', 143, 99) + label('路网节点', 320, 197) + label('偏远山地', 486, 61) + label('受灾聚落', 482, 368);
}

export function flatWaterRiskExtra(f: Figure, phase: number, selection: number): string | null {
  const effect = String(f.effect), t = q01(phase), id = `water-risk-${effect}`;
  const mode = Math.max(0, Math.min(['desalination', 'flood', 'drought', 'disaster-chain'].includes(effect) ? 1 : 2, Math.trunc(Number.isFinite(selection) ? selection : 0)));
  let body: string;
  switch (effect) {
    case 'salinity': return salinitySvg(t, mode);
    case 'density': body = density(t, mode); break;
    case 'desalination': body = desalination(t, mode, id); break;
    case 'flood': body = flood(t, mode, id); break;
    case 'drought': body = drought(t, mode); break;
    case 'urban-waterlogging': body = urban(t, mode, id); break;
    case 'gnss': body = gnss(t, mode, id); break;
    case 'warehouse': body = warehouse(t, mode, id); break;
    case 'disaster-chain': return disasterChainSvg(t, mode);
    default: return null;
  }
  return wrap(f.title, body, id);
}

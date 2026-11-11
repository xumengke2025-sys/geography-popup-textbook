import type { Figure } from './textbook-catalog';
import { evaluateSoilTransferDetail } from './textbook-soil-transfer-detail-model';
import { DELTA_TOP, deltaBranchPoint, deltaMainPoint, evaluateDeltaDeposition } from './textbook-delta-model';
import { soilSortingSvg } from './textbook-soil-sorting-model';
import { coastalProcessSvg } from './textbook-coastal-process-model';
import { evaluateAeolian } from './textbook-aeolian-model';

/** Readable, independently drawn fallback for the additional chapter 4/5
 * models. No textbook crop, bitmap or external resource is used here. */
export function flatLandExtra(f: Figure, phase: number, selection: number, inspection = 'overview'): string | null {
  const t = clamp(phase), n = Math.max(0, Math.round(selection));
  switch (f.effect as string) {
    case 'river-valley': return valleySvg(t, Math.min(1, n));
    case 'delta': return deltaSvg(t, Math.min(2, n));
    case 'aeolian': return aeolianSvg(phase, selection);
    case 'coastal-landform': return coastalSvg(t, Math.min(3, n));
    case 'terrain-observation': return terrainSvg(t, Math.min(3, n));
    case 'vegetation': return vegetationSvg(t, Math.min(6, n), inspection);
    case 'soil-factors': return soilSvg(t, Math.min(4, n));
    case 'karst-livelihood': return karstSvg(t, Math.min(3, n));
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
const svg = (title: string, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" class="flat-model-svg flat-explanation-svg" viewBox="0 0 640 390" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title><g stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
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

function valleySvg(t: number, n: number) {
  const surface = n ? 'M50 143Q140 178 206 249Q250 264 300 268H348Q410 264 444 248Q520 174 590 144' : 'M50 88Q122 123 190 190L312 290H331L450 181Q525 117 590 83';
  const water = n ? 'M258 266H389L375 278H272Z' : 'M308 286H335L333 297H310Z';
  return svg(n ? '平原河谷宽而浅，两岸发育冲积平原' : '山地V形河谷，岸坡陡、谷底狭窄',
    path(`${surface}V328H50Z`, C.land) + path(surface, 'none', C.ink, 2) + path(water, C.water, C.water)
    + flow([[320, 299], [320, 315]], t, 1)
    + text(320, 365, n ? '平原槽形谷' : '山地 V 形谷', 28)
    + text(142, n ? 218 : 178, n ? '冲积平原' : '岸坡陡') + text(456, 274, n ? '宽而浅' : '谷底狭窄'));
}

function deltaSvg(t: number, n: number) {
  const state = evaluateDeltaDeposition(t), point = (u: number, v: number): P => [50 + u * 540, 25 + v * 300];
  const main: P[] = Array.from({ length: 33 }, (_, i) => { const p = deltaMainPoint(i / 32); return point(...p); });
  let bed = '', channels = '';
  for (let i = 0; i < 3; i++) {
    const front = state.branches[i].front, sides: P[][] = [[], []];
    for (let j = 0; j <= 42; j++) {
      const q = (front + .03) * j / 42, p = deltaBranchPoint(i, q), width = .042 + .045 * Math.sqrt(q);
      const distal = 1 - smooth(front - .065, front + .035, q), threshold = (5.2 - 1.35) / (DELTA_TOP - 1.35);
      if (distal < threshold) continue;
      let lo = .4 * width, hi = width;
      for (let k = 0; k < 12; k++) { const mid = (lo + hi) / 2; if ((1 - smooth(width * .4, width, mid)) * distal > threshold) lo = mid; else hi = mid; }
      sides[0].push(point(p[0] - lo, p[1])); sides[1].push(point(p[0] + lo, p[1]));
    }
    if (sides[0].length > 1) bed += path(`M${sides[0].concat(sides[1].reverse()).join('L')}Z`, '#c8b48e', C.ink, 1.3);
    if (state.branches[i].deposition > .02) {
      const route: P[] = Array.from({ length: 25 }, (_, j) => { const p = deltaBranchPoint(i, Math.max(.02, front - .09) * j / 24); return point(...p); });
      channels += path(`M${route.join('L')}`, 'none', C.water, 6);
      if (n > 0) channels += flow(route, t * 1.6, 1);
    }
  }
  const sediment = state.grains.map(grain => {
    if (grain.stage === 'waiting' || (n === 0 && grain.stage !== 'transport')) return '';
    const p = point(grain.position[0], grain.position[2]), y = p[1] - (grain.position[1] - DELTA_TOP) * 5.4;
    const guide = grain.stage === 'settling' ? path(`M${p[0]},${p[1] - (9.05 - DELTA_TOP) * 5.4}V${y}`, 'none', '#a28b65', .8) : '';
    return `<g data-delta-grain="${grain.id}" data-stage="${grain.stage}" data-size="${grain.grainClass}">${guide}${circle(p[0], y, grain.radius * 4.4, ['#8d7856', '#a68b61', '#b39a71'][grain.id % 3], grain.stage === 'deposited' ? '#78684d' : 'none')}</g>`;
  }).join('');
  const sorting = (n > 0 && state.deposition > .2 ? text(128, 219, '较粗', 25) : '')
    + (n > 0 && state.grains.some(g => g.grainClass === 'fine' && (g.stage === 'settling' || g.stage === 'deposited')) ? text(529, 309, '较细', 25) : '');
  return svg('河流搬运泥沙，在河口减速、沉降并留存；沉积前缘推进，较粗近、较细远。距离、颗粒及时间均为示意，三角洲形态多样',
    `<g data-delta-deposited="${state.deposited}" data-delta-deposition="${state.deposition}">`
    + path('M45 25H595V340H45Z', C.sea, 'none') + bed
    + path('M45 25H595V127H45Z', C.land, 'none') + path('M45 127H595V139H45Z', '#ae9d7c', 'none')
    + path(`M${main.join('L')}`, 'none', C.water, 12) + channels + flow(main, t * 2.5, 2) + sediment + sorting
    + text(320, 373, ['冲积平原', '河口沉积', '岸线推进'][n], 29) + '</g>');
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
    labels = text(320, 373, n === 3 ? '植被固沙' : '新月形沙丘', 29) + text(175, 258, n === 3 ? '根系固定' : '迎风坡缓') + text(477, 316, n === 3 ? '风沙受阻' : '背风坡陡');
  }
  return svg(['风蚀蘑菇，下部侵蚀较强', '雅丹垄脊与主风向一致', '新月形沙丘，迎风坡缓，背风坡陡', '植被使流沙受到固定'][n] + '；四种类型独立对照，距离与时间均为示意',
    `<g data-aeolian-form="${state.form}" data-aeolian-phase="${state.phase}" data-aeolian-erosion="${state.erosion}" data-aeolian-neck-scale="${state.neckScale}" data-aeolian-dune-offset="${state.duneOffset}">`
    + path('M40 336H600', 'none', '#b3a78d') + winds
    + `<g data-model-replay="true" data-model-selection="${n}" role="button" tabindex="0" aria-label="从头观察${state.title}示意">${body}</g>` + labels + '</g>');
}

function coastalSvg(t: number, n: number) {
  if (n === 0) return coastalProcessSvg(t);
  const cliff = `<g>${path('M42 82L77 68 109 77 137 69 174 83 198 92V269H42Z', C.rock)}${path('M47 132L191 146M47 181L191 193M47 230L191 241', 'none', '#998a74', 1)}</g>`;
  const arch = path('M243 272V179Q245 131 291 127Q338 129 342 180V272H318V184Q315 159 291 157Q268 160 267 186V272Z', C.rock);
  const seaStack = path('M402 275L408 168 427 160 447 179 450 275Z', C.rock);
  const beach = path('M508 275L585 236V319H508Z', '#d8c7a0');
  const waves = [0, 1, 2].map(j => {
    const y = 318 - cycle(t * .55 + j / 3) * 37; return path(`M48 ${y}q28-7 54 0t54 0m24 0q28-7 54 0t54 0m24 0q28-7 54 0t54 0`, 'none', '#6f969d', 1.4);
  }).join('');
  const names = [['海蚀崖', '海蚀平台', '海浪侵蚀'], ['海蚀拱桥', '海浪贯通', '岩石海岸'], ['海蚀柱', '海浪侵蚀', '岩石海岸'], ['海滩', '海岸堆积', '陆地']][n];
  return svg(names.join('，') + '，并非每处海岸必然经历同样顺序', path('M40 273H600V330H40Z', C.sea, 'none') + path('M40 266H225L218 280H40Z', '#c3b69b') + cliff + arch + seaStack + beach + waves
    + text(320, 373, names[0], 29) + text(n === 0 ? 255 : n === 3 ? 490 : 316, n === 0 ? 245 : 98, names[1]) + text(119, 43, names[2])
    + flow([[n === 3 ? 548 : n === 2 ? 428 : 289, 324], [n === 3 ? 560 : n === 2 ? 428 : 289, 278]], t, 2));
}

function terrainSvg(t: number, n: number) {
  const relief = path('M54 300Q115 286 162 189Q201 100 257 86Q291 118 322 196Q347 243 384 228Q420 174 454 168Q505 218 587 300V332H54Z', '#bab79e');
  let body = '';
  if (n === 0) body = path('M37 332H604', 'none', C.water, 2) + arrow([106, 330], [106, 86], C.warm) + path('M106 86H257', 'none', '#989a87')
    + text(102, 65, '绝对高度') + text(498, 365, '海平面') + text(282, 65, '山顶');
  else if (n === 1) body = arrow([549, 168], [549, 86], C.warm) + path('M257 86H560M454 168H560', 'none', '#989a87')
    + text(514, 57, '相对高度') + text(240, 59, '较高处') + text(424, 148, '较低处');
  else if (n === 2) body = path('M257 86V300H369Z', 'none', C.warm, 2.2) + path('M257 285h15v15', 'none', C.warm, 1.5)
    + text(170, 198, '垂直距离') + text(319, 357, '水平距离') + text(392, 281, '坡度');
  // The side section runs north (left) to south (right), so sunlight enters
  // from the southern sky. This is the same assumption as the 3-D model.
  else body = arrow([522, 345], [115, 345], C.warm) + text(80, 366, '北') + text(558, 366, '南')
    + circle(529, 59, 17, '#c2a16c') + flow([[521, 80], [359, 232]], t, 1, C.warm) + text(409, 306, '阳坡') + text(200, 220, '阴坡');
  return svg(['绝对高度以海平面为基准，不提供虚构海拔', '相对高度是两点的高度差', '坡度可由垂直距离与水平距离关系表示', '坡向演示假定北半球中纬度，北南方位与图相对固定'][n], relief + body);
}

function vegetationSvg(t: number, n: number, inspection: string) {
  const names = ['热带雨林', '常绿阔叶林', '落叶阔叶林', '亚寒带针叶林', '热带草原', '温带草原', '荒漠植被'];
  const traits = [['层次丰富', '藤本、板根'], ['常绿', '革质叶片'], ['春夏发叶', '秋冬落叶'], ['针状叶', '抗寒抗旱'], ['湿季葱绿', '干季枯黄'], ['夏绿冬枯', '草本较低'], ['旱生灌木', '稀疏、耐旱']][n];
  const autumn = smooth(.28, .82, t), leafiness = n === 2 ? 1 - .95 * autumn : 1;
  const leafColor = n === 2 && t > .35 ? '#b49c70' : C.dark;
  let forms = '';
  if (n < 4) for (let i = 0; i < 6; i++) {
    const x = 97 + i * 88, h = (n === 0 ? 157 : 127) + i % 3 * 16, ground = 307 - i % 2 * 6;
    forms += n === 3 ? conifer(x, ground, h) : broadTree(x, ground, h, leafColor, leafiness);
    if (n === 0 && i % 2 === 0) {
      forms += `<g data-plant-part="buttress">${path(`M${x} ${ground}l-17-1 17-32 16 33Z`, '#a39471', inspection === 'buttress' ? '#a65f47' : '#7b8269', inspection === 'buttress' ? 3.4 : 1.5)}</g>`;
      forms += `<g data-plant-part="vine">${path(`M${x + 7} ${ground - h * .7}q-13 37 0 67t-6 42`, 'none', inspection === 'vine' ? '#a65f47' : '#8a9477', inspection === 'vine' ? 4.2 : 1.8)}</g>`;
    }
  }
  if (n === 0 || n === 1) for (let i = 0; i < (n === 0 ? 9 : 4); i++) forms += broadTree(74 + i * (n === 0 ? 60 : 150), 310, 37 + i % 3 * 8, '#a5b291');
  if (n >= 4) {
    const count = n === 6 ? 17 : 72, color = t > .45 && n !== 6 ? '#b7ad7e' : '#8a9c73';
    for (let i = 0; i < count; i++) {
      const x = 63 + i * 523 / Math.max(1, count - 1), y = 308 - i % 4 * 5, h = n === 6 ? 10 : n === 5 ? 19 + i % 3 * 4 : 29 + i % 3 * 5;
      forms += path(`M${x - 4} ${y}q6-${h * .5} 1-${h}M${x} ${y}l5-${h * .7}M${x} ${y}l-7-${h * .6}`, 'none', color, 1.4);
    }
    if (n === 4) forms += broadTree(155, 291, 86) + broadTree(478, 306, 72);
    if (n === 6) forms += broadTree(162, 306, 37, '#8f9b76') + broadTree(476, 302, 30, '#8f9b76');
  }
  if (n === 2 && t > .3 && t < .92) for (let i = 0; i < 9; i++) {
    const q = cycle(t * 1.4 + i / 9); forms += `<ellipse cx="${95 + i % 6 * 88 + Math.sin(q * 7) * 9}" cy="${150 + q * 150}" rx="4" ry="1.7" fill="#b48b57" transform="rotate(${q * 100} ${95 + i % 6 * 88} ${150 + q * 150})"/>`;
  }
  if (n === 0 && inspection === 'layers') forms += '<g data-plant-part="layers" fill="none" stroke="#a65f47" stroke-width="2" stroke-dasharray="6 5"><path d="M57 154H589M57 231H589M57 291H589"/></g>';
  return svg(`${names[n]}，${traits.join('，')}，植物结构为示意`, `<g data-inspection="${['vine','buttress','layers'].includes(inspection) ? inspection : 'overview'}">` + path('M43 312H599V331H43Z', '#b9b69a') + forms + '</g>' + text(320, 373, names[n], 29) + text(166, 61, traits[0]) + text(485, 86, traits[1]));
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

function karstSvg(t: number, n: number) {
  const landD = 'M44 315Q69 291 100 183Q128 82 154 96Q185 115 206 250Q225 282 252 273Q278 256 297 151Q323 50 349 79Q385 142 398 261Q420 287 446 258Q468 187 488 130Q511 91 537 177Q561 264 596 314';
  let trees = '', action = '';
  const places: [number, number, number][] = [[117, 147, 37], [174, 162, 35], [198, 243, 32], [283, 208, 35], [318, 85, 34], [366, 148, 36], [390, 245, 32], [481, 153, 37], [532, 190, 34], [557, 267, 31]];
  places.forEach(([x, y, h], i) => { if (n !== 1 || i > 7) trees += broadTree(x, y, h, i < 4 ? '#849b7c' : '#a0ad86'); });
  const dry = n === 2 && t >= .5, wet = n === 2 ? dry ? 1 - smooth(.5, 1, t) : smooth(0, .5, t) : n === 0 ? .15 : 0;
  if (wet > .03) action += `<ellipse cx="246" cy="275" rx="${24 + wet * 26}" ry="${2 + wet * 8}" fill="${C.water}"/>`;
  if (n === 2 && !dry) {
    action += path('M211 47q-5-19 13-22 18-25 36-4 27-3 30 22 21 18-4 24H223q-19 0-12-20Z', C.paper, '#a0aba0');
    for (let i = 0; i < 4; i++) action += flow([[216 + i * 21, 80], [216 + i * 21, 202]], t + i * .13, 2);
  }
  if (n < 3) {
    action += flow([[179, 193], [201, 249], [246, 274]], t, n === 1 ? 4 : 2, n === 1 ? C.warm : C.water)
      + flow([[389, 209], [399, 260], [368, 281]], t + .1, n === 1 ? 4 : 2, n === 1 ? C.warm : C.water)
      + flow([[249, 282], [261, 305], [258, 328], [284, 342]], t, 2);
    if (n === 1) for (let i = 0; i < 12; i++) { const q = cycle(t * .7 + i / 12); action += circle(180 + q * 65, 190 + q * 84, 2.4, '#aa825b'); }
  } else {
    for (let i = 0; i < 5; i++) action += path(`M215 ${284 + i * 5}q32-5 61-1m125 0q19-5 37-2`, 'none', '#7b8f68', 2);
  }
  const names = [['植被保护', '坡陡土薄', '裂隙发育'], ['植被破坏', '水土流失', '岩石裸露'], [dry ? '晴时易旱' : '雨时积水', '裂隙渗漏', '峰丛洼地'], ['山顶水源林', '坡地经济林', '洼地粮食作物']][n];
  return svg(names.join('，') + '，为喀斯特峰丛山地教学示意', path(`${landD}V346H44Z`, n === 1 && t >= .45 ? '#b4aa94' : '#b7b494') + path(landD, 'none', C.ink, 1.8) + trees + action
    + text(320, n === 3 ? 49 : 378, names[0], 28) + text(n === 3 ? 505 : 134, 67, names[1], 25) + text(n === 3 ? 244 : 480, n === 3 ? 327 : 319, names[2], 25));
}

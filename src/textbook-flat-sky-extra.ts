import type { Figure } from './textbook-catalog';
import { hazeSvg } from './textbook-haze-model';
import { airCompositionExtraSvg } from './textbook-air-composition-model';
import { evaluateSolarDisturbance, evaluateSphereExchange, evaluateMarsTransfer,
  evaluateGreenhouseResponse, GEOLOGICAL_INTERVALS, geologicalInterval, skyClamp, skyProgress } from './textbook-sky-causality-model';

/** Original vector diagrams for the no-WebGL reading mode. They never replace
 * the printed textbook and are not sampled by the Three.js models. */
const P = { paper: '#f7f1e3', ink: '#303a40', sea: '#a7c6ce', water: '#669da9', land: '#c6b69a', rock: '#c0b09a', green: '#a8b197', warm: '#c18358', cool: '#6a99aa', gold: '#bb985c' };
type Point = [number, number];
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
const choice = (n: number, max: number) => Math.max(0, Math.min(max, Math.round(Number.isFinite(n) ? n : 0)));
const text = (x: number, y: number, value: string, size = 25) => `<text x="${x}" y="${y}" text-anchor="middle" fill="${P.ink}" font-family="FieldSerif,SimSun,serif" font-size="${size}">${esc(value)}</text>`;
const paperText = (x: number, y: number, value: string, size = 24) => {
  const width = [...value].reduce((n, c) => n + (/[\u0000-\u007f]/.test(c) ? .55 : 1) * size, 8);
  return `<rect x="${x - width / 2}" y="${y - size * .93}" width="${width}" height="${size * 1.2}" fill="${P.paper}"/>` + text(x, y, value, size);
};
const circle = (x: number, y: number, r: number, color: string) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="${P.ink}" stroke-width="1.1"/>`;
const line = (d: string, color = P.ink, width = 1.4) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const cloud = (x: number, y: number, s = 1) => `<path d="M${x - 40 * s} ${y + 10 * s}a${19 * s} ${15 * s} 0 0 1 ${17 * s} ${-24 * s}a${25 * s} ${20 * s} 0 0 1 ${47 * s} 0a${19 * s} ${15 * s} 0 1 1 ${16 * s} ${24 * s}Z" fill="${P.paper}" stroke="${P.ink}" stroke-width="1.1"/>`;
const earth = (x: number, y: number, r: number) => circle(x, y, r, P.sea) + `<path d="M${x - r * .82} ${y - r * .32}q${r * .24} ${-r * .65} ${r * .61} ${-.35 * r}l${r * .21} ${r * .35}-${r * .24} ${r * .22}-.1 ${r * .48}-${r * .28} ${r * .10}-${r * .13} ${-.47 * r}Z M${x + r * .35} ${y - r * .44}q${r * .42} ${r * .02} ${r * .5} ${r * .47}l${-r * .31} ${r * .12}-${r * .29} ${-r * .23}Z" fill="${P.green}" stroke="${P.ink}" stroke-width=".7"/>`;
const tree = (x: number, y: number, h: number, broad = false) => line(`M${x} ${y}V${y - h * .83}`, P.rock, 3) + (broad
  ? `<ellipse cx="${x}" cy="${y - h * .74}" rx="${h * .29}" ry="${h * .28}" fill="${P.green}" stroke="${P.ink}" stroke-width="1"/>`
  : `<path d="M${x - h * .24} ${y - h * .22} ${x} ${y - h} ${x + h * .24} ${y - h * .22}Z" fill="${P.green}" stroke="${P.ink}" stroke-width="1"/>`);
function flow(points: Point[], phase: number, count = 3, color = P.water, width = 2.4) {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  const total = lengths.reduce((sum, n) => sum + n, 0);
  let result = line(points.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' '), color, width * .55);
  for (let i = 0; i < count; i++) {
    let distance = ((phase + i / count) % 1 + 1) % 1 * total, j = 0;
    while (j < lengths.length - 1 && distance > lengths[j]) distance -= lengths[j++];
    const a = points[j], b = points[j + 1], t = lengths[j] ? distance / lengths[j] : 0;
    const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
    result += `<path d="M-10-4 0 0-10 4" transform="translate(${x} ${y}) rotate(${Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI})" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return result;
}
function vector(a: Point, b: Point, color: string, width = 4) {
  return line(`M${a[0]} ${a[1]}L${b[0]} ${b[1]}`, color, width) + `<path d="M-16-7 0 0-16 7Z" transform="translate(${b[0]} ${b[1]}) rotate(${Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI})" fill="${color}"/>`;
}
/** A single material/event has one position. Its completed trail stays behind;
 * scrubbing changes this same identity rather than restarting repeated arrows. */
function tracked(points: Point[], progress: number, color: string, id: string, vapor = false, kind?: string) {
  const q = skyClamp(progress), segment = Math.min(points.length - 2, Math.floor(q * (points.length - 1))), fraction = q * (points.length - 1) - segment;
  const a = points[segment], z = points[segment + 1], at: Point = [a[0] + (z[0] - a[0]) * fraction, a[1] + (z[1] - a[1]) * fraction];
  const trail = [...points.slice(0, segment + 1), at];
  const mark = kind === 'food' ? `<rect x="${at[0] - 6}" y="${at[1] - 4}" width="12" height="8" fill="${P.land}" stroke="${P.ink}"/><path d="M${at[0]} ${at[1] - 4}v8" stroke="${P.ink}"/>`
    : kind === 'electricity' ? `<path d="M${at[0] + 1} ${at[1] - 8}l-6 9h5l-2 7 8-11h-5Z" fill="${P.gold}" stroke="${P.ink}" stroke-width=".8"/>`
    : kind === 'carbon-dioxide' ? [-1, 0, 1].map(i => circle(at[0] + i * 5.5, at[1], i ? 3.5 : 4.3, i ? P.cool : P.rock)).join('')
    : kind === 'oxygen' ? [-1, 1].map(i => circle(at[0] + i * 3.3, at[1], 4.3, P.green)).join('')
    : kind === 'water' ? `<path d="M${at[0]} ${at[1] - 7}q-7 8-3 11 3 4 6 0 4-3-3-11Z" fill="${P.water}" stroke="${P.ink}" stroke-width=".8"/>` : circle(at[0], at[1], 4.8, color);
  return `<g data-transfer-id="${id}"${kind ? ` data-symbol-kind="${kind}"` : ''}>${line(trail.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' '), color, 2)}${vapor
    ? `<path d="M${at[0]} ${at[1] - 5}l4 5-4 5-4-5Z" fill="${P.paper}" stroke="${color}" stroke-width="1.5"/>`
    : mark}</g>`;
}
function wrap(f: Figure, body: string) {
  return `<svg class="flat-model-svg flat-explanation-svg" viewBox="0 0 640 390" role="img" aria-label="${esc(f.title)}，可改变条件的二维示意"><rect width="640" height="390" fill="${P.paper}"/>${body}</svg>`;
}

export function flatSkyExtra(f: Figure, phase: number, selection: number): string | null {
  const t = Number.isFinite(phase) ? phase : 0;
  let body: string;
  switch (f.effect) {
    case 'cosmic-scale': body = cosmic(t, choice(selection, 3)); break;
    case 'habitable': body = habitable(t, choice(selection, 2)); break;
    case 'solar-activity': body = solar(t, choice(selection, 1)); break;
    case 'geo-time': body = geological(choice(selection, 3)); break;
    case 'external-spheres': body = spheres(t, choice(selection, 2)); break;
    case 'mars-base': body = mars(t, choice(selection, 3)); break;
    case 'air-composition': body = composition(t, choice(selection, 1)); break;
    case 'greenhouse': body = greenhouse(t, choice(selection, 2)); break;
    case 'wind-forces': body = wind(t, choice(selection, 3)); break;
    case 'haze': body = hazeSvg(t, choice(selection, 2)); break;
    default: return null;
  }
  return wrap(f, body);
}

function cosmic(t: number, selected: number) {
  const c: Point[] = [[80, 257], [231, 215], [383, 169], [541, 120]], a = t * Math.PI * 2;
  let s = c.map(([x, y], i) => line(`M${x} ${y + 20}V350`, '#bcb8a8', .8) + `<ellipse cx="${x}" cy="${y}" rx="57" ry="30" fill="none" stroke="${i === selected ? P.warm : P.ink}" stroke-width="${i === selected ? 2.4 : 1}"/>`).join('');
  s += earth(c[0][0], c[0][1], 15) + circle(c[0][0] + Math.cos(a) * 51, c[0][1] - Math.sin(a) * 26, 5, P.paper);
  s += circle(c[1][0], c[1][1], 12, P.gold);
  for (let i = 0; i < 2; i++) s += circle(c[1][0] + Math.cos(a * (2 - i)) * (32 + i * 16), c[1][1] - Math.sin(a * (2 - i)) * (16 + i * 8), 4 + i, i ? P.sea : P.rock);
  for (let i = 0; i < 3; i++) {
    const pts = Array.from({ length: 20 }, (_, j): Point => { const a = i * Math.PI * 2 / 3 + j / 19 * 4, r = 3 + j / 19 * 43; return [c[2][0] + Math.cos(a) * r, c[2][1] + Math.sin(a) * r * .52]; });
    s += line(pts.map(([x, y], j) => `${j ? 'L' : 'M'}${x} ${y}`).join(' '), P.rock, 3);
  }
  s += circle(c[2][0], c[2][1], 6, P.gold);
  for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 11 + i % 3 * 14; s += `<ellipse cx="${c[3][0] + Math.cos(a) * r}" cy="${c[3][1] + Math.sin(a) * r * .55}" rx="7" ry="3" fill="${i % 2 ? P.cool : P.rock}"/>`; }
  for (let i = 0; i < 3; i++) s += i === selected ? flow([[c[i][0] + 56, c[i][1]], [c[i + 1][0] - 60, c[i + 1][1]]], t, 1, P.warm) : line(`M${c[i][0] + 57} ${c[i][1]}L${c[i + 1][0] - 61} ${c[i + 1][1]}`, P.rock);
  s += ['地月系', '太阳系', '银河系', '可观测宇宙'].map((v, i) => text(c[i][0], c[i][1] + 63, v, 24)).join('');
  return s;
}

function habitable(t: number, selected: number) {
  let s = earth(350, 210, 82) + circle(82, 174, 29, P.gold);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; s += line(`M${82 + Math.cos(a) * 36} ${174 + Math.sin(a) * 36}L${82 + Math.cos(a) * 44} ${174 + Math.sin(a) * 44}`, P.gold, 2); }
  s += `<path d="M526 219Q482 269 501 288Q526 315 550 288Q568 269 526 219Z" fill="${P.water}" stroke="${P.ink}" stroke-width="1.2"/>`;
  if (selected === 0) {
    for (let i = 0; i < 3; i++) s += flow([[126, 155 + i * 21], [259, 155 + i * 21]], t, 2, P.warm);
    s += text(180, 82, '适宜温度');
  } else if (selected === 1) s += `<ellipse cx="526" cy="276" rx="44" ry="56" fill="none" stroke="${P.warm}" stroke-width="2"/>` + flow([[501, 277], [524, 246], [545, 278]], t, 2) + text(522, 348, '液态水');
  else s += `<ellipse cx="350" cy="210" rx="97" ry="88" fill="none" stroke="${P.cool}" stroke-width="2"/><ellipse cx="350" cy="210" rx="47" ry="96" fill="none" stroke="${P.cool}" stroke-width="1.4"/>` + text(432, 80, '大气');
  return s;
}

function solar(t: number, selected: number) {
  const state = evaluateSolarDisturbance(t, selected);
  let s = circle(104, 208, 62, P.gold) + earth(500, 208, 43);
  for (const [x, y] of [[83, 190], [120, 225], [108, 171]]) s += `<ellipse cx="${x}" cy="${y}" rx="6" ry="4" fill="${P.rock}"/>`;
  s += line('M410 208C438 102 557 112 606 208M410 208C438 314 557 304 606 208', P.cool, 1.6);
  if (state.sourceOpen > 0) s += line('M162 192C198 156 196 246 162 226', P.warm, 2 + state.sourceOpen * 3);
  for (const sign of [-1, 1]) {
    if (state.enhanced && t >= .06) {
      const outward: Point[] = [[174, 208 + sign * 13], [399, 208 + sign * 27]], inward: Point[] = [outward[1], [443, 208 + sign * 78], [485, 208 + sign * 56], [500, 208 + sign * 36]];
      s += state.arrived ? line(outward.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' '), P.warm, 2) + tracked(inward, state.deflected, P.warm, sign < 0 ? 'disturbance-north' : 'disturbance-south')
        : tracked(outward, state.outbound, P.warm, sign < 0 ? 'disturbance-north' : 'disturbance-south');
    }
    if (state.auroraResponse > 0) { const y = 208 + sign * 36, h = sign * state.auroraResponse * 15; s += `<path data-polar-response="${state.auroraResponse}" d="M479 ${y}Q500 ${y + 7} 521 ${y}L521 ${y + h}Q500 ${y + h + 6} 479 ${y + h}Z" fill="${P.green}" stroke="${P.ink}" stroke-width="1.1"/>`; }
  }
  return `<g data-sky-causality-state='${JSON.stringify(state)}'>${s + text(104, 100, '太阳活动') + text(500, 91, '地球磁场') + (state.polarReceived ? text(552, 323, '极区响应') : '')}</g>`;
}

function geological(selected: number) {
  const names = ['前寒武纪', '古生代', '中生代', '新生代'];
  let s = `<path d="M65 305H575V337H65Z" fill="${P.rock}" stroke="${P.ink}" stroke-width="1.2"/>` + text(320, 65, names[selected]);
  if (selected === 0) {
    s += `<path d="M65 279H575V306H65Z" fill="${P.sea}"/>`;
    for (let i = 0; i < 6; i++) s += `<ellipse cx="${145 + i * 64}" cy="295" rx="23" ry="8" fill="${P.green}" stroke="${P.ink}" stroke-width="1"/><ellipse cx="${145 + i * 64}" cy="289" rx="19" ry="7" fill="${P.green}" stroke="${P.ink}" stroke-width=".7"/>`;
    s += text(320, 183, '蓝细菌');
  } else if (selected === 1) {
    s += `<path d="M65 275H365V306H65Z" fill="${P.sea}"/>`;
    for (let i = 0; i < 4; i++) { const x = 125 + i * 64; s += `<ellipse cx="${x}" cy="287" rx="19" ry="8" fill="${P.paper}" stroke="${P.ink}" stroke-width="1"/>`; for (let j = -2; j <= 2; j++) s += line(`M${x + j * 5} 281V293`, P.ink, .8); }
    for (const x of [410, 468, 525]) s += tree(x, 304, 98 + x % 21);
    s += text(236, 160, '海生动物');
  } else if (selected === 2) {
    s += tree(118, 304, 126) + tree(532, 304, 132);
    s += `<path d="M184 274Q220 267 247 248Q277 226 345 244L391 176Q399 154 414 157L430 170 410 181 385 253 365 267 355 305H340L340 264 286 265 277 305H262L258 263 211 285Z" fill="${P.paper}" stroke="${P.ink}" stroke-width="1.6"/>` + circle(419, 167, 1.5, P.ink);
    s += text(319, 113, '恐龙');
  } else {
    s += tree(119, 304, 121, true) + tree(499, 304, 135, true);
    s += `<path d="M220 250Q252 218 319 241L342 219 365 226 374 245 355 252 338 245 329 268 326 305H315L309 269 262 270 251 305H240L240 267Z" fill="${P.rock}" stroke="${P.ink}" stroke-width="1.5"/>`;
    s += text(320, 119, '哺乳动物');
  }
  s += GEOLOGICAL_INTERVALS.map((period, i) => { const span = geologicalInterval(i); return `<rect data-model-selection="${i}" role="button" tabindex="0" aria-label="查看${period.label}" x="${65 + 510 * span.start}" y="345" width="${510 * span.fraction}" height="10" fill="${[P.rock, P.sea, P.green, P.land][i]}" stroke="${i === selected ? P.warm : P.ink}" stroke-width="${i === selected ? 2 : .7}"/>`; }).join('');
  return s;
}

function spheres(t: number, selected: number) {
  const state = evaluateSphereExchange(t, selected);
  let s = `<path d="M50 307 110 286 185 229 262 276 343 291 420 307V352H50Z" fill="${P.rock}" stroke="${P.ink}" stroke-width="1.2"/><path d="M420 307H590V352H420Z" fill="${P.sea}" stroke="${P.ink}" stroke-width="1.2"/>`;
  s += cloud(356, 117, 1.05) + tree(251, 279, 65, true) + tree(310, 288, 51, true);
  s += line('M181 241 220 266 255 282 312 296 422 310', P.water, 4);
  state.waterIds.forEach((id, i) => {
    const q = skyClamp(t - i * .018);
    if (state.biological) s += q < .63 ? tracked([[251, 312], [251, 279], [251, 218]], skyProgress(.06, .42, q), P.water, id)
      : tracked([[251, 218], [279, 197], [356, 117]], skyProgress(.63, .95, q), P.water, id, true);
    else s += q < .22 ? tracked([[513, 306], [504, 224], [356, 117]], skyProgress(.03, .22, q), P.water, id, true)
      : q < .50 ? tracked([[356, 117], [263, 230], [220, 266]], skyProgress(.30, .50, q), P.water, id)
      : tracked([[220, 266], [312, 296], [513, 306]], skyProgress(.50, .98, q), P.water, id);
  });
  return `<g data-sky-causality-state='${JSON.stringify(state)}'>${s + text(482, 83, '大气圈') + text(517, 345, '水圈') + text(240, 194, '生物圈') + text(125, 347, '岩石圈')}</g>`;
}

function mars(t: number, selected: number) {
  const state = evaluateMarsTransfer(t, selected);
  const c: Point[] = [[150, 236], [320, 141], [490, 236], [320, 321]];
  let s = `<path d="M45 340 118 304 242 337 384 336 531 299 599 343V365H45Z" fill="#c4a489" stroke="${P.ink}" stroke-width="1"/>`;
  if (selected === 0 || selected === 1) for (const [a, b] of [[0, 2], [2, 3], [3, 0]]) s += line(`M${c[a][0]} ${c[a][1]}L${c[b][0]} ${c[b][1]}`, P.cool, selected ? 2.5 : 1);
  if (selected === 0 || selected === 2) s += line('M157 226L310 132M318 143L165 226M329 162L168 248', P.cool, selected ? 2.5 : 1);
  if (selected === 0 || selected === 3) s += line('M506 127L490 236', P.gold, selected ? 2.5 : 1);
  for (let i = 0; i < 3; i++) { const x = 472 + i * 26; s += `<path d="M${x} 85h23v43h-23Z" fill="${P.cool}" stroke="${P.ink}" stroke-width="1"/>` + line(`M${x} 99h23m-23 15h23`, P.paper, .8); }
  let cargo = '';
  state.packets.filter(packet => packet.visible).forEach(packet => {
    const points: Point[] = packet.kind === 'water' ? [[c[0], c[2]], [c[2], c[3]], [c[3], c[0]]][packet.leg ?? 0]
      : packet.kind === 'carbon-dioxide' ? [[157, 226], [310, 132]] : packet.kind === 'oxygen' ? [[318, 143], [165, 226]]
      : packet.kind === 'food' ? [[329, 162], [168, 248]] : [[506, 127], [490, 236]];
    cargo += tracked(points, packet.kind === 'water' ? packet.legProgress ?? 0 : packet.progress, packet.kind === 'electricity' ? P.gold : packet.kind === 'food' ? P.land : packet.kind === 'carbon-dioxide' ? P.rock : P.water, packet.id, false, packet.kind);
  });
  c.forEach(([x, y], i) => {
    s += `<path d="M${x - 51} ${y + 14}h102v5h-102Z" fill="${P.rock}" stroke="${P.ink}" stroke-width=".8"/><path d="M${x - 47} ${y}a47 31 0 0 1 94 0v14h-94Z" fill="${i === 1 ? P.green : P.paper}" stroke="${P.ink}" stroke-width="1.2"/>`;
    s += line(`M${x - 27} ${y}Q${x - 19} ${y - 29} ${x} ${y - 31}Q${x + 19} ${y - 29} ${x + 27} ${y}M${x} ${y - 31}V${y}`, P.rock, .7);
    const response = [Math.max(state.crewOxygenResponse, state.crewFoodResponse, state.crewWaterReceived ? 1 : 0), state.plantResponse, Math.max(state.purifierResponse, state.powerResponse), state.reservoirResponse][i];
    s += `<path data-module-response="${response}" d="M${x - 16} ${y + 3}h37v6h-37Z" fill="${response > 0 ? P.water : P.sea}" stroke="${P.ink}" stroke-width="${.7 + response}"/><path d="M${x - 35} ${y + 1}h11v13h-11Z" fill="${P.rock}" stroke="${P.ink}" stroke-width=".7"/>` + line(`M${x - 4} ${y + 3}v6m12-6v6`, P.ink, .7);
    if (i === 1) for (const dx of [-9, 3, 15]) s += line(`M${x + dx} ${y + 9}v-5m-2 1 2 1 2-1`, P.green, 1.3);
    if (i === 2) s += `<path d="M${x + 51} ${y - 10}h7v24h-7Zm10 3h7v21h-7Z" fill="${P.cool}" stroke="${P.ink}" stroke-width=".7"/>`;
    if (i === 3) for (const dx of [-23, 5]) s += `<path d="M${x + dx} ${y + 13}h20v10h-20Z" fill="${P.land}" stroke="${P.ink}" stroke-width=".7"/>` + line(`M${x + dx + 7} ${y + 13}v10`, P.ink, .6);
    s += text(x, i === 1 ? 87 : y + 46, ['乘员舱', '植物舱', '生保舱', '资源舱'][i], 24);
  });
  s += `<g data-receiver="water-storage"><rect x="302" y="311" width="36" height="21" fill="${P.paper}" stroke="${P.ink}"/><rect x="304" y="${330 - state.reservoirResponse * 17}" width="32" height="${2 + state.reservoirResponse * 17}" fill="${P.water}"/></g>`;
  s += `<g data-receiver="filter-valve" transform="translate(490 239) rotate(${state.purifierStroke * 117})">${line('M-11 0H11M0-11V11', P.water, 3.4)}</g>`;
  s += `<path d="M142 238v12h16v-12" fill="${P.paper}" stroke="${P.ink}"/><rect data-receiver="crew-water" x="144" y="${249 - state.crewWaterResponse * 9}" width="12" height="${state.crewWaterResponse * 9}" fill="${P.water}"/>`;
  s += `<path d="M181 212v23h9v-23M345 139v-23h9v23" fill="none" stroke="${P.ink}"/>`;
  s += `<rect data-receiver="crew-oxygen" x="182" y="${230 - state.crewOxygenResponse * 15}" width="7" height="3" fill="${P.green}"/><rect data-receiver="plant-gas" x="346" y="${135 - state.plantResponse * 15}" width="7" height="3" fill="${P.cool}"/>`;
  s += line(`M${128 - state.crewFoodResponse * 9} 252h22`, P.land, 4) + `<rect data-receiver="power-switch" x="506" y="230" width="8" height="3" fill="${P.gold}" transform="rotate(${state.powerResponse * 90} 510 231.5)"/>`;
  return `<g data-sky-causality-state='${JSON.stringify(state)}'>${s}${cargo}</g>`;
}

function composition(t: number, selected: number) {
  let s = '';
  for (let i = 0; i < 100; i++) s += `<rect x="${52 + i % 10 * 23}" y="${74 + Math.floor(i / 10) * 23}" width="18" height="18" fill="${i < 78 ? P.sea : i < 99 ? P.warm : P.gold}" stroke="${P.ink}" stroke-width=".7"/>`;
  s += text(466, 96, '氮 78%', 27) + text(466, 152, '氧 21%', 27) + text(466, 208, '其他 1%', 27);
  return s + airCompositionExtraSvg(t, selected, P);
}

function greenhouse(t: number, selected: number) {
  const state = evaluateGreenhouseResponse(t, selected);
  let s = `<path d="M70 305H574V337H70Z" fill="${P.land}" stroke="${P.ink}" stroke-width="1.2"/>`;
  if (selected > 0) s += line('M84 180Q320 89 560 180M84 180V197M560 180V197', P.cool, 1.7);
  if (selected === 2) s += cloud(389, 157, 1.23);
  if (t >= .02) s += tracked([[104, 69], [216, 299]], state.shortwave, P.gold, 'shortwave');
  if (t >= .33) s += tracked([[316, 299], selected ? [350, 166] : [377, 60]], state.emitted, P.warm, 'ground-longwave');
  if (state.atmosphere && t >= .60) s += tracked([[350, 166], [451, 299]], state.returned, P.warm, 'downward-longwave') + tracked([[350, 166], [460, 59]], state.spaceEmission, P.warm, 'upward-longwave');
  s += `<rect x="84" y="314" width="475" height="12" fill="#d0cab9"/><rect data-ground-heat-fill="${state.groundHeat}" x="84" y="314" width="${475 * state.groundHeat}" height="12" fill="${P.warm}"/><path data-ground-heat-position="${state.groundHeat}" d="M${84 + 475 * state.groundHeat} 310v20" stroke="${P.ink}" stroke-width="2"/>`;
  s += [0, .25, .5, .75, 1].map(mark => line(`M${84 + 475 * mark} 329v3`, P.ink, 1)).join('');
  return `<g data-sky-causality-state='${JSON.stringify(state)}'>${s + text(141, 42, '太阳短波', 24) + (t >= .33 ? text(313, 371, '地面长波', 24) : '') + (state.atmosphere && t >= .6 ? text(501, 260, '大气逆辐射', 24) : '')}</g>`;
}

function wind(t: number, selected: number) {
  const velocities: Point[] = [[1, 0], [0, 1], [.55, Math.sqrt(1 - .55 ** 2)], [.55, -Math.sqrt(1 - .55 ** 2)]], [u, w] = velocities[selected];
  const o: Point = [310, 222], windStart: Point = selected ? o : [310, 183];
  let s = '';
  for (let i = 0; i < 6; i++) s += line(`M${85 + i * 90} 94V353`, '#c1c6ba', 1.3);
  s += paperText(320, 62, '高压 → 低压') + vector(windStart, [windStart[0] + u * 132, windStart[1] + w * 132], P.water, 6) + vector(o, [o[0] + 108, o[1]], P.warm);
  s += paperText(509, 253, '气压梯度力');
  if (selected) {
    const [cx, cy] = selected === 1 ? [-1, 0] : [-w * w, u * w];
    s += vector(o, [o[0] + cx * 108, o[1] + cy * 108], P.cool) + paperText(selected === 1 ? 143 : 155, selected === 3 ? 151 : selected === 1 ? 235 : 280, '偏向力');
  }
  if (selected > 1) s += vector(o, [o[0] - u * u * 108, o[1] - u * w * 108], P.rock) + paperText(248, selected === 3 ? 315 : 145, '摩擦力');
  s += paperText(selected === 1 ? 389 : selected > 1 ? 460 : 485, selected === 1 ? 352 : selected === 2 ? 351 : selected === 3 ? 101 : 171, '风向');
  s += flow([[windStart[0] - u * 38, windStart[1] - w * 38], [windStart[0] + u * 122, windStart[1] + w * 122]], t, 2, P.water);
  return s;
}


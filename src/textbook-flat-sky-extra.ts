import { marsBenchDrawing } from './textbook-mars-sequencer-drawing';
import { habitableDrawing } from './textbook-habitable-drawing';
import { recorderWheel } from './textbook-recorder-drawings';
import { geologicalPlate } from './textbook-geological-plate';
import type { Figure } from './textbook-catalog';
import { hazeSvg } from './textbook-haze-model';
import { airSamplerDrawing } from './textbook-air-sampler-drawing';
import { evaluateSolarDisturbance, evaluateSphereExchange, evaluateMarsTransfer,
  evaluateGreenhouseResponse, evaluateWindForces, skyClamp, skyProgress } from './textbook-sky-causality-model';

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
function wrap(f: Figure, body: string, height = 390) {
  return `<svg class="flat-model-svg flat-explanation-svg" viewBox="0 0 640 ${height}" role="${height===390?'img':'group'}" aria-label="${esc(f.title)}，可改变条件的二维示意"><rect width="640" height="390" fill="${P.paper}"/>${body}</svg>`;
}

export function flatSkyExtra(f: Figure, phase: number, selection: number, inspection = 'overview'): string | null {
  const t = Number.isFinite(phase) ? phase : 0;
  let body: string;
  switch (f.effect) {
    case 'cosmic-scale': return wrap(f,cosmic(t,choice(selection,3)),475);
    case 'habitable': body = habitableDrawing(choice(selection, 2)); break;
    case 'solar-activity': body = solar(t, choice(selection, 1)); break;
    case 'geo-time': body = geologicalPlate(choice(selection, 3)); break;
    case 'external-spheres': body = spheres(t, choice(selection, 2)); break;
    case 'mars-base': {const mode=choice(selection,3);return wrap(f,marsBenchDrawing(mars(t,mode,inspection),t,mode,inspection),542);}
    case 'air-composition': body = airSamplerDrawing(t,choice(selection,1),inspection); break;
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
    const pts = Array.from({ length: 20 }, (_, j): Point => { const a = i * Math.PI * 2 / 3 + j / 19 * 4, r = 3 + j / 19 * 43; return [c[2][0] + Math.cos(a) * r, c[2][1] + Math.sin(a) * r * (.52+.14*Math.sin(t*2*Math.PI))]; });
    s += line(pts.map(([x, y], j) => `${j ? 'L' : 'M'}${x} ${y}`).join(' '), P.rock, 3);
  }
  s += circle(c[2][0], c[2][1], 6, P.gold);
  for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 11 + i % 3 * 14; s += `<ellipse cx="${c[3][0] + Math.cos(a) * r * (.91+.09*Math.cos(t*2*Math.PI)) + Math.sin(i*1.7)*4*Math.sin(t*2*Math.PI)}" cy="${c[3][1] + Math.sin(a) * r * .55}" rx="7" ry="3" fill="${i % 2 ? P.cool : P.rock}"/>`; }
  for (let i = 0; i < 3; i++) s += i === selected ? flow([[c[i][0] + 56, c[i][1]], [c[i + 1][0] - 60, c[i + 1][1]]], t, 1, P.warm) : line(`M${c[i][0] + 57} ${c[i][1]}L${c[i + 1][0] - 61} ${c[i + 1][1]}`, P.rock);
  s += ['地月系', '太阳系', '银河系', '可观测宇宙'].map((v, i) => text(c[i][0], c[i][1] + 63, v, 24)).join('');
  // The four specimen mounts act as physical selectors, including their labels.
  s += c.map(([x,y],i)=>`<g data-model-selection="${i}" data-specimen-key="" tabindex="0" role="button" aria-label="观察${['地月系','太阳系','银河系','可观测宇宙'][i]}" aria-pressed="${i===selected}"><rect x="${x-63}" y="${y-36}" width="126" height="112" rx="10" fill="transparent"/></g>`).join('');
  s += '<path d="M40 351h560v26H40Z" fill="#664838" stroke="#93794d" stroke-width="3"/><rect x="489" y="366" width="58" height="46" fill="#536052" rx="5"/>';
  s += recorderWheel(519,411,40,t,'转动天体标本手轮');
  s += text(332,426,'转动手轮',30);
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

function spheres(t: number, selected: number) {
  const state = evaluateSphereExchange(t, selected);
  let s = `<path d="M42 344H596V354L584 363H54L42 354Z" fill="#6d5038" stroke="#795e40"/><path d="M47 345H591" stroke="#ba9b64" stroke-width="3"/>
    <path d="M50 307 92 279 128 238 163 245 184 216 222 240 269 264 306 271 351 292 420 304V344H50Z" fill="#ab9b7e" stroke="${P.ink}"/>
    <path d="M50 306 92 279 128 238 151 253 168 251 183 219 200 246 226 252 244 264 269 264 305 272 335 280 351 292 420 304 365 310 318 296 276 293 240 281 207 266 188 246 171 268 129 282 83 306Z" fill="#899572"/>
    <path d="M50 321Q114 315 159 299T244 301T339 314T420 322M50 331Q131 328 166 313T247 315T333 327T420 332" stroke="#857664" fill="none"/>
    <path d="M420 304Q462 300 513 303T590 303V345H420Z" fill="#75a09c" stroke="${P.ink}"/>
    <path d="m439 310 18-.6m28 6 17 .6m30-6 22-.2m-13 13 20-1" stroke="#adcbc1" fill="none"/>
    <path d="M351 306V120H356" stroke="#857249" fill="none" stroke-width="2"/>`;
  s+=cloud(356,117,1.05)+tree(251,279,65,true)+tree(295,287,40,true)+tree(151,269,24,true);
  s+=line('M181 241Q195 249 220 266T255 282Q286 297 312 296T422 310',P.water,3.6);
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

/** Front elevations share the same mounting points as the transfer paths. */
function cabinSection(index:number) {
  const glaze='#acc8c3', iron='#566963', bronze='#ae915b', ivory='#e2d6bb';
  if(index===0) {
    // Pressure cabin, airlock, sleeping berths and a pair of observation ports.
    return `<path d="M-59 13v-26q0-13 15-13h71q19 0 22 14v26Z" fill="${ivory}" stroke="${P.ink}" stroke-width="2"/>
      <path d="M-50 -16h21v29h-21Z" fill="${iron}" stroke="${P.ink}"/><rect x="-46" y="-12" width="13" height="10" rx="3" fill="${glaze}"/>
      <path d="M-23 -12h32v5h-32zm0 15H9v5h-32z" fill="#967e60"/><path d="M-22 -13v26M8 -13v26" stroke="${iron}" stroke-width="2"/>
      <path d="M17 -24V13M40 -22V13" stroke="${bronze}" stroke-width="3"/>
      <circle cx="28" cy="-9" r="7.3" fill="${bronze}" stroke="${P.ink}"/><circle cx="28" cy="-9" r="4.9" fill="${glaze}"/>`;
  }
  if(index===1) {
    let plants='';
    for(const [j,x] of [-34,-18,0,17,33].entries()) {
      const h=11+(j%3)*3;
      plants+=`<path d="M${x} 6v-${h}" stroke="#617852" stroke-width="1.7"/><path d="M${x} 0q-10 -1 -10 -10q10 2 10 10Zm0 -4q0 -10 10 -12q0 9 -10 12Z" fill="#839b6c" stroke="#586c51" stroke-width=".8"/>`;
    }
    return `<path d="M-55 12v-20q4 -40 55 -41q51 1 55 41v20Z" fill="#dce4d5" stroke="${iron}" stroke-width="2"/>
      <path d="M-54 -6h108M-44 -28h88M-33 8q0-50 33-57q33 7 33 57M0 -48v50" fill="none" stroke="#8fa69b" stroke-width="1.6"/>
      ${plants}<path d="M-46 5h92l-4 8h-84Z" fill="${iron}"/>`;
  }
  if(index===2) {
    const filters=[-30,-16,16,30].map(x=>`<rect x="${x-5}" y="-20" width="10" height="29" rx="4" fill="${glaze}" stroke="${iron}"/><path d="M${x-5} -15h10m-10 17h10" stroke="${bronze}" stroke-width="2"/>`).join('');
    return `<path d="M-50 13v-37l8-6h83l9 6v37Z" fill="${ivory}" stroke="${iron}" stroke-width="2"/>
      <path d="M-42 -22h84v32h-84Z" fill="#707d73"/>${filters}
      <path d="M-33 -22v-3h66v3M-31 9v4h63V9" fill="none" stroke="${bronze}" stroke-width="3"/>`;
  }
  return `<path d="M-49 12v-29q0-12 12-12h48v41Z" fill="${ivory}" stroke="${iron}" stroke-width="2"/>
    <path d="M15 12v-40q9-9 18 0v40Zm21 0v-32q8-8 16 0v32Z" fill="${glaze}" stroke="${iron}" stroke-width="1.5"/>
    <path d="M14 -19h20m-20 22h20m1-17h18m-18 19h18" stroke="${bronze}" stroke-width="3"/>
    <path d="M-43 -21h18v12h-18Zm0 14h18V5h-18Z" fill="#b8a789" stroke="${iron}"/>`;
}

function mars(t: number, selected: number, inspection: string) {
  const state = evaluateMarsTransfer(t, selected);
  const c: Point[] = [[150, 236], [320, 141], [490, 236], [320, 321]];
  const terrain='M45 296Q80 260 141 210L250 148Q277 136 319 140L442 163Q517 182 563 237L598 288Q502 347 348 354Q175 361 45 308Z';
  let s=`<defs><clipPath id="mars-relief"><path d="${terrain}"/></clipPath><linearGradient id="mars-regolith" x2=".2" y2="1"><stop stop-color="#e7d9bf"/><stop offset="1" stop-color="#d8b89a"/></linearGradient></defs>
    <path d="${terrain}" transform="translate(0 5)" fill="#a78c74" stroke="#877861"/>
    <path d="${terrain}" fill="url(#mars-regolith)" stroke="#aa967a"/><g clip-path="url(#mars-relief)" fill="none" stroke="#a89173" opacity=".30">`;
  for(let j=0;j<8;j++){
    const y=172+j*26;
    s+=`<path d="M32 ${y+33}Q105 ${y-14} 169 ${y+1}T324 ${y+5}Q403 ${y+19} 455 ${y-8}T609 ${y-11}" stroke-width=".9"/>`;
  }
  s+='</g>';
  for(const [x,y] of c) s+=`<ellipse cx="${x+5}" cy="${y+20}" rx="60" ry="7" fill="#8c7861" opacity=".18"/>`;
  s+=line('M496 125v26l-12 7m12-7 12 7','#766e58',2.3);
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
    const target='mars-shell-'+i, open=inspection===target;
    const lid=open?'<path d="M-58 -29Q-1 -48 56 -30L52 -35Q0 -56 -58 -35Z" fill="#a7b1a4" stroke="#746e55"/>':'';
    s += `<g data-model-inspection="${target}" data-model-inspection-toggle="overview" data-specimen-key tabindex="0" role="button" aria-label="${open?'合上舱盖':'掀开舱盖'}" transform="translate(${x} ${y})"><rect x="-61" y="-46" width="122" height="76" rx="9" fill="transparent"/>${cabinSection(i)}${lid}<path d="M-57 14H57v4H-57Z" fill="#ac905a" stroke="${P.ink}"/><path d="M-43 19v5h8v-5m70 0v5h8v-5" fill="#616c60"/></g>`;
    const response = [Math.max(state.crewOxygenResponse, state.crewFoodResponse, state.crewWaterReceived ? 1 : 0), state.plantResponse, Math.max(state.purifierResponse, state.powerResponse), state.reservoirResponse][i];
    s += `<circle data-module-response="${response}" cx="${x+42}" cy="${y+10}" r="3.2" stroke="#675c44" fill="${response>0?'#81b0ad':'#cabea6'}"/>`;
    s += paperText(x, i === 1 ? 73 : y + 48, ['乘员舱', '植物舱', '生保舱', '资源舱'][i], 24);
  });
  s += `<g data-receiver="water-storage"><rect x="302" y="311" width="36" height="21" fill="${P.paper}" stroke="${P.ink}"/><rect x="304" y="${330 - state.reservoirResponse * 17}" width="32" height="${2 + state.reservoirResponse * 17}" fill="${P.water}"/></g>`;
  s += `<g data-receiver="filter-valve" transform="translate(490 239) rotate(${state.purifierStroke * 117})">${line('M-11 0H11M0-11V11', P.water, 3.4)}</g>`;
  s += `<path d="M142 238v12h16v-12" fill="${P.paper}" stroke="${P.ink}"/><rect data-receiver="crew-water" x="144" y="${249 - state.crewWaterResponse * 9}" width="12" height="${state.crewWaterResponse * 9}" fill="${P.water}"/>`;
  s += `<path d="M181 212v23h9v-23M345 139v-23h9v23" fill="none" stroke="${P.ink}"/>`;
  s += `<rect data-receiver="crew-oxygen" x="182" y="${230 - state.crewOxygenResponse * 15}" width="7" height="3" fill="${P.green}"/><rect data-receiver="plant-gas" x="346" y="${135 - state.plantResponse * 15}" width="7" height="3" fill="${P.cool}"/>`;
  s += line(`M${128 - state.crewFoodResponse * 9} 252h22`, P.land, 4) + `<rect data-receiver="power-switch" x="506" y="230" width="8" height="3" fill="${P.gold}" transform="rotate(${state.powerResponse * 90} 510 231.5)"/>`;
  return `<g data-sky-causality-state='${JSON.stringify(state)}'>${s}${cargo}</g>`;
}

function greenhouse(t: number, selected: number) {
  const state = evaluateGreenhouseResponse(t, selected);
  let s = `<path d="M70 305H574V337H70Z" fill="${P.land}" stroke="${P.ink}" stroke-width="1.2"/>`;
  s+='<path d="M70 301V71H94" stroke="#546459" stroke-width="4" fill="none"/><g transform="translate(104 69) rotate(62)"><path d="M-33 -8H-15L0 -14V14L-15 8H-33Z" fill="#7d6b4a" stroke="#544c3c"/><ellipse rx="4" ry="13" fill="#d1be93"/></g>';
  s+='<path d="M287 304V165M416 304V165" fill="none" stroke="#877450" stroke-width="3"/>';
  const cy=selected?166:145;
  s+=`<g data-radiation-cassette="${selected}"><ellipse cx="350" cy="${cy}" rx="67" ry="11" fill="${selected?'#b8ccbe':'none'}" stroke="#9d8151" stroke-width="4"/><path d="M410 ${cy+4}l17 4q7 3 0 5l-19-2" fill="none" stroke="#967a48" stroke-width="2"/></g>`;
  if(selected===2)s+=cloud(367,151,.64);
  const ray=(a:Point,b:Point,q:number,color:string,id:string)=>{
    if(q<=0)return '';
    const tip:Point=[a[0]+(b[0]-a[0])*q,a[1]+(b[1]-a[1])*q];
    return `<g data-transfer-id="${id}">${vector(a,tip,color,3)}</g>`;
  };
  for(const [x,response,color] of [[216,state.solarArrival,P.gold],[451,state.returnReceived,P.warm]] as const){
    s+=`<ellipse cx="${x}" cy="304" rx="20" ry="5" fill="#ad8851"/><ellipse cx="${x}" cy="303" rx="16" ry="3.4" fill="#665f50"/><ellipse cx="${x}" cy="303" rx="16" ry="3.4" fill="${color}" opacity="${response}"/>`;
  }
  s+=ray([104,69],[216,299],state.shortwave,P.gold,'shortwave')+ray([316,299],selected?[350,166]:[377,60],state.emitted,P.warm,'ground-longwave');
  if(state.atmosphere)s+=ray([350,166],[451,299],state.returned,P.warm,'downward-longwave')+ray([350,166],[460,59],state.spaceEmission,P.warm,'upward-longwave');
  s+=`<rect x="71" y="310" width="502" height="31" rx="3" fill="#364b43"/><rect x="77" y="313" width="490" height="25" rx="2" fill="#e6ddc6" stroke="#a3814c" stroke-width="2"/><rect x="84" y="319" width="475" height="6" fill="#817961"/><rect data-ground-heat-fill="${state.groundHeat}" x="84" y="319" width="${475*state.groundHeat}" height="6" fill="#ab5335"/>`;
  for(let i=0;i<=20;i++)s+=line(`M${84+475*i/20} 334v-${i%5===0?6:3}`,P.ink,1.2);
  s+=`<path data-ground-heat-position="${state.groundHeat}" transform="translate(${84+475*state.groundHeat} 0)" d="M-6 315H6V318L0 331L-6 318Z" fill="#39463f"/>`;
  return `<g data-sky-causality-state='${JSON.stringify(state)}'>${s + text(141, 42, '太阳短波', 24) + (t >= .33 ? text(313, 371, '地面长波', 24) : '') + (state.atmosphere && t >= .6 ? text(501, 260, '大气逆辐射', 24) : '')}</g>`;
}

function wind(_t: number, selected: number) {
  const state=evaluateWindForces(selected), [u,w]=state.wind, o:Point=[310,222];
  let s='<rect x="55" y="80" width="530" height="286" rx="7" fill="#d9d3be" stroke="#384e45" stroke-width="5"/>';
  for (let i = 0; i < 6; i++) s += line(`M${85 + i * 90} 94V353`, '#87978b', 1.3);
  s+='<circle cx="310" cy="222" r="110" fill="none" stroke="#a98a52" stroke-width="1.7"/>';
  for(let i=0;i<24;i++)s+=`<path transform="rotate(${i*15} 310 222)" d="M420 222h${i%3===0?8:4}" stroke="#897247" stroke-width="1.3"/>`;
  s += paperText(320, 62, '高压 → 低压') + vector(o, [o[0] + 108, o[1]], '#aa5640');
  s += paperText(509, 253, '气压梯度力');
  if (selected) {
    const [cx, cy] = state.coriolis;
    s += vector(o, [o[0] + cx * 108, o[1] + cy * 108], '#667fa3') + paperText(selected === 1 ? 143 : 155, selected === 3 ? 151 : selected === 1 ? 235 : 280, '偏向力');
  }
  if (selected > 1) s += vector(o, [o[0] + state.friction[0]*108, o[1] + state.friction[1]*108], '#726750') + paperText(248, selected === 3 ? 315 : 145, '摩擦力');
  s+=`<path transform="translate(310 222) rotate(${Math.atan2(w,u)*180/Math.PI})" fill="#416f73" fill-rule="evenodd" d="M-8 0L8-10H103V-16L142 0L103 16V10H8ZM8 0L18-6H101L122 0L101 6H18Z"/><circle cx="310" cy="222" r="5" fill="#ae9055"/>`;
  s += paperText(selected === 1 ? 389 : selected > 1 ? 460 : 485, selected === 1 ? 352 : selected === 2 ? 351 : selected === 3 ? 101 : 171, '风向');
  return s;
}
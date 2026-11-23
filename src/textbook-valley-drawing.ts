import { riverValleySurfaceHeight, valleySection } from './textbook-natural-form-geometry';

const railStart = 72, railTravel = 496;
const fixed = (n: number) => Number(n.toFixed(2));

export function valleyDrawing(phase: number, selection: number) {
  const plain = selection === 1;
  const { v, probes } = valleySection(phase, plain);
  const sx = (u: number) => fixed(36 + 568 * (u - .035) / .93);
  const sy = (h: number) => fixed(253 - 4.92 * h);
  const cross = Array.from({ length: 177 }, (_, i) => {
    const u = .035 + .93 * i / 176;
    return [sx(u), sy(riverValleySurfaceHeight(u, v, plain))];
  });
  const surface = 'M' + cross.map(p => p.join(',')).join('L');
  const waterY = sy(probes[1].height);
  const wet = cross.filter(p => p[1] >= waterY);
  const soil = surface + 'V276H36Z';
  const contours = Array.from({length: 5}, (_, i) => {
    const y = 208 + i * 13;
    return `<path d="M32 ${y}q88 -16 171 -4t160 -2t135 3t111 -4" fill="none" stroke="${i % 2 ? '#82694f' : '#ccab7b'}" stroke-width="${i % 2 ? 2.4 : 4}"/>`;
  }).join('');
  const plummets = probes.map(({ u, height }) => {
    const x = sx(u), y = sy(height);
    return `<g transform="translate(${x} 0)"><circle cy="36" r="11" fill="url(#valley-brass)" stroke="#67583f" stroke-width="2"/>
      <circle cy="36" r="3" fill="#4b4031"/><path d="M0 46V${y-17}" stroke="#635d48" stroke-width="1.8"/>
      <path d="M-2 ${y-18}h4l3 7L0 ${y}l-5 -11Z" fill="url(#valley-brass)" stroke="#6a5535" stroke-width="1.4"/></g>`;
  }).join('');
  const keys = ['山地','平原'].map((name,i) => {
    const pressed = selection === i;
    return `<g transform="translate(${i?430:210} 341)" tabindex="0" role="button" data-model-selection="${i}" data-specimen-key="" aria-label="装入${name}河谷标本" aria-pressed="${pressed}">
      <rect x="-91" y="-42" width="182" height="83" rx="5" fill="transparent"/><rect x="-85" y="-29" width="170" height="61" rx="7" fill="#574b37"/>
      <rect x="-85" y="${pressed?-25:-31}" width="170" height="54" rx="7" fill="${pressed?'#d3ceb3':'#f5ead1'}" stroke="#917749" stroke-width="4"/>
      <text y="${pressed?13:7}">${name}</text></g>`;
  }).join('');
  const head = fixed(railStart + phase * railTravel);
  const title = plain ? '平原河谷，冲积平原宽阔，河谷宽而浅' : '山地 V 形河谷，岸坡陡、谷底狭窄';
  return `<svg class="flat-model-svg flat-explanation-svg valley-drawing" viewBox="0 0 640 520" role="group" aria-label="${title}" data-valley-section="${v}" xmlns="http://www.w3.org/2000/svg">
    <title>${title}</title>
    <defs><linearGradient id="valley-brass" x2="100%" y2="100%" gradientUnits="objectBoundingBox"><stop stop-color="#5b4931"/><stop offset=".29" stop-color="#b59860"/><stop offset=".53" stop-color="#ebd6a1"/><stop offset=".75" stop-color="#a18551"/><stop offset="1" stop-color="#6e5739"/></linearGradient>
    <linearGradient id="valley-earth" x2="0" y2="100%"><stop stop-color="#a1a080"/><stop offset=".38" stop-color="#ac9d79"/><stop offset="1" stop-color="#a58a68"/></linearGradient>
    <clipPath id="valley-section-cut"><path d="${soil}"/></clipPath></defs>
    <g stroke-linecap="round" stroke-linejoin="round"><path d="M40 37H599M596 38V284" stroke="#63573e" stroke-width="7"/>
    <path d="M42 34H594" stroke="#c8af78" stroke-width="3"/>
    <path d="${soil}" fill="url(#valley-earth)" stroke="#574c39" stroke-width="2"/>
    <g clip-path="url(#valley-section-cut)">${contours}</g><path d="${surface}" fill="none" stroke="#636e50" stroke-width="3"/>
    ${wet.length ? `<path d="M${wet.map(p=>p.join(',')).join('L')}L${wet.at(-1)![0]},${waterY}H${wet[0][0]}Z" fill="#578a96"/><path d="M${wet[0][0]} ${waterY}H${wet.at(-1)![0]}" stroke="#527f8c" stroke-width="3"/>` : ''}
    ${plummets}
    <path d="M33 270H607V313H33Z" fill="#29463f" stroke="#4c4c3b"/><path d="M28 313H612" stroke="#bda06b" stroke-width="5"/>
    <text class="valley-observation" x="320" y="302">${plain?'平原宽谷 · 侧蚀与堆积':'山地窄谷 · 下切明显'}</text>
    ${keys}
    <g tabindex="0" role="slider" aria-label="沿河推拉测架" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(phase*100)}" data-phase-track="valley-section" data-track-start="${railStart}" data-track-end="${railStart+railTravel}">
      <rect x="25" y="386" width="590" height="92" fill="transparent"/><path d="M${railStart} 419h${railTravel}m-${railTravel} 10h${railTravel}" stroke="#788687" stroke-width="4"/>
      <path d="M${railStart} 410v28m${railTravel} -28v28" stroke="#655239" stroke-width="7"/>
      <g transform="translate(${head} 424)"><rect x="-15" y="-19" width="30" height="38" rx="4" fill="url(#valley-brass)" stroke="#66563c" stroke-width="2"/>
      <circle r="10" fill="#38747b" stroke="#254f54" stroke-width="2"/></g></g></g>
    <g pointer-events="none"><text x="72" y="497">上游</text><text x="320" y="497">推拉测架</text><text x="568" y="497">下游</text></g>
  </svg>`;
}

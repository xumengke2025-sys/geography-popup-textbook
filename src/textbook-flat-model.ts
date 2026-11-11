import type { Figure } from './textbook-catalog';
import { pageUrl } from './textbook-catalog';
import { effectSvg } from './textbook-effects';
import { evaluateSeaBreeze } from './model';
import { flatFoundation } from './textbook-flat-foundation';
import { flatSkyExtra } from './textbook-flat-sky-extra';
import { flatWaterRiskExtra } from './textbook-flat-water-risk-extra';
import { flatLandExtra } from './textbook-flat-land-extra';
import { riverCutoffSvg } from './textbook-river-model';
import { gisSvg } from './textbook-gis-model';
import { quakeSvg } from './textbook-quake-model';
import { karstSvg } from './textbook-karst-model';
import { soilProfileSvg } from './textbook-soil-profile-model';
import { waveSvg } from './textbook-wave-model';
import { tideSvg } from './textbook-tide-model';
import { strataSvg } from './textbook-strata-model';
import { landslideSvg } from './textbook-landslide-model';
import { remoteSensingSvg } from './textbook-remote-model';
import { airProcessSvg } from './textbook-air-process-model';
import { atmosphereSvg } from './textbook-atmosphere-model';
import { forestSvg } from './textbook-forest-model';
import { waterCycleSvg } from './textbook-water-cycle-model';
import { oceanCurrentSvg } from './textbook-current-model';
import { solarHeatingSvg } from './textbook-solar-heating-model';
import { typhoonSvg } from './textbook-typhoon-model';
import { solarSystemSvg, earthLayersSvg } from './textbook-astronomy-model';
import { temperatureProfileSvg } from './textbook-temperature-model';
import { slopeReliefSvg } from './textbook-slope-model';
import { recoverySvg } from './textbook-recovery-model';
import { gnssSvg } from './textbook-gnss-model';
import { urbanWaterSvg } from './textbook-urban-water-model';
import { coldWaveSvg } from './textbook-cold-wave-model';
import { integratedSvg } from './textbook-integrated-model';

/** A separate reading-mode demonstration. The textbook page is never painted
 * over. This SVG is the WebGL fallback, not the source of the 3D geometry. */
export function flatModelSvg(f: Figure, phase: number, selection: number, inspection = 'overview') {
  if (f.extension) return integratedSvg(f.effect, phase, selection, inspection);
  if (f.effect === 'gnss') return gnssSvg(phase, selection, inspection);
  if (f.effect === 'urban-waterlogging') return urbanWaterSvg(phase, selection, inspection);
  if (f.effect === 'cold-wave') return coldWaveSvg(phase);
  if (f.effect === 'breeze') return breezeSvg(phase);
  if (f.effect === 'pressure') return pressureSvg(phase, selection);
  if (f.effect === 'river') return riverCutoffSvg(phase);
  if (f.effect === 'gis') return gisSvg(phase, selection, inspection);
  if (f.effect === 'quake') return quakeSvg(phase, selection);
  if (f.effect === 'karst') return karstSvg(phase, selection);
  if (f.effect === 'soil') return soilProfileSvg(phase, selection, inspection);
  if (f.effect === 'wave') return waveSvg(phase, selection, inspection);
  if (f.effect === 'tide') return tideSvg(phase, selection);
  if (f.effect === 'strata') return strataSvg(phase, selection);
  if (f.effect === 'landslide') return landslideSvg(phase, selection);
  if (f.effect === 'remote') return remoteSensingSvg(phase);
  if (f.effect === 'heat' || f.effect === 'circulation') return airProcessSvg(f.effect, phase);
  if (f.effect === 'atmosphere') return atmosphereSvg(phase);
  if (f.effect === 'forest') return forestSvg(phase);
  if (f.effect === 'water') return waterCycleSvg(phase, selection);
  if (f.effect === 'current') return oceanCurrentSvg(phase);
  if (f.effect === 'radiation') return solarHeatingSvg(phase);
  if (f.effect === 'typhoon') return typhoonSvg(phase);
  if (f.effect === 'orbit') return solarSystemSvg(phase, selection);
  if (f.effect === 'spheres') return earthLayersSvg(selection, inspection);
  if (f.effect === 'temperature') return temperatureProfileSvg(phase, inspection);
  if (f.effect === 'slope') return slopeReliefSvg(phase);
  if (f.effect === 'rescue') return recoverySvg(phase, selection);
  const vector = flatFoundation(f, phase, selection)
    ?? flatSkyExtra(f, phase, selection)
    ?? flatLandExtra(f, phase, selection, inspection)
    ?? flatWaterRiskExtra(f, phase, selection);
  if (vector) return vector;
  const [x, y, w, h] = f.rect;
  return `<svg class="flat-model-svg" viewBox="0 0 1000 ${1000 * h / w * 858.89801 / 612.28302}" role="img" aria-label="${f.title}二维演示"><svg viewBox="0 0 1000 1000" width="1000" height="100%" preserveAspectRatio="none"><image href="${pageUrl(f.pdf)}" x="${-x / w * 1000}" y="${-y / h * 1000}" width="${1000 / w}" height="${1000 / h}"/>${effectSvg(f, phase, selection)}</svg></svg>`;
}

const text = (x: number, y: number, value: string, size = 21) =>
  `<text x="${x}" y="${y}" text-anchor="middle" fill="#263d43" font-size="${size}" font-family="FieldSerif,SimSun,serif">${value}</text>`;

function breezeSvg(phase: number) {
  const s = evaluateSeaBreeze({ phase, contrast: 1 });
  const [landLow, seaLow, landHigh, seaHigh] = s.direction > 0 ? ['低压', '高压', '高压', '低压']
    : s.direction < 0 ? ['高压', '低压', '低压', '高压'] : ['相近', '相近', '相近', '相近'];
  const particles = s.direction === 0 ? '' : Array.from({length: 9}, (_, i) => {
    const a = (i / 9 + phase * 7) * Math.PI * 2 * s.direction;
    const x = 320 + 190 * Math.cos(a), y = 176 + 97 * Math.sin(a);
    const angle = Math.atan2(97 * Math.cos(a) * s.direction, -190 * Math.sin(a) * s.direction) * 180 / Math.PI;
    return `<path d="M-13-5 0 0-13 5" transform="translate(${x} ${y}) rotate(${angle})"/>`;
  }).join('');
  const daylight = Math.cos((phase - .5) * Math.PI * 2) > 0;
  const warm = s.direction > 0 ? '#ca9b76' : '#8faebb', cool = s.direction < 0 ? '#ca9b76' : '#8faebb';
  return `<svg class="flat-model-svg flat-explanation-svg" viewBox="0 0 640 390" role="img" aria-label="${s.stage}，近地面${s.ground}，高空${s.upper}">
  <path d="M48 300H320V354H48Z" fill="#d8c8aa"/><path d="M320 300H594V354H320Z" fill="#abc9cb"/>
  <path d="M48 300 108 262 151 280 193 278 230 294 320 300" fill="#e7deca" stroke="#546260" stroke-width="1.2"/>
  <path d="M199 300v-21h29v21m-35-21 20-13 21 13m-22 21v-12h7v12" fill="#f9f4e7" stroke="#506361" stroke-width="1.3"/>
  <path d="M362 315h42m20 0h35m22 0h49m-142 19h38m24 0h44m22 0h30" stroke="#668d96" fill="none"/>
  <path d="M320 300V354M48 354H594" stroke="#586b68" fill="none"/>
  <g stroke="${warm}" stroke-width="4"><path d="M253 316v-${8 + s.strength * 22}"/></g><g stroke="${cool}" stroke-width="4"><path d="M388 316v-${8 + s.strength * 22}"/></g>
  ${text(174, 339, `陆地 · ${s.direction > 0 ? '较暖' : s.direction < 0 ? '较冷' : '同温'}`)}${text(468, 339, `海洋 · ${s.direction < 0 ? '较暖' : s.direction > 0 ? '较冷' : '同温'}`)}
  <ellipse cx="320" cy="176" rx="190" ry="97" stroke="#567e80" stroke-width="1.2" stroke-opacity="${s.strength * .5}" fill="none"/>
  <g fill="none" stroke="#356f78" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" opacity="${s.strength}">${particles}</g>
  ${text(203, 130, landHigh)}${text(434, 130, seaHigh)}${text(203, 246, landLow)}${text(434, 246, seaLow)}
  <g stroke="#99aca7" stroke-width="1" stroke-dasharray="4 7"><path d="M260 123H378M260 239H378"/></g>
  ${daylight ? '<g fill="#cfad6a" stroke="#b59761"><circle cx="566" cy="45" r="15"/><path d="M566 20v-8m0 66v-8m25-25h8m-66 0h8m7-18-6-6m42 42 6 6m0-48-6 6m-36 36-6 6"/></g>' : '<path d="M580 28a21 21 0 1 0 0 35 24 24 0 0 1 0-35" fill="#a1b8c2"/>'}
  </svg>`;
}

function pressureSvg(phase: number, selection: number) {
  const difference = selection === 0;
  const arrows = difference ? Array.from({length: 3}, (_, j) => Array.from({length: 4}, (_, i) => {
    const x = 100 + ((phase * 2 + i / 4) % 1) * 440, y = 135 + j * 60;
    return `<path d="M${x - 14} ${y}h28m-8-6 8 6-8 6"/>`;
  }).join('')).join('') : '';
  return `<svg class="flat-model-svg flat-explanation-svg" viewBox="0 0 640 360" role="img" aria-label="${difference ? '同一高度，气流从高压侧流向低压侧' : '同一高度，气压相同，这一理想化风分量为零'}">
  <path d="M60 106H580V288H60Z" fill="#e8e2d2"/>
  <g stroke="#b4b5a6" stroke-width="1">${[115, 215, 320, 425, 525].map(x => `<path d="M${x} 113V283"/>`).join('')}</g>
  ${difference ? text(118, 77, '相对高压') + text(521, 77, '相对低压') : text(320, 77, '气压相同')}
  <g stroke="#3e7580" stroke-width="2" fill="none">${arrows}</g>
  ${text(320, 330, '同一水平面')}
  </svg>`;
}

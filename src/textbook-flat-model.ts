import { pressureDrawing } from './textbook-pneumatic-drawings';
import { completeFlatApparatus } from './textbook-flat-apparatus';
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
  const drawing=drawFigure(f,phase,selection,inspection);
  return completeFlatApparatus(drawing,f,phase,selection,inspection);
}
function drawFigure(f: Figure, phase: number, selection: number, inspection: string) {
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
  if (f.effect === 'orbit') return solarSystemSvg(phase, selection, inspection);
  if (f.effect === 'spheres') return earthLayersSvg(selection, inspection);
  if (f.effect === 'temperature') return temperatureProfileSvg(phase, inspection);
  if (f.effect === 'slope') return slopeReliefSvg(phase);
  if (f.effect === 'rescue') return recoverySvg(phase, selection);
  const vector = flatFoundation(f, phase, selection, inspection)
    ?? flatSkyExtra(f, phase, selection, inspection)
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
  const dark = daylight ? '#b39963' : '#f5cf76';
  const plate=(x:number,y:number,label:string,w=67) => `<g transform="translate(${x} ${y})"><rect x="${-w/2}" y="-15" width="${w}" height="30" rx="3" fill="#a18b5f" stroke="#776343"/><rect x="${-w/2+2}" y="-13" width="${w-4}" height="26" rx="2" fill="#e8dfc8"/>${text(0,7,label,21)}</g>`;
  const key=(x:number,label:string,i:number)=>`<g data-model-selection="${i}" data-specimen-key tabindex="0" role="button" aria-label="观察${label}" transform="translate(${x} 385)">${plate(0,0,label,64)}</g>`;
  const dialAngle=(.25-phase)*Math.PI*2;
  const ticks=Array.from({length:36},(_,i)=>`<path d="M30 0h${i%3===0?-5:-2}" transform="rotate(${10*i})"/>`).join('');
  return `<svg class="flat-model-svg coastal-weather-drawing" viewBox="0 0 640 422" role="group" aria-label="${s.stage}，近地面${s.ground}，高空${s.upper}">
    <style>@media(max-width:480px){.coastal-weather-drawing text{font-size:28px}}</style>
    <defs><linearGradient id="breeze-water" x2="0" y2="1"><stop stop-color="#aac1ad"/><stop offset=".37" stop-color="#749a98"/><stop offset="1" stop-color="#527780"/></linearGradient>
    <linearGradient id="breeze-wood" x2="0" y2="1"><stop stop-color="#89714e"/><stop offset=".23" stop-color="#5d4938"/><stop offset=".74" stop-color="#876c4c"/><stop offset="1" stop-color="#564439"/></linearGradient>
    <pattern id="breeze-stone" width="61" height="13" patternUnits="userSpaceOnUse"><path d="M-6 10 Q13 5 29 8t38-5m-53 10 3-4m39-6 2-2" fill="none" stroke="#b3a187" stroke-width="1.5"/></pattern></defs>
    <g fill="none" stroke="#8c7853" stroke-width="2.4"><path d="M91 303V62m466 242V62M91 103h126m340 0H427M91 212h126m340 0H427"/></g>
    <ellipse cx="320" cy="176" rx="190" ry="97" stroke="#71948e" stroke-width="1.5" stroke-opacity="${s.strength*.75}" fill="none"/>
    <g fill="none" stroke="#356f78" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" opacity="${s.strength}">${particles}</g>
    ${plate(211,103,landHigh)}${plate(429,103,seaHigh)}${plate(211,212,landLow)}${plate(429,212,seaLow)}
    <path d="M41 353V307L68 293 92 257 108 246 125 255 142 281 164 272 187 288 214 285 232 298 260 292 286 299 306 298 324 307 335 320 352 325V354Z" fill="#9c9077" stroke="#786d58"/>
    <path d="M41 307L68 293 92 257 108 246 125 255 142 281 164 272 187 288 214 285 232 298 260 292 286 299 306 298 324 307 335 320 316 314 297 307 263 304 241 307 223 302 202 300 184 302 163 290 143 292 126 275 114 265 104 271 88 286 68 300Z" fill="#818768"/>
    <path d="M41 316l37-17 26-20 23 9 17 13 30-2 29 12 30-2 23 4 28-3 31 8 35 7v30H41Z" fill="url(#breeze-stone)"/>
    <path d="M327 311q15-2 28 0t27 0 35 0 34 0 34 0 31 0 69 0v43H350l-16-15Z" fill="url(#breeze-water)"/>
    <path d="M353 321q15 4 29 0t34-1m28 12q10 3 21 0t22-1m22-13q14 4 31-1m-147 22q13 2 26-1" fill="none" stroke="#c3c9b6" opacity=".8"/>
    <g transform="translate(271 297)"><path d="M-12 0l5-42H7L12 0Z" fill="#dfd8c1" stroke="#675e4b"/><path d="M-9-16l1-9H8l1 9Z" fill="#aa705a"/><path d="M-12-42h24v-3h-24z" fill="#626454"/><path d="M-7-45v-12H7v12Z" fill="${dark}" stroke="#54625a"/><path d="M-10-57l10-8 10 8ZM-3 0v-9h6v9" fill="#5e6357"/><path d="M-3-45v-12m6 0v12" stroke="#5f6257"/></g>
    <path d="M48 354h540l-6 12H55Z" fill="#b19866"/><path d="M55 366h527v37H55Z" fill="url(#breeze-wood)"/><path d="M61 399h515" stroke="#c5a56c"/>
    ${plate(157,384,'陆地·'+(s.direction>0?'较暖':s.direction<0?'较冷':'同温'),126)}${plate(466,384,'海洋·'+(s.direction<0?'较暖':s.direction>0?'较冷':'同温'),126)}
    ${key(275,'白天',0)}${key(351,'夜晚',1)}
    <g transform="translate(574 70)" data-model-crank="1" data-radius="34" role="slider" tabindex="0" aria-label="转动昼夜盘" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(phase*100)}">
      <circle r="41" fill="#8a754e" stroke="#594c38" stroke-width="2"/><circle r="36" fill="#e3dbc2" stroke="#b49a68" stroke-width="3"/><path d="M-25 0a25 25 0 0 1 50 0" fill="#dfcb91"/><path d="M-25 0a25 25 0 0 0 50 0" fill="#99ada6"/><g stroke="#635b48" stroke-width="1.3">${ticks}</g>
      <line x2="${Math.cos(dialAngle)*32}" y2="${Math.sin(dialAngle)*32}" stroke="#455958" stroke-width="2.5"/><circle cx="${Math.cos(dialAngle)*32}" cy="${Math.sin(dialAngle)*32}" r="6" fill="#c6a971" stroke="#725b3b"/><circle r="3" fill="#695f4a"/></g>
    </svg>`;

}

function pressureSvg(phase:number,selection:number) {
  return pressureDrawing(phase,selection);
}

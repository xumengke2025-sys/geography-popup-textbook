import { soilPoreDrawing } from './textbook-soil-pore-drawing';
import { karstObserverDrawing } from './textbook-karst-observer-drawing';
import { seismicSectionSvg, waterRenewalSectionSvg } from './textbook-flat-specimens';
import type { Figure } from './textbook-catalog';
import { soilTextureSvg } from './textbook-soil-texture-model';
import { soilCareDrawing } from './textbook-soil-care-drawing';
import { insolationSvg } from './textbook-insolation-model';

const ink = '#32494c', water = '#92b8c1', warm = '#bc845c', land = '#d7c6a5';
const label = (x: number, y: number, value: string) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="25" fill="${ink}" font-family="FieldSerif,SimSun,serif">${value}</text>`;
const arrow = (x: number, y: number, x1: number, y1: number, color = '#527b83') => {
  const a = Math.atan2(y1 - y, x1 - x), dx = Math.cos(a), dy = Math.sin(a);
  return `<path d="M${x} ${y}L${x1} ${y1}m${-dx * 12 - dy * 6} ${-dy * 12 + dx * 6}L${x1} ${y1}l${-dx * 12 + dy * 6} ${-dy * 12 - dx * 6}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
};
const box = (x: number, y: number, w: number, h: number, color: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" stroke="${ink}" stroke-width="1.4"/>`;
const frame = (f: Figure, title: string, body: string) => `<svg class="flat-model-svg flat-explanation-svg" viewBox="0 0 640 390" role="img" aria-label="${f.title}：${title}">${body}</svg>`;

/** Native vector fallbacks of the corresponding teaching constructions. */
export function flatFoundation(f: Figure, phase: number, selection: number, inspection = 'overview'): string | null {
  const t = Math.max(0, Math.min(1, phase));
  switch (f.effect) {
    case 'solar-distribution': return insolationSvg(t);
    case 'seismic-waves': return seismicSectionSvg(t,selection,inspection);
    case 'water-renewal': return waterRenewalSectionSvg(t,selection);
    case 'karst-cave': return karstObserverDrawing(true,t,selection);
    case 'soil-composition': return soilPoreDrawing(selection);
    case 'soil-texture': {
      return soilTextureSvg(phase, selection);
    }
    case 'soil-care': return soilCareDrawing(phase, selection);
    case 'cold-wave': {
      const advance = selection === 0 ? .1 : .1 + t * .65, x = 80 + advance * 530;
      return frame(f, selection === 1 ? '冷空气推进，可能伴随大风与降温' : '冷空气到来前', `<path d="M42 293L135 274 240 288 334 279 431 294 594 290V330H42Z" fill="${land}" stroke="${ink}"/><path d="M61 113H${x}V287H61Z" fill="#a2c2cc" opacity=".65"/><path d="M${x} 113V289" stroke="#587c8c" stroke-width="3"/><path d="M454 289v-42h62v42m-69-42 37-25 39 25" fill="#f2ebda" stroke="${ink}" stroke-width="2"/>${selection === 1 ? arrow(130, 210, 532, 210) : ''}${label(145, 87, '冷空气')}${label(510, 87, '暖空气')}${label(320, 365, selection === 1 ? '冷空气推进' : '推进前')}`);
    }
    default: return null;
  }
}
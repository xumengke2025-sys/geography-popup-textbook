import { evaluateWaterRenewal } from './textbook-water-renewal-model';
import type { Figure } from './textbook-catalog';
import { soilTextureSvg } from './textbook-soil-texture-model';
import { evaluateSoilCare } from './textbook-soil-care-model';
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
export function flatFoundation(f: Figure, phase: number, selection: number): string | null {
  const t = Math.max(0, Math.min(1, phase));
  switch (f.effect) {
    case 'solar-distribution': return insolationSvg(t);
    case 'seismic-waves': {
      const liquid = selection === 0, end = liquid ? 318 : 571;
      const dots = Array.from({ length: 21 }, (_, i) => {
        const x = 88 + i * 23;
        return `<circle cx="${x + Math.sin(i * .9 - t * Math.PI * 6) * 5}" cy="155" r="4" fill="${warm}"/>${!liquid || i < 11 ? `<circle cx="${x}" cy="${235 + Math.sin(i * .9 - t * Math.PI * 4) * 13}" r="4" fill="#5f91a0"/>` : ''}`;
      }).join('');
      return frame(f, liquid ? '横波不能穿过液体，纵波可以' : '纵波与横波都可以穿过固体', `${box(65, 117, 255, 157, land)}${box(320, 117, 255, 157, liquid ? '#c0d6da' : land)}${dots}${arrow(84, 185, 565, 185, warm)}${arrow(84, 268, end, 268)}${label(192, 88, '固体')}${label(446, 88, liquid ? '液体' : '固体')}${label(75, 330, 'P波')}${label(400, 330, 'S波')}`);
    }
    case 'water-renewal': {
      const state = evaluateWaterRenewal(t, selection), level = state.level, y = 310 - level * 195;
      return frame(f, selection === 1 ? '取用超过补给，可用水减少' : selection === 2 ? '水量存在，污染影响可用水' : '补给与取用相当', `${box(203, 91, 235, 222, '#f5f1e6')}${box(205, y, 231, 310 - y, selection === 2 ? '#b7a686' : water)}${arrow(75, 110, 196, 145)}${arrow(439, 288, 566, 288)}${label(111, 78, '补给')}${label(538, 337, '取用')}${label(320, 361, selection === 2 ? '污染水体' : '可用淡水')}`);
    }
    case 'karst-cave': {
      const growth = selection === 1 ? 5 + t * 48 : 5;
      const structures = [.31, .5, .69].map((u, i) => {
        const x = u * 640, length = growth * (i === 1 ? 1 : .8);
        const ceiling = (at:number) => { const q=(at-83)/474; return 177-228*q*(1-q); };
        return `<path d="M${x - 15} ${ceiling(x-15)}L${x} ${ceiling(x) + length}L${x + 15} ${ceiling(x+15)}Z" fill="#eee3cf" stroke="${ink}"/><path d="M${x - 17} 279L${x} ${279 - length}L${x + 17} 279Z" fill="${land}" stroke="${ink}"/>`;
      }).join('');
      return frame(f, selection === 1 ? '洞顶石钟乳与洞底石笋' : '岩体中的溶洞', `${box(51, 93, 538, 223, '#cabda6')}<path d="M83 278V177Q320 63 557 177V278Z" fill="#f8f5eb" stroke="${ink}" stroke-width="2"/>${structures}${label(320, 63, '溶洞')}${selection === 1 ? label(320, 182, '石钟乳') + label(320, 348, '石笋') : ''}`);
    }
    case 'soil-composition': {
      const level = [291, 236, 164][selection] ?? 236;
      const grains = Array.from({ length: 12 }, (_, i) => `<ellipse cx="${157 + i % 4 * 106}" cy="${174 + Math.floor(i / 4) * 62}" rx="36" ry="22" fill="${i % 4 ? land : '#b8a88b'}" stroke="${ink}" stroke-width="1.4"/>`).join('');
      return frame(f, '矿物质、有机质、水分和空气；孔隙水增加时空气空间减少', `${box(87, 128, 468, 197, '#f8f5eb')}${box(89, level, 464, 323 - level, water)}${grains}<path d="M165 148q65-65 133-4t140-10" fill="none" stroke="#6e846a" stroke-width="6"/>${label(120, 91, '矿物质')}${label(470, 91, '有机质')}${label(190, 365, '水分')}${selection === 2 ? '' : label(454, 365, '空气')}`);
    }
    case 'soil-texture': {
      return soilTextureSvg(phase, selection);
    }
    case 'soil-care': {
      const state = evaluateSoilCare(phase, selection);
      const salts = state.packets.map(packet => `<circle data-salt-id="${packet.id}" cx="${packet.u * 640}" cy="${316 - packet.height * 8}" r="4" fill="#bb985c" stroke="#85704c"/>`).join('');
      const flows = [200, 320, 440].map(x => selection === 1 ? arrow(x, 160, x, 284) : arrow(x, 282, x, selection === 2 ? 248 : 160, warm)).join('');
      const cover = selection === 2 ? '<path d="M100 140h440" stroke="#7e9576" stroke-width="12" stroke-dasharray="17 4"/>' : '';
      return frame(f, state.caption, `${box(93, 160, 454, 155, land)}${box(93, 286, 454, 29, water)}${flows}${cover}${salts}${label(320, 87, ['蒸发返盐', '淋洗排盐', '覆盖抑蒸发'][selection])}${selection === 1 ? arrow(461, 302, 589, 302) : ''}${label(320, 360, '土壤水盐')}`);
    }
    case 'cold-wave': {
      const advance = selection === 0 ? .1 : .1 + t * .65, x = 80 + advance * 530;
      return frame(f, selection === 1 ? '冷空气推进，可能伴随大风与降温' : '冷空气到来前', `<path d="M42 293L135 274 240 288 334 279 431 294 594 290V330H42Z" fill="${land}" stroke="${ink}"/><path d="M61 113H${x}V287H61Z" fill="#a2c2cc" opacity=".65"/><path d="M${x} 113V289" stroke="#587c8c" stroke-width="3"/><path d="M454 289v-42h62v42m-69-42 37-25 39 25" fill="#f2ebda" stroke="${ink}" stroke-width="2"/>${selection === 1 ? arrow(130, 210, 532, 210) : ''}${label(145, 87, '冷空气')}${label(510, 87, '暖空气')}${label(320, 365, selection === 1 ? '冷空气推进' : '推进前')}`);
    }
    default: return null;
  }
}

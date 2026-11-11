import type { Figure } from './textbook-catalog';
import { INTEGRATED_CATALOG_SUGGESTIONS, INTEGRATED_REFERENCES } from './textbook-integrated-model';

/** Supplemental experiments never replace an original textbook page. */
export const integratedFigures: Figure[] = INTEGRATED_CATALOG_SUGGESTIONS.map(source => ({
  ...source,
  rect: [...source.rect],
  marker: [...source.marker],
  controls: [...source.controls],
  extension: true,
  selectionLimit: source.effect === 'quake-response-system' ? 15 : source.controls.length - 1,
  sourcePages: [...INTEGRATED_REFERENCES[source.effect].printedPages],
  note: `${source.note} ${source.effect==='city-rain-system'?'地下观察窗省略了前侧一片土体，以便看清水路；不表示真实土壤是空腔。 ':''}本实验为依据相关教材内容编写的综合拓展，全部空间、数量和进度均为教学示意，不是实测或预报。`,
}));

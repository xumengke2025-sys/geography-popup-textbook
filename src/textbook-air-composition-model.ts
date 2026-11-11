/** Textbook pp.28–29: water vapour is an invisible gas. Clouds form after a
 * phase change; no cloud or liquid-drop shape is used for vapour here.
 * The few open/solid marks below are symbols, not molecules, amounts or sizes. */
export const AIR_COMPOSITION_REFERENCE = Object.freeze({
  textbookPages: [28, 29], pdfPages: [33, 34],
  waterVaporVisible: false, vaporSymbol: 'open-diamond-tracer',
  impuritySymbol: 'solid-grain', cloudRepresented: false,
  markerCountsAreQuantities: false, markerSizesAreActual: false,
  dryAirProportionsExcludeWaterAndDust: true,
});
export const AIR_COMPOSITION_LABELS = Object.freeze({ vapor: '水汽不可见', impurity: '杂质' });
/** One actual opening is shared by the paper frame and its native SVG path. */
export const AIR_VAPOR_FRAME = Object.freeze({
  outer: [[0, 1.4], [-1.1, 0], [0, -1.4], [1.1, 0]] as readonly (readonly [number, number])[],
  innerRatio: .59,
});
const vaporSites = [[-.9, .45], [0, .8], [.9, .4], [-.45, -.7], [.55, -.5]] as const;
const impuritySites = Array.from({ length: 9 }, (_, i) => [i % 3 - 1, Math.floor(i / 3) - 1] as const);
const periodic = (phase: number) => Number.isFinite(phase) ? ((phase % 1) + 1) % 1 : 0;

export function evaluateAirComposition(phase: number, selection = 0) {
  const t = periodic(phase), selected = Number.isFinite(selection) && Math.round(selection) > 0 ? 1 : 0;
  // Slight closed drift only separates schematic marks spatially. It does
  // not simulate condensation, settling, weather or a change in abundance.
  const marks = (sites: readonly (readonly [number, number])[], kind: 'vapor' | 'impurity') =>
    selected ? sites.map(([x, y], index) => ({ id: `${kind}-${index}`, kind,
      x: x + Math.sin(t * Math.PI * 2 + index * 1.7) * .035,
      y: y + Math.cos(t * Math.PI * 2 + index * 1.3) * .035 })) : [];
  return { phase: t, selected, vapor: marks(vaporSites, 'vapor'), impurities: marks(impuritySites, 'impurity'),
    reference: AIR_COMPOSITION_REFERENCE };
}

/** Native vector counterpart of the two symbol groups. The dry-air grid and
 * its legend remain in their existing renderer. Nothing is a bitmap. */
export function airCompositionExtraSvg(phase: number, selection: number,
  palette = { cool: '#6a99aa', rock: '#c0b09a', ink: '#303a40' }) {
  const state = evaluateAirComposition(phase, selection);
  if (!state.selected) return '';
  const n = (value: number) => Number(value.toFixed(3));
  const framePath = (x: number, y: number, ratio: number) => AIR_VAPOR_FRAME.outer.map(([u, v], index) =>
    `${index ? 'L' : 'M'}${n(x + u * 3.5 * ratio)} ${n(y - v * 3.5 * ratio)}`).join('') + 'Z';
  let body = '';
  for (const mark of state.vapor) {
    const x = 409 + mark.x * 37, y = 278 - mark.y * 27;
    body += `<path data-composition-symbol="water-vapor-tracer" data-symbol-id="${mark.id}" d="${framePath(x, y, 1)}${framePath(x, y, AIR_VAPOR_FRAME.innerRatio)}" fill="${palette.cool}" fill-rule="evenodd" stroke="${palette.ink}" stroke-width=".55"/>`;
  }
  for (const mark of state.impurities) {
    const x = 535 + mark.x * 18, y = 278 - mark.y * 16;
    body += `<rect data-composition-symbol="impurity-grain" data-symbol-id="${mark.id}" x="${n(x - 2.2)}" y="${n(y - 2.2)}" width="4.4" height="4.4" fill="${palette.rock}" stroke="${palette.ink}" stroke-width=".7"/>`;
  }
  const label = (value: string, x: number) => `<text x="${x}" y="344" text-anchor="middle" fill="${palette.ink}" font-family="FieldSerif,SimSun,serif" font-size="22">${value}</text>`;
  return `<g data-composition-extras="symbols" role="img" aria-label="空心符号仅为不可见水汽的示踪；实心小粒表示杂质。数量和大小均为示意，不是云滴。">${body}${label(AIR_COMPOSITION_LABELS.vapor, 409)}${label(AIR_COMPOSITION_LABELS.impurity, 535)}</g>`;
}

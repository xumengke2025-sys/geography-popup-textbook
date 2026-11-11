/** Textbook p.15, figure 1.23. Fossils are redrawn by visible morphology;
 * these names do not assign a species or a numerical geological age. */
export type StrataPoint = readonly [number, number];
export type StrataFossilKind = 'round-imprint' | 'cone-imprint' | 'fan-shell' | 'curled-shell' | 'leaf-shell' | 'small-shell';
export interface StrataFossil {
  id: string;
  kind: StrataFossilKind;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface StrataDefinition {
  id: string;
  column: 'A' | 'B';
  level: number;
  name: string;
  color: string;
  /** Front face, anticlockwise from its lower-left corner. */
  profile: readonly StrataPoint[];
  correlation: 'paired-shells' | 'cone' | null;
  fossils: readonly StrataFossil[];
}
const fossil = (id: string, kind: StrataFossilKind, x: number, y: number, width: number, height: number): StrataFossil =>
  Object.freeze({ id, kind, x, y, width, height });
const definition = (d: StrataDefinition): StrataDefinition => Object.freeze({ ...d,
  profile: Object.freeze(d.profile.map(p => Object.freeze([...p]) as StrataPoint)), fossils: Object.freeze(d.fossils) });

export const STRATA_REFERENCE = Object.freeze({ printedPage: 15, pdfPage: 20, figure: '1.23',
  fossilScope: '原图可辨形态与组合重绘，不鉴定具体物种；层间距是教学展开，不表示地质年代长短。' });
/** Selection 2..7 follows this exact order, while the toolbar retains two modes. */
export const STRATA_LAYERS: readonly StrataDefinition[] = Object.freeze([
  definition({ id: 'A-lower', column: 'A', level: 0, name: 'A下层', color: '#c8af80',
    profile: [[8, 0], [42, 0], [38, 12], [8, 12]], correlation: 'paired-shells',
    fossils: [fossil('A-fan', 'fan-shell', 18, 6, 6.5, 6.1), fossil('A-curled', 'curled-shell', 31, 6, 5.5, 7.1)] }),
  definition({ id: 'A-middle', column: 'A', level: 1, name: 'A中层', color: '#b9bcb1',
    profile: [[8, 12], [38, 12], [32, 24], [8, 24]], correlation: 'cone',
    fossils: [fossil('A-cone', 'cone-imprint', 23, 18, 6.2, 8.3)] }),
  definition({ id: 'A-upper', column: 'A', level: 2, name: 'A上层', color: '#d8b292',
    profile: [[8, 24], [32, 24], [29, 36], [8, 36]], correlation: null,
    fossils: [fossil('A-round', 'round-imprint', 18, 30, 6.6, 7.2)] }),
  definition({ id: 'B-lower', column: 'B', level: 0, name: 'B下层', color: '#b1a5a1',
    profile: [[56, 0], [94, 0], [94, 12], [61, 12]], correlation: null,
    fossils: [fossil('B-leaf', 'leaf-shell', 70, 6, 6.1, 8), fossil('B-small', 'small-shell', 84, 6, 5.8, 5.5)] }),
  definition({ id: 'B-middle', column: 'B', level: 1, name: 'B中层', color: '#c8af80',
    profile: [[61, 12], [94, 12], [94, 24], [67, 24]], correlation: 'paired-shells',
    fossils: [fossil('B-curled', 'curled-shell', 72.5, 18, 5.5, 7.1), fossil('B-fan', 'fan-shell', 85, 18, 6.5, 6.1)] }),
  definition({ id: 'B-upper', column: 'B', level: 2, name: 'B上层', color: '#b9bcb1',
    profile: [[67, 24], [94, 24], [94, 36], [73, 36]], correlation: 'cone',
    fossils: [fossil('B-cone', 'cone-imprint', 83, 30, 6.2, 8.3)] }),
]);
export const STRATA_CORRELATIONS = Object.freeze([
  Object.freeze({ key: 'paired-shells', a: 0, b: 4 }), Object.freeze({ key: 'cone', a: 1, b: 5 }),
]);
export const STRATA_FOSSIL_NAMES: Readonly<Record<StrataFossilKind, string>> = Object.freeze({
  'round-imprint': '圆形印痕', 'cone-imprint': '长锥形印痕', 'fan-shell': '扇形壳印痕',
  'curled-shell': '卷曲壳印痕', 'leaf-shell': '叶片形壳印痕', 'small-shell': '小壳印痕',
});

const curve = (count: number, f: (t: number) => StrataPoint) => Array.from({ length: count }, (_, i) => f(i / (count - 1)));
const freezeInk = (outline: StrataPoint[], ribs: StrataPoint[][]) => Object.freeze({
  outline: Object.freeze(outline.map(p => Object.freeze(p))), ribs: Object.freeze(ribs.map(r => Object.freeze(r.map(p => Object.freeze(p))))),
});
const ellipse = (rx: number, ry: number, cx = 0, cy = 0) => curve(49, t => [cx + Math.cos(t * Math.PI * 2) * rx, cy + Math.sin(t * Math.PI * 2) * ry]);
/** Fixed vector silhouettes and relief grooves, shared by 3D and native SVG. */
export const STRATA_FOSSIL_INK = Object.freeze({
  'round-imprint': freezeInk(curve(49, t => {
    const a = t * Math.PI * 2, r = 1 + .045 * Math.cos(a * 11); return [Math.cos(a) * r, Math.sin(a) * r];
  }), [ellipse(.72, .75), ellipse(.43, .47), ...Array.from({ length: 16 }, (_, i) => {
    const a = i * Math.PI * 2 / 16; return [[Math.cos(a) * .53, Math.sin(a) * .55], [Math.cos(a) * .98, Math.sin(a) * .98]] as StrataPoint[];
  })]),
  'cone-imprint': freezeInk([[-.75, -1], [-.40, .35], [.25, 1], [.75, .96], [.98, .69], [.63, .22], [-.75, -1]], [
    [[-.75, -1], [.66, .73]], [[-.36, .26], [.35, .79], [.86, .67]], [[-.17, .08], [.45, .49]],
  ]),
  'fan-shell': freezeInk([[0, -.95], ...curve(37, t => {
    const a = t * Math.PI, r = 1 + .045 * Math.cos(a * 12); return [Math.cos(a) * r, Math.sin(a) * 1.45 - .22];
  }), [0, -.95]], Array.from({ length: 9 }, (_, i) => {
    const a = .12 + i / 8 * (Math.PI - .24); return [[0, -.88], [Math.cos(a) * .91, Math.sin(a) * 1.36 - .22]] as StrataPoint[];
  })),
  'curled-shell': freezeInk([[-.76, .10], [-.95, .46], [-.85, .83], [-.48, 1], [-.05, .96], [.24, .67], [.20, .30],
    [.36, -.05], [.77, -.44], [.89, -.84], [.48, -1], [.13, -.82], [-.20, -.39], [-.27, -.05], [-.76, .10]], [
    curve(49, t => { const a = t * Math.PI * 3.6, r = .49 * (1 - .89 * t); return [-.40 + Math.cos(a) * r, .52 + Math.sin(a) * r * .88]; }),
    [[-.20, -.13], [.07, -.09], [.43, -.38], [.70, -.76]], [[-.08, -.39], [.22, -.35], [.64, -.79]],
  ]),
  'leaf-shell': freezeInk(curve(49, t => {
    const a = t * Math.PI * 2, x = Math.cos(a) * (.78 + .20 * Math.sin(a)), y = Math.sin(a); return [x * .86 - y * .33, x * .24 + y * .94];
  }), [curve(21, t => [-.32 + .55 * t, -.91 + 1.72 * t]), ...Array.from({ length: 6 }, (_, i) => {
    const y = -.60 + i * .25; return [[-.40 - y * .2, y - .14], [.45 - y * .2, y + .1]] as StrataPoint[];
  })]),
  'small-shell': freezeInk(curve(41, t => {
    const a = t * Math.PI * 2, r = 1 + .08 * Math.sin(a * 5); return [Math.cos(a) * r, Math.sin(a) * .86 - .08];
  }), [ellipse(.70, .57, 0, -.03), ellipse(.41, .31, -.02, -.02), [[-.72, .13], [-.18, .66], [.20, .69], [.73, .15]]]),
});

export function normalizeStrataSelection(input: number): number {
  return Number.isFinite(input) ? Math.max(0, Math.min(7, Math.round(input))) : 0;
}
const clamp = (v: number) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
export function strataMatch(index: number): number | null {
  const d = STRATA_LAYERS[index];
  if (!d?.correlation) return null;
  const match = STRATA_LAYERS.findIndex((other, i) => i !== index && other.column !== d.column && other.correlation === d.correlation);
  return match < 0 ? null : match;
}
export function strataInputLabel(index: number): string {
  const d = STRATA_LAYERS[index], match = strataMatch(index);
  return `${d.name}；${match === null ? '原图另一柱未显示相同化石组合' : `相同化石组合见${STRATA_LAYERS[match].name}`}；再次选择取消焦点`;
}

export function evaluateStrata(input: number, selected = 0) {
  const phase = clamp(input), selection = normalizeStrataSelection(selected), separated = selection >= 1;
  const focused = selection >= 2 ? selection - 2 : null;
  const match = focused === null ? null : strataMatch(focused);
  const emphasized = focused === null ? [] : match === null ? [focused] : [focused, match];
  const gap = separated ? 9 * phase * phase * (3 - 2 * phase) : 0;
  const layers = STRATA_LAYERS.map((d, index) => {
    const offsetY = d.level * gap, offsetZ = emphasized.includes(index) ? 2.5 : 0;
    return { index, id: d.id, column: d.column, level: d.level, selection: index + 2,
      highlighted: emphasized.includes(index), focused: focused === index, counterpart: strataMatch(index), offsetY, offsetZ,
      profile: d.profile.map(([x, y]) => [x, y + offsetY] as StrataPoint),
      fossils: d.fossils.map(f => ({ ...f, y: f.y + offsetY, z: offsetZ, owner: index })) };
  });
  const connections = STRATA_CORRELATIONS.map(c => {
    const a = layers[c.a], b = layers[c.b], ap = a.profile, bp = b.profile;
    return { ...c, highlighted: focused !== null && emphasized.includes(c.a), visible: focused === null || emphasized.includes(c.a),
      from: [((ap[1][0] + ap[2][0]) / 2 + .6), (ap[1][1] + ap[2][1]) / 2, a.offsetZ] as const,
      to: [((bp[0][0] + bp[3][0]) / 2 - .6), (bp[0][1] + bp[3][1]) / 2, b.offsetZ] as const };
  });
  return { phase, selection, separated, gap, focused, match, emphasized, layers, connections,
    unmatchedMeans: '另一柱原图未展示可对应化石组合，不推断该时代在当地不存在', reference: STRATA_REFERENCE };
}

const number = (n: number) => Number(n.toFixed(4));
const svgPath = (points: readonly StrataPoint[], close = false) => `${points.map(([x, y], i) => `${i ? 'L' : 'M'}${number(x)} ${number(y)}`).join('')}${close ? 'Z' : ''}`;
export function strataSvg(phase: number, selection = 0): string {
  const state = evaluateStrata(phase, selection), scale = 5.1;
  const project = ([x, y]: readonly number[], z = 0): StrataPoint => [38 + x * scale + z * 1.0, 360 - y * scale + z * .35];
  let body = '';
  for (const connection of state.connections.filter(c => c.visible)) {
    const a = project(connection.from, connection.from[2]), b = project(connection.to, connection.to[2]);
    body += `<path data-strata-correlation="${connection.key}" d="M${a.join(' ')}L${b.join(' ')}" fill="none" stroke="#705b44" stroke-width="${connection.highlighted ? 2.5 : 1.5}" stroke-dasharray="5 5"/>`;
  }
  for (const layer of state.layers) {
    const d = STRATA_LAYERS[layer.index], front = layer.profile.map(p => project(p, layer.offsetZ));
    const side = [front[1], front[2], [front[2][0] + 16, front[2][1] - 12], [front[1][0] + 16, front[1][1] - 12]] as StrataPoint[];
    const top = [front[2], front[3], [front[3][0] + 16, front[3][1] - 12], side[2]] as StrataPoint[];
    body += `<g data-strata-layer="${layer.id}" data-strata-offset-y="${number(layer.offsetY)}" data-model-selection="${layer.selection}" data-model-toggle="1" role="button" tabindex="0" aria-pressed="${layer.focused}" aria-label="${strataInputLabel(layer.index)}"><path d="${svgPath(side, true)}" fill="${d.color}" stroke="#786f5d" stroke-width="1"/><path d="${svgPath(top, true)}" fill="#e1d4b9" stroke="#786f5d" stroke-width="1"/><path d="${svgPath(front, true)}" fill="${d.color}" stroke="#514d43" stroke-width="${layer.highlighted ? 2.6 : 1.2}"/>`;
    for (const fossil of layer.fossils) {
      const ink = STRATA_FOSSIL_INK[fossil.kind], transform = ([x, y]: StrataPoint) => project([fossil.x + x * fossil.width / 2, fossil.y + y * fossil.height / 2], fossil.z + .5);
      body += `<g data-strata-fossil="${fossil.id}" data-fossil-kind="${fossil.kind}" data-owner="${layer.id}" data-x="${fossil.x}" data-y="${number(fossil.y)}"><path d="${svgPath(ink.outline.map(transform), true)}" fill="#9f795b" stroke="#6a543e" stroke-width="${layer.highlighted ? 1.7 : 1.15}"/>${ink.ribs.map(rib => `<path d="${svgPath(rib.map(transform))}" fill="none" stroke="#644f3d" stroke-width=".85"/>`).join('')}</g>`;
    }
    body += '</g>';
  }
  for (const column of ['A', 'B'] as const) {
    const top = state.layers.find(l => l.column === column && l.level === 2)!;
    const at = project([column === 'A' ? 18 : 83, 41 + top.offsetY]);
    body += `<text x="${at[0]}" y="${at[1]}" fill="#6d4b35" font-size="25" text-anchor="middle" font-family="FieldSerif,SimSun,serif">${column}</text>`;
  }
  if (state.separated) {
    const x = 596, y = 351 - state.phase * 240;
    body += `<path d="M596 111V351" stroke="#b7aa90" stroke-width="2"/><path data-strata-handle="true" d="M${x - 11} ${y - 13}h22v26h-22Z" fill="#f5eedf" stroke="#6e6a58" stroke-width="1.3"/><path d="M${x - 4} ${y - 3}l4-4 4 4m-8 6 4 4 4-4" fill="none" stroke="#6e6a58" stroke-width="1.4"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" class="flat-model-svg flat-explanation-svg" viewBox="0 0 640 400" role="group" data-strata-phase="${number(state.phase)}" data-strata-selection="${state.selection}" aria-label="图1.23地层与化石对比；点击层体或化石查看另一柱的对应层，分层模式可用进度条调节间距。层间距不是年代长短。"><title>A、B两地地层对比</title><desc>扇形与卷曲壳印痕组合对应A下层与B中层；长锥形印痕对应A中层与B上层。另两层不强行配对，不据此推断该时代不存在。</desc><g stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
}

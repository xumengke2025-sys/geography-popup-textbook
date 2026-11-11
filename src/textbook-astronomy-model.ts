/** Shared schematic coordinates for the raised objects and their SVG fallback.
 * Neither a displayed orbit radius nor a layer radius is a measured scale. */
export const SOLAR_REFERENCE = {
  figure: '1.4', printedPage: 3, pdfPage: 8, source: 'textbook/page-008.webp',
  orbitalDistancesToScale: false, bodySizesToScale: false, periodsToScale: false,
  phaseMeaning: 'schematic-orbital-progress', cycleBoundaryContinuous: true,
} as const;
export const ORBIT_RADII = [8, 12, 17, 22, 29, 35, 41, 47] as const;
export const ORBIT_TURNS = [8, 7, 6, 5, 4, 3, 2, 1] as const;
export const PLANET_NAMES = ['水星', '金星', '地球', '火星', '木星', '土星', '天王星', '海王星'] as const;
export const PLANET_RADII = [1, 1.3, 1.45, 1.1, 2.8, 2.3, 1.8, 1.8] as const;
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
export function evaluateSolarSystem(input: number) {
  const phase = clamp(input);
  return { phase, source: SOLAR_REFERENCE, bodies: PLANET_NAMES.map((name, i) => {
    const angle = phase * Math.PI * 2 * ORBIT_TURNS[i] + i * 1.58;
    return { name, radius: ORBIT_RADII[i], bodyRadius: PLANET_RADII[i], turns: ORBIT_TURNS[i],
      point: [Math.cos(angle) * ORBIT_RADII[i], 0, Math.sin(angle) * ORBIT_RADII[i] * .58] as [number, number, number] };
  }) };
}

export const EARTH_REFERENCE = {
  figure: '1.34', printedPage: 22, pdfPage: 27, source: 'textbook/page-027.webp',
  layerOrder: ['地壳', '地幔', '外核', '内核'], radiiToScale: false,
  depictsSeismicVelocity: false, extractedShellsAreObservationOnly: true,
} as const;
export const EARTH_RADII = [21, 20.3, 11.4, 6.1] as const;
export const EARTH_COLORS = ['#c0b09a', '#c5aa80', '#c98a5e', '#a86048'] as const;
export const EARTH_LAYER_NAMES = ['地壳', '地幔', '外核', '内核'] as const;
export function evaluateEarthLayers(input: number) {
  const selection = Math.max(0, Math.min(3, Math.round(Number.isFinite(input) ? input : 0)));
  const focus = selection - 1;
  return { selection, source: EARTH_REFERENCE, focus: (['all', 'crust', 'mantle', 'core'] as const)[selection],
    layers: EARTH_LAYER_NAMES.map((name, i) => {
      const outer = EARTH_RADII[i], inner = EARTH_RADII[i + 1] ?? 0;
      const peeled = selection > 0 && selection < 3 && i === focus;
      return { name, index: i, outer, inner, color: EARTH_COLORS[i],
        visible: selection === 0 || i >= focus, peeled,
        labelVisible: selection === 0 || (selection === 3 ? i >= 2 : i === focus),
        selection: i < 2 ? i + 1 : 3,
        offset: [peeled ? (outer + inner) * 1.18 + 3 : 0, peeled ? 3 : 0, 0] as [number, number, number] };
    }) };
}
export function earthLayerInspection(target = 'overview') {
  const inspection = target === 'closed' ? target : 'overview';
  return { inspection, coverVisible: inspection === 'closed', removedAzimuthStart: Math.PI / 2,
    removedAzimuthLength: Math.PI / 2, observationOnly: true, changesLayerOrder: false };
}

const label = (x: number, y: number, value: string, size = 28) =>
  `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" fill="#303a40" font-family="FieldSerif,SimSun,serif">${value}</text>`;

export function solarSystemSvg(phase: number, selection = 0) {
  const selected = Math.max(0, Math.min(8, Math.round(selection)));
  const s = evaluateSolarSystem(phase), scale = 5.5, cx = 320, cy = 175;
  const projected = s.bodies.map(b => ({ ...b, x: cx + b.point[0] * scale, y: cy + b.point[2] * scale * .72 }));
  const earth = projected[selected ? selected - 1 : 2];
  // Two name slips suffice; the page itself contains the full planet list.
  // Keep Earth's slip away from the stationary Sun slip on close approaches.
  let ex = earth.x, ey = earth.y - 17;
  if (Math.abs(ex - cx) < 70 && Math.abs(ey - (cy - 29)) < 33) ey = cy + 62;
  return `<svg class="flat-model-svg flat-explanation-svg" viewBox="0 0 640 390" role="img"
    data-solar-system-state='${JSON.stringify({ phase: s.phase, bodyCount: 8, units: 'schematic', selected })}'
    aria-label="太阳系八颗行星连续公转示意；距离、大小与速度不按真实比例">
    <g fill="none" stroke="#a79e83" stroke-width="1.1">${ORBIT_RADII.map((r, i) =>
      `<ellipse cx="${cx}" cy="${cy}" rx="${r * scale}" ry="${r * .58 * scale * .72}"${i === (selected ? selected - 1 : 2) ? ' stroke="#668e98" stroke-width="1.8"' : ''}/>`).join('')}</g>
    <circle cx="${cx}" cy="${cy}" r="21" fill="#d2b375" stroke="#8a795a" stroke-width="1.2" data-model-selection="0" role="button" tabindex="0" aria-label="查看整个太阳系"/>
    ${label(cx, cy - 29, '太阳')}
    ${projected.sort((a, b) => a.y - b.y).map(b => `<g data-model-selection="${PLANET_NAMES.indexOf(b.name) + 1}" data-model-toggle="0" role="button" tabindex="0" aria-label="查看${b.name}"><title>${b.name}</title><circle cx="${b.x}" cy="${b.y}" r="15" fill="transparent"/><circle data-planet="${b.name}" cx="${b.x}" cy="${b.y}" r="${b.bodyRadius * 3.25}" fill="${b.name === '地球' ? '#86afb6' : '#c6b69a'}" stroke="#68736e" stroke-width="${PLANET_NAMES.indexOf(b.name) === selected - 1 ? 2.6 : 1.1}"/>${b.name === '土星' ? `<ellipse cx="${b.x}" cy="${b.y}" rx="${b.bodyRadius * 5.5}" ry="${b.bodyRadius * 1.6}" fill="none" stroke="#9a8a69" stroke-width="1.4"/>` : ''}</g>`).join('')}
    <path d="M${earth.x} ${earth.y - 7}L${ex} ${ey + 5}" fill="none" stroke="#7e9390"/>
    ${label(ex, ey, earth.name)}
    ${label(320, 349, '轨道、天体大小和速度均为示意')}
    </svg>`;
}

/** A three-quarter annular shell, with the same removed quadrant as the raised
 * cutaway. A section is an observation window, not a physical hole in Earth. */
const shellPath = (cx: number, cy: number, outer: number, inner: number) => {
  const arc = (r: number, reverse = false) => Array.from({ length: 73 }, (_, j) => {
    const a = (reverse ? 1 - j / 72 : j / 72) * Math.PI * 1.5;
    return [cx + Math.cos(a) * r, cy - Math.sin(a) * r];
  });
  const outerArc = arc(outer), innerArc = inner ? arc(inner, true) : [[cx, cy]];
  return [...outerArc, ...innerArc].map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(3)} ${y.toFixed(3)}`).join(' ') + 'Z';
};
export function earthLayersSvg(selection: number, target = 'overview') {
  const s = evaluateEarthLayers(selection), observation = earthLayerInspection(target), scale = 5.15;
  const cx = s.selection === 0 || s.selection === 3 ? 271 : 150, cy = 190;
  let layers = s.layers.filter(l => l.visible).map(l => ({ ...l,
    x: cx + l.offset[0] * scale, y: cy - l.offset[1] * scale }));
  if (observation.coverVisible) {
    const outer = layers.find(layer => !layer.peeled)?.index;
    layers = layers.filter(layer => layer.peeled || layer.index === outer);
  }
  const slips = layers.filter(l => l.labelVisible).map(l => {
    const x = l.peeled ? l.x : cx + 189, y = l.peeled ? l.y - l.outer * scale - 22 : (s.selection === 3 ? 171 + (l.index - 2) * 52 : 93 + l.index * 59);
    const pointAngle = [.65, .15, -.3, -.9][l.index], r = (l.inner + l.outer) / 2 * scale;
    const px = l.x + Math.cos(pointAngle) * r, py = l.y - Math.sin(pointAngle) * r;
    return `<g data-model-selection="${l.selection}" data-model-toggle="0" role="button" tabindex="0" aria-label="查看${l.name}；再次选择回到完整剖面">
      <path d="M${px} ${py}L${x - (l.peeled ? 0 : 59)} ${y - 7}" fill="none" stroke="#7e897d" stroke-width="1.1"/>
      <rect x="${x - 42}" y="${y - 28}" width="84" height="41" rx="3" fill="#f8f2e5"/>
      ${label(x, y, l.name)}</g>`;
  }).join('');
  return `<svg class="flat-model-svg flat-explanation-svg" viewBox="0 0 640 390" role="img" data-inspection="${observation.inspection}"
    data-earth-layers-state='${JSON.stringify({ selection: s.selection, focus: s.focus, layers: s.layers })}'
    aria-label="地球圈层${observation.coverVisible ? '合拢外观' : s.selection ? '分层' : '完整剖面'}观察；厚度为示意，不展示地震波速度">
    ${layers.map(l => observation.coverVisible ? `<circle cx="${l.x}" cy="${l.y}" r="${l.outer * scale}" fill="${l.color}" stroke="#655f52" stroke-width="1.3" data-model-inspection="closed" data-model-inspection-toggle="overview" role="button" tabindex="0" aria-label="打开地球剖面，保持圈层选择"/>` : `<path d="${shellPath(l.x, l.y, l.outer * scale, l.inner * scale)}" fill="${l.color}" stroke="#655f52" stroke-width="1.1"
      ${l.index === layers[0].index ? 'data-model-inspection="closed" data-model-inspection-toggle="overview"' : `data-model-selection="${l.selection}" data-model-toggle="0"`} role="button" tabindex="0" aria-label="${l.index === layers[0].index ? '合拢外壳，对照外观与剖面' : `查看${l.name}`}"/>`).join('')}
    ${slips}${label(320, 353, observation.coverVisible ? '合拢外壳，圈层选择保持' : '圈层次序不变，抬出只为观察')}</svg>`;
}

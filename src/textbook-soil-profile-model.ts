/** Textbook p.89, fig.5.17. The markers represent one movable portion of
 * dissolved material, not all soil minerals. Progress is not soil-forming time. */
export const SOIL_PROFILE_LAYERS = [
  { name: '有机层', top: 0, bottom: .10, color: '#756d50', side: '#625d46' },
  { name: '腐殖质层', top: .10, bottom: .24, color: '#71604c', side: '#605340' },
  { name: '淋溶层', top: .24, bottom: .45, color: '#d6cbb3', side: '#bdb39b' },
  { name: '淀积层', top: .45, bottom: .70, color: '#ae7954', side: '#916345' },
  { name: '母质层', top: .70, bottom: .84, color: '#bfaa87', side: '#a18d6e' },
  { name: '母岩层', top: .84, bottom: 1, color: '#a5a093', side: '#898779' },
] as const;
export const SOIL_PROFILE_REFERENCE = {
  textbookPages: [89], pdfPages: [94], figure: '5.17', quantities: 'schematic',
  scope: 'leaching-and-illuviation-of-one-movable-portion',
  notAllSoilMinerals: true, progressIsNotSoilFormingTime: true,
} as const;

export interface SoilProfileMaterial {
  id: number;
  u: number;
  depth: number;
  radius: number;
  travel: number;
  offsetX: number;
  sourceDepth: number;
  targetDepth: number;
  status: 'source' | 'moving' | 'deposited';
}
export interface SoilProfileWaterTracer {
  id: number;
  lane: number;
  depth: number;
  tailDepth: number;
  u: number;
}
export interface SoilProfileState {
  phase: number;
  selection: number;
  stage: 'ready' | 'infiltration' | 'leaching' | 'retained';
  materials: SoilProfileMaterial[];
  inventory: { source: number; moving: number; deposited: number; total: number };
  water: { active: boolean; rain: boolean; front: number; strength: number; tracers: SoilProfileWaterTracer[] };
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const smooth = (a: number, z: number, n: number) => { const t = clamp((n - a) / (z - a)); return t * t * (3 - 2 * t); };
const seed = (n: number) => { const p = Math.sin(n * 127.1 + 13.7) * 43758.5453; return p - Math.floor(p); };
export const normalizeSoilProfileSelection = (selection: number) => {
  const layer = Number.isFinite(selection) ? Math.round(selection) : -1;
  return layer >= 0 && layer < SOIL_PROFILE_LAYERS.length ? layer : -1;
};
export const soilProfileLayerOffset = (selection: number, layer: number) => normalizeSoilProfileSelection(selection) === layer ? .26 : 0;
/** Removing the front half is an observation transform. The two halves still
 * cover exactly the original volume, and the finite material pool is shared. */
export function soilProfileInspection(target = 'overview') {
  const inspection = target === 'section' ? target : 'overview';
  return { inspection, split: .55, frontOffset: inspection === 'section' ? 1.08 : 0,
    frontFraction: .45, rearFraction: .55, changesInventory: false, measuresRealThickness: false };
}

/** Every layer uses this same boundary, so there are no gaps between strata. */
export function soilProfileBoundary(index: number, u: number, v = 1): number {
  const depth = [0, .10, .24, .45, .70, .84, 1][index];
  if (index === 6) return 1;
  const wave = Math.sin(u * Math.PI * 2 + index * .71) * .50
    + Math.sin(u * Math.PI * 5 + v * 1.3 + index) * .28 + (v - .5) * .20;
  return depth + wave * (index === 0 ? .005 : .009);
}

/** The water bends continuously across a layer that has been pulled out. */
export function soilProfileOffsetAtDepth(depth: number, selection: number): number {
  const layer = normalizeSoilProfileSelection(selection);
  if (layer < 0) return 0;
  const { top, bottom } = SOIL_PROFILE_LAYERS[layer];
  const enter = layer === 0 ? 1 : smooth(top - .035, top + .035, depth);
  const leave = layer === 5 ? 1 : 1 - smooth(bottom - .035, bottom + .035, depth);
  return .26 * enter * leave;
}

export const SOIL_PROFILE_MATERIAL_POOL = Array.from({ length: 24 }, (_, id) => Object.freeze({
  id,
  startU: .13 + id % 6 * .145 + (seed(id + 9) - .5) * .035,
  endU: .13 + id % 6 * .145 + (seed(id + 39) - .5) * .085,
  sourceDepth: .268 + Math.floor(id / 6) * .045 + seed(id + 70) * .009,
  targetDepth: .502 + Math.floor(id / 6) * .045 + seed(id + 101) * .018,
  radius: .75 + seed(id + 43) * .30,
  release: .36 + seed(id + 132) * .075,
  arrive: .76 + seed(id + 163) * .135,
}));

export function soilProfileWaterU(lane: number, depth: number): number {
  return .14 + lane * .235 + Math.sin(depth * 15 + lane * .8) * .018;
}

export function evaluateSoilProfile(input: number, selected = -1): SoilProfileState {
  const phase = clamp(input), selection = normalizeSoilProfileSelection(selected);
  const materials = SOIL_PROFILE_MATERIAL_POOL.map(p => {
    const travel = smooth(p.release, p.arrive, phase);
    return {
      id: p.id, radius: p.radius, travel, sourceDepth: p.sourceDepth, targetDepth: p.targetDepth,
      u: p.startU + (p.endU - p.startU) * travel + Math.sin(travel * Math.PI) * Math.sin(p.id * 1.7) * .012,
      depth: p.sourceDepth + (p.targetDepth - p.sourceDepth) * travel,
      // Interpolate the two layer offsets, rather than jumping at a boundary.
      offsetX: soilProfileLayerOffset(selection, 2) * (1 - travel) + soilProfileLayerOffset(selection, 3) * travel,
      status: phase <= p.release ? 'source' as const : phase >= p.arrive ? 'deposited' as const : 'moving' as const,
    };
  });
  const source = materials.filter(p => p.status === 'source').length;
  const deposited = materials.filter(p => p.status === 'deposited').length;
  // Water reaches both the source and destination before material is released.
  const front = .81 * smooth(0, .34, phase);
  const strength = smooth(0, .075, phase) * (1 - smooth(.82, 1, phase));
  const active = strength > .001;
  const tracers = Array.from({ length: 16 }, (_, id) => {
    const lane = id % 4, q = (phase * 1.6 + Math.floor(id / 4) / 4) % 1;
    const depth = front * q;
    return { id, lane, depth, tailDepth: Math.max(0, depth - .026), u: soilProfileWaterU(lane, depth) };
  });
  return { phase, selection, materials,
    stage: phase <= .005 ? 'ready' : phase < .36 ? 'infiltration' : deposited === materials.length ? 'retained' : 'leaching',
    inventory: { source, moving: materials.length - source - deposited, deposited, total: materials.length },
    water: { active, rain: phase > .005 && phase < .76, front, strength, tracers },
  };
}

/** Same front-face coordinates as Three.js, with a small isometric depth. */
export function soilProfileProject(u: number, depth: number, v = 1, offset = 0): [number, number] {
  return [221 + (u + offset) * 178 + (1 - v) * 31, 60 + depth * 274 - (1 - v) * 16];
}
const number = (n: number) => Number(n.toFixed(6));
const pair = (p: [number, number]) => p.map(number).join(',');
const points = (p: [number, number][]) => p.map(pair).join(' ');
const path = (p: [number, number][]) => `M${p.map(pair).join('L')}Z`;

/** Vector fallback: no scanned illustration, image texture, or independent animation. */
export function soilProfileSvg(phase: number, selection = -1, target = 'overview'): string {
  const state = evaluateSoilProfile(phase, selection), observation = soilProfileInspection(target);
  const project = (u: number, depth: number, v = 1, offset = 0): [number, number] => {
    const p = soilProfileProject(u, depth, v, offset + (v >= observation.split ? observation.frontOffset : 0));
    return [p[0] - (observation.frontOffset ? 100 : 0), p[1]];
  };
  const order = [5, 4, 3, 2, 1, 0].filter(i => i !== state.selection);
  if (state.selection >= 0) order.push(state.selection);
  let body = '';
  const action = (layer: number) => `data-soil-profile-layer="${layer}" data-model-selection="${layer}" data-model-toggle="-1" role="button" tabindex="0" aria-label="查看${SOIL_PROFILE_LAYERS[layer].name}，再次选择复原" aria-pressed="${state.selection === layer}"`;
  for (const i of order) {
    const layer = SOIL_PROFILE_LAYERS[i], offset = soilProfileLayerOffset(state.selection, i);
    const edge = (index: number, v: number, reverse = false) => Array.from({ length: 25 }, (_, j) => {
      const u = reverse ? 1 - j / 24 : j / 24;
      return project(u, soilProfileBoundary(index, u, v), v, offset);
    });
    const front = edge(i, 1).concat(edge(i + 1, 1, true));
    const top = edge(i, observation.split).concat(edge(i, 1, true));
    const side = [project(1, soilProfileBoundary(i, 1, 1), 1, offset), project(1, soilProfileBoundary(i, 1, observation.split), observation.split, offset),
      project(1, soilProfileBoundary(i + 1, 1, observation.split), observation.split, offset), project(1, soilProfileBoundary(i + 1, 1, 1), 1, offset)];
    const rearProject = (u: number, depth: number, v: number): [number, number] => {
      const at = soilProfileProject(u, depth, v, offset); return [at[0] - (observation.frontOffset ? 100 : 0), at[1]];
    };
    const rearEdge = (index: number, v: number, reverse = false) => Array.from({ length: 25 }, (_, j) => {
      const u = reverse ? 1 - j / 24 : j / 24; return rearProject(u, soilProfileBoundary(index, u, v), v);
    });
    const rearTop = rearEdge(i, 0).concat(rearEdge(i, observation.split, true));
    const rearSide = [rearProject(1, soilProfileBoundary(i, 1, observation.split), observation.split), rearProject(1, soilProfileBoundary(i, 1, 0), 0),
      rearProject(1, soilProfileBoundary(i + 1, 1, 0), 0), rearProject(1, soilProfileBoundary(i + 1, 1, observation.split), observation.split)];
    body += `<g data-soil-profile-part="layer"><g ${action(i)} data-soil-profile-part="rear-half"><path d="${path(rearSide)}" fill="${layer.side}" stroke="#635f50" stroke-width=".8"/><path d="${path(rearEdge(i, observation.split).concat(rearEdge(i + 1, observation.split, true)))}" fill="${layer.color}" stroke="#635f50" stroke-width=".9"/><path d="${path(rearTop)}" fill="${layer.color}" stroke="#635f50" stroke-width=".7"/></g>`;
    body += `<g data-model-inspection="section" data-model-inspection-toggle="overview" role="button" tabindex="0" aria-label="剖开或合拢土柱前半部；保持原有土层和物料" data-soil-profile-part="front-half"><path d="${path(side)}" fill="${layer.side}" stroke="#635f50" stroke-width=".8"/><path d="${path(front)}" fill="${layer.color}" stroke="#635f50" stroke-width=".9"/><path d="${path(top)}" fill="${layer.color}" stroke="#635f50" stroke-width=".7"/>`;
    // The unmoving texture remains after the movable portion has been leached.
    for (let j = 0; j < (i === 5 ? 14 : 26); j++) {
      const u = .045 + seed(i * 81 + j + 205) * .91;
      const d = layer.top + .016 + seed(i * 83 + j + 306) * (layer.bottom - layer.top - .032);
      const [x, y] = project(u, d, 1, offset), length = i === 5 ? 7 + seed(j + 10) * 13 : 1.2 + seed(j + 11) * 2;
      body += `<path d="M${number(x - length / 2)},${number(y)}l${number(length)},${number(i === 5 ? 2.5 : -.6)}" fill="none" stroke="${i === 2 ? '#a89a80' : '#615744'}" stroke-width="${i === 5 ? .9 : .8}" opacity="${i === 2 ? .52 : .35}"/>`;
    }
    if (i === 1) {
      for (let j = 0; j < 5; j++) {
        const u = .10 + j * .18;
        const root = Array.from({ length: 15 }, (_, k) => project(u + Math.sin(k * .5 + j) * .023, .105 + k / 14 * .127, 1, offset));
        body += `<path d="M${root.map(pair).join('L')}" fill="none" stroke="#c4af83" stroke-width="1.1"/>`;
      }
    }
    body += '</g></g>';
  }
  // Leaf litter belongs to the organic surface, not a floating illustration.
  const organicOffset = soilProfileLayerOffset(state.selection, 0);
  for (let i = 0; i < 9; i++) {
    const u = .06 + i * .105, v = .20 + seed(i + 415) * .65, p = project(u, soilProfileBoundary(0, u, v) - .004, v, organicOffset);
    body += `<ellipse cx="${number(p[0])}" cy="${number(p[1])}" rx="5.3" ry="1.7" transform="rotate(${number(-25 + seed(i + 405) * 50)} ${pair(p).replace(',', ' ')})" fill="${i % 2 ? '#8e7750' : '#b29c69'}" stroke="#615b45" stroke-width=".6"/>`;
  }
  if (state.water.active) {
    for (let lane = 0; lane < 4; lane++) {
      const line = Array.from({ length: 45 }, (_, i) => {
        const depth = state.water.front * i / 44;
        return project(soilProfileWaterU(lane, depth), depth, 1, soilProfileOffsetAtDepth(depth, state.selection));
      });
      body += `<path data-soil-profile-water="${lane}" d="M${line.map(pair).join('L')}" fill="none" stroke="#6d9ca5" opacity="${number(state.water.strength * .68)}" stroke-width="2.2"/>`;
    }
    for (const tracer of state.water.tracers) {
      const z = project(tracer.u, tracer.depth, 1, soilProfileOffsetAtDepth(tracer.depth, state.selection));
      const a = project(soilProfileWaterU(tracer.lane, tracer.tailDepth), tracer.tailDepth, 1, soilProfileOffsetAtDepth(tracer.tailDepth, state.selection));
      const dx = z[0] - a[0], dy = z[1] - a[1], length = Math.hypot(dx, dy) || 1;
      const wing = (side: number): [number, number] => [z[0] - dx / length * 4 + dy / length * side * 2.1, z[1] - dy / length * 4 - dx / length * side * 2.1];
      body += `<path d="M${pair(wing(1))}L${pair(z)}L${pair(wing(-1))}" fill="none" stroke="#4c7f89" stroke-width="1.2" opacity="${number(state.water.strength)}"/>`;
    }
    if (state.water.rain) for (let i = 0; i < 7; i++) {
      const u = .07 + i * .14, p = project(u, -.033, .78, organicOffset);
      body += `<path d="M${number(p[0] + 1)},${number(p[1] - 6)}l-2,7" stroke="#6d9ca5" stroke-width="1.5" stroke-linecap="round" opacity="${number(state.water.strength * .75)}"/>`;
    }
  }
  for (const material of state.materials) {
    const p = project(material.u, material.depth, 1, material.offsetX), r = material.radius * 2.8;
    const outline = Array.from({ length: 6 }, (_, i): [number, number] => {
      const a = i / 6 * Math.PI * 2;
      return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r * .75];
    });
    body += `<polygon data-soil-profile-material="${material.id}" data-u="${number(material.u)}" data-depth="${number(material.depth)}" data-offset="${number(material.offsetX)}" data-travel="${number(material.travel)}" data-status="${material.status}" points="${points(outline)}" fill="#80613a" stroke="#5e4c34" stroke-width=".65"/>`;
  }
  const labelled = [2, 3];
  if (state.selection >= 0 && !labelled.includes(state.selection)) labelled.push(state.selection);
  for (const i of labelled) {
    const layer = SOIL_PROFILE_LAYERS[i], middle = (layer.top + layer.bottom) / 2, offset = soilProfileLayerOffset(state.selection, i);
    const right = observation.frontOffset > 0 || i === 2 || i === 3, anchor = project(right ? 1 : 0, middle, 1, offset), x = right ? observation.frontOffset ? 625 : 535 : 109;
    const lineEnd = right ? observation.frontOffset ? 563 : 473 : 184;
    body += `<g ${action(i)} data-soil-profile-part="label"><path d="M${pair(anchor)}L${lineEnd},${number(anchor[1])}" stroke="#777566" stroke-width=".85" fill="none"/><text x="${x}" y="${number(anchor[1] + 8)}" text-anchor="middle" fill="#303a40" font-size="25" font-family="FieldSerif,SimSun,serif">${layer.name}</text></g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" class="flat-model-svg flat-explanation-svg" viewBox="0 0 ${observation.frontOffset ? 720 : 640} 390" role="group" data-inspection="${observation.inspection}" data-soil-section='${JSON.stringify(observation)}' data-soil-profile="${state.stage}" data-phase="${number(state.phase)}" data-source="${state.inventory.source}" data-moving="${state.inventory.moving}" data-deposited="${state.inventory.deposited}" aria-label="森林土壤六层剖面。雨水先下渗，再把淋溶层中一部分可移动物质带到淀积层，并在那里保留；标记不代表全部土壤矿物质，过程进度不表示真实成土年限。点击土柱前半部可剖开，再次点击合拢；层名仍可抽出单层。"><title>图5.17 土壤剖面：淋溶与淀积示意</title><g stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;
}

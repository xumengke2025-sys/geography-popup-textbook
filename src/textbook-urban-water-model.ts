import { drawingGrip } from './textbook-drawing-grip';
/** Printed pp.96–98, especially Fig.5.23 (rain-garden section) and Fig.5.24
 * (sponge city). The twelve marks below are permanent tracing symbols, not
 * measured volumes or runoff percentages. Phase is observation progress. */
export const URBAN_WATER_REFERENCE = Object.freeze({
  printedPages: [96, 97, 98], pdfPages: [101, 102, 103], figures: ['5.23', '5.24'],
  source: 'textbook/page-102.webp',
  principle: '硬化地面减少下渗；土壤和洼地留水，并延缓一部分水进入排水系统。',
  modelType: 'finite-qualitative-rainfall-partition',
  calibratedVolume: false, calibratedTime: false, measuredRunoffPercentages: false,
  purificationSimulated: false, preventsAllFlooding: false,
});

export const URBAN_WATER_STOPS = [
  { label: '起点', phase: 0 },
  { label: '降水落地', phase: .3 },
  { label: '分流下渗', phase: .5 },
  { label: '暂存', phase: .7 },
  { label: '排水对照', phase: 1 },
] as const;

export type UrbanWaterPoint = [number, number, number];
export type UrbanWaterSelection = 0 | 1 | 2;
export type UrbanWaterCompartment = 'air' | 'surface' | 'soil' | 'storage' | 'drain' | 'collected';
export interface UrbanWaterKeyframe {
  phase: number;
  point: UrbanWaterPoint;
  compartment: UrbanWaterCompartment;
}
export interface UrbanWaterSolid {
  role: string;
  profile: [number, number][];
  back: number;
  front: number;
  color: string;
  selection?: UrbanWaterSelection;
}
export interface UrbanWaterMeshData { positions: number[]; indices: number[]; }

export const URBAN_WATER_PACKET_COUNT = 12;
export const URBAN_WATER_MODES = ['impervious', 'permeable', 'rain-garden'] as const;
export const URBAN_WATER_LABELS = ['硬化', '透水', '花园'] as const;
export const URBAN_WATER_LAYOUT = {
  plot: { left: 6, right: 92, back: 14, front: 56, ground: 20.8, bottom: 0 },
  garden: { left: 36, right: 64, bottom: 3, top: 16.9, rim: 20.8 },
  collector: { left: 96, right: 113, back: 50, front: 65, floor: 2.4 },
  track: { start: [12, -20, 76] as UrbanWaterPoint, end: [88, -20, 76] as UrbanWaterPoint },
  conditionLabels: [[20, -6, 70], [50, -6, 70], [80, -6, 70]] as UrbanWaterPoint[],
  houses: [[21, 20.8, 23], [78, 20.8, 22]] as UrbanWaterPoint[],
  surfaceLabel: [46, 31, 62] as UrbanWaterPoint,
  storageLabel: [50, 31, 62] as UrbanWaterPoint,
  collectorLabel: [104, 22, 65] as UrbanWaterPoint,
} as const;

const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
export const urbanWaterSelection = (selection: number): UrbanWaterSelection =>
  Math.max(0, Math.min(2, Math.round(Number.isFinite(selection) ? selection : 0))) as UrbanWaterSelection;
const ease = (t: number) => t * t * (3 - 2 * t);
const mix = (a: UrbanWaterPoint, b: UrbanWaterPoint, t: number): UrbanWaterPoint =>
  a.map((value, i) => value + (b[i] - value) * t) as UrbanWaterPoint;
const key = (phase: number, point: UrbanWaterPoint, compartment: UrbanWaterCompartment): UrbanWaterKeyframe => ({ phase, point, compartment });

export const URBAN_WATER_ORIGINS = Array.from({ length: URBAN_WATER_PACKET_COUNT }, (_, index) => {
  const row = Math.floor(index / 6), col = index % 6;
  return Object.freeze({ id: `urban-water-${index}`, index,
    point: [15 + col * 12.8 + row * 4.4, 61 + row * 9, 57.4 + row * 3.3] as UrbanWaterPoint,
    color: index === 0 ? '#4f8799' : '#6e9ea9',
  });
});

const collectedPoint = (index: number): UrbanWaterPoint =>
  [100.5 + (index % 2) * 6.7, 4.15, 55.8 + Math.floor(index / 2) * 5.3];

/** All paths start with the same finite rain packet. Each path ends at an
 * explicit visible location; no path uses modulo, spawning or disappearance. */
export function urbanWaterPacketPath(index: number, inputSelection: number): UrbanWaterKeyframe[] {
  const selection = urbanWaterSelection(inputSelection), origin = URBAN_WATER_ORIGINS[index];
  if (!origin) throw new RangeError('Unknown rain packet');
  const x = origin.point[0], z = origin.point[2], insideGarden = x >= 36 && x <= 64;
  const landAt = [.28, .29, .3][index % 3];
  const landed: UrbanWaterPoint = [x, selection === 2 && insideGarden ? 18.5 : 21.7, z];
  const path: UrbanWaterKeyframe[] = [key(0, [...origin.point], 'air'),
    key(landAt, landed, selection === 2 && insideGarden ? 'storage' : 'surface')];
  if (selection === 0) {
    if (index < 8) {
      const end: UrbanWaterPoint = [25 + index % 4 * 9, 21.7, 57.4 + Math.floor(index / 4) * 5.6];
      path.push(key(.44, [landed[0] * .55 + end[0] * .45, 21.7, z], 'surface'),
        key(.66, end, 'surface'), key(1, [...end], 'surface'));
    } else {
      const j = index - 8;
      path.push(key(.39, [Math.max(x, 70), 21.7, z], 'surface'),
        key(.46 + j * .035, [88, 21.7, 58.2], 'surface'),
        key(.56 + j * .04, [88, 5.9, 58.2], 'drain'),
        key(.67 + j * .035, [97, 5.9, 58.2], 'drain'),
        key(.76 + j * .04, collectedPoint(j), 'collected'), key(1, collectedPoint(j), 'collected'));
    }
    return path;
  }
  if (selection === 1) {
    if (index < 6) {
      const end: UrbanWaterPoint = [17 + index * 12.2, 9.2 + index % 2 * 4.4, 57.4];
      path.push(key(.37, [x, 19.7, z], 'soil'), key(.54, [end[0], 15.7, 57.4], 'soil'),
        key(.74, end, 'soil'), key(1, [...end], 'soil'));
    } else if (index < 8) {
      const end: UrbanWaterPoint = [43 + (index - 6) * 10, 21.7, 59.8];
      path.push(key(.55, end, 'surface'), key(1, [...end], 'surface'));
    } else if (index < 10) {
      const j = index - 8;
      path.push(key(.46, [72 + j * 6, 21.7, z], 'surface'),
        key(.62 + j * .035, [88, 21.7, 58.2], 'surface'),
        key(.73 + j * .035, [88, 5.9, 58.2], 'drain'),
        key(.83 + j * .035, [97, 5.9, 58.2], 'drain'),
        key(.9 + j * .035, collectedPoint(j), 'collected'), key(1, collectedPoint(j), 'collected'));
    } else {
      const j = index - 8;
      path.push(key(.38, [x, 19.7, z], 'soil'), key(.55, [x, 12.5, 57.4], 'soil'),
        key(.7, [x, 5.9, 58.2], 'storage'), key(.83, [88, 5.9, 58.2], 'drain'),
        key(.91 + (j - 2) * .02, [97, 5.9, 58.2], 'drain'),
        key(.97 + (j - 2) * .03, collectedPoint(j), 'collected'));
      if (path.at(-1)!.phase < 1) path.push(key(1, collectedPoint(j), 'collected'));
    }
    return path;
  }
  // The garden is an actual depression. Rain over its centre lands lower;
  // water from either paved side reaches the rim before entering the hollow.
  if (index === 7) {
    const end: UrbanWaterPoint = [28.5, 21.7, 60.7];
    path.push(key(.55, end, 'surface'), key(1, [...end], 'surface'));
    return path;
  }
  const targetX = index < 4 ? 40 + index * 6.5 : index < 7 ? 43 + (index - 4) * 7 : 44 + (index - 8) * 7;
  const rimX = insideGarden ? x : x < 36 ? 36.3 : 63.7;
  path.push(key(.39, [rimX, insideGarden ? 18.5 : 21.7, z], insideGarden ? 'storage' : 'surface'));
  if (index === 11) {
    // A finite excess also leaves by surface overflow. A garden does not
    // imply that every storm can be retained or all surface ponding removed.
    path.push(key(.5, [62, 20.5, 58.2], 'storage'), key(.61, [65.5, 21.7, 58.2], 'surface'),
      key(.72, [88, 21.7, 58.2], 'surface'), key(.83, [88, 5.9, 58.2], 'drain'),
      key(.92, [97, 5.9, 58.2], 'drain'), key(1, collectedPoint(3), 'collected'));
  } else if (index < 4) {
    const end: UrbanWaterPoint = [targetX, 9.3 + index % 2 * 3.5, 57.4];
    path.push(key(.5, [targetX, 18.5, 57.4], 'storage'), key(.56, [targetX, 16.1, 57.4], 'soil'),
      key(.78, end, 'soil'), key(1, [...end], 'soil'));
  } else if (index < 7) {
    const end: UrbanWaterPoint = [targetX, 18.5, 59.5];
    path.push(key(.57, end, 'storage'), key(1, [...end], 'storage'));
  } else {
    const j = index - 8;
    path.push(key(.5, [targetX, 18.5, 57.4], 'storage'), key(.59, [targetX, 15.8, 57.4], 'soil'),
      key(.72, [targetX, 5.9, 58.2], 'storage'), key(.85 + j * .012, [88, 5.9, 58.2], 'drain'),
      key(.93 + j * .012, [97, 5.9, 58.2], 'drain'),
      key(.976 + j * .012, collectedPoint(j), 'collected'));
    if (path.at(-1)!.phase < 1) path.push(key(1, collectedPoint(j), 'collected'));
  }
  return path;
}

function pointOnPath(path: UrbanWaterKeyframe[], phase: number) {
  let index = 0;
  while (index < path.length - 1 && path[index + 1].phase <= phase) index++;
  const a = path[index], b = path[Math.min(index + 1, path.length - 1)];
  const t = b.phase > a.phase ? ease(clamp((phase - a.phase) / (b.phase - a.phase))) : 0;
  const point = mix(a.point, b.point, t);
  // The falling marker crosses the top before it is counted as infiltrated.
  // Subsequent compartments follow the marked junctions of its own path.
  const compartment = a.compartment;
  return { point, compartment, pathIndex: index };
}

export function evaluateUrbanWater(inputPhase: number, inputSelection: number) {
  const phase = clamp(inputPhase), selection = urbanWaterSelection(inputSelection);
  const stageIndex = phase < .3 ? 0 : phase < .5 ? 1 : phase < .7 ? 2 : phase < 1 ? 3 : 4;
  const stage = (['rainfall', 'partition', 'temporary-storage', 'finite-drainage', 'retained-endpoints'] as const)[stageIndex];
  const captions = [
    '同一场雨，从这里出发',
    selection === 0 ? '雨水沿地表汇集' : selection === 1 ? '部分雨水进入土壤' : '雨水汇入低洼花园',
    selection === 0 ? '地表余水仍在' : selection === 1 ? '土壤留住部分雨水' : '土壤与洼地留水',
    '沿排水口追踪',
    '每一滴都保留去向',
  ];
  const explanations = [
    '同一场雨、同一组水滴，比较三种地面。',
    selection === 0 ? '硬化地面阻隔下渗，雨水沿地表汇集。' : selection === 1 ? '透水缝让部分雨水下渗，土壤开始留水。' : '雨水进入低洼花园，再向分层土体下渗。',
    selection === 0 ? '排水能力有限，地表余水仍然可见。' : selection === 1 ? '部分水留在土中，另一部分继续进入排水。' : '洼地与土体暂存雨水，部分水延后排出。',
    selection === 2 ? '排水继续，洼地暂存和地表余水同时可见。' : '追踪这批雨水，排出的水留在右侧收集池。',
    selection === 0 ? '部分雨水已排出，其余仍在地表；切换地面，再比较同一场雨。'
      : selection === 1 ? '排出水在收集池，留存水在土层与地表；可回拖比较。'
        : '洼地、土壤和收集池保留这批雨水的去向；可回拖比较。',
  ];
  const packets = URBAN_WATER_ORIGINS.map(origin => {
    const path = urbanWaterPacketPath(origin.index, selection), sample = pointOnPath(path, phase);
    const endpoint = path[path.length - 1];
    return { id: origin.id, index: origin.index, color: origin.color, origin: [...origin.point] as UrbanWaterPoint,
      ...sample, finalDestination: endpoint.compartment, destination: [...endpoint.point] as UrbanWaterPoint,
      retained: true, endpointReached: phase >= endpoint.phase,
      trace: [...path.filter(node => node.phase < phase).map(node => [...node.point] as UrbanWaterPoint), [...sample.point] as UrbanWaterPoint],
    };
  });
  const inventory: Record<UrbanWaterCompartment, number> = { air: 0, surface: 0, soil: 0, storage: 0, drain: 0, collected: 0 };
  for (const packet of packets) inventory[packet.compartment]++;
  return { phase, selection, mode: URBAN_WATER_MODES[selection], stageIndex, stage,
    caption: captions[stageIndex], text: explanations[stageIndex], packets, inventory,
    inputCount: URBAN_WATER_PACKET_COUNT, retainedCount: packets.length,
    collectedCount: inventory.collected, endpointCount: packets.filter(packet => packet.endpointReached).length,
    complete: phase === 1, wraps: false, respawns: false, sameRainInput: true,
    phaseMeaning: 'uncalibrated-observation-progress' as const, phaseIsCalibratedTime: false,
    packetUnitsAreSchematic: true, quantitativeRunoffModel: false, delayIsQualitative: true,
    infiltration: selection > 0, temporaryStorage: selection > 0, preventsAllFlooding: false,
    purificationSimulated: false,
  };
}
export type UrbanWaterState = ReturnType<typeof evaluateUrbanWater>;

const slab = (role: string, x0: number, x1: number, y0: number, y1: number, back: number, front: number, color: string): UrbanWaterSolid =>
  ({ role, profile: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], back, front, color });

/** The same profiles and coordinates build the native SVG and actual thick
 * Three.js solids. In garden mode no slab spans the open central depression. */
export function urbanWaterSolids(inputSelection: number): UrbanWaterSolid[] {
  const selection = urbanWaterSelection(inputSelection);
  const solids = [slab('foundation', 6, 92, 0, 3, 14, 56, '#b9b3a1')];
  if (selection !== 2) solids.push(slab('soil-section', 6, 92, 3, 19.8, 14, 56, '#a98b6b'));
  if (selection === 0) solids.push(slab('impervious-pavement', 6, 92, 19.8, 20.8, 14, 56, '#788082'));
  if (selection === 1) {
    // Physical joints make the alternative legible without recolouring an
    // impermeable slab or pretending the model resolves individual pores.
    for (let row = 0; row < 4; row++) for (let col = 0; col < 7; col++) {
      const x = 6.5 + col * 12.2, z = 14.5 + row * 10.3;
      solids.push(slab('permeable-paver', x, x + 11.1, 19.8, 20.8, z, z + 9.3, '#aa9f8b'));
    }
  }
  if (selection === 2) {
    solids.push(slab('garden-left-soil', 6, 36, 3, 19.8, 14, 56, '#a98b6b'),
      slab('garden-right-soil', 64, 92, 3, 19.8, 14, 56, '#a98b6b'),
      slab('garden-left-pavement', 6, 35.5, 19.8, 20.8, 14, 56, '#788082'),
      slab('garden-right-pavement', 64.5, 92, 19.8, 20.8, 14, 56, '#788082'),
      slab('garden-gravel', 36, 64, 3, 7.2, 14, 56, '#a89d8c'),
      slab('garden-sand', 36, 64, 7.2, 8.6, 14, 56, '#c4ad80'),
      slab('garden-fill', 36, 64, 8.6, 13, 14, 56, '#ac9579'),
      slab('garden-planting-soil', 36, 64, 13, 16.3, 14, 56, '#92775c'),
      slab('garden-mulch', 36, 64, 16.3, 16.9, 14, 56, '#78614a'));
  }
  // Cutaway drains are open towards the viewer, so markers remain visible
  // while moving through them instead of vanishing inside an opaque tube.
  solids.push(slab('drain-floor', 50, 97, 4.6, 5, 57, 59.7, '#a3b1ae'),
    slab('drain-back', 50, 97, 5, 6.8, 56.7, 57, '#b1bfbb'),
    slab('drain-front-lip', 50, 97, 5, 5.35, 59.5, 59.9, '#879d99'),
    slab('surface-inlet-back', 86.4, 89.6, 5, 20.8, 56.6, 57, '#a9b4ad'),
    slab('surface-inlet-left', 86.1, 86.5, 5, 20.8, 57, 59.6, '#92a39d'),
    slab('surface-inlet-right', 89.5, 89.9, 5, 20.8, 57, 59.6, '#92a39d'),
    slab('collector-floor', 96, 113, 1.4, 2.4, 50, 65, '#74928f'),
    slab('collector-back', 96, 113, 2.4, 6.2, 50, 50.7, '#6d8279'),
    slab('collector-left', 95.7, 96.4, 2.4, 6.2, 50, 65, '#6d8279'),
    slab('collector-right', 112.6, 113.3, 2.4, 6.2, 50, 65, '#6d8279'),
    slab('collector-front-lip', 96, 113, 2.4, 3.25, 64.4, 65, '#759286'));
  return solids;
}

export function urbanWaterPrismMesh(solid: UrbanWaterSolid): UrbanWaterMeshData {
  const count = solid.profile.length, positions: number[] = [], indices: number[] = [];
  for (const z of [solid.back, solid.front]) for (const [x, y] of solid.profile) positions.push(x, y, z);
  for (let i = 1; i < count - 1; i++) indices.push(0, i + 1, i, count, count + i, count + i + 1);
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count;
    indices.push(i, next, count + i, next, count + next, count + i);
  }
  return { positions, indices };
}

export function urbanWaterProject([x, y, z]: UrbanWaterPoint): [number, number] {
  return [37 + x * 5.2 + (z - 56) * .8, 444 - y * 4.7 + (z - 56) * 1.4];
}
const n = (value: number) => Number(value.toFixed(5));
const xy = (point: UrbanWaterPoint) => urbanWaterProject(point).map(n).join(',');
const polygon = (points: UrbanWaterPoint[], color: string, width = .8) =>
  `<polygon points="${points.map(xy).join(' ')}" fill="${color}" stroke="#6c7c71" stroke-width="${width}"/>`;
const line = (points: UrbanWaterPoint[], color = '#6b807b', width = .9) =>
  `<polyline points="${points.map(xy).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
const text = (label: string, point: UrbanWaterPoint, size = 24) => {
  const [x, y] = urbanWaterProject(point);
  return `<text x="${n(x)}" y="${n(y)}" text-anchor="middle" dominant-baseline="central" font-size="${size}" fill="#354440" paint-order="stroke" stroke="#f7f1e3" stroke-width="5">${label}</text>`;
};

function solidSvg(solid: UrbanWaterSolid, inspection = 'overview') {
  const [a, b, c, d] = solid.profile;
  const at = ([x, y]: [number, number], z: number): UrbanWaterPoint => [x, y, z];
  const target = /collector/.test(solid.role) ? 'collected' : /drain|inlet/.test(solid.role) ? 'drain' : null;
  const width = target !== null && target === inspection ? 2.2 : .8;
  return `<g data-urban-solid="${solid.role}" ${target ? `data-model-inspection="${target}" data-model-inspect="${target}" data-specimen-key="" role="button" tabindex="0" aria-label="观察${target === 'drain' ? '排水口' : '收集池'}"` : ''}>`
    + polygon([at(d, solid.back), at(c, solid.back), at(c, solid.front), at(d, solid.front)], solid.color, width)
    + polygon([at(b, solid.back), at(b, solid.front), at(c, solid.front), at(c, solid.back)], solid.color, width)
    + polygon(solid.profile.map(point => at(point, solid.front)), solid.color, width)
    + (/soil|mulch|sand|gravel|fill/.test(solid.role) ? `<polygon points="${solid.profile.map(point=>xy(at(point,solid.front))).join(' ')}" fill="url(#${solid.role==='garden-gravel'?'urban-gravel':'urban-earth'})"/>` : '') + '</g>';
}

/** Native SVG uses the identical finite state and section solids. There are
 * no linked images, independent rain loops, extra cities or rebuilt answers. */
export function urbanWaterSvg(inputPhase: number, inputSelection: number, inspection = 'overview'): string {
  const state = evaluateUrbanWater(inputPhase, inputSelection), solids = urbanWaterSolids(state.selection);
  const trackedIndex = /^packet-(?:[0-9]|1[01])$/.test(inspection) ? Number(inspection.slice(7)) : 0;
  const cutaway = solids.filter(solid => !/drain|collector|inlet/.test(solid.role));
  let body = cutaway.map(solid => solidSvg(solid, inspection)).join('');
  for (const [index,[x,y,z]] of URBAN_WATER_LAYOUT.houses.entries()) {
    const halfX=index?10.2:9.5, halfZ=index?5.8:5.4, h=index?10.5:11.9, front=z+halfZ, ridge=y+h+3.7;
    const facade = (lo:number,hi:number,bottom:number,top:number,depth:number,color:string) =>
      polygon([[lo,bottom,depth],[hi,bottom,depth],[hi,top,depth],[lo,top,depth]],color,.48);
    body += '<g data-street-building="'+(index?'pump-house':'terrace-house')+'">';
    body += facade(x-halfX,x+halfX,y,y+h,front,index?'#cfbfa2':'#ac8169');
    body += polygon([[x+halfX,y,front],[x+halfX,y,z-halfZ],[x+halfX,y+h,z-halfZ],[x+halfX,y+h,front]],'#a99981');
    body += polygon([[x-halfX-.6,y+h,front+.6],[x+halfX+.6,y+h,front+.6],[x+halfX-3,ridge,z],[x-halfX+3,ridge,z]],'#65747a');
    body += polygon([[x+halfX+.6,y+h,front+.6],[x+halfX+.6,y+h,z-halfZ-.6],[x+halfX-3,ridge,z]],'#53646a');
    for(const t of [.23,.48,.73])body+=line([[x-halfX-.6+3.6*t,y+h+3.7*t,front+.6-(halfZ+.6)*t],[x+halfX+.6-3.6*t,y+h+3.7*t,front+.6-(halfZ+.6)*t]],'#8a9596',.55);
    for(const off of [-.76,-.39,0,.39,.76])for(const upper of [false,true]){
      const wx=x+off*halfX,door=!upper&&off===0, bottom=y+(door?.2:upper?h*.61:1.55),top=bottom+(door?5.1:upper?2.15:2.65);
      body+=facade(wx-.86,wx+.86,bottom,top,front+.2,door?'#536658':'#425c64');
      body+=line([[wx-1.16,top+.23,front+.28],[wx+1.16,top+.23,front+.28]],'#dfd1b6',1.1);
      if(!door)body+=line([[wx,bottom,front+.3],[wx,top,front+.3]],'#c9bba0',.6);
    }
    for(const off of [-.53,.51])body+=facade(x+halfX*off-.7,x+halfX*off+.7,y+h+2.2,y+h+5.9,z-1.9,'#9b735f');
    body+=line([[x-halfX,y+h,front+.6],[x+halfX,y+h,front+.6],[x+halfX,y+.38,front+.7],[x+halfX,y+.38,front+1.35]],'#557870',1.25);
    body+='</g>';
  }
  if (state.selection === 2) {
    for(const [i,[x,z]] of [[39,23],[43,30],[51,28],[56,22],[59,33],[40,41],[54,43],[48,36]].entries()) {
      for(let j=0;j<8;j++){
        const dx=Math.sin(2.4*j+i)*(2+(j%3)*.55), h=3.7+(j*7+i*3)%5;
        body+=polygon([[x,16.9,z],[x+dx*.43-.18,16.9+h*.62,z],[x+dx,16.9+h,z+.45],[x+dx*.43+.18,16.9+h*.62,z]],j%3?'#646f47':'#869363',.3);
      }
      body+=line([[x,16.9,z],[x+.36,24.2,z],[x+.48,25.1,z]],'#766849',.8);
    }
  }
  body += solids.filter(solid => /drain|collector|inlet/.test(solid.role)).map(solid => solidSvg(solid, inspection)).join('');
  if (!['drain', 'collected'].includes(inspection)) body += line(state.packets[trackedIndex].trace, '#aa9264', 1.35);
  for (const packet of state.packets) {
    const [x, y] = urbanWaterProject(packet.point);
    const focused = inspection === 'drain' ? packet.compartment === 'drain' : inspection === 'collected' ? packet.compartment === 'collected' : packet.index === trackedIndex;
    body += `<g data-urban-packet="${packet.id}" data-compartment="${packet.compartment}" data-final-destination="${packet.finalDestination}" data-position='${JSON.stringify(packet.point)}' data-model-inspection="packet-${packet.index}" data-model-inspect="packet-${packet.index}" data-specimen-key="" role="button" tabindex="0" aria-label="追踪这滴水，保留当前观察进度"><circle cx="${n(x)}" cy="${n(y)}" r="${focused ? 6 : 5.3}" fill="${packet.color}" stroke="#426e77" stroke-width="1"/>${focused ? `<circle cx="${n(x)}" cy="${n(y)}" r="8" fill="none" stroke="#b19462" stroke-width="1.5"/>` : ''}</g>`;
  }
  if (state.phase >= .3) body += text(state.selection === 2 ? '洼地暂存' : '地表余水', state.selection === 2 ? URBAN_WATER_LAYOUT.storageLabel : URBAN_WATER_LAYOUT.surfaceLabel);
  if (state.inventory.drain + state.inventory.collected > 0) body += text('排出', URBAN_WATER_LAYOUT.collectorLabel);
  URBAN_WATER_LABELS.forEach((label, selection) => {
    const [x, y] = urbanWaterProject(URBAN_WATER_LAYOUT.conditionLabels[selection]);
    body += `<g data-urban-condition="${selection}" data-model-selection="${selection}" data-keep-phase="" data-specimen-key="" role="button" tabindex="0" aria-label="切换${label}，保留当前雨程"><rect x="${n(x - 53)}" y="${n(y - 19)}" width="106" height="38" rx="2" fill="${selection === state.selection ? '#e6dfca' : '#f1ecdd'}" stroke="#9b9c83" stroke-width="${selection === state.selection ? 1.5 : .8}"/>${text(label, URBAN_WATER_LAYOUT.conditionLabels[selection], 25)}</g>`;
  });
  body += line([URBAN_WATER_LAYOUT.track.start, URBAN_WATER_LAYOUT.track.end], '#a3987b', 1.5);
  const handle: UrbanWaterPoint = [12 + state.phase * 76, -20, 76], [hx, hy] = urbanWaterProject(handle);
  body += `<path data-urban-handle="true" data-position='${JSON.stringify(handle)}' d="M${n(hx - 10)} ${n(hy)}l10-7 10 7-10 7Z" fill="#deceaa" stroke="#97805b" stroke-width="1.2"/>${drawingGrip('推拉雨水试验尺',urbanWaterProject([12,-20,76]),urbanWaterProject([88,-20,76]),state.phase)}`;
  const diagnostics = JSON.stringify({ phase: state.phase, selection: state.selection, stageIndex: state.stageIndex,
    inventory: state.inventory, packets: state.packets.map(({ id, point, compartment, finalDestination }) => ({ id, point, compartment, finalDestination })) });
  const safeInspection = ['overview', 'drain', 'collected'].includes(inspection) || /^packet-(?:[0-9]|1[01])$/.test(inspection) ? inspection : 'overview';
  return `<svg xmlns="http://www.w3.org/2000/svg" class="flat-model-svg flat-explanation-svg" viewBox="0 0 720 610" role="group" data-inspection="${safeInspection}" data-urban-phase="${state.phase}" data-urban-state='${diagnostics}' aria-label="${state.caption} 同一组有限雨水标记；水量和时间均为教学示意。"><title>城市雨水：同一场雨的去向</title><defs><pattern id="urban-gravel" width="19" height="11" patternUnits="userSpaceOnUse"><path d="M0 5 2 2 7 1 10 4 8 7 3 8ZM11 7 14 5 18 6 19 9 16 11 12 10Z" fill="#c3b9a5" stroke="#877d6c" stroke-width=".65"/></pattern><pattern id="urban-earth" width="17" height="13" patternUnits="userSpaceOnUse"><path d="m2 3 2-.4m8 5 1.6-1m-9 4 3 .6m8-9 1 .5" stroke="#5e503d" stroke-opacity=".32" stroke-width=".85"/></pattern></defs><g stroke-linejoin="round" stroke-linecap="round" font-family="FieldSerif,SimSun,serif">${body}</g></svg>`;
}

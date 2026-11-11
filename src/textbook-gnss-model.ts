/** Textbook pp.114/116: system segments, positioning, then communication
 * assisted rescue. All lengths and timing below are teaching coordinates.
 * The staged explanation is not a receiver algorithm or an actual orbit. */
export type GnssPoint = [number, number, number];
export const GNSS_REFERENCE = {
  printedPages: [114, 116], pdfPages: [119, 121], figure: '6.24',
  displayedSatellites: 4, actualConstellationCount: false, actualOrbits: false,
  positioningAlgorithm: false, solvedCoordinates: false, accuracyCalculated: false,
  passiveReceiverCanTransmitDistress: false, independentCommunicationRequired: true,
  communicationAvailableAssumed: true, eachFixRequiresThisMonitoringSequence: false,
} as const;
export const GNSS_STOPS = [
  { phase: 0, selection: 0, label: '卫星与地面' },
  { phase: .34, selection: 1, label: '接收定位' },
  { phase: .68, selection: 2, label: '定位助救援' },
] as const;
const clamp = (v: number) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
const interval = (a: number, b: number, phase: number) => clamp((phase - a) / (b - a));
const add = (a: GnssPoint, b: GnssPoint): GnssPoint => a.map((v, i) => v + b[i]) as GnssPoint;
const mul = (a: GnssPoint, k: number): GnssPoint => a.map(v => v * k) as GnssPoint;
const norm = (a: GnssPoint): GnssPoint => mul(a, 1 / (Math.hypot(...a) || 1));
const cross = (a: GnssPoint, b: GnssPoint): GnssPoint => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mix = (a: GnssPoint, b: GnssPoint, q: number): GnssPoint => a.map((v, i) => v + (b[i] - v) * q) as GnssPoint;
const EARTH: GnssPoint = [47, 28, 25];
const RADIUS = 22;
const surface = (direction: GnssPoint, radius = 22.8) => add(EARTH, mul(norm(direction), radius));

export const GNSS_LAYOUT = {
  earth: { center: EARTH, radius: RADIUS },
  satellites: [[5, 67, 65], [31, 72, 57], [63, 70, 60], [90, 62, 68]] as GnssPoint[],
  monitor: surface([-.64, .54, .55]),
  receiver: surface([.48, .44, .76]),
  rescueBase: surface([.98, .12, .10]),
  track: { start: [9, 3, 70] as GnssPoint, end: [91, 3, 70] as GnssPoint },
  labels: [
    { text: '卫星星座', position: [47, 84, 59] as GnssPoint, width: 39, selection: 0 },
    { text: '地面监控', position: [10, 44, 54] as GnssPoint, width: 39, selection: 0 },
    { text: '用户接收', position: [84, 44, 54] as GnssPoint, width: 39, selection: 1 },
    { text: '通信助援', position: [85, 16, 55] as GnssPoint, width: 39, selection: 2 },
  ],
};
export interface GnssSignal {
  id: string;
  kind: 'monitor-down' | 'monitor-up' | 'navigation' | 'communication';
  start: number;
  end: number;
  progress: number;
  status: 'waiting' | 'moving' | 'arrived';
  source: GnssPoint;
  target: GnssPoint;
  point: GnssPoint;
  path: GnssPoint[];
}
export interface GnssVehicle {
  id: 'rescue-vehicle'; progress: number; position: GnssPoint;
  forward: GnssPoint; up: GnssPoint; side: GnssPoint;
}
export interface GnssState {
  phase: number; stage: 0 | 1 | 2; stageIndex: 0 | 1 | 2; selection: 0 | 1 | 2;
  caption: string; explanation: string; signals: GnssSignal[];
  receivedSignalIds: string[]; positionReady: boolean; positionMark: number;
  communicationDelivered: boolean; rescue: GnssVehicle;
  front: GnssPoint; road: GnssPoint[];
}
function signal(id: string, kind: GnssSignal['kind'], a: number, b: number, source: GnssPoint, target: GnssPoint, phase: number): GnssSignal {
  const progress = interval(a, b, phase), point = mix(source, target, progress);
  return { id, kind, start: a, end: b, progress,
    status: phase <= a ? 'waiting' : phase < b ? 'moving' : 'arrived',
    source, target, point, path: progress > 0 ? [source, point] : [] };
}
const routeStart: GnssPoint = [.90, -.12, .42], routeEnd: GnssPoint = [.62, .35, .70];
export function gnssRoadPoint(progress: number): GnssPoint {
  return surface(mix(norm(routeStart), norm(routeEnd), clamp(progress)), 22.6);
}
export function gnssVehicle(progress: number): GnssVehicle {
  const q = clamp(progress), position = gnssRoadPoint(q), up = norm(mix(norm(routeStart), norm(routeEnd), q));
  const before = gnssRoadPoint(Math.max(0, q - .001)), after = gnssRoadPoint(Math.min(1, q + .001));
  const tangent = norm(after.map((v, i) => v - before[i]) as GnssPoint);
  const side = norm(cross(tangent, up)), forward = norm(cross(up, side));
  return { id: 'rescue-vehicle', progress: q, position, up, forward, side };
}
export function gnssVehiclePoint(vehicle: GnssVehicle, local: GnssPoint): GnssPoint {
  return add(vehicle.position, add(mul(vehicle.forward, local[0]), add(mul(vehicle.up, local[1]), mul(vehicle.side, local[2]))));
}
/** Minimum distance from the solid Earth, for the complete straight link. */
export function gnssSegmentClearance(a: GnssPoint, b: GnssPoint): number {
  const direction = b.map((v, i) => v - a[i]), lengthSq = direction.reduce((v, c) => v + c * c, 0);
  const t = lengthSq ? Math.max(0, Math.min(1, a.reduce((v, c, i) => v + (EARTH[i] - c) * direction[i], 0) / lengthSq)) : 0;
  return Math.hypot(...a.map((v, i) => v + direction[i] * t - EARTH[i])) - RADIUS;
}
export function evaluateGnss(phase: number): GnssState {
  const t = clamp(phase), stage = (t >= GNSS_STOPS[2].phase ? 2 : t >= GNSS_STOPS[1].phase ? 1 : 0) as 0 | 1 | 2;
  const stationAntenna = add(GNSS_LAYOUT.monitor, [0, 4.2, 0]), receiverAntenna = add(GNSS_LAYOUT.receiver, [0, 4.0, 0]);
  const communicationAntenna = add(GNSS_LAYOUT.receiver, [2.4, 2.8, 0]), rescueAntenna = add(GNSS_LAYOUT.rescueBase, [0, 4.2, 0]);
  const signals = [
    signal('monitor-down', 'monitor-down', .025, .14, GNSS_LAYOUT.satellites[1], stationAntenna, t),
    signal('monitor-up', 'monitor-up', .16, .29, stationAntenna, GNSS_LAYOUT.satellites[1], t),
    ...GNSS_LAYOUT.satellites.map((point, i) => signal(`nav-${i}`, 'navigation', .34 + i * .025, .48 + i * .025, point, receiverAntenna, t)),
    signal('rescue-message', 'communication', .70, .84, communicationAntenna, rescueAntenna, t),
  ];
  const positionReady = t >= .62, communicationDelivered = t >= .84;
  return {
    phase: t, stage, stageIndex: stage, selection: stage,
    caption: stage === 0 ? '地面监控联系卫星，维持系统运行。'
      : stage === 1 ? '用户接收卫星信号，获得位置信息。'
        : communicationDelivered ? '救援方依据收到的位置前往目标。' : '位置信息经独立通信设备送往救援方。',
    explanation: stage === 0 ? '空间、地面监控、用户三部分始终保留。'
      : stage === 1 ? '这里只示意信号接收，不推演定位算法。' : '定位接收与求救通信分开，通信设备须具备发送能力。',
    signals, receivedSignalIds: signals.filter(s => s.kind === 'navigation' && s.status === 'arrived').map(s => s.id),
    positionReady, positionMark: interval(.575, .62, t), communicationDelivered,
    rescue: gnssVehicle(interval(.86, 1, t)),
    front: mix(GNSS_LAYOUT.track.start, GNSS_LAYOUT.track.end, t),
    road: Array.from({ length: 33 }, (_, i) => gnssRoadPoint(i / 32)),
  };
}
/** Choosing one receiver channel changes the observation, never the navigation
 * or communication sequence. Its full dashed guide is not a received signal. */
export function evaluateGnssInspection(phase: number, target = 'overview') {
  const inspection = /^sat-[0-3]$/.test(target) ? target : 'overview', index = inspection === 'overview' ? -1 : Number(inspection.slice(-1));
  const state = evaluateGnss(phase), signal = index < 0 ? null : state.signals.find(item => item.id === `nav-${index}`)!;
  return { inspection, phase: state.phase, satellite: index, signal,
    received: signal?.status === 'arrived', lineOfSight: signal ? gnssSegmentClearance(signal.source, signal.target) >= 0 : null,
    fullGuideIsNotReceivedSignal: true, direction: 'satellite-to-passive-receiver', changesPositionSolution: false };
}

/** An orthographic front view. SVG and the 3D scene use the same coordinates. */
export function gnssProject([x, y, z]: GnssPoint): [number, number] {
  const yaw = .16, pitch = .20, k = 5.6;
  return [350 + ((x - 47) * Math.cos(yaw) - (z - 25) * Math.sin(yaw)) * k,
    335 - (y - 28) * Math.cos(pitch) * k + ((x - 47) * Math.sin(yaw) + (z - 25) * Math.cos(yaw)) * Math.sin(pitch) * k];
}
export function gnssGlobeLines(): GnssPoint[][] {
  const p = (lat: number, lon: number): GnssPoint => add(EARTH, [Math.cos(lat) * Math.sin(lon) * 22.06, Math.sin(lat) * 22.06, Math.cos(lat) * Math.cos(lon) * 22.06]);
  return [
    ...[-60, -30, 0, 30, 60].map(lon => Array.from({ length: 33 }, (_, i) => p((-90 + i * 180 / 32) * Math.PI / 180, lon * Math.PI / 180))),
    ...[-45, 0, 45].map(lat => Array.from({ length: 41 }, (_, i) => p(lat * Math.PI / 180, (-90 + i * 180 / 40) * Math.PI / 180))),
  ];
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const P = { ink: '#494c43', paper: '#f7f1e3', sea: '#acc5c6', blue: '#648e99', green: '#869780', warm: '#b38152' };
const projectedPath = (points: GnssPoint[]) => points.map((p, i) => `${i ? 'L' : 'M'}${gnssProject(p).join(',')}`).join('');
function svgBox(center: GnssPoint, size: GnssPoint, color: string, pose?: GnssVehicle): string {
  const corners = [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => {
    const local: GnssPoint = [center[0] + x * size[0] / 2, center[1] + y * size[1] / 2, center[2] + z * size[2] / 2];
    return pose ? gnssVehiclePoint(pose, local) : local;
  })));
  return [[1, 5, 7, 3], [2, 3, 7, 6], [4, 6, 7, 5]].map((face, i) => `<path d="${projectedPath(face.map(j => corners[j]))}Z" fill="${color}" fill-opacity="${[1, .92, .77][i]}" stroke="${P.ink}" stroke-width="1.1"/>`).join('');
}
const action = (selection: number, label: string) => `data-model-selection="${selection}" role="button" tabindex="0" aria-label="${esc(label)}"`;
export function gnssSvg(phase: number, _selection?: number, target = 'overview'): string {
  const state = evaluateGnss(phase), observation = evaluateGnssInspection(phase, target), [cx, cy] = gnssProject(EARTH);
  let body = `<circle cx="${cx}" cy="${cy}" r="${RADIUS * 5.6}" fill="${P.sea}" stroke="${P.ink}" stroke-width="1.6"/>`;
  body += gnssGlobeLines().map(points => `<path d="${projectedPath(points)}" fill="none" stroke="#748e8e" stroke-width=".85"/>`).join('');
  body += `<path d="${projectedPath(state.road)}" fill="none" stroke="#f0e8d8" stroke-width="8"/><path d="${projectedPath(state.road)}" fill="none" stroke="#938c74" stroke-width="1.1" stroke-dasharray="4 6"/>`;
  if (observation.signal) body += `<path data-gnss-observed-link="${observation.signal.id}" d="${projectedPath([observation.signal.source, observation.signal.target])}" fill="none" stroke="#9e9279" stroke-width="1.4" stroke-dasharray="4 5"/>`;
  for (const signal of state.signals) {
    const color = signal.kind === 'communication' ? P.warm : signal.kind === 'navigation' ? P.blue : P.green;
    if (signal.path.length) body += `<path data-gnss-link="${signal.id}" d="${projectedPath(signal.path)}" fill="none" stroke="${color}" stroke-width="${observation.signal?.id === signal.id ? 3.6 : signal.kind === 'communication' ? 2.8 : 1.7}" opacity="${observation.signal && observation.signal.id !== signal.id ? .27 : 1}"/>`;
    if (signal.status === 'moving') { const [x, y] = gnssProject(signal.point); body += `<circle data-gnss-tracer="${signal.id}" cx="${x}" cy="${y}" r="4" fill="${color}" stroke="${P.paper}" stroke-width="1"/>`; }
  }
  GNSS_LAYOUT.satellites.forEach((point, i) => {
    body += `<g data-gnss-satellite="${i}" data-model-inspection="sat-${i}" data-model-inspection-toggle="overview" role="button" tabindex="0" aria-label="独立查看卫星${i + 1}到用户的接收链路，保持过程时刻" aria-pressed="${observation.satellite === i}">`
      + svgBox(add(point, [-5.3, 0, 0]), [6, .6, 3.5], P.blue) + svgBox(add(point, [5.3, 0, 0]), [6, .6, 3.5], P.blue)
      + svgBox(point, [3.3, 3.2, 3.2], P.paper) + '</g>';
  });
  const control = GNSS_LAYOUT.monitor, receiver = GNSS_LAYOUT.receiver, rescue = GNSS_LAYOUT.rescueBase;
  body += `<g ${action(0, '查看地面监控部分')}>${svgBox(add(control, [0, 1.1, 0]), [5, 2.2, 4], '#ddd3bc')}`
    + `<path d="${projectedPath([add(control, [0, 2, 0]), add(control, [0, 4.2, 0])])}" fill="none" stroke="${P.ink}" stroke-width="2"/></g>`;
  body += `<g ${action(1, '查看用户接收与定位')}>${svgBox(add(receiver, [0, 1.4, 0]), [2.5, 2.8, 1.5], P.paper)}${svgBox(add(receiver, [0, 1.7, .8]), [1.6, 1.3, .1], P.blue)}`
    + `<path d="${projectedPath([add(receiver, [0, 2.5, 0]), add(receiver, [0, 4, 0])])}" stroke="${P.ink}" stroke-width="2"/></g>`;
  body += `<g ${action(2, '查看定位信息通过独立通信设备助救援')}>`
    + svgBox(add(receiver, [2.4, 1.4, 0]), [1.4, 2.7, 1], P.warm)
    + svgBox(add(rescue, [0, 1.1, 0]), [4, 2.2, 3], '#d8c4a5') + '</g>';
  body += `<g data-gnss-vehicle="rescue-vehicle" ${action(2, '查看收到位置后的救援行动')}>`
    + svgBox([0, 1, 0], [4, 1.5, 2.4], P.warm, state.rescue)
    + svgBox([-.35, 2.05, 0], [1.8, 1, 2.1], P.paper, state.rescue) + '</g>';
  if (state.positionMark > 0) {
    const at = add(receiver, [0, 5.2 + state.positionMark * 2.5, 0]), [x, y] = gnssProject(at);
    body += `<path data-gnss-position="known" d="M${x},${y + 7}l-6-10a7 7 0 1 1 12 0Z" fill="${P.warm}" stroke="${P.ink}" stroke-width="1"/>`;
  }
  for (const label of GNSS_LAYOUT.labels) {
    const [x, y] = gnssProject(label.position), selected = label.selection === state.selection;
    body += `<g data-gnss-node="${label.selection}" ${action(label.selection, GNSS_STOPS[label.selection].label)}><rect x="${x - 84}" y="${y - 23}" width="168" height="46" rx="2" fill="${P.paper}" stroke="${selected ? '#8b997b' : '#bdb298'}" stroke-width="${selected ? 1.8 : .7}"/><text x="${x}" y="${y + 9}" text-anchor="middle" font-size="27" fill="${P.ink}" font-family="FieldSerif,SimSun,serif">${label.text}</text></g>`;
  }
  const [fx, fy] = gnssProject(state.front);
  body += `<path d="${projectedPath([GNSS_LAYOUT.track.start, GNSS_LAYOUT.track.end])}" fill="none" stroke="#c5b89a" stroke-width="3"/>`
    + `<path d="${projectedPath([GNSS_LAYOUT.track.start, state.front])}" fill="none" stroke="${P.warm}" stroke-width="4"/>`
    + `<circle data-gnss-process-front="true" cx="${fx}" cy="${fy}" r="6" fill="${P.warm}" stroke="${P.paper}" stroke-width="2"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="flat-model-svg flat-explanation-svg" viewBox="0 0 720 550" role="group" data-inspection="${observation.inspection}" data-gnss-observation='${JSON.stringify(observation)}' aria-label="全球卫星导航系统三部分与通信助救援的连续示意"><title>${esc(state.caption)} 定位接收与求救通信分开；卫星数量、距离和时间为示意。虚线是所选链路的固定观察线，不表示信号已经抵达。</title><g data-gnss-phase="${state.phase}" data-gnss-stage="${state.stage}" data-gnss-selection="${state.selection}" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
}

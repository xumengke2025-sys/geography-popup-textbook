/** Textbook pp.107,111 / PDF pp.112,116. All positions and rates below are
 * teaching parameters. The phase is seekable; it is not a number of seconds. */
export type QuakePoint = readonly [number, number, number];
export const QUAKE_LAYOUT = {
  source: [36, 4, 0] as QuakePoint,
  epicenter: [36, 15.2, 0] as QuakePoint,
  station: [51, 15.2, 0] as QuakePoint,
  far: [80, 15.2, 0] as QuakePoint,
  near: [40, 15.2, 0] as QuakePoint,
  surface: 15.2,
} as const;
export const QUAKE_PARAMETERS = {
  event: .08, pSpeed: 120, sSpeed: 65, communicationSpeed: 700, processingDelay: .065,
} as const;
const clamp = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
const distance = (a: QuakePoint, b: QuakePoint) => Math.hypot(...a.map((v, i) => v - b[i]));

export function evaluateQuake(input: number, selection = 0) {
  const phase = clamp(input), view = selection >= 2 ? 'near' : selection >= 1 ? 'warning' : 'structure';
  const targetId = view === 'near' ? 'near' : 'far', target = QUAKE_LAYOUT[targetId];
  const k = QUAKE_PARAMETERS, origin = QUAKE_LAYOUT.source;
  const stationP = k.event + distance(origin, QUAKE_LAYOUT.station) / k.pSpeed;
  const dispatch = stationP + k.processingDelay;
  const warningArrival = dispatch + distance(QUAKE_LAYOUT.station, target) / k.communicationSpeed;
  const targetP = k.event + distance(origin, target) / k.pSpeed;
  const targetS = k.event + distance(origin, target) / k.sSpeed;
  const occurred = phase >= k.event, detected = phase >= stationP, sent = phase >= dispatch;
  const alerted = phase >= warningArrival, pArrived = phase >= targetP, sArrived = phase >= targetS;
  const hasLead = warningArrival < targetS, commProgress = clamp((phase - dispatch) / (warningArrival - dispatch));
  const shakeProgress = clamp((phase - targetS) / .14);
  const shake = sArrived ? Math.sin(shakeProgress * Math.PI * 10) * Math.sin(shakeProgress * Math.PI) * .62 : 0;
  const stage = !occurred ? 'ready' : phase >= Math.max(targetS + .14, warningArrival) ? 'result'
    : !hasLead && sArrived ? 'near-hit' : sArrived ? 'shaking' : alerted ? 'lead'
      : sent ? 'transmitting' : detected ? 'detected' : 'waves';
  const caption = view === 'structure' ? '震源与震中' : stage === 'ready' ? '等待开始'
    : stage === 'waves' ? '地震发生' : stage === 'detected' ? 'P波抵站'
      : stage === 'transmitting' ? '发送信号' : stage === 'lead' ? '信号先到'
        : stage === 'shaking' ? 'S波到达' : stage === 'near-hit' ? '震动先到'
          : hasLead ? '获得提前量' : '无提前量';
  return {
    phase, view, targetId, target, source: origin, station: QUAKE_LAYOUT.station,
    occurred, detected, sent, alerted, pArrived, sArrived, hasLead, commProgress, shake, stage, caption,
    pRadius: Math.max(0, phase - k.event) * k.pSpeed,
    sRadius: Math.max(0, phase - k.event) * k.sSpeed,
    events: { earthquake: k.event, stationP, dispatch, warningArrival, targetP, targetS },
    simulationOnly: true, prequakePrediction: false,
  } as const;
}
export type QuakeState = ReturnType<typeof evaluateQuake>;

/** Native SVG fallback. It shares event times, geometry and warning status with
 * the raised 3-D model; the textbook bitmap is not used to produce this scene. */
export function quakeSvg(phase: number, selection = 0): string {
  const s = evaluateQuake(phase, selection), warning = s.view !== 'structure';
  const point = ([x, y, z]: QuakePoint): [number, number] => [60 + (x - 7) * 6.5 - z * 1.8, 310 - y * 5.1 + z * 1.4];
  const xy = (p: QuakePoint) => point(p).map(n => n.toFixed(2)).join(',');
  const [sx, sy] = point(s.source), [ex, ey] = point(QUAKE_LAYOUT.epicenter);
  const [mx, my] = point(s.station), [tx, ty] = point(s.target);
  const txt = (x: number, y: number, text: string, size = 21) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}">${text}</text>`;
  const top: QuakePoint[] = [[7, 15.2, 0], [92, 15.2, 0], [92, 15.2, -28], [7, 15.2, -28]];
  const front = [7, 92].map(x => point([x, 15.2, 0])[0]);
  const waves = (radius: number, color: string, dashed: boolean) => {
    if (!s.occurred || radius <= 0) return '';
    const surfaceRadius = Math.sqrt(Math.max(0, radius ** 2 - (QUAKE_LAYOUT.surface - s.source[1]) ** 2));
    const arc: QuakePoint[] = Array.from({ length: 97 }, (_, i) => {
      const a = Math.PI * i / 96;
      return [s.source[0] + Math.cos(a) * surfaceRadius, QUAKE_LAYOUT.surface + .1, -Math.sin(a) * surfaceRadius];
    });
    const style = `fill="none" stroke="${color}" stroke-width="${dashed ? 2.4 : 3}"${dashed ? ' stroke-dasharray="6 5"' : ''}`;
    return `<g data-wave="${dashed ? 'P' : 'S'}"><ellipse cx="${sx}" cy="${sy}" rx="${radius * 6.5}" ry="${radius * 5.1}" ${style} clip-path="url(#quake-front-clip)"/>${surfaceRadius > 0 ? `<polyline points="${arc.map(xy).join(' ')}" ${style} clip-path="url(#quake-top-clip)"/>` : ''}</g>`;
  };
  const house = (x: number, y: number, dx = 0) => `<g transform="translate(${x + dx} ${y})"><path d="M-16 0V-25H16V0Z" fill="#faf5e8" stroke="#53605a"/><path d="M-21-25 0-39 21-25Z" fill="#bba88f" stroke="#53605a"/><path d="M-4 0V-16H5V0" fill="#77959a" stroke="#53605a"/></g>`;
  const structure = `<path d="M${sx} ${sy}V${ey}" stroke="#b05c4d" stroke-width="1.8"/>${txt(sx - 56, sy + 24, '震源')}${txt(ex + 35, ey - 12, '震中')}${txt(sx - 90, (sy + ey) / 2, '震源深度', 18)}`;
  const communication = warning && s.sent ? (() => {
    const arc = (q: number): [number, number] => [mx + (tx - mx) * q, my - 46 * Math.sin(q * Math.PI) - 28];
    const points = Array.from({ length: 33 }, (_, i) => arc(s.commProgress * i / 32));
    const end = points.at(-1)!;
    return `<g data-communication="${s.alerted ? 'arrived' : 'in-flight'}"><path d="M${mx} ${my - 28}Q${(mx + tx) / 2} ${my - 120} ${tx} ${ty - 28}" stroke="#b6a484" stroke-dasharray="3 6" fill="none"/><polyline points="${points.map(p => p.join(',')).join(' ')}" stroke="#9e7c47" stroke-width="2.8" fill="none"/><path d="M${end[0] - 4} ${end[1] - 4}h8v8h-8Z" fill="#9e7c47"/></g>`;
  })() : '';
  return `<svg class="flat-model-svg flat-explanation-svg" viewBox="0 0 720 425" role="img" aria-label="${s.caption}；震后预警不是震前预测，内部参数为示意" data-quake-view="${s.view}" data-quake-stage="${s.stage}" data-quake-phase="${s.phase}" data-quake-detected="${s.detected}" data-quake-alerted="${s.alerted}" data-quake-s-arrived="${s.sArrived}">
    <defs><clipPath id="quake-front-clip"><rect x="${front[0]}" y="${ey}" width="${front[1] - front[0]}" height="${310 - ey}"/></clipPath><clipPath id="quake-top-clip"><polygon points="${top.map(xy).join(' ')}"/></clipPath></defs>
    <g fill="#303a40" font-family="FieldSerif,SimSun,serif" stroke-linejoin="round">
      <path d="M60 ${ey}H612V310H60Z" fill="#aa715c" stroke="#6e7066"/>
      <path d="M60 ${310 - 10 * 5.1}H612V${310 - 5 * 5.1}H60Z" fill="#9b8580"/>
      <path d="M60 ${ey}H612V${310 - 10 * 5.1}H60Z" fill="#baa08a"/>
      <polygon points="${top.map(xy).join(' ')}" fill="#b5b99e" stroke="#6b7665"/>
      ${waves(s.pRadius, '#4d8293', true)}${waves(s.sRadius, '#ad6654', false)}
      <circle cx="${sx}" cy="${sy}" r="5" fill="#a85b48"/>
      ${!warning ? structure : `${!s.detected ? txt(sx - 26, sy + 24, '震源', 20) : ''}<g data-station="${s.detected ? 'detected' : 'waiting'}"><path d="M${mx} ${my}v54" stroke="#65706b" stroke-width="3"/><rect x="${mx - 10}" y="${my - 30}" width="20" height="29" fill="${s.detected ? '#d3ba81' : '#f2eedf'}" stroke="#53605a"/><path d="M${mx - 7} ${my - 17}h4l3-6 4 12 3-6" fill="none" stroke="#53605a"/>${txt(mx, my + 83, '监测站', 19)}</g>`}
      ${house(tx - 20, ty, warning ? s.shake * 6.5 : 0)}${house(tx + 20, ty, warning ? s.shake * 6.5 : 0)}
      ${warning ? communication + txt(tx, ty + 30, s.targetId === 'near' ? '近处聚落' : '远处聚落', 20) : ''}
      ${warning && s.occurred ? `<g font-size="18"><path d="M55 44H88" stroke="#4d8293" stroke-width="2.5" stroke-dasharray="5 4"/>${txt(139, 50, 'P波', 19)}<path d="M223 44H256" stroke="#ad6654" stroke-width="3"/>${txt(307, 50, 'S波', 19)}</g>` : ''}
      ${warning ? txt(360, 395, s.caption, 22) : ''}
    </g></svg>`;
}

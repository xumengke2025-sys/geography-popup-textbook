import { surveyRailDrawing } from './textbook-survey-rail-drawing';
/** Textbook p.114 / PDF p.119 / fig.6.21, verified against the local page.
 * This is the passive optical example in that drawing: sunlight reaches a
 * ground target and reflected light reaches the sensor. The twelve tiles are
 * a finite teaching sample, not measured spectral values, detected land-cover
 * classes or a disaster forecast. Information may be copied and retained. */
export const REMOTE_PROCESS_REFERENCE = Object.freeze({
  printedPage: 114, pdfPage: 119, figure: '6.21',
  title: '卫星遥感技术原理示意', source: 'textbook/page-119.webp',
  example: 'passive-optical', activeRadarAlsoExists: true,
  sampleValuesAreMeasured: false, automaticRecognition: false, disasterPrediction: false,
  phaseMeansElapsedTime: false,
});

export const REMOTE_PROCESS_STOPS = [
  { label: '获取信息', phase: .22 },
  { label: '传输信息', phase: .45 },
  { label: '处理分析', phase: .69 },
  { label: '输出成果', phase: 1 },
] as const;

/** Logical scene coordinates: X right, Y up, Z towards the reader. Both
 * renderers use these exact sample positions and packet paths. */
export type RemotePoint = [number, number, number];
export type RemoteStage = 'observing' | 'acquiring' | 'transmitting' | 'processing' | 'outputting' | 'complete';
export const REMOTE_SAMPLE_COUNT = 12;
export const REMOTE_TONES = ['#8fa38d', '#bcc2a3', '#b2a88e', '#a8c4c7'] as const;
export const REMOTE_LAYOUT = {
  sun: [5, 61, 29] as RemotePoint,
  target: [17, 3, 35] as RemotePoint,
  sensor: [31, 50, 16] as RemotePoint,
  downlink: [35, 52, 13] as RemotePoint,
  dish: [48, 18, 38] as RemotePoint,
  receiver: [48, 10, 48] as RemotePoint,
  processor: [69, 17, 44] as RemotePoint,
  result: [89, 17, 52] as RemotePoint,
  trackStart: [12, 3, 65] as RemotePoint,
  trackEnd: [91, 3, 65] as RemotePoint,
} as const;

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const smooth = (start: number, end: number, phase: number) => {
  const q = clamp((phase - start) / (end - start)); return q * q * (3 - 2 * q);
};
const lerp = (a: RemotePoint, b: RemotePoint, t: number): RemotePoint =>
  a.map((value, i) => value + (b[i] - value) * t) as RemotePoint;

/** The fixed pattern has no hidden classifier. Processing simply puts these
 * already-known sample positions in their proper image order. */
export const REMOTE_SAMPLES = Array.from({ length: REMOTE_SAMPLE_COUNT }, (_, id) => {
  const column = id % 4, row = Math.floor(id / 4), tone = [0, 1, 1, 2, 0, 0, 1, 3, 1, 0, 3, 3][id];
  const receiveSlot = id * 5 % REMOTE_SAMPLE_COUNT;
  return Object.freeze({ id: `sample-${id}`, index: id, column, row, tone,
    color: REMOTE_TONES[tone],
    source: [9 + column * 5.1, 2.6, 30 + row * 5.1] as RemotePoint,
    sensor: [28.3 + column * 1.8, 56 - row * 1.8, 16.2] as RemotePoint,
    received: [44.7 + receiveSlot % 4 * 1.8, 11.4 - Math.floor(receiveSlot / 4) * 1.8, 48.4] as RemotePoint,
    processed: [66 + column * 2, 18.8 - row * 2, 44.5] as RemotePoint,
    result: [84.5 + column * 2.65, 19.2 - row * 2.65, 52.2] as RemotePoint,
    captureStart: .025 + id * .008, captureEnd: .115 + id * .008,
    transmissionStart: .245 + id * .006, transmissionEnd: .355 + id * .006,
    processingStart: .475 + id * .007, processingEnd: .575 + id * .007,
    outputStart: .715 + id * .009, outputEnd: .820 + id * .009,
  });
});

export interface RemoteJourney { progress: number; active: boolean; point: RemotePoint; path: RemotePoint[]; }

/** A polyline is traversed by distance, rather than assigning one equal time
 * interval to every corner. Seeking backwards returns the same point. */
function journey(phase: number, start: number, end: number, path: RemotePoint[]): RemoteJourney {
  const progress = smooth(start, end, phase), lengths = path.slice(1).map((p, i) => Math.hypot(...p.map((v, j) => v - path[i][j])));
  if (progress === 0 || progress === 1) return { progress, active: phase >= start && phase < end,
    point: [...(progress === 0 ? path[0] : path.at(-1)!)] as RemotePoint, path };
  let remaining = progress * lengths.reduce((sum, v) => sum + v, 0), point = path.at(-1)!;
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      point = lerp(path[i], path[i + 1], lengths[i] ? clamp(remaining / lengths[i]) : 1); break;
    }
    remaining -= lengths[i];
  }
  return { progress, active: phase >= start && phase < end, point, path };
}

export function evaluateRemoteSensing(input: number) {
  const phase = clamp(input);
  const samples = REMOTE_SAMPLES.map(sample => {
    const acquisition = journey(phase, sample.captureStart, sample.captureEnd,
      [sample.source, [22 + sample.column * 1.2, 27 + sample.row, 25], REMOTE_LAYOUT.sensor, sample.sensor]);
    const transmission = journey(phase, sample.transmissionStart, sample.transmissionEnd,
      [sample.sensor, REMOTE_LAYOUT.downlink, REMOTE_LAYOUT.dish, sample.received]);
    const processingTransfer = journey(phase, sample.processingStart, sample.processingEnd,
      [sample.received, [58, 9 + sample.row, 47], sample.processed]);
    const outputTransfer = journey(phase, sample.outputStart, sample.outputEnd,
      [sample.processed, [79, 16 + sample.row, 49], sample.result]);
    return { id: sample.id, index: sample.index, column: sample.column, row: sample.row, tone: sample.tone, color: sample.color,
      source: sample.source, sensor: sample.sensor, receiver: sample.received, processor: sample.processed, result: sample.result,
      captured: phase >= sample.captureEnd, received: phase >= sample.transmissionEnd,
      processed: phase >= sample.processingEnd, output: phase >= sample.outputEnd,
      acquisition, transmission, processingTransfer, outputTransfer };
  });
  const counts = { captured: samples.filter(s => s.captured).length, received: samples.filter(s => s.received).length,
    processed: samples.filter(s => s.processed).length, output: samples.filter(s => s.output).length };
  const stage: RemoteStage = phase < .025 ? 'observing' : phase < .235 ? 'acquiring'
    : phase < .47 ? 'transmitting' : phase < .71 ? 'processing' : phase < .93 ? 'outputting' : 'complete';
  const caption = {
    observing: '太阳照亮地物。', acquiring: '地物反射的光进入传感器。',
    transmitting: '获取的信息传回地面。', processing: '按空间位置整理、拼接样本。',
    outputting: '整理后的样本组成影像。', complete: '保留示意影像，供进一步解译。',
  }[stage];
  return { phase, stage, caption, selection: stage === 'observing' || stage === 'acquiring' ? 0 : stage === 'transmitting' ? 1 : stage === 'processing' ? 2 : 3,
    illumination: smooth(0, .025, phase), samples, sampleCount: REMOTE_SAMPLE_COUNT, counts,
    processing: { started: phase >= .475, progress: smooth(.475, .652, phase), complete: counts.processed === REMOTE_SAMPLE_COUNT,
      operation: 'restore-known-spatial-order' as const, identifiesLandCover: false },
    output: { started: phase >= .715, progress: smooth(.715, .919, phase), complete: counts.output === REMOTE_SAMPLE_COUNT, sampleCount: counts.output },
    sensorIlluminatesTarget: false, retainedInformationCopies: true, measuredSamples: false, predictsDisasters: false,
  };
}
export type RemoteSensingState = ReturnType<typeof evaluateRemoteSensing>;

export function remoteProject([x, y, z]: RemotePoint): [number, number] {
  return [52 + x * 5.6 + (z - 36) * .65, 331 - y * 4.5 + (z - 36) * .8];
}
const n = (value: number) => Number(value.toFixed(3));
const xy = (p: RemotePoint) => remoteProject(p).map(n).join(',');
const path = (points: RemotePoint[], color = '#737e73', width = 1) =>
  `<polyline points="${points.map(xy).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;

function svgBox(center: RemotePoint, size: RemotePoint, color: string) {
  const [x, y, z] = center, [w, h, d] = size;
  const v = (a: number, b: number, c: number): RemotePoint => [x + a * w / 2, y + b * h / 2, z + c * d / 2];
  const poly = (points: RemotePoint[], fill: string, opacity = 1) => `<polygon points="${points.map(xy).join(' ')}" fill="${fill}" fill-opacity="${opacity}" stroke="#606b61" stroke-width=".85"/>`;
  return poly([v(-1, 1, -1), v(1, 1, -1), v(1, 1, 1), v(-1, 1, 1)], color)
    + poly([v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), v(1, -1, 1)], '#7d887b', .8)
    + poly([v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)], color);
}
const svgLabel = (value: string, at: RemotePoint) => {
  const [x, y] = remoteProject(at); return `<text x="${n(x)}" y="${n(y)}" text-anchor="middle" font-size="23" fill="#303a40" paint-order="stroke" stroke="#efe1bd" stroke-width="4">${value}</text>`;
};
const svgNode = (selection: number, body: string) => `<g data-model-selection="${selection}" data-remote-node="${selection}" role="button" tabindex="0" aria-label="查看${REMOTE_PROCESS_STOPS[selection].label}" style="cursor:pointer">${body}</g>`;

/** No bitmap or invented classification is used. Every retained tile and
 * moving information token reads the same sample identity as the 3-D model. */
export function remoteSensingSvg(phase: number): string {
  const s = evaluateRemoteSensing(phase);
  const cells = (kind: 'sensor' | 'receiver' | 'processor' | 'result', visible: 'captured' | 'received' | 'processed' | 'output', size: number) =>
    s.samples.filter(sample => sample[visible]).map(sample => `<g data-remote-copy="${visible}" data-sample-id="${sample.id}" data-tone="${sample.tone}">${svgBox(sample[kind], [size, size, .35], sample.color)}</g>`).join('');
  let body = svgBox([50,-1.55,35],[99,3.1,58],'#6a4d36')+svgBox([50,.12,35],[98.3,.42,57.2],'#9e824e')
    +svgBox([50,.49,35],[97.5,.46,56.3],'#536356');
  for(const [x,z,y] of [[31,6.4,54],[6,13.5,58]]){
    body+=path([[x,1,z],[x,y,z]],'#654d33',7)+path([[x,1,z],[x,y,z]],'#b09b67',3.5);
  }
  body+=path([[31,54,6.4],[31,54,12]],'#ab9059',5)+path([[6,58,13.5],[5,61,18],[5,61,29]],'#96794c',4);
  body+=svgBox([18.5,1.3,33.4],[32,1.4,27.5],'#9b9569');
  const [sunX, sunY] = remoteProject(REMOTE_LAYOUT.sun);
  body += `<g fill="#cfb27a" stroke="#aa925f"><circle cx="${n(sunX)}" cy="${n(sunY)}" r="12"/>${Array.from({ length: 8 }, (_, i) => {
    const a = i * Math.PI / 4; return `<path d="M${n(sunX + Math.cos(a) * 17)} ${n(sunY + Math.sin(a) * 17)}l${n(Math.cos(a) * 6)} ${n(Math.sin(a) * 6)}"/>`;
  }).join('')}</g>`;
  if (s.illumination > 0) body += path([REMOTE_LAYOUT.sun, REMOTE_LAYOUT.target], '#b49663', 1.15);
  let acquisition = s.samples.map(sample => `<g data-remote-sample="${sample.id}" data-tone="${sample.tone}">${svgBox(sample.source, [4.7, .5, 4.7], sample.color)}</g>`).join('');
  // A few physical trees make the observed patch readable as a ground target.
  for (const [x, z, h] of [[7, 26, 9], [25, 27, 12], [30, 38, 8]]) {
    const [tx, ty] = remoteProject([x, 2, z]), [topX, topY] = remoteProject([x, h + 2, z]);
    acquisition += `<path d="M${n(tx)} ${n(ty)}V${n(topY)}" stroke="#7b7963" stroke-width="2"/><path d="M${n(topX - 10)} ${n(topY + 27)} ${n(topX)} ${n(topY)} ${n(topX + 10)} ${n(topY + 27)}Z" fill="#94a18b" stroke="#63735f"/>`;
  }
  for (const x of [20, 42]) {
    acquisition += svgBox([x, 54.5, 12], [12, .8, 9], '#41606b');
    for (let i = 0; i < 4; i++) acquisition += path([[x - 4.5 + i * 3, 55, 7.5], [x - 4.5 + i * 3, 55, 16.5]], '#647f80', .65);
  }
  acquisition += svgBox([31, 54, 12], [8.5, 7, 6], '#62755e') + svgBox([31, 49.8, 15], [4.2, 2.4, 4], '#6c817d');
  acquisition += cells('sensor', 'captured', 1.52) + svgLabel('获取', [23, 3, 61]);
  body += svgNode(0, acquisition);
  const [dx, dy] = remoteProject(REMOTE_LAYOUT.dish);
  body += svgNode(1, svgBox([48, 5, 43], [12, 8, 10], '#a1845e')
    + svgBox([48, 9.6, 48], [9, 7, .5], '#d3d7c8')
    + path([[48, 9, 38], REMOTE_LAYOUT.dish], '#6f786c', 3)
    + `<ellipse cx="${n(dx)}" cy="${n(dy)}" rx="21" ry="9" fill="#e8e6d8" stroke="#677466" stroke-width="1.2" transform="rotate(-25 ${n(dx)} ${n(dy)})"/>`
    + path([[45, 18, 38], [49, 23, 35], [51, 17, 38]], '#677466', 1.2)
    + cells('receiver', 'received', 1.52) + svgLabel('传输', [48, 3, 61]));
  body += svgNode(2, svgBox([69, 12, 40], [14, 20, 7], '#9a7655')
    + svgBox([69, 16.6, 44.1], [10.2, 7.3, .4], '#c6cec2')
    + svgBox([69, 2, 49], [14, 1, 5], '#c6bba6')
    + cells('processor', 'processed', 1.72) + svgLabel('处理', [70, 3, 61]));
  body += svgNode(3, svgBox([89, 15.8, 51.6], [15.5, 14, .6], '#f4efdf')
    + path([[94.5, 22.8, 52], [96.8, 20.4, 52], [94.5, 20.4, 52], [94.5, 22.8, 52]], '#8c8d78', .9)
    + cells('result', 'output', 2.35) + svgLabel('成果', [91, 3, 61]));
  if (s.phase >= .025) body += path([REMOTE_LAYOUT.target, REMOTE_LAYOUT.sensor], '#b5a279', .7);
  if (s.phase >= .245) body += path([REMOTE_LAYOUT.downlink, REMOTE_LAYOUT.dish, REMOTE_LAYOUT.receiver], '#8aacae', .85);
  if (s.phase >= .475) body += path([REMOTE_LAYOUT.receiver, [58, 9, 47], REMOTE_LAYOUT.processor], '#8aacae', .85);
  if (s.phase >= .715) body += path([REMOTE_LAYOUT.processor, [79, 17, 49], REMOTE_LAYOUT.result], '#8aacae', .85);
  for (const sample of s.samples) for (const kind of ['acquisition', 'transmission', 'processingTransfer', 'outputTransfer'] as const) {
    const packet = sample[kind];
    if (packet.active) body += `<g data-remote-packet="${kind}" data-sample-id="${sample.id}" data-progress="${n(packet.progress)}">${svgBox(packet.point, [1.15, 1.15, .7], kind === 'acquisition' ? '#ba9b66' : sample.color)}</g>`;
  }
  body+=surveyRailDrawing(remoteProject(REMOTE_LAYOUT.trackStart),remoteProject(REMOTE_LAYOUT.trackEnd),s.phase,
    REMOTE_LAYOUT.trackEnd[0]-REMOTE_LAYOUT.trackStart[0],'移动遥感记录头','data-remote-handle="true"');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="flat-model-svg flat-explanation-svg" viewBox="0 0 710 420" role="group" data-remote-phase="${n(s.phase)}" data-remote-stage="${s.stage}" data-remote-captured="${s.counts.captured}" data-remote-received="${s.counts.received}" data-remote-processed="${s.counts.processed}" data-remote-output="${s.counts.output}" aria-label="${s.caption} 被动光学遥感示例，十二个样本为教学设定，不作自动识别或灾害预报。"><title>卫星遥感信息链</title><g stroke-linejoin="round" stroke-linecap="round" font-family="FieldSerif,SimSun,serif">${body}</g></svg>`;
}
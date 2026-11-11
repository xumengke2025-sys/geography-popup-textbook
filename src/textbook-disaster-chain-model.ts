/** Two selected, conditional chains from textbook pp.108–109 and 115.
 * The phase is an explanatory sequence, not elapsed time or a forecast.
 * No water-flow, slope-failure or aquifer equation is numerically solved. */
const clamp = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
const smooth = (a: number, b: number, n: number) => {
  const q = clamp((n - a) / (b - a)); return q * q * (3 - 2 * q);
};

export const DISASTER_CHAIN_LAYOUT = {
  landLeft: 6, coast: 72, seaRight: 97, bedrock: 4,
  capBase: 20.5, originalSurface: 26.5, seaLevel: 19.4, wellX: 44,
  riverY: 3.65, riverZ: 35, damX: 55, valleyBase: 2.8, bankSlope: .035,
} as const;

export const DISASTER_CHAIN_CONDITIONS = {
  drought: ['选定沿海、松软沉积层情景', '淡水不足后加抽地下水', '含水层与海水连通；海面保持稳定'],
  earthquake: ['选定松散陡坡临河情景', '滑坡堵塞河道且上游持续来水', '选定堰塞体出现溃口；并非每次地震都会如此'],
} as const;

export function evaluateDisasterChain(input: number, selection = 0) {
  const phase = clamp(input), branch = selection === 1 ? 'earthquake' : 'drought';
  const dp = branch === 'drought' ? phase : 0, ep = branch === 'earthquake' ? phase : 0;
  const deficit = smooth(.04, .30, dp), extraction = smooth(.22, .58, dp);
  const subsidence = 2.6 * smooth(.45, .76, dp), intrusion = smooth(.67, .96, dp);
  const slide = smooth(.20, .44, ep), blockage = smooth(.38, .50, ep);
  const accumulation = smooth(.51, .74, ep), breach = smooth(.79, .94, ep);
  const flood = smooth(.84, 1, ep), lake = accumulation * (1 - .65 * breach);
  const shakeEnvelope = smooth(.075, .105, ep) * (1 - smooth(.15, .20, ep));
  const droughtStage = dp < .08 ? 'coastal' : dp < .25 ? 'shortage' : dp < .48 ? 'pumping' : dp < .68 ? 'compaction' : 'intrusion';
  const quakeStage = ep < .075 ? 'valley' : ep < .20 ? 'shaking' : ep < .44 ? 'landslide' : ep < .55 ? 'blocked' : ep < .79 ? 'lake' : ep < .89 ? 'breach' : 'flood';
  const stage = branch === 'drought' ? droughtStage : quakeStage;
  const captions = { coastal: '沿海情景', shortage: '少雨缺水', pumping: '加抽地下水', compaction: '松软层压密', intrusion: '咸水入侵',
    valley: '山地情景', shaking: '地震扰动', landslide: '坡体滑移', blocked: '河道堵塞', lake: '上游蓄水', breach: '坝体溃口', flood: '下游洪水' };
  return { phase, selection: branch === 'drought' ? 0 : 1, branch, stage, caption: captions[stage],
    drought: { deficit, extraction, subsidence, intrusion,
      surface: DISASTER_CHAIN_LAYOUT.originalSurface - subsidence,
      seaLevel: DISASTER_CHAIN_LAYOUT.seaLevel, salineToe: 66 - 31 * intrusion,
      pondRadius: 1 - .85 * deficit, pumpingActive: dp > .22 && dp < .76 },
    earthquake: { shake: shakeEnvelope === 0 ? 0 : shakeEnvelope * Math.sin(ep * Math.PI * 96) * .45,
      slide, blockage, accumulation, lake, breach, flood,
      lakeLevel: DISASTER_CHAIN_LAYOUT.riverY + 5.2 * lake,
      floodLevel: DISASTER_CHAIN_LAYOUT.riverY + 2.8 * flood,
      floodFront: 56 + 41 * flood, resultHeld: ep === 1 },
    conditional: true, conditions: DISASTER_CHAIN_CONDITIONS[branch],
    units: 'schematic-phase', measuredOrPredicted: false,
  };
}
export type DisasterChainState = ReturnType<typeof evaluateDisasterChain>;

/** A schematic depression around the extraction well. The coastal boundary
 * keeps the same sea level; no surface seawater rise drives the intrusion. */
export function chainFreshHead(state: DisasterChainState, x: number) {
  const q = clamp((x - DISASTER_CHAIN_LAYOUT.landLeft) / (DISASTER_CHAIN_LAYOUT.coast - DISASTER_CHAIN_LAYOUT.landLeft));
  return 20.2 - .8 * q - 9.4 * state.drought.extraction * Math.sin(Math.PI * q) ** 2;
}
export function chainSalineInterface(state: DisasterChainState, x: number) {
  const { bedrock, coast } = DISASTER_CHAIN_LAYOUT, toe = state.drought.salineToe;
  const q = clamp((x - toe) / (coast - toe));
  return bedrock + (chainFreshHead(state, x) - bedrock) * q ** .72;
}
export const chainValleyGround = (z: number) => LAYOUT_VALLEY_BASE + DISASTER_CHAIN_LAYOUT.bankSlope * (z - DISASTER_CHAIN_LAYOUT.riverZ) ** 2;
const LAYOUT_VALLEY_BASE = DISASTER_CHAIN_LAYOUT.valleyBase;
export const chainRiverHalfWidth = (waterLevel: number) => Math.sqrt(Math.max(0, waterLevel - LAYOUT_VALLEY_BASE) / DISASTER_CHAIN_LAYOUT.bankSlope);

const n = (value: number) => Number(value.toFixed(3));
const button = (body: string, attributes: string, label: string) =>
  `<g ${attributes} role="button" tabindex="0" aria-label="${label}" style="cursor:pointer">${body}</g>`;

/** Native geometry, shared state; this is not a textbook-page bitmap. */
export function disasterChainSvg(phase: number, selection = 0): string {
  const s = evaluateDisasterChain(phase, selection), d = s.drought, q = s.earthquake;
  const px = (x: number) => n(30 + 6 * x), py = (y: number) => n(352 - 6 * y);
  const xy = (x: number, y: number) => `${px(x)},${py(y)}`;
  const profile = (from: number, to: number, fn: (x: number) => number, count = 40) =>
    Array.from({ length: count + 1 }, (_, i) => { const x = from + (to - from) * i / count; return xy(x, fn(x)); }).join(' ');
  const replay = button('<circle cx="608" cy="342" r="21" fill="#f7f1e3" stroke="#6f7569"/><path d="M617 349a12 12 0 1 0-17-17m0-8v9h9" fill="none" stroke="#3b7883" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>', 'data-model-replay="true" data-chain-role="replay"', '重放当前情景');
  let body = '';
  if (s.branch === 'drought') {
    const dryPath = `${profile(6, 72, x => chainFreshHead(s, x))} ${xy(72, 20.5)} ${xy(6, 20.5)}`;
    const freshPath = `${xy(6, 4)} ${profile(6, 72, x => chainFreshHead(s, x))} ${xy(72, 4)}`;
    const saltPath = `${xy(d.salineToe, 4)} ${profile(d.salineToe, 72, x => chainSalineInterface(s, x))} ${xy(72, 4)}`;
    const well = `<path d="M${px(44)} ${py(8)}V${py(d.surface + 3)}h23v14" fill="none" stroke="#525c5b" stroke-width="7"/><path d="M${px(44)} ${py(8)}V${py(d.surface + 3)}h23v14" fill="none" stroke="#e0e0cf" stroke-width="3"/><path d="M${px(41)} ${py(d.surface + 4)}h40" stroke="#6c7a70" stroke-width="5"/>`;
    body = `<path d="M${xy(6, 0)} ${xy(97, 0)} ${xy(97, 4)} ${xy(6, 4)}Z" fill="#b7a58f" stroke="#6c7468"/>
      <polygon points="${freshPath}" fill="#a8c6c7" stroke="#768f8b"/>
      <polygon points="${dryPath}" fill="#e3d4b4" stroke="#a69b80"/>
      <path d="M${xy(6, 20.5)}H${px(72)}V${py(d.surface)}H${px(6)}Z" fill="#c8b697" stroke="#706e5a"/>
      <path d="M${xy(72, 4)}H${px(97)}V${py(d.seaLevel)}H${px(72)}Z" fill="#96bbc2" stroke="#66858a"/>
      <polygon points="${saltPath}" fill="#6498a4" stroke="#427683"/>
      ${d.subsidence > .03 ? `<path d="M${xy(9, 26.5)}H${px(66)}" fill="none" stroke="#968c77" stroke-dasharray="5 5"/>` : ''}
      <ellipse cx="${px(20)}" cy="${py(d.surface + .2)}" rx="${n(36 * d.pondRadius)}" ry="${n(5 * d.pondRadius)}" fill="#79a7b2" stroke="#567f81"/>
      ${button(well, 'data-model-replay="true" data-model-selection="0" data-chain-role="well"', '重放沿海缺水与地下水变化')}
      <text x="170" y="292" font-size="22">淡水</text><text x="552" y="213" font-size="22">海水</text>
      <text x="319" y="${py(d.surface + 6)}" text-anchor="middle" font-size="22">抽水井</text>`;
  } else {
    const x = (v: number) => n(30 + 6 * v), y = (h: number, z: number) => n(216 - 4.6 * h + 2 * z);
    const v = (a: number, h: number, z: number) => `${x(a)},${y(h, z)}`;
    const land = `${v(6, 5, 7)} ${v(96, 5, 7)} ${v(96, 5, 52)} ${v(6, 5, 52)}`;
    const lakeHalf = chainRiverHalfWidth(q.lakeLevel);
    const stones = Array.from({ length: 12 }, (_, i) => {
      const row = Math.floor(i / 4), col = i % 4, central = row === 1;
      const xx = 55 + (col - 1.5) * 2 + (central ? 7 * q.breach : 0);
      const zz = 15 + row * 2 + (20 + (row - 1) * 2 - row * 2) * q.slide;
      const yy = 28 - row + (8 + (col % 2) - (28 - row)) * q.slide - (central ? 3 * q.breach : 0);
      return `<path d="M-10 5-5-9 8-7 13 4 3 10Z" transform="translate(${x(xx)} ${y(yy, zz)}) rotate(${n(i * 17 + q.slide * 60)})" fill="${i % 2 ? '#b7a288' : '#c8b79c'}" stroke="#706e5c"/>`;
    }).join('');
    const village = [79, 86].map(xx => {
      // Keep roofs above the flood, clipping only the submerged wall. The
      // approaching front uses the same six-unit taper as the raised model.
      const level = DISASTER_CHAIN_LAYOUT.riverY + (q.floodLevel - DISASTER_CHAIN_LAYOUT.riverY) * smooth(0, 6, q.floodFront - xx);
      const base = Math.max(5, chainRiverHalfWidth(level) >= 9 ? level : 5);
      return `<path d="M${v(xx - 2, base, 44)}V${y(9, 44)}h24v${n((9 - base) * 4.6)}Z" fill="#f4ebd8" stroke="#686f60"/><path d="M${v(xx - 2.6, 9, 44)} ${v(xx, 11.3, 44)} ${v(xx + 2.6, 9, 44)}Z" fill="#b79d7a" stroke="#686f60"/>`;
    }).join('');
    body = `<polygon points="${land}" fill="#b8bd9d" stroke="#727b66"/>
      <path d="M${v(6, 5, 52)}V${y(0, 52)}H${x(96)}V${y(5, 52)}Z" fill="#c6b69a" stroke="#727b66"/>
      <path d="M${v(8, 5, 28)} ${v(29, 18, 10)} ${v(55, 32, 9)} ${v(78, 20, 12)} ${v(95, 5, 28)}Z" fill="#b2b599" stroke="#727b66"/>
      <path d="M${v(6, 3.65, 31)}H${x(96)}V${y(3.65, 40)}H${x(6)}Z" fill="#90bac2" stroke="#668b8d"/>
      ${q.lake > .005 ? `<polygon points="${v(8, q.lakeLevel, 32)} ${v(52.5, q.lakeLevel, 35 - lakeHalf)} ${v(52.5, q.lakeLevel, 35 + lakeHalf)} ${v(8, q.lakeLevel, 38)}" fill="#80adb8" stroke="#497d87"/>` : ''}
      ${q.flood > .005 ? `<polygon points="${v(56, q.floodLevel, 32)} ${v(q.floodFront, q.floodLevel, 30 - 5 * q.flood)} ${v(q.floodFront, q.floodLevel, 40 + 6 * q.flood)} ${v(56, q.floodLevel, 38)}" fill="#86acaf" stroke="#487983"/>` : ''}
      <g data-chain-role="settlement">${village}</g>
      ${button(stones, 'data-model-replay="true" data-model-selection="1" data-chain-role="landslide"', '重放滑坡堵河过程')}
      ${q.slide < .98 ? '<text x="351" y="104" text-anchor="middle" font-size="22">滑坡体</text>' : ''}
      ${q.lake > .15 ? `<text x="195" y="${y(q.lakeLevel + 3.5, 35)}" text-anchor="middle" font-size="22">堰塞湖</text>` : ''}
      ${q.breach > .05 ? `<text x="365" y="${y(15, 35)}" text-anchor="middle" font-size="22">溃口</text>` : ''}
      <text x="545" y="341" text-anchor="middle" font-size="22">聚落</text>`;
  }
  return `<svg class="flat-model-svg flat-explanation-svg" viewBox="0 0 660 390" role="group" aria-label="${s.branch === 'drought' ? '沿海缺水、加抽地下水、地层压密与咸水入侵的选定情景' : '地震诱发滑坡、堵河蓄湖及选定溃决洪水情景'}" data-chain-branch="${s.branch}" data-chain-stage="${s.stage}" data-chain-phase="${s.phase}" data-chain-subsidence="${d.subsidence}" data-chain-intrusion="${d.intrusion}" data-chain-slide="${q.slide}" data-chain-breach="${q.breach}" data-chain-flood="${q.flood}" data-chain-sea-level="${d.seaLevel}">
    <g font-family="FieldSerif,SimSun,serif" fill="#303a40" stroke-linecap="round" stroke-linejoin="round">
    <text x="330" y="39" text-anchor="middle" font-size="26">${s.caption}</text>${body}${replay}</g></svg>`;
}

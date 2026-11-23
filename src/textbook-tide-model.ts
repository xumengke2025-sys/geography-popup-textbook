/** Textbook p.59: a repeating rise and fall of the sea, exposing and covering
 * the intertidal shore. All dimensions are uncalibrated teaching geometry.
 * This is one schematic cycle, not a named coast's tide table or tide height. */
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
export const TIDE_LAYOUT = {
  seaLeft: 6, landRight: 97, back: 6, front: 55,
  low: 7.8, high: 18.2, seabed: 2.6, beachStart: 30, slope: .32,
  boatX: 21.5, boatZ: 28, boatDraft: 1.15,
  gaugeX: 33, gaugeZ: 47, gaugeTop: 24,
} as const;
export type TideStage = 'low' | 'rising' | 'high' | 'falling';
export function tideCoastOffset(z: number) {
  const q = (z - TIDE_LAYOUT.back) / (TIDE_LAYOUT.front - TIDE_LAYOUT.back);
  return 2.5 * Math.sin(q * Math.PI * 1.4) + .7 * Math.sin(q * Math.PI * 3);
}
export function tideGround(x: number, z: number) {
  return TIDE_LAYOUT.seabed + TIDE_LAYOUT.slope * Math.max(0, x - TIDE_LAYOUT.beachStart + tideCoastOffset(z));
}
export function tideShoreX(waterLevel: number, z: number) {
  return TIDE_LAYOUT.beachStart + (waterLevel - TIDE_LAYOUT.seabed) / TIDE_LAYOUT.slope - tideCoastOffset(z);
}
export function evaluateTide(input: number, _selection?: number) {
  const phase = clamp(input), fraction = (1 - Math.cos(phase * Math.PI * 2)) / 2;
  const waterLevel = TIDE_LAYOUT.low + (TIDE_LAYOUT.high - TIDE_LAYOUT.low) * fraction;
  const stage: TideStage = phase <= .015 || phase >= .985 ? 'low' : Math.abs(phase - .5) <= .015 ? 'high' : phase < .5 ? 'rising' : 'falling';
  const caption = { low: '低潮', rising: '涨潮', high: '高潮', falling: '落潮' }[stage];
  const shoreline = Array.from({ length: 41 }, (_, i): readonly [number, number, number] => {
    const z = TIDE_LAYOUT.back + (TIDE_LAYOUT.front - TIDE_LAYOUT.back) * i / 40;
    return [tideShoreX(waterLevel, z), waterLevel, z];
  });
  return { phase, fraction, waterLevel, stage, caption,
    direction: stage === 'rising' ? 1 : stage === 'falling' ? -1 : 0,
    shoreline, shorelineFront: shoreline[40][0],
    intertidal: { lowEdge: tideShoreX(TIDE_LAYOUT.low, TIDE_LAYOUT.front),
      highEdge: tideShoreX(TIDE_LAYOUT.high, TIDE_LAYOUT.front), exposedFraction: 1 - fraction },
    boat: { x: TIDE_LAYOUT.boatX, z: TIDE_LAYOUT.boatZ, waterline: waterLevel,
      keel: waterLevel - TIDE_LAYOUT.boatDraft, freeboard: .95, draft: TIDE_LAYOUT.boatDraft },
    gauge: { x: TIDE_LAYOUT.gaugeX, z: TIDE_LAYOUT.gaugeZ, bottom: TIDE_LAYOUT.seabed, top: TIDE_LAYOUT.gaugeTop, waterMark: waterLevel },
    units: 'schematic-cycle', locationSpecific: false, tideCurrentCalculated: false,
  };
}
export type TideState = ReturnType<typeof evaluateTide>;

const n = (value: number) => Number(value.toFixed(3));
/** A native cross-section shares the same beach, shoreline, waterline and
 * boat draft as the paper model. No added measurements or current arrows. */
export function tideSvg(phase: number, selection?: number): string {
  const s = evaluateTide(phase, selection), z = TIDE_LAYOUT.front;
  const x = (u: number) => n(25 + u * 6), y = (h: number) => n(350 - h * 8.1), pt = (u: number, h: number) => `${x(u)},${y(h)}`;
  const ground = Array.from({ length: 81 }, (_, i) => { const u = 6 + 91 * i / 80; return pt(u, tideGround(u, z)); }).join(' ');
  const floor = Array.from({ length: 49 }, (_, i) => { const u = s.shorelineFront + (6 - s.shorelineFront) * i / 48; return pt(u, tideGround(u, z)); }).join(' ');
  const band = Array.from({ length: 31 }, (_, i) => { const u = s.intertidal.lowEdge + (s.intertidal.highEdge - s.intertidal.lowEdge) * i / 30; return pt(u, tideGround(u, z)); }).join(' ');
  const gaugeX = x(s.gauge.x), waterY = y(s.waterLevel), gauge = `<path d="M${gaugeX} ${y(2.6)}V${y(24)}" stroke="#63746b" stroke-width="6"/>
    ${Array.from({ length: 7 }, (_, i) => `<path d="M${gaugeX} ${y(3.1 + i * 2.8)}v${n(-2.5 * 8.1)}" stroke="${i % 2 ? '#a8755c' : '#f7f1e3'}" stroke-width="8"/><path d="M${gaugeX} ${y(3.1 + i * 2.8)}h12" stroke="#4e605b" stroke-width="1.4"/>`).join('')}`;
  const lowX=x(s.intertidal.lowEdge),highX=x(s.intertidal.highEdge),shoreX=x(s.shorelineFront);
  const strata=[1.2,2.6,4.1].map((depth,i)=>{
    const points=Array.from({length:61},(_,j)=>{
      const u=6+91*j/60;
      return pt(u,tideGround(u,z)-depth+.17*Math.sin(u*.38+i));
    });
    return `<path d="M${points.join('L')}" fill="none" stroke="${i===1?'#927e61':'#e6d5b2'}" stroke-width="${i===1?1.15:2}"/>`;
  }).join('');
  return `<svg class="flat-model-svg flat-explanation-svg" viewBox="0 0 660 400" role="img" aria-label="${s.caption}：海水沿同一坡岸进退，轻舟随潮位升降，固定潮尺提供参照" data-tide-stage="${s.stage}" data-tide-phase="${s.phase}" data-tide-level="${s.waterLevel}" data-tide-shore="${s.shorelineFront}" data-tide-boat="${s.boat.waterline}" data-tide-gauge-mark="${s.gauge.waterMark}">
    <defs><linearGradient id="tide-water" x2=".12" y2="1"><stop stop-color="#b8d9d1"/><stop offset=".52" stop-color="#8bb5b4"/><stop offset="1" stop-color="#678e96"/></linearGradient>
    <linearGradient id="tide-wood" x2=".2" y2="1"><stop stop-color="#dbb483"/><stop offset="1" stop-color="#926e51"/></linearGradient>
    <clipPath id="tide-bed"><path d="M${pt(6,0)} ${ground} ${pt(97,0)}Z"/></clipPath>
    <clipPath id="tide-gauge-above-water"><rect x="0" y="0" width="660" height="${waterY}"/></clipPath></defs>
    <g font-family="FieldSerif,SimSun,serif" stroke-linejoin="round" stroke-linecap="round" fill="#303a40">
    <text x="330" y="43" text-anchor="middle" font-size="29">${s.caption}</text>
    <path d="M${pt(6, 0)} ${ground} ${pt(97, 0)}Z" fill="#cbbb9e" stroke="#858571" stroke-width="1.2"/>
    <g clip-path="url(#tide-bed)">${strata}</g>
    <polyline points="${band}" fill="none" stroke="#daceb0" stroke-width="9"/>
    ${gauge}
    <path d="M${pt(6, s.waterLevel)} ${pt(s.shorelineFront, s.waterLevel)} ${floor}Z" fill="url(#tide-water)" stroke="#62858a" stroke-width="1.2"/>
    <path d="M${pt(6, s.waterLevel)}H${x(s.shorelineFront)}" fill="none" stroke="#447c88" stroke-width="1.7"/>
    <path d="M${pt(s.shorelineFront - .7, s.waterLevel + .05)}H${x(s.shorelineFront + .15)}" stroke="#f8f3e6" stroke-width="3.5"/>
    <g clip-path="url(#tide-gauge-above-water)">${gauge}</g>
    <path d="M${gaugeX - 9} ${waterY}h22" stroke="#3f7680" stroke-width="2.7"/>
    <g data-tide-role="boat" transform="translate(${x(s.boat.x)} ${y(s.boat.waterline)})">
      <path d="M-45 -9Q-20 -4 6 -5Q30 -6 44 -13Q39 -1 23 6Q2 11 -24 6Q-38 1 -45 -9Z" fill="url(#tide-wood)" stroke="#524a3d" stroke-width="1.6"/>
      <path d="M-44 -9Q-14 -17 19 -14L44 -13Q22 -3 -7 -4Q-26 -4 -44 -9Z" fill="#e8d9b4" stroke="#635947" stroke-width="1.3"/>
      <path d="M-33 -8Q-13 -13 18 -12L32 -12Q10 -6 -4 -6Q-20 -5 -33 -8Z" fill="#908370"/>
      <path d="M-19 -11l5 6m13 -8 5 6m12 -7 4 5" fill="none" stroke="#dac7a0" stroke-width="3"/>
      <path d="M-34 -3Q-4 9 30 -.5" fill="none" stroke="#f1d7a8" stroke-width="1.1"/>
    </g>
    <text x="${gaugeX}" y="134" text-anchor="middle" font-size="25">固定潮尺</text>
    <path d="M${lowX} 353v9H${highX}v-9" fill="none" stroke="#8c754a" stroke-width="1.6"/>
    <circle cx="${shoreX}" cy="362" r="3.2" fill="#986749"/>
    <text x="${(lowX+highX)/2}" y="391" text-anchor="middle" font-size="25">潮间带</text>
    </g></svg>`;
}

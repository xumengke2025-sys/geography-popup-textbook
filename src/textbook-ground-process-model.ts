/** Deterministic teaching states. Fractions and distances are illustrative,
 * never measured soil properties, weather thresholds or geological clocks. */
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const smooth = (a: number, b: number, n: number) => { const q = clamp((n - a) / (b - a)); return q * q * (3 - 2 * q); };

export function evaluateDensityComparison(selection: number) {
  const mode = Math.max(0, Math.min(2, Math.round(selection)));
  return { mode, angle: mode ? -.14 : 0, equalVolumes: true, greaterMass: mode ? 'right' : 'neither',
    massTokens: [9, mode ? 13 : 9], measuredDensity: false, stableForFixedCondition: true } as const;
}

export function evaluateSoilPores(selection: number) {
  const mode = Math.max(0, Math.min(2, Math.round(selection))), water = [.16, .5, .88][mode];
  return { mode, water, air: 1 - water, poreVolume: 1, solidVolumeChanges: false,
    proportionsAreMeasured: false, samePores: true };
}

export function evaluateSeismicParticles(input: number, selection = 0) {
  const phase = clamp(input), liquid = selection === 0;
  return { phase, liquid, particles: Array.from({ length: 20 }, (_, id) => {
    const restX = 14 + id * 3.7, transmittedS = !liquid || id < 10;
    return { id, restX, pDx: 1.65 * Math.sin(id * .75 - phase * Math.PI * 6), pDy: 0,
      sDx: 0, sDy: transmittedS ? 3 * Math.sin(id * .75 - phase * Math.PI * 6) : 0, transmittedS };
  }), propagation: 'positive-x', measuredSpeed: false } as const;
}

export function caveRoofHeight(u: number) {
  return 10 + 27 * Math.sqrt(Math.max(0, 1 - ((u - .5) / .4) ** 2));
}
export function evaluateCaveDeposition(input: number, selection = 0) {
  const phase = clamp(input), deposition = selection === 1;
  const drops = Array.from({ length: 9 }, (_, id) => {
    const site = id % 3, start = .035 + id * .072, finish = start + .23;
    const progress = clamp((phase - start) / (finish - start));
    return { id, site, u: [.29, .50, .72][site], progress,
      released: deposition && phase >= start, arrived: deposition && phase >= finish,
      visible: deposition && phase >= start && phase < finish };
  });
  const deposits = Array.from({ length: 3 }, (_, site) => {
    const local = drops.filter(drop => drop.site === site);
    const roof = deposition ? local.reduce((n, drop) => n + smooth(.035 + drop.id * .072, .09 + drop.id * .072, phase), 0) : 0;
    const floor = deposition ? local.reduce((n, drop) => n + smooth(.265 + drop.id * .072, .325 + drop.id * .072, phase), 0) : 0;
    return { site, u: [.29, .50, .72][site], ceiling: caveRoofHeight([.29, .50, .72][site]),
      hanging: 2.3 + 1.3 * roof, rising: 1.5 + 1.6 * floor };
  });
  return { phase, deposition, drops, deposits, cutaway: 'open-front-with-back-wall',
    depositHeld: phase === 1, geologicalTimeMeasured: false, waterIsNotStone: true };
}

export function evaluateSoilProvenance(input: number, selection: number) {
  const phase = clamp(input), factor = Math.max(0, Math.min(4, Math.round(selection)));
  const particles = Array.from({ length: 12 }, (_, id) => {
    const start = .035 + (id % 4) * .08, finish = .65 + (id % 3) * .09;
    const q = smooth(start, finish, phase), u0 = .19 + (id % 6) * .12;
    const source = factor === 0 ? { u: u0, h: 4.5 + Math.floor(id / 6) * 2 }
      : factor === 1 ? { u: .50 + (id % 3) * .035, h: 24 + Math.floor(id / 3) * 1.4 }
        : { u: .25 + (id % 4) * .16, h: 18.1 + (id % 3) * .4 };
    const target = factor === 0 ? { u: u0 + (id % 2 ? .025 : -.025), h: 9.2 + Math.floor(id / 6) * 2.4 }
      : factor === 1 ? { u: .27 + (id % 6) * .09, h: 18.7 + Math.floor(id / 6) * .45 }
        : { u: .25 + (id % 4) * .16, h: 10 + (id % 3) * 1.2 };
    return { id, progress: q, u: source.u + (target.u - source.u) * q,
      h: source.h + (target.h - source.h) * q, source, target,
      retained: phase >= finish, stage: phase < start ? 'source' : phase >= finish ? 'retained' : 'moving' };
  });
  return { phase, factor, particles, retained: particles.filter(p => p.retained).length,
    soilDepth: factor === 3 ? 1.7 + 10.3 * phase : 6,
    materialIdentityKept: true, geologyYears: false };
}

export function evaluateKarstCover(input: number, selection: number) {
  const phase = clamp(input), clearing = selection === 1, weather = selection === 2;
  const loss = clearing ? smooth(.08, .45, phase) : 0;
  const particles = Array.from({ length: 14 }, (_, id) => {
    const start = .24 + (id % 5) * .026, finish = .72 + (id % 4) * .055;
    const q = clearing ? smooth(start, finish, phase) : 0, sign = id % 2 ? 1 : -1;
    return { id, progress: q, u: .5 + sign * (.25 * (1 - q) + .025 * q * (1 + id % 3)),
      v: .5 + q * (.27 + (id % 3) * .025), retained: clearing && phase >= finish };
  });
  const wet = weather ? smooth(.02, .46, phase) * (1 - smooth(.54, .98, phase)) : selection === 0 ? .15 : 0;
  return { phase, selection, loss, cover: 1 - loss, wet, dry: weather && phase >= .5, particles,
    retained: particles.filter(p => p.retained).length, weatherCycleIsSchematic: true };
}

export function evaluateFloodSequence(input: number, selection: number) {
  const phase = clamp(input), heavyRain = selection === 1;
  const runoff = heavyRain ? smooth(.14, .50, phase) : 0;
  const rise = heavyRain ? smooth(.28, .95, phase) : 0;
  const waterLevel = 2.9 + 4.5 * rise;
  return { phase, heavyRain, runoff, rise, waterLevel, overbank: waterLevel > 5,
    stage: !heavyRain ? 'baseline' : phase < .14 ? 'rain' : waterLevel <= 5 ? 'runoff' : 'inundated',
    forecast: false };
}

export function evaluateDroughtSequence(input: number, selection: number) {
  const phase = clamp(input), lowRain = selection === 1;
  const soilDeficit = lowRain ? smooth(.08, .58, phase) : 0;
  const sourceDeficit = lowRain ? smooth(.18, .76, phase) : 0;
  const cropStress = lowRain ? smooth(.42, .96, phase) : 0;
  return { phase, lowRain, soilDeficit, sourceDeficit, cropStress,
    sourceLevel: 8.5 - 6.6 * sourceDeficit,
    stage: !lowRain ? 'supplied' : phase < .42 ? 'soil-and-source' : 'crops-respond',
    yieldPrediction: false };
}

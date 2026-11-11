/** Textbook-scale teaching states. The normalized phase is an explanation
 * order; none of these positions, heat states or transfer rates is measured. */
export const skyClamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
export const skyProgress = (start: number, end: number, phase: number) => skyClamp((phase - start) / (end - start));
export const skyEase = (start: number, end: number, phase: number) => {
  const t = skyProgress(start, end, phase); return t * t * (3 - 2 * t);
};
const choice = (value: number, max: number) => Math.max(0, Math.min(max, Math.round(Number.isFinite(value) ? value : 0)));

export const SOLAR_DISTURBANCE_EVENTS = { departure: .06, magnetosphere: .44, polarArrival: .72 } as const;
export function evaluateSolarDisturbance(input: number, selection = 0) {
  const phase = skyClamp(input), enhanced = choice(selection, 1) === 1, e = SOLAR_DISTURBANCE_EVENTS;
  const arrived = enhanced && phase >= e.magnetosphere, polarReceived = enhanced && phase >= e.polarArrival;
  return { phase, enhanced, stage: !enhanced ? 'quiet' : phase < e.departure ? 'ready' : !arrived ? 'outbound' : !polarReceived ? 'deflected' : 'polar-response',
    sourceOpen: enhanced ? skyEase(.03, .13, phase) : 0,
    outbound: enhanced ? skyProgress(e.departure, e.magnetosphere, phase) : 0,
    deflected: enhanced ? skyProgress(e.magnetosphere, e.polarArrival, phase) : 0,
    magnetosphereResponse: enhanced ? skyEase(e.magnetosphere, .58, phase) : 0,
    auroraResponse: enhanced ? skyEase(e.polarArrival, .87, phase) : 0,
    arrived, polarReceived, eventIds: ['disturbance-north', 'disturbance-south'],
    warningOrPrediction: false, particlePathIsMeasured: false,
  } as const;
}

export const GEOLOGICAL_INTERVALS = [
  { id: 'precambrian', label: '前寒武纪', fromMa: 4600, toMa: 541 },
  { id: 'paleozoic', label: '古生代', fromMa: 541, toMa: 252 },
  { id: 'mesozoic', label: '中生代', fromMa: 252, toMa: 66 },
  { id: 'cenozoic', label: '新生代', fromMa: 66, toMa: 0 },
] as const;
export function geologicalInterval(selection: number) {
  const selected = choice(selection, 3), period = GEOLOGICAL_INTERVALS[selected];
  return { selected, ...period, start: (4600 - period.fromMa) / 4600, end: (4600 - period.toMa) / 4600,
    fraction: (period.fromMa - period.toMa) / 4600, ageUnit: 'Ma', widthUsesRealDuration: true } as const;
}

export function evaluateSphereExchange(input: number, selection = 0) {
  const phase = skyClamp(input), selected = choice(selection, 2), biological = selected === 2;
  const receivedSoil = biological ? phase >= .12 : phase >= .50;
  const receivedLeaf = biological && phase >= .42;
  const stage = biological ? phase < .12 ? 'soil-water' : phase < .42 ? 'root-uptake' : phase < .63 ? 'leaf-received' : phase < .9 ? 'transpiration' : 'atmosphere'
    : phase < .22 ? 'evaporation' : phase < .36 ? 'cloud' : phase < .50 ? 'precipitation' : phase < .82 ? 'runoff' : 'sea-return';
  return { phase, selected, biological, stage, receivedSoil, receivedLeaf,
    waterIds: ['water-a', 'water-b', 'water-c'],
    cloudResponse: biological ? skyEase(.86, .97, phase) : skyEase(.22, .34, phase),
    soilResponse: biological ? 1 - .3 * skyEase(.12, .42, phase) : skyEase(.50, .63, phase),
    leafResponse: biological ? skyEase(.42, .62, phase) : .35 * skyEase(.56, .70, phase),
    isFullWaterBudget: false, biologicalGrowthSimulated: false } as const;
}

export type MarsTransferKind = 'water' | 'carbon-dioxide' | 'oxygen' | 'food' | 'electricity';
export function evaluateMarsTransfer(input: number, selection = 0) {
  const phase = skyClamp(input), selected = choice(selection, 3);
  const water = selected === 1, biology = selected === 2, energy = selected === 3;
  const packets: { id: string; kind: MarsTransferKind; progress: number; visible: boolean; received: boolean; leg?: number; legProgress?: number }[] = [];
  if (water) for (let i = 0; i < 3; i++) packets.push({ id: `reclaimed-water-${i}`, kind: 'water',
    progress: skyProgress(.04 + i * .025, .94 + i * .025, phase), visible: phase >= .04 + i * .025, received: phase >= .94 + i * .025,
    leg: phase - i * .025 < .31 ? 0 : phase - i * .025 < .62 ? 1 : 2,
    legProgress: phase - i * .025 < .31 ? skyProgress(.04, .31, phase - i * .025)
      : phase - i * .025 < .62 ? skyProgress(.31, .62, phase - i * .025) : skyProgress(.62, .94, phase - i * .025) });
  if (biology) for (const [kind, start, end] of [['carbon-dioxide', .06, .30], ['oxygen', .41, .68], ['food', .56, .89]] as const)
    packets.push({ id: `${kind}-transfer`, kind, progress: skyProgress(start, end, phase), visible: phase >= start, received: phase >= end });
  if (energy) packets.push({ id: 'solar-electricity', kind: 'electricity', progress: skyProgress(.06, .62, phase), visible: phase >= .06, received: phase >= .62 });
  return { phase, selected, packets,
    purifierReceived: water && phase >= .31,
    purifierResponse: water ? skyEase(.31, .44, phase) : 0,
    reservoirResponse: water ? skyEase(.62, .76, phase) : 0,
    crewWaterReceived: water && phase >= .94,
    crewWaterResponse: water ? skyEase(.94, 1, phase) : 0,
    plantResponse: biology ? skyEase(.30, .42, phase) : 0,
    crewOxygenResponse: biology ? skyEase(.68, .78, phase) : 0,
    crewFoodResponse: biology ? skyEase(.89, .97, phase) : 0,
    powerResponse: energy ? skyEase(.62, .76, phase) : 0,
    purifierStroke: water ? skyEase(.31, .44, phase) : energy ? skyEase(.62, .76, phase) : 0,
    matterLoopFullyClosed: false, energyIsMatter: false, actualFoodYieldCalculated: false } as const;
}

export function evaluateGreenhouseResponse(input: number, selection = 0) {
  const phase = skyClamp(input), selected = choice(selection, 2), atmosphere = selected > 0;
  const solarArrival = skyEase(.18, .28, phase), emitted = skyProgress(.33, .52, phase);
  const airResponse = atmosphere ? skyEase(.52, .60, phase) : 0;
  const returned = atmosphere ? skyProgress(.60, .78, phase) : 0;
  // The relative ground-state strip receives the same shortwave input in every
  // condition. Its later difference begins only after downward longwave arrives.
  const returnReceived = atmosphere ? skyEase(.78, .90, phase) : 0;
  const groundHeat = .22 + .70 * solarArrival - .48 * skyEase(.35, 1, phase)
    + (selected === 2 ? .24 : .14) * returnReceived;
  return { phase, selected, atmosphere, cloud: selected === 2,
    shortwave: skyProgress(.02, .18, phase), solarArrival, emitted, airResponse, returned, returnReceived, groundHeat,
    spaceEmission: skyProgress(.60, .90, phase), stage: phase < .18 ? 'shortwave' : phase < .33 ? 'ground-absorbs'
      : phase < .52 ? 'ground-emits' : !atmosphere ? 'space-loss' : phase < .78 ? 'air-radiates' : 'ground-receives',
    relativeHeatOnly: true, energyFractionsFromArrowCounts: false, energyCreated: false } as const;
}

export function evaluateWindForces(selection = 0) {
  const selected = choice(selection, 3), z = Math.sqrt(1 - .55 ** 2);
  const wind = [[1, 0], [0, 1], [.55, z], [.55, -z]][selected] as [number, number];
  const [u, w] = wind, gradient = [1, 0] as [number, number];
  const coriolis = (selected === 0 ? [0, 0] : selected === 1 ? [-1, 0] : [-w * w, u * w]) as [number, number];
  const friction = (selected > 1 ? [-u * u, -u * w] : [0, 0]) as [number, number];
  return { selected, wind, gradient, coriolis, friction, balanced: selected > 0,
    hemisphere: selected === 3 ? 'south' : 'north', forceMagnitudeIsMeasured: false } as const;
}

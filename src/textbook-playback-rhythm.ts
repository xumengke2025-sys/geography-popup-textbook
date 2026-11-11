/** A presentation clock, separate from every scientific evaluator. A full
 * demonstration still takes the same time; key transitions get more of it.
 * The invertible clock also makes pause/resume and frame splitting agree. */
type Window = readonly [number, number];
const moments: Record<string, readonly Window[]> = {
  river: [[.38, .50], [.60, .74], [.88, .99]],
  'coastal-landform': [[.38, .51], [.70, .86]],
  remote: [[.40, .48], [.89, .96]],
  'mars-base': [[.30, .36], [.62, .70], [.92, .98]],
  greenhouse: [[.76, .88]],
};
function windowsFor(effect: string, selection: number): readonly Window[] | undefined {
  if (effect === 'coastal-landform' && selection !== 0) return;
  if (effect === 'soil-factors') return selection < 2 ? [[.34,.53],[.69,.88]] : selection === 2 ? [[.47,.63],[.78,.96]] : undefined;
  if (effect === 'solar-activity') return selection === 1 ? [[.41,.59],[.67,.89]] : undefined;
  if (effect === 'water') return selection === 0 ? [[.46,.67],[.90,1]] : [[.48,.58],[.78,.94]];
  if (effect === 'urban-waterlogging') return [[.25,.39],[.78,.98]];
  if (effect === 'greenhouse' && selection === 0) return [[.15,.30]];
  return moments[effect];
}

/** Integral of a raised-cosine weight. Velocity eases into and out of each
 * event; a piecewise constant clock would visibly jerk at its boundaries.
 * The normalized clock is strictly increasing, so no state is skipped or
 * fabricated and resuming from a dragged phase has no hidden timing state. */
function weightedTime(phase: number, windows: readonly Window[]) {
  return phase + windows.reduce((extra, [a,b]) => {
    const span=b-a,q=Math.max(0,Math.min(1,(phase-a)/span));
    return extra + 1.8*span*(q/2-Math.sin(2*Math.PI*q)/(4*Math.PI));
  },0);
}
export function presentationClock(effect: string, selection: number, phase: number) {
  const windows=windowsFor(effect,selection);
  return windows?weightedTime(phase,windows)/weightedTime(1,windows):phase;
}
export function advancePresentationPhase(effect: string, selection: number, phase: number, elapsed: number, once: boolean) {
  const windows = windowsFor(effect, selection);
  if (!windows) return once ? Math.min(1, phase + elapsed) : (phase + elapsed) % 1;
  const duration=weightedTime(1,windows),clock=weightedTime(phase,windows)/duration+elapsed;
  if(once&&clock>=1)return 1;
  const target=((clock%1)+1)%1*duration;
  let lo=0,hi=1;
  for(let i=0;i<42;i++){
    const mid=(lo+hi)/2;
    if(weightedTime(mid,windows)<target)lo=mid;else hi=mid;
  }
  return (lo+hi)/2;
}

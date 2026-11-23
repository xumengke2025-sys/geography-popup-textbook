/** A visible slider is drawn by the lesson in its own projected coordinates.
 * Rotating the input frame onto that rail also handles upright and oblique tracks. */
export function drawingGrip(name: string, start: readonly number[], end: readonly number[], phase: number, selectOnGrab?: number) {
  const dx=end[0]-start[0], dy=end[1]-start[1], length=Math.hypot(dx,dy);
  const x=length*phase, angle=Math.atan2(dy,dx)*180/Math.PI;
  return `<g transform="translate(${start[0]} ${start[1]}) rotate(${angle})" data-phase-track="${name}" ${selectOnGrab===undefined?'':'data-track-selection="'+selectOnGrab+'"'} data-track-start="0" data-track-end="${length}" data-track-grip="42" tabindex="0" role="slider" aria-label="${name}" aria-orientation="${Math.abs(dy)>Math.abs(dx)?'vertical':'horizontal'}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(phase*100)}"><rect x="${x-39}" y="-30" width="78" height="60" rx="8" fill="transparent"/></g>`;
}

import type { ModelInputChange } from './textbook-model-input';

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** The persistent reader owns capture while each new measurement redraws its SVG. */
export function bindDrawingTracks(reader: HTMLElement, phase: () => number | null, change: (value: ModelInputChange) => void) {
  let grab: { id: number; inverse: DOMMatrix; offset: number; start: number; travel: number } | null = null;
  const part = (event: Event) => (event.target as Element).closest<SVGGraphicsElement>('[data-phase-track]');
  const phaseAt = (event: PointerEvent, inverse: DOMMatrix, start: number, travel: number) =>
    (new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse).x - start) / travel;
  reader.addEventListener('pointerdown', event => {
    const control = part(event), matrix = control?.getScreenCTM(), value = phase();
    if (!control || !matrix || value === null || grab || event.button !== 0) return;
    const start = Number(control.dataset.trackStart), travel = Number(control.dataset.trackEnd) - start;
    if (!Number.isFinite(start + travel) || Math.abs(travel) < .00001) return;
    event.preventDefault();
    control.focus({ preventScroll: true });
    const inverse = matrix.inverse(), at = phaseAt(event, inverse, start, travel);
    // Grabbing the carriage preserves the contact point. Tapping the exposed
    // rails sets the traveller directly at that observation section.
    const offset = Math.abs((at - value) * travel) < Number(control.dataset.trackGrip ?? 23) ? value - at : 0;
    grab = { id: event.pointerId, inverse, offset, start, travel };
    reader.setPointerCapture(event.pointerId);
    const selection = control.dataset.trackSelection;
    change({ phase: clamp(at + offset), selection: selection === undefined ? undefined : Number(selection), keepPhase: true, commit: false });
  });
  function move(event: PointerEvent, commit: boolean) {
    if (!grab || event.pointerId !== grab.id || phase() === null) return;
    change({ phase: clamp(phaseAt(event, grab.inverse, grab.start, grab.travel) + grab.offset), commit });
  }
  reader.addEventListener('pointermove', event => move(event, false));
  reader.addEventListener('pointerup', event => {
    if (event.pointerId !== grab?.id) return;
    move(event, true); grab = null;
    if (reader.hasPointerCapture(event.pointerId)) reader.releasePointerCapture(event.pointerId);
  });
  const cancel = (event: PointerEvent) => {
    if (event.pointerId === grab?.id) { grab = null; change({ commit: true }); }
  };
  reader.addEventListener('pointercancel', cancel);
  reader.addEventListener('lostpointercapture', cancel);
  reader.addEventListener('keydown', event => {
    const value = phase();
    const control=part(event);
    if (!control || value === null) return;
    const step = ['ArrowRight','ArrowUp'].includes(event.key) ? .025 : ['ArrowLeft','ArrowDown'].includes(event.key) ? -.025 : 0;
    if (!step && !['Home','End'].includes(event.key)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    change({ phase: step ? clamp(value + step) : Number(event.key === 'End'), selection:control.dataset.trackSelection===undefined?undefined:Number(control.dataset.trackSelection),keepPhase:true, commit: true });
  });
}

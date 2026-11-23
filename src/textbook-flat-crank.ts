import { advanceCrank, phaseFromDialPoint, type ModelInputChange } from './textbook-model-input';

/** Artwork puts the origin of this SVG group at the spindle. The reader keeps
 * pointer capture while individual SVG frames are replaced by the lesson. */
export function bindFlatCranks(reader: HTMLElement, phase: () => number | null, change: (input: ModelInputChange) => void) {
  let grab: { id: number; inverse: DOMMatrix; turns: number; radius: number; angle: number; phase: number } | null = null;
  function angleAt(event: PointerEvent, inverse: DOMMatrix, radius: number, last: number) {
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse);
    return phaseFromDialPoint(point.x, -point.y, { center: [0, 0, 0], radiusX: radius, radiusY: radius }, last);
  }
  const control = (event: Event) => (event.target as Element).closest<SVGGraphicsElement>('[data-model-crank]');
  reader.addEventListener('pointerdown', event => {
    const part = control(event), matrix = part?.getScreenCTM(), progress = phase();
    if (!part || !matrix || progress === null || grab || event.button !== 0) return;
    const turns = Number(part.dataset.modelCrank), radius = Number(part.dataset.radius);
    if (!(turns > 0 && radius > 0)) return;
    const inverse = matrix.inverse();
    grab = { id: event.pointerId, inverse, turns, radius, phase: progress, angle: angleAt(event, inverse, radius, 0) };
    event.preventDefault();
    part.focus({ preventScroll: true }); reader.setPointerCapture(event.pointerId);
    change({ commit: false });
  });
  function sample(event: PointerEvent, commit: boolean) {
    if (!grab || grab.id !== event.pointerId) return;
    const at = angleAt(event, grab.inverse, grab.radius, grab.angle);
    grab.phase = advanceCrank(grab.phase, grab.angle, at, grab.turns);
    grab.angle = at; change({ phase: grab.phase, commit });
    if (commit) {
      grab = null;
      if (reader.hasPointerCapture(event.pointerId)) reader.releasePointerCapture(event.pointerId);
    }
  }
  reader.addEventListener('pointermove', e => sample(e, false));
  reader.addEventListener('pointerup', e => sample(e, true));
  const cancel = (e: PointerEvent) => { if (grab?.id === e.pointerId) { grab = null; change({ commit: true }); } };
  reader.addEventListener('lostpointercapture', cancel);
  reader.addEventListener('pointercancel', cancel);
  reader.addEventListener('keydown', event => {
    const progress = phase();
    if (!control(event) || progress === null) return;
    const step = ['ArrowRight','ArrowUp'].includes(event.key) ? .025 : ['ArrowLeft','ArrowDown'].includes(event.key) ? -.025 : 0;
    if (!step && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault(); event.stopImmediatePropagation();
    change({ phase: step ? Math.min(1, Math.max(0, progress + step)) : Number(event.key === 'End'), commit: true });
  });
}

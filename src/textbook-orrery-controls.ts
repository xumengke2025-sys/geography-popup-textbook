import mechanism from './assets/orrery-mechanism.json';
import { nearestDialStop, phaseFromDialPoint, type IndexedDial, type ModelInputChange } from './textbook-model-input';

const names = ['整体', '水星', '金星', '地球', '火星', '木星', '土星', '天王星', '海王星'];
const selector: IndexedDial = {
  kind: 'indexed-dial', label: '选星', dial: { center: [0, 0, 0], radiusX: 35, radiusY: 35 },
  start: mechanism.selector.startDegrees * Math.PI / 180, step: mechanism.selector.stepDegrees * Math.PI / 180,
  stops: names.map((_, selection) => ({ selection })),
};
const crank = { center: [0, 0, 0] as [number, number, number], radiusX: 33, radiusY: 33 };
type Observing = { phase: number; selection: number; inspection: string };
type Control = 'selector' | 'lever' | 'crank';

export function orreryControlDrawing({ phase, selection, inspection }: Observing) {
  const cut = inspection === 'train';
  const tick = (i: number) => `<path transform="rotate(${i * 40})" d="M0 -39v6" stroke="#584735" stroke-width="2.5"/>`;
  const angle = (phase - .25) * 360;
  return `<g class="orrery-hand-controls" stroke-linejoin="round" stroke-linecap="round">
    <rect x="38" y="378" width="564" height="141" rx="12" fill="#735037" stroke="#553d29" stroke-width="3"/>
    <path d="M49 384h542M48 513h544" stroke="#b48d60" fill="none"/>
    <g transform="translate(145 434)" data-orrery-control="selector" role="slider" tabindex="0" aria-label="拨动选星盘" aria-valuemin="0" aria-valuemax="8" aria-valuenow="${selection}" aria-valuetext="${names[selection]}">
      <circle r="47" fill="#b18a53" stroke="#433c32" stroke-width="3"/><circle r="41" fill="#ecdfbb"/>${names.map((_, i) => tick(i)).join('')}
      <path transform="rotate(${selection * 40})" d="M-3 4L0 -36 4 4Z" fill="#375058"/>
      <circle r="12" fill="#8a683e" stroke="#5b452f" stroke-width="2"/>
    </g>
    <g transform="translate(320 434)" data-orrery-control="lever" role="button" tabindex="0" aria-label="${cut ? '扳回红柄，观察整体' : '扳开红柄，剖视轮系'}" aria-pressed="${cut}">
      <rect x="-62" y="-48" width="124" height="91" rx="8" fill="transparent"/>
      <path d="M-32 -19Q0 -48 32 -19" fill="none" stroke="#c8a676" stroke-width="5"/>
      <circle cy="17" r="15" fill="#9b7e55" stroke="#514432" stroke-width="3"/>
      <g transform="rotate(${cut ? 36 : -36} 0 17)"><path d="M0 17v-49" stroke="#3b5058" stroke-width="9"/><circle cy="-34" r="11" fill="#8e4739" stroke="#653b31" stroke-width="3"/></g>
    </g>
    <g transform="translate(496 434)" data-orrery-control="crank" role="slider" tabindex="0" aria-label="转动手摇轮" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(phase * 100)}">
      <circle r="48" fill="transparent"/><g transform="rotate(${-angle})"><circle r="33" fill="none" stroke="#ceb281" stroke-width="6"/>
      <path d="M33 0Q15 -4 0 0Q-12 -9 -16.5 -28.6M0 0Q-13 7 -16.5 28.6" fill="none" stroke="#c9a56e" stroke-width="5"/>
      <circle r="7" fill="#a5804e"/><circle cx="33" r="9" fill="#493326" stroke="#d1b079" stroke-width="2"/></g>
    </g>
    <g pointer-events="none" font-family="FieldSerif,SimSun,serif" font-size="29" text-anchor="middle" fill="#fbefce"><text x="145" y="506">选星</text><text x="320" y="506">${cut ? '合拢' : '剖视'}</text><text x="496" y="506">手摇</text></g>
  </g>`;
}

/** The SVG is replaced as the model moves. Capture the pointer on its persistent
 * reader and retain the original control's coordinate transform for this grab. */
export function bindOrreryDrawing(reader: HTMLElement, state: () => Observing | null, change: (value: ModelInputChange) => void) {
  let grab: { id: number; key: Control; inverse: DOMMatrix; x: number; y: number; moved: boolean; offset: number } | null = null;
  const part = (event: Event) => (event.target as Element).closest<SVGGraphicsElement>('[data-orrery-control]');
  function move(event: PointerEvent, commit: boolean) {
    const model = state();
    if (!grab || grab.id !== event.pointerId || !model) return;
    const at = new DOMPoint(event.clientX, event.clientY).matrixTransform(grab.inverse);
    grab.moved ||= Math.hypot(event.clientX - grab.x, event.clientY - grab.y) > 3;
    if (grab.key === 'crank' && grab.moved) {
      const raw = phaseFromDialPoint(at.x, -at.y, crank, model.phase - grab.offset);
      change({ phase: (raw + grab.offset + 1) % 1, commit });
    } else if (grab.key === 'selector' && (grab.moved || commit)) {
      const selection = nearestDialStop(at.x, -at.y, selector);
      if (selection !== null && selection !== model.selection) change({ selection, commit });
      else if (commit) change({ commit });
    } else if (grab.key === 'lever' && commit) {
      const cut = grab.moved ? at.x > 0 : model.inspection !== 'train';
      change({ inspection: cut ? 'train' : 'overview', commit });
    } else if (commit) change({ commit });
  }
  reader.addEventListener('pointerdown', event => {
    const control = part(event), matrix = control?.getScreenCTM(), model = state();
    if (!control || !matrix || !model || grab || event.button !== 0) return;
    event.preventDefault();
    control.focus({ preventScroll: true });
    const inverse = matrix.inverse(), at = new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse);
    grab = { id: event.pointerId, key: control.dataset.orreryControl as Control, inverse,
      x: event.clientX, y: event.clientY, moved: false, offset: model.phase - phaseFromDialPoint(at.x, -at.y, crank, model.phase) };
    reader.setPointerCapture(event.pointerId);
    change({ commit: false });
  });
  reader.addEventListener('pointermove', event => move(event, false));
  reader.addEventListener('pointerup', event => {
    if (!grab || grab.id !== event.pointerId) return;
    move(event, true); grab = null;
    if (reader.hasPointerCapture(event.pointerId)) reader.releasePointerCapture(event.pointerId);
  });
  const cancel = (event: PointerEvent) => {
    if (event.pointerId === grab?.id) { grab = null; change({ commit: true }); }
  };
  reader.addEventListener('pointercancel', cancel);
  reader.addEventListener('lostpointercapture', cancel);
  reader.addEventListener('keydown', event => {
    const control = part(event), model = state();
    if (!control || !model) return;
    const key = control.dataset.orreryControl, step = ['ArrowRight','ArrowUp'].includes(event.key) ? 1 : ['ArrowLeft','ArrowDown'].includes(event.key) ? -1 : 0;
    if (key === 'lever' && ['Enter',' '].includes(event.key)) change({ inspection: model.inspection === 'train' ? 'overview' : 'train', commit: true });
    else if (key !== 'lever' && (step || event.key === 'Home' || event.key === 'End')) {
      if (key === 'crank') change({ phase: step ? (model.phase + step / 72 + 1) % 1 : Number(event.key === 'End'), commit: true });
      else change({ selection: step ? (model.selection + step + 9) % 9 : event.key === 'End' ? 8 : 0, commit: true });
    } else return;
    event.preventDefault(); event.stopImmediatePropagation();
  });
}

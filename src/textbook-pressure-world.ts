import { THREE as T } from './reference/engine.js';
import { TextbookGeometry, LIFT_MARGIN, type ModelMotion, type Vec3 } from './textbook-geometry';
import { createAirInstrumentRig } from './textbook-air-instrument-rig';

/** A text-origin scene: the paragraph about the cause of wind opens into a
 * level pressure field. It does not need or replace a textbook illustration. */
export function buildPressureWind(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, rise = 49 * s, back = -LIFT_MARGIN - 38 * s;
  const p = (x: number, z: number, y = 0): Vec3 => [x * s, y * s, back + z * s];
  b.root.position.set(0, rise, -8 * s);
  const rig = createAirInstrumentRig(b, s, back);
  // One low instrument bed, with a recessed comparison surface. The enamel
  // shoulder locates both pillars and controls instead of resembling a blank
  // white display board with unrelated objects placed on top.
  rig.plate([0, -2.4, 0], [100, -1.4, 52], 'wood', 'pressure-table-timber-edge', .24);
  rig.plate([.4, -1.4, .4], [99.6, -1, 51.6], 'brass', 'pressure-table-inlay', .12);
  rig.plate([.8, -1, .8], [99.2, 1.1, 51.2], 'enamel', 'pressure-instrument-casting', .32);
  rig.plate([5, .95, 17], [95, 1.15, 47], 'ivory', 'single-level-comparison-plane', .05);
  for (const x of [8, 92]) for (const z of [5, 47])
    rig.stepped([x, -4, z], [x, -2.3, z], [[1.7, 0], [2, .15], [2, .35], [1.45, .8], [1.45, 1]], 'enamel', 'pressure-bed-levelling-foot');
  // All isobars and both pressure labels belong to ONE horizontal level.
  for (const x of [12, 31, 50, 69, 88]) b.stroke([p(x, 18, 1.17), p(x, 46, 1.17)], .28);
  // Paired relative indicators share their mounting rail and centre height.
  // They are qualitative comparison instruments, not weather barometers.
  rig.sameHeightRail(8, 92, 15.3, 6);
  const gauges = [15, 85].map(x => {
    rig.plate([x - 4, 1.1, 3], [x + 4, 2.1, 10], 'enamel', 'pressure-gauge-foot', .28);
    rig.stepped([x, 2.1, 6], [x, 15.3, 6], [[1.9, 0], [1.9, .08], [1.35, .14], [.82, .24], [.72, .84], [1.3, .94], [1.3, 1]], 'brass', 'pressure-gauge-pedestal');
    rig.fasteners([[x - 2.7, 2.14, 4.4], [x + 2.7, 2.14, 8.6]], .32);
    rig.rod([x, 15.3, 6], [x, 15.3, 8.6], .65, 'steel', 'pressure-gauge-back-spindle');
    const gauge = rig.gauge([x, 15.3, 10], 8.8, `relative-pressure-${x}`);
    gauge.body.userData.modelInput = { kind: 'select', selection: 0, label: '比较同一高度的相对气压' };
    return gauge;
  });
  const high = b.label('相对高压', p(15, 12, 28.4), 24 * s, 6.3 * s);
  const low = b.label('相对低压', p(85, 12, 28.4), 24 * s, 6.3 * s);
  const equal = b.label('同一高度 · 气压相同', p(50, 11, 28.4), 55 * s, 6.3 * s);
  const selector = rig.stepped([50, 1.2, 48], [50, 3.5, 48], [[2.7, 0], [2.7, .18], [3.1, .26], [3.1, .75], [2.7, 1]], 'brass', 'pressure-condition-selector');
  selector.userData.modelInput = { kind: 'select', selection: 1, label: '切换到同压对照' };
  rig.fasteners([[6, 1.25, 6], [94, 1.25, 6], [6, 1.25, 46], [94, 1.25, 46]], .4);

  const flags: { mesh: any; rest: Float32Array }[] = [];
  for (const x of [50]) {
    const foot = p(x, 37, 1.2), top = p(x, 37, 17);
    rig.stepped([x, 1.2, 37], [x, 3.5, 37], [[1.9, 0], [1.9, .23], [1.1, .5], [.7, 1]], 'brass', 'wind-flag-socket');
    rig.rod([x, 2, 37], [x, 17, 37], .22, 'steel', 'wind-flag-mast'); b.stroke([foot, top], .24);
    const cloth = new T.PlaneGeometry(10 * s, 3 * s, 24, 5); cloth.translate(5 * s, 0, 0);
    const mesh = b.mesh(cloth, '#b8cbbf', false, false); mesh.position.set(top[0], top[1] - 2 * s, top[2]);
    flags.push({ mesh, rest: new Float32Array(cloth.attributes.position.array) });
  }
  let clock = 0, difference = true;
  return {
    update(phase, selection) {
      difference = selection === 0;
      clock = phase * 2;
      high.visible = low.visible = difference; equal.visible = !difference;
      gauges.forEach((g, i) => g.set(difference ? i === 0 ? 1 : -1 : 0));
      selector.userData.modelInput = { kind: 'select', selection: difference ? 1 : 0,
        label: difference ? '切换到同压对照' : '切换到有气压差' };
      if (difference) for (const z of [25, 44]) b.trace([p(9, z, 5), p(91, z, 5)], clock + z * .014, 3);
      for (const flag of flags) {
        const a = flag.mesh.geometry.attributes.position;
        for (let j = 0; j < a.count; j++) {
          const x = flag.rest[j * 3], y = flag.rest[j * 3 + 1], u = x / (10 * s);
          a.setXYZ(j, difference ? x : x * .08, y - (difference ? .3 : 7.5) * s * u,
            difference ? Math.sin(u * 8 - clock * 75) * .45 * s * u : 0);
        }
        a.needsUpdate = true; flag.mesh.geometry.computeVertexNormals(); flag.mesh.geometry.computeBoundingSphere();
        for (const ids of [Array.from({ length: 25 }, (_, j) => j), Array.from({ length: 25 }, (_, j) => 125 + j), [24, 49, 74, 99, 124, 149]])
          b.contour(ids.map(j => [a.getX(j) + flag.mesh.position.x, a.getY(j) + flag.mesh.position.y, a.getZ(j) + flag.mesh.position.z]), .48);
      }
    },
    describe: () => ({ kind: 'pressure-gradient-wind', origin: 'textbook-paragraph', sameHeight: true,
      pressureDifference: difference, windDirection: difference ? 'high-to-low' : 'none-in-this-idealized-component',
      phase: clock / 2, elevatedAbovePage: rise, measuredPressure: false,
      specimenConstruction: 'paired-same-height-relative-indicators', gaugeCentreHeight: 15.3,
      relativeReadouts: difference ? [1, -1] : [0, 0], nativeConditionSelector: true }),
    focusBounds: () => ({ min: p(-5, -3, -1.5), max: p(105, 62, 33) }),
  };
}

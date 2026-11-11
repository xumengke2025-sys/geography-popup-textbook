import { buildSoilPoreInstrument } from './textbook-soil-pore-world';
import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { PALETTE as C, LIFT_MARGIN, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { evaluateCaveDeposition, evaluateSeismicParticles } from './textbook-ground-process-model';

function scene(b: TextbookGeometry) {
  const s = b.width / 100, z = -LIFT_MARGIN - b.height * .45;
  return { s, z, p: (x: number, y: number, d = 0): Vec3 => [x * s, y * s, z + d * s],
    bounds: (h: number) => ({ min: [0, 0, z - 18 * s] as Vec3, max: [b.width, h * s, z + 20 * s] as Vec3 }) };
}
const lightPaper = (b: TextbookGeometry, color: string) => createSpecimenMaterial(b.pop, { color, ink: '#7e7c6c', spacing: 3.8, hatch: .17, shade: .09, seed: 49 });

export function buildSeismicMediumWorld(b: TextbookGeometry): ModelMotion {
  const { s, p, bounds } = scene(b);
  const left = b.box(p(5, 0, -9), p(49, 3, 10), C.rock, false);
  const right = b.box(p(51, 0, -9), p(96, 3, 10), C.sea, false);
  const solid = b.label('固体', p(26, 3.5, 15), 13 * s, 6 * s);
  const liquid = b.label('液体', p(75, 3.5, 15), 13 * s, 6 * s);
  const otherSolid = b.label('固体', p(75, 3.5, 15), 13 * s, 6 * s);
  b.label('P 波', p(7, 14, 2), 10 * s, 5.8 * s); b.label('S 波', p(7, 29, 2), 10 * s, 5.8 * s);
  const start = evaluateSeismicParticles(0);
  const rows = [14, 29].map((height, row) => start.particles.map(particle => {
    const mesh = b.sphere([0, 0, 0], .92 * s, row ? C.cool : C.warm, false);
    mesh.userData.seismicParticleId = particle.id; return { mesh, rest: p(particle.restX, height) };
  }));
  right.userData.modelInput = { kind: 'select', selection: 1, toggleTo: 0, label: '对照右侧固体与液体' };
  [liquid, otherSolid].forEach(m => { m.userData.modelInput = right.userData.modelInput; });
  let state = start;
  return { update(phase, selection) {
    state = evaluateSeismicParticles(phase, selection); liquid.visible = state.liquid; otherSolid.visible = !state.liquid;
    right.material = b.material(state.liquid ? C.sea : C.rock); b.outline(left, .45); b.outline(right, .45);
    rows.forEach((row, kind) => row.forEach(({ mesh, rest }, i) => {
      const particle = state.particles[i], dx = kind ? 0 : particle.pDx * s, dy = kind ? particle.sDy * s : 0;
      mesh.position.set(rest[0] + dx, rest[1] + dy, rest[2]);
      mesh.material = b.material(kind && !particle.transmittedS ? '#c6d3d0' : kind ? C.cool : C.warm);
      // Fixed equilibrium crosses remain still while the same bead oscillates.
      if (i % 3 === 0) {
        b.contour([[rest[0] - .65 * s, rest[1], rest[2] + .2 * s], [rest[0] + .65 * s, rest[1], rest[2] + .2 * s]], .35);
        b.contour([[rest[0], rest[1] - .65 * s, rest[2] + .2 * s], [rest[0], rest[1] + .65 * s, rest[2] + .2 * s]], .35);
        b.contour([rest, mesh.position.toArray()], .42);
      }
    }));
    for (const y of [19, 35]) b.trace([p(14, y), p(y === 35 && state.liquid ? 47 : 85, y)], phase, 2, 'flow', 1, .75);
    // The boundary is an observation line, not a wall stopping P waves.
    b.contour([p(50, 5, -1), p(50, 37, -1)], .45);
  }, focusBounds: () => bounds(40), describe: () => ({ kind: 'seismic-medium', ...state,
    pTransmits: true, sTransmitsAcrossBoundary: !state.liquid, fixedEquilibriumMarks: true, velocityIsMeasured: false }) };
}

export function buildCaveDepositionWorld(b: TextbookGeometry): ModelMotion {
  const { s, p, bounds } = scene(b), back = -9, front = 10;
  const arch = (radiusX: number, radiusY: number, steps = 48) => Array.from({ length: steps + 1 }, (_, i) => {
    const a = i / steps * Math.PI; return [50 + Math.cos(a) * radiusX, 10 + Math.sin(a) * radiusY] as [number, number];
  });
  const outer = arch(45, 32), inner = arch(40, 27), shell = new T.Shape();
  outer.concat([...inner].reverse()).forEach(([x, y], i) => i ? shell.lineTo(x * s, y * s) : shell.moveTo(x * s, y * s)); shell.closePath();
  const roofGeometry = new T.ExtrudeGeometry(shell, { depth: (front - back) * s, bevelEnabled: false, curveSegments: 32 });
  roofGeometry.translate(0, 0, p(0, 0, back)[2]);
  const roof = b.mesh(roofGeometry, C.rock, false); roof.material = lightPaper(b, '#c2b59a');
  const wall = new T.Shape(); wall.moveTo(10 * s, 3 * s); wall.lineTo(90 * s, 3 * s);
  inner.forEach(([x, y]) => wall.lineTo(x * s, y * s)); wall.closePath();
  const wallGeometry = new T.ExtrudeGeometry(wall, { depth: 1.3 * s, bevelEnabled: false, curveSegments: 32 });
  wallGeometry.translate(0, 0, p(0, 0, back - 1.5)[2]);
  const rear = b.mesh(wallGeometry, '#c5c2ad', false); rear.material = lightPaper(b, '#c5c2ad');
  b.box(p(5, 0, back - 2), p(95, 4, front + 5), '#b7aa8e', false);
  b.box(p(5, 4, back), p(10, 10, front), C.rock, false); b.box(p(90, 4, back), p(95, 10, front), C.rock, false);
  // The front arch is cut away; a retained back wall blocks the printed photo
  // from visually filling the cavity and keeps its depth legible.
  for (const curve of [outer, inner]) b.stroke(curve.map(([x, y]) => p(x, y, front + .06)), .6);
  const initial = evaluateCaveDeposition(0), columns = initial.deposits.map(deposit => {
    const top = b.mesh(new T.ConeGeometry(2.35 * s, s, 14), '#e1d2af', false); top.geometry.rotateZ(Math.PI);
    const bottom = b.mesh(new T.ConeGeometry(2.7 * s, s, 14), '#d0be99', false);
    [top, bottom].forEach(m => { m.material = lightPaper(b, '#d9c8a3'); m.userData.modelInput = { kind: 'replay', selection: 1, label: '观察同一落点的滴水沉积' }; });
    return { top, bottom };
  });
  const drops = initial.drops.map(drop => {
    const mesh = b.sphere([0, 0, 0], .65 * s, C.water, false, [.65, 1.35, .65]); mesh.userData.dropId = drop.id; return mesh;
  });
  b.label('溶洞剖切', p(50, 48, -2), 25 * s, 6.5 * s);
  const topTag = b.label('石钟乳', p(15, 29, front + 6), 17 * s, 6.2 * s);
  const bottomTag = b.label('石笋', p(84, 8, front + 6), 13 * s, 6.2 * s);
  roof.userData.modelInput = { kind: 'select', selection: 1, toggleTo: 0, label: '观察滴水与沉积' };
  let state = initial;
  return { update(phase, selection) {
    state = evaluateCaveDeposition(phase, selection); topTag.visible = bottomTag.visible = state.deposition;
    columns.forEach(({ top, bottom }, i) => {
      const deposit = state.deposits[i], d = 1 + (i % 2) * 2;
      top.scale.y = deposit.hanging; top.position.set(...p(deposit.u * 100, deposit.ceiling - deposit.hanging / 2, d));
      bottom.scale.y = deposit.rising; bottom.position.set(...p(deposit.u * 100, 4 + deposit.rising / 2, d));
      b.outline(top, .5); b.outline(bottom, .5);
      if (state.deposition) b.contour([p(deposit.u * 100, deposit.ceiling - deposit.hanging, d), p(deposit.u * 100, 4 + deposit.rising, d)], .2);
    });
    drops.forEach((mesh, i) => {
      const drop = state.drops[i], deposit = state.deposits[drop.site]; mesh.visible = drop.visible;
      const top = deposit.ceiling - deposit.hanging, low = 4 + deposit.rising;
      mesh.position.set(...p(drop.u * 100, top + (low - top) * drop.progress, 1 + drop.site % 2 * 2));
    });
  }, focusBounds: () => bounds(52), describe: () => ({ kind: 'karst-cave', ...state,
    actualVoid: true, retainedBackWall: true, originalPagePreserved: true, timeIsGeologicalYears: false }) };
}

export function buildSoilPoreWorld(b: TextbookGeometry): ModelMotion {
  return buildSoilPoreInstrument(b);
}

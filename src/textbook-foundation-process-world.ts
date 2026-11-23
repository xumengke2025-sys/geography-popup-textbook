import { buildSoilPoreInstrument } from './textbook-soil-pore-world';
import { PALETTE as C, LIFT_MARGIN, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { evaluateSeismicParticles } from './textbook-ground-process-model';

function scene(b: TextbookGeometry) {
  const s = b.width / 100, z = -LIFT_MARGIN - b.height * .45;
  return { s, z, p: (x: number, y: number, d = 0): Vec3 => [x * s, y * s, z + d * s],
    bounds: (h: number) => ({ min: [0, 0, z - 18 * s] as Vec3, max: [b.width, h * s, z + 20 * s] as Vec3 }) };
}

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

export function buildSoilPoreWorld(b: TextbookGeometry): ModelMotion {
  return buildSoilPoreInstrument(b);
}

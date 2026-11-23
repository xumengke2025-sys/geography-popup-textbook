import { mountFieldInstrument } from './textbook-field-instruments';
import { LIFT_MARGIN, type TextbookGeometry, type Vec3, type ModelMotion } from './textbook-geometry';
import { riverValleySurfaceHeight, valleySection } from './textbook-natural-form-geometry';

export function buildValleyWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, z0 = -LIFT_MARGIN - b.height * .62;
  const point = (x: number, h: number, z: number): Vec3 => [x * s, h * s, z0 + z * s];
  const parts = mountFieldInstrument(b, 'river-valley', s, point(0, 0, 0));
  const carriage = parts.get('carriage')!;
  const track = { start: point(105, 5.7, 12 - 1.06), end: point(105, 5.7, 51 - 1.06) };
  for (const mesh of carriage) mesh.userData.modelInput = { kind: 'phase-track', track, label: '沿钢轨推拉测架，比较两岸与水面的高度' };
  const terrains = ['mountain', 'plain'].map(name => parts.get(name)!);
  const keys = terrains.map((_, i) => {
    const meshes = parts.get('key' + i)!;
    for (const mesh of meshes) {
      mesh.userData.modelInput = { kind: 'select', selection: i, label: i ? '按下平原标本键' : '按下山地标本键' };
      mesh.userData.smallPointTarget = true;
    }
    return meshes;
  });
  const probes = [27, 50, 73].map((x, i) => ({ x, reel: parts.get('reel' + i)!,
    line: parts.get('line' + i)!, bob: parts.get('bob' + i)! }));
  let plain = false, section = valleySection(0, false);
  const flowPath = Array.from({ length: 31 }, (_, i) => {
    const v = i / 30, u = .5 + .035 * Math.sin(v * 4);
    return point(100 * u, riverValleySurfaceHeight(u, v, false) + .58, 60 * v);
  });
  const hull: Vec3[] = [];
  for (const z of [-5.5, 67.5]) {
    for (const x of [-2, 106]) hull.push(point(x, -4.8, z), point(x, 0, z));
    for (const x of [3.5, 96.5]) hull.push(point(x, 34, z));
  }
  for (const z of [11, 50]) for (const x of [25, 103]) hull.push(point(x, 41, z));
  return {
    focusBounds: () => ({ min: point(-2, -4.8, -5.5), max: point(108, 41, 67.5) }),
    framingPoints: () => hull,
    update(phase, selection) {
      plain = selection >= .5;
      section = valleySection(phase, plain);
      const travel = (60 * section.v - 13.06) * s;
      for (let i = 0; i < terrains.length; i++) {
        const active = i === Number(plain);
        for (const mesh of terrains[i]) mesh.visible = active;
        for (const mesh of keys[i]) mesh.position.y = active ? -.58 * s : 0;
      }
      for (const mesh of carriage) mesh.position.z = travel;
      probes.forEach(({ x, reel, line, bob }, i) => {
        const probe = section.probes[i], dx = (100 * probe.u - x) * s;
        const tip = probe.height + .04, cord = tip + 2.64;
        for (const mesh of reel) mesh.position.set(dx, 0, travel);
        for (const mesh of bob) mesh.position.set(dx, tip * s, travel);
        for (const mesh of line) {
          mesh.position.set(dx, cord * s, travel);
          mesh.scale.y = 38.24 - cord;
        }
      });
      const crossSection = Array.from({ length: 81 }, (_, i) => {
        const u = .035 + .93 * i / 80;
        return point(100 * u, riverValleySurfaceHeight(u, section.v, plain) + .15, 60 * section.v);
      });
      b.contour(crossSection, .64);
      b.trace(flowPath, .55, 4);
    },
    describe: () => ({ kind: 'river-valley-comparison', environment: plain ? 'plain' : 'mountain',
      crossSection: plain ? 'wide-shallow-trough' : 'V', phaseMeaning: 'moving-section-observation',
      sectionFraction: section.v, probes: section.probes, distinctEnvironments: true,
      glacierValleyIncluded: false, realElevationData: false, buffersStable: true }),
  };
}

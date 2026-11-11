import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { PALETTE as C, LIFT_MARGIN, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { evaluateHaze } from './textbook-haze-model';
import type { ModelInput } from './textbook-model-input';

/** A small paper city and actual movable parcels in the air above the page.
 * One reusable batched mesh avoids one draw call per parcel. */
export function buildHazeWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, back = -LIFT_MARGIN - 72 * s;
  const p = (x: number, z: number, y = 0): Vec3 => [x * s, y * s, back + z * s];
  const box = (x: number, z: number, w: number, d: number, h: number, color = C.paper) => b.box(p(x - w / 2, z - d / 2, 1.4), p(x + w / 2, z + d / 2, h), color);
  b.box(p(4, 18), p(101, 61, 1.4), C.land);
  for (const [x, z, w, h] of [[35, 38, 8, 10], [49, 35, 9, 16], [64, 39, 8, 12], [78, 34, 9, 19], [91, 39, 7, 13]]) {
    box(x, z, w, 9, h);
    for (let row = 0; row < 3; row++) for (let column = 0; column < 2; column++) {
      const xx = x - w * .32 + column * w * .39, yy = 3.4 + row * 2.6;
      b.stroke([p(xx, z + 4.6, yy), p(xx + 1.5, z + 4.6, yy)], .28);
    }
  }
  const factory = box(17, 40, 16, 13, 8, C.rock);
  const chimney = b.cylinder(p(17, 40, 8), p(17, 40, 19), 1.35 * s, C.rock);
  const reduced: ModelInput = { kind: 'select', selection: 2, toggleTo: 0, label: '点烟囱，比较减少排放与原排放' };
  for (const mesh of [chimney, factory]) mesh.userData.modelInput = reduced;
  const valve = b.sphere(p(21, 46.7, 7), 1.6 * s, C.warm, false, [1, 1, .3]);
  valve.userData.modelInput = reduced; valve.userData.emissionValve = true;
  const sourceLabel = b.label('排放', p(17, 59, 5), 11 * s, 5 * s); sourceLabel.userData.modelInput = reduced;
  const vent: ModelInput = { kind: 'select', selection: 1, toggleTo: 0, label: '点风旗，比较通风与微风' };
  const pole = b.cylinder(p(99, 52, 1.4), p(99, 52, 29), .3 * s, C.rock);
  pole.userData.modelInput = vent;
  const flagGeometry = new T.PlaneGeometry(8 * s, 5 * s, 8, 4);
  const originalFlag = new Float32Array(flagGeometry.attributes.position.array);
  const flag = b.mesh(flagGeometry, C.water, false, false);
  flag.position.set(...p(99, 52, 28)); flag.userData.modelInput = vent; flag.userData.windFlag = true;
  const ventLabel = b.label('通风', p(99, 64, 8), 11 * s, 5 * s); ventLabel.userData.modelInput = vent;
  const pellet = new T.SphereGeometry(1, 8, 5).toNonIndexed();
  const sourcePositions = pellet.attributes.position.array, sourceNormals = pellet.attributes.normal.array;
  const state0 = evaluateHaze(0, 0), count = state0.particles.length, stride = sourcePositions.length;
  const positions = new Float32Array(stride * count), normals = new Float32Array(stride * count);
  for (let i = 0; i < count; i++) normals.set(sourceNormals, i * stride);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage));
  geometry.setAttribute('normal', new T.BufferAttribute(normals, 3));
  const parcels = b.mesh(geometry, '#66796f', false);
  parcels.material = createSpecimenMaterial(b.pop, { color: '#66796f', ink: '#46594f', hatch: .025, shade: .08, spacing: 3.4, seed: 511 });
  parcels.material.side = T.DoubleSide;
  parcels.frustumCulled = false; parcels.userData.pollutionParcels = true; pellet.dispose();
  let state = state0;
  const openMaterial = b.material(C.warm), lowMaterial = b.material(C.green);
  const draw = () => {
    for (const parcel of state.particles) {
      const at = p(parcel.x, parcel.z, parcel.y), radius = parcel.visible ? parcel.size * s : 0, offset = parcel.id * stride;
      for (let j = 0; j < stride; j += 3) {
        positions[offset + j] = at[0] + sourcePositions[j] * radius;
        positions[offset + j + 1] = at[1] + sourcePositions[j + 1] * radius;
        positions[offset + j + 2] = at[2] + sourcePositions[j + 2] * radius;
      }
    }
    geometry.attributes.position.needsUpdate = true;
  };
  return {
    update(phase, selection) {
      state = evaluateHaze(phase, selection); draw();
      // These three members of the original stock retain their identity in
      // every trial. Short tails show departure, while unremoved marks stay.
      const prior = evaluateHaze(Math.max(0, phase - .035), selection);
      for (const id of [0, 12, 24]) {
        const parcel = state.particles[id], earlier = prior.particles[id];
        if (!parcel.visible) continue;
        if (state.windStrength > .05) b.contour([p(earlier.x, earlier.z, earlier.y), p(parcel.x, parcel.z, parcel.y)], .33);
        const r = parcel.size * 1.2;
        b.contour(Array.from({ length: 13 }, (_, i) => {
          const angle = i / 12 * Math.PI * 2;
          return p(parcel.x + Math.cos(angle) * r, parcel.z + r, parcel.y + Math.sin(angle) * r);
        }), .29);
      }
      valve.material = state.mode === 2 ? lowMaterial : openMaterial;
      const attribute = flagGeometry.attributes.position;
      for (let i = 0; i < attribute.count; i++) {
        const u = originalFlag[i * 3] / (8 * s) + .5, v = originalFlag[i * 3 + 1] / (5 * s) + .5;
        const wind = .12 + state.windStrength * .88;
        attribute.setXYZ(i, u * 8 * s * wind,
          -(1 - v) * 5 * s - u * (1 - wind) * 7 * s,
          Math.sin(u * 8 - phase * 24 + v * 2) * u * wind * .8 * s);
      }
      attribute.needsUpdate = true; flagGeometry.computeVertexNormals(); flagGeometry.computeBoundingSphere();
      const a: Vec3[] = [];
      for (let j = 0; j <= 8; j++) a.push([attribute.getX(j), attribute.getY(j), attribute.getZ(j)]);
      for (let j = 1; j <= 4; j++) { const i = j * 9 + 8; a.push([attribute.getX(i), attribute.getY(i), attribute.getZ(i)]); }
      for (let j = 7; j >= 0; j--) { const i = 36 + j; a.push([attribute.getX(i), attribute.getY(i), attribute.getZ(i)]); }
      b.contour(a.map(q => [q[0] + flag.position.x, q[1] + flag.position.y, q[2] + flag.position.z]), .55);
      if (state.windStrength > .03) for (const z of [28, 53]) b.trace([p(6, z, 43), p(105, z, 43)], phase * 1.8, 2, 'flow', 1, state.windStrength);
    },
    focusBounds: () => ({ min: p(2, 12, 0), max: p(111, 69, 51) }),
    describe: () => ({ ...state, particles: undefined, parcelSample: state.particles.filter(p => p.visible).slice(0, 8),
      originalPagePreserved: true, sameInitialStock: true, directTargets: ['chimney', 'wind-flag'],
      batchedParcelMesh: true, meshCountDoesNotGrow: true }),
  };
}

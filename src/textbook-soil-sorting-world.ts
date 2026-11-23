import { applyEarthScan } from './textbook-earth-scan';
import { mountSpecimenDial } from './textbook-specimen-dial';
import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { evaluateSoilSorting, soilSortingChannel, soilSortingHeight, SOIL_GRAIN_COLORS, SOIL_SORTING_LABELS, SOIL_SORTING_REFERENCE } from './textbook-soil-sorting-model';

/** Fixed meshes and buffers. Selection 4 alone owns this miniature landscape;
 * every location is evaluated from progress, with no accumulated simulation. */
export function buildSoilSortingWorld(b: TextbookGeometry): ModelMotion {
  const start = b.meshes.length, s = b.width / 100, depth = 57 * s;
  const z0 = -LIFT_MARGIN - b.height * .62, z1 = z0 + depth;
  const p = (u: number, v: number, h = soilSortingHeight(u, v)): Vec3 => [u * b.width, h * s, z0 + v * depth];
  const nx = 64, nz = 24, vertices: number[] = [], indices: number[] = [], border: [number, number][] = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    vertices.push(...p(i / nx, j / nz));
    if (i < nx && j < nz) { const k = j * (nx + 1) + i; indices.push(k, k + nx + 1, k + 1, k + 1, k + nx + 1, k + nx + 2); }
  }
  for (let i = 0; i <= nx; i++) border.push([i / nx, 0]);
  for (let j = 1; j <= nz; j++) border.push([1, j / nz]);
  for (let i = nx - 1; i >= 0; i--) border.push([i / nx, 1]);
  for (let j = nz - 1; j > 0; j--) border.push([0, j / nz]);
  for (let i = 0; i < border.length; i++) {
    const a = border[i], z = border[(i + 1) % border.length], k = vertices.length / 3;
    vertices.push(...p(...a), ...p(...z), ...p(z[0], z[1], 0), ...p(a[0], a[1], 0));
    indices.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  const k = vertices.length / 3;
  vertices.push(...p(0, 0, 0), ...p(1, 0, 0), ...p(1, 1, 0), ...p(0, 1, 0)); indices.push(k, k + 1, k + 2, k, k + 2, k + 3);
  const terrain = new T.BufferGeometry(); terrain.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); terrain.setIndex(indices); terrain.computeVertexNormals();
  const land = b.mesh(terrain, '#d0c3a6', false);
  land.material = createSpecimenMaterial(b.pop, { color: '#d0c3a6', ink: '#72745d', spacing: 2.8, hatch: .15, shade: .08, seed: 53 }); land.material.side = T.DoubleSide;
  land.userData.soilSortingRole = 'slope';
  applyEarthScan(land.material,'alluvium',13*s);
  const releaseWheel=mountSpecimenDial(b,p(.16,1.06,4.5),4.5*s,{label:'转动冲刷记录轮，追踪粗细颗粒',turns:1});
  const grainGeometry = new T.IcosahedronGeometry(1, 0);
  const particles = evaluateSoilSorting(0).grains.map(grain => {
    const mesh = b.mesh(grainGeometry, SOIL_GRAIN_COLORS[grain.size], false);
    mesh.userData.soilSortingRole = 'grain'; mesh.userData.soilGrainId = grain.id; mesh.userData.soilGrainSize = grain.size;
    mesh.scale.set(grain.radius * s, grain.radius * s * .7, grain.radius * s * .88);
    return mesh;
  });
  const waterMaterial = createSpecimenMaterial(b.pop, { color: '#85aab0', ink: '#557b80', spacing: 3.1, hatch: .04, shade: .025, seed: 23 });
  waterMaterial.side = T.DoubleSide;
  const streams = Array.from({ length: 3 }, (_, lane) => {
    const geometry = new T.BufferGeometry(), attribute = new T.Float32BufferAttribute(new Float32Array(65 * 6), 3), ix: number[] = [];
    for (let i = 0; i < 64; i++) { const k = i * 2; ix.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    geometry.setAttribute('position', attribute); geometry.setIndex(ix);
    const mesh = b.mesh(geometry, '#85aab0', false, false); mesh.material = waterMaterial; mesh.userData.soilSortingRole = 'water';
    return { lane, geometry, attribute, mesh };
  });
  const labels = [.15, .55, .88].map((u, i) => b.label(SOIL_SORTING_LABELS[i], p(u, 1.18, 10.2), (i === 1 ? 15 : 29) * s, 6.2 * s));
  labels.forEach(mesh => { mesh.userData.soilSortingRole = 'place-label'; });
  const owned = b.meshes.slice(start);
  let state = evaluateSoilSorting(0);
  return {
    update(phase, selection) {
      const active = Math.round(selection) === 4;
      for (const mesh of owned) mesh.visible = active;
      if (!active) return;
      state = evaluateSoilSorting(phase); releaseWheel(phase,0);
      const boundary = border.map(([u, v]) => p(u, v, soilSortingHeight(u, v) + .035));
      b.contour(boundary.concat([boundary[0]]), .58);
      for (const u of [0, .13, .26, .39, .52, .65, .78, 1]) {
        const contour = Array.from({ length: 33 }, (_, j) => p(u, j / 32, soilSortingHeight(u, j / 32) + .04));
        b.contour(contour, .18);
      }
      for (const [u, v] of [[0, 0], [0, 1], [1, 1]]) b.contour([p(u, v, 0), p(u, v)], .5);
      b.contour([p(0, 1, 0), p(1, 1, 0)], .5);
      state.grains.forEach((grain, i) => {
        const mesh = particles[i];
        mesh.position.set(...p(grain.u, grain.v, grain.height + grain.radius * .42));
        mesh.rotation.set(grain.travel * 4.5 + grain.id, grain.id * .7 + grain.travel * 2.2, grain.travel * .5);
        mesh.userData.u = grain.u; mesh.userData.v = grain.v; mesh.userData.height = grain.height; mesh.userData.deposited = grain.deposited;
        if (grain.size !== 'fine') b.outline(mesh, grain.size === 'coarse' ? .3 : .2);
      });
      streams.forEach(({ lane, mesh, geometry, attribute }) => {
        mesh.visible = state.water.active;
        if (!mesh.visible) return;
        for (let i = 0; i <= 64; i++) {
          const u = .025 + i / 64 * .94 * state.water.reach, v = soilSortingChannel(u, lane);
          const half = (.72 + u * .35) / 57 * state.water.strength;
          attribute.setXYZ(i * 2, ...p(u, v - half, soilSortingHeight(u, v - half) + .14));
          attribute.setXYZ(i * 2 + 1, ...p(u, v + half, soilSortingHeight(u, v + half) + .14));
        }
        attribute.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingSphere();
      });
      for (const tracer of state.water.tracers) {
        const tailV = soilSortingChannel(tracer.tailU, tracer.lane);
        const a = b.v(p(tracer.tailU, tailV, soilSortingHeight(tracer.tailU, tailV) + .4));
        const z = b.v(p(tracer.u, tracer.v, tracer.height + .4)), tangent = z.clone().sub(a).normalize();
        const side = new T.Vector3().crossVectors(tangent, new T.Vector3(0, 1, 0)).normalize();
        const back = z.clone().addScaledVector(tangent, -1.4 * s);
        b.flow.push({ points: [back.clone().addScaledVector(side, .64 * s), z, back.clone().addScaledVector(side, -.64 * s)], width: .8 });
      }
    },
    focusBounds: () => ({ min: [0, 0, z0 - 4 * s], max: [b.width, 49 * s, z1 + 16 * s] }),
    describe: () => ({ kind: 'soil-relief-sorting', reference: SOIL_SORTING_REFERENCE, stage: state.stage,
      phase: state.phase, fixedParticleCount: particles.length, grains: state.grains, deposited: state.deposited,
      water: state.water, transportIsNotAllSoilFormation: true, ratesAreSchematic: true, buffersStable: true }),
  };
}

import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { TextbookGeometry, LIFT_MARGIN, PALETTE as C, type ModelMotion, type Vec3 } from './textbook-geometry';
import { DELTA_BASE, DELTA_TOP, deltaBedHeight, deltaBranchPoint, deltaMainPoint, evaluateDeltaDeposition } from './textbook-delta-model';

/** A paper relief with a cut edge, three unequal distributaries and a fixed
 * sediment-parcel pool. The blue basin is a cutaway, not a depth measurement. */
export function buildDeltaWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, depth = Math.max(48 * s, Math.min(b.height, 68 * s));
  const z0 = -LIFT_MARGIN - b.height * .62;
  const p = (u: number, v: number, h = 0): Vec3 => [u * b.width, h * s, z0 + v * depth];
  let state = evaluateDeltaDeposition(0), selected = 0, previous = -1;
  const base = b.box(p(.025, .025), p(.975, .99, 1.25), '#baae94', false);
  const basin = b.box(p(.025, .30, 1.25), p(.975, .99, 1.47), '#a7c5cc', false);
  const plain = b.prism([[.025 * b.width, p(0, .025)[2]], [.975 * b.width, p(0, .025)[2]],
    [.975 * b.width, p(0, .34)[2]], [.025 * b.width, p(0, .34)[2]]], 1.25 * s, 8.3 * s, C.land, false);
  base.userData.deltaPart = 'base'; basin.userData.deltaPart = 'basin'; plain.userData.deltaPart = 'plain';
  for (const h of [2.6, 5.1]) b.stroke([p(.025, .025, h), p(.025, .34, h)], .24);
  for (let i = 0; i < 11; i++) {
    const u = .07 + i * .079, v = .07 + (i % 3) * .06;
    if (Math.abs(u - deltaMainPoint(v / .34)[0]) > .08) b.stroke([p(u, v, 8.36), p(u + .027, v + .008, 8.36)], .27);
  }
  // The bed includes its underside and cut sides, not an expanding flat fan.
  const nx = 116, nz = 82, vertices: number[] = [], indices: number[] = [];
  const top: { index: number; u: number; v: number }[] = [], rim: number[] = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const u = .035 + .93 * i / nx, v = .325 + .65 * j / nz, index = vertices.length / 3;
    vertices.push(...p(u, v, deltaBedHeight(state, u, v))); top.push({ index, u, v });
    if (i < nx && j < nz) indices.push(index, index + nx + 1, index + 1, index + 1, index + nx + 1, index + nx + 2);
  }
  for (let i = 0; i <= nx; i++) rim.push(i);
  for (let j = 1; j <= nz; j++) rim.push(j * (nx + 1) + nx);
  for (let i = nx - 1; i >= 0; i--) rim.push(nz * (nx + 1) + i);
  for (let j = nz - 1; j > 0; j--) rim.push(j * (nx + 1));
  for (let i = 0; i < rim.length; i++) {
    const a = top[rim[i]], c = top[rim[(i + 1) % rim.length]], k = vertices.length / 3;
    vertices.push(...p(a.u, a.v, deltaBedHeight(state, a.u, a.v)), ...p(c.u, c.v, deltaBedHeight(state, c.u, c.v)),
      ...p(c.u, c.v, DELTA_BASE), ...p(a.u, a.v, DELTA_BASE));
    top.push({ index: k, u: a.u, v: a.v }, { index: k + 1, u: c.u, v: c.v });
    indices.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  const bottom = vertices.length / 3;
  vertices.push(...p(.035, .325, DELTA_BASE), ...p(.965, .325, DELTA_BASE), ...p(.965, .975, DELTA_BASE), ...p(.035, .975, DELTA_BASE));
  indices.push(bottom, bottom + 2, bottom + 1, bottom, bottom + 3, bottom + 2);
  const bedGeometry = new T.BufferGeometry(), bedPositions = new T.Float32BufferAttribute(vertices, 3);
  bedGeometry.setAttribute('position', bedPositions); bedGeometry.setIndex(indices); bedGeometry.computeVertexNormals();
  const bed = b.mesh(bedGeometry, '#c8b48e', false); bed.userData.deltaPart = 'sediment-bed';
  bed.material = createSpecimenMaterial(b.pop, { color: '#c8b48e', ink: '#82765e', spacing: 2.6, hatch: .29, shade: .09, seed: 24 });
  bed.material.side = T.DoubleSide;
  const grainGeometry = new T.IcosahedronGeometry(1, 0);
  const grains = state.grains.map(grain => {
    const mesh = b.mesh(grainGeometry, grain.grainClass === 'coarse' ? '#80623b' : '#b28d58', false);
    // Each parcel is a closed convex solid. Its back faces are hidden, so a
    // second transparent face pass adds cost without changing its silhouette.
    mesh.material.side = T.FrontSide;
    mesh.scale.setScalar(grain.radius * s);
    mesh.userData.deltaPart = 'sediment-grain'; mesh.userData.grainId = grain.id;
    mesh.userData.grainClass = grain.grainClass;
    return mesh;
  });
  function channel(count: number, width: number) {
    const geometry = new T.BufferGeometry(), position = new T.Float32BufferAttribute(new Float32Array((count + 1) * 6), 3), ix: number[] = [];
    for (let i = 0; i < count; i++) { const k = i * 2; ix.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    geometry.setAttribute('position', position); geometry.setIndex(ix);
    const mesh = b.mesh(geometry, '#6f9ba7', false, false); mesh.userData.deltaPart = 'channel';
    return { mesh, set(point: (q: number) => Vec3) {
      for (let i = 0; i <= count; i++) {
        const q = i / count, a = point(Math.max(0, q - .002)), c = point(Math.min(1, q + .002)), v = point(q);
        const length = Math.hypot(c[0] - a[0], c[2] - a[2]) || 1;
        const dx = -(c[2] - a[2]) / length * width * s / 2, dz = (c[0] - a[0]) / length * width * s / 2;
        position.setXYZ(i * 2, v[0] - dx, v[1], v[2] - dz); position.setXYZ(i * 2 + 1, v[0] + dx, v[1], v[2] + dz);
      }
      position.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingSphere(); geometry.computeBoundingBox();
    }, edges() {
      for (let side = 0; side < 2; side++) b.contour(Array.from({ length: count + 1 }, (_, i): Vec3 =>
        [position.getX(i * 2 + side), position.getY(i * 2 + side) + .035 * s, position.getZ(i * 2 + side)]), .32);
    } };
  }
  const main = channel(38, 3.3), branches = Array.from({ length: 3 }, () => channel(30, 1.65));
  const mainPath = (q: number): Vec3 => { const v = deltaMainPoint(q); return p(v[0], v[1], 8.65); };
  main.set(mainPath);
  const titles = ['冲积平原', '河口沉积', '岸线推进'].map(text => b.label(text, p(.49, -.09, 11), 23 * s, 5.8 * s));
  const coarseLabel = b.label('较粗', p(.17, .57, 15), 9 * s, 5.1 * s);
  const fineLabel = b.label('较细', p(.84, .88, 13), 9 * s, 5.1 * s);
  let frontLines: Vec3[][] = [];
  const shoreline = () => {
    // March only the actual solid's near-surface contour. This uses the same
    // heights as the terrain and avoids a decorative, separately moving coast.
    const lines: Vec3[][] = [], height = 5.2;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const corners = [top[j * (nx + 1) + i], top[j * (nx + 1) + i + 1], top[(j + 1) * (nx + 1) + i + 1], top[(j + 1) * (nx + 1) + i]];
      const crosses: Vec3[] = [];
      for (let n = 0; n < 4; n++) {
        const a = corners[n], c = corners[(n + 1) % 4], ha = bedPositions.getY(a.index) / s, hc = bedPositions.getY(c.index) / s;
        if ((ha - height) * (hc - height) < 0) {
          const q = (height - ha) / (hc - ha); crosses.push(p(a.u + (c.u - a.u) * q, a.v + (c.v - a.v) * q, height + .04));
        }
      }
      if (crosses.length >= 2) lines.push(crosses.slice(0, 2));
    }
    return lines;
  };
  return { update(phase, selection) {
    selected = Math.max(0, Math.min(2, Math.round(selection))); state = evaluateDeltaDeposition(phase);
    if (phase !== previous) {
      for (const v of top) bedPositions.setY(v.index, deltaBedHeight(state, v.u, v.v) * s);
      bedPositions.needsUpdate = true; bedGeometry.computeVertexNormals(); bedGeometry.computeBoundingBox(); bedGeometry.computeBoundingSphere();
      frontLines = shoreline();
      branches.forEach((branch, i) => branch.set(q => {
        const v = deltaBranchPoint(i, Math.max(.02, state.branches[i].front - .09) * q); return p(v[0], v[1], DELTA_TOP + .16);
      }));
      previous = phase;
    }
    b.outline(base, .4); b.outline(plain, .5); main.edges();
    for (const line of frontLines) b.contour(line, .62);
    branches.forEach((branch, i) => {
      branch.mesh.visible = state.branches[i].deposition > .02;
      if (branch.mesh.visible) branch.edges();
      if (selected > 0) {
        const reach = Math.max(.2, state.branches[i].front), route = Array.from({ length: 15 }, (_, j): Vec3 => {
          const v = deltaBranchPoint(i, reach * j / 14); return p(v[0], v[1], 8.8);
        });
        b.trace(route, phase * 1.6, 1, 'flow', 1, .7);
      }
    });
    b.trace(Array.from({ length: 19 }, (_, i) => mainPath(i / 18)), phase * 2.5, 3, 'flow', 1, .8);
    state.grains.forEach((grain, i) => {
      // Deposited parcels are the same solids that travelled down the river;
      // never erase the material evidence when the default overview is used.
      const mesh = grains[i]; mesh.visible = grain.stage !== 'waiting';
      mesh.position.set(...p(grain.position[0], grain.position[2], grain.position[1]));
      mesh.userData.sedimentStage = grain.stage; mesh.userData.deposition = grain.deposition;
      if (mesh.visible && grain.stage === 'settling') b.contour([
        p(grain.target[0], grain.target[2], 9.05), p(grain.position[0], grain.position[2], grain.position[1])], .28);
      if (mesh.visible && grain.id % 3 === 0) b.outline(mesh, grain.stage === 'transport' ? .42 : .28);
    });
    titles.forEach((title, i) => title.visible = selected === i);
    coarseLabel.visible = selected > 0 && state.deposition > .2;
    fineLabel.visible = selected > 0 && state.grains.some(g => g.grainClass === 'fine' && (g.stage === 'settling' || g.stage === 'deposited'));
    if (coarseLabel.visible) {
      const v = deltaBranchPoint(0, .33); b.contour([p(.22, .57, 13), p(v[0], v[1], DELTA_TOP + 1)], .32);
    }
    if (fineLabel.visible) {
      const v = deltaBranchPoint(2, .84); b.contour([p(.80, .88, 11), p(v[0], v[1], DELTA_TOP + .8)], .32);
    }
  }, focusBounds: () => ({ min: p(-.025, -.12), max: p(1.025, 1.08, 22) }), describe: () => ({
    kind: 'alluvial-plain-and-delta', phase: state.phase, stage: selected,
    shorelineAdvance: state.branches.map(branch => branch.front), sedimentSorting: 'coarse-near-fine-far',
    sedimentPool: grains.length, deposited: state.deposited, settling: state.settling, transported: state.transported,
    deposition: state.deposition, branches: state.branches,
    grains: state.grains.map(grain => ({ id: grain.id, grainClass: grain.grainClass, stage: grain.stage, position: grain.position, target: grain.target, pathSpeed: grain.pathSpeed })),
    bedVertices: bedPositions.count, fixedParticlePool: true, buffersStable: true,
    coastFromDeposits: true, measuredCoastline: false, universalDeltaShape: false, sedimentRelief: 'exaggerated-schematic',
  }) };
}

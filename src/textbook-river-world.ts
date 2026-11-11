import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { TextbookGeometry, LIFT_MARGIN, PALETTE as C, type ModelMotion, type Vec3 } from './textbook-geometry';
import { distanceToRiver, evaluateRiverCutoff, type RiverPoint } from './textbook-river-model';

/** A cut-away floodplain, not a blue drawing on a slab. Permanent vertex
 * buffers are shared by the bank relief, waterline and flow paths. */
export function buildRiverWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, depth = b.width * .62, z0 = -LIFT_MARGIN - b.height * .88;
  const p = (u: number, v: number, h = 0): Vec3 => [u * b.width, h * s, z0 + v * depth];
  const plateau = 5.8, waterY = 4.45, bedY = 2.2;
  let state = evaluateRiverCutoff(0), previous = -1;
  const height = (u: number, v: number) => {
    const q: RiverPoint = [u, v];
    let channel = Math.min(distanceToRiver(q, state.upstream, .62) / (state.riverWidth / 2),
      distanceToRiver(q, state.downstream, .62) / (state.riverWidth / 2),
      distanceToRiver(q, state.bend, .62) / (state.bendWidth / 2));
    if (state.shortcutWidth > .0001) channel = Math.min(channel,
      distanceToRiver(q, state.shortcut, .62) / (state.shortcutWidth / 2));
    const k = Math.max(0, Math.min(1, (channel - .68) / .73));
    return bedY + (plateau + .24 * Math.sin(u * 15) * Math.sin(v * 11) - bedY) * k * k * (3 - 2 * k);
  };
  const nx = 112, nz = 72, positions: number[] = [], indices: number[] = [];
  const top: { index: number; u: number; v: number }[] = [], boundary: number[] = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const u = .012 + .976 * i / nx, v = .045 + .91 * j / nz, index = positions.length / 3;
    positions.push(...p(u, v, height(u, v))); top.push({ index, u, v });
    if (j < nz && i < nx) indices.push(index, index + nx + 1, index + 1, index + 1, index + nx + 1, index + nx + 2);
  }
  for (let i = 0; i <= nx; i++) boundary.push(i);
  for (let j = 1; j <= nz; j++) boundary.push(j * (nx + 1) + nx);
  for (let i = nx - 1; i >= 0; i--) boundary.push(nz * (nx + 1) + i);
  for (let j = nz - 1; j > 0; j--) boundary.push(j * (nx + 1));
  for (let i = 0; i < boundary.length; i++) {
    const a = top[boundary[i]], c = top[boundary[(i + 1) % boundary.length]], k = positions.length / 3;
    positions.push(...p(a.u, a.v, height(a.u, a.v)), ...p(c.u, c.v, height(c.u, c.v)), ...p(c.u, c.v), ...p(a.u, a.v));
    top.push({ index: k, u: a.u, v: a.v }, { index: k + 1, u: c.u, v: c.v });
    indices.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  const k = positions.length / 3;
  positions.push(...p(.012, .045), ...p(.988, .045), ...p(.988, .955), ...p(.012, .955));
  indices.push(k, k + 1, k + 2, k, k + 2, k + 3);
  const terrain = new T.BufferGeometry(); terrain.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  terrain.setIndex(indices); terrain.computeVertexNormals();
  const land = b.mesh(terrain, '#c5bea0', false);
  land.material = createSpecimenMaterial(b.pop, { color: '#c8c4aa', ink: '#646d5b', spacing: 2.7, hatch: .25, shade: .07, seed: 12 });
  land.material.side = T.DoubleSide;
  const waterMaterial = createSpecimenMaterial(b.pop, { color: '#79a7b2', ink: '#557d85', spacing: 2.8, hatch: .1, shade: .06, seed: 9 });
  waterMaterial.side = T.DoubleSide;

  function channel(count: number) {
    const g = new T.BufferGeometry(), a = new T.Float32BufferAttribute(new Float32Array((count + 1) * 6), 3), ix: number[] = [];
    for (let i = 0; i < count; i++) { const n = i * 2; ix.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
    g.setAttribute('position', a); g.setIndex(ix);
    const mesh = b.mesh(g, C.water, false, false);
    mesh.material = waterMaterial;
    return { mesh, set(path: readonly RiverPoint[], width: number) {
      mesh.visible = width > .0001 && path.length > 1; if (!mesh.visible) return;
      for (let i = 0; i <= count; i++) {
        const q = i / count * (path.length - 1), n = Math.min(path.length - 2, Math.floor(q)), t = q - n;
        const u = path[n][0] + (path[n + 1][0] - path[n][0]) * t, v = path[n][1] + (path[n + 1][1] - path[n][1]) * t;
        const dx = path[n + 1][0] - path[n][0], dz = (path[n + 1][1] - path[n][1]) * .62, length = Math.hypot(dx, dz) || 1;
        const ox = -dz / length * width * b.width / 2, oz = dx / length * width * b.width / 2, point = p(u, v, waterY);
        a.setXYZ(i * 2, point[0] - ox, point[1], point[2] - oz); a.setXYZ(i * 2 + 1, point[0] + ox, point[1], point[2] + oz);
      }
      a.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
    }, edges() {
      if (mesh.visible) for (let j = 0; j < 2; j++) b.contour(Array.from({ length: count + 1 }, (_, i): Vec3 =>
        [a.getX(i * 2 + j), a.getY(i * 2 + j) + .06 * s, a.getZ(i * 2 + j)]), .37);
    } };
  }
  const upstream = channel(40), downstream = channel(40), bend = channel(128), shortcut = channel(24);
  // A few fixed trees give the channel a readable vertical scale. None sit
  // on a bank that the schematic river will migrate through.
  for (const [u, v, h] of [[.085, .16, 8], [.13, .27, 6], [.87, .18, 7], [.91, .32, 5.5], [.19, .92, 5.5], [.85, .91, 7]])
    b.tree(p(u, v, plateau), h * s, 'broad', '#a4b093');
  for (let i = 0; i < 16; i++) {
    const u = .06 + i * .055, v = .095 + .012 * Math.sin(i * 3);
    b.stroke([p(u, v, plateau + .15), p(u + .012, v + .007, plateau + .15)], .28);
  }
  for (const h of [1.7, 3.6]) b.stroke([p(.012, .955, h), p(.988, .955, h + .12)], .24);
  const neck = b.label('河曲颈部', p(.5, 1.06, 6), 20 * s, 5.5 * s);
  const flood = b.label('洪水冲颈', p(.5, 1.06, 6), 20 * s, 5.5 * s);
  const lake = b.label('牛轭湖', p(.5, .4, 16), 19 * s, 5.5 * s);
  const neckInput = { kind: 'select', selection: 1, label: '回看洪水冲断河曲颈部的关键阶段' };
  neck.userData.modelInput = flood.userData.modelInput = neckInput;
  lake.userData.modelInput = { kind: 'select', selection: 2, label: '查看旧河道分离后形成的牛轭湖' };
  const neckPin = b.sphere(p(.5, .73, plateau + .8), 1.05 * s, '#ae8b5e', false, [1.4, .5, 1]);
  neckPin.userData.modelInput = neckInput; neckPin.userData.smallPointTarget = true;
  neckPin.userData.riverRole = 'neck-observation-point';
  // Original banks remain as fine broken survey marks. Only the changing
  // neck is compared, keeping the fixed floodplain free of duplicate linework.
  const original = evaluateRiverCutoff(0);
  const originalBanks = [-1, 1].map(side => original.bend.map(([u, v], i, path) => {
    const a = path[Math.max(0, i - 1)], c = path[Math.min(path.length - 1, i + 1)];
    const dx = c[0] - a[0], dz = (c[1] - a[1]) * .62, length = Math.hypot(dx, dz) || 1;
    return p(u - dz / length * original.bendWidth / 2 * side,
      v + dx / length * original.bendWidth / 2 / .62 * side, plateau + .12);
  }));
  const flowPath = (path: readonly RiverPoint[]) => path.map(([u, v]) => p(u, v, waterY + .18));
  return { update(phase) {
    state = evaluateRiverCutoff(phase);
    if (phase !== previous) {
      const a = terrain.attributes.position;
      for (const point of top) a.setY(point.index, height(point.u, point.v) * s);
      a.needsUpdate = true; terrain.computeVertexNormals(); terrain.computeBoundingBox(); terrain.computeBoundingSphere();
      upstream.set(state.upstream, state.riverWidth); downstream.set(state.downstream, state.riverWidth);
      bend.set(state.bend, state.bendWidth); shortcut.set(state.shortcut, state.shortcutWidth); previous = phase;
    }
    const outline = boundary.map(i => { const q = top[i]; return p(q.u, q.v, height(q.u, q.v) + .04); });
    b.contour([...outline, outline[0]], .55);
    for (const [u, v] of [[.012, .955], [.988, .955], [.012, .045]]) b.contour([p(u, v), p(u, v, height(u, v))], .5);
    upstream.edges(); downstream.edges(); bend.edges(); shortcut.edges();
    if (state.migration > .08) for (const bank of originalBanks) {
      for (let i = 0; i < 16; i += 4) b.contour(bank.slice(i, i + 3), .20);
      for (let i = 84; i < 100; i += 4) b.contour(bank.slice(i, i + 3), .20);
    }
    neckPin.visible = state.stage < 2; if (neckPin.visible) b.outline(neckPin, neckPin.userData.modelHovered ? .7 : .38);
    neck.visible = state.stage === 0; flood.visible = state.stage === 1; lake.visible = state.stage === 2;
    b.trace(flowPath(state.upstream), phase * 4, 2);
    b.trace(flowPath(state.downstream), phase * 4 + .2, 2);
    if (state.bendFlow > .02) b.trace(flowPath(state.bend), phase * 4, 5, 'flow', 1, state.bendFlow);
    if (state.shortcutFlow > .02) b.trace(flowPath(state.shortcut), phase * 4, 1, 'flow', 1, state.shortcutFlow);
    if (state.stage < 2) b.contour([p(.5, 1.02, 6), p(.5, .86, 6), p(.5, .73, 5.8)], .3);
    else b.contour([p(.5, .4, 13), p(.5, .27, waterY + .2)], .3);
  }, focusBounds: () => ({ min: p(-.02, -.04), max: p(1.02, 1.04, 25) }),
  describe: () => ({ kind: 'meander-cutoff', stage: state.stage, phase: state.phase,
    breach: state.breach, separation: state.separation, closedOxbow: state.isolated,
    lakeFlow: state.bendFlow, shortcutFlow: state.shortcutFlow,
    channelDepth: (plateau - bedY) * s, waterSurface: waterY * s,
    lakeEndpoints: [state.bend[0], state.bend.at(-1)], bufferVertices: terrain.attributes.position.count,
    geometryGap: state.isolated, buffersStable: true, erosionRate: 'schematic-flood-triggered-possible-cutoff' }) };
}

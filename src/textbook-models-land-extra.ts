import { THREE as T } from './reference/engine.js';
import { TextbookGeometry, PALETTE as C, LIFT_MARGIN, type ModelMotion, type Vec3 } from './textbook-geometry';
import { buildDeltaWorld } from './textbook-delta-world';
import { buildSoilFactorsWorld } from './textbook-soil-factors-world';
import { buildVegetationWorld } from './textbook-vegetation-world';
import { buildCoastalProcessWorld } from './textbook-coastal-process-world';
import { AEOLIAN_STONE_PROFILE, AEOLIAN_TITLES, aeolianRadiusScale, evaluateAeolian } from './textbook-aeolian-model';
import { evaluateKarstCover } from './textbook-ground-process-model';
import { buildReliefCutSurface, riverValleySurfaceHeight, type NaturalSurface } from './textbook-natural-form-geometry';

/** Additional chapter 4/5 explanations. All shapes are real geometry in the
 * reference Popout frame. The textbook page is never sampled by a model.
 * phase is demonstration progress, never a measured year, speed or climate. */
export function buildLandExtra(b: TextbookGeometry, effect: string): ModelMotion | null {
  switch (effect) {
    case 'river-valley': return riverValley(b);
    case 'delta': return delta(b);
    case 'aeolian': return aeolian(b);
    case 'coastal-landform': return coastal(b);
    case 'terrain-observation': return terrainObservation(b);
    case 'vegetation': return buildVegetationWorld(b);
    case 'soil-factors': return buildSoilFactorsWorld(b);
    case 'karst-livelihood': return karstLivelihood(b);
    default: return null;
  }
}

const clamp = (n: number, a = 0, c = 1) => Math.max(a, Math.min(c, n));
const smooth = (a: number, c: number, n: number) => { const q = clamp((n - a) / (c - a)); return q * q * (3 - 2 * q); };
const stage = (n: number, max: number) => Math.round(clamp(n, 0, max));
const cycle = (n: number) => ((n % 1) + 1) % 1;

function frame(b: TextbookGeometry) {
  const s = b.width / 100, depth = clamp(b.height, 43 * s, 68 * s);
  const z0 = -LIFT_MARGIN - b.height * .62, z1 = z0 + depth;
  return { s, z0, z1, depth,
    p: (u: number, v: number, h = 0): Vec3 => [u * b.width, h * s, z0 + v * depth],
    bounds: (height = 54) => ({ min: [0, 0, z0 - 8 * s] as Vec3, max: [b.width, height * s, z1 + 12 * s] as Vec3 }),
  };
}

type LabelSpec = [string, number, number, number, number?];
function labelSets(b: TextbookGeometry, f: ReturnType<typeof frame>, sets: LabelSpec[][]) {
  return sets.map(set => set.map(([text, u, v, h, width = 22]) => b.label(text, f.p(u, v, h), width * f.s, 6 * f.s)));
}
function showLabels(sets: any[][], index: number) { sets.forEach((set, i) => set.forEach(label => { label.visible = i === index; })); }

/** Moving objects use cached edges, not frozen strokes left on the page. The
 * one-time edge extraction is done now, before the animation loop starts. */
function solid(b: TextbookGeometry, geometry: any, color: string, ink = true) {
  const mesh = b.mesh(geometry, color, false);
  if (ink) b.outline(mesh);
  return mesh;
}
function pebble(b: TextbookGeometry, radius: number, color = C.land, detail = 0) {
  return solid(b, new T.IcosahedronGeometry(radius, detail), color, false);
}
function localBox(b: TextbookGeometry, w: number, h: number, d: number, color: string) {
  const g = new T.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return solid(b, g, color);
}
function naturalGeometry(surface: NaturalSurface) {
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(surface.positions, 3)); g.setIndex(surface.indices);
  g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere(); return g;
}

/** Closed heightfield, including its bottom. All vertices have permanent
 * buffers; changing a cross-section only updates existing attributes. */
function relief(b: TextbookGeometry, x0: number, x1: number, z0: number, z1: number,
  height: (x: number, z: number) => number, color: string, nx = 44, nz = 26, bottom = 0, roundness = 0) {
  const data = buildReliefCutSurface(x0, x1, z0, z1, height, nx, nz, bottom, roundness), top = data.samples, boundary = data.boundary;
  const g = naturalGeometry(data);
  const mesh = b.mesh(g, color, false);
  mesh.userData.closedHeightfield = true;
  return { mesh,
    set(fn: (x: number, z: number) => number) {
      const a = g.attributes.position; for (const v of top) a.setY(v.index, fn(v.x, v.z));
      a.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
    },
    outline(fn: (x: number, z: number) => number) {
      b.contour(boundary.map(i => { const v = top[i]; return [v.x, fn(v.x, v.z) + .04, v.z] as Vec3; }).concat([[top[boundary[0]].x, fn(top[boundary[0]].x, top[boundary[0]].z) + .04, top[boundary[0]].z]]), .6);
      for (const index of [0, nx + nz, nx * 2 + nz]) { const { x, z } = top[boundary[index]]; b.contour([[x, bottom, z], [x, fn(x, z), z]], .35); }
      b.contour(boundary.map(index => { const v = top[index]; return [v.x, bottom, v.z] as Vec3; }).concat([[top[boundary[0]].x, bottom, top[boundary[0]].z]]), .3);
    },
  };
}

function ribbon(b: TextbookGeometry, count: number, point: (q: number) => Vec3, width: number, color = C.water) {
  const g = new T.BufferGeometry(), a = new T.Float32BufferAttribute(new Float32Array((count + 1) * 6), 3), indices: number[] = [];
  for (let i = 0; i < count; i++) { const k = i * 2; indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  g.setAttribute('position', a); g.setIndex(indices);
  const mesh = b.mesh(g, color, false, false);
  const set = (fn: (q: number) => Vec3, w = width) => {
    for (let i = 0; i <= count; i++) {
      const q = i / count, p = fn(q), c = fn(Math.max(0, q - .001)), d = fn(Math.min(1, q + .001));
      const length = Math.hypot(d[0] - c[0], d[2] - c[2]) || 1, dx = -(d[2] - c[2]) / length * w / 2, dz = (d[0] - c[0]) / length * w / 2;
      a.setXYZ(i * 2, p[0] - dx, p[1], p[2] - dz); a.setXYZ(i * 2 + 1, p[0] + dx, p[1], p[2] + dz);
    }
    a.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
  };
  set(point);
  return { mesh, set, edges() {
    for (let side = 0; side < 2; side++) b.contour(Array.from({ length: count + 1 }, (_, i): Vec3 => [a.getX(i * 2 + side), a.getY(i * 2 + side) + .05, a.getZ(i * 2 + side)]), .45);
  } };
}

function contourLevels(b: TextbookGeometry, f: (x: number, z: number) => number, x0: number, x1: number, z0: number, z1: number, levels: number[]) {
  for (const y of levels) for (let j = 0; j < 24; j++) for (let i = 0; i < 40; i++) {
    const corners = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([u, v]) => {
      const x = x0 + (x1 - x0) * u / 40, z = z0 + (z1 - z0) * v / 24; return { x, z, h: f(x, z) };
    });
    const crosses: Vec3[] = [];
    for (let n = 0; n < 4; n++) { const a = corners[n], c = corners[(n + 1) % 4];
      if ((a.h - y) * (c.h - y) < 0) { const q = (y - a.h) / (c.h - a.h); crosses.push([a.x + (c.x - a.x) * q, y + .07, a.z + (c.z - a.z) * q]); }
    }
    if (crosses.length >= 2) b.stroke(crosses.slice(0, 2), .25);
  }
}

/** Textbook pp.69–70: these are different river environments, not a claim
 * that every V-shaped valley must evolve into this plain cross-section. */
function riverValley(b: TextbookGeometry): ModelMotion {
  const f = frame(b), { s, p, z0, z1 } = f;
  let selected = 0;
  const center = (z: number) => b.width * (.5 + .035 * Math.sin((z - z0) / f.depth * 4));
  const bed = (z: number) => s * (3.4 - 1.3 * (z - z0) / f.depth);
  const height = (x: number, z: number) => {
    return s * riverValleySurfaceHeight(x / b.width, (z - z0) / f.depth, selected === 1);
  };
  const land = relief(b, .035 * b.width, .965 * b.width, z0, z1, height, C.land, 52, 30, 0, .38);
  land.mesh.material = b.pop.paper({ color: C.land, ink: '#7b7866', hatch: .12, spacing: 3.2, shade: .09, seed: 216 });
  const waterPath = (q: number): Vec3 => { const z = z0 + q * f.depth; return [center(z), bed(z) + .38 * s, z]; };
  const water = ribbon(b, 52, waterPath, 4.4 * s);
  const stones = Array.from({ length: 10 }, (_, i) => {
    const z = z0 + (.12 + i * .075) * f.depth, x = center(z) + ((i % 2 ? 1 : -1) * (2.7 + i % 3) * s);
    const m = pebble(b, (.4 + (i % 3) * .2) * s, '#9e9889'); m.position.set(x, height(x, z) + .3 * s, z); return m;
  });
  const labels = labelSets(b, f, [
    [['山地 V 形谷', .5, 1.12, 2, 29], ['岸坡陡', .19, .64, 30], ['谷底狭窄', .65, 1.05, 13]],
    [['平原槽形谷', .5, 1.12, 2, 29], ['冲积平原', .18, .5, 10], ['宽而浅', .68, .9, 10]],
  ]);
  land.mesh.userData.modelInput = { kind: 'select', selection: 1, toggleTo: 0, label: '对照山地河谷与平原河谷' };
  water.mesh.userData.modelInput = land.mesh.userData.modelInput;
  labels.forEach((set, selection) => { set[0].userData.modelInput = { kind: 'select', selection, label: `观察${selection ? '平原' : '山地'}河谷剖面` }; });
  const sectionHandle = pebble(b, 1.5 * s, C.gold);
  const sectionTrack = { start: p(.15, 1.2, 2.5), end: p(.85, 1.2, 2.5) };
  sectionHandle.userData.modelInput = { kind: 'phase-track', track: sectionTrack, label: '移动河谷观察剖面' };
  b.stroke([sectionTrack.start, sectionTrack.end], .45);
  let previous = -1, sectionFraction = .2;
  return { update(t, n) {
    selected = stage(n, 1);
    if (selected !== previous) { land.set(height); water.set(waterPath, (selected ? 13 : 4.4) * s); previous = selected; }
    showLabels(labels, selected); land.outline(height); water.edges(); stones.forEach(m => { m.visible = selected === 0; });
    sectionFraction = .2 + .65 * clamp(t); const sectionZ = z0 + sectionFraction * f.depth;
    sectionHandle.position.set(...p(.15 + .7 * clamp(t), 1.2, 2.5));
    const crossSection = Array.from({ length: 51 }, (_, i): Vec3 => { const x = (.035 + .93 * i / 50) * b.width; return [x, height(x, sectionZ) + .25 * s, sectionZ]; });
    b.contour(crossSection, 1); b.trace(Array.from({ length: 13 }, (_, i) => waterPath(i / 12)), .54, 5);
    const mid = center(sectionZ), floor = bed(sectionZ);
    if (selected === 0) b.trace([[mid, floor + 8 * s, sectionZ], [mid, floor + .5 * s, sectionZ]], .8, 1, 'accent');
    else for (const sign of [-1, 1]) b.trace([[mid, floor + 1.3 * s, sectionZ], [mid + sign * 12 * s, floor + 1.3 * s, sectionZ]], .75, 1, 'accent');
  }, focusBounds: () => f.bounds(42), describe: () => ({ kind: 'river-valley-comparison', environment: selected ? 'plain' : 'mountain', crossSection: selected ? 'wide-shallow-trough' : 'V', phaseMeaning: 'moving-section-observation', sectionFraction, distinctEnvironments: true, glacierValleyIncluded: false, realElevationData: false, buffersStable: true }) };
}

/** Textbook pp.70–71: an upstream plain and a river mouth share the same
 * sediment path. The moving coast is a diagram, not a dated shoreline. */
function delta(b: TextbookGeometry): ModelMotion {
  return buildDeltaWorld(b);
}

/** Textbook pp.72–73. Wind direction is shared by grain paths, yardang
 * ridges, dune horns and the gentle-windward / steep-lee cross-section. */
function aeolian(b: TextbookGeometry): ModelMotion {
  const f = frame(b), { s, p, z0, z1 } = f;
  b.box(p(.02, .05, 0), p(.98, .98, 1.4), '#d1bf9c');
  const stoneProfile = AEOLIAN_STONE_PROFILE;
  const g = new T.LatheGeometry(stoneProfile.map(([r, y]) => new T.Vector2(r * s, y * s)), 28);
  const mushroom = b.mesh(g, '#b8a489', false), original = new Float32Array(g.attributes.position.array);
  mushroom.position.set(.48 * b.width, 1.4 * s, p(0, .56)[2]);
  mushroom.userData.aeolianRole = 'mushroom';
  const ridgeHeight = (x: number, z: number) => {
    const u = (x / b.width - .12) / .76, v = (z - z0) / f.depth;
    const ridge = Math.max(...[.23, .5, .78].map((a, i) => (13 + i * 2) * Math.exp(-(((v - a) / .083) ** 2)) * Math.max(0, Math.sin(Math.PI * clamp(u))) ** .4));
    return (1.5 + ridge * (.9 + .1 * Math.sin(u * 20 + v * 7))) * s;
  };
  const yardang = relief(b, .08 * b.width, .92 * b.width, z0 + .08 * f.depth, z1 - .07 * f.depth, ridgeHeight, '#b6a087', 50, 30, 1.4 * s);
  yardang.mesh.userData.aeolianRole = 'yardang';
  const duneVertices: number[] = [], duneIndices: number[] = [], nx = 42, nz = 30;
  const dunePoint = (u: number, v: number): Vec3 => {
    const q = v * 2 - 1, a = u * 2 - 1, crest = 17 * q * q;
    const h = 15 * Math.max(0, 1 - q * q) ** .72 * (1 - Math.abs(a));
    return [(.43 * b.width) + (crest + (a < 0 ? a * 31 : a * 8.5)) * s, (1.5 + h) * s, p(0, .53)[2] + q * f.depth * .35];
  };
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    duneVertices.push(...dunePoint(i / nx, j / nz));
    if (i < nx && j < nz) { const k = j * (nx + 1) + i; duneIndices.push(k, k + nx + 1, k + 1, k + 1, k + nx + 1, k + nx + 2); }
  }
  // A flat, closed underside gives the sand body actual volume.
  const rim: number[] = [];
  for (let i = 0; i <= nx; i++) rim.push(i);
  for (let j = 1; j <= nz; j++) rim.push(j * (nx + 1) + nx);
  for (let i = nx - 1; i >= 0; i--) rim.push(nz * (nx + 1) + i);
  for (let j = nz - 1; j > 0; j--) rim.push(j * (nx + 1));
  const underside = duneVertices.length / 3;
  duneVertices.push(.5 * b.width, 1.48 * s, p(0, .53)[2]);
  for (let i = 0; i < rim.length; i++) duneIndices.push(underside, rim[(i + 1) % rim.length], rim[i]);
  const dg = new T.BufferGeometry(); dg.setAttribute('position', new T.Float32BufferAttribute(duneVertices, 3)); dg.setIndex(duneIndices); dg.computeVertexNormals();
  const dune = b.mesh(dg, '#d4bd90', false);
  dune.userData.aeolianRole = 'dune';
  const roots: any[] = [], shrubs: any[] = [];
  for (let i = 0; i < 5; i++) {
    const at = dunePoint(.43 + (i % 2) * .1, .17 + i * .16), h = (3 + i % 2) * s;
    const crown = pebble(b, h * .65, C.darkGreen, 1); crown.scale.set(1.25, .72, .9); crown.position.set(at[0], at[1] + h * .45, at[2]); shrubs.push(crown);
    const root = b.cylinder(at, [at[0] + 2 * s, at[1] - 3.5 * s, at[2] + s], .23 * s, '#8c805e', false); b.outline(root); roots.push(root);
  }
  const sand = Array.from({ length: 18 }, (_, i) => pebble(b, (.26 + i % 3 * .09) * s, '#ad9062'));
  sand.forEach((grain, i) => { grain.userData.aeolianRole = 'sand-grain'; grain.userData.aeolianGrainId = i; });
  const labels = labelSets(b, f, [
    [['风蚀蘑菇', .49, 1.12, 3, 27], ['下部侵蚀较强', .77, .62, 14, 29], ['主风向', .18, .1, 12]],
    [['雅丹', .5, 1.12, 3], ['垄脊顺着风向', .6, .57, 24, 30], ['沟槽', .25, .72, 20]],
    [['新月形沙丘', .5, 1.12, 3, 29], ['迎风坡缓', .16, .63, 16], ['背风坡陡', .77, .62, 16]],
    [['植被固沙', .5, 1.12, 3, 26], ['根系固定', .75, .72, 20], ['风沙堆积', .17, .68, 12]],
  ]);
  const replayInputs = AEOLIAN_TITLES.map((title, selection) => ({ kind: 'replay' as const, selection, label: `从头观察${title}示意` }));
  mushroom.userData.modelInput = replayInputs[0]; yardang.mesh.userData.modelInput = replayInputs[1];
  labels.forEach((set, i) => { set[0].userData.modelInput = replayInputs[i]; });
  let state = evaluateAeolian(0), selected = 0, lastErosion = -1;
  return { update(t, n) {
    state = evaluateAeolian(t, n); selected = state.selection; showLabels(labels, selected);
    mushroom.visible = selected === 0; yardang.mesh.visible = selected === 1; dune.visible = selected >= 2;
    dune.userData.modelInput = replayInputs[selected];
    shrubs.forEach(m => { m.visible = state.stabilized; }); roots.forEach(m => { m.visible = state.stabilized; if (m.visible) b.outline(m, .35); });
    const erosion = state.erosion;
    if (selected === 0 && erosion !== lastErosion) {
      const a = g.attributes.position;
      for (let i = 0; i < a.count; i++) {
        const y = original[i * 3 + 1] / s, thinning = aeolianRadiusScale(y, erosion);
        a.setXYZ(i, original[i * 3] * thinning, original[i * 3 + 1], original[i * 3 + 2] * thinning);
      }
      a.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere(); lastErosion = erosion;
    }
    if (selected === 0) {
      // Sparse fragments of the starting silhouette remain as an evidence
      // reference, separate from the continuously thinning present surface.
      for (const sign of [-1, 1]) for (let i = 0; i < stoneProfile.length - 1; i += 2) {
        const pair = stoneProfile.slice(i, i + 2).map(([r, y]): Vec3 => [mushroom.position.x + sign * r * s, (y + 1.4) * s, mushroom.position.z + .15 * s]);
        b.contour(pair, .24);
      }
      for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) b.contour(stoneProfile.map(([r, y]): Vec3 => {
        const thinning = aeolianRadiusScale(y, erosion);
        return [mushroom.position.x + Math.cos(angle) * r * s * thinning, (y + 1.4) * s, mushroom.position.z + Math.sin(angle) * r * s * thinning];
      }), .55);
    }
    if (selected === 1) {
      yardang.outline(ridgeHeight);
      for (const v of [.23, .5, .78]) b.contour(Array.from({ length: 29 }, (_, i): Vec3 => {
        const x = (.1 + .8 * i / 28) * b.width, z = z0 + v * f.depth; return [x, ridgeHeight(x, z) + .08 * s, z];
      }), .65);
    }
    dune.position.x = state.duneOffset * s;
    if (selected >= 2) for (const u of [0, .5, 1]) b.contour(Array.from({ length: 49 }, (_, i): Vec3 => {
      const a = dunePoint(u, i / 48); return [a[0] + dune.position.x, a[1] + .06 * s, a[2]];
    }), u === .5 ? .9 : .4);
    for (let j = 0; j < 3; j++) {
      const z = z0 + (.17 + j * .3) * f.depth;
      const path: Vec3[] = selected >= 2 ? [p(.04, .17 + j * .3, 4), p(.25, .17 + j * .3, 7), p(.48, .17 + j * .3, 20), p(.69, .17 + j * .3, 5), p(.96, .17 + j * .3, 4)] : [[.04 * b.width, (3 + j * 1.8) * s, z], [.96 * b.width, (3 + j * 1.8) * s, z]];
      b.trace(path, state.windPhase + j * .09, 3, 'flow', 1, j === 2 && selected === 0 ? .45 : .8);
    }
    sand.forEach((m, i) => {
      const grain = state.grains[i];
      m.position.set(grain.x * b.width, grain.height * s, p(0, grain.depth)[2]); m.visible = grain.visible;
    });
  }, focusBounds: () => f.bounds(39), describe: () => ({ kind: 'wind-erosion-and-deposition', form: state.form, state, wind: 'positive-x', duneHorns: 'downwind', erosionAndDepositionDistinct: true, speedIsSchematic: true, buffersStable: true, independentForms: true, sharedPureState: true }) };
}

/** Textbook p.74: cliff/platform, a through-opening arch, stack and beach.
 * The selector identifies forms; it is not a compulsory sequence of stages. */
function coastal(b: TextbookGeometry): ModelMotion {
  const legacyStart = b.meshes.length;
  const f = frame(b), { s, p, z0, z1 } = f, shoreZ = p(0, .38)[2];
  const base = b.box(p(.015, .02, 0), p(.985, 1, .8), '#b7b3a2', false);
  b.box(p(.015, .2, .8), p(.985, 1, 2.2), C.sea, false);
  const platform = b.prism([[.03 * b.width, z0], [.97 * b.width, z0], [.97 * b.width, shoreZ + .21 * f.depth], [.7 * b.width, shoreZ + .18 * f.depth], [.57 * b.width, shoreZ + .24 * f.depth], [.2 * b.width, shoreZ + .17 * f.depth], [.03 * b.width, shoreZ + .2 * f.depth]], .8 * s, 2.8 * s, C.rock, false);
  const cliff = b.prism([[.04 * b.width, z0], [.95 * b.width, z0], [.95 * b.width, shoreZ - .05 * f.depth], [.77 * b.width, shoreZ], [.62 * b.width, shoreZ - .045 * f.depth], [.4 * b.width, shoreZ], [.17 * b.width, shoreZ - .02 * f.depth], [.04 * b.width, shoreZ + .02 * f.depth]], 2.8 * s, 23 * s, '#b6a88f', false);
  const cliffPosition = cliff.geometry.attributes.position;
  for (let i = 0; i < cliffPosition.count; i++) if (cliffPosition.getY(i) > 22 * s) {
    const u = cliffPosition.getX(i) / b.width, v = (cliffPosition.getZ(i) - z0) / f.depth;
    cliffPosition.setY(i, (22.5 + 1.8 * Math.sin(u * 14) + .8 * Math.cos(u * 31) + 1.4 * (1 - v)) * s);
  }
  cliffPosition.needsUpdate = true; cliff.geometry.computeVertexNormals();
  b.outline(platform); b.outline(cliff);
  // A half-annulus plus two piers forms a genuinely open arch. There is no
  // black patch or alpha texture standing in for a hole.
  const archShape = new T.Shape(), r = 10.5 * s, inner = 6.3 * s;
  for (let i = 0; i <= 28; i++) { const a = i / 28 * Math.PI, rr = r + (.7 * Math.sin(a * 3) + .45 * Math.sin(a * 7)) * s, x = rr * Math.cos(a), y = rr * Math.sin(a); i ? archShape.lineTo(x, y) : archShape.moveTo(x, y); }
  for (let i = 28; i >= 0; i--) { const a = i / 28 * Math.PI, rr = inner * (1 + .08 * Math.sin(a * 3)); archShape.lineTo(rr * Math.cos(a), rr * Math.sin(a)); }
  archShape.closePath();
  const ag = new T.ExtrudeGeometry(archShape, { depth: 8 * s, bevelEnabled: false, steps: 1, curveSegments: 2 });
  const arch = solid(b, ag, '#b1a28a'); arch.position.set(.34 * b.width, 9 * s, shoreZ + .08 * f.depth);
  const piers = [-1, 1].map(sign => {
    const x = .34 * b.width + sign * (inner + (r - inner) / 2), z = shoreZ + .08 * f.depth;
    const m = b.prism([[x - (r - inner) * .57, z], [x + (r - inner) * .49, z - .6 * s], [x + (r - inner) * .6, z + 8.5 * s], [x - (r - inner) * .58, z + 8 * s]], 2.8 * s, 9 * s, '#b1a28a', false); b.outline(m); return m;
  });
  const stack = b.prism([[.65 * b.width, shoreZ + .36 * f.depth], [.69 * b.width, shoreZ + .33 * f.depth], [.74 * b.width, shoreZ + .36 * f.depth], [.735 * b.width, shoreZ + .46 * f.depth], [.66 * b.width, shoreZ + .47 * f.depth]], 1 * s, 16 * s, '#ab9c86', false); b.outline(stack);
  const beachHeight = (_x: number, z: number) => (2.35 + 2.6 * clamp((z1 - z) / (f.depth * .65))) * s;
  const beach = relief(b, .8 * b.width, .97 * b.width, shoreZ - .04 * f.depth, z1 - .03 * f.depth, beachHeight, '#d8c7a0', 14, 28, 1.2 * s);
  const labels = labelSets(b, f, [
    [['海蚀崖', .59, .15, 30], ['海蚀平台', .49, .73, 9], ['海浪侵蚀', .24, .94, 6]],
    [['海蚀拱桥', .34, .49, 27, 26], ['两侧侵蚀贯通', .67, .6, 23, 30], ['海浪', .24, .94, 6]],
    [['海蚀柱', .69, .8, 22], ['岩石海岸', .31, .17, 29], ['海浪侵蚀', .28, .94, 6]],
    [['海滩', .88, .8, 12], ['海岸堆积', .65, .92, 6, 25], ['陆地', .57, .12, 29]],
  ]);
  const sediment = Array.from({ length: 12 }, () => pebble(b, .28 * s, '#af9164'));
  // The three other landform examples retain their original true geometry.
  // Mode zero opens an independent, continuous cross-section instead of moving
  // the entire background coast or placing a picture on top of the page.
  const legacyMeshes = b.meshes.slice(legacyStart), processStart = b.meshes.length;
  const cliffProcess = buildCoastalProcessWorld(b), processMeshes = b.meshes.slice(processStart);
  legacyMeshes.forEach(mesh => { mesh.visible = false; mesh.userData.coastalScene = 'landform-comparison'; });
  processMeshes.forEach(mesh => mesh.userData.coastalScene = 'cliff-process');
  platform.userData.coastalRole = 'comparison-platform'; cliff.userData.coastalRole = 'comparison-cliff';
  arch.userData.coastalRole = 'through-arch'; stack.userData.coastalRole = 'sea-stack';
  beach.mesh.userData.coastalRole = 'depositional-beach';
  piers.forEach(mesh => mesh.userData.coastalRole = 'arch-pier');
  let selected = 0;
  return { update(t, n, dt, reduced) {
    selected = stage(n, 3);
    legacyMeshes.forEach(mesh => mesh.visible = selected !== 0);
    processMeshes.forEach(mesh => mesh.visible = selected === 0);
    if (selected === 0) { cliffProcess.update(t, 0, dt, reduced); return; }
    showLabels(labels, selected); b.outline(base, .48);
    for (const m of [platform, cliff, arch, stack, ...piers]) b.outline(m, selected === 1 && m === arch || selected === 2 && m === stack ? .9 : .5);
    for (let j = 0; j < 4; j++) b.contour([[.07 * b.width, (6 + j * 4) * s, shoreZ + .013 * f.depth + cliff.position.z], [.17 * b.width, (6.4 + j * 4) * s, shoreZ - .018 * f.depth + cliff.position.z]], .27);
    beach.outline(beachHeight);
    for (let j = 0; j < 3; j++) {
      const v = cycle(t * .55 + j / 3), z = z1 - v * f.depth * .64, y = (2.3 + .22 * Math.sin(v * Math.PI)) * s;
      b.contour(Array.from({ length: 31 }, (_, i): Vec3 => [(.04 + .71 * i / 30) * b.width, y, z + Math.sin(i / 30 * Math.PI * 2) * .8 * s]), .45);
    }
    const toward = selected === 3 ? .86 : selected === 2 ? .7 : .34;
    b.trace([p(toward, .96, 3.6), p(toward - .02, .72, 3.8), p(toward, .52, selected === 3 ? 4.2 : 3.7)], t, 3);
    sediment.forEach((m, i) => {
      m.visible = selected === 3; const q = cycle(t * .55 + i / sediment.length), z = z1 - q * f.depth * .53, x = (.82 + i % 4 * .035) * b.width;
      m.position.set(x, beachHeight(x, z) + .28 * s, z);
    });
  }, focusBounds: () => selected === 0 ? cliffProcess.focusBounds!() : f.bounds(38), describe: () => ({
    ...(selected === 0 ? cliffProcess.describe!() : {}),
    kind: 'coastal-landforms', selected: ['cliff-platform', 'through-arch', 'sea-stack', 'depositional-beach'][selected],
    archHasRealOpening: true, requiredChronologicalSequence: false, retreatAndWavesAreSchematic: true, buffersStable: true,
  }) };
}

/** Textbook pp.76–77. The sea-level plane is a reference, not a labelled
 * surveyed elevation. South-facing sunlight assumes N. mid-latitudes. */
function terrainObservation(b: TextbookGeometry): ModelMotion {
  const f = frame(b), { s, p, z0, z1 } = f;
  const height = (x: number, z: number) => {
    const u = x / b.width, v = (z - z0) / f.depth;
    return (3.2 + 26 * Math.exp(-((u - .36) ** 2 / .025 + (v - .42) ** 2 / .10)) + 12 * Math.exp(-((u - .76) ** 2 / .026 + (v - .62) ** 2 / .12))) * s;
  };
  const land = relief(b, .08 * b.width, .92 * b.width, z0 + .06 * f.depth, z1 - .04 * f.depth, height, '#b9b79d', 52, 32, 0, .32);
  land.mesh.material = b.pop.paper({ color: '#c2bea4', ink: '#7d7a69', hatch: .075, spacing: 3.6, shade: .085, seed: 217 });
  const datum = b.box(p(.01, -.03, .4), p(.99, 1.02, .8), '#bbced0', false);
  contourLevels(b, height, .08 * b.width, .92 * b.width, z0 + .06 * f.depth, z1 - .04 * f.depth, [7, 12, 17, 22, 27].map(v => v * s));
  const a = p(.36, .42), c = p(.18, .86); a[1] = height(a[0], a[2]); c[1] = height(c[0], c[2]);
  const labels = labelSets(b, f, [
    [['绝对高度', .13, .4, 24, 25], ['海平面', .17, 1.08, 1], ['山顶', .42, .3, 35]],
    [['相对高度', .7, .64, 31, 25], ['较高处', .31, .27, 35], ['较低处', .84, .84, 21]],
    [['垂直距离', .71, .44, 28, 25], ['水平距离', .52, .93, 10, 25], ['坡度', .35, .66, 24]],
    [['北', .16, .06, 9, 7], ['南', .16, .96, 9, 7], ['阳坡', .4, .86, 20], ['阴坡', .55, .2, 29]],
  ]);
  const sun = pebble(b, 3.2 * s, '#c2a16c', 1); sun.position.set(.57 * b.width, 44 * s, z1 + 4 * s);
  const fixedPoint = pebble(b, 1.1 * s, C.rock), movingPoint = pebble(b, 1.3 * s, C.gold);
  fixedPoint.position.set(a[0], a[1] + 1.1 * s, a[2]);
  const handle = pebble(b, 1.5 * s, C.gold), track = { start: p(.15, 1.18, 2.5), end: p(.85, 1.18, 2.5) };
  handle.userData.modelInput = { kind: 'phase-track', track, label: '移动同一地形上的测点' }; b.stroke([track.start, track.end], .45);
  datum.userData.modelInput = { kind: 'select', selection: 0, label: '以海平面为参照观察绝对高度' };
  labels.forEach((set, selection) => { set[0].userData.modelInput = { kind: 'select', selection, label: `观察${['绝对高度','相对高度','坡度','坡向'][selection]}` }; });
  let selected = 0, relativeHeight = 0, horizontalDistance = 0;
  return { update(t, n) {
    selected = stage(n, 3); showLabels(labels, selected); datum.visible = selected < 2; sun.visible = selected === 3; land.outline(height);
    const q = p(.18 + .64 * clamp(t), .86 - .14 * clamp(t)); c[0] = q[0]; c[2] = q[2]; c[1] = height(c[0], c[2]);
    movingPoint.position.set(c[0], c[1] + 1.3 * s, c[2]); handle.position.set(...p(.15 + .7 * clamp(t), 1.18, 2.5));
    fixedPoint.visible = movingPoint.visible = handle.visible = selected < 3;
    relativeHeight = (a[1] - c[1]) / s; horizontalDistance = Math.hypot(a[0] - c[0], a[2] - c[2]) / s;
    if (selected === 0) {
      const x = .17 * b.width, z = c[2];
      b.trace([[x, .8 * s, z], [x, c[1], z]], .75, 1, 'accent');
      b.contour([[x, c[1], z], c], .4); b.contour([[x - 3 * s, .8 * s, z], [x + 3 * s, .8 * s, z]], .55);
    } else if (selected === 1) {
      const x = .63 * b.width, z = p(0, .81)[2];
      b.trace([[x, c[1], z], [x, a[1], z]], .75, 1, 'accent');
      b.contour([a, [x, a[1], a[2]], [x, a[1], z]], .4);
      b.contour([c, [x, c[1], c[2]], [x, c[1], z]], .4);
    } else if (selected === 2) {
      const high: Vec3 = [a[0], a[1] + .3 * s, a[2]], low: Vec3 = [c[0], c[1] + .3 * s, c[2]];
      const corner: Vec3 = [high[0], low[1], high[2]];
      b.trace([low, high], .65, 2, 'accent'); b.contour([high, corner, low], .65);
      const dx = (low[0] - high[0]) / (horizontalDistance * s), dz = (low[2] - high[2]) / (horizontalDistance * s);
      b.contour([[corner[0], corner[1] + 2 * s, corner[2]], [corner[0] + dx * 2 * s, corner[1] + 2 * s, corner[2] + dz * 2 * s], [corner[0] + dx * 2 * s, corner[1], corner[2] + dz * 2 * s]], .55);
      const baseAngle = Math.atan2(relativeHeight, horizontalDistance);
      b.contour(Array.from({ length: 19 }, (_, i): Vec3 => { const angle = i / 18 * baseAngle; return [low[0] - dx * 6 * s * Math.cos(angle), low[1] + 6 * s * Math.sin(angle), low[2] - dz * 6 * s * Math.cos(angle)]; }), .55);
    } else {
      b.trace([p(.16, .9, 5), p(.16, .08, 5)], 0, 1, 'accent');
      for (const v of [.7, .85]) {
        const at = p(.39, v); at[1] = height(at[0], at[2]) + 1.2 * s;
        b.trace([[sun.position.x - 3 * s, sun.position.y - 3 * s, sun.position.z], at], t, 1, 'accent', 1, .65);
      }
    }
  }, focusBounds: () => f.bounds(51), describe: () => ({ kind: 'terrain-observation', selection: ['absolute-height', 'relative-height', 'slope', 'aspect'][selected], phaseMeaning: 'moving-observation-point', commonEndpoints: { high: a, low: c }, relativeHeight, horizontalDistance, displayedDistancesAreMeasured: false, datum: 'sea-level-reference', measuredElevations: false, slopeFromSameTerrain: true, aspectAssumption: 'northern-mid-latitudes', northIsNegativeZ: true, buffersStable: true }) };
}

/** Textbook pp.79–80: connected peaks, thin soil, a cultivated depression
 * and fractures connect vegetation, erosion, water and land use. */
function karstLivelihood(b: TextbookGeometry): ModelMotion {
  const f = frame(b), { s, p, z0, z1 } = f;
  const height = (x: number, z: number) => {
    const u = x / b.width, v = (z - z0) / f.depth;
    const peaks = [[.18, .37, 28], [.77, .36, 29], [.49, .1, 24], [.12, .77, 14], [.9, .77, 16]];
    return (2.7 + Math.max(...peaks.map(([a, c, h]) => h * Math.exp(-((u - a) ** 2 / .016 + (v - c) ** 2 / .06))))) * s;
  };
  const land = relief(b, .025 * b.width, .975 * b.width, z0, z1, height, '#b4aa94', 54, 34);
  const coverVertices: number[] = [], coverIndices: number[] = [];
  for (let j = 0; j <= 26; j++) for (let i = 0; i <= 42; i++) {
    const x = (.025 + .95 * i / 42) * b.width, z = z0 + j / 26 * f.depth;
    coverVertices.push(x, height(x, z) + .25 * s, z);
    if (i < 42 && j < 26) { const k = j * 43 + i; coverIndices.push(k, k + 43, k + 1, k + 1, k + 43, k + 44); }
  }
  const cg = new T.BufferGeometry(); cg.setAttribute('position', new T.Float32BufferAttribute(coverVertices, 3)); cg.setIndex(coverIndices); cg.computeVertexNormals();
  const cover = b.mesh(cg, '#b7b494', false, false);
  const treePlaces = [[.19, .32], [.17, .59], [.31, .23], [.77, .25], [.81, .51], [.74, .64], [.46, .15], [.56, .23], [.26, .8], [.76, .84]];
  const trees = treePlaces.map(([u, v], i) => {
    const at = p(u, v); at[1] = height(at[0], at[2]) + .3 * s;
    const trunk = b.cylinder(at, [at[0], at[1] + 5.3 * s, at[2]], .26 * s, '#8b826c', false); b.outline(trunk);
    const crown = pebble(b, (2.1 + i % 3 * .25) * s, i < 4 ? '#849b7c' : '#a0ad86', 1); crown.position.set(at[0], at[1] + 5 * s, at[2]); crown.scale.set(1.1, .9, .92);
    return { at, trunk, crown };
  });
  const basin = p(.5, .72); basin[1] = height(basin[0], basin[2]);
  const pg = new T.CircleGeometry(1, 40); pg.rotateX(-Math.PI / 2);
  const pool = b.mesh(pg, C.water, false, false); pool.position.set(basin[0], basin[1] + .35 * s, basin[2]);
  const rainClouds = [0, 1, 2].map(i => {
    const m = pebble(b, (i === 1 ? 5 : 3.7) * s, C.paper, 1); m.position.set(...p(.39 + i * .105, .24, 44 + i % 2)); m.scale.set(1.2, .54, .65); return m;
  });
  const eroded = Array.from({ length: 14 }, () => pebble(b, .36 * s, '#aa825b'));
  const labels = labelSets(b, f, [
    [['植被保护', .5, 1.12, 3, 26], ['坡陡土薄', .18, .44, 39], ['裂隙发育', .78, 1.08, 9]],
    [['植被破坏', .5, 1.12, 3, 26], ['水土流失', .24, .52, 35], ['岩石裸露', .77, .75, 25]],
    [['雨时积水', .5, .85, 17, 26], ['裂隙渗漏', .78, 1.08, 9], ['峰丛洼地', .18, .43, 39]],
    [['山顶水源林', .5, .12, 37, 29], ['坡地经济林', .79, .56, 35, 29], ['洼地粮食作物', .5, 1.12, 7, 32]],
  ]);
  const dryTitle = b.label('晴时易旱', p(.5, .85, 17), 26 * s, 6 * s);
  const karstInputs = labels.map((set, selection) => {
    const input = selection === 1 || selection === 2
      ? { kind: 'replay' as const, selection, label: `从头观察${selection === 1 ? '失去覆被后的坡土去向' : '洼地积水与渗漏'}` }
      : { kind: 'select' as const, selection, label: `观察${selection === 0 ? '植被保护' : '因地安排农林'}结构` };
    set.forEach(mesh => { mesh.userData.modelInput = input; }); return input;
  });
  cover.userData.modelInput = karstInputs[1]; pool.userData.modelInput = karstInputs[2];
  trees.forEach(({ crown }) => { crown.userData.modelInput = karstInputs[1]; });
  let selected = 0, dry = false, state = evaluateKarstCover(0, 0), lastLoss = -1;
  return { update(t, n) {
    selected = stage(n, 3); state = evaluateKarstCover(t, selected); dry = state.dry; showLabels(labels, selected);
    labels[2][0].visible = selected === 2 && !dry; dryTitle.visible = dry;
    cover.visible = true; land.outline(height);
    if (state.loss !== lastLoss) {
      const attr = cg.attributes.position;
      for (let i = 0; i < attr.count; i++) {
        const x = attr.getX(i), z = attr.getZ(i), u = x / b.width, v = (z - z0) / f.depth;
        const patch = .5 + .5 * Math.sin(u * 31) * Math.sin(v * 21);
        attr.setY(i, height(x, z) + (.25 - state.loss * (.08 + .55 * patch)) * s);
      }
      attr.needsUpdate = true; cg.computeVertexNormals(); lastLoss = state.loss;
    }
    trees.forEach((tree, i) => {
      const remaining = i < 8 ? 1 - smooth(i * .045, i * .045 + .65, state.loss) : 1;
      const visible = remaining > .035; tree.trunk.visible = visible; tree.crown.visible = visible;
      tree.trunk.scale.y = remaining; tree.trunk.position.y = tree.at[1] * (1 - remaining);
      tree.crown.scale.set(1.1 * remaining, .9 * remaining, .92 * remaining); tree.crown.position.y = tree.at[1] + 5 * s * remaining;
      if (visible) { b.outline(tree.trunk, .3); b.outline(tree.crown, .36); }
    });
    const wet = state.wet;
    pool.visible = wet > .03; pool.scale.set((9 + 7 * wet) * s, 1, f.depth * (.09 + .055 * wet)); pool.position.y = basin[1] + (.15 + wet * 1.25) * s;
    if (pool.visible) b.contour(Array.from({ length: 41 }, (_, i): Vec3 => {
      const a = i / 40 * Math.PI * 2; return [basin[0] + Math.cos(a) * pool.scale.x, pool.position.y + .03 * s, basin[2] + Math.sin(a) * pool.scale.z];
    }), .4);
    rainClouds.forEach(m => { m.visible = selected === 2 && !dry; if (m.visible) b.outline(m, .3); });
    if (selected === 2 && !dry) for (let i = 0; i < 5; i++) {
      const x = (.35 + i * .065) * b.width, z = p(0, .34)[2];
      b.trace([[x, 40 * s, z], [x, height(x, z) + 2 * s, z]], t + i * .1, 2, 'flow', 1, .75);
    }
    if (selected < 3) {
      for (const sign of [-1, 1]) {
        const source = p(sign < 0 ? .24 : .76, .55), end = basin;
        const path = Array.from({ length: 15 }, (_, i): Vec3 => {
          const q = i / 14, x = source[0] + (end[0] - source[0]) * q, z = source[2] + (end[2] - source[2]) * q;
          return [x, height(x, z) + .6 * s, z];
        });
        b.trace(path, t, selected === 1 ? 4 : 2, selected === 1 ? 'accent' : 'flow', 1, dry ? .35 : .8);
      }
      const front = z1 + .15 * s;
      b.trace([[basin[0], basin[1] + .2 * s, basin[2]], [basin[0] + 3 * s, basin[1] - .4 * s, front], [basin[0] + 5 * s, 1.4 * s, front], [basin[0] + 11 * s, .2 * s, front]], t, 2, 'flow', 1, .65);
    }
    eroded.forEach((m, i) => {
      m.visible = selected === 1;
      const packet = state.particles[i], x = packet.u * b.width, z = p(0, packet.v)[2];
      m.position.set(x, height(x, z) + (.6 + (packet.retained ? i % 3 * .22 : 0)) * s, z); m.userData.karstSoilPacketId = packet.id;
    });
    if (selected === 3) {
      for (let i = 0; i < 6; i++) {
        const v = .62 + i * .045;
        b.contour(Array.from({ length: 15 }, (_, j): Vec3 => { const at = p(.38 + j / 14 * .24, v); at[1] = height(at[0], at[2]) + .35 * s; return at; }), .5);
      }
    }
  }, focusBounds: () => f.bounds(52), describe: () => ({ kind: 'karst-ecology-and-livelihood', state, selection: ['vegetation-protection', 'erosion-after-clearing', 'wet-flooding-dry-leakage', 'agroforestry-zonation'][selected], weather: selected === 2 ? dry ? 'dry' : 'rainy' : 'not-specified', fracturesAreSchematic: true, rockDesertificationIsNotInstantaneous: true, hydrologicalBalanceIsNotQuantified: true, buffersStable: true }) };
}

/** Small, deterministic solid forms for the paper textbook. The dimensions
 * describe a drawing, not a botanical measurement or a surveyed elevation. */
export type NaturalPoint = [number, number, number];
export interface NaturalSurface { positions: number[]; indices: number[] }
export type CrownHabit = 'rainforest' | 'evergreen' | 'deciduous' | 'conifer' | 'savanna' | 'shrub';
const tau = Math.PI * 2;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (a: number, b: number, v: number) => { const q = clamp((v - a) / (b - a)); return q * q * (3 - 2 * q); };
const cross = (a: NaturalPoint, b: NaturalPoint): NaturalPoint => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v: NaturalPoint): NaturalPoint => { const d = Math.hypot(...v); if (d < 1e-12) throw new Error('A natural-form axis must have length.'); return v.map(x => x / d) as NaturalPoint; };

/** One continuous lobed volume, with a lower edge, shoulders and a broken
 * upper silhouette. It is not a stack of spheres. Needle tiers and flat
 * savanna crowns have distinct profiles rather than different paint. */
export function buildCrownSurface(habit: CrownHabit, seed = 0): NaturalSurface {
  const positions: number[] = [], indices: number[] = [], sides = habit === 'conifer' ? 22 : 26, rings = habit === 'conifer' ? 19 : 10;
  const limits: Record<CrownHabit, [number, number]> = { rainforest: [-.34, .63], evergreen: [-.56, .66], deciduous: [-.44, .60], conifer: [-.62, .80], savanna: [-.16, .28], shrub: [-.40, .48] };
  const [low, high] = limits[habit];
  positions.push(0, low, 0);
  for (let ring = 1; ring <= rings; ring++) {
    const q = ring / (rings + 1), sin = Math.sin(Math.PI * q);
    for (let side = 0; side < sides; side++) {
      const a = side / sides * tau, lobes = .115 * Math.sin(a * 5 + seed * .91) + .055 * Math.cos(a * 9 - seed * .63) + .035 * Math.cos(a * 3 + q * 3);
      let radius = Math.pow(sin, habit === 'savanna' ? .53 : .64) * (1 + lobes * (.55 + .45 * sin));
      if (habit === 'conifer') radius = Math.pow(1 - q, .76) * (.81 + .19 * Math.cos(q * tau * 6)) * (1 + .055 * Math.sin(a * 7 + seed));
      if (habit === 'rainforest') radius *= .9 + .13 * q;
      const y = low + q * (high - low) + (habit === 'conifer' ? .012 : .031) * Math.sin(a * 4 + seed + q) * sin;
      positions.push(radius * Math.cos(a) + .07 * Math.sin(seed) * sin + .04 * q, y, radius * Math.sin(a) * (.8 + .025 * Math.cos(seed)) + .055 * Math.cos(seed) * sin);
    }
  }
  const top = positions.length / 3; positions.push(.04, high, 0);
  for (let side = 0; side < sides; side++) {
    const next = (side + 1) % sides;
    indices.push(0, 1 + side, 1 + next);
    for (let ring = 0; ring < rings - 1; ring++) {
      const a = 1 + ring * sides + side, b = 1 + ring * sides + next;
      indices.push(a, a + sides, b, b, a + sides, b + sides);
    }
    indices.push(top, 1 + (rings - 1) * sides + next, 1 + (rings - 1) * sides + side);
  }
  return { positions, indices };
}

function quadratic(a: NaturalPoint, b: NaturalPoint, c: NaturalPoint, q: number): NaturalPoint {
  return a.map((v, i) => (1 - q) ** 2 * v + 2 * (1 - q) * q * b[i] + q * q * c[i]) as NaturalPoint;
}

/** Capped tapered members share a single draw mesh. The members overlap at
 * branch junctions, with their end caps hidden inside the parent branch. */
function appendBranch(surface: NaturalSurface, a: NaturalPoint, b: NaturalPoint, c: NaturalPoint, r0: number, r1: number, segments = 9) {
  const start = surface.positions.length / 3, sides = 7;
  for (let ring = 0; ring <= segments; ring++) {
    const q = ring / segments, p = quadratic(a, b, c, q), tangent = unit(a.map((v, i) => 2 * (1 - q) * (b[i] - v) + 2 * q * (c[i] - b[i])) as NaturalPoint);
    const u = unit(cross(tangent, Math.abs(tangent[2]) < .9 ? [0, 0, 1] : [1, 0, 0])), v = cross(tangent, u), radius = r0 + (r1 - r0) * q;
    for (let side = 0; side < sides; side++) {
      const angle = side / sides * tau;
      surface.positions.push(...p.map((value, i) => value + radius * (Math.cos(angle) * u[i] + Math.sin(angle) * v[i])));
    }
  }
  for (let ring = 0; ring < segments; ring++) for (let side = 0; side < sides; side++) {
    const a = start + ring * sides + side, b = start + ring * sides + (side + 1) % sides;
    surface.indices.push(a, b, a + sides, b, b + sides, a + sides);
  }
  const bottom = surface.positions.length / 3; surface.positions.push(...a);
  const top = surface.positions.length / 3; surface.positions.push(...c);
  for (let side = 0; side < sides; side++) {
    const next = (side + 1) % sides;
    surface.indices.push(bottom, start + next, start + side, top, start + segments * sides + side, start + segments * sides + next);
  }
}

export function buildTreeSkeletonSurface(seed = 0, featured = false): NaturalSurface {
  const surface: NaturalSurface = { positions: [], indices: [] }, bend = Math.sin(seed * 1.7) * .009;
  appendBranch(surface, [0, 0, 0], [bend, .43, -.007], [.006, .86, .006], featured ? .032 : .023, .0055, 13);
  for (let branch = 0; branch < 3; branch++) {
    const angle = seed * .61 + branch / 3 * tau, h = .5 + branch * .054;
    const a: NaturalPoint = [bend * .4, h, 0], b: NaturalPoint = [Math.cos(angle) * .072, h + .16, Math.sin(angle) * .07], c: NaturalPoint = [Math.cos(angle) * .21, .82 + branch * .025, Math.sin(angle) * .175];
    appendBranch(surface, a, b, c, .011 - branch * .001, .0024);
    const fork = quadratic(a, b, c, .63), forkAngle = angle + (branch % 2 ? -.7 : .63);
    appendBranch(surface, fork, [Math.cos(forkAngle) * .16, .83, Math.sin(forkAngle) * .15], [Math.cos(forkAngle) * .255, .89, Math.sin(forkAngle) * .22], .0045, .0013, 6);
  }
  return surface;
}

/** A closed leaf with a raised midrib. The blade has actual thickness, and
 * its pointed tip is represented once, avoiding collapsed triangles. */
export function buildLeafBladeSurface(): NaturalSurface {
  return {
    positions: [0, 0, 0, .42, .035, -.24, 1, .065, 0, .42, .035, .24, .4, .12, 0, .4, -.018, 0],
    indices: [0, 4, 1, 1, 4, 2, 2, 4, 3, 3, 4, 0, 1, 5, 0, 2, 5, 1, 3, 5, 2, 0, 5, 3],
  };
}

/** Low, radiating pinnate fronds read as an understory plant rather than as
 * another row of miniature tree crowns or round pebbles. */
export function buildFernSurface(seed = 0): NaturalSurface {
  const surface: NaturalSurface = { positions: [], indices: [] }, blade = buildLeafBladeSurface();
  for (let frond = 0; frond < 6; frond++) {
    const angle = frond / 6 * tau + seed * .3, length = .87 + .15 * Math.sin(seed + frond * 2);
    const a: NaturalPoint = [0, .02, 0], b: NaturalPoint = [Math.cos(angle) * length * .46, .84, Math.sin(angle) * length * .46], c: NaturalPoint = [Math.cos(angle) * length, .42, Math.sin(angle) * length];
    appendBranch(surface, a, b, c, .012, .004, 7);
    for (let pair = 0; pair < 5; pair++) for (const sign of [-1, 1]) {
      const q = .24 + pair * .145, at = quadratic(a, b, c, q), leafletAngle = angle + sign * 1.05, size = (.28 - q * .18) * length, start = surface.positions.length / 3;
      for (let i = 0; i < blade.positions.length; i += 3) {
        const x = blade.positions[i] * size, y = blade.positions[i + 1] * size, z = blade.positions[i + 2] * size;
        surface.positions.push(at[0] + Math.cos(leafletAngle) * x - Math.sin(leafletAngle) * z, at[1] + y + x * .2, at[2] + Math.sin(leafletAngle) * x + Math.cos(leafletAngle) * z);
      }
      surface.indices.push(...blade.indices.map(i => i + start));
    }
  }
  return surface;
}

export interface ReliefCutSurface extends NaturalSurface {
  samples: { index: number; x: number; z: number }[];
  boundary: number[];
  bottomRing: number[];
}

/** A gently curved specimen footprint, with a genuinely closed subdivided
 * bottom. The mapping stays injective; it does not project several grid
 * vertices onto one rounded corner. All measurements still sample height. */
export function buildReliefCutSurface(x0: number, x1: number, z0: number, z1: number, height: (x: number, z: number) => number, nx = 44, nz = 26, bottom = 0, roundness = 0): ReliefCutSurface {
  if (nx < 2 || nz < 2 || !Number.isInteger(nx) || !Number.isInteger(nz) || x1 <= x0 || z1 <= z0) throw new Error('A relief cut needs an ordered area and at least two cells per axis.');
  const positions: number[] = [], indices: number[] = [], samples: ReliefCutSurface['samples'] = [], boundary: number[] = [], bottomRing: number[] = [];
  const strength = clamp(roundness, 0, .65) ** 2 / 2, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const u = i / nx * 2 - 1, v = j / nz * 2 - 1, x = cx + u * Math.sqrt(1 - strength * v * v) * (x1 - x0) / 2, z = cz + v * Math.sqrt(1 - strength * u * u) * (z1 - z0) / 2, y = height(x, z), index = positions.length / 3;
    if (!Number.isFinite(y) || y <= bottom) throw new Error('A relief surface must stay above its cut base.');
    positions.push(x, y, z); samples.push({ index, x, z });
    if (i < nx && j < nz) indices.push(index, index + nx + 1, index + 1, index + 1, index + nx + 1, index + nx + 2);
  }
  for (let i = 0; i <= nx; i++) boundary.push(i);
  for (let j = 1; j <= nz; j++) boundary.push(j * (nx + 1) + nx);
  for (let i = nx - 1; i >= 0; i--) boundary.push(nz * (nx + 1) + i);
  for (let j = nz - 1; j > 0; j--) boundary.push(j * (nx + 1));
  for (const index of boundary) { bottomRing.push(positions.length / 3); positions.push(positions[index * 3], bottom, positions[index * 3 + 2]); }
  const bottomCenter = positions.length / 3; positions.push(cx, bottom, cz);
  for (let i = 0; i < boundary.length; i++) {
    const next = (i + 1) % boundary.length;
    indices.push(boundary[i], boundary[next], bottomRing[next], boundary[i], bottomRing[next], bottomRing[i], bottomCenter, bottomRing[i], bottomRing[next]);
  }
  return { positions, indices, samples, boundary, bottomRing };
}

/** Small longitudinal ridges break the folded-sheet look, while the channel
 * floor and the narrow-V / broad-shallow distinction remain explicit. */
export function riverValleySurfaceHeight(u: number, v: number, plain: boolean) {
  const center = .5 + .035 * Math.sin(v * 4), bed = 3.4 - 1.3 * v, distance = u - center, q = Math.abs(distance), side = Math.sign(distance);
  if (plain) return bed + 3.5 * ease(.12, .43, q) + .16 * Math.sin(v * 8 + side) * ease(.18, .44, q);
  const flank = clamp(q / .44), ridge = .11 * Math.sin(v * 8.5 + side * 1.1) + .045 * Math.cos(v * 17 - q * 11);
  return bed + 28 * flank * (1 + ridge * ease(.035, .32, q)) + 1.15 * Math.sin(v * 18 + flank * 5 + side) * Math.sin(Math.PI * flank) * ease(.018, .08, q);
}

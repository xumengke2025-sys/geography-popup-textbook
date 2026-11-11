import { buildCrownSurface, buildTreeSkeletonSurface, type CrownHabit, type NaturalPoint, type NaturalSurface } from './textbook-natural-form-geometry';

/** Botanical profiles belong to this lesson. They are structural examples,
 * not identified species, measured leaf areas, or a succession sequence. */
export function vegetationCrown(habit: CrownHabit, seed: number): NaturalSurface {
  const data = buildCrownSurface(habit, seed);
  for (let i = 0; i < data.positions.length; i += 3) {
    const x = data.positions[i], y = data.positions[i + 1], z = data.positions[i + 2];
    const a = Math.atan2(z, x), r = Math.hypot(x, z);
    // Changes in branch spread and lower-crown opening distinguish forest
    // habits. Fine lobing stays subordinate to the large canopy silhouette.
    const lobe = 1 + (habit === 'evergreen' ? .035 : .075) * Math.sin(a * 3 + seed * .73)
      + .025 * Math.cos(a * 7 - y * 6 + seed);
    const stretch = habit === 'rainforest' ? 1.12 : habit === 'deciduous' ? 1.03 : habit === 'evergreen' ? .90 : 1;
    const turn = seed * .49, xx = x * lobe * stretch, zz = z * lobe;
    data.positions[i] = Math.cos(turn) * xx - Math.sin(turn) * zz;
    data.positions[i + 2] = Math.sin(turn) * xx + Math.cos(turn) * zz;
    if (habit !== 'conifer') data.positions[i + 1] = y + .035 * Math.sin(a * 3 + seed) * Math.min(1, r * 2);
  }
  return data;
}

function branch(out: NaturalSurface, a: NaturalPoint, c: NaturalPoint, r0: number, r1: number) {
  const d = c.map((v, i) => v - a[i]), length = Math.hypot(...d), axis = d.map(v => v / length);
  const helper = Math.abs(axis[1]) > .9 ? [1, 0, 0] : [0, 1, 0];
  const cross = (u: number[], v: number[]) => [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  let u = cross(axis, helper); const n = Math.hypot(...u); u = u.map(v => v / n); const v = cross(axis, u);
  const start = out.positions.length / 3, sides = 9;
  for (let end = 0; end < 2; end++) for (let j = 0; j < sides; j++) {
    const angle = j / sides * Math.PI * 2, radius = end ? r1 : r0, center = end ? c : a;
    out.positions.push(...center.map((p, i) => p + radius * (u[i] * Math.cos(angle) + v[i] * Math.sin(angle))));
  }
  const low = out.positions.length / 3; out.positions.push(...a, ...c);
  for (let j = 0; j < sides; j++) { const k = (j + 1) % sides;
    out.indices.push(start+j,start+k,start+j+sides,start+k,start+k+sides,start+j+sides,
      low,start+k,start+j,low+1,start+j+sides,start+k+sides);
  }
}

export function vegetationStem(habit: CrownHabit, seed: number, featured = false): NaturalSurface {
  if (!['conifer', 'savanna', 'shrub'].includes(habit)) return buildTreeSkeletonSurface(seed, featured);
  const out: NaturalSurface = { positions: [], indices: [] };
  if (habit === 'shrub') {
    for (let i = 0; i < 5; i++) { const a = seed * .3 + i * Math.PI * 2 / 5;
      branch(out, [0, 0, 0], [Math.cos(a) * .19, .52 + (i % 3) * .065, Math.sin(a) * .16], .025, .004);
    }
  } else if (habit === 'savanna') {
    branch(out, [0,0,0], [.012,.47,0], .037, .018);
    for (let i = 0; i < 5; i++) { const a = seed * .4 + i * Math.PI * 2 / 5;
      const elbow: NaturalPoint = [Math.cos(a)*.10,.65,Math.sin(a)*.085];
      branch(out,[.012,.43,0],elbow,.018,.008);
      branch(out,elbow,[Math.cos(a)*.29,.80 + (i%2)*.025,Math.sin(a)*.23],.008,.002);
    }
  } else {
    branch(out, [0,0,0], [0,.99,0], .025, .002);
    for (let level = 0; level < 7; level++) for (let i = 0; i < 5; i++) {
      const y = .32 + level * .087, a = i * Math.PI * 2 / 5 + level * .53 + seed * .3, radius = .25 * (1 - y);
      branch(out,[0,y,0],[Math.cos(a)*radius,y-.035,Math.sin(a)*radius],.007*(1-y)+.002,.0015);
    }
  }
  return out;
}

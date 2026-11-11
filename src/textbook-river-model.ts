/** A possible flood-triggered neck cutoff (textbook p.70), not a forecast or
 * a calibrated erosion simulation. Both renderers use these same paths. */
export type RiverPoint = readonly [number, number];
const clamp = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
const smooth = (a: number, b: number, n: number) => {
  const q = clamp((n - a) / (b - a)); return q * q * (3 - 2 * q);
};
const lerp = (a: RiverPoint, b: RiverPoint, t: number): RiverPoint =>
  [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function cubic(a: RiverPoint, b: RiverPoint, c: RiverPoint, d: RiverPoint, t: number): RiverPoint {
  const q = 1 - t;
  return [q ** 3 * a[0] + 3 * q * q * t * b[0] + 3 * q * t * t * c[0] + t ** 3 * d[0],
    q ** 3 * a[1] + 3 * q * q * t * b[1] + 3 * q * t * t * c[1] + t ** 3 * d[1]];
}
function sample(fn: (t: number) => RiverPoint, count: number) {
  return Array.from({ length: count + 1 }, (_, i) => fn(i / count));
}

export function evaluateRiverCutoff(input: number) {
  const phase = clamp(input), migration = smooth(0, .37, phase);
  const breach = smooth(.42, .65, phase), separation = smooth(.68, .94, phase);
  const left: RiverPoint = [.37 + .073 * migration, .73];
  const right: RiverPoint = [.63 - .073 * migration, .73];
  const bendAt = (q: number): RiverPoint => {
    const t = q * 3;
    if (t <= 1) return cubic(left, [.44, .57], [.23, .66], [.25, .39], t);
    if (t <= 2) return cubic([.25, .39], [.26, .06], [.74, .06], [.75, .39], t - 1);
    return cubic([.75, .39], [.77, .66], [.56, .57], right, t - 2);
  };
  const trim = .12 * separation;
  const upstream = sample(t => cubic([.012, .82], [.19, .89], [.29, .83], left, t), 28);
  const downstream = sample(t => cubic(right, [.72, .79], [.85, .84], [.988, .64], t), 28);
  const bend = sample(t => bendAt(trim + t * (1 - 2 * trim)), 100);
  const shortcut = breach > 0 ? sample(t => lerp(left, right, t * breach), 20) : [];
  const stage = phase < .42 ? 0 : phase < .84 ? 1 : 2;
  return { phase, migration, breach, separation, stage,
    caption: ['河曲', '洪水冲颈', '牛轭湖'][stage],
    upstream, downstream, bend, shortcut,
    riverWidth: .048, bendWidth: .048 - .005 * separation,
    shortcutWidth: .048 * smooth(0, .35, breach),
    bendFlow: 1 - smooth(.65, .83, phase), shortcutFlow: smooth(.55, .68, phase),
    isolated: separation >= .999, flood: smooth(.35, .45, phase) * (1 - smooth(.65, .83, phase)),
  };
}
export type RiverCutoffState = ReturnType<typeof evaluateRiverCutoff>;

/** Distance in units of scene width, with the actual depth/width ratio. */
export function distanceToRiver(point: RiverPoint, path: readonly RiverPoint[], aspect = 1) {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], dx = b[0] - a[0], dz = (b[1] - a[1]) * aspect;
    const px = point[0] - a[0], pz = (point[1] - a[1]) * aspect, length = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, (px * dx + pz * dz) / (length || 1)));
    best = Math.min(best, (px - t * dx) ** 2 + (pz - t * dz) ** 2);
  }
  return Math.sqrt(best);
}

export function riverCutoffSvg(phase: number) {
  const s = evaluateRiverCutoff(phase);
  const points = (path: readonly RiverPoint[]) => path.map(([u, v]) => `${u * 640},${v * 340}`).join(' ');
  const stroke = (path: readonly RiverPoint[], width: number, color: string) =>
    `<polyline points="${points(path)}" fill="none" stroke="${color}" stroke-width="${width * 640}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const paths = [s.upstream, s.downstream, s.bend, ...(s.shortcut.length ? [s.shortcut] : [])];
  const arrows = (path: readonly RiverPoint[], count: number, strength = 1) => strength < .05 ? '' : Array.from({ length: count }, (_, i) => {
    const q = (phase * 4 + i / count) % 1, index = Math.min(path.length - 2, Math.floor(q * (path.length - 1)));
    const p = lerp(path[index], path[index + 1], q * (path.length - 1) - index), d = path[index + 1];
    const a = Math.atan2((d[1] - path[index][1]) * 340, (d[0] - path[index][0]) * 640) * 180 / Math.PI;
    return `<path d="M-8-4 0 0-8 4" transform="translate(${p[0] * 640} ${p[1] * 340}) rotate(${a})" opacity="${strength}"/>`;
  }).join('');
  return `<svg class="flat-model-svg flat-explanation-svg" viewBox="0 0 640 390" role="img" aria-label="${s.caption}：洪水可能冲断河曲颈部，旧弯道分离后形成牛轭湖">
  <path d="M8 24H632V352H8Z" fill="#d9cdb6" stroke="#7c7b6b"/>
  ${paths.map((p, i) => stroke(p, (i === 3 ? s.shortcutWidth : i === 2 ? s.bendWidth : s.riverWidth) + .01, '#8d927e')).join('')}
  ${stroke(s.upstream, s.riverWidth, '#80aeb8')}${stroke(s.downstream, s.riverWidth, '#80aeb8')}${stroke(s.bend, s.bendWidth, '#80aeb8')}
  ${s.shortcut.length ? stroke(s.shortcut, s.shortcutWidth, '#80aeb8') : ''}
  <g fill="none" stroke="#336b77" stroke-width="1.8" stroke-linecap="round">${arrows(s.upstream, 2)}${arrows(s.downstream, 2)}${arrows(s.bend, 5, s.bendFlow)}${s.shortcut.length ? arrows(s.shortcut, 1, s.shortcutFlow) : ''}</g>
  <text x="320" y="380" text-anchor="middle" fill="#303a40" font-size="23" font-family="FieldSerif,SimSun,serif">${s.caption}</text></svg>`;
}

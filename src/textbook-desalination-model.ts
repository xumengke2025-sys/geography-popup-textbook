/** Teaching coordinates shared by the paper apparatus and SVG view.
 * Gold markers are salt-rich liquid pockets, not crystals or drinking water. */
export const BRINE_COLLECTOR = { left: 18, right: 82, back: 25, front: 62.5, bottom: 4, top: 9 } as const;
export const BRINE_POCKET_HALF_SIZE = [.625, .7, .625] as const;

export function evaluateDesalination(input: number, selection = 0) {
  const phase = Math.max(0, Math.min(1, Number.isFinite(input) ? input : 0));
  const progress = phase * phase * (3 - 2 * phase), mode = selection === 1 ? 1 : 0;
  const pockets = Array.from({ length: 16 }, (_, id) => {
    const retained = id < 4, angle = id / 16 * Math.PI * 2 + phase * Math.PI * 4;
    const radius = retained ? 8 : 8 + 22 * progress;
    const initial = 33 - Math.floor(Math.max(0, id - 4) / 4) * 4;
    const point: [number, number, number] = mode === 0
      ? [38 + id % 4 * 8, retained ? 23 + id * 2 : initial * (1 - progress) + 6 * progress, 53.4]
      : [50 + Math.cos(angle) * radius, retained ? 25 : 25 - 19 * progress,
        39 + Math.sin(angle) * radius * (retained ? .75 : .43)];
    const [x, y, z] = point, [hx, hy, hz] = BRINE_POCKET_HALF_SIZE, c = BRINE_COLLECTOR;
    const inCollector = !retained && x - hx >= c.left && x + hx <= c.right
      && z - hz >= c.back && z + hz <= c.front && y - hy >= c.bottom && y + hy <= c.top;
    return { id, retained, point, inCollector };
  });
  return { phase, progress, mode, pockets, retainedBrinePockets: pockets.filter(p => p.retained).length,
    collectedPockets: pockets.filter(p => p.inCollector).length,
    separatedBrineCollected: pockets.filter(p => !p.retained).every(p => p.inCollector) };
}

export function desalinationPocketProjection([x, y, z]: readonly number[]) {
  return [320 + (x - 50) * 6, 300 + (z - 43) * 1.2 - (y - 6) * 6] as const;
}

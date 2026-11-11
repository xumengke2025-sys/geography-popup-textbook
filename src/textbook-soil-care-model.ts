/** Water/salt tracers in one illustrative soil section. No field quantities,
 * rates or measured concentrations are implied. Water evaporates, salt does
 * not. The three conditions begin with the same retained salt identities. */
export const SOIL_CARE_STOPS = [
  { label: '初始土壤', phase: 0 }, { label: '水盐迁移', phase: .5 },
  { label: '结果对照', phase: 1 },
];
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const ease = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function evaluateSoilCare(phase: number, selection: number) {
  const t = clamp(phase), mode = Math.max(0, Math.min(2, Math.floor(Number.isFinite(selection) ? selection : 0)));
  const q = ease((t - .08) / .84), washing = mode === 1, covered = mode === 2;
  const packets = Array.from({ length: 20 }, (_, id) => {
    const initialSurface = id < 8, x = .21 + id % 8 * .078;
    const y = initialSurface ? 19.8 : 7 + (id - 8) % 4 * 2.3;
    const retained = id < 2 || id >= 8 && id < 11;
    let u = x, height = y;
    if (washing && !retained) {
      // Same dissolved-salt markers travel down with water, through the drain,
      // and remain outside the section. They never blink out of existence.
      const down = ease(q / .63), out = ease((q - .63) / .37);
      height = lerp(y, 4.5, down);
      u = lerp(x, .92 + id % 3 * .018, out);
    } else if (!washing && !initialSurface && (!covered || id < 10)) {
      height = lerp(y, 19.8, q);
    }
    return { id, u, height, initialSurface, drained: washing && !retained && q >= 1 };
  });
  const stageIndex = t < .08 ? 0 : t < .98 ? 1 : 2;
  const caption = stageIndex === 0 ? '从同一份土壤开始'
    : washing ? stageIndex === 1 ? '淡水下渗，溶解盐随水排出' : '排水带走部分盐，土壤仍有留盐'
    : covered ? stageIndex === 1 ? '覆盖减弱蒸发，原有盐仍保留' : '返盐减缓，覆盖没有直接脱盐'
    : stageIndex === 1 ? '水分上移，盐逐渐聚到表层' : '水分蒸发，盐留在土壤表层';
  const drainedSalt = washing ? .75 * q : 0;
  return { kind: 'soil-care' as const, phase: t, selection: mode, stageIndex, caption, packets,
    surfaceSalt: washing ? .4 - .3 * q : .4 + (covered ? .1 : .6) * q,
    retainedSalt: 1 - drainedSalt, drainedSalt, totalSalt: 1,
    freshwaterWithDrainage: washing, protectedFromEvaporation: covered,
    coverRemovesExistingSalt: false, actualReclamationDesign: false };
}

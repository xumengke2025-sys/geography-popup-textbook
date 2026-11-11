export interface SeaBreezeInput {
  phase: number;
  contrast: 0 | 0.5 | 1;
}
export interface SeaBreezeDerivedState {
  phase: number;
  sea: number;
  land: number;
  delta: number;
  direction: -1 | 0 | 1;
  strength: number;
  ground: string;
  upper: string;
  seaThermal: string;
  landThermal: string;
  pressure: {
    seaGround: string;
    landGround: string;
    seaUpper: string;
    landUpper: string;
  };
  stage: string;
}
export const AFTERNOON = 0.5,
  NIGHT = 0;
export function evaluateSeaBreeze(
  input: SeaBreezeInput,
): SeaBreezeDerivedState {
  const phase = ((input.phase % 1) + 1) % 1;
  const sea = 0.25 * Math.cos(2 * Math.PI * (phase - 2 / 3));
  const land =
    sea +
    input.contrast * (0.85 * Math.cos(2 * Math.PI * (phase - 7 / 12)) - sea);
  const delta = land - sea,
    a = Math.abs(delta),
    t = Math.max(0, Math.min(1, (a - 0.02) / 0.06));
  const direction: -1 | 0 | 1 = a <= 0.02 ? 0 : delta > 0 ? 1 : -1;
  const strength = t * t * (3 - 2 * t) * Math.min(1, a / 0.65);
  const hi = "相对高压",
    lo = "相对低压",
    eq = "差异很小";
  return {
    phase,
    sea,
    land,
    delta,
    direction,
    strength,
    ground:
      direction === 1
        ? "海洋 → 陆地"
        : direction === -1
          ? "陆地 → 海洋"
          : "局地环流很弱",
    upper:
      direction === 1
        ? "陆地 → 海洋"
        : direction === -1
          ? "海洋 → 陆地"
          : "局地环流很弱",
    seaThermal:
      direction === 1 ? "相对较冷" : direction === -1 ? "相对较暖" : "冷热相近",
    landThermal:
      direction === 1 ? "相对较暖" : direction === -1 ? "相对较冷" : "冷热相近",
    pressure: {
      seaGround: direction === 1 ? hi : direction === -1 ? lo : eq,
      landGround: direction === 1 ? lo : direction === -1 ? hi : eq,
      seaUpper: direction === 1 ? lo : direction === -1 ? hi : eq,
      landUpper: direction === 1 ? hi : direction === -1 ? lo : eq,
    },
    stage:
      phase < 0.15 || phase > 0.9
        ? "夜间"
        : phase < 0.35
          ? "日出附近"
          : phase < 0.68
            ? "午后"
            : "日落附近",
  };
}
// Streamfunction ψ=A sin(π(x+1)/2) sin(πy); divergence-free within the section.
export function flowAt(x: number, y: number, state: SeaBreezeDerivedState) {
  const a = state.direction * state.strength;
  return {
    u: a * Math.PI * Math.sin((Math.PI * (x + 1)) / 2) * Math.cos(Math.PI * y),
    v:
      ((-a * Math.PI) / 2) *
      Math.cos((Math.PI * (x + 1)) / 2) *
      Math.sin(Math.PI * y),
  };
}

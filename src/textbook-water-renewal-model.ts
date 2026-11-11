const clamp = (value: number, fallback = 0) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;

/** The existing 3D lesson's normalized scientific state, now shared with 2D.
 * All rates, capacities and time intervals are illustrative teaching choices. */
export function evaluateWaterRenewal(phase: number, selection = 0) {
  const t = clamp(phase), mode = selection === 1 || selection === 2 ? selection : 0;
  const replenishmentRate = .24, withdrawalRate = mode === 1 ? .81 : .24;
  const level = mode === 1 ? .7 - t * .57 : .7;
  return {
    kind: 'water-renewal' as const, phase: t, selection: mode, level,
    contaminated: mode === 2, initialLevel: .7,
    supplied: replenishmentRate * t, withdrawn: withdrawalRate * t,
    receiverLevel: withdrawalRate * t / .81 * .83,
    localAvailableWaterOnly: true, globalWaterDestroyed: false, ratesAreIllustrative: true,
    receiverCapacityIsCalibrated: false, contaminationIsWaterLoss: false,
    markersArePollutantMolecules: false, waterSafetyCertified: false,
  };
}

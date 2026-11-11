import { describe, it, expect } from "vitest";
import { evaluateSeaBreeze, flowAt } from "../src/model";
import { initial, observation, complete } from "../src/state";
import { lesson, transfer } from "../src/content";
describe("qualitative sea breeze", () => {
  it("opposite circulation and same-height pressure at afternoon and night", () => {
    for (const [phase, sign] of [
      [0.5, 1],
      [0, -1],
    ]) {
      const s = evaluateSeaBreeze({ phase, contrast: 1 });
      expect(s.direction).toBe(sign);
      expect(Math.sign(flowAt(0, 0.1, s).u)).toBe(sign);
      expect(Math.sign(flowAt(0, 0.9, s).u)).toBe(-sign);
      expect(Math.sign(flowAt(0.8, 0.5, s).v)).toBe(sign);
      expect(Math.sign(flowAt(-0.8, 0.5, s).v)).toBe(-sign);
      expect(s.pressure.landGround === "相对低压").toBe(sign === 1);
      expect(s.pressure.landUpper === "相对高压").toBe(sign === 1);
    }
  });
  it("continuous periodic, finite, reproducible and weakened contrast never stronger", () => {
    for (let i = 0; i <= 1000; i++) {
      const phase = i / 1000,
        a = evaluateSeaBreeze({ phase, contrast: 1 }),
        b = evaluateSeaBreeze({ phase, contrast: 0.5 }),
        z = evaluateSeaBreeze({ phase, contrast: 0 });
      expect(Number.isFinite(a.strength)).toBe(true);
      expect(z.strength).toBe(0);
      expect(z.delta).toBe(0);
      expect(b.strength).toBeLessThanOrEqual(a.strength);
      expect(
        evaluateSeaBreeze({ phase: phase + 1, contrast: 1 }).delta,
      ).toBeCloseTo(a.delta, 12);
      expect(evaluateSeaBreeze({ phase, contrast: 1 })).toEqual(a);
    }
  });
  it("streamfunction field is divergence free numerically", () => {
    const s = evaluateSeaBreeze({ phase: 0.5, contrast: 1 }),
      h = 1e-5;
    for (const x of [-0.8, 0, 0.8])
      for (const y of [0.1, 0.5, 0.9]) {
        const div =
          (flowAt(x + h, y, s).u - flowAt(x - h, y, s).u) / (2 * h) +
          (flowAt(x, y + h, s).v - flowAt(x, y - h, s).v) / (2 * h);
        expect(Math.abs(div)).toBeLessThan(1e-7);
      }
  });
  it("stamp requires valid observations and all checked answers", () => {
    const p = initial();
    p.diagram = lesson.challenge.map((q) => q.answer);
    p.transfer = transfer.map((q) => q.answer);
    p.checked = p.transferChecked = true;
    expect(complete(p)).toBe(false);
    p.observations = [
      observation({ phase: 0.5, contrast: 1 })!,
      observation({ phase: 0, contrast: 1 })!,
      observation({ phase: 0.5, contrast: 0 })!,
    ];
    expect(complete(p)).toBe(true);
    p.diagram[3] = "相对低压";
    expect(complete(p)).toBe(false);
    expect(observation({ phase: 0.8, contrast: 1 })).toBeNull();
  });
});

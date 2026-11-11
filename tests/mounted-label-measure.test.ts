import { describe, it, expect } from 'vitest';
import { measureProjectedLabel } from '../src/textbook-framing';

describe('mounted inscription visibility measurement', () => {
  it('keeps the full bounds and text height when opposite corners share a scanline', () => {
    const bounds = measureProjectedLabel([[10, 30], [90, 50], [100, 30], [20, 10]], .68);
    expect(bounds).toMatchObject({ left: 10, right: 100, top: 10, bottom: 50 });
    expect(bounds.fontPx).toBeCloseTo(Math.sqrt(500) * .68, 8);
  });
  it('preserves an axis aligned label and tolerates perspective foreshortening', () => {
    expect(measureProjectedLabel([[0, 40], [100, 40], [100, 0], [0, 0]], .5).fontPx).toBe(20);
    const perspective = measureProjectedLabel([[0, 40], [95, 30], [100, 5], [2, 0]], .6);
    expect(perspective.fontPx).toBeGreaterThan(15);
    expect(Object.values(perspective).every(Number.isFinite)).toBe(true);
  });
});

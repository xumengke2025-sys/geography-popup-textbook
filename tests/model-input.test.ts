import { describe, expect, it } from 'vitest';
import { phaseDialPoint, phaseFromDialPoint, phaseTrackPoint, phaseFromTrackPoint, type PhaseDial, type PhaseTrack } from '../src/textbook-model-input';
import { evaluateSeaBreeze } from '../src/model';

const dial: PhaseDial = { center: [70, 90, -120], radiusX: 42, radiusY: 7 };

describe('direct day/night control', () => {
  it('has readable noon/night positions without altering the model plane', () => {
    expect(phaseDialPoint(.5, dial)).toEqual([70, 97, -120]);
    expect(phaseDialPoint(0, dial)).toEqual([70, 83, -120]);
    expect(phaseFromDialPoint(112, 90, dial, .5)).toBeCloseTo(.25, 12);
    expect(phaseFromDialPoint(28, 90, dial, .5)).toBeCloseTo(.75, 12);
  });

  it('gives the same scientific state when dragging forward, back or across midnight', () => {
    for (const phase of [.02, .23, .5, .79, .8, .82, .98, 1.02, -.02]) {
      const [x, y] = phaseDialPoint(phase, dial);
      const forward = phaseFromDialPoint(x, y, dial, .1);
      const backward = phaseFromDialPoint(x, y, dial, .9);
      expect(forward).toBeCloseTo(((phase % 1) + 1) % 1, 12);
      expect(backward).toBe(forward);
      const expected = evaluateSeaBreeze({ phase, contrast: 1 });
      const actual = evaluateSeaBreeze({ phase: forward, contrast: 1 });
      expect(actual.direction).toBe(expected.direction);
      expect(actual.strength).toBeCloseTo(expected.strength, 12);
    }
  });

  it('keeps the last valid state when a drag crosses the undefined center', () => {
    expect(phaseFromDialPoint(70, 90, dial, .43)).toBe(.43);
    expect(phaseFromDialPoint(70.1, 90.1, dial, .43)).toBe(.43);
    expect(phaseFromDialPoint(Number.NaN, 90, dial, .43)).toBe(.43);
    expect(phaseFromDialPoint(70, Number.POSITIVE_INFINITY, dial, .43)).toBe(.43);
  });

  it('keeps its input mapping when the model is translated or scaled', () => {
    const moved: PhaseDial = { center: [-30, 250, 65], radiusX: 105, radiusY: 17.5 };
    for (const phase of [.05, .28, .57, .81, .95]) {
      const [x, y] = phaseDialPoint(phase, moved);
      expect(phaseFromDialPoint(x, y, moved, 0)).toBeCloseTo(phase, 12);
    }
  });
});

describe('direct process pull tab', () => {
  const track: PhaseTrack = { start: [10, 5, -90], end: [90, 25, -90] };

  it('keeps the same process when dragging either way or after changing the model scale', () => {
    for (const scale of [.4, 1, 3]) {
      const shifted: PhaseTrack = { start: track.start.map(n => n * scale + 47) as [number, number, number],
        end: track.end.map(n => n * scale + 47) as [number, number, number] };
      for (const phase of [0, .17, .5, .81, 1]) {
        const [x, y, z] = phaseTrackPoint(phase, shifted);
        expect(z).toBe(shifted.start[2]);
        expect(phaseFromTrackPoint(x, y, shifted, 0)).toBeCloseTo(phase, 12);
        expect(phaseFromTrackPoint(x, y, shifted, 1)).toBeCloseTo(phase, 12);
      }
    }
  });

  it('ignores perpendicular drift and clamps to the two rail ends', () => {
    const [x, y] = phaseTrackPoint(.45, track);
    expect(phaseFromTrackPoint(x - 20, y + 80, track, 0)).toBeCloseTo(.45, 12);
    expect(phaseFromTrackPoint(-1000, -1000, track, .5)).toBe(0);
    expect(phaseFromTrackPoint(1000, 1000, track, .5)).toBe(1);
  });

  it('preserves a grab offset instead of snapping the handle to an edge click', () => {
    const [x, y] = phaseTrackPoint(.38, track), grab = { x: x + 3.5, y: y - 1.2 };
    const offset = { x: x - grab.x, y: y - grab.y };
    expect(phaseFromTrackPoint(grab.x + offset.x, grab.y + offset.y, track, 0)).toBeCloseTo(.38, 12);
    expect(phaseFromTrackPoint(grab.x + 20 + offset.x, grab.y + 5 + offset.y, track, 0)).toBeCloseTo(.63, 12);
  });

  it('retains the last valid process for a collapsed rail or invalid ray point', () => {
    expect(phaseFromTrackPoint(4, 5, { start: [1, 2, 3], end: [1, 2, 3] }, .61)).toBe(.61);
    expect(phaseFromTrackPoint(Number.NaN, 5, track, .61)).toBe(.61);
    expect(phaseFromTrackPoint(4, Number.POSITIVE_INFINITY, track, .61)).toBe(.61);
  });
});

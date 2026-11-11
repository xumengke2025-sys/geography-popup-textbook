import { describe, expect, it } from 'vitest';
import { playbackPolicy, restartForSelection } from '../src/textbook-playback-policy';

describe('playback represents a visible learning task', () => {
  it('does not pretend structures or fixed comparisons have a timeline', () => {
    for (const effect of ['spheres','soil-composition','density','geo-time','habitable','air-composition','warehouse'] as const)
      expect(playbackPolicy({effect}, 0)).toMatchObject({enabled:false,autoplay:false});
    for (const selection of [0,1,3,6]) expect(playbackPolicy({effect:'vegetation'},selection).enabled).toBe(false);
    for (const selection of [2,4,5]) expect(playbackPolicy({effect:'vegetation'},selection).enabled).toBe(true);
  });
  it('allows observation position without automatically pulling it away from the reader', () => {
    expect(playbackPolicy({effect:'strata'},3)).toMatchObject({enabled:true,autoplay:false,once:true,label:'地层展开程度'});
    expect(playbackPolicy({effect:'terrain-observation'},0).label).toBe('观察位置');
  });
  it('starts a warning on entry while preserving near/far comparison at the same instant', () => {
    expect(playbackPolicy({effect:'quake'},0).enabled).toBe(false);
    expect(playbackPolicy({effect:'quake',playback:'once'},1)).toMatchObject({enabled:true,once:true});
    expect(restartForSelection({effect:'quake'},0,1)).toBe(true);
    expect(restartForSelection({effect:'quake'},1,2)).toBe(false);
  });
  it('restarts independent trials, but not a focus change or repeat selection', () => {
    expect(restartForSelection({effect:'flood',restartOnSelection:true},0,1)).toBe(true);
    expect(restartForSelection({effect:'flood',restartOnSelection:true},1,1)).toBe(false);
    expect(restartForSelection({effect:'soil-texture'},0,1)).toBe(false);
  });
});

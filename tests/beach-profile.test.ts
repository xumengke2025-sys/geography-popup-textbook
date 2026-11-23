import { expect, it } from 'vitest';
import { beachGrain, beachGrains, beachHeight, beachShore, beachSwash } from '../src/textbook-beach-profile';

it('returns sediment partway on the first backwash and retains it after the second swash',()=>{
  for(const i of beachGrains.keys()){
    const [start,first,returned,second,end]=[0,.245,.475,.715,1].map(t=>beachGrain(i,t));
    const inland=({u,v}:typeof start)=>beachShore(u)-v;
    expect(inland(start)).toBeLessThan(0);
    expect(inland(first)).toBeGreaterThan(inland(returned));
    expect(inland(returned)).toBeGreaterThan(inland(start));
    expect(inland(second)).toBeGreaterThan(inland(first));
    expect(inland(end)).toBeGreaterThan(0);
    expect(end.height).toBe(beachHeight(end.u,end.v));
    expect(beachSwash(end.u,1)).toBeCloseTo(beachShore(end.u),10);
    expect(beachGrain(i,.98)).toEqual(end);
  }
});

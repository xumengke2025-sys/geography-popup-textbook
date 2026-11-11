import { expect, it } from 'vitest';
import { advancePresentationPhase as advance, presentationClock } from '../src/textbook-playback-rhythm';
it('preserves duration, speed ratios and deterministic resume across frame rates', () => {
  for (const effect of ['river','coastal-landform','remote','mars-base','greenhouse','water','soil-factors','urban-waterlogging','solar-activity']) {
    expect(advance(effect, 0, 0, 1, true)).toBe(1);
    let phase = .17;
    for (let i = 0; i < 120; i++) phase = advance(effect, 0, phase, .003, true);
    expect(phase).toBeCloseTo(advance(effect, 0, .17, .36, true), 10);
    expect(advance(effect, 0, .65, 0, true)).toBeCloseTo(.65, 12);
    const one = advance(effect, 0, 0, .25, true);
    expect(advance(effect, 0, one, .25, true)).toBeCloseTo(advance(effect, 0, 0, .5, true), 12);
  }
});
it('eases clock velocity at event boundaries and spends time on arrival without changing the total duration',()=>{
  for(const [effect,selection,a,b] of [['river',0,.38,.50],['remote',0,.40,.48],['soil-factors',2,.47,.63],['water',0,.46,.67],['solar-activity',1,.41,.59]] as const){
    const h=.00001,clock=(p:number)=>presentationClock(effect,selection,p);
    for(const edge of [a,b]){
      const before=(clock(edge)-clock(edge-h))/h,after=(clock(edge+h)-clock(edge))/h;
      expect(Math.abs(before-after)).toBeLessThan(.0001);
    }
    const middle=(a+b)/2;
    expect((clock(middle+h)-clock(middle))/h).toBeGreaterThan((clock(.05+h)-clock(.05))/h);
    expect(clock(0)).toBe(0);expect(clock(1)).toBe(1);
    expect(advance(effect,selection,0,1,true)).toBe(1);
  }
});
it('gives breach and reception more time while leaving the day/night clock and other coast types unchanged', () => {
  expect(advance('river', 0, .43, .005, true) - .43).toBeLessThan(advance('river', 0, .1, .005, true) - .1);
  expect(advance('breeze', 0, .5, .01, false)).toBe(.51);
  expect(advance('coastal-landform', 1, .5, .01, true)).toBe(.51);
  expect(advance('river', 0, .99, .1, true)).toBe(1);
  expect(advance('remote', 0, 1, .1, false)).toBeCloseTo(advance('remote', 0, 0, .1, false));
});

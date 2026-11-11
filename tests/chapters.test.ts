import {describe,it,expect} from 'vitest';
import {evaluateWater,evaluateRiver,initialChapters,waterModes,chapterComplete,samplePath,riverBend} from '../src/chapters';

describe('textbook water and river figures',()=>{
  it('sea–land circulation includes both return paths and other cycles stay distinct',()=>{
    const p=initialChapters().water;
    expect(evaluateWater(p).active).toEqual(expect.arrayContaining(['transport','runoff','infiltration','groundwater']));
    p.mode='海上内循环';expect(evaluateWater(p).active).toEqual(['evapSea','rainSea']);
    p.mode='陆地内循环';expect(evaluateWater(p).active).not.toContain('transport');
    expect(evaluateWater({...p,phase:1}).phase).toBe(0);
  });
  it('cutoff opens before isolation, remains continuous and can be scrubbed backwards',()=>{
    let cut=0,isolation=0;
    for(let i=0;i<=1000;i++){
      const v=evaluateRiver(i/1000);
      expect(v.cut).toBeGreaterThanOrEqual(cut);expect(v.isolation).toBeGreaterThanOrEqual(isolation);
      if(v.isolation>0)expect(v.cut).toBe(1);
      expect(v.cut-cut).toBeLessThan(.01);expect(v.isolation-isolation).toBeLessThan(.01);
      cut=v.cut;isolation=v.isolation;
    }
    expect(evaluateRiver(0).connected).toBe(true);expect(evaluateRiver(1).connected).toBe(false);
    expect(evaluateRiver(.52)).toEqual(evaluateRiver(.52));
    expect(samplePath(riverBend,0)).toEqual(riverBend[0]);expect(samplePath(riverBend,1)).toEqual(riverBend.at(-1));
  });
  it('chapter stamps require observations as well as checked answers',()=>{
    const p=initialChapters();p.water.answer=0;p.water.checked=true;p.river.answer=1;p.river.checked=true;
    expect(chapterComplete('water',p)).toBe(false);expect(chapterComplete('river',p)).toBe(false);
    p.water.visited=[...waterModes];p.river.visited=['河曲','牛轭湖'];
    expect(chapterComplete('water',p)).toBe(true);expect(chapterComplete('river',p)).toBe(true);
  });
});

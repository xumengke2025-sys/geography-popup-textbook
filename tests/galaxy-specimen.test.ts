import {expect,it,vi} from 'vitest';
vi.mock('../src/reference/engine.js',async()=>({THREE:await import('three')}));
import {galaxySpecimenGeometry} from '../src/textbook-galaxy-specimen';

it('builds the same finite stellar volume with a thicker bulge and a thin outer disk',()=>{
  const g=galaxySpecimenGeometry(23),again=galaxySpecimenGeometry(23);
  const p=g.attributes.position,n=g.attributes.normal,c=g.attributes.color;
  expect(p.array).toEqual(again.attributes.position.array);
  let centralHeight=0,outerHeight=0;
  for(let i=0;i<p.count;i++){
    for(let k=0;k<3;k++){
      expect(Number.isFinite(p.array[i*3+k])).toBe(true);expect(Number.isFinite(n.array[i*3+k])).toBe(true);
      expect(c.array[i*3+k]).toBeGreaterThanOrEqual(0);expect(c.array[i*3+k]).toBeLessThanOrEqual(1);
    }
    const r=Math.hypot(p.getX(i),p.getY(i)/.72),h=Math.abs(p.getZ(i));
    if(r<5)centralHeight=Math.max(centralHeight,h);if(r>14)outerHeight=Math.max(outerHeight,h);
  }
  expect(centralHeight).toBeGreaterThan(outerHeight*2);
  expect(p.count/3).toBeLessThan(13000);g.dispose();again.dispose();
});

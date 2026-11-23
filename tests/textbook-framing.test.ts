import { describe, expect, it } from 'vitest';
import { fitModelViewport } from '../src/textbook-framing';

describe('model framing respects usable screen space', () => {
  const corners: [number,number,number][]=[];
  for(const x of [-65,65])for(const y of [-38,38])for(const z of [-26,26])corners.push([x,y,z]);
  for(const [width,height,top,bottom] of [[1920,1080,86,180],[1366,768,86,170],[1024,768,240,190],[713,818,230,190]]){
    it(`keeps every perspective corner clear of controls at ${width}×${height}`,()=>{
      const fit=fitModelViewport(corners,width,height,35,top,bottom),tan=Math.tan(35*Math.PI/360);
      for(const [x,y,z] of corners){
        const sx=x/((fit.distance-z)*tan*width/height),sy=(y+fit.shift)/((fit.distance-z)*tan);
        expect(Math.abs(sx)).toBeLessThanOrEqual(fit.horizontal);
        expect(sy).toBeLessThanOrEqual(fit.top);
        expect(sy).toBeGreaterThanOrEqual(fit.bottom);
      }
    });
  }
  it('a small observation is actually framed closer than an overview',()=>{
    const small=corners.map(p=>p.map(v=>v*.2) as [number,number,number]);
    expect(fitModelViewport(small,1366,900,35,86,170).distance)
      .toBeLessThan(fitModelViewport(corners,1366,900,35,86,170).distance*.4);
  });
  it('keeps the entire model between a left caption and the chapter tabs',()=>{
    const width=1024,height=768,leftInset=212,tan=Math.tan(35*Math.PI/360);
    const fit=fitModelViewport(corners,width,height,35,86,170,leftInset);
    for(const [x,,z] of corners){
      const ndc=(x+fit.shiftX)/((fit.distance-z)*tan*width/height);
      const screen=(1+ndc)*width/2;
      expect(screen).toBeGreaterThanOrEqual(leftInset);
      expect(screen).toBeLessThanOrEqual(width-110);
    }
  });
});

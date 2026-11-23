import { describe, expect, it } from 'vitest';
import { floodGrid, floodSites, floodSample, floodChannel, tributaries, connectedFlood } from '../src/textbook-flood-basin';
import { evaluateFloodSequence } from '../src/textbook-ground-process-model';
import { floodSectionDrawing } from '../src/textbook-flood-basin-drawing';

describe('flooding on the survey channel',()=>{
  it('both incised headwaters descend continuously to wet river junctions on the actual terrain mesh',()=>{
    for(const route of tributaries){
      let previous=Infinity;
      for(let i=1;i<route.length;i++){
        const a=route[i-1],b=route[i];
        for(let k=0;k<=16;k++){
          const h=floodSample(a[0]+(b[0]-a[0])*k/16,a[1]+(b[1]-a[1])*k/16).h;
          expect(h).toBeLessThanOrEqual(previous+1e-6);previous=h;
        }
      }
      expect(previous).toBeLessThan(2.9);expect(floodSample(route[0][0],route[0][1]).h-previous).toBeGreaterThan(8);
    }
  });
  it('reaches the isolated low settlement across its real sill, in order and reversibly',()=>{
    const before=connectedFlood(4.99),overtopped=connectedFlood(5.001),crest=connectedFlood(7.4);
    const [x,z]=floodSites[0];expect(floodSample(x,z).h).toBeLessThan(4.99);
    expect(before.inundated(x,z)).toBe(false);expect(before.inundated(floodChannel(42),42)).toBe(true);
    expect(overtopped.sites).toEqual([true,false,false]);expect(crest.sites).toEqual([true,true,true]);
    expect(connectedFlood(4.99).sites).toEqual(before.sites);
    expect(crest.area).toBeGreaterThan(overtopped.area);expect(crest.area).toBeLessThan(floodGrid.nx*floodGrid.nz);
    for(let i=0;i<crest.triangles.length;i+=2){
      const h=floodSample(crest.triangles[i],crest.triangles[i+1]).h;
      if(h>7.400001)throw new Error('water projects above dry ground at '+crest.triangles.slice(i,i+2));
    }
  });
  it('uses the measured rise in model divisions in the chart and the cross-section under both trials',()=>{
    for(const phase of [0,.36,.75,1,.4]){
      expect(evaluateFloodSequence(phase,0).waterLevel).toBe(2.9);
      expect(floodSectionDrawing(phase,0)).toContain('水位 +0.0 格');
      const stage=evaluateFloodSequence(phase,1).waterLevel;
      expect(floodSectionDrawing(phase,1)).toContain('水位 +'+(stage-2.9).toFixed(1)+' 格');
    }
    expect(evaluateFloodSequence(1,1).waterLevel).toBe(7.4);
  });
});
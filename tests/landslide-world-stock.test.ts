import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { SLIDE_BODY_VOLUME } from '../src/textbook-landslide-model';
import type { TextbookGeometry } from '../src/textbook-geometry';
vi.mock('../src/reference/engine.js',async()=>({THREE:await import('three')}));
import { coherentSpecimen } from '../src/textbook-landslide-specimen';

describe('sculpted rigid slide specimen',()=>{
  it('retains the scientific solid volume in the actual displaced and weathered visual geometry',()=>{
    const b={pop:{u:{uSurfAlpha:{value:1}}},mesh:(g:T.BufferGeometry)=>new T.Mesh(g)};
    const s=2.9,m=coherentSpecimen(b as unknown as TextbookGeometry,s);
    const pos=m.geometry.attributes.position,indices=m.geometry.index.array;
    const point=(id:number)=>new T.Vector3().fromBufferAttribute(pos,id);
    let measured=0;
    for(let i=0;i<indices.length;i+=3){
      const [a,e,k]=[indices[i],indices[i+1],indices[i+2]].map(point);
      measured+=a.dot(e.cross(k))/6;
    }
    expect(Math.abs(measured)/s**3).toBeCloseTo(SLIDE_BODY_VOLUME,3);
    expect(m.material.userData.earthScan).toBe('valley');
  });
});

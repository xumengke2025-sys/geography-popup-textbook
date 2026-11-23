import { describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
import type { TextbookGeometry } from '../src/textbook-geometry';
vi.mock('../src/reference/engine.js',async()=>({THREE:await import('three')}));
import { buildWarehouseWorld } from '../src/textbook-warehouse-world';
import { WAREHOUSE_SITES, WAREHOUSE_TOWNS, WAREHOUSE_WATER_LEVEL, warehouseHeight, warehouseRoutes, sampleWarehouseRoute } from '../src/textbook-warehouse-relief';

describe('fictional site comparison retains its geographical evidence',()=>{
  it('joins each actual loading dock to its terrain road and retains static comparison inputs',()=>{
    const meshes:Three.Mesh[]=[];
    const mesh=(geometry:Three.BufferGeometry,color:string)=>{const m=new Three.Mesh(geometry,new Three.MeshBasicMaterial({color}));meshes.push(m);return m};
    const b={width:100,meshes,mesh,materialFor:(_role:string,color:string)=>new Three.MeshBasicMaterial({color}),stroke(){},house(){},outline(){},label:()=>mesh(new Three.PlaneGeometry(10,4),'#fff')};
    const motion=buildWarehouseWorld(b as unknown as TextbookGeometry);
    const ramps=meshes.filter(m=>m.userData.reliefPart==='terrain-contact-loading-ramp');expect(ramps).toHaveLength(3);
    ramps.forEach((r,i)=>{
      const[x,z]=WAREHOUSE_SITES[i],a=r.geometry.getAttribute('position');
      const front=[] as Three.Vector3[],back=[] as Three.Vector3[];
      // First 4*8*6 vertices are the continuous driving surface, not skirts.
      for(let j=0;j<4*8*6;j++){const q=new Three.Vector3().fromBufferAttribute(a,j);if(Math.abs(q.z-(-174+z+5.7))<1e-4)front.push(q);if(Math.abs(q.z-(-174+z+3.75))<1e-4)back.push(q)}
      expect(front.length).toBeGreaterThan(0);expect(back.length).toBeGreaterThan(0);
      front.forEach(q=>expect(q.y).toBeCloseTo(warehouseHeight(q.x,z+5.7)+.08,5));
      back.forEach(q=>expect(q.y).toBeCloseTo(warehouseHeight(x,z)+1,5));
      expect(r.userData.modelInput.selection).toBe(i);
    });
    const identity=meshes.map(m=>m.geometry.uuid);
    const seats=meshes.filter(m=>m.userData.reliefPart==='candidate-index-inlay'),labels=meshes.filter(m=>m.userData.reliefPart==='candidate-index-label');
    for(const selection of[0,1,2,0]){
      motion.update(.6,selection,0,true);expect(meshes.map(m=>m.geometry.uuid)).toEqual(identity);expect((motion.describe!()as any).optimalSiteComputed).toBe(false);
      labels.forEach((m,i)=>expect(m.position.y-(2.17+seats[i].position.y)).toBeCloseTo(.06,10));
    }
  });
  it('exposes the lowland candidate under the same level without flooding the other two',()=>{
    const heights=WAREHOUSE_SITES.map(([x,z])=>warehouseHeight(x,z));
    expect(heights[0]).toBeLessThan(WAREHOUSE_WATER_LEVEL);
    expect(heights[1]).toBeGreaterThan(WAREHOUSE_WATER_LEVEL);
    expect(heights[2]).toBeGreaterThan(heights[1]+8);
  });
  it('connects all three storehouse loading aprons to the same three village lanes',()=>{
    WAREHOUSE_SITES.forEach(([x,z],i)=>{
      const routes=warehouseRoutes(i);expect(routes).toHaveLength(3);
      routes.forEach((route,j)=>{
        expect(route[0]).toEqual([x,z+5.7]);
        expect(route.at(-1)).toEqual([WAREHOUSE_TOWNS[j][0],WAREHOUSE_TOWNS[j][1]+3.3]);
        const sampled=sampleWarehouseRoute(route);expect(sampled[0]).toEqual(route[0]);expect(sampled.at(-1)).toEqual(route.at(-1));
        sampled.forEach(([a,c])=>expect(Number.isFinite(warehouseHeight(a,c))).toBe(true));
      });
    });
  });
  it('keeps the mountain detour longer without inventing journey times',()=>{
    const length=(route:number[][])=>route.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-route[i][0],p[1]-route[i][1]),0);
    for(let i=0;i<3;i++)expect(length(warehouseRoutes(2)[i])).toBeGreaterThan(length(warehouseRoutes(1)[i]));
  });
});

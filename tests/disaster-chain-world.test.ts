import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import type { TextbookGeometry } from '../src/textbook-geometry';
vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { createSolidMaterial } from '../src/textbook-solid-materials';
import { buildDisasterChainWorld } from '../src/textbook-disaster-chain-world';

describe('production disaster-chain with physical specimen materials', () => {
  it('constructs and seeks both branches without assuming paper hatch uniforms exist', () => {
    const alpha={value:.7},pop={u:{uSurfAlpha:alpha},paperMats:[] as T.Material[]};
    const meshes:T.Mesh[]=[],root=new T.Group();
    const context={createLinearGradient(){return {addColorStop(){}}},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},arc(){},clearRect(){},fillStyle:'',font:'',textAlign:'',textBaseline:'',fillRect(){},fillText(){},measureText(text:string){return {width:text.length*12};}};
    const b={pop,width:300,height:150,meshes,root,
      mesh(geometry:T.BufferGeometry,color:string){
        // This is the actual production PBR factory, not a MeshBasicMaterial
        // mock without uniforms that would silently skip the failing branch.
        const mesh=new T.Mesh(geometry,createSolidMaterial(pop,'land',color));
        meshes.push(mesh);root.add(mesh);return mesh;
      },
      label(text:string,at:[number,number,number],w:number,h:number){
        const map=new T.Texture({width:256,height:64,getContext:()=>context} as any);
        const mesh=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map}));
        mesh.position.set(...at);mesh.userData={kind:'text-label',text};meshes.push(mesh);root.add(mesh);return mesh;
      },outline(){},contour(){},trace(){}
    };
    const motion=buildDisasterChainWorld(b as unknown as TextbookGeometry);
    const bufferIds=meshes.filter(m=>m.geometry.attributes.position).map(m=>m.geometry.attributes.position);
    for(const selection of [0,1,0])for(const phase of [0,.4,.8,1,.2]){
      expect(()=>motion.update(phase,selection,1/60,false)).not.toThrow();
      expect((motion.describe!() as any).activeScenario).toBe(selection===0?'drought':'earthquake');
    }
    motion.update(0,1,0,true);
    const start=(motion.describe!() as any).talus;
    expect(start).toHaveLength(12);
    expect(start.every((p:any)=>p.volume>0)).toBe(true);
    motion.update(.76,1,0,true);
    const blocked=motion.describe!() as any;
    expect(blocked.damSection.spillCrest).toBeGreaterThan(blocked.earthquake.lakeLevel);
    motion.update(1,1,0,true);
    const breached=motion.describe!() as any;
    expect(breached.damSection.centerStockHeight).toBe(0);
    expect(breached.talus.map((p:any)=>[p.id,p.volume])).toEqual(start.map((p:any)=>[p.id,p.volume]));
    motion.update(0,1,0,true);
    expect((motion.describe!() as any).talus).toEqual(start);
    const solids=meshes.filter(m=>(m.material as T.Material).userData.materialRole);
    expect(solids.length).toBeGreaterThan(0);
    solids.forEach(mesh=>{
      const uniforms=(mesh.material as T.Material).userData.uniforms;
      expect(uniforms.uSurfAlpha).toBe(alpha);
      expect(uniforms.uHatch).toBeUndefined();
    });
    expect(meshes.filter(m=>m.geometry.attributes.position).every((m,i)=>m.geometry.attributes.position===bufferIds[i])).toBe(true);
  });
});

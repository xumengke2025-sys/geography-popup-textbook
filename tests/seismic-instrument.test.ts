import {describe,expect,it,vi} from 'vitest';
import * as Three from 'three';
import type {TextbookGeometry,Vec3} from '../src/textbook-geometry';
import {evaluateSeismicParticles} from '../src/textbook-ground-process-model';
vi.mock('../src/reference/engine.js',async()=>({THREE:await import('three')}));
import {buildSeismicInstrumentWorld} from '../src/textbook-seismic-instrument-world';

function fixture(){
  const root=new Three.Group(),meshes:Three.Mesh[]=[],contours:Vec3[][]=[];
  const materials=new Map<string,Three.MeshBasicMaterial>();
  const b={width:150,height:72,root,
    materialFor(role:string,color:string){const key=role+color;if(!materials.has(key))materials.set(key,new Three.MeshBasicMaterial({color}));return materials.get(key)!;},
    mesh(g:Three.BufferGeometry,color:string){const m=new Three.Mesh(g,this.materialFor('',color));root.add(m);meshes.push(m);return m;},
    label(text:string,at:Vec3,w:number,h:number){const m=this.mesh(new Three.PlaneGeometry(w,h),'#eee7d4');m.position.set(...at);m.userData.text=text;return m;},
    contour(points:Vec3[]){contours.push(points);},trace(){},
  };
  return {root,meshes,contours,motion:buildSeismicInstrumentWorld(b as unknown as TextbookGeometry)};
}

describe('guided two-channel seismic instrument',()=>{
  it('moves the same 40 physical bead identities by exactly the pure P/S model in both material conditions',()=>{
    const {meshes,motion}=fixture();
    const beads=meshes.filter(m=>m.userData.seismicParticleId!==undefined);
    expect(beads).toHaveLength(40);
    const ids=beads.map(m=>m.uuid),bounds=motion.focusBounds!();
    for(const selection of [0,1,0])for(const phase of [0,.13,.5,1,.31,0]){
      motion.update(phase,selection,0,true);const state=evaluateSeismicParticles(phase,selection);
      expect(motion.describe!()).toMatchObject(state);
      expect(motion.focusBounds!()).toEqual(bounds);
      expect(beads.map(m=>m.uuid)).toEqual(ids);
      for(const bead of beads){
        const q=state.particles[bead.userData.seismicParticleId],isS=bead.userData.seismicWave==='S';
        expect(bead.position.x).toBeCloseTo((q.restX+(isS?0:q.pDx))*1.5,10);
        expect(bead.position.y).toBeCloseTo(((isS?29:14)+(isS?q.sDy:0))*1.5,10);
        expect(bead.userData.seismicEquilibrium[0]).toBeCloseTo(q.restX*1.5,10);
        if(isS&&selection===0&&q.id>=10)expect(bead.position.y).toBe(29*1.5);
      }
    }
  });
  it('retains compressional coupling across the boundary and removes only liquid shear couplings without allocating new buffers',()=>{
    const {meshes,motion}=fixture();
    const p=meshes.find(m=>m.name==='compression-coils')!,s=meshes.find(m=>m.name==='shear-couplings')!;
    const arrays=[p,s].map(m=>m.geometry.attributes.position.array),count=meshes.length;
    const segment=(m:Three.Mesh,bond:number)=>Array.from(m.geometry.attributes.position.array.slice(bond*17*5*3,(bond+1)*17*5*3));
    motion.update(.31,0,0,true);
    expect(new Set(segment(p,12)).size).toBeGreaterThan(3);
    // Degenerate hidden shear links retain their topology at a single bead.
    expect(new Set(segment(s,12)).size).toBeLessThanOrEqual(3);
    motion.update(.31,1,0,true);expect(new Set(segment(s,12)).size).toBeGreaterThan(3);
    const signature=[p,s].map(m=>Array.from(m.geometry.attributes.position.array));
    motion.update(.9,0,0,true);motion.update(.31,1,0,true);
    expect([p,s].map(m=>Array.from(m.geometry.attributes.position.array))).toEqual(signature);
    [p,s].forEach((m,i)=>expect(m.geometry.attributes.position.array).toBe(arrays[i]));
    expect(meshes).toHaveLength(count);
  });
  it('connects drive heads to the first particle and exposes native phase, medium and fixed-identity tracking operations',()=>{
    const {meshes,motion}=fixture();motion.update(.23,0,0,true);
    const state=evaluateSeismicParticles(.23,0),drive=meshes.filter(m=>m.name==='demonstration-drive-link');
    expect(drive).toHaveLength(2);
    expect(drive[0].parent!.position.x).toBeCloseTo(state.particles[0].pDx*1.5,12);
    expect(drive[1].parent!.position.y).toBeCloseTo(state.particles[0].sDy*1.5,12);
    const handle=meshes.find(m=>m.name==='phase-handle')!;
    expect(handle.userData.modelInput.kind).toBe('phase-track');
    expect(handle.position.x).toBeCloseTo((16+(84-16)*.23)*1.5,12);
    const selector=meshes.find(m=>m.name==='material-selector-grip')!;
    expect(selector.userData.modelInput).toMatchObject({kind:'select',selection:1,toggleTo:0});
    motion.inspect!('particle-14');motion.update(.23,0,0,true);
    expect(motion.describe!()).toMatchObject({trackedParticleId:14,apparatusDrivesDemonstrationNotEarthquakes:true,measuredMaterialProperties:false});
    const rings=meshes.filter(m=>m.name==='tracked-particle-ring');
    const beads=meshes.filter(m=>m.userData.seismicParticleId===14);
    rings.forEach((ring,i)=>{expect(ring.position.x).toBe(beads[i].position.x);expect(ring.position.y).toBe(beads[i].position.y);});
  });
});

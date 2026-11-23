import { describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
import { figures } from '../src/textbook-catalog';
import type { TextbookGeometry } from '../src/textbook-geometry';
import { INSTRUMENT_PROFILES, instrumentProfile } from '../src/textbook-instrument-profiles';
vi.mock('../src/reference/engine.js', async () => ({THREE:await import('three')}));
import { createInstrumentAssembly } from '../src/textbook-instrument-assembly';

function fixture() {
  const root=new Three.Group(),meshes:Three.Mesh[]=[],surfaces:Three.Mesh[]=[],materials=new Map<string,Three.Material>();
  const g={root,meshes,pop:{surfaces},width:100,height:80,volumeCount:0,
    materialFor(role:string,color='#fff'){
      if(!materials.has(role))materials.set(role,new Three.MeshBasicMaterial({color}));return materials.get(role)!;
    },
    mesh(geometry:Three.BufferGeometry,color='#fff',_edges=true,volume=true,role='natural'){
      const mesh=new Three.Mesh(geometry,this.materialFor(role,color));mesh.userData.kind=volume?'solid-geometry':'geometric-surface';
      root.add(mesh);meshes.push(mesh);surfaces.push(mesh);if(volume)this.volumeCount++;return mesh;
    },
  };
  const natural=g.mesh(new Three.BoxGeometry(80,12,50).translate(50,6,-130));
  const label=g.mesh(new Three.BoxGeometry(200,100,30).translate(200,120,-200));label.userData.kind='text-label';
  root.position.set(14,45,-8);root.rotation.y=.15;
  return {g:g as unknown as TextbookGeometry,natural,label,materials};
}
const transforms=(objects:Three.Object3D[])=>objects.map(mesh=>({position:mesh.position.toArray(),quaternion:mesh.quaternion.toArray(),scale:mesh.scale.toArray()}));

describe('instrument profiles cover content without inventing a common pedestal',()=>{
  it('covers each catalog id and all three planned extensions',()=>{
    for(const figure of figures){
      const p=instrumentProfile(figure);expect(p,figure.id).toBeDefined();
      expect(p!.observe.length).toBeGreaterThan(5);expect(p!.operations.length).toBeGreaterThan(0);
      expect(p!.reveal.rigid).toBe(true);expect(p!.staging.keepClear.length).toBeGreaterThan(0);
    }
    expect(Object.keys(INSTRUMENT_PROFILES)).toHaveLength(63);
    for(const id of ['basin-system','city-rain-system','quake-response-system'])expect(instrumentProfile(id)).toBeDefined();
    expect(new Set(Object.values(INSTRUMENT_PROFILES).map(p=>p.family)).size).toBe(11);
    expect(instrumentProfile('future-unknown-module')).toBeUndefined();
  });
});

describe('low instrument supports are independent rigid assemblies',()=>{
  it('attaches under actual solids, ignores labels and preserves scientific transforms',()=>{
    const {g,natural,label}=fixture(),before=transforms([g.root,natural,label]);
    const assembly=createInstrumentAssembly(g,instrumentProfile('water')!);
    expect(assembly.diagnostics.attachmentBounds).toEqual([{min:[10,0,-155],max:[90,12,-105]}]);
    expect(assembly.diagnostics.extent!.max[1]).toBeLessThanOrEqual(0);
    for(const progress of [0,.25,1,.6,0,1]){
      assembly.setReveal(progress);expect(transforms([g.root,natural,label])).toEqual(before);
      for(const mesh of g.meshes.filter(m=>m.userData.instrumentAssembly))expect(mesh.scale.toArray()).toEqual([1,1,1]);
    }
  });
  it('is deterministic in both directions and ends with final-coordinate identity transforms',()=>{
    const {g}=fixture(),assembly=createInstrumentAssembly(g,instrumentProfile('temperature')!);
    const owned=g.meshes.filter(m=>m.userData.instrumentAssembly);
    assembly.setReveal(.41);const middle=transforms(owned.map(m=>m.parent!));
    assembly.setReveal(1);assembly.setReveal(0);assembly.setReveal(.41);
    expect(transforms(owned.map(m=>m.parent!))).toEqual(middle);
    assembly.setReveal(1);
    for(const part of owned){expect(part.parent.position.toArray()).toEqual([0,0,0]);expect(part.parent.rotation.toArray().slice(0,3)).toEqual([0,0,0])}
    assembly.setReveal(Number.NaN);expect(assembly.diagnostics.progress).toBe(0);
  });
  it('does not cage spheres or span the natural movement volume',()=>{
    // Dedicated instruments now own their actual feet. Exercise the generic
    // bearing strategy explicitly instead of demanding a second pedestal
    // under the habitable instrument's existing one.
    const profile=instrumentProfile('habitable')!;
    const {g}=fixture(),assembly=createInstrumentAssembly(g,{...profile,support:{...profile.support,strategy:'bearing'}});
    const a=assembly.diagnostics;expect(a.strategy).toBe('bearing');expect(a.parts).toBeLessThan(8);
    expect(a.extent!.max[1]).toBeLessThanOrEqual(0);
    expect(a.extent!.max[0]-a.extent!.min[0]).toBeLessThan(20);
    expect(a.materialRoles).toContain('brass');
  });
  it('does not fabricate foundations when the profile or geometry supplies none',()=>{
    const {g}=fixture();expect(createInstrumentAssembly(g,instrumentProfile('cosmic-scale')!).diagnostics.parts).toBe(0);
    expect(createInstrumentAssembly(g,instrumentProfile('habitable')!).diagnostics.parts).toBe(0);
    expect(createInstrumentAssembly(g,instrumentProfile('soil-factors')!).diagnostics.parts).toBe(0);
    g.meshes.forEach(mesh=>mesh.visible=false);
    expect(createInstrumentAssembly(g,instrumentProfile('water')!).diagnostics.reason).toBe('no-reliable-structural-footprint');
  });
  it('keeps separated specimens separately supported',()=>{
    const {g,natural,label}=fixture();natural.visible=false;label.visible=false;
    const host=g as unknown as {mesh:(geom:Three.BufferGeometry)=>Three.Mesh};
    for(const x of [15,50,85])host.mesh(new Three.BoxGeometry(16,24,16).translate(x,12,-130));
    // This exercises the generic clip strategy on synthetic specimens.
    // The real history module now carries its own connected sliding stands.
    const source=instrumentProfile('history')!;
    const assembly=createInstrumentAssembly(g,{...source,support:{...source.support,strategy:'specimen-clips'}});
    expect(assembly.diagnostics.footprintCount).toBe(3);
    expect(assembly.diagnostics.attachmentBounds).toHaveLength(3);
  });
  it('never installs a second foundation beneath an existing instrument dial or control plate',()=>{
    const {g}=fixture();
    const host=g as unknown as {mesh:(geom:Three.BufferGeometry)=>Three.Mesh};
    const control=host.mesh(new Three.BoxGeometry(160,4,90).translate(50,-20,-130));
    control.userData.instrumentPart='machined-plate';
    const assembly=createInstrumentAssembly(g,instrumentProfile('water')!);
    expect(assembly.diagnostics.attachmentBounds).toEqual([{min:[10,0,-155],max:[90,12,-105]}]);
  });
  it('lets authored ocean instruments carry their own fitted frames',()=>{
    for(const id of ['waves','tides','currents']){
      const {g}=fixture(),assembly=createInstrumentAssembly(g,instrumentProfile(id)!);
      expect(assembly.diagnostics.parts,id).toBe(0);
    }
  });
  it('keeps every family and rotating long skid below the scientific attachment plane',()=>{
    for(const profile of Object.values(INSTRUMENT_PROFILES)){
      const {g}=fixture(),assembly=createInstrumentAssembly(g,profile);
      for(const progress of [.01,.1,.25,.5,.75,1]){
        assembly.setReveal(progress);g.root.updateWorldMatrix(true,true);
        const inverse=g.root.matrixWorld.clone().invert();
        for(const mesh of g.meshes.filter(m=>m.userData.instrumentAssembly)){
          mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox.clone()
            .applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
          expect([...box.min.toArray(),...box.max.toArray()].every(Number.isFinite),profile.id).toBe(true);
          expect(box.max.y,`${profile.id}/${progress}/${mesh.name}`).toBeLessThanOrEqual(.000001);
        }
      }
    }
  });
  it('removes only owned meshes and disposes no shared material',()=>{
    const {g,natural,label,materials}=fixture(),count=g.volumeCount;
    const assembly=createInstrumentAssembly(g,instrumentProfile('gis')!);
    const disposed=[...materials.values()].map(material=>vi.spyOn(material,'dispose'));
    assembly.dispose();assembly.dispose();
    expect(g.meshes).toEqual([natural,label]);expect(g.volumeCount).toBe(count);
    expect(g.pop.surfaces).toEqual([natural,label]);expect(disposed.every(spy=>spy.mock.calls.length===0)).toBe(true);
  });
});

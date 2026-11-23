import { describe, it, expect, vi } from 'vitest';
import * as Three from 'three';
import type { TextbookGeometry } from '../src/textbook-geometry';
vi.mock('../src/reference/engine.js', async()=>({THREE:await import('three')}));
import { createSolidMaterial, type SolidMaterialRole } from '../src/textbook-solid-materials';
import { buildHabitableWorld, evaluateHabitable } from '../src/textbook-habitable-world';

function fixture(){
 const root=new Three.Group(),meshes:Three.Mesh[]=[], reveal={value:.43},paperMats:Three.Material[]=[];
 const pop={u:{uSurfAlpha:reveal},paperMats};
 const b={width:150,root,meshes,mesh(g:Three.BufferGeometry,color:string,_edges:boolean,_volume:boolean,role:string){
  const m=new Three.Mesh(g,createSolidMaterial(pop,role as Exclude<SolidMaterialRole,'paper'>,color));m.userData.materialRole=role;root.add(m);meshes.push(m);return m;
 }};
 return {root,meshes,reveal,paperMats,motion:buildHabitableWorld(b as unknown as TextbookGeometry)};
}
describe('one Earth, three life-condition observations',()=>{
 it('preserves three conditions without claiming life generation or measured climate',()=>{
  for(const selection of[0,1,2])for(const phase of[0,.5,1]){
   const s=evaluateHabitable(phase,selection);
   expect(s).toMatchObject({progress:phase,selected:selection,lifeGuaranteed:false,causalScope:'conditions-not-biogenesis-simulation',temperatureCalibrated:false,atmosphereThicknessToScale:false});
  }
  expect(evaluateHabitable(-2,8)).toMatchObject({progress:0,selected:2});
 });
 it('keeps a single continuously curved globe with organic land, water and an enclosing air surface',()=>{
  const {meshes,motion}=fixture();motion.update(.5,2,0,true);
  expect(meshes.filter(m=>m.userData.habitablePart==='continuous-ocean-surface')).toHaveLength(1);
  expect(meshes.filter(m=>m.userData.habitablePart==='single-atmosphere-envelope')).toHaveLength(1);
  const land=meshes.find(m=>m.userData.habitablePart==='organic-curved-continents')!,a=land.geometry.attributes.position;
  for(let i=0;i<a.count;i+=Math.max(1,Math.floor(a.count/500))){
   const r=new Three.Vector3().fromBufferAttribute(a,i).divideScalar(1.5).sub(new Three.Vector3(54,35,36)).length();
   expect(r).toBeGreaterThan(24.22);expect(r).toBeLessThan(24.28);
  }
  for(let i=0;i<a.count;i+=3){
   const center=new Three.Vector3();for(let j=0;j<3;j++)center.add(new Three.Vector3().fromBufferAttribute(a,i+j));
   // Chord interiors must also stay outside the ocean, not just vertices.
   expect(center.divideScalar(4.5).sub(new Three.Vector3(54,35,36)).length()).toBeGreaterThan(24.02);
  }
  expect(motion.describe!()).toMatchObject({singleEarth:true,waterOnSameGlobe:true,atmosphereEnclosesSameGlobe:true,bitmapSurfaces:0,looseWaterDrop:false,floatingAtmosphereRings:0});
 });
 it('provides real part selection on the ocean, atmosphere and temperature observations',()=>{
  const {meshes}=fixture();
  const part=(name:string)=>meshes.find(m=>m.userData.habitablePart===name)!;
  expect(part('continuous-ocean-surface').userData.modelInput).toMatchObject({kind:'select',selection:1});
  expect(part('single-atmosphere-envelope').userData.modelInput).toMatchObject({kind:'select',selection:2});
  expect(part('temperature-surface-observation').userData.modelInput).toMatchObject({kind:'select',selection:0});
  expect(meshes.filter(m=>m.userData.habitablePart==='condition-selector').map(m=>m.userData.modelInput.selection)).toEqual([0,1,2]);
 });
 it('changes the observation on the same Earth and restores exact progress when seeking backwards',()=>{
  const {meshes,motion}=fixture(),ocean=meshes.find(m=>m.userData.habitablePart==='continuous-ocean-surface')!;
  const buffers=meshes.map(m=>m.geometry.attributes.position.array),count=meshes.length;
  const snapshot=()=>meshes.map(m=>({visible:m.visible,position:m.position.toArray(),draw:m.geometry.drawRange.count}));
  for(const selection of[0,1,2]){
   motion.update(.42,selection,0,true);const before=snapshot();motion.update(1,selection,0,true);expect(snapshot()).toEqual(before);motion.update(.42,selection,0,true);
   expect(snapshot()).toEqual(before);expect(ocean.visible).toBe(true);
   expect(meshes.find(m=>m.userData.habitablePart==='single-atmosphere-envelope')!.visible).toBe(true);
  }
  expect(meshes).toHaveLength(count);meshes.forEach((m,i)=>expect(m.geometry.attributes.position.array).toBe(buffers[i]));
  expect(motion.describe!()).toMatchObject({buffersStable:true,heatBudget:false,oceanCurrentSimulation:false,timeAxis:false});
 });
 it('keeps all necessary conditions present and the atmosphere in the same formation lifecycle',()=>{
  const {meshes,motion,reveal,paperMats}=fixture();
  const air=meshes.find(m=>m.userData.habitablePart==='single-atmosphere-envelope')!;
  const material=air.material as Three.MeshStandardMaterial;
  expect(paperMats).toContain(material);expect(material.userData.uniforms.uSurfAlpha).toBe(reveal);
  const shader={uniforms:{},vertexShader:'',fragmentShader:'#include <common>\n#include <opaque_fragment>'};
  material.onBeforeCompile(shader as any,{} as any);
  expect((shader.uniforms as any).uSurfAlpha).toBe(reveal);
  expect(shader.fragmentShader).toContain('diffuseColor.a *= uSurfAlpha');
  for(const selection of[0,1,2]){
   motion.update(.5,selection,0,true);
   for(const name of['continuous-ocean-surface','organic-curved-continents','single-atmosphere-envelope','surface-weather-cloud-ribbons'])
    expect(meshes.find(m=>m.userData.habitablePart===name)!.visible).toBe(true);
   expect(material.opacity).toBeGreaterThan(0);expect(material.opacity).toBeLessThan(.15);
   // The actual Popout resets registered materials in _surfaces(), including
   // while phase/selection are unchanged. The cached update must repair it.
   material.depthWrite=true;
   motion.update(.5,selection,0,true);
   expect(material.depthWrite).toBe(false);
   expect(material.side).toBe(Three.FrontSide);
   expect(air.renderOrder).toBeGreaterThan(meshes.find(m=>m.userData.habitablePart==='organic-curved-continents')!.renderOrder);
  }
 });
 it('lands the incoming-light observation on the same spherical surface',()=>{
  const {meshes}=fixture(),rays=meshes.filter(m=>m.userData.habitablePart==='incident-light-to-surface');
  expect(rays).toHaveLength(3);
  for(const ray of rays){
   const contact=new Three.Vector3(...ray.userData.surfaceContact);
   expect(contact.distanceTo(new Three.Vector3(54,35,36))).toBeCloseTo(24.25,5);
   const g=ray.geometry.attributes.position;let closest=Infinity;
   for(let i=0;i<g.count;i++)closest=Math.min(closest,new Three.Vector3().fromBufferAttribute(g,i).divideScalar(1.5).distanceTo(contact));
   expect(closest).toBeLessThan(.11);
   expect(ray.userData.modelInput).toMatchObject({kind:'select',selection:0});
  }
 });
 it('frames the complete physical assembly with a phase-invariant camera envelope',()=>{
  const {root,meshes,motion}=fixture(),bounds=motion.focusBounds!(),box=new Three.Box3(new Three.Vector3(...bounds.min),new Three.Vector3(...bounds.max)).expandByScalar(.001);
  for(const selection of[0,1,2])for(const phase of[0,.5,1]){
   motion.update(phase,selection,0,true);root.updateMatrixWorld(true);expect(motion.focusBounds!()).toEqual(bounds);
   for(const m of meshes.filter(m=>m.visible)){
    expect(box.containsBox(new Three.Box3().setFromObject(m)),m.name).toBe(true);
    expect([...m.geometry.attributes.position.array].every(Number.isFinite)).toBe(true);expect(m.parent).toBe(root);
   }
  }
 });
});

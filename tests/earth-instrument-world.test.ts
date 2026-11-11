import {describe,expect,it,vi} from 'vitest';
import * as T from 'three';
vi.mock('../src/reference/engine.js',async()=>({THREE:await import('three')}));
import {buildEarthInstrumentWorld} from '../src/textbook-earth-instrument-world';
import {EARTH_RADII,evaluateEarthLayers} from '../src/textbook-astronomy-model';

function fixture(){
  const meshes:T.Mesh[]=[];
  const b={width:100,p:(u:number,v:number,y=0)=>[u*100,y,-96-(1-v)*75],
    mesh:(geometry:T.BufferGeometry,color:string)=>{const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({color}));meshes.push(mesh);return mesh;},
    label:(_text:string,at:number[])=>{const mesh=new T.Mesh(new T.PlaneGeometry(12,4.8));mesh.position.set(...at as [number,number,number]);return mesh;},
    contour:vi.fn()};
  return {meshes,motion:buildEarthInstrumentWorld(b as any)};
}
describe('sectional globe as one working instrument',()=>{
  it('drives the specimen, travel carriage and wheel from the original scientific displacement in both directions',()=>{
    const {motion,meshes}=fixture();
    for(const selection of [0,1,0,2,0,3,0]){
      motion.update(0,selection,0,true);
      const state=evaluateEarthLayers(selection),extracted=state.layers.find(l=>l.peeled);
      const dx=extracted?.offset[0]??0,dy=extracted?.offset[1]??0;
      const carriage=meshes.find(m=>m.userData.earthInstrument==='travel-carriage')!;
      const shell=meshes.find(m=>m.userData.layer===(extracted?.index??0)&&m.userData.layerPart==='outer')!;
      expect(carriage.position.toArray()).toEqual([dx,0,0]);
      if(extracted)expect(shell.position.toArray()).toEqual(extracted.offset);
      expect((motion.describe!().instrument as any).handwheelAngle).toBeCloseTo(dx*.33);
    }
  });
  it('retains layer thickness and restores the actual quarter covers and section faces',()=>{
    const {motion,meshes}=fixture();motion.update(0,0,0,true);
    const outer=meshes.filter(m=>m.userData.layerPart==='outer');
    expect(outer.map(m=>(m.geometry as T.SphereGeometry).parameters.radius)).toEqual(EARTH_RADII);
    motion.inspect!('closed');motion.update(0,0,0,true);
    expect(meshes.filter(m=>m.userData.layerPart==='observation-cover').every(m=>m.visible)).toBe(true);
    expect(meshes.filter(m=>String(m.userData.layerPart).startsWith('section-')).every(m=>!m.visible)).toBe(true);
    motion.inspect!('overview');motion.update(0,0,0,true);
    expect(meshes.filter(m=>m.userData.layerPart==='observation-cover').every(m=>!m.visible)).toBe(true);
    expect(meshes.filter(m=>String(m.userData.layerPart).startsWith('section-')).every(m=>m.visible)).toBe(true);
  });
  it('includes the working chassis and full restored globe in stable local focus bounds',()=>{
    const {motion,meshes}=fixture();motion.update(0,0,0,true);
    const bounds=motion.focusBounds!(),box=new T.Box3(new T.Vector3(...bounds.min),new T.Vector3(...bounds.max));
    for(const mesh of meshes.filter(m=>m.userData.earthInstrument)){
      mesh.geometry.computeBoundingBox();mesh.updateMatrix();
      expect(box.clone().expandByScalar(.0001).containsBox(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrix))).toBe(true);
    }
    const spindle=meshes.filter(m=>m.userData.earthInstrument==='short-polar-spindle');
    expect(spindle).toHaveLength(2);
    // Both shafts terminate at the surface; no axle pierces the visible core.
    for(const mesh of spindle)expect(mesh.geometry.boundingBox!.max.y-mesh.geometry.boundingBox!.min.y).toBeCloseTo(3);
  });
});

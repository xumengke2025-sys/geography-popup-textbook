import { describe,expect,it,vi } from 'vitest';
import * as T from 'three';
import type { TextbookGeometry,Vec3 } from '../src/textbook-geometry';
import { mountMarsSequencer } from '../src/textbook-mars-sequencer';
import { MARS_ARRIVALS } from '../src/textbook-mars-reading';
import { evaluateMarsTransfer } from '../src/textbook-sky-causality-model';
vi.mock('../src/reference/engine.js',async()=>({THREE:await import('three')}));

const fixture=()=>{
  const root=new T.Group(),parts:T.Mesh[]=[];
  const b={root,mesh(g:T.BufferGeometry,color:string){const m=new T.Mesh(g,new T.MeshStandardMaterial({color}));parts.push(m);root.add(m);return m;},
    label(name:string,at:Vec3,w:number,h:number){const m=this.mesh(new T.PlaneGeometry(w,h),'#dfd6ba');m.position.set(...at);m.userData.kind='text-label';m.userData.text=name;return m;}};
  const p=(u:number,v:number,height=0):Vec3=>[u*100,height,v*60-96];
  return {parts,drive:mountMarsSequencer(b as unknown as TextbookGeometry,1,p)};
};
describe('manual circuit observation bench',()=>{
  it('retracts exactly one capstan circumference per turn and parks during the static overview',()=>{
    const {parts,drive}=fixture();drive.update(0,1);const zero=drive.slider.position.x;
    const controls=parts.filter(m=>m.userData.marsDrive==='crank'||m.userData.marsDrive==='reading-carriage');
    expect(controls.length).toBeGreaterThan(6);
    for(const phase of [.44,.91,.12,1,0,.44]){
      drive.update(phase,1);expect(zero-drive.slider.position.x).toBeCloseTo(drive.handle.rotation.z*drive.driveRadius,10);
      expect(drive.handle.rotation.z).toBeCloseTo(phase*Math.PI*2,10);expect(controls.every(m=>m.userData.modelInput)).toBe(true);
    }
    drive.update(.74,0);expect(drive.slider.position.x).toBe(zero);expect(drive.handle.rotation.z).toBe(0);
    expect(controls.every(m=>!m.userData.modelInput)).toBe(true);
  });
  it('displays only the selected circuit arrival marks, aligned with the original receiver model',()=>{
    const {parts,drive}=fixture(),delta=.00001;
    for(let mode=0;mode<4;mode++){
      drive.update(.5,mode);
      expect(parts.filter(m=>m.visible&&m.userData.marsArrival!==undefined).map(m=>m.userData.marsArrival)).toEqual(MARS_ARRIVALS[mode].map(v=>v[0]));
    }
    const signals=['purifierResponse','reservoirResponse','crewWaterResponse','plantResponse','crewOxygenResponse','crewFoodResponse','powerResponse'] as const;
    const arrivals=MARS_ARRIVALS.flatMap((marks,mode)=>marks.map(([at])=>({mode,at})));
    arrivals.forEach(({mode,at},index)=>{
      expect(evaluateMarsTransfer(at-delta,mode)[signals[index]]).toBe(0);
      expect(evaluateMarsTransfer(at+delta,mode)[signals[index]]).toBeGreaterThan(0);
    });
  });
});

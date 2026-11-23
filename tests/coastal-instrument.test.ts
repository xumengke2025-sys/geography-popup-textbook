import { describe, it, expect, vi } from 'vitest';
import * as T from 'three';
vi.mock('../src/reference/engine.js',async()=>({THREE:await import('three')}));
vi.mock('../src/geography-pen',()=>({GeographyPen:class {
  lines={mesh:new T.Group()};dynamic(){return{mesh:new T.Group(),setLines:vi.fn()}};
  stroke(){}finish(){}dispose(){}
}}));
import { TextbookGeometry } from '../src/textbook-geometry';
import { buildBreeze } from '../src/textbook-coastal-world';
import { evaluateSeaBreeze } from '../src/model';
import { instrumentProfile } from '../src/textbook-instrument-profiles';

import { loadFieldInstrument } from '../src/textbook-field-instruments';
await loadFieldInstrument('breeze');

function fixture(){
  const pop={group:new T.Group(),paperMats:[] as T.Material[],surfaces:[] as T.Mesh[],u:{uSurfAlpha:{value:1}},
    paper(){const m=new T.MeshBasicMaterial();this.paperMats.push(m);return m},
    addSurface(mesh:T.Mesh,parent:T.Object3D){parent.add(mesh);this.surfaces.push(mesh);return mesh}};
  const g=new TextbookGeometry(pop,100,80);
  // Labels are not the subject of this geometry/state check. Retain their
  // real dimensions and transformations without requiring a browser canvas.
  g.label=(text,at,w,h=5)=>{const mesh=g.mesh(new T.PlaneGeometry(w,h),'#fff',false,false);
    mesh.userData.kind='text-label';mesh.userData.text=text;mesh.position.set(...at);return mesh};
  const motion=buildBreeze(g);return{g,motion};
}

describe('one coastal instrument follows one scientific state',()=>{
  it('moves its real index assemblies to the model warmth and restores their pose after reverse scrubbing',()=>{
    const {g,motion}=fixture(),s=1.24;
    const indices:T.Object3D[]=[];g.root.traverse(node=>{if(node.name==='relative-heat-sliding-index')indices.push(node)});
    expect(indices).toHaveLength(2);
    const sample=(phase:number)=>{
      motion.update(phase,0,0,true);const state=evaluateSeaBreeze({phase,contrast:1});
      for(const [i,value]of [state.land,state.sea].entries()){
        expect(indices[i].position.y/s).toBeCloseTo(2.8+17*Math.max(.12,Math.min(.96,.5+value*.48)));
      }
      expect(motion.describe!().groundX).toBe(-state.direction);
      return indices.map(node=>node.position.toArray());
    };
    const day=sample(.5);sample(0);sample(.80597);expect(sample(.5)).toEqual(day);
    expect(instrumentProfile('breeze')!.support.strategy).toBe('none');
  });
  it('keeps sculpted arrows finite, volumetric and buffer-stable across reversal and calm',()=>{
    const {g,motion}=fixture();
    const arrows=g.meshes.filter(mesh=>mesh.name==='rounded-circulation-arrow');expect(arrows).toHaveLength(4);
    const buffers=arrows.map(mesh=>mesh.geometry.attributes.position.array);
    for(const phase of [.5,0,.80597,.5]){
      motion.update(phase,0,0,true);const state=evaluateSeaBreeze({phase,contrast:1});
      arrows.forEach((mesh,i)=>{
        expect(mesh.geometry.attributes.position.array).toBe(buffers[i]);
        expect(Array.from(buffers[i]).every(Number.isFinite)).toBe(true);
        expect(mesh.visible).toBe(state.strength>.018);
        if(mesh.visible){
          const p=mesh.geometry.attributes.position;
          // The ten vertices of a cross section occupy depth as well as XY.
          const z=Array.from({length:10},(_,k)=>p.getZ(k));
          expect(Math.max(...z)-Math.min(...z)).toBeGreaterThan(.5);
        }
      });
    }
  });
});

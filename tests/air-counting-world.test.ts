import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
vi.mock('../src/reference/engine.js', async()=>({THREE:await import('three')}));
import { buildAirCountingWorld } from '../src/textbook-air-counting-world';
import { evaluateAirComposition } from '../src/textbook-air-composition-model';

function fixture(){
  const root=new T.Group(),meshes:T.Mesh[]=[];
  const b:any={width:100,height:80,root,meshes,
    mesh(g:T.BufferGeometry,color:string){const m=new T.Mesh(g,new T.MeshStandardMaterial({color}));root.add(m);meshes.push(m);return m;},
    label(text:string,at:number[],w:number,h:number){const m=this.mesh(new T.PlaneGeometry(w,h),'#fff');m.position.fromArray(at);m.userData.kind='text-label';m.userData.text=text;return m;},
  };
  const motion=buildAirCountingWorld(b);return {root,meshes,motion};
}
// Count disconnected solid islands in the actual merged geometry, rather
// than trusting the descriptive count on the object.
function islands(g:T.BufferGeometry){
  const p=g.getAttribute('position'), links=new Map<string,Set<string>>();
  const key=(i:number)=>[p.getX(i),p.getY(i),p.getZ(i)].map(n=>n.toFixed(5)).join(',');
  for(let i=0;i<p.count;i+=3){const v=[key(i),key(i+1),key(i+2)];for(const a of v){if(!links.has(a))links.set(a,new Set());for(const b of v)links.get(a)!.add(b);}}
  const seen=new Set<string>();let count=0;
  for(const a of links.keys())if(!seen.has(a)){count++;const stack=[a];while(stack.length){const b=stack.pop()!;if(seen.has(b))continue;seen.add(b);stack.push(...links.get(b)!);}}
  return count;
}

describe('trunnion-supported air counting instrument',()=>{
  it('contains 78, 21 and 1 physically separate volume inlays, unchanged in both conditions',()=>{
    const {meshes,motion}=fixture(),cells=meshes.filter(m=>m.userData.dryAirSpecies);
    expect(cells.map(m=>islands(m.geometry))).toEqual([78,21,1]);
    const original=cells.map(m=>Array.from(m.geometry.attributes.position.array));
    for(const selection of [0,1,0]){motion.update(.5,selection,0,true);expect(cells.every(m=>m.visible)).toBe(true);expect(cells.map(m=>Array.from(m.geometry.attributes.position.array))).toEqual(original);}
  });
  it('keeps gas and grain identity, periodic drift and separate inventory from the pure model',()=>{
    const {meshes,motion}=fixture(),vapor=meshes.filter(m=>m.userData.compositionSymbol==='water-vapor-tracer'),dust=meshes.filter(m=>m.userData.compositionSymbol==='impurity-grain');
    const ids=[...vapor,...dust].map(m=>m.geometry.uuid);
    for(const selection of [0,1,0,1])for(const phase of [0,.2,.7,.2,1]){
      motion.update(phase,selection,0,true);const state=evaluateAirComposition(phase,selection);
      expect(vapor.filter(m=>m.visible)).toHaveLength(state.vapor.length);expect(dust.filter(m=>m.visible)).toHaveLength(state.impurities.length);
      state.vapor.forEach((m,i)=>{expect(vapor[i].userData.symbolId).toBe(m.id);expect(vapor[i].position.x).toBeCloseTo(73+m.x*4.4,10);expect(vapor[i].position.y).toBeCloseTo(28+m.y*7.2,10);});
      expect([...vapor,...dust].map(m=>m.geometry.uuid)).toEqual(ids);
      expect(motion.describe!()).toMatchObject({cellsAreMolecules:false,waterVaporVisible:false,cloudRepresented:false,markerCountsAreQuantities:false,sharedFlatState:true});
    }
  });
  it('draws the independent sampling piston only on request and holds every symbolic specimen still',()=>{
    const {meshes,motion}=fixture(),grip=meshes.find(m=>m.name==='wooden-sample-grip')!;
    expect(grip.userData.modelInput).toMatchObject({kind:'select',selection:1,toggleTo:0,keepPhase:true});
    const jars=meshes.filter(m=>m.name==='glass-observation-vessel');
    expect(jars).toHaveLength(2);expect(jars.every(m=>(m.material as T.MeshStandardMaterial).opacity<.2)).toBe(true);
    const marks=meshes.filter(m=>m.userData.compositionSymbol);
    motion.update(0,1,0,true);const pose=marks.map(m=>m.position.toArray());
    motion.update(.85,1,0,true);expect(grip.position.x).toBeCloseTo(8.2);
    expect(marks.map(m=>m.position.toArray())).toEqual(pose);
    motion.update(.85,0,0,true);expect(grip.position.x).toBe(0);expect(marks.every(m=>!m.visible)).toBe(true);
  });
  it('tilts all inlays as one rigid panel about its real hinge and restores exactly',()=>{
    const {meshes,motion}=fixture(),cells=meshes.filter(m=>m.userData.dryAirSpecies),labels=meshes.filter(m=>m.userData.kind==='text-label');
    motion.update(.4,1,0,true);const first=cells.map(m=>[...m.position.toArray(),...m.quaternion.toArray()]);
    motion.inspect!('counting-face');motion.update(.4,1,0,true);
    expect(motion.describe!()).toMatchObject({tilt:-.35,selected:1});
    expect(cells.every(m=>m.quaternion.equals(cells[0].quaternion))).toBe(true);
    expect(labels.every(m=>m.userData.labelMount==='surface')).toBe(true);
    motion.inspect!('overview');motion.update(.4,1,0,true);
    expect(cells.map(m=>[...m.position.toArray(),...m.quaternion.toArray()])).toEqual(first);
    expect(meshes.filter(m=>m.userData.modelInput?.target==='counting-face').length).toBeGreaterThan(0);
  });
  it('animates the manual hinge even with scientific playback paused',()=>{
    const {motion}=fixture();let clock=1000;
    const timer=vi.spyOn(performance,'now').mockImplementation(()=>clock);
    try{
      motion.update(.4,1,0,true);motion.inspect!('counting-face');
      clock+=225;motion.update(.4,1,0,false);expect(motion.describe!().tilt).toBeCloseTo(-.175,10);
      clock+=225;motion.update(.4,1,0,false);expect(motion.describe!().tilt).toBe(-.35);
      expect(motion.describe!()).toMatchObject({selected:1,dryAirVolumeCells:{nitrogen:78,oxygen:21,other:1}});
    }finally{timer.mockRestore();}
  });
});

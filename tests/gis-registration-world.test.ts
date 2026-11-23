import { describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
import type { TextbookGeometry } from '../src/textbook-geometry';
import { GIS_COUNTS, evaluateGis } from '../src/textbook-gis-model';
vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildGisWorld } from '../src/textbook-gis-world';

function fixture(){
  const root=new Three.Group(),meshes:Three.Mesh[]=[];
  const add=(geometry:Three.BufferGeometry,color:string)=>{const m=new Three.Mesh(geometry,new Three.MeshBasicMaterial({color}));root.add(m);meshes.push(m);return m};
  const context={clearRect(){},fillText(){},fillStyle:'',textAlign:'',textBaseline:'',font:''};
  const b={width:100,height:90,root,meshes,pop:{paper:(p:any)=>new Three.MeshBasicMaterial({color:p.color})},
    mesh:add,materialFor:(_role:string,color:string)=>new Three.MeshBasicMaterial({color}),contour(){},
    prism(path:[number,number][],lo:number,hi:number,color:string){const shape=new Three.Shape();path.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();const g=new Three.ExtrudeGeometry(shape,{depth:hi-lo,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,lo,0);return add(g,color)},
    label(text:string,at:number[],w:number,h:number){const m=add(new Three.PlaneGeometry(w,h),'#fff');m.position.fromArray(at);m.userData.kind='text-label';m.userData.text=text;m.material.map=new Three.Texture({width:512,height:128,getContext:()=>context}as any);return m},
  };
  const motion=buildGisWorld(b as unknown as TextbookGeometry);return{root,meshes,motion};
}
const role=(meshes:Three.Mesh[],name:string)=>meshes.filter(m=>m.userData.gisRole===name);
describe('GIS open registration instrument',()=>{
  it('keeps real open carriage bores coaxial with both moving layer paths',()=>{
    const{motion,meshes}=fixture();
    for(const [name,axis] of [['station',new Three.Vector3(0,-32.2,12).normalize()],['administrative',new Three.Vector3(0,0,1)]] as const){
      const sleeve=role(meshes,`${name}-bored-carriages`)[0],positions=sleeve.geometry.getAttribute('position');
      expect(positions.count).toBeGreaterThan(0);
      for(let i=0;i<positions.count;i++){
        const v=new Three.Vector3().fromBufferAttribute(positions,i),x=v.x<50?3:97;
        const radial=v.sub(new Three.Vector3(x,0,-171));radial.addScaledVector(axis,-radial.dot(axis));
        // The entire bore stays empty; the .46/.44 guide can pass through.
        expect(radial.length()).toBeGreaterThanOrEqual(.49-1e-5);
      }
      for(const phase of[0,.13,.26,.4,.52,1,.26]){
        motion.update(phase,0,0,true);const state=evaluateGis(phase),layer=name==='station'?state.layers.stations:state.layers.regions;
        expect(sleeve.position.y).toBeCloseTo(layer.y,12);expect(sleeve.position.z).toBeCloseTo(layer.z,12);
        const offset=new Three.Vector3(0,layer.y-(name==='station'?37:3),layer.z-(name==='station'?-12:0));
        expect(offset.cross(axis).length()).toBeLessThan(1e-10);
      }
    }
  });
  it('retains all 33 stable identities, exact scientific coordinates and derived 5/15/13 counts',()=>{
    const{motion,meshes}=fixture(),stations=role(meshes,'rain-station'),identity=stations.map(m=>[m.uuid,m.userData.stationId]);
    for(const phase of[0,.26,.52,.63,.72,.86,1,.26]){
      motion.update(phase,0,0,true);const state=evaluateGis(phase),report=motion.describe!()as any;
      expect(stations.map(m=>[m.uuid,m.userData.stationId])).toEqual(identity);expect(stations).toHaveLength(33);
      stations.forEach((m,i)=>{expect(m.position.x).toBeCloseTo(7+state.stations[i].point[0]*86,10);expect(m.position.y).toBeCloseTo(state.layers.stations.y+.62,10);expect(m.position.z).toBeCloseTo(-171+state.stations[i].point[1]*54+state.layers.stations.z,10);expect(m.userData.region).toBe(state.stations[i].region)});
      expect(report.counts).toEqual(state.counts.map(c=>({region:c.id,count:c.count})));expect(report.derivedTotals).toEqual(GIS_COUNTS);
    }
    expect(GIS_COUNTS.map(r=>r.count)).toEqual([5,15,13]);
  });
  it('places the actual rail geometry outside the complete map-layer sweep',()=>{
    const{motion,meshes}=fixture(),guides=role(meshes,'external-registration-guide');expect(guides).toHaveLength(2);
    for(const m of guides){m.geometry.computeBoundingBox();const b=m.geometry.boundingBox!;expect(b.max.x<7||b.min.x>93).toBe(true)}
    for(const phase of[0,.08,.26,.49,.52,1]){motion.update(phase,0,0,true);const s=evaluateGis(phase);for(const name of['administrative-registration-lugs','station-registration-lugs']){
      const m=role(meshes,name)[0],layer=name.startsWith('station')?s.layers.stations:s.layers.regions;
      expect(m.position.y).toBe(layer.y);expect(m.position.z).toBe(layer.z);
    }}
  });
  it('keeps the two real sheets thin and their origin aligned without scaling a parent',()=>{
    const{root,meshes,motion}=fixture();motion.update(1,0,0,true);
    const paper=role(meshes,'region-paper')[0],vellum=role(meshes,'station-vellum')[0];
    paper.geometry.computeBoundingBox();vellum.geometry.computeBoundingBox();
    expect(paper.geometry.boundingBox!.max.y-paper.geometry.boundingBox!.min.y).toBeCloseTo(.3,6);
    expect(vellum.geometry.boundingBox!.max.y-vellum.geometry.boundingBox!.min.y).toBeCloseTo(.28,6);
    expect(root.scale.toArray()).toEqual([1,1,1]);expect(paper.position.z).toBe(0);expect(vellum.position.z).toBeCloseTo(0,12);
    expect(role(meshes,'rain-station').every(m=>m.parent===root)).toBe(true);
  });
  it('mounts live counts on three physical sockets and maps the real carriage onto one seekable phase',()=>{
    const{motion,meshes}=fixture(),handle=role(meshes,'phase-carriage')[0],buffers=meshes.map(m=>m.geometry.uuid),bounds=motion.focusBounds!();
    expect(handle.userData.modelInput.kind).toBe('phase-track');expect(role(meshes,'count-socket')).toHaveLength(3);
    for(const phase of[0,.41,1,.41]){
      motion.update(phase,0,0,true);expect(handle.position.x).toBeCloseTo(9+82*phase,12);expect(handle.position.y).toBe(3.2);
      expect(meshes.map(m=>m.geometry.uuid)).toEqual(buffers);expect(motion.focusBounds!()).toEqual(bounds);
    }
    motion.update(1,0,0,true);expect(role(meshes,'derived-count').map(m=>m.userData.text)).toEqual(['1区 5','2区 15','3区 13']);
    for(const label of role(meshes,'derived-count')){
      expect(label.userData.labelMount).toBe('surface');
      expect(label.rotation.x).toBeCloseTo(-Math.PI/2 + Math.atan(.42));
      expect(label.position.y).toBeCloseTo(3 + .74 + 3.7*.42 + .12);
    }
  });
  it('keeps the hoist at its stop during counting and moves exactly the beads belonging to counted stations',()=>{
    const {motion,meshes}=fixture(),cords=role(meshes,'taut-lifting-cord'),beads=role(meshes,'station-tally-bead');
    const grip=role(meshes,'capstan-grip')[0],groups=GIS_COUNTS.map(r=>beads.filter(b=>b.userData.modelInput.target===`region-${r.id-1}`));
    expect(cords).toHaveLength(2);expect(groups.map(g=>g.length)).toEqual([5,15,13]);
    motion.update(0,0,0,true);
    const rest=groups.map(group=>group.map(bead=>bead.position.x)),short=cords[0].scale.y;
    for(const phase of [.52,.63,.84,1,.63,0]){
      motion.update(phase,0,0,true);const state=evaluateGis(phase);
      expect(cords[0].scale.y-short).toBeCloseTo(Math.hypot(32.2,12)*state.overlay);
      expect(cords[1].scale.y).toBe(cords[0].scale.y);
      expect(grip.rotation.z*4.35).toBeCloseTo(82*phase);
      expect(role(meshes,'cord-pulley').map(m=>m.rotation.z)).toEqual([grip.rotation.z,grip.rotation.z]);
      groups.forEach((g,i)=>expect(g.filter((bead,k)=>bead.position.x<rest[i][k]-.1).length).toBe(state.counts[i].count));
    }
  });
  it('region inspection highlights the same station set while leaving scientific positions unchanged',()=>{
    const{motion,meshes}=fixture();motion.update(.74,0,0,true);const stations=role(meshes,'rain-station'),before=stations.map(m=>m.position.toArray());
    motion.inspect!('region-1');motion.update(.74,0,0,true);expect((motion.describe!()as any).inspection).toBe('region-1');expect(stations.map(m=>m.position.toArray())).toEqual(before);
    expect(stations.filter(m=>m.userData.region===2).every(m=>m.scale.x>=1.2)).toBe(true);
    expect(role(meshes,'count-socket')[1].userData.modelInput.target).toBe('region-1');
  });
});


import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { TextbookGeometry } from '../src/textbook-geometry';
import { buildPressureWind } from '../src/textbook-pressure-world';
import { buildHazeWorld } from '../src/textbook-haze-world';
import { evaluateHaze } from '../src/textbook-haze-model';
vi.mock('../src/reference/engine.js',async()=>({THREE:await import('three')}));
vi.mock('../src/geography-pen',()=>({GeographyPen:class {
  lines={mesh:new THREE.Group()};dynamic(){return{mesh:new THREE.Group(),setLines:vi.fn()}};
  stroke(){} finish(){} dispose(){}
}}));

function fixture(){
  const pop={group:new THREE.Group(),paperMats:[] as THREE.Material[],surfaces:[] as THREE.Mesh[],u:{uSurfAlpha:{value:1}},
    addSurface(mesh:THREE.Mesh,parent:THREE.Object3D){parent.add(mesh);this.surfaces.push(mesh);return mesh}};
  const g=new TextbookGeometry(pop,100,80);
  g.label=(text,at,w,h=5)=>{const m=g.mesh(new THREE.PlaneGeometry(w,h),'#dfd2b6',false,false,'ivory');
    m.userData.kind='text-label';m.userData.text=text;m.position.set(...at);return m;};
  return g;
}

describe('手动气动比较仪',()=>{
  it('puts the lower meniscus under higher pressure and returns the probe without changing the reading',()=>{
    const g=fixture(),m=buildPressureWind(g),legs=g.meshes.filter(v=>v.name==='差压计液柱');
    const pistons=g.meshes.filter(v=>v.name==='皮碗与活塞'),flag=g.meshes.find(v=>v.name==='风道内丝带');
    expect(legs).toHaveLength(2);expect(pistons).toHaveLength(2);
    const rests=flag.geometry.attributes.position.array,read=()=>legs.map(v=>v.scale.y);
    m.update(.71,0,0,true);const gradient=read();expect(gradient[0]).toBeLessThan(gradient[1]);
    expect(pistons[0].position.y).toBeLessThan(pistons[1].position.y);
    expect(flag.position.x).toBeCloseTo(27+.71*47);
    m.update(.71,1,0,true);expect(legs[0].scale.y).toBe(legs[1].scale.y);expect(pistons[0].position.y).toBeCloseTo(pistons[1].position.y);
    expect(m.describe!().windDirection).toBe('none-in-this-idealized-component');
    m.update(.19,0,0,true);expect(read()).toEqual(gradient);expect(flag.position.x).toBeCloseTo(27+.19*47);
    expect(flag.geometry.attributes.position.array).toBe(rests);
    expect(flag.userData.modelInput.kind).toBe('phase-track');
    expect(g.meshes.some(v=>v.userData.modelInput?.kind==='indexed-dial')).toBe(true);
  });
  it('keeps the same trace geometry and places each visible parcel at the scientific model coordinates',()=>{
    const g=fixture(),m=buildHazeWorld(g),h=g.meshes.find(v=>v.userData.pollutionParcels);
    const pos=h.geometry.attributes.position,initialMeshes=g.meshes.length,front=g.meshes.find(v=>v.name==='前观察窗');
    expect(front.material.opacity).toBeLessThan(.15);expect(front.material.depthWrite).toBe(false);
    expect(h.material.map.image.width).toBe(96);
    expect(h.material.map.image.data[3]).toBe(0);expect(h.material.map.image.data[(48*96+48)*4+3]).toBeGreaterThan(130);
    const filter=g.meshes.find(v=>v.name==='定性留存滤片'),fan=g.meshes.find(v=>v.name==='六叶通风扇');
    const inputs=g.meshes.filter(v=>v.userData.specimenKey!==undefined).map(v=>v.userData.modelInput.selection);
    expect(new Set(inputs)).toEqual(new Set([0,1,2]));
    for(const [t,mode] of [[0,0],[.03,1],[.9,1],[.9,2],[.9,0],[.14,1],[0,2]]){
      m.update(t,mode,0,true);const model=evaluateHaze(t,mode);
      expect(fan.parent.rotation.x).toBeCloseTo(model.fanAngle);
      expect(m.describe!().filterReading).toBe(Math.min(1,model.stock/80));
      expect(filter.position.x).toBeCloseTo(35+53*t);
      for(const q of model.particles){
        const left=q.id*4,right=left+2;
        expect(.5*(pos.getX(left)+pos.getX(right))).toBeCloseTo(q.x,4);
        expect(.5*(pos.getY(left)+pos.getY(right))).toBeCloseTo(q.y,4);
        if(q.visible)expect(pos.getY(right)).toBeGreaterThan(pos.getY(left));
        else expect(pos.getY(right)).toBe(pos.getY(left));
      }
      expect(h.geometry.attributes.position).toBe(pos);
      expect(g.meshes.length).toBe(initialMeshes);
    }
  });
});

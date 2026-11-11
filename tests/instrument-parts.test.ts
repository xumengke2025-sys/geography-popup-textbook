import {describe,it,expect,vi} from 'vitest';
import * as Three from 'three';
import type {TextbookGeometry} from '../src/textbook-geometry';
vi.mock('../src/reference/engine.js',async()=>({THREE:await import('three')}));
import {castBodyGeometry,chamferedPlateGeometry,turnedShaftGeometry,turnedSleeveGeometry,pedestalColumnGeometry,createInstrumentParts} from '../src/textbook-instrument-parts';

function fixture(){
  const root=new Three.Group(),meshes:Three.Mesh[]=[];
  const g={root,meshes,mesh(geometry:Three.BufferGeometry,_color:string,_edges:boolean,_volume:boolean,role:string){
    const mesh=new Three.Mesh(geometry,new Three.MeshBasicMaterial());mesh.userData.materialRole=role;
    meshes.push(mesh);root.add(mesh);return mesh;
  }};
  return {g:g as unknown as TextbookGeometry,root,meshes};
}
function finite(geometry:Three.BufferGeometry){
  for(const attribute of Object.values(geometry.attributes))expect([...attribute.array].every(Number.isFinite)).toBe(true);
}
describe('machined instrument part vocabulary',()=>{
  it('keeps a genuine through bore along arbitrary bearing axes',()=>{
    for(const end of [new Three.Vector3(8,0,0),new Three.Vector3(0,8,0),new Three.Vector3(3,5,7)]){
      const geometry=turnedSleeveGeometry([0,0,0],end.toArray() as [number,number,number],[[2,0],[2,.2],[1.5,.3],[1.5,.7],[2,.8],[2,1]],.7);
      const mesh=new Three.Mesh(geometry,new Three.MeshBasicMaterial({side:Three.DoubleSide}));mesh.updateMatrixWorld();
      const axis=end.clone().normalize(),ray=new Three.Raycaster(axis.clone().multiplyScalar(-2),axis);
      expect(ray.intersectObject(mesh)).toHaveLength(0);
      const radial=new Three.Vector3(1,0,0);if(Math.abs(axis.x)>.9)radial.set(0,1,0);
      radial.addScaledVector(axis,-radial.dot(axis)).normalize();
      ray.set(end.clone().multiplyScalar(.5).addScaledVector(radial,4),radial.clone().negate());
      expect(ray.intersectObject(mesh).length).toBeGreaterThan(0);finite(geometry);
    }
  });
  it('keeps rounded castings and turned columns on their fitted datums',()=>{
    const casting=castBodyGeometry([2,3,4],[18,7,14],.6);casting.computeBoundingBox();finite(casting);
    casting.boundingBox!.min.toArray().forEach((n,i)=>expect(n).toBeCloseTo([2,3,4][i]));
    casting.boundingBox!.max.toArray().forEach((n,i)=>expect(n).toBeCloseTo([18,7,14][i]));
    const column=pedestalColumnGeometry([0,2,0],[0,58,0],2);column.computeBoundingBox();finite(column);
    expect(column.boundingBox!.min.y).toBeCloseTo(2);expect(column.boundingBox!.max.y).toBeCloseTo(58);
    expect(column.boundingBox!.max.x).toBeCloseTo(2);
  });
  it('cuts actual bevel faces inside the original plate bounds',()=>{
    const geometry=chamferedPlateGeometry([1,2,3],[13,5,11],.3);geometry.computeBoundingBox();finite(geometry);
    expect(geometry.boundingBox!.min.toArray()).toEqual([1,2,3]);expect(geometry.boundingBox!.max.toArray()).toEqual([13,5,11]);
    // A cut face has both vertical and horizontal normal components.
    const normal=geometry.attributes.normal;let cut=false;
    for(let i=0;i<normal.count;i++)if(Math.abs(normal.getY(i))>.1&&Math.abs(normal.getY(i))<.95)cut=true;
    expect(cut).toBe(true);expect(geometry.attributes.position.count).toBeLessThan(250);
  });
  it('turns a capped stepped bearing along any axis without scale deformation',()=>{
    const geometry=turnedShaftGeometry([0,0,0],[8,0,0],[[2,0],[2,.2],[1.4,.3],[1.4,.7],[2,.8],[2,1]]);
    finite(geometry);geometry.computeBoundingBox();
    expect(geometry.boundingBox!.min.x).toBeCloseTo(0);expect(geometry.boundingBox!.max.x).toBeCloseTo(8);
    expect(geometry.boundingBox!.max.y).toBeCloseTo(2);
  });
  it('batches etched ticks and fastener details with material roles intact',()=>{
    const {g,root,meshes}=fixture(),parent=new Three.Group();parent.position.set(8,3,5);root.add(parent);
    const parts=createInstrumentParts(g,parent);
    const scale=parts.etchedScale([0,0,0],[25,0,0],{ticks:51,width:2});
    expect(scale.children).toHaveLength(2);expect(scale.children.map((m:Three.Object3D)=>m.userData.materialRole)).toEqual(['ivory','steel']);
    const screws=parts.fasteners([[0,0,0],[4,0,0],[8,0,0],[12,0,0]],[0,1,0],.4);
    expect(screws.children).toHaveLength(2);expect(meshes).toHaveLength(4);
    expect(parent.position.toArray()).toEqual([8,3,5]);
    for(const mesh of meshes){expect(mesh.scale.toArray()).toEqual([1,1,1]);finite(mesh.geometry)}
  });
  it('makes a readable low control and bearing with a bounded draw count',()=>{
    const {g,meshes}=fixture(),parts=createInstrumentParts(g);
    expect(parts.knob([0,0,0],[0,0,1],2,.8).children).toHaveLength(2);
    expect(parts.bearing([5,0,0],[1,0,0],1,3).children).toHaveLength(2);
    expect(meshes).toHaveLength(4);
    for(const mesh of meshes)finite(mesh.geometry);
  });
});

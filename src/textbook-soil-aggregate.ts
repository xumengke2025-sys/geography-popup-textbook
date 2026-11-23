import { THREE as T } from './reference/engine.js';
import type { SoilNetwork } from './textbook-soil-pore-network';
import { cutCrown,exposedSoil,noise,type CutSpecimen } from './textbook-soil-cut-surface';

export function soilMatrixGeometry(network:SoilNetwork,cut:CutSpecimen,scale:number){
  const points=[...cut.outer,...network.inner],vertices:number[]=[],colors:number[]=[],proximity:number[]=[];
  const top=new T.Color('#5a4939'),loam=new T.Color('#8c7159'),base=new T.Color('#ad8d66');
  const fracture=new T.Color('#493d32'),mineral=new T.Color('#b8a189');
  points.forEach(([x,y,z],i)=>{
    vertices.push(x*scale,y*scale,z*scale);
    const inner=i>=network.inner.length,wall=network.inner[i%network.inner.length],near=inner?1:Math.exp(-Math.hypot(x-wall[0],y-wall[1],z-wall[2])*.54);
    proximity.push(near);
    const f=exposedSoil(x,y),depth=cutCrown(x,z)-y,front=Math.max(0,Math.min(1,(z-7)/5));
    const organic=Math.max(0,Math.min(1,(9.5-depth+(noise(x*.14,z*.08)-.5)*2.7)/5));
    const lower=Math.max(0,Math.min(1,(depth-21+(f.bed-.5)*5)/14));
    const c=loam.clone().lerp(top,organic*.90).lerp(base,lower*.80);
    c.lerp(mineral,.11*f.grain+.09*noise(.22*x+.31*z,.31*y));
    c.lerp(fracture,Math.min(.84,.52*f.seam*front+(inner?.43:.03)+.11*(1-f.chips)));
    c.multiplyScalar(.87+.20*f.bed+.11*f.grain);
    colors.push(c.r,c.g,c.b);
  });
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('poreContact',new T.Float32BufferAttribute(proximity,1));
  g.setIndex(network.matrixIndices);g.computeVertexNormals();return g;
}
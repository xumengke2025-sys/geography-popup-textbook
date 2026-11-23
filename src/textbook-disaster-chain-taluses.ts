import { THREE as T } from './reference/engine.js';
import type { Vec3 } from './textbook-geometry';
import type { DisasterChainState } from './textbook-disaster-chain-model';
import { chainTalusStock, chokeGround } from './textbook-disaster-chain-stock';

export function abutmentGeometry(side:number,p:(x:number,y:number,z:number)=>Vec3){
  const pos:number[]=[],colors:number[]=[],facies:number[]=[],ix:number[]=[],nx=24,nz=20;
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
    const x=48.34+14*i/nx,z=35+side*(1.25+12.75*j/nz);
    pos.push(...p(x,chokeGround(x,z)-.02,z));const fleck=.89+.07*Math.sin(x*.69+z*.51);
    colors.push(fleck,.83*fleck,.66*fleck);facies.push(.72,.14,.09);
    if(i<nx&&j<nz){const a=j*(nx+1)+i,e=a+nx+1;
      if(side===1)ix.push(a,e,a+1,a+1,e,e+1);else ix.push(a,a+1,e,a+1,e+1,e);
    }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  g.setAttribute('facies',new T.Float32BufferAttribute(facies,3));g.setIndex(ix);g.computeVertexNormals();return g;
}

export function chainTalusPiece(id:number,s:number){
  const stock=chainTalusStock()[id],geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(stock.positions.map(n=>n*s),3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(stock.colors,3));
  geometry.setAttribute('facies',new T.Float32BufferAttribute(stock.facies,3));
  geometry.setIndex(stock.indices);geometry.computeVertexNormals();
  return {geometry,id,row:stock.row,source:stock.source,nominalVolume:stock.nominalVolume,
    place(mesh:any,q:DisasterChainState['earthquake'],p:(x:number,y:number,z:number)=>Vec3){
      const pose=stock.pose(q);mesh.rotation.set(pose.pitch,0,0);mesh.position.set(...p(pose.x,pose.y,pose.z));
    }};
}

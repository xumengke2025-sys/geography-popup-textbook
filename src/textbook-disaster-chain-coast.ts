import { THREE as T } from './reference/engine.js';
import { createSpecimenMaterial } from './textbook-solid-materials';
import { applyEarthScan } from './textbook-earth-scan';
import { turnedShaftGeometry } from './textbook-instrument-parts';
import type { TextbookGeometry,Vec3 } from './textbook-geometry';

const ease=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t)};
export function coastalCap(b:TextbookGeometry,s:number){
  const pos:number[]=[],colors:number[]=[],facies:number[]=[],indices:number[]=[];
  const nx=54,nz=32,stride=nx+1,count=stride*(nz+1);
  for(const top of [true,false])for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
    const x=6+66*i/nx,z=8+42*j/nz;
    const margin=ease(Math.min(i,nx-i,j,nz-j)/3);
    const clearing=Math.min(ease((Math.hypot(x-20,z-17)-7)/4),ease((Math.hypot(x-29,z-20)-4.5)/3),ease((Math.hypot(x-44,z-31)-3.7)/3));
    const ridges=.61*Math.sin(.17*x+.39*z)+.24*Math.cos(x*.62-z*.32)+.15*Math.sin(x*.87+z*.58);
    const elevation=top?3+margin*clearing*(.94+.91*ridges): -3;
    pos.push((x-39)*s,elevation*s,(z-29)*s);
    const cover=top?margin*clearing*ease((ridges+.78)*.67)*(.67+.14*Math.cos(z*.91)):0;
    colors.push(.95-.24*cover,.82-.11*cover,.65-.21*cover);
    facies.push(.14,.48-.32*cover,.6*cover);
  }
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const a=j*stride+i,c=a+stride;indices.push(a,c,a+1,a+1,c,c+1,count+a,count+a+1,count+c,count+a+1,count+c+1,count+c);
  }
  const edge:number[]=[];
  for(let i=0;i<=nx;i++)edge.push(i);
  for(let j=1;j<=nz;j++)edge.push(j*stride+nx);
  for(let i=nx-1;i>=0;i--)edge.push(nz*stride+i);
  for(let j=nz-1;j>0;j--)edge.push(j*stride);
  for(let i=0;i<edge.length;i++){
    const a=edge[i],e=edge[(i+1)%edge.length];
    indices.push(a,e,a+count,e,e+count,a+count);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  g.setAttribute('facies',new T.Float32BufferAttribute(facies,3));g.setIndex(indices);g.computeVertexNormals();
  const cap=b.mesh(g,'#d1c5a3',false);
  cap.material=applyEarthScan(createSpecimenMaterial(b.pop,{role:'land',color:'#d1c5a3'}),'valley',12*s);cap.material.vertexColors=true;
  cap.userData.chainRole='compressible-layer';
  return cap;
}

export function coastalPump(b:TextbookGeometry,p:(x:number,y:number,z:number)=>Vec3,s:number){
  const finishes={brass:'#a68a50',steel:'#7c8885',enamel:'#344d43',wood:'#6c503b'};
  const parts:any[]=[];
  const piece=(g:any,substance:keyof typeof finishes)=>{
    const color=finishes[substance],m=b.mesh(g,color,false);m.material=createSpecimenMaterial(b.pop,{role:substance,color});
    m.userData.chainRole='extraction-well';m.userData.modelInput={kind:'replay',selection:0,label:'重放选定沿海抽水情景'};parts.push(m);return m;
  };
  const rod=(a:Vec3,e:Vec3,outline:[number,number][],material:keyof typeof finishes)=>{
    const from=a.map(n=>n*s) as Vec3,to=e.map(n=>n*s) as Vec3;
    return piece(turnedShaftGeometry(from,to,outline.map(([r,j])=>[r*s,j])),material);
  };
  const barrel=rod([0,0,0],[0,5.7,0],[[1.5,0],[1.55,.06],[1.16,.12],[.78,.17],[.8,.31],[1.03,.38],[1.03,.8],[1.16,.84],[1.14,.9],[.75,.97],[.75,1]],'enamel');
  const mouth=rod([0,4.7,0],[0,5.8,0],[[1.08,0],[1.24,.12],[1.24,.29],[.87,.4],[.87,.79],[1.02,.88],[.98,1]],'brass');
  const spoutPath=new T.CatmullRomCurve3([[.66,3.5,0],[1.5,3.65,0],[2.8,3.6,0],[3.5,3.25,0],[3.65,2.65,0]].map(v=>new T.Vector3(v[0]*s,v[1]*s,v[2]*s)));
  const spout=piece(new T.TubeGeometry(spoutPath,20,.41*s,12,false),'enamel');
  const lip=rod([3.65,2.48,0],[3.65,2.89,0],[[.53,0],[.55,.3],[.41,1]],'brass');
  const pivot=rod([0,5.75,-.81],[0,5.75,.81],[[.51,0],[.58,.11],[.51,.17],[.51,.85],[.58,.92],[.51,1]],'brass');
  const lever=rod([.36,0,0],[-3.82,-.92,0],[[.36,0],[.30,.2],[.18,.65],[.20,1]],'steel');
  const grip=rod([-3.56,-.85,0],[-4.89,-1.2,0],[[.31,0],[.42,.18],[.44,.8],[.33,1]],'wood');
  return {update(surface:number,phase:number,pumping:boolean){
    for(const m of [barrel,mouth,spout,lip,pivot])m.position.set(...p(44,surface,31));
    for(const m of [lever,grip]){
      m.position.set(...p(44,surface+5.75,31));
      m.rotation.z=pumping?.16*Math.sin(phase*7*Math.PI):0;
    }
  }};
}

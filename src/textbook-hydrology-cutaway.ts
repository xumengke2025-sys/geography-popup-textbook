import { THREE as T } from './reference/engine.js';
import type { Vec3, TextbookGeometry } from './textbook-geometry';
import { mergeInstrumentGeometry, turnedShaftGeometry } from './textbook-instrument-parts';

type SoilFacies = 'sand' | 'loam' | 'clay' | 'profile';
const horizons = {
  sand: ['#a08259', '#b39665', '#90754e'],
  loam: ['#58432e', '#796044', '#503b2a'],
  clay: ['#855f4c', '#a37d65', '#755547'],
  profile: ['#796047', '#a48a61', '#4f3e2e'],
};
export function specimenNoise(x:number,y:number) {
  const v = Math.sin(x*127.1+y*311.7+19.3)*43758.5453;
  return v-Math.floor(v);
}
function field(x:number,y:number){
  const a=Math.floor(x),b=Math.floor(y);
  let u=x-a,v=y-b;u=u*u*(3-2*u);v=v*v*(3-2*v);
  return (specimenNoise(a,b)*(1-u)+specimenNoise(a+1,b)*u)*(1-v)
    +(specimenNoise(a,b+1)*(1-u)+specimenNoise(a+1,b+1)*u)*v;
}

export function hydrologyTopRelief(u:number,t:number,cell:number,cols:number){
  const edges=Math.min(1,Math.max(0,Math.min(u,1-u)*cols),Math.max(0,Math.min(t,1-t)*12));
  return edges*cell*(.43*(field(u*cols*.8,t*9)-.5)+.21*(field(u*cols*2.3,t*23)-.5));
}

/** Cut vessels expose the rims, inner walls and blind ends of pores. The
 * entire section, including its irregular top and sides, is a closed solid. */
export function hydrologyCore(a:Vec3,b:Vec3,topAt:(x:number)=>number,kind:SoilFacies) {
  const isProfile=kind==='profile',cols=isProfile?42:13,rows=isProfile?20:21;
  const w=b[0]-a[0],d=b[2]-a[2],cell=w/cols;
  const palette=horizons[kind].map(t=>new T.Color(t)),tone=new T.Color();
  const position:number[]=[],color:number[]=[],index:number[]=[];
  const grain=(u:number,v:number)=>field(u*cols*.46+6,v*rows*.52+11);
  const point=(u:number,v:number,depth:number,occlusion=1)=>{
    const x=a[0]+w*u,y=a[1]+(topAt(x)-a[1])*v;
    const relief=(grain(u,v)-.5)*.54*cell+(field(u*cols*1.37,v*rows*1.5)-.5)*.16*cell;
    const z=b[2]+relief-depth;
    const strata=field(u*4.7+7,v*3.1+2),coarse=grain(u,v);
    const lower=isProfile?Math.max(0,.63-v+(.5-strata)*.15):.21;
    tone.copy(palette[0]).lerp(palette[1],Math.min(1,lower+.31*coarse));
    const humus=isProfile?Math.min(.91,Math.max(0,(v-.73+(strata-.45)*.09)*3.8)):Math.max(0,.5-strata)*.64;
    tone.lerp(palette[2],humus).multiplyScalar(occlusion*(.86+.23*coarse+.1*strata));
    position.push(x,y,z);color.push(tone.r,tone.g,tone.b);return position.length/3-1;
  };
  const uvs: [number,number][] = [],front:number[]=[];
  const at=(x:number,y:number)=>y*(cols+1)+x;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const u=(i+(i>0&&i<cols?(specimenNoise(i+7,j)-.5)*.62:0))/cols;
    const v=(j+(j>0&&j<rows?(specimenNoise(i+41,j)-.5)*.62:0))/rows;
    uvs.push([u,v]);front.push(point(u,v,0));
  }
  const quad=(a:number,b:number,c:number,d:number)=>index.push(a,b,c,a,c,d);
  const halves=new Map<number,number>();
  const midpoint=(a:number,b:number)=>{
    const key=Math.min(a,b)*front.length+Math.max(a,b);
    let id=halves.get(key);if(id!==undefined)return id;
    id=point((uvs[a][0]+uvs[b][0])*.5,(uvs[a][1]+uvs[b][1])*.5,0);
    const offset=id*3;for(let k=0;k<3;k++)position[offset+k]=(position[front[a]*3+k]+position[front[b]*3+k])*.5;
    halves.set(key,id);return id;
  };
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const ids=[at(i,j),at(i+1,j),at(i+1,j+1),at(i,j+1)];
    const seed=specimenNoise(i+12,j+28),chance=kind==='sand'?.47:kind==='clay'?.19:.35;
    const u=ids.reduce((n,k)=>n+uvs[k][0],0)/4, v=ids.reduce((n,k)=>n+uvs[k][1],0)/4;
    const outer=ids.flatMap((id,k)=>[front[id],midpoint(id,ids[(k+1)%4])]);
    if(seed>chance){const center=point(u,v,0);
      for(let k=0;k<8;k++)index.push(outer[k],outer[(k+1)%8],center);continue;}
    const inner:number[]=[],throat:number[]=[];
    const wide=.12+specimenNoise(i+15,j+3)*.23,tall=kind==='clay'?.055+seed*.24:.12+specimenNoise(i,j+18)*.24;
    const dip=(.23+.65*specimenNoise(i+82,j))*cell;
    for(let k=0;k<8;k++){
      const ang=(k-3)*Math.PI/4, r=.82+.27*specimenNoise(i+k,j+88);
      const du=Math.cos(ang)*wide*r/cols,dv=Math.sin(ang)*tall*r/rows;
      inner.push(point(u+du,v+dv,cell*.015,.83));
      throat.push(point(u+du*.65+wide*.16/cols,v+dv*.57,dip,.49));
    }
    const end=point(u+.05/cols,v,dip*1.23,.36);
    for(let k=0;k<8;k++){const n=(k+1)%8;
      quad(outer[k],outer[n],inner[n],inner[k]);quad(inner[k],inner[n],throat[n],throat[k]);index.push(throat[k],throat[n],end);}
  }
  const rim=[...Array.from({length:cols+1},(_,i)=>at(i,0)),...Array.from({length:rows},(_,j)=>at(cols,j+1)),
    ...Array.from({length:cols},(_,i)=>at(cols-1-i,rows)),...Array.from({length:rows-1},(_,j)=>at(0,rows-1-j))];
  const back=rim.map(k=>point(...uvs[k],d)),mid=point(.5,.5,d);
  const backFor=new Map(rim.map((id,k)=>[id,back[k]]));
  for(let k=0;k<rim.length;k++){const n=(k+1)%rim.length;
    if(uvs[rim[n]][1]!==1||uvs[rim[k]][1]!==1)quad(front[rim[n]],front[rim[k]],back[k],back[n]);
    index.push(back[n],back[k],mid);}
  // A sloping observation angle exposes most of the upper face. Its grain
  // field varies across the specimen depth as well as along the cut edge.
  const strips=isProfile?14:11,top:number[][]=[];
  for(let j=0;j<=strips;j++){
    const row:number[]=[];top.push(row);const t=j/strips;
    for(let i=0;i<=cols;i++){
      const id=at(i,rows),u=uvs[id][0];
      if(j===0){row.push(front[id]);continue;}
      if(j===strips){row.push(backFor.get(id)!);continue;}
      const k=point(u,1,t*d),shade=.88+.25*field(u*cols*1.44,t*19.5);
      position[k*3+1]+=hydrologyTopRelief(u,t,cell,cols);
      for(let c=0;c<3;c++)color[k*3+c]*=shade;
      row.push(k);
    }
  }
  for(let j=0;j<strips;j++)for(let i=0;i<cols;i++)quad(top[j][i],top[j][i+1],top[j+1][i+1],top[j+1][i]);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(position,3));
  g.setAttribute('color',new T.Float32BufferAttribute(color,3));g.setIndex(index);g.computeVertexNormals();return g;
}

/** A turned shaft, cast spokes and rotating wooden grip share a single bearing. */
export function handValve(b:TextbookGeometry,s:number,at:Vec3,radius:number,label:string){
  const r=radius*s,shaft=(a:Vec3,c:Vec3,profile:number[][])=>turnedShaftGeometry(a,c,profile.map(([rad,t])=>[rad*s,t]));
  const moving:any[]=[];
  const add=(g:any,c:string,role:'wood'|'brass'|'enamel',name:string,rotates=true)=>{
    const m=b.mesh(g,c,false,true,role);m.position.set(...at);m.name=name;if(rotates)moving.push(m);return m;
  };
  add(shaft([0,0,-6*s],[0,0,.55*s],[[.65,0],[1.25,.12],[1.25,.28],[.8,.38],[.8,.8],[1.12,.9],[1.12,1]]),'#897249','brass','turned-valve-spindle',false);
  add(new T.TorusGeometry(r,.49*s,12,56),'#a88249','brass','cast-valve-rim');
  const arms=[];
  for(let i=0;i<4;i++){const t=(i+.1)*Math.PI/2;
    arms.push(shaft([0,0,0],[r*Math.cos(t),r*Math.sin(t),0],[[.56,0],[.69,.18],[.3,.65],[.39,1]]));}
  arms.push(shaft([0,0,-.7*s],[0,0,1.02*s],[[.99,0],[1.15,.14],[1.15,.55],[.81,.77],[.78,1]]));
  add(mergeInstrumentGeometry(arms),'#a68750','brass','valve-cross-and-boss');
  const grip=add(shaft([0,-r,.07*s],[0,-r,2.45*s],[[.44,0],[.56,.11],[.41,.24],[.7,.56],[.77,.72],[.67,.89],[.37,1]]),'#684631','wood','hydrology-valve-grip');
  const dial={center:[at[0],at[1],at[2]+2.33*s] as Vec3,radiusX:r,radiusY:r,turns:1};
  moving.forEach(m=>{m.userData.modelInput={kind:'phase-dial',dial,label};m.userData.interactionFeedback=false;});
  grip.userData.smallPointTarget=true;
  return (phase:number)=>{for(const m of moving)m.rotation.z=phase*2*Math.PI;};
}

/** Wet glass pulls the edge of the free surface up around each vessel. */
export function meniscusGeometry(w:number,h:number,d:number) {
  const pos:number[]=[],ix:number[]=[],coords=[-.5,-.474,-.39,-.14,.14,.39,.474,.5];
  const n=coords.length;
  for(const z of coords)for(const x of coords){
    const edge=Math.max(Math.abs(x),Math.abs(z))*2;
    const crown=Math.pow(edge,23)*.055;
    pos.push(x*w,h*(.445+crown),z*d);
  }
  for(let j=0;j<n-1;j++)for(let i=0;i<n-1;i++){const a=j*n+i,b=a+1,c=a+n,e=c+1;ix.push(a,c,b,c,e,b);}
  const rim=[...Array.from({length:n},(_,i)=>i),...Array.from({length:n-1},(_,j)=>(j+2)*n-1),
    ...Array.from({length:n-1},(_,i)=>n*n-2-i),...Array.from({length:n-2},(_,j)=>(n-2-j)*n)];
  const base=pos.length/3;
  for(const id of rim)pos.push(pos[id*3],-h*.5,pos[id*3+2]);
  const center=pos.length/3;pos.push(0,-h*.5,0);
  for(let k=0;k<rim.length;k++){const b=(k+1)%rim.length;ix.push(rim[k],rim[b],base+k,rim[b],base+b,base+k,base+k,base+b,center);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(ix);g.computeVertexNormals();return g;
}
export function wetGlassFill(mesh:any,b:TextbookGeometry,opacity:number){
  const m=mesh.material;m.transparent=true;m.opacity=opacity;m.depthWrite=false;m.roughness=.16;
  if(b.pop?.instrumentEnvironment){m.envMap=b.pop.instrumentEnvironment;m.envMapIntensity=.48;}
}
import { THREE as T } from './reference/engine.js';
import { mergeInstrumentGeometry } from './textbook-instrument-parts';
import { mineralChip, specimenSeed } from './textbook-agricultural-specimens';
import { noise } from './textbook-soil-cut-surface';
import type { TextbookGeometry } from './textbook-geometry';
import { createSoilSpecimenFinish } from './textbook-soil-specimen-finish';

/** Locate the exposed wall of the actual pore mesh. Local bins avoid a ray
 * through the entire monolith for every retained root tip or water marker. */
export function soilCutSampler(g:any){
  const pos=g.attributes.position,ix=g.index.array;g.computeBoundingBox();
  const min=g.boundingBox.min,max=g.boundingBox.max,nx=41,ny=28,dx=(max.x-min.x)/nx,dy=(max.y-min.y)/ny;
  const bins=Array.from({length:nx*ny},()=>[] as number[]);
  const col=(x:number)=>Math.max(0,Math.min(nx-1,Math.floor((x-min.x)/dx)));
  const row=(y:number)=>Math.max(0,Math.min(ny-1,Math.floor((y-min.y)/dy)));
  const triangles:number[][]=[];
  for(let j=0;j<ix.length;j+=3){
    const a=ix[j],b=ix[j+1],c=ix[j+2],x=pos.getX(a),y=pos.getY(a),z=pos.getZ(a);
    const x1=pos.getX(b)-x,x2=pos.getX(c)-x,y1=pos.getY(b)-y,y2=pos.getY(c)-y;
    const det=x1*y2-x2*y1;
    if(Math.abs(det)<1e-10)continue;
    const id=triangles.length;
    triangles.push([x,y,z,x1,x2,y1,y2,pos.getZ(b)-z,pos.getZ(c)-z,1/det]);
    for(let r=row(y+Math.min(0,y1,y2));r<=row(y+Math.max(0,y1,y2));r++)
      for(let q=col(x+Math.min(0,x1,x2));q<=col(x+Math.max(0,x1,x2));q++)bins[r*nx+q].push(id);
  }
  return (x:number,y:number)=>{
    let z=-Infinity;
    for(const id of bins[row(y)*nx+col(x)]){
      const [a,b,c,x1,x2,y1,y2,z1,z2,inv]=triangles[id],u=((x-a)*y2-(y-b)*x2)*inv,v=((y-b)*x1-(x-a)*y1)*inv;
      if(u>=-1e-6&&v>=-1e-6&&u+v<=1.000001)z=Math.max(z,c+z1*u+z2*v);
    }
    return Number.isFinite(z)?z:max.z;
  };
}

/** Sand has mineral flecks; loam contains stable aggregates and humus. The
 * cohesive clay shows compressed faces and small openings rather than gravel. */
export function finishTextureColumn(b:TextbookGeometry,core:any,index:number,s:number,left:number,bottom:number,width:number,height:number,front:number,topAt:(x:number)=>number){
  const g=core.geometry,pos=g.attributes.position,c=g.attributes.color;
  const pigment=new T.Color(),q=new T.Color();
  const base=[new T.Color('#c5ae84'),new T.Color('#685039'),new T.Color('#b08a74')][index];
  const shade=[new T.Color('#a38760'),new T.Color('#453a2b'),new T.Color('#805e50')][index];
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),u=(x-left)/width,d=(y-bottom)/height;
    const patch=noise(u*12,d*18),fine=noise(u*52,d*73),band=noise(u*8+patch*.4,d*27+.45*noise(u*7,d*6));
    const face=Math.min(1,Math.max(0,(z-front+2.3*s)/(2.3*s)));
    const relief=index===0?.25*(fine-.5):index===1?.77*(patch-.5):.30*(band-.46);
    pos.setZ(i,z+(s*relief-(index===2?(z-front)*.65:0))*face);
    const level=index===2?.24+.38*band:index===1?.19+.63*patch:.19+.32*fine;
    pigment.copy(base).lerp(shade,level);
    q.setRGB(c.getX(i),c.getY(i),c.getZ(i));
    q.lerp(pigment,index===2?.71:index===1?.34:.51).multiplyScalar(.89+.20*fine);
    c.setXYZ(i,q.r,q.g,q.b);
  }
  pos.needsUpdate=true;c.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();
  const cut=soilCutSampler(g),groups:any[][]=[[],[],[]],count=[570,320,0][index];
  for(let i=0;i<count;i++){
    const top=i%5===1,u=.025+.95*specimenSeed(i,3),d=.018+.962*specimenSeed(i,7),x=left+u*width;
    const z=top?front-(.2+.73*specimenSeed(i,8))*width*.52:0,y=top?topAt(x):bottom+height*d;
    const grain=mineralChip(i),rad=(index===0?.10+.23*specimenSeed(i,12)**1.6:.13+.37*specimenSeed(i,14)**2)*s;
    grain.scale(rad*(.99+.65*specimenSeed(i,18)),rad*.83,rad*.80);
    grain.rotateZ(specimenSeed(i,19)*4.6);
    if(top)grain.rotateX(-Math.PI/2);
    grain.translate(x,y+(top?.045*s:0),top?z:cut(x,y)+rad*.06);
    groups[i%3].push(grain);
  }
  const tints=index===0?['#cbb89c','#938875','#d5c8aa']:['#71644e','#988566','#514331'];
  const details=groups.filter(group=>group.length).map((group,i)=>{
    const m=b.mesh(mergeInstrumentGeometry(group),tints[i],false,true,'rock');
    m.material=createSoilSpecimenFinish(b.pop,tints[i],0,.21*s,'alluvium');m.userData.agriculturalSpecimen=index?'loam-inclusions':'sand-quartz-and-lithics';
    return m;
  });
  if(index===2){
    const v:number[]=[],ix:number[]=[],cl:number[]=[];
    const seams=[[[.03,.82],[.20,.79],[.34,.82],[.53,.77],[.66,.74]],
      [[.31,.81],[.37,.75],[.40,.68]],[[.47,.95],[.51,.89],[.68,.85],[.76,.80],[.96,.78]],
      [[.05,.60],[.22,.62],[.38,.58],[.54,.59]],[[.40,.57],[.47,.49],[.63,.45],[.79,.46],[.95,.41]],
      [[.12,.40],[.20,.34],[.39,.33],[.48,.28]],[[.35,.21],[.47,.18],[.60,.20],[.83,.14]]];
    const tones=['#a7816b','#755646','#6b4e40','#a8836b'].map(t=>new T.Color(t));
    for(const [id,path] of seams.entries()){
      const pts=path.map(([u,d])=>new T.Vector3(left+width*u,bottom+d*height,0)),curve=new T.CatmullRomCurve3(pts);
      const first=v.length/3,n=path.length*9;
      for(let i=0;i<=n;i++){
        const t=i/n,at=curve.getPoint(t),dir=curve.getTangent(t),w=(.17+.24*specimenSeed(id,6))*s*Math.sin(t*Math.PI)**.44;
        const x=at.x+.14*s*Math.sin(23*t+id),y=at.y+.13*s*Math.sin(37*t+id);
        for(const [lane,k] of [-1,-.12,.13,1].entries()){
          const px=x-dir.y*w*k,py=y+dir.x*w*k;
          v.push(px,py,cut(px,py)+(.023+Math.abs(k)*.025)*s);cl.push(tones[lane].r,tones[lane].g,tones[lane].b);
        }
        if(i<n)for(let k=0;k<3;k++){const j=first+i*4+k;ix.push(j,j+4,j+1,j+1,j+4,j+5);}
      }
    }
    const seam=new T.BufferGeometry();seam.setAttribute('position',new T.Float32BufferAttribute(v,3));seam.setAttribute('color',new T.Float32BufferAttribute(cl,3));seam.setIndex(ix);seam.computeVertexNormals();
    const m=b.mesh(seam,'#ffffff',false,true,'land');m.material=createSoilSpecimenFinish(b.pop,'#ffffff',1,.45*s,'loam');m.material.vertexColors=true;m.userData.agriculturalSpecimen='clay-ped-contacts';details.push(m);
  }
  return {cut,details};
}
import { THREE as T } from './reference/engine.js';
import { mergeInstrumentGeometry } from './textbook-instrument-parts';
import { specimenSeed, taperRoot } from './textbook-agricultural-specimens';
import { noise } from './textbook-soil-cut-surface';
import { soilCutSampler } from './textbook-soil-column-surface';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';

type Datum=(x:number,y:number,z?:number)=>Vec3;
const unit=(v:number)=>Math.max(0,Math.min(1,v));

/** Remnant roots and a few tortuous connected pore traces share the exposed
 * soil face. Water may also move through the surrounding fine pores. */
export function mountCareSection(b:TextbookGeometry,soil:any,p:Datum,s:number,z0:number,lanes:number[],topAt:(x:number)=>number){
  const geometry=soil.geometry,pos=geometry.attributes.position,colors=geometry.attributes.color;
  const sample=soilCutSampler(geometry),face=(x:number,y:number)=>(sample(x*s,y*s)-z0)/s;
  function laneX(i:number,y:number){
    const v=unit((y-17.16)/(topAt(lanes[i])-17.16)),envelope=Math.sin(Math.PI*v);
    return lanes[i]+envelope*(1.10*Math.sin(7.7*v+i*1.43)+.52*Math.sin(16.5*v+i*.63));
  }
  function trace(i:number,y:number){
    const x=laneX(i,y),z=face(x,Math.min(topAt(x)-.10,Math.max(17.28,y)));
    const meet=unit((topAt(x)+1.6-y)/1.6)*unit((y-16.3)/.86);
    return p(x,y,12.8+(z+.125-12.8)*meet);
  }
  const parts:any[]=[];
  for(const [i,x] of [20.3,31.6,45.3,62.8,73.5].entries()){
    const top=topAt(x)-.19,reach=5.5+6.8*specimenSeed(i,3),side=i%2?1:-1;
    const at=(t:number)=>{
      const xx=x+side*(.72*Math.sin(9.8*t+i)-.72*Math.sin(i)+1.37*t),yy=top-reach*t;
      return new T.Vector3(...p(xx,yy,face(xx,yy)+.105+.10*Math.sin(t*19+i)));
    };
    const main=new T.CatmullRomCurve3(Array.from({length:15},(_,j)=>at(j/14)));
    parts.push(taperRoot(main,(.35+.13*specimenSeed(i,7))*s,27));
    for(let j=0;j<6;j++){
      const t=.19+j*.124,start=main.getPoint(t),sign=(j+i)%2?1:-1,dx=(.96+1.96*specimenSeed(j,i+8))*sign;
      const inner=(f:number)=>{const xx=start.x/s+dx*f,yy=start.y/s-(.78+1.40*specimenSeed(i,j+15))*f;return new T.Vector3(...p(xx,yy,face(xx,yy)+.10-.07*f));};
      const twig=new T.CatmullRomCurve3([start,inner(.49),inner(1)]);parts.push(taperRoot(twig,.135*s,11));
      const joint=twig.getPoint(.48);parts.push(taperRoot(new T.LineCurve3(joint,joint.clone().add(new T.Vector3(-.21*sign*s,-.64*s,-.07*s))),.068*s,6));
    }
  }
  const roots=b.mesh(mergeInstrumentGeometry(parts),'#806647',false,true,'land');roots.name='土层中保留的残根与细支根';
  roots.userData.agriculturalSpecimen='care-remnant-roots';roots.userData.modelInput=soil.userData.modelInput;roots.userData.interactionFeedback=false;
  const base=new Float32Array(colors.array),active:{i:number;y:number;influence:number}[]=[];
  const upper=new T.Color('#695039'),eluviated=new T.Color('#bc9b74');
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i)/s,y=pos.getY(i)/s,z=(pos.getZ(i)-z0)/s,band=noise(x*.17,y*.27);
    const depth=topAt(x)-y,humus=unit((5.7+.95*noise(x*.23,5)-depth)/2.4),lower=unit((depth-15-2.4*band)/7);
    const c=new T.Color().fromBufferAttribute(colors,i);c.lerp(upper,humus*.39).lerp(eluviated,lower*.36);
    base[3*i]=c.r;base[3*i+1]=c.g;base[3*i+2]=c.b;colors.setXYZ(i,c.r,c.g,c.b);
    if(z<9.4)continue;
    const lane=Math.max(0,Math.min(7,Math.round((x-lanes[0])/7.8)));
    const delta=(x-laneX(lane,y))/(.69+.80*band),influence=Math.exp(-delta*delta)*(.62+.34*noise(x*.31,y*.64));
    if(influence>.035)active.push({i,y,influence});
  }
  colors.needsUpdate=true;
  return {trace,wet(phase:number,wash:boolean,covered:boolean){
    const stage=unit((phase-.06)/.82);
    for(const {i,y,influence} of active){
      const reach=wash?unit((y-(45.6-stage*30))*.61):unit(((17.2+stage*28.0)-y)*.61);
      const strength=(wash?.45:covered?.11:.21)*reach*influence;
      colors.setXYZ(i,base[i*3]*(1-.91*strength),base[i*3+1]*(1-.76*strength),base[i*3+2]*(1-.62*strength));
    }
    colors.needsUpdate=true;
  }};
}
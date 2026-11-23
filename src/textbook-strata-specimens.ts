import { THREE as T } from './reference/engine.js';
import { STRATA_FOSSIL_INK, type StrataDefinition, type StrataFossil, type StrataPoint } from './textbook-strata-model';
import type { Vec3 } from './textbook-geometry';
type SurfacePoint=(xy:readonly number[],depth?:number)=>Vec3;
const blend=(a:number,b:number,t:number)=>a+(b-a)*t;
const ease=(v:number)=>{const t=Math.min(1,Math.max(0,v));return t*t*(3-2*t)};
function stoneNoise(x:number,y:number,seed=0){
  const hash=(a:number,b:number)=>{const n=Math.sin(a*127.1+b*311.7+seed*53.73)*43758.5453;return n-Math.floor(n)};
  const a=Math.floor(x),b=Math.floor(y),u=ease(x-a),v=ease(y-b);
  return blend(blend(hash(a,b),hash(a+1,b),u),blend(hash(a,b+1),hash(a+1,b+1),u),v);
}
/** The cut surface is shared by each mineral impression and its host stone. */
export function cutDepth(x:number,y:number){
  return .51*(stoneNoise(x*.18,y*.22,3)-.5)+.19*(stoneNoise(x*.81,y*.77,1)-.5);
}
function contact(x:number,z:number,level:number,column:number){
  if(level===0)return 0;
  const weather=stoneNoise(x*.12+column,z*.17,level)-.5;
  return .66*Math.sin(x*.16+z*.063+column*2.7)+weather*(level===3?2.85:.88)+.27*(stoneNoise(x*.64,z*.53,31)-.5);
}
/** Intersecting bedding surfaces are sampled with the same map on both
 * rocks. The freshly sawn fossil face gives way to a chipped crown,
 * irregular sides and a deeper, weather-worn heel at the back. */
export function fossilBed(def:StrataDefinition,toWorld:SurfacePoint){
  const col=def.column==='A'?0:1, vertices:number[]=[],colors:number[]=[],indices:number[]=[];
  const point=(u:number,t:number,w:number)=>{
    const left=blend(def.profile[0][0],def.profile[3][0],t),right=blend(def.profile[1][0],def.profile[2][0],t);
    const y=(def.level+t)*12,nominal=blend(left,right,u);
    const trim=(1-ease(u/.16))*(1.36*stoneNoise(y*.35,w*5,7+col)+.55*stoneNoise(y*.87,w*11,12))-
      (1-ease((1-u)/.16))*(1.92*stoneNoise(y*.31,w*7,14+col)+.65*stoneNoise(y*1.05,w*14,21));
    const x=nominal+trim+w*(.48*Math.sin(y*.49+u*2.5)+.7*(stoneNoise(nominal*.37,y*.35,4)-.5));
    const thickness=16+2.8*stoneNoise(nominal*.18,y*.27,col)+1.2*Math.sin(x*.17+y*.16);
    const z=blend(cutDepth(x,y),-thickness,w);
    const h=y+blend(contact(x,z,def.level,col),contact(x,z,def.level+1,col),t);
    const depth=blend(cutDepth(x,h),-thickness,w);
    return {point:toWorld([x,h],depth),tone:.92+.13*stoneNoise(x*.37,h*.46+z*.33,9)+.045*Math.cos(h*1.45+x*.14+z*.1)};
  };
  function face(nx:number,ny:number,coord:(u:number,v:number)=>[number,number,number],reverse:boolean){
    const start=vertices.length/3;for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
      const v=point(...coord(i/nx,j/ny));vertices.push(...v.point);colors.push(v.tone,v.tone,v.tone);
    }
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
      const a=start+j*(nx+1)+i,c=a+nx+1;
      if(reverse)indices.push(a,c,a+1,a+1,c,c+1);else indices.push(a,a+1,c,a+1,c+1,c);
    }
  }
  face(34,14,(u,t)=>[u,t,0],false);face(34,14,(u,t)=>[u,t,1],true);
  face(34,12,(u,w)=>[u,0,w],true);face(34,12,(u,w)=>[u,1,w],false);
  face(12,14,(w,t)=>[0,t,w],true);face(12,14,(w,t)=>[1,t,w],false);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
const distanceToPath=(x:number,y:number,path:readonly StrataPoint[])=>{
  let best=Infinity;
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],dx=b[0]-a[0],dy=b[1]-a[1],denom=dx*dx+dy*dy;
    const t=denom?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/denom)):0;
    best=Math.min(best,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy));
  }return best;
};
/** Positive shell casts. Subdivision of the silhouette triangulation lets
 * the whorl, costae or taper rise and descend into the actual sawn face. */
export function impression(f:StrataFossil,toWorld:SurfacePoint){
  const ink=STRATA_FOSSIL_INK[f.kind],outline=ink.outline.slice();
  const end=outline.at(-1)!;
  if(Math.hypot(end[0]-outline[0][0],end[1]-outline[0][1])<1e-5)outline.pop();
  const closed=[...outline,outline[0]],vertices:number[]=[],colors:number[]=[],indices:number[]=[],known=new Map<string,number>();
  const xy=(u:number,v:number):StrataPoint=>[f.x+u*f.width/2,f.y+v*f.height/2];
  const ridge=(u:number,v:number)=>{
    const d=distanceToPath(u,v,closed),edge=ease(d/.38);
    const shell=edge*(.45+.11*Math.sin(u*2.1+v*.68))+.22*ease(d/.13);
    const vein=Math.min(...ink.ribs.map(path=>distanceToPath(u,v,path)));
    return {h:.032+shell+.29*Math.exp(-(vein*vein)/.0058)*ease(d/.11),edge};
  };
  function vertex(q:StrataPoint,back=false){
    const key=q[0].toFixed(5)+','+q[1].toFixed(5)+Number(back);const found=known.get(key);if(found!==undefined)return found;
    const [x,y]=xy(...q),{h,edge}=ridge(...q),idx=vertices.length/3;
    vertices.push(...toWorld([x,y],cutDepth(x,y)+(back?-.32:h)));
    const tone=.82+.16*edge+.12*stoneNoise(x*1.1,y*.8,21);colors.push(tone,tone,tone);known.set(key,idx);return idx;
  }
  function facet(a:StrataPoint,b:StrataPoint,c:StrataPoint,n:number,back=false){
    if(!n){indices.push(vertex(a,back),vertex(b,back),vertex(c,back));return;}
    const mid=(p:StrataPoint,q:StrataPoint):StrataPoint=>[(p[0]+q[0])/2,(p[1]+q[1])/2];
    const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
    facet(a,ab,ca,n-1,back);facet(ab,b,bc,n-1,back);facet(ca,bc,c,n-1,back);facet(ab,bc,ca,n-1,back);
  }
  const faces=T.ShapeUtils.triangulateShape(outline.map(([x,y])=>new T.Vector2(x,y)),[]);
  for(const [ia,ib,ic] of faces){
    facet(outline[ia],outline[ib],outline[ic],3);facet(outline[ic],outline[ib],outline[ia],3,true);
  }
  for(let i=0;i<outline.length;i++){
    const a=outline[i],b=outline[(i+1)%outline.length];
    for(let j=0;j<8;j++){const p:StrataPoint=[blend(a[0],b[0],j/8),blend(a[1],b[1],j/8)],q:StrataPoint=[blend(a[0],b[0],(j+1)/8),blend(a[1],b[1],(j+1)/8)];
      indices.push(vertex(p),vertex(p,true),vertex(q),vertex(q),vertex(p,true),vertex(q,true));}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
  return {geometry:g,veinPoint:(q:StrataPoint)=>{const [x,y]=xy(...q);return toWorld([x,y],cutDepth(x,y)+ridge(...q).h+.045)}};
}
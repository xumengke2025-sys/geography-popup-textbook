export type PoreVertex=[number,number,number];
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const ease=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t)};
const knots=[
  [11,17,-1,1.25,1.2],[18,18,7.8,5.5,8.0],[24,20,7.2,3.8,7.3],[28,24,1.4,1.15,1.4],
  [34,33.1,8.9,5.8,8.3],[39,29,5.8,2.5,4.8],[43,24,-1,1.25,1.55],
  [49,20.4,8.9,4.6,6.7],[54,22,7,3.9,7.3],[58,27,0.7,1.3,1.5],
  [62,37,8.8,6.3,8.3],[67,40,6,3.8,6.5],[71,35,1.7,1.6,2.0],
  [76,29,9.1,4.9,7.7],[82,28,-.5,1.1,1.2]
];
function chamber(x:number){
  const end=knots.findIndex(k=>k[0]>=x),i=end<1?0:end-1,a=knots[i],b=knots[i+1],t=ease((x-a[0])/(b[0]-a[0]));
  return [1,2,3,4].map(j=>lerp(a[j],b[j],t));
}
const hash=(x:number,y:number)=>{const t=Math.sin(x*17.3+y*137.1)*43758.5453;return t-Math.floor(t)};
/** Fractured aggregates leave narrow, partly shadowed grooves between
 * neighbouring clods. The same field sets the real face and its colour. */
export function aggregateFace(x:number,y:number){
  const u=x*.125+.26*Math.sin(y*.24),v=y*.154+.22*Math.cos(x*.29),ix=Math.floor(u),iy=Math.floor(v);
  let d1=Infinity,d2=Infinity;
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){
    const xx=ix+i,yy=iy+j,dist=Math.hypot(u-(xx+.13+.74*hash(xx,yy)),v-(yy+.13+.74*hash(xx+71,yy-36)));
    if(dist<d1){d2=d1;d1=dist;}else if(dist<d2)d2=dist;
  }
  const joint=1-ease((d2-d1)/.24);
  return {joint,z:12.15+1.48*(1-Math.min(1,d1))-.95*joint+.38*Math.sin(x*.37+y*.55)+.15*Math.sin(y*1.06-x*.81)};
}
export const networkNX=116,networkSides=108;
function makePoreNetwork(){
  const outer:PoreVertex[]=[],inner:PoreVertex[]=[],axis:PoreVertex[]=[],open:boolean[]=[];
  const triangles:number[]=[],matrixIndices:number[]=[],windows:{x:number;minY:number;maxY:number;cy:number;ry:number}[]=[];
  for(let i=0;i<=networkNX;i++){
    const x=11+71*i/networkNX,[cy,cz,ry,rz]=chamber(x);
    axis.push([x,cy,cz]);let minY=Infinity,maxY=-Infinity;
    const back=-8.25,base=7.65,top=53.5,front=12.4;
    const warp=(y:number,z:number):[number,number]=>[
      y+(specimenCrown(x,z)-top)*ease((y-46)/(top-46)),
      z+(aggregateFace(x,y).z-front)*ease((z-5)/(front-5))
    ];
    // A regularly sampled cut face is embossed after the pore has been
    // carved, applying the same spatial deformation to soil and void.
    for(let j=0;j<networkSides;j++){
      let yy:number,zz:number;
      if(j<48){yy=lerp(base,top,j/48);zz=front;}
      else if(j<69){zz=lerp(front,back,(j-48)/21);yy=top;}
      else if(j<87){zz=back;yy=lerp(top,base,(j-69)/18);}
      else{zz=lerp(back,front,(j-87)/21);yy=base;}
      const rMax=Math.hypot(yy-cy,zz-cz),dy=(yy-cy)/rMax,dz=(zz-cz)/rMax,theta=Math.atan2(dy,dz);
      const r0=1/Math.hypot(dy/ry,dz/rz);
      const irregular=1+.17*Math.sin(3*theta+x*.19)+.1*Math.sin(5*theta-x*.12)+.06*Math.sin(theta*7+x*.37);
      const r=Math.min(rMax,r0*irregular),mouth=r>=rMax-1e-6;
      const endwear=ease((cy+dy*rMax-8)/9)*(.55*Math.sin((cy+dy*rMax)*.49+(cz+dz*rMax)*.31)+.41*Math.cos((cy+dy*rMax)*.83));
      const cutX=x+endwear*(1-ease(Math.min(x-11,82-x)/3.4));
      outer.push([cutX,...warp(yy,zz)]);inner.push([x,...warp(cy+dy*r,cz+dz*r)]);open.push(mouth);
      if(mouth&&dz>0){minY=Math.min(minY,cy+dy*r);maxY=Math.max(maxY,cy+dy*r);}
    }
    windows.push({x,minY,maxY,cy,ry});
  }
  const length=inner.length,center=(i:number)=>length+i;
  for(let i=0;i<networkNX;i++)for(let j=0;j<networkSides;j++){
    const a=i*networkSides+j,b=i*networkSides+(j+1)%networkSides,c=a+networkSides,d=b+networkSides;
    // Looking from the front, increasing angle runs from +Z towards +Y.
    triangles.push(a,c,b,b,c,d);
    for(const [v0,v1,v2] of [[a,c,b],[b,c,d]]){
      if(open[v0]&&open[v1]&&open[v2])continue;
      matrixIndices.push(v0,v1,v2,length+v0,length+v2,length+v1);
    }
  }
  for(const i of [0,networkNX])for(let j=0;j<networkSides;j++){
    const a=i*networkSides+j,b=i*networkSides+(j+1)%networkSides;
    if(i===0){triangles.push(center(i),a,b);matrixIndices.push(a,b,length+a,b,length+b,length+a);}
    else{triangles.push(center(i),b,a);matrixIndices.push(a,length+a,b,b,length+a,length+b);}
  }
  return {outer,inner,axis,open,triangles,matrixIndices,vertices:[...inner,...axis],windows};
}
export type SoilNetwork=ReturnType<typeof makePoreNetwork>;
let specimen:SoilNetwork|undefined;
export function poreNetwork(){return specimen??=makePoreNetwork();}
export const specimenCrown=(x:number,z:number)=>53.5+1.65*Math.sin(x*.21+z*.13)+.48*Math.cos(x*.52-z*.35)
  +.36*Math.sin(z*.55)-1.05*aggregateFace(x,z*1.3).joint;

export function clipSoilFace(face:PoreVertex[],h:number,lower:boolean){
  const out:PoreVertex[]=[];
  for(let j=0;j<face.length;j++){
    const a=face[j],b=face[(j+1)%face.length],inside=lower?a[1]<h:a[1]>=h,next=lower?b[1]<h:b[1]>=h;
    if(inside)out.push(a);
    if(inside!==next){const t=(h-a[1])/(b[1]-a[1]);out.push([lerp(a[0],b[0],t),h,lerp(a[2],b[2],t)]);}
  }return out;
}
export function poreNetworkFill(network:SoilNetwork,fraction:number){
  const {vertices,triangles}=network,faces:PoreVertex[][]=[];
  for(let i=0;i<triangles.length;i+=3)faces.push([vertices[triangles[i]],vertices[triangles[i+1]],vertices[triangles[i+2]]]);
  function volume(h:number){
    let total=0;
    for(const face of faces){
      const clipped=clipSoilFace(face,h,true);
      for(let j=1;j<clipped.length-1;j++){
        const a=clipped[0],b=clipped[j],c=clipped[j+1];
        const areaY=.5*((b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]));
        total+=areaY*((a[1]+b[1]+c[1])/3-h);
      }
    }return Math.abs(total);
  }
  let low=Infinity,high=-Infinity;
  for(const v of vertices){low=Math.min(low,v[1]);high=Math.max(high,v[1]);}
  const all=volume(high+.01);for(let k=0;k<21;k++){
    const mid=(low+high)/2;if(volume(mid)<all*fraction)low=mid;else high=mid;
  }
  const level=(low+high)/2,water:number[]=[],air:number[]=[],surface:number[]=[];
  function append(out:number[],poly:PoreVertex[]){for(let i=1;i<poly.length-1;i++)out.push(...poly[0],...poly[i],...poly[i+1]);}
  const strips=Array.from({length:networkNX},()=>[] as [PoreVertex,PoreVertex][]);
  for(const face of faces){
    const below=clipSoilFace(face,level,true);
    append(water,below);append(air,clipSoilFace(face,level,false));
    const edge=below.filter(v=>v[1]===level);
    if(edge.length!==2||Math.abs(edge[0][0]-edge[1][0])<1e-9)continue;
    const i=Math.min(networkNX-1,Math.floor(((edge[0][0]+edge[1][0])/2-11)*networkNX/71));
    strips[i].push([edge[0],edge[1]]);
  }
  // The horizontal cut through the boundary is a set of piecewise-linear
  // segments. Between successive x vertices they enclose exact trapezoids,
  // even where a lobed chamber has two separate water surfaces.
  for(const strip of strips){
    const xs=[...new Set(strip.flatMap(([a,b])=>[a[0],b[0]]))].sort((a,b)=>a-b);
    const zAt=([a,b]:[PoreVertex,PoreVertex],x:number)=>lerp(a[2],b[2],(x-a[0])/(b[0]-a[0]));
    for(let i=1;i<xs.length;i++){
      const left=xs[i-1],right=xs[i],mid=(left+right)/2;
      if(right-left<1e-9)continue;
      const sides=strip.filter(([a,b])=>Math.min(a[0],b[0])<mid&&Math.max(a[0],b[0])>mid)
        .sort((a,b)=>zAt(a,mid)-zAt(b,mid));
      for(let j=0;j+1<sides.length;j+=2){
        const lo=sides[j],hi=sides[j+1],cap:PoreVertex[]=[
          [left,level,zAt(lo,left)],[left,level,zAt(hi,left)],
          [right,level,zAt(hi,right)],[right,level,zAt(lo,right)]
        ];
        append(surface,cap);append(water,cap);append(air,cap.reverse());
      }
    }
  }
  return {level,water,air,surface,capacity:all,waterVolume:volume(level)};
}

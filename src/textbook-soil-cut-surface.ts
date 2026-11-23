import { aggregateFace, networkNX, networkSides, specimenCrown, type PoreVertex, type SoilNetwork } from './textbook-soil-pore-network';

const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
export const noise=(a:number,b:number)=>{
  const hash=(x:number,y:number)=>{const k=Math.sin(91.23*x+37.41*y)*39274.65;return k-Math.floor(k);};
  const x=Math.floor(a),y=Math.floor(b),u=smooth(a-x),v=smooth(b-y);
  return mix(mix(hash(x,y),hash(x+1,y),u),mix(hash(x,y+1),hash(x+1,y+1),u),v);
};

// A few tapering shrinkage fractures intersect the cut obliquely. Most
// of the cut is intact soil; its texture is supplied by the local loam scan.
const fractures=[
  [[15,51],[18.3,46.7],[17.9,44.1],[21.5,39.6],[24.8,37.3],[26.4,32],[29,29.4]],
  [[18.6,44.4],[16.1,41.8],[15.7,39.5],[13.6,37.3]],
  [[51.6,52.7],[51,48.1],[53.4,44.4],[52.8,40.6],[56.6,36.5],[57.9,31.7],[56.8,29.3]],
  [[53.6,43.6],[57.4,41.9],[58.7,40.2],[61.4,39.6]],
  [[72,40.8],[68.4,36.8],[67.8,34],[64.8,31.6],[63.2,28],[59.7,24.8],[59.8,21.6]],
  [[45.1,29.4],[42.5,25.8],[43.4,23.5],[40.4,20],[40.8,17.9]],
  [[75.3,24.4],[73.6,20.7],[75.1,18.1],[73,15.3],[71.2,13.8]]
];
const segments=fractures.flatMap((line,lineId)=>line.slice(1).map(([x1,y1],i)=>{
  const [x,y]=line[i],dx=x1-x,dy=y1-y;
  return {x,y,dx,dy,d2:dx*dx+dy*dy,w:(.7+.55*(1-i/line.length))*(lineId===1||lineId===3?.50:1)};
}));
export function exposedSoil(x:number,y:number){
  let seam=0;
  for(const e of segments){
    const u=clamp(((x-e.x)*e.dx+(y-e.y)*e.dy)/e.d2);
    const d=Math.hypot(x-e.x-e.dx*u,y-e.y-e.dy*u);
    seam=Math.max(seam,smooth(1-d/e.w));
  }
  const grain=noise(x*.64,y*.64),bed=noise(x*.075,y*.12),chips=noise(x*.24,y*.27);
  const z=12.45+.78*(bed-.5)+.61*(chips-.5)+.28*(grain-.5)-1.14*seam;
  return {z,seam,grain,bed,chips};
}
export const cutCrown=(x:number,z:number)=>52.8+1.2*(noise(x*.11,z*.13)-.5)+.83*(noise(x*.44,z*.53)-.5)+.51*Math.sin(.19*x+.15*z);

export function cutSpecimen(network:SoilNetwork){
  // The inner wall and water mesh retain their original coordinates. Keep
  // the cut edges of all five apertures and blend onto the flatter fresh face.
  const outer=network.outer.map(([x,y,z],i):PoreVertex=>{
    const inner=network.inner[i],gap=Math.hypot(x-inner[0],y-inner[1],z-inner[2]);
    const front=smooth((z-6.0)/5.5)*smooth((gap-.18)/3.0);
    const zz=z+front*(exposedSoil(x,y).z-aggregateFace(x,y).z);
    const yy=y+smooth((y-46)/6.0)*(cutCrown(x,zz)-specimenCrown(x,z));
    return [x,yy,zz];
  });
  // Bilinear interpolation on the identical front vertices used by the mesh
  // keeps inclusions embedded, including near an open pore.
  const column=(i:number,y:number)=>{
    const at=i*networkSides;let j=0;
    while(j<47&&outer[at+j+1][1]<y)j++;
    const a=outer[at+j],b=outer[at+j+1];
    return mix(a[2],b[2],clamp((y-a[1])/(b[1]-a[1])));
  };
  const face=(x:number,y:number)=>{
    const u=clamp((x-11)/71)*networkNX,i=Math.min(networkNX-1,Math.floor(u));
    return mix(column(i,y),column(i+1,y),u-i);
  };
  const solidAt=(x:number,y:number,margin=.95)=>{
    const w=network.windows[Math.round(clamp((x-11)/71)*networkNX)];
    return y<w.minY-margin||y>w.maxY+margin;
  };
  return {outer,face,solidAt};
}
export type CutSpecimen=ReturnType<typeof cutSpecimen>;
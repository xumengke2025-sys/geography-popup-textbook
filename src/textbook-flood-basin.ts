/** Heights and the water gauge belong to the tabletop specimen, with no
 * conversion to a real river stage, discharge, or duration. */
export const floodGrid={nx:92,nz:56,x0:4,x1:96,z0:9,z1:65};
const {nx,nz,x0,z0}=floodGrid;
const ease=(v:number)=>{const q=Math.min(1,Math.max(0,v));return q*q*(3-2*q)};
export const floodChannel=(z:number)=>50+4.2*Math.sin(z*.104)+2.3*Math.cos(z*.178+.72);
export const tributaries=[
  [[9,14,15.1],[14,20,13.1],[22,23,11.1],[27,31,8.35],[34,35,6.6],[40,40,4.38],[floodChannel(46),46,2.13]],
  [[11,40,10.8],[19,43,8.34],[26,48,6.52],[32,51,5.05],[39,53,3.94],[floodChannel(57),57,2.08]],
];
export const floodSites=[[66,42],[77,48],[68,57]];
function naturalHeight(x:number,z:number){
  const along=(65-z)/56,mid=floodChannel(z),delta=x-mid,across=Math.abs(delta),bed=2.02+.23*along;
  const west=ease((-delta-8)/24),east=ease((delta-24)/20);
  const shoulder=1.8*ease((-delta-18)/3.1);
  const ridges=7.5*Math.exp(-((z-19-.40*(x-17))**2)/76)+4.0*Math.exp(-((z-43+.18*x)**2)/52);
  const back=5.40+west*(2.7+ridges+1.25*Math.sin(.23*x-.08*z)+.63*Math.cos(.6*z+.25*x))+shoulder
    +east*(3.2+1.32*Math.cos(z*.11+x*.17))+(.32*Math.sin(x*.27+z*.13)+.17*Math.cos(z*.38-x*.14))*(.3+.7*east)
    -.85*Math.exp(-(((x-68)/12)**2+((z-46)/11)**2));
  const sill=5+1.12*(1-Math.exp(-((z-44)**2)/52));
  let h=bed+(sill-bed)*ease((across-2.2)/4.05);
  h= h+(back-h)*ease((across-6.25)/4.65);
  // A low, broad spill saddle connects the channel to the backswamp at
  // the teaching gauge's fifth mark. Its flat crest survives mesh sampling.
  const spill=ease((delta-3)/2)* (1-ease((delta-16)/4))*(1-ease((Math.abs(z-44)-1.8)/3.4));
  const spillBed=5-.42*ease((delta-8)/7);
  h+=spill*(Math.min(h,spillBed)-h);
  for(const route of tributaries){
    let dist=Infinity;
    for(let i=1;i<route.length;i++){
      const a=route[i-1],b=route[i],dx=b[0]-a[0],dz=b[1]-a[1];
      const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
      const d=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
      dist=Math.min(dist,d);
    }
    const wall=Math.max(0,dist-1.5);
    const bank=1-ease(wall/3.55);
    // All vertices that straddle the surveyed centreline share its grade
    // at this northing. Piecewise-linear interpolation therefore preserves
    // downhill flow, including oblique crossings of a triangle boundary.
    const interval=route.findIndex(v=>v[1]>=z);
    let thalweg=bed;
    if(interval===0)thalweg=route[0][2];
    else if(interval>0){
      const a=route[interval-1],b=route[interval],last=interval===route.length-1;
      const exit=last?2.02+.23*(65-b[1])/56:b[2];
      thalweg=a[2]+(exit-a[2])*(z-a[1])/(b[1]-a[1]);
    }
    h+=(thalweg+.24*wall+.17*wall*wall-h)*bank;
  }
  return h;
}
export const basinNodes=Array.from({length:(nx+1)*(nz+1)},(_,i)=>{
  const x=x0+i%(nx+1),z=z0+Math.floor(i/(nx+1));return {x,z,h:naturalHeight(x,z)};
});
export const basinIndices:number[]=[],adjacency:number[][]=[];
const edges=new Map<string,number>();
for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
  const a=j*(nx+1)+i,c=a+nx+1;
  for(const face of [[a,c,a+1],[a+1,c,c+1]]){
    const f=basinIndices.length/3;basinIndices.push(...face);adjacency.push([-1,-1,-1]);
    face.forEach((a,j)=>{
      const c=face[(j+1)%3],key=a<c?a+','+c:c+','+a,prior=edges.get(key);
      if(prior!==undefined){adjacency[f][j]=Math.floor(prior/3);adjacency[Math.floor(prior/3)][prior%3]=f;}else edges.set(key,f*3+j);
    });
  }
}
export function floodSample(x:number,z:number){
  const xx=Math.max(0,Math.min(nx,x-x0)),zz=Math.max(0,Math.min(nz,z-z0));
  const i=Math.min(nx-1,Math.floor(xx)),j=Math.min(nz-1,Math.floor(zz)),k=i+j*(nx+1),u=xx-i,v=zz-j;
  const a=basinNodes[k].h,b=basinNodes[k+1].h,c=basinNodes[k+nx+1].h,d=basinNodes[k+nx+2].h;
  return {h:u+v<=1?a+u*(b-a)+v*(c-a):d+(1-u)*(c-d)+(1-v)*(b-d),face:2*(j*nx+i)+(u+v<=1?0:1)};
}
/** Flooding propagates across an actually submerged shared edge. An
 * isolated depression below the set stage stays dry until its sill wets. */
export function connectedFlood(level:number){
  const seed=floodSample(floodChannel(64.8),64.8).face,wet=new Uint8Array(adjacency.length),queue=[seed],triangles:number[]=[];
  wet[seed]=1;let area=0;
  for(let k=0;k<queue.length;k++){
    const f=queue[k],poly:number[][]=[];
    for(let j=0;j<3;j++){
      const a=basinNodes[basinIndices[f*3+j]],b=basinNodes[basinIndices[f*3+(j+1)%3]],aw=a.h<level,bw=b.h<level;
      if(aw)poly.push([a.x,a.z]);
      if(aw!==bw){const t=(level-a.h)/(b.h-a.h);poly.push([a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t]);}
      const e=adjacency[f][j];
      if(e>=0&&!wet[e]&&(aw||bw)){wet[e]=1;queue.push(e);}
    }
    for(let i=1;i<poly.length-1;i++){
      const [a,b,c]=[poly[0],poly[i],poly[i+1]];
      area+=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;
      triangles.push(a[0],a[1],b[0],b[1],c[0],c[1]);
    }
  }
  const inundated=(x:number,z:number)=>{const q=floodSample(x,z);return !!wet[q.face]&&q.h<level;};
  return {wet,triangles,area,sites:floodSites.map(([x,z])=>inundated(x,z)),inundated};
}

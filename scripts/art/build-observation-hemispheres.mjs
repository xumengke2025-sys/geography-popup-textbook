import {readFile,writeFile} from 'node:fs/promises';
const coasts=JSON.parse(await readFile(new URL('../../src/assets/solar-instrument/coastlines.json',import.meta.url),'utf8'));
const regions=coasts.map(poly=>({poly,minX:Math.min(...poly.map(p=>p[0])),maxX:Math.max(...poly.map(p=>p[0])),minY:Math.min(...poly.map(p=>p[1])),maxY:Math.max(...poly.map(p=>p[1]))}));
function isLand(lon,lat){
  for(const {poly,minX,maxX,minY,maxY} of regions){
    if(lon<minX||lon>maxX||lat<minY||lat>maxY)continue;
    let inside=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[i],b=poly[j];
      if((a[1]>lat)!==(b[1]>lat)&&lon<(b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }
    if(inside)return true;
  }
  return false;
}
const N=432,S=N+1;
function contours(mask){
  const edges=new Map();
  function edge(a,b){const next=edges.get(a)??[];next.push(b);edges.set(a,next);}
  for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(mask[y*N+x]){
    const i=y*S+x;
    if(y===0||!mask[(y-1)*N+x])edge(i,i+1);
    if(x===N-1||!mask[y*N+x+1])edge(i+1,i+1+S);
    if(y===N-1||!mask[(y+1)*N+x])edge(i+1+S,i+S);
    if(x===0||!mask[y*N+x-1])edge(i+S,i);
  }
  const path=[];function simplify(q){
    if(q.length<3)return q;
    const first=q[0],last=q.at(-1),dx=last[0]-first[0],dy=last[1]-first[1],dd=dx*dx+dy*dy;let pivot=0,largest=1.22;
    for(let i=1;i<q.length-1;i++){
      const sx=q[i][0]-first[0],sy=q[i][1]-first[1],t=dd?Math.max(0,Math.min(1,(sx*dx+sy*dy)/dd)):0;
      const d=(sx-t*dx)**2+(sy-t*dy)**2;if(d>largest){largest=d;pivot=i;}
    }
    return pivot?[...simplify(q.slice(0,pivot+1)).slice(0,-1),...simplify(q.slice(pivot))]:[first,last];
  }
  while(edges.size){
    const first=edges.keys().next().value;let key=first;const q=[];
    do{q.push([key%S,Math.floor(key/S)]);const next=edges.get(key),k=next.pop();if(!next.length)edges.delete(key);key=k;}while(key!==first);
    if(q.length<5)continue;q.push(q[0]);const poly=simplify(q);
    if(poly.length>=4)path.push('M'+poly.slice(0,-1).map(p=>p.map(c=>+(200*c/N-100).toFixed(2)).join(',')).join('L')+'Z');
  }
  return path.join('');
}
function project(yaw,pitch,sun){
  const masks=[new Uint8Array(N*N),new Uint8Array(N*N)],a=Math.sin(yaw),b=Math.cos(yaw),h=Math.sin(pitch),v=Math.cos(pitch);
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){
    const sx=(i+.5)*2/N-1,sy=1-(j+.5)*2/N,rad=1-sx*sx-sy*sy;if(rad<=0)continue;
    const z=Math.sqrt(rad),nx=sx*b-sy*a*h+z*a*v,ny=sy*v+z*h,nz=-sx*a-sy*b*h+z*b*v;
    masks[0][j*N+i]=Number(isLand(Math.atan2(nx,nz)*180/Math.PI,Math.asin(ny)*180/Math.PI));
    masks[1][j*N+i]=Number(nx*sun[0]+ny*sun[1]+nz*sun[2]<0);
  }
  return {land:contours(masks[0]),night:contours(masks[1])};
}
await writeFile(new URL('../../src/assets/solar-instrument/observation-hemispheres.json',import.meta.url),JSON.stringify({
  habitable:project(.20,.17,[-.84,0,Math.sqrt(1-.84**2)]),
  insolation:project(-.36,.16,[-.86,0,Math.sqrt(1-.86**2)])
}));


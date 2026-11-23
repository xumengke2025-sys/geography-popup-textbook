import { writeFile } from 'node:fs/promises';
import { riverValleySurfaceHeight, valleySection } from '../../src/textbook-natural-form-geometry.ts';

const nx=110, ny=72, width=93, depth=60;
const profiles=[false,true].map(plain=>{
  const grid=Array.from({length:ny+1},(_,j)=>Array.from({length:nx+1},(_,i)=>{
    const x=3.5+width*i/nx, y=depth*j/ny;
    return +riverValleySurfaceHeight(x/100,y/depth,plain).toFixed(4);
  }));
  const readings=Array.from({length:101},(_,i)=>valleySection(i/100,plain));
  const river=Array.from({length:ny+1},(_,j)=>{
    const v=j/ny, center=.5+.035*Math.sin(v*4);
    const water=riverValleySurfaceHeight(center,v,plain)+.52;
    const edges=[-1,1].map(sign=>{
      let lo=0,hi=.16;
      for(let i=0;i<20;i++){
        const mid=(lo+hi)/2;
        if(riverValleySurfaceHeight(center+sign*mid,v,plain)>water)hi=mid;else lo=mid;
      }
      return (center+sign*hi)*100;
    });
    return [...edges,water];
  });
  return {grid,readings,river};
});
await writeFile('work/valley-profiles.json',JSON.stringify({nx,ny,width,depth,profiles}));

import type { NaturalSurface } from './textbook-natural-form-geometry';

/** Midrib, blade margins and two skins share their root and tip. A cupped
 * broadleaf and an entire, leathery leaf retain different silhouettes. */
export function botanicalBlade(leathery:boolean):NaturalSurface {
  const positions:number[]=[0,0,0],indices:number[]=[];
  for(let j=1;j<8;j++){
    const t=j/8,mid=Math.sin(t*Math.PI),w=(leathery?.145:.192)*mid**.85*(leathery?1:j%2===0?.86:1);
    const y=.045*mid+.018*t;
    positions.push(t,y-.039*mid,-w,t,y+.027*mid,0,t,y-.034*mid,w*(.94+.05*Math.sin(j)),t,y+.013*mid,0);
    const k=1+(j-1)*4;
    if(j>1)for(let side=0;side<4;side++){const a=k+side,b=k+(side+1)%4;indices.push(a-4,a,b-4,b-4,a,b);}
    else for(let side=0;side<4;side++)indices.push(0,k+side,k+(side+1)%4);
  }
  const tip=positions.length/3;positions.push(1,leathery?-.065:-.032,0);
  for(let side=0;side<4;side++)indices.push(tip-4+side,tip,tip-4+(side+1)%4);
  return {positions,indices};
}

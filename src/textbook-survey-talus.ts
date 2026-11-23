import { THREE as T } from './reference/engine.js';
import { applyEarthScan } from './textbook-earth-scan';
import { sampleSurvey } from './textbook-terrain-survey';
import type { TextbookGeometry,Vec3 } from './textbook-geometry';

export function mountSurveyTalus(b:TextbookGeometry,p:(x:number,y:number,z:number)=>Vec3,s:number){
  const pos:number[]=[],tone:number[]=[];
  const seed=(n:number)=>{const h=Math.sin(n*43.7)*77931.5;return h-Math.floor(h);};
  const chips=['#b4a991','#827e73','#979784','#a2947a'].map(hex=>new T.Color(hex));
  const fans=[[21,32.4,6.3,2.1],[35,31.7,7.2,2.0],[73,33,6.1,2.0],[83,38.2,5.2,2.8]];
  for(let k=0;k<78;k++){
    const [cx,cz,rx,rz]=fans[k%fans.length],x=cx+(2*seed(3*k+1)-1)*rx,z=cz+(seed(3*k+2)*2-1)*rz;
    const radius=.27+.86*seed(k+301)**2;
    if(Math.abs(z-33-(x-15)*11/71)<2.1+radius)continue;
    const q=sampleSurvey(x,z),color=chips[k%chips.length],sides=5+k%3,starts:Vec3[]=[],upper:Vec3[]=[];
    const h=q.h-radius*.25;
    for(let i=0;i<sides;i++){
      const a=(i+.26*seed(i+41*k))*Math.PI*2/sides+k*.53,r=radius*(.76+.34*seed(k*31+i));
      const dx=Math.cos(a)*r,dz=Math.sin(a)*r*.67;
      const bed=h+(dx*q.gx+dz*q.gz)*.76;
      starts.push(p(x+dx,bed,z+dz)); upper.push(p(x+dx*.79,bed+radius*(.54+.12*seed(i+19*k)),z+dz*.81));
    }
    const top=p(x+.21*radius,h+.67*radius,z+.03*radius);
    for(let i=0;i<sides;i++){
      const j=(i+1)%sides;
      for(const v of [top,upper[j],upper[i],upper[i],starts[j],starts[i],upper[i],upper[j],starts[j]]){
        pos.push(...v);tone.push(color.r,color.g,color.b);
      }
    }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  g.setAttribute('color',new T.Float32BufferAttribute(tone,3));g.computeVertexNormals();
  const m=b.mesh(g,'#fffefa',false,true,'rock',{vertexColors:true});m.material.vertexColors=true;
  applyEarthScan(m.material,'outcrop',3.7*s);m.userData.landformDetail='岩壁坡脚片状棱砾';
}

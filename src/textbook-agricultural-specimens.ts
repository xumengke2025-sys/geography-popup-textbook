import { THREE as T } from './reference/engine.js';

export function specimenSeed(index:number,salt:number) {
  const h=Math.sin(index*91.47+salt*63.02)*42791.46;
  return h-Math.floor(h);
}

/** A broken grain has an angular rim, a fresher cut facet, and an embedded heel. */
export function mineralChip(seed:number) {
  const n=5+seed%4, rim:number[][]=[],face:number[][]=[],heel:number[][]=[];
  for(let i=0;i<n;i++){
    const a=(i+.33*(specimenSeed(seed,i)-.5))*Math.PI*2/n,r=.70+.34*specimenSeed(i,seed+4);
    const x=r*Math.cos(a),y=r*Math.sin(a);
    rim.push([x,y,-.16]);face.push([x*(.43+.31*specimenSeed(i,seed+8)),y*.69,.23+.17*x+.10*specimenSeed(i,seed+3)]);
    heel.push([x*.64,y*.76,-.64]);
  }
  const pts:number[]=[];
  const tri=(a:number[],b:number[],c:number[])=>pts.push(...a,...b,...c);
  for(let i=0;i<n;i++){
    const j=(i+1)%n;tri([.16,-.04,.44],face[i],face[j]);
    tri(face[i],rim[i],rim[j]);tri(face[i],rim[j],face[j]);tri(rim[i],heel[i],heel[j]);tri(rim[i],heel[j],rim[j]);tri([0,0,-.67],heel[j],heel[i]);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pts,3));g.computeVertexNormals();return g;
}

/** The ring follows the local frame of the curve and dies into a fine tip. */
export function taperRoot(curve:any,radius:number,segments=20) {
  const sides=7,g=new T.TubeGeometry(curve,segments,1,sides,false),p=g.attributes.position;
  for(let i=0;i<=segments;i++){
    const t=i/segments,center=curve.getPointAt(t),r=radius*(1-.91*t)*(.96+.07*Math.cos(t*17));
    for(let j=0;j<=sides;j++){
      const k=i*(sides+1)+j;p.setXYZ(k,center.x+(p.getX(k)-center.x)*r,center.y+(p.getY(k)-center.y)*r,center.z+(p.getZ(k)-center.z)*r);
    }
  }
  g.computeVertexNormals();return g;
}

// A thin blade with a folded midrib and a torn or finely serrated rim.
export function specimenLeaf(seed:number){
  const positions:number[]=[],indices:number[]=[],n=12;
  for(let j=0;j<=n;j++){
    const t=j/n,w=Math.sin(t*Math.PI)**.83*(.18+.05*specimenSeed(seed,1)),turn=.034*Math.sin(6*t+seed)*Math.sin(t*Math.PI);
    for(const lane of [-1,-.15,0,.16,1]){
      const rag=Math.abs(lane)===1?1-.18*specimenSeed(seed+j,Math.round(lane)*8+17):1;
      positions.push(t,w*lane*rag+turn,.035*Math.sin(Math.PI*t)*(1-Math.abs(lane))-.052*t*t+.022*lane*Math.sin(5*t+seed));
    }
    if(j<n)for(let k=0;k<4;k++){const a=j*5+k;indices.push(a,a+5,a+1,a+1,a+5,a+6);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

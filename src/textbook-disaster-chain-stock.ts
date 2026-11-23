import { DISASTER_CHAIN_LAYOUT as L, chainValleyGround, type DisasterChainState } from './textbook-disaster-chain-model';

const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t)};
export function chainHill(x:number,z:number){
  const t=smooth((30.6-z)/10);
  const foothill=L.valleyBase+L.bankSlope*Math.min(14,35-z)**2;
  const relief=23*Math.exp(-((x-55)**2/600+(z-10)**2/145));
  const benches=.79*Math.sin(.38*x+.55*z)+.42*Math.cos(x*.87-z*.26);
  return foothill+(relief+benches)*t;
}
/** Two short natural rock shoulders at the choke leave a narrow thalweg.
 * Away from the constriction the ordinary parabolic floodplain is unchanged. */
export function chokeGround(x:number,z:number) {
  const across=Math.abs(z-L.riverZ);
  const seat=7.35*smooth((across-1.25)/2.95)*(1-smooth((across-9)/5));
  return chainValleyGround(z)+seat*(1-smooth(Math.abs(x-55.34)/7));
}
const x0=47.9,x1=62.1,z0=9.8,z1=22.1;
export function chainScour(x:number,z:number){
  const margin=Math.min(x-x0,x1-x,z-z0,z1-z);
  return smooth(margin/2.1)*(9.8+.59*Math.sin(x*.72+z*.33)+.68*Math.cos(z*.38));
}
const plan=(u:number,v:number):[number,number]=>[
  x0+(x1-x0)*u+.56*Math.sin(Math.PI*u)*Math.sin(v*11.2+u*7.1),
  z0+(z1-z0)*v+.65*Math.sin(Math.PI*v)*Math.sin(u*12.3-v*4.7),
];

/** Every piece is a closed portion of the excavated source. The same twelve
 * pieces travel, form the cross-valley dam, and split at the centre row.
 * Breach sediment is deposited on alternate banks further downstream. */
function createTalusStock(id:number){
  const row=Math.floor(id/4),col=id%4,n=5,stride=n+1;
  const [x,z]=plan((col+.5)/4,(row+.5)/3),y=chainHill(x,z);
  const pos:number[]=[],tone:number[]=[],facies:number[]=[],idx:number[]=[];
  for(const top of [true,false])for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
    const [px,pz]=plan((col+i/n)/4,(row+j/n)/3);
    const h=chainHill(px,pz)-(top?0:chainScour(px,pz));
    pos.push(px-x,h-y,pz-z);
    const moss=top?.4+.23*Math.cos(px*.38+pz*.67):0;
    tone.push(.83-.16*moss,.71+.04*moss,.56-.14*moss);
    facies.push(top?.27:.78,.10,moss);
  }
  const layer=stride**2;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const a=j*stride+i,e=a+stride;
    idx.push(a,e,a+1,a+1,e,e+1,layer+a,layer+a+1,layer+e,layer+a+1,layer+e+1,layer+e);
  }
  const edge:number[]=[];
  for(let i=0;i<=n;i++)edge.push(i);
  for(let j=1;j<=n;j++)edge.push(j*stride+n);
  for(let i=n-1;i>=0;i--)edge.push(n*stride+i);
  for(let j=n-1;j>0;j--)edge.push(j*stride);
  for(let i=0;i<edge.length;i++){
    const a=edge[i],e=edge[(i+1)%edge.length];idx.push(a,e,a+layer,e,e+layer,a+layer);
  }
  const angle=Math.atan((chainHill(x,z+.1)-chainHill(x,z-.1))/.2);
  const landing=[55+(col-1.5)*3.38,0,35+(row-1)*3.88];
  const axisCos=Math.cos(angle),axisSin=Math.sin(angle);
  let lowest=Infinity,minX=Infinity,minZ=Infinity,maxZ=-Infinity,stock=0;
  for(let i=0;i<pos.length;i+=3){
    lowest=Math.min(lowest,(pos[i+1]*axisCos-pos[i+2]*axisSin));
    const z=(pos[i+1]*axisSin+pos[i+2]*axisCos);
    minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);minX=Math.min(minX,pos[i]);
  }
  const shoulderShift=row===0?Math.min(-1.5,32.9-landing[2]-maxZ):row===2?Math.max(1.5,37.1-landing[2]-minZ):0;
  const downstream=Math.max(7.1+col*1.15,59.1-landing[0]-minX);
  for(let i=0;i<idx.length;i+=3){
    const a=idx[i]*3,e=idx[i+1]*3,k=idx[i+2]*3;
    stock+=(pos[a]*(pos[e+1]*pos[k+2]-pos[e+2]*pos[k+1])
      +pos[a+1]*(pos[e+2]*pos[k]-pos[e]*pos[k+2])
      +pos[a+2]*(pos[e]*pos[k+1]-pos[e+1]*pos[k]))/6;
  }
  landing[1]=chokeGround(landing[0],landing[2])-lowest;
  return {positions:pos,colors:tone,facies,indices:idx,edge,layer,id,row,nominalVolume:Math.abs(stock),source:[x,y,z],landing,
    pose(q:DisasterChainState['earthquake']){
      const erode=row===1?q.breach:0;
      const side=(col%2?1:-1)*(5.6+col*.32);
      const shoulder=shoulderShift*q.breach;
      const xx=x+(landing[0]-x)*q.slide+q.shake*(1-q.slide)+downstream*erode;
      const zz=z+(landing[2]-z)*q.slide+side*erode+shoulder;
      const bed=chokeGround(landing[0]+downstream,landing[2]+side)-chokeGround(landing[0],landing[2]);
      const support=chokeGround(landing[0],landing[2]+shoulder)-chokeGround(landing[0],landing[2]);
      const yy=y+(landing[1]-y)*q.slide+bed*erode+support;
      return {x:xx,y:yy,z:zz,pitch:angle*q.slide};
    }};
}

let stock:ReturnType<typeof createTalusStock>[]|undefined;
export function chainTalusStock(){
  return stock??=Array.from({length:12},(_,i)=>createTalusStock(i));
}

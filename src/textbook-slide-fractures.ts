const bell=(n:number)=>Math.exp(-n*n);
export function crownCrack(x:number,z:number){
  const arc=-4.7+.041*(z-.8)**2+.31*Math.sin(z*.82);
  const primary=bell((x-arc)/.43)*bell((z-.25)/6.5);
  const branch=bell((x+1.6-.21*z-.4*Math.sin(.7*z))/.33)*bell((z-3.1)/3.8);
  return Math.max(primary,branch*.75);
}
const rand=(n:number)=>{const t=Math.sin(42.157*n)*12869.413;return t-Math.floor(t);};
export function slidingFace(u:number,v:number,h:number){
  const along=Math.atan2(v,u)*10;
  let chip=0,oxide=0;
  for(let i=-1;i<=1;i++){
    const k=Math.floor(along/2)+i;
    const c=2*k+.22+1.54*rand(k+11),theta=(along-c)*(.91+rand(k+33));
    const depth=(h-.41-2.24*rand(k+17))/(.37+.43*rand(k+53));
    const d=Math.abs(theta+.29*depth)+Math.abs(depth-.14*theta);
    if(d<1){const relief=1-d**1.6;if(relief>chip){chip=relief;oxide=rand(k+29);}}
  }
  const hummus=bell((h-2.91)/.43);
  return {chip,oxide,hummus,rugosity:.11*Math.sin(along*2.45+h*2.3)+.075*Math.cos(along*.9-h*3.7)};
}

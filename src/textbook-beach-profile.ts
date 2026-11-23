// A local beach section. u follows the coast and v increases offshore.
export const beachWaterLevel=4;
export function beachShore(u:number){
  return .66+.07*Math.sin(u*5.4-.9)+.025*Math.sin(u*12+.4);
}
export function beachHeight(u:number,v:number){
  const inland=beachShore(u)-v;
  const shoulder=Math.exp(-Math.pow((inland-.29)/.095,2));
  return beachWaterLevel+7.8*inland+1.4*shoulder;
}
function ramp(t:number,start:number,end:number){
  const q=Math.max(0,Math.min(1,(t-start)/(end-start)));
  return q*q*(3-2*q);
}
function waveFronts(u:number,t:number){
  const shift=.025*Math.sin(u*5.6);
  return {
    first:ramp(t,.025+shift,.22+shift),firstReturn:ramp(t,.22+shift,.45+shift),
    second:ramp(t,.48+shift,.69+shift),secondReturn:ramp(t,.69+shift,.95+shift)
  };
}
export function beachSwash(u:number,t:number){
  const w=waveFronts(u,t);
  return beachShore(u)-.068*(w.first-w.firstReturn)-.107*(w.second-w.secondReturn);
}
// Fixed specimens give a repeatable before/after comparison when scrubbing.
// Longitude, starting depth and shape vary independently.
const fraction=(v:number)=>v-Math.floor(v);
export const beachGrains=Array.from({length:15},(_,i)=>({
  startU:.10+.78*fraction(.29+i*.618034),
  depth:.065+.11*fraction(.58+i*.414214),
  carry:.38+.58*fraction(.16+i*.754878),
  radius:.40+.24*fraction(.64+i*.324718),
  elongation:1.12+.64*fraction(.23+i*.56984),
  turn:Math.PI*fraction(.62+i*.43845),
  color:['#866c52','#a68a68','#705f50','#a59679'][i%4],
}));
export function beachGrain(index:number,t:number){
  const grain=beachGrains[index], w=waveFronts(grain.startU,t);
  const travel=grain.depth+.053*grain.carry;
  const drift=.029*grain.carry;
  const u=grain.startU+drift*(w.first-.3*w.firstReturn+1.4*w.second-.21*w.secondReturn);
  const inland=-grain.depth+travel*w.first-.034*w.firstReturn
    +(.042+.026*grain.carry)*w.second-.019*(1-grain.carry)*w.secondReturn;
  const v=beachShore(u)-inland;
  const angle=grain.turn+.7*w.first-.18*w.firstReturn+.42*w.second;
  return {u,v,height:beachHeight(u,v),angle};
}

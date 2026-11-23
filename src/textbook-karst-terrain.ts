/** Schematic limestone towers share a closed depression and one surface datum. */
const peaks = [[.16,.29,23,.12,.19],[.25,.46,19,.10,.13],[.22,.72,12,.09,.15],[.42,.19,28,.13,.14],
  [.56,.22,20,.09,.17],[.77,.29,29,.14,.18],[.84,.58,23,.10,.16],[.74,.78,11,.09,.14]];
export function karstBasinHeight(u: number, v: number) {
  let sum=0;
  for (const [x,y,h,rx,ry] of peaks) {
    const a=(u-x)/rx, b=(v-y)/ry;
    const q=(a + .17*Math.sin(b*3.1 + 17*x))**2 + (b + .16*Math.sin(a*3.8 + 13*y))**2;
    sum+=(h*Math.exp(-1.04*q**1.47))**4;
  }
  const h=sum**.25;
  const joints=Math.sin(u*128 + 2.35*Math.sin(v*15) + v*22);
  const flutes=1.2*Math.sin(u*60+v*17)+1.1*Math.sin(v*53+2*Math.sin(21*u)) - 2.0*Math.exp(-5*joints*joints);
  const bowl=1.28*(1-Math.exp(-((u-.5)**2/.020+(v-.72)**2/.044)));
  return 5.1+bowl+h+Math.min(1,h/4)*flutes;
}
export function soilMantleHeight(u: number,v: number) {
  const h=karstBasinHeight(u,v);
  const dx=(karstBasinHeight(u+.001,v)-karstBasinHeight(u-.001,v))/.188;
  const dz=(karstBasinHeight(u,v+.001)-karstBasinHeight(u,v-.001))/.102;
  const slope=Math.hypot(dx,dz);
  const exposure=Math.min(1,Math.max(0,(slope-1.05)/1.8));
  return h+.40+.23*Math.sin(u*43+v*14)*Math.sin(v*37)-.98*exposure;
}
export function karstPhaseSection(id:'karst-cave'|'karst-livelihood',phase:number) {
  return id==='karst-cave'?24+52*phase:16+68*phase;
}

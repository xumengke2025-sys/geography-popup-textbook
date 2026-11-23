/** A fictional relief map for comparing evidence, never a real siting score.
 * All coordinates and heights are arbitrary model units. */
export type MapPoint = [number, number];
export const WAREHOUSE_SITES: readonly MapPoint[] = [[24,29],[53,39],[82,13]];
export const WAREHOUSE_TOWNS: readonly MapPoint[] = [[18,58],[83,59],[87,33]];
export const WAREHOUSE_WATER_LEVEL = 4.65;
export function warehouseRiverX(z:number) {
  return 22 + 2.8*Math.sin((z-8)*.083) - 1.9*Math.sin((z-8)*.14);
}
export function warehouseHeight(x:number,z:number) {
  const summit=Math.exp(-((x-83)**2/301+(z-12)**2/198));
  const spur=3.7*Math.exp(-((x-71)**2/167+(z-19)**2/133))+2.8*Math.exp(-((x-91)**2/86+(z-28)**2/151));
  const hill=12.9*summit+spur+summit*(.56*Math.sin(x*.37+z*.18)+.42*Math.sin(z*.57-x*.2));
  const incision=2.6*Math.exp(-(((x-warehouseRiverX(z))/6.8)**2));
  return 5.4+hill+.24*Math.sin(x*.14)*Math.sin(z*.1)-incision;
}
/** Round the internal bends of the mountain road. Preserve the dock and the
 * junction so every candidate still joins the same service network. */
function roundApproach(path:MapPoint[]):MapPoint[] {
  const road:MapPoint[]=[path[0]];
  for(let i=1;i<path.length-1;i++){
    const [x,z]=path[i], before=path[i-1], after=path[i+1];
    const inward=(point:MapPoint):MapPoint=>{
      const dx=point[0]-x,dz=point[1]-z;
      const q=Math.min(.32,4/Math.hypot(dx,dz));
      return [x+dx*q,z+dz*q];
    };
    const a=inward(before),b=inward(after);
    for(let j=0;j<=6;j++){
      const t=j/6,u=1-t;
      road.push([u*u*a[0]+2*t*u*x+t*t*b[0],u*u*a[1]+2*t*u*z+t*t*b[1]]);
    }
  }
  road.push(path[path.length-1]);
  return road;
}
/** Every route begins at the actual front apron and ends at a village lane.
 * Candidate comparison is static; parcel positions do not imply travel time. */
export function warehouseRoutes(candidate:number):MapPoint[][] {
  const mode=Math.max(0,Math.min(2,Math.round(candidate))), site=WAREHOUSE_SITES[mode];
  const start:MapPoint=[site[0],site[1]+5.7], junction:MapPoint=[52,45];
  const approach:MapPoint[]=mode===0?[start,[38,35],junction]:mode===1?[start,junction]
    :roundApproach([start,[91,25],[76,34],[72,23],[60,29],junction]);
  return WAREHOUSE_TOWNS.map(([x,z])=>[...approach,[x,z+3.3]]);
}
export function sampleWarehouseRoute(route:readonly MapPoint[],steps=14):MapPoint[] {
  return route.flatMap((a,i)=>i===route.length-1?[a]:Array.from({length:steps},(_,j)=>{
    const q=j/steps,b=route[i+1];return[a[0]+(b[0]-a[0])*q,a[1]+(b[1]-a[1])*q] as MapPoint;
  }));
}
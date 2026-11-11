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
  const hill=13*Math.exp(-((x-83)**2/350+(z-12)**2/240));
  const incision=2.6*Math.exp(-(((x-warehouseRiverX(z))/6.8)**2));
  return 5.4+hill+.24*Math.sin(x*.14)*Math.sin(z*.1)-incision;
}
/** Every route begins at the actual front apron and ends at a village lane.
 * Candidate comparison is static; parcel positions do not imply travel time. */
export function warehouseRoutes(candidate:number):MapPoint[][] {
  const mode=Math.max(0,Math.min(2,Math.round(candidate))), site=WAREHOUSE_SITES[mode];
  const start:MapPoint=[site[0],site[1]+5.7], junction:MapPoint=[52,45];
  const approach:MapPoint[]=mode===0?[start,[38,35],junction]:mode===1?[start,junction]
    :[start,[91,25],[76,34],[72,23],[60,29],junction];
  return WAREHOUSE_TOWNS.map(([x,z])=>[...approach,[x,z+3.3]]);
}
export function sampleWarehouseRoute(route:readonly MapPoint[],steps=14):MapPoint[] {
  return route.flatMap((a,i)=>i===route.length-1?[a]:Array.from({length:steps},(_,j)=>{
    const q=j/steps,b=route[i+1];return[a[0]+(b[0]-a[0])*q,a[1]+(b[1]-a[1])*q] as MapPoint;
  }));
}

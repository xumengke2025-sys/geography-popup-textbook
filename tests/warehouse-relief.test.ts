import { describe, expect, it } from 'vitest';
import { WAREHOUSE_SITES, WAREHOUSE_TOWNS, WAREHOUSE_WATER_LEVEL, warehouseHeight, warehouseRoutes, sampleWarehouseRoute } from '../src/textbook-warehouse-relief';

describe('fictional site comparison retains its geographical evidence',()=>{
  it('exposes the lowland candidate under the same level without flooding the other two',()=>{
    const heights=WAREHOUSE_SITES.map(([x,z])=>warehouseHeight(x,z));
    expect(heights[0]).toBeLessThan(WAREHOUSE_WATER_LEVEL);
    expect(heights[1]).toBeGreaterThan(WAREHOUSE_WATER_LEVEL);
    expect(heights[2]).toBeGreaterThan(heights[1]+8);
  });
  it('connects all three storehouse loading aprons to the same three village lanes',()=>{
    WAREHOUSE_SITES.forEach(([x,z],i)=>{
      const routes=warehouseRoutes(i);expect(routes).toHaveLength(3);
      routes.forEach((route,j)=>{
        expect(route[0]).toEqual([x,z+5.7]);
        expect(route.at(-1)).toEqual([WAREHOUSE_TOWNS[j][0],WAREHOUSE_TOWNS[j][1]+3.3]);
        const sampled=sampleWarehouseRoute(route);expect(sampled[0]).toEqual(route[0]);expect(sampled.at(-1)).toEqual(route.at(-1));
        sampled.forEach(([a,c])=>expect(Number.isFinite(warehouseHeight(a,c))).toBe(true));
      });
    });
  });
  it('keeps the mountain detour longer without inventing journey times',()=>{
    const length=(route:number[][])=>route.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-route[i][0],p[1]-route[i][1]),0);
    for(let i=0;i<3;i++)expect(length(warehouseRoutes(2)[i])).toBeGreaterThan(length(warehouseRoutes(1)[i]));
  });
});

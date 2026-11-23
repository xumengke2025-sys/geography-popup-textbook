/** Marks are arrival events in the explanatory sequence. They are unrelated
 * to attainable supply, elapsed hours or transport speed. */
export const MARS_CIRCUITS = ['整体','再生水','气与食物','供电'] as const;
export const MARS_ARRIVALS: readonly (readonly (readonly [number,string])[])[]=[
  [],[[.31,'净化'],[.62,'储水'],[.94,'回供']],[[.30,'入植'],[.68,'供氧'],[.89,'供食']],[[.62,'接电']]
];

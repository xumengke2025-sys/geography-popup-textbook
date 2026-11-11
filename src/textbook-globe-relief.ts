import { THREE as T } from './reference/engine.js';
/** Shared, hand-authored coastline silhouettes from the existing habitable
 * teaching globe. Schematic, not a cartographic data set; no bitmap patches.
 * Subdividing before projection keeps triangle interiors above the ocean. */
export function globeLandRelief(radius: number, maxEdgeDegrees = 0) {
  const continents: [number, number][][] = [
    [[-17,36],[-7,37],[3,35],[13,33],[25,32],[34,29],[43,12],[51,11],[44,1],[40,-12],[34,-24],[19,-35],[12,-28],[9,-12],[1,5],[-10,6],[-17,15]],
    [[-10,36],[-10,44],[-1,49],[-5,56],[7,58],[11,69],[24,71],[34,62],[42,58],[55,64],[74,70],[100,76],[130,70],[160,60],[164,51],[142,44],[131,32],[121,24],[109,20],[103,3],[97,11],[86,20],[78,8],[70,23],[56,28],[48,30],[40,40],[29,42],[23,38],[16,42],[12,45],[3,43]],
    [[-81,12],[-70,11],[-58,6],[-49,-1],[-36,-6],[-42,-22],[-52,-33],[-67,-54],[-73,-46],[-71,-28],[-76,-11]],
    [[-167,65],[-150,70],[-128,71],[-111,69],[-95,72],[-78,60],[-57,53],[-63,46],[-80,26],[-87,15],[-98,18],[-109,31],[-124,43],[-133,56],[-151,59]],
    [[113,-22],[120,-18],[130,-12],[138,-17],[145,-15],[153,-26],[148,-38],[135,-35],[126,-34],[115,-35]],
    [[-52,60],[-44,61],[-24,72],[-26,82],[-47,83],[-62,76]],
    [[47,-13],[50,-17],[49,-25],[44,-24],[44,-18]],
  ];

  const positions: number[] = [];
  const point = ([lon, lat]: [number, number]) => {
    const a = (lon + 18) * Math.PI / 180, b = lat * Math.PI / 180, r = radius * 1.012;
    return [Math.sin(a) * Math.cos(b) * r, Math.sin(b) * r, Math.cos(a) * Math.cos(b) * r];
  };
  const subdivide = (a: [number, number], b: [number, number], c: [number, number], depth: number) => {
    // Book-size globes do not need four splits on already tiny coastline
    // triangles. Angular error, rather than projected object size, keeps the
    // entire triangle above the ocean while leaving the silhouette intact.
    if(maxEdgeDegrees>0&&depth>0){
      const vectors=[point(a),point(b),point(c)],limit=Math.cos(maxEdgeDegrees*Math.PI/180);
      const r2=(radius*1.012)**2;
      if(vectors.every((v,i)=>v.reduce((sum,n,k)=>sum+n*vectors[(i+1)%3][k],0)/r2>=limit))depth=0;
    }
    if (!depth) { positions.push(...point(a), ...point(b), ...point(c)); return; }
    const mid = (x: [number, number], y: [number, number]): [number, number] => [(x[0]+y[0])/2, (x[1]+y[1])/2];
    const ab=mid(a,b), bc=mid(b,c), ca=mid(c,a);
    subdivide(a,ab,ca,depth-1); subdivide(ab,b,bc,depth-1); subdivide(ca,bc,c,depth-1); subdivide(ab,bc,ca,depth-1);
  };
  for (const polygon of continents) for (const tri of T.ShapeUtils.triangulateShape(polygon.map(([x,y]) => new T.Vector2(x,y)), []))
    subdivide(polygon[tri[0]], polygon[tri[1]], polygon[tri[2]], maxEdgeDegrees>0?6:4);
  const normals = positions.slice();
  for (let i=0;i<normals.length;i+=3) {
    const r=Math.hypot(normals[i],normals[i+1],normals[i+2]);
    normals[i]/=r; normals[i+1]/=r; normals[i+2]/=r;
  }
  const geometry = new T.BufferGeometry(); geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3)); return geometry;
}

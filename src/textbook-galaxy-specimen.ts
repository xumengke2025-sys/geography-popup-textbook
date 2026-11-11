import { THREE as T } from './reference/engine.js';

/** Deterministic volumetric teaching specimen: dense bulge, thin stellar disk,
 * four spiral concentrations, sparse outskirts. Every grain is a small solid;
 * empty inter-arm space is genuinely open, without an opaque decorative plate.
 * Grain count, colours, positions and dimensions are illustrative, not data. */
export function galaxySpecimenGeometry(radius: number, radial = 28, angular = 112) {
  const count = Math.round(radial * angular * .47), positions: number[] = [], colors: number[] = [];
  const pale = new T.Color('#e5e2d1'), blue = new T.Color('#a9c0c1'), warm = new T.Color('#cdb786');
  const color = new T.Color();let seed=17539;
  const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  const points=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  const faces=[[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]];
  for(let i=0;i<count;i++){
    const bulge=i<count*.2;
    const q=bulge?Math.pow(random(),.65)*.24:.09+Math.pow(random(),.78)*.89;
    const spread=bulge?Math.PI*2:i%5===0?Math.PI*2:.23+q*.22;
    const angle=i%4*Math.PI/2+1.62*Math.log(q+.15)+(random()-.5)*spread;
    const diskHeight=radius*(.009+.085*Math.exp(-q*q/.045));
    const x=Math.cos(angle)*q*radius,y=Math.sin(angle)*q*radius*.72;
    const z=(random()+random()+random()-1.5)*diskHeight;
    const r=radius*(.007+.23/Math.sqrt(count))*(.48+random()*.88);
    color.copy(blue).lerp(pale,.45+random()*.55).lerp(warm,Math.exp(-q*q/.045)*.75);
    for(const face of faces)for(const index of face){
      const p=points[index];positions.push(x+p[0]*r,y+p[1]*r,z+p[2]*r);
      colors.push(color.r,color.g,color.b);
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();return geometry;
}

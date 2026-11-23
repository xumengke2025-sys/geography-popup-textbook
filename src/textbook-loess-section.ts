import { THREE as T } from './reference/engine.js';
import { applyEarthScan } from './textbook-earth-scan';
import { SLOPE_BOUNDARY_INDICES, SLOPE_GRID, slopeDisplayY } from './textbook-slope-model';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';

const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const bell=(q:number)=>Math.exp(-q*q);
const fraction=(n:number)=>n-Math.floor(n);
const hash=(n:number)=>fraction(Math.sin(18.93*n+4.71)*41935.79);

/** Finer vertical walls share the map's existing top rim. Their fissures,
 * silt and thin oxidised lenses are specimen-scale, independent of the
 * surveyed spot heights and the traced surface contours. */
export function mountLoessSection(b:TextbookGeometry, p:(coords:readonly number[])=>Vec3, scale:number) {
  const vertices:number[]=[],colors:number[]=[],indices:number[]=[],nodes:{t:number;elevation:number}[]=[];
  const levels=26;
  const pigment=new T.Color(),dust=new T.Color('#d1b27e'),russet=new T.Color('#a07b57'),crack=new T.Color('#685442');
  const border=SLOPE_BOUNDARY_INDICES.map(i=>SLOPE_GRID[i]);
  let distance=0;
  for(let edge=0;edge<border.length;edge++){
    const a=border[edge],end=border[(edge+1)%border.length],dx=end.x-a.x,dz=end.z-a.z;
    const length=Math.hypot(dx,dz), steps=Math.max(1,Math.ceil(length/.66)),nx=dz/length,nz=-dx/length;
    const base=nodes.length;
    for(let j=0;j<=steps;j++){
      const u=j/steps,x=a.x+dx*u,z=a.z+dz*u,d=distance+u*length;
      const e=a.elevationM+(end.elevationM-a.elevationM)*u;
      const corner=Math.min(1,Math.max(Math.min(x,100-x),Math.min(z,76.33-z))/.95);
      for(let row=0;row<=levels;row++){
        const t=row/levels, full=slopeDisplayY(e,1),h=t*full, fromCrown=full-h;
        const veinX=(d+(.07+.14*Math.sin(d*.076))*fromCrown+.45*Math.sin(h*.41+d*.068)) / 5.3;
        const cell=Math.floor(veinX),where=.22+.55*hash(cell);
        const width=.067+.060*hash(cell+81);
        const depthFraction=fromCrown/Math.max(full,.02);
        const reach=.28+.64*hash(cell+21);
        const opening=width*(1-.42*clamp(depthFraction/reach));
        const fracture=bell((fraction(veinX)-where)/opening)*clamp((reach-depthFraction)*5);
        const branch=bell((fraction(veinX)-where+.16+.06*fromCrown)/(.058+.023*hash(cell+2)))
          *bell((depthFraction-.23)/.15)*hash(cell+38);
        const fissure=Math.max(fracture*(.50+.50*hash(cell+173)),branch*.70);
        const silt=.5+.5*Math.sin(.56*d+.47*Math.sin(h*.61)+.27*Math.sin(d*1.9));
        const paleBed=bell((h-4.5-1.3*Math.sin(.092*d)-.44*Math.sin(.28*d))/.9)*clamp(.4+.67*Math.cos(.073*d));
        const crust=bell(fromCrown/(.68+.19*Math.cos(.38*d)));
        const rim=Math.sin(Math.PI*t)*Math.min(1,full*.25)*clamp(corner);
        const recess=rim*(.34*silt-.97*fissure+.08*Math.sin(h*1.58+.7*d));
        vertices.push(...p([x+nx*recess,0,z+nz*recess]));
        nodes.push({t,elevation:e});
        pigment.copy(dust).lerp(russet,.14+.14*silt+.49*paleBed+.26*crust).lerp(crack,.61*fissure+.12*crust);
        colors.push(pigment.r,pigment.g,pigment.b);
        if(j<steps&&row<levels){const k=base+j*(levels+1)+row;indices.push(k,k+1,k+levels+2,k,k+levels+2,k+levels+1);}
      }
    }
    distance+=length;
  }
  const geom=new T.BufferGeometry(),positions=new T.Float32BufferAttribute(vertices,3);
  geom.setAttribute('position',positions);geom.setAttribute('color',new T.Float32BufferAttribute(colors,3));geom.setIndex(indices);
  const mesh=b.mesh(geom,'#fffcf6',false,true,'land',{vertexColors:true});
  mesh.material.vertexColors=true;applyEarthScan(mesh.material,'loam',7.5*scale);
  mesh.userData.slopeRole='loess-cut-face';mesh.userData.landformDetail='黄土切壁竖向节理与粉砂团块';
  mesh.userData.modelInput={kind:'select',selection:1,label:'抬升黄土断面，对照中央与两侧的高度'};
  return (phase:number)=>{
    for(let i=0;i<nodes.length;i++)positions.setY(i,slopeDisplayY(nodes[i].elevation,phase)*nodes[i].t*scale);
    positions.needsUpdate=true;geom.computeVertexNormals();geom.computeBoundingSphere();
  };
}

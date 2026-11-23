import { THREE as T } from './reference/engine.js';
import coastlines from './assets/solar-instrument/coastlines.json';
import type { Vec3 } from './textbook-geometry';

/** Natural Earth 1:110m Land (public domain), from the instrument workshop's
 * simplified polygon stock. Subdivide in lon/lat before projecting so bays
 * and islands keep their outline and a long chord cannot sink into the sea. */
function continentalMesh() {
  const units:number[]=[], triangles:number[]=[], lookup=new Map<string,number>();
  function index([lon,lat]:number[]){
    const key=lon.toFixed(6)+','+lat.toFixed(6),stored=lookup.get(key);
    if(stored!==undefined)return stored;
    const a=lon*Math.PI/180,b=lat*Math.PI/180,id=units.length/3;
    units.push(Math.cos(b)*Math.sin(a),Math.sin(b),Math.cos(b)*Math.cos(a));lookup.set(key,id);return id;
  }
  function triangle(a:number[],b:number[],c:number[]){
    const corners=[a,b,c],lengths=corners.map((p,i)=>{
      const q=corners[(i+1)%3];return Math.hypot(p[1]-q[1],(p[0]-q[0])*Math.cos((p[1]+q[1])*Math.PI/360));
    });
    const edge=lengths.indexOf(Math.max(...lengths));
    if(lengths[edge]<=4.35){
      const ia=index(a),ib=index(b),ic=index(c);triangles.push(ia,ib,ic);return;
    }
    const p=corners[edge],q=corners[(edge+1)%3],r=corners[(edge+2)%3],m=[(p[0]+q[0])/2,(p[1]+q[1])/2];
    triangle(p,m,r);triangle(m,q,r);
  }
  for(const polygon of coastlines){
    const vertices=polygon.map(([x,y])=>new T.Vector2(x,y));
    for(const [a,b,c] of T.ShapeUtils.triangulateShape(vertices,[]))triangle(polygon[a],polygon[b],polygon[c]);
  }
  return {units,triangles};
}
let stock:ReturnType<typeof continentalMesh>|undefined;
export function geographicLand(radius:number,center:Vec3,nonIndexed=false){
  stock??=continentalMesh();
  const {units,triangles}=stock,positions=units.map((v,i)=>center[i%3]+radius*v);
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geo.setAttribute('normal',new T.Float32BufferAttribute(units,3));geo.setIndex(triangles);
  if(!nonIndexed)return geo;
  const expanded=geo.toNonIndexed();geo.dispose();return expanded;
}

/** The astronomical terminator is the plane n·s = 0. A short transition in
 * the painted finish keeps that boundary identifiable under the studio lights. */
export function paintSolarHemisphere(geo:any,sunward:Vec3,day:string,night:string){
  const normals=geo.attributes.normal,colors=new Float32Array(normals.count*3),tint=new T.Color();
  const bright=new T.Color(day),dark=new T.Color(night),sun=new T.Vector3(...sunward).normalize();
  for(let i=0;i<normals.count;i++){
    const x=normals.getX(i),y=normals.getY(i),z=normals.getZ(i);
    const incidence=x*sun.x+y*sun.y+z*sun.z;
    const lit=T.MathUtils.smoothstep(incidence,-.034,.052);
    const shade=(.9+.10*Math.max(0,incidence))*(1+.024*Math.sin(x*31+2*Math.cos(y*27))*Math.cos(z*37));
    tint.copy(dark).lerp(bright,lit).multiplyScalar(shade);colors[3*i]=tint.r;colors[3*i+1]=tint.g;colors[3*i+2]=tint.b;
  }
  geo.setAttribute('color',new T.BufferAttribute(colors,3));
}


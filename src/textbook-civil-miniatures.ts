import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';
import { chamferedPlateGeometry, mergeInstrumentGeometry } from './textbook-instrument-parts';
import type { SolidMaterialRole } from './textbook-solid-materials';
import { applyEarthScan, type EarthScan } from './textbook-earth-scan';

export const reliefRandom=(i:number,s:number)=>{const v=Math.sin(i*127.1+s*311.7+35.5)*43758.5453;return v-Math.floor(v);};
type Surface = {color:string;role:SolidMaterialRole;scan?:EarthScan};
const finishes:Record<string,Surface>={
  masonry:{color:'#b6a081',role:'rock',scan:'outcrop'}, plaster:{color:'#cebd9b',role:'rock'}, sill:{color:'#8c8270',role:'rock'},
  brick:{color:'#a86a4a',role:'rock',scan:'outcrop'}, slate:{color:'#505b57',role:'rock',scan:'outcrop'},
  tile:{color:'#925d4a',role:'rock'},glass:{color:'#536d69',role:'enamel'}, iron:{color:'#5c625c',role:'steel'},
  brass:{color:'#a9864e',role:'brass'},wood:{color:'#785c43',role:'wood'}, sack:{color:'#b9a177',role:'plant'},
  rubble:{color:'#8e8071',role:'rock',scan:'alluvium'},bank:{color:'#9e8c70',role:'rock',scan:'alluvium'},
  loam:{color:'#786348',role:'land',scan:'loam'}, leaf:{color:'#61754c',role:'plant',scan:'turf'},
  lightLeaf:{color:'#87905c',role:'plant',scan:'turf'}, steel:{color:'#9c9e92',role:'steel'},
  fieldstone:{color:'#a09a80',role:'rock',scan:'outcrop'},linen:{color:'#d0be9a',role:'plant'},
  casing:{color:'#384a3f',role:'enamel'},ochre:{color:'#ac7548',role:'rock'}, red:{color:'#a8583d',role:'enamel'},
};
export function civilMiniatures(b:TextbookGeometry,s:number,origin:Vec3) {
  const parts=new Map<string,any[]>();
  const put=(key:string,geo:any)=>{
    if(!parts.has(key))parts.set(key,[]);
    parts.get(key)!.push(geo);
  };
  const block=(key:string,at:Vec3,size:Vec3,angles:Vec3=[0,0,0],bevel=.07)=>{
    const g=chamferedPlateGeometry(size.map(v=>-v/2) as Vec3,size.map(v=>v/2) as Vec3,bevel);
    g.rotateX(angles[0]);g.rotateY(angles[1]);g.rotateZ(angles[2]);g.translate(...at);put(key,g);
  };
  const rod=(key:string,a:Vec3,c:Vec3,r:number,r2=r,sides=8)=>{
    const start=new T.Vector3(...a),end=new T.Vector3(...c),direction=end.clone().sub(start);
    const g=new T.CylinderGeometry(r2,r,direction.length(),sides);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize()));
    g.translate(...start.lerp(end,.5).toArray());put(key,g);
  };
  const stone=(key:string,at:Vec3,r:Vec3,seed:number,detail=0)=>{
    const g=new T.IcosahedronGeometry(1,detail),pos=g.attributes.position;
    for(let j=0;j<pos.count;j++){
      const x=pos.getX(j),y=pos.getY(j),z=pos.getZ(j),n=.8+.26*reliefRandom(Math.round(x*29+y*83+z*67),seed);
      pos.setXYZ(j,x*n*r[0],y*n*r[1],z*n*r[2]);
    }
    g.computeVertexNormals();g.rotateY(reliefRandom(seed,91)*6.28);g.translate(...at);put(key,g);
  };
  const tree=(x:number,y:number,z:number,h:number,seed:number)=>{
    rod('wood',[x,y,z],[x+.035*h,y+.73*h,z],.073*h,.039*h);
    for(let j=0;j<4;j++){
      const a=j*2.4+seed,r=(j===3?.08:.18)*h,xx=x+r*Math.cos(a),zz=z+r*Math.sin(a),yy=y+h*(j===3?.85:.69);
      rod('wood',[x,y+.43*h,z],[xx,yy,zz],.037*h,.019*h,6);
      stone(j%2?'leaf':'lightLeaf',[xx,yy,zz],[.26*h,.28*h,.24*h],seed*19+j,1);
    }
  };
  const house=(x:number,y:number,z:number,w:number,h:number,depth:number,heading:number,roofKey='tile')=>{
    const ca=Math.cos(heading),sa=Math.sin(heading);
    const pt=(dx:number,dy:number,dz:number):Vec3=>[x+ca*dx+sa*dz,y+dy,z-sa*dx+ca*dz];
    const box=(key:string,dx:number,dy:number,dz:number,size:Vec3)=>block(key,pt(dx,dy,dz),size,[0,heading,0]);
    box('masonry',0,.23,0,[w+.36,.46,depth+.3]);box('plaster',0,.47+h/2,0,[w,h,depth]);
    const ridge=h+.48+w*.19,g=new T.Shape();g.moveTo(-w*.565,-w*.215);g.lineTo(0,0);g.lineTo(w*.565,-w*.215);g.lineTo(w*.565,-w*.266);g.lineTo(0,-w*.053);g.lineTo(-w*.565,-w*.266);g.closePath();
    const roof=new T.ExtrudeGeometry(g,{depth:depth+.52,bevelEnabled:false});
    roof.translate(0,0,-(depth+.52)/2);roof.rotateY(heading);roof.translate(...pt(0,ridge,0));put(roofKey,roof);
    const end=new T.Shape();end.moveTo(-w*.49,0);end.lineTo(0,.18*w);end.lineTo(w*.49,0);end.closePath();
    const gable=new T.ExtrudeGeometry(end,{depth:depth,bevelEnabled:false});gable.translate(0,0,-depth/2);gable.rotateY(heading);gable.translate(...pt(0,h+.44,0));put('plaster',gable);
    rod(roofKey,pt(0,ridge+.012,-depth/2-.29),pt(0,ridge+.012,depth/2+.29),.095);
    for(const side of [-1,1]){
      box('glass',w*.28*side,h*.61+.45,depth*.505,[w*.19,h*.32,.13]);
      box('sill',w*.28*side,h*.45+.45,depth*.518,[w*.22,.13,.19]);
    }
    box('wood',0,h*.3+.45,depth*.512,[w*.19,h*.6,.15]);
    box('brick',-.3*w,ridge-.03,-.23*depth,[.4,.9,.43]);
  };
  const flush=(name:string)=>{
    const meshes:any[]=[];
    for(const [key,shapes] of parts){
      const f=finishes[key];const geometry=mergeInstrumentGeometry(shapes);
      geometry.scale(s,s,s).translate(...origin);
      const mesh=b.mesh(geometry,f.color,false,true,f.role);mesh.name=name+'-'+key;
      if(f.scan)applyEarthScan(mesh.material,f.scan,9*s);
      meshes.push(mesh);
    }
    parts.clear();return meshes;
  };
  return {put,block,rod,stone,tree,house,flush};
}
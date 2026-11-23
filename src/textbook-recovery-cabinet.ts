import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry,Vec3 } from './textbook-geometry';
import { turnedShaftGeometry,mergeInstrumentGeometry } from './textbook-instrument-parts';
import { applyEarthScan } from './textbook-earth-scan';
import { civilMiniatures, reliefRandom as random } from './textbook-civil-miniatures';
import { RECOVERY_STOPS,type RecoveryPoint } from './textbook-recovery-model';

export function recoveryMiniatures(b:TextbookGeometry,s:number,origin:Vec3){
  const k=civilMiniatures(b,s,origin);
  // Retained floor fragments, exposed bars and masonry lose their common
  // plane around the collapsed frame; the responders occupy the clear margin.
  const debrisRise=(x:number,z:number)=>{
    const ellipse=((x-24)/21)**2+((z-36)/27)**2;
    const taper=Math.max(0,1-ellipse);
    return taper*(3.15+.82*Math.sin(x*.48+z*.19)+.66*Math.cos(z*.64-x*.25)+.40*Math.sin(x*.97+z*.88));
  };
  const mound:number[]=[],moundColors:number[]=[],mi:number[]=[],mc=42,mr=52;
  for(let j=0;j<=mr;j++)for(let i=0;i<=mc;i++){
    const x=4.3+41*i/mc,z=8.5+55*j/mr;const rise=debrisRise(x,z);
    mound.push(x,1.90+rise,z);
    const tone=new T.Color('#95856f').lerp(new T.Color('#8a7b68'),Math.min(1,rise*.47));moundColors.push(tone.r,tone.g,tone.b);
    if(i===mc||j===mr||rise<.12)continue;
    const n=j*(mc+1)+i;mi.push(n,n+mc+1,n+1,n+1,n+mc+1,n+mc+2);
  }
  const moundGeo=new T.BufferGeometry();moundGeo.setAttribute('position',new T.Float32BufferAttribute(mound,3));moundGeo.setIndex(mi);moundGeo.computeVertexNormals();moundGeo.setAttribute('color',new T.Float32BufferAttribute(moundColors,3));moundGeo.scale(s,s,s).translate(...origin);
  const debris=b.mesh(moundGeo,'#ffffff',false,true,'land');debris.material.vertexColors=true;debris.name='graded-rubble-bed';applyEarthScan(debris.material,'alluvium',13*s);
  for(let i=0;i<700;i++){
    const a=random(i,17)*Math.PI*2,rad=Math.sqrt(random(i,22));
    const x=24+17.5*rad*Math.cos(a),z=36+23.5*rad*Math.sin(a),r=.20+1.28*random(i,24)**2;
    const key=i%6===0?'brick':i%4===0?'fieldstone':'rubble';
    k.stone(key,[x,2.06+debrisRise(x,z)+r*.24,z],[r*1.28,r*.49,r*.76],i);
  }
  for(let i=0;i<28;i++){
    const x=12+random(i,5)*19,z=23+random(i,6)*25,y=2.05+debrisRise(x,z)+random(i,19)*.42;
    k.block(i%4===0?'wood':'brick',[x,y,z],[1.9+random(i,7)*2.1,.49+random(i,8)*.38,1.05],[random(i,14)*.29,random(i,13)*6,random(i,32)*.24]);
  }
  for(let i=0;i<13;i++){
    const x=16+random(i,74)*18,z=25+random(i,77)*23;
    k.block('rubble',[x,2.65+debrisRise(x,z),z],[3.8+random(i,31)*4.6,.65+random(i,78)*.63,2.2+random(i,79)*2.8],[random(i,81)*.45,random(i,82)*6.28,(random(i,83)-.5)*.68]);
  }
  for(let j=0;j<9;j++)for(let i=0;i<6;i++){
    if((i===2||i===3)&&j>2&&j<7||i+j>11)continue;
    k.block(i%3===0?'rubble':'brick',[11.4+i*1.71+(j%2)*.72,2.47+j*.87,21.25],[1.63,.85,1.19],[.025,.03,.015]);
  }
  for(let course=0;course<5;course++)for(let i=0;i<8-course;i++){
    const x=9.4+i*1.64+(course%2)*.63,z=35.6+(i%2)*.07;
    k.block(i%4?'brick':'rubble',[x,2.45+course*.78,z],[1.54,.73,1.17],[0,random(i,course)*.09,0]);
  }
  for(let i=0;i<7;i++){
    const x=15+i*1.57,z=24.2+(i%2)*.22,y=16.86-(x-18.4)*.35,a:Vec3=[x,y,z],mid:Vec3=[x+.3,y+1.15,z+.95],end:Vec3=[x+1.08,y+1.56,z+1.62];
    k.rod('iron',a,mid,.078);k.rod('iron',mid,end,.077);
  }
  // Collapsed masonry still contains mortar joints and broken window jambs.
  k.block('rubble',[29.2,4.0,34.9],[9.7,.37,6.2],[.17,-.23,.14]);
  for(let i=0;i<9;i++){const x=17+i*1.08;k.block('fieldstone',[x,5.95+(x-21)*.22,43.8],[.87,.31,.43],[.14,-.2,.13]);}
  // Supplies are retained as crated loads and banded rolls. The open shelter
  // contains a cot and folded linens instead of an undifferentiated block.
  for(const [x,z,y] of [[71,15,6],[79,15,6],[87,15,6],[75,22,5],[84,22,5]]){
    for(const dx of [-2.5,2.5]){
      k.block('wood',[x+dx,y,z+2.56],[.48,5.32,.25]);
      k.block('iron',[x+dx,y+2.79,z],[.23,.15,5.19]);}
    for(let j=0;j<3;j++)k.block('wood',[x,y-1.72+j*1.51,z+2.53],[6.35,.105,.12]);
  }
  for(let j=0;j<7;j++){
    const x=68.7+(j%4)*2.43,z=20.1+(j>3?2.9:0),y=3.79+(j>3?.06:0);
    k.rod('linen',[x-1.02,y,z],[x+1.02,y,z],.64,.68,14);
    for(const xx of [x-.61,x+.61]) k.rod('wood',[xx-.075,y,z],[xx+.075,y,z],.70,.70,14);
  }
  for(const z of [54.1,56.8])k.rod('steel',[68.9,4.73,z],[79.7,4.73,z],.15,.15,10);
  for(const x of [70.0,78.6]){k.rod('iron',[x-.53,3.0,54.35],[x+.53,4.72,56.7],.13);k.rod('iron',[x+.53,3.0,56.7],[x-.53,4.72,54.35],.13);}
  k.block('linen',[74.3,4.78,55.45],[9.3,.29,2.49]);k.block('sack',[70.97,5.02,55.45],[1.62,.25,2.4]);
  for(let i=0;i<5;i++)k.block('linen',[72.1+(i%3)*1.45,8.67+(i>2?.44:0),49],[1.39,.41,1.69]);
  for(const x of [65.1,86.9])for(const z of [43.8,58.1])k.rod('linen',[x,15.8,z],[x+(x<76?-2.7:2.7),2.25,z+(z<51?-1.1:1.1)],.061);
  const rescue=[debris,...k.flush('yushu-support')];
  // The new town keeps an ordinary connected street fabric. The open court is
  // observable between the residential blocks and the public-service building.
  for(const [i,x,z] of [[0,22,20],[1,38,20],[2,22,48],[3,38,48],[4,77,47],[5,78,59]]){
    const h=i%2?11.8:13.2,eave=h+2;
    for(const side of [-1,1]){
      for(let a=0;a<3;a++){
        const zz=z-2.8+a*2.77,xx=x+side*5.56;
        for(const yy of [6.9,11.2]){
          k.block('glass',[xx,yy,zz],[.22,1.64,1.45]);k.block('sill',[xx+side*.06,yy-.89,zz],[.34,.14,1.67]);}
      }
      for(let j=0;j<10;j++){
        const zz=z-5.03+j*1.12;
        k.rod('tile',[x,eave+3.68,zz],[x+side*6.11,eave+.17,zz],.09,.09,7);
      }
    }
    k.rod('tile',[x,eave+3.74,z-5.25],[x,eave+3.74,z+5.25],.21,.21,10);
    for(let j=0;j<3;j++){const yy=3.2+j*3.6;k.block('sill',[x,yy,z+4.58],[10.94,.16,.32]);}
    k.block('wood',[x+.15,5.96,z+4.97],[2.57,.24,1.08]);
    k.block('masonry',[x+.12,2.25,z+5.14],[2.57,.35,1.13]);
  }
  for(const x of [49.3,60.6])for(const z of [47.0,55.0]){
    k.block('wood',[x,3.47,z],[3.0,.24,.8]);for(const dx of [-.97,.97])k.block('sill',[x+dx,3.12,z],[.26,.51,.57]);
  }
  for(let i=0;i<10;i++){
    const x=47.6+i*1.64;k.block('sill',[x,3.023,51],[.064,.09,15.3]);
    const z=43.67+i*1.64;k.block('sill',[55,3.035,z],[15.3,.09,.063]);
  }
  for(const x of [13.8,88.15]){k.block('masonry',[x,2.46,37],[.36,.34,58.4]);}
  for(const z of [33.59,38.47])k.block('masonry',[51,2.43,z],[72.3,.28,.37]);
  for(let j=0;j<8;j++){
    const z=11.2+j*6.9;k.block('sill',[11,2.412,z],[.14,.04,2.21]);
    k.block('sill',[91,2.412,z],[.14,.04,2.21]);
  }
  for(const x of [62.3,83.55]){k.block('sill',[x,3.87,30.15],[1.46,.34,2.8]);}
  k.block('sill',[73,9.75,30.4],[22.0,.55,2.06]);k.block('plaster',[73,10.16,30.4],[22.45,.28,2.42]);
  for(let i=0;i<7;i++){
    const x=62.73+i*3.46;k.block('glass',[x,16.16,28.60],[2.09,1.42,.19]);
    k.block('sill',[x,15.39,28.70],[2.28,.13,.36]);
  }
  return [rescue,k.flush('beichuan-streets')];
}

export const recoveryPlateAt:RecoveryPoint=[50,-2.65,76.56];
export function recoveryCabinet(b:TextbookGeometry,s:number,p:(at:RecoveryPoint)=>Vec3){
  const k=civilMiniatures(b,s,p([0,0,0]));
  k.block('wood',[50,-5.95,39.8],[97,10.9,72.5],[0,0,0],1);
  k.block('brass',[50,-.43,39.8],[96.6,.45,71.94],[0,0,0],.16);
  k.block('casing',[50,-.10,39.8],[95.9,.38,71.31],[0,0,0],.15);
  for(const x of [8,92])for(const z of [9,70]){
    k.block('wood',[x,-12.08,z],[6.8,1.4,5.2],[0,0,0],.46);
    k.block('brass',[x,-12.84,z],[6.5,.26,4.9]);}
  k.block('brass',[50,-2.65,76.17],[42.3,10.08,.44],[0,0,0],.28);
  k.block('linen',[50,-2.65,76.42],[39.8,9.32,.15],[0,0,0],.11);
  for(const x of [29.51,70.49])for(const y of [-7.08,1.78])k.rod('brass',[x,y,76.36],[x,y,76.76],.23,.17,12);
  k.block('wood',[50,-10.09,79.88],[85.4,1.7,8.68],[0,0,0],.27);
  for(const x of [11,89])k.block('brass',[x,-8.96,82.13],[2,1.2,3.59]);
  k.rod('iron',[12,-9.05,82],[88,-9.05,82],.27);k.rod('brass',[12,-9.05,84.05],[88,-9.05,84.05],.2);
  for(let i=0;i<=24;i++){const x=12+76*i/24;k.rod('brass',[x,-9.23,79.25],[x,-9.23,i%12?79.96:80.73],.073);}
  k.block('casing',[6.4,-4.55,75.85],[3.46,7.4,3.86],[0,0,0],.37);
  k.rod('brass',[6.4,-2.24,74.63],[6.4,-2.24,82.32],.78,.69,16);
  k.block('casing',[93.4,2.72,69],[3.6,1.15,3.6],[0,0,0],.32);
  k.rod('brass',[93.4,3.17,69],[93.4,11.8,69],.55,.39,16);
  k.rod('brass',[93.4,10.8,69],[93.4,11.7,69],.82,.82,16);
  k.flush('recovery-case-cabinet');
  const r=4.03,at=p([6.4,-2.24,82.5]);
  const wheel=new T.TorusGeometry(r*s,.39*s,10,48),parts:any[]=[wheel];
  for(let i=0;i<3;i++){const t=Math.PI*2*i/3;
    parts.push(turnedShaftGeometry([0,0,0],[r*s*Math.cos(t),r*s*Math.sin(t),0],[[.48*s,0],[.39*s,.26],[.21*s,.75],[.3*s,1]]));}
  parts.push(turnedShaftGeometry([0,0,-.45*s],[0,0,.71*s],[[.81*s,0],[.97*s,.19],[.97*s,.73],[.65*s,1]]));
  const frame=b.mesh(mergeInstrumentGeometry(parts),'#aa8c53',false,true,'brass');
  frame.name='observation-capstan';frame.position.set(...at);
  const grip=b.mesh(turnedShaftGeometry([0,-r*s,.1*s],[0,-r*s,1.97*s],[[.48*s,0],[.36*s,.24],[.64*s,.72],[.40*s,1]]),'#755536',false,true,'wood');
  grip.name='observation-capstan-grip';grip.position.set(...at);
  const dial={center:[at[0],at[1],at[2]+1.88*s] as Vec3,radiusX:r*s,radiusY:r*s,turns:1};
  for(const m of [frame,grip]){m.userData.modelInput={kind:'phase-dial',dial,label:'摇动观察轮，依次查看当前案例的三个观察位置'};m.userData.interactionFeedback=false;}
  grip.userData.smallPointTarget=true;
  const axis=p([93.4,11.4,69]),up=new T.Vector3(0,1,0);
  const outer=b.mesh(new T.CylinderGeometry(.32*s,.4*s,1,12),'#a18a60',false,true,'brass');
  const inner=b.mesh(new T.CylinderGeometry(.218*s,.218*s,1,12),'#8d9993',false,true,'steel');
  outer.name='reader-telescoping-sleeve';inner.name='reader-moving-stem';outer.raycast=inner.raycast=()=>{};
  const align=(mesh:any,a:any,c:any)=>{const direction=c.clone().sub(a);mesh.scale.y=direction.length();mesh.quaternion.setFromUnitVectors(up,direction.normalize());mesh.position.copy(a).lerp(c,.5);};
  const pointers=RECOVERY_STOPS.map((_,caseIndex)=>{
    const g=new T.TorusGeometry(3.25*s,.22*s,8,48);g.rotateX(-Math.PI*.23);
    const marker=b.mesh(g,'#b89754',false,true,'brass');marker.name='specimen-viewfinder';
    marker.raycast=()=>{};marker.userData.caseForPointer=caseIndex;return marker;
  });
  return (phase:number,selected:number,focus:RecoveryPoint)=>{
    frame.rotation.z=grip.rotation.z=phase*Math.PI*2;
    const u=Math.min(1,phase*2),v=Math.max(0,phase*2-1),ease=(q:number)=>q*q*(3-2*q);
    const offsets=selected?[4.4,6.3,1.2]:[3,7.8,2.9];
    const y=focus[1]+offsets[0]+(offsets[1]-offsets[0])*ease(u)+(offsets[2]-offsets[1])*ease(v);
    const center=p([focus[0],y,focus[2]+6.15]);
    for(const [i,m] of pointers.entries()){m.visible=i===selected;m.position.set(...(m.visible?center:[0,0,0] as Vec3));}
    const start=new T.Vector3(...axis),tip=new T.Vector3(...center);tip.x+=3.2*s;
    const collar=start.clone().lerp(tip,.43);align(outer,start,collar);align(inner,collar,tip);
  };
}
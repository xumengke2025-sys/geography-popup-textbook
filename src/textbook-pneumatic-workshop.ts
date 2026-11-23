import { THREE as T } from './reference/engine.js';
import { chamferedPlateGeometry, castBodyGeometry, turnedShaftGeometry, turnedSleeveGeometry, mergeInstrumentGeometry } from './textbook-instrument-parts';
import { createSpecimenMaterial, type SolidMaterialRole } from './textbook-solid-materials';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';
import type { ModelInput } from './textbook-model-input';

const finishes={
  brass:['brass','#a2864e'],gold:['brass','#b79960'],bronze:['brass','#866b46'],iron:['enamel','#344b43'],
  steel:['steel','#63726f'],blue:['enamel','#446c75'],wood:['wood','#644733'],walnut:['wood','#4a382c'],
  porcelain:['ivory','#e8dfc5'],ink:['enamel','#444b40'],red:['enamel','#92533b'],slate:['rock','#65716f'],
} as const;
type Finish=keyof typeof finishes;
type Profile=readonly(readonly[number,number])[];
export function pneumaticWorkshop(b:TextbookGeometry,s:number,back:number){
  const p=(x:number,y:number,z:number):Vec3=>[x*s,y*s,back+z*s];
  const mesh=(g:any,finish:Finish,name:string)=>{
    const [role,color]=finishes[finish];const m=b.mesh(g,color,false,true,role as SolidMaterialRole);
    m.name=name;m.userData.pneumaticPart=name;return m;
  };
  const map=(v:Vec3):Vec3=>p(...v);
  const shaftGeo=(a:Vec3,c:Vec3,profile:Profile)=>turnedShaftGeometry(map(a),map(c),profile.map(([r,q])=>[r*s,q]));
  const turn=(a:Vec3,c:Vec3,profile:Profile,f:Finish,name:string)=>mesh(shaftGeo(a,c,profile),f,name);
  const collar=(a:Vec3,c:Vec3,r:number,bore:number,f:Finish,name:string)=>
    mesh(turnedSleeveGeometry(map(a),map(c),[[r*.96*s,0],[r*s,.14],[r*s,.78],[r*.95*s,1]],bore*s),f,name);
  const box=(a:Vec3,c:Vec3,f:Finish,name:string,r=.16)=>mesh(chamferedPlateGeometry(map(a),map(c),r*s),f,name);
  const tubes=(lines:Vec3[][],radius:number,finish:Finish,name:string)=>{
    const shapes=lines.map(line=>new T.TubeGeometry(new T.CatmullRomCurve3(line.map(v=>new T.Vector3(...p(...v)))),Math.max(10,line.length*4),radius*s,9,false));
    return mesh(mergeInstrumentGeometry(shapes),finish,name);
  };
  const glassMaterial=createSpecimenMaterial(b.pop,{color:'#97bcb5',role:'water'});
  glassMaterial.opacity=.10;glassMaterial.transparent=true;glassMaterial.depthWrite=false;glassMaterial.roughness=.13;
  glassMaterial.metalness=.10;glassMaterial.side=T.DoubleSide;glassMaterial.forceSinglePass=true;
  glassMaterial.userData.materialRole='historical-glass';const compile=glassMaterial.onBeforeCompile,key=glassMaterial.customProgramCacheKey();
  glassMaterial.onBeforeCompile=(shader:any,r:any)=>{
    compile.call(glassMaterial,shader,r);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`float pneumaticFresnel=pow(1.-clamp(abs(dot(normalize(normal),normalize(vViewPosition))),0.,1.),2.2);
      diffuseColor.a*=.52+3.25*pneumaticFresnel;
#include <opaque_fragment>`);
  };
  glassMaterial.customProgramCacheKey=()=>key+':pneumatic-optical-edge';
  const glass=(g:any,name:string)=>{
    const m=b.mesh(g,'#98b9b4',false,false,'water');m.material=glassMaterial;
    m.castShadow=m.receiveShadow=false;m.userData.castShadow=false;m.name=name;m.userData.pneumaticPart=name;
    m.raycast=()=>{};m.renderOrder=4;return m;
  };
  const glassTube=(a:Vec3,c:Vec3,r:number,name:string)=>{
    const av=new T.Vector3(...p(...a)),cv=new T.Vector3(...p(...c)),axis=cv.clone().sub(av);
    const g=new T.CylinderGeometry(r*s,r*s,axis.length(),60,1,true);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),axis.normalize()));
    g.translate(...av.add(cv).multiplyScalar(.5).toArray());return glass(g,name);
  };
  const bed=(x0:number,x1:number,z0:number,z1:number)=>{
    mesh(castBodyGeometry(p(x0,-4.2,z0),p(x1,-1.0,z1),.75*s),'wood','实木榫接台座');
    box([x0+.14,-3.7,z0+.14],[x1-.14,-3.41,z1-.14],'bronze','台座下口细镶线',.12);
    for(const x of [x0+1.42,x1-1.42])for(const z of [z0+1.42,z1-1.42]){
      turn([x,.013,z],[x,.21,z],[[.43,0],[.47,.38],[.38,1]],'brass','台板埋头钉');
      tubes([[[x-.22,.22,z-.12],[x+.22,.22,z+.12]]],.041,'ink','台板螺钉直槽');
    }
    box([x0+.21,-1.13,z0+.21],[x1-.21,-.61,z1-.21],'gold','铜护角压线',.22);
    box([x0+.49,-.61,z0+.49],[x1-.49,.02,z1-.49],'iron','烤漆嵌板',.23);
    for(const x of [x0+5.3,x1-5.3])for(const z of [z0+4.2,z1-4.2])turn([x,-5.7,z],[x,-4.08,z],[[1.8,0],[2.05,.13],[2.05,.25],[1.47,.64],[1.47,1]],'bronze','调平台脚');
  };
  const plaque=(text:string,at:Vec3,w:number,h:number,angle:number,input?:ModelInput)=>{
    const anchor=p(...at);
    const surface=(wid:number,hei:number,z0:number,z1:number,finish:Finish)=>{
      const g=chamferedPlateGeometry([-wid*s/2,-hei*s/2,z0*s],[wid*s/2,hei*s/2,z1*s],.14*s);
      g.rotateX(angle);g.translate(...anchor);return mesh(g,finish,'瓷牌·'+text);
    };
    const frame=surface(w+.65,h+.61,-.52,.02,'brass'),face=surface(w,h,.04,.28,'porcelain');
    const normal=[0,-Math.sin(angle),Math.cos(angle)],place=anchor.map((v,i)=>v+.34*s*normal[i]) as Vec3;
    const ink=b.label(text,place,(w-.22)*s,(h-.25)*s,{appearance:'engraved',ink:'#474334'});ink.rotation.x=angle;ink.userData.labelMount='surface';ink.name=text+'·瓷面铭文';
    for(const obj of [frame,face,ink])if(input){obj.userData.modelInput=input;obj.userData.smallPointTarget=true;}
    return {objects:[frame,face,ink],ink,show(visible:boolean){for(const m of [frame,face,ink])m.visible=visible;}};
  };
  return {p,mesh,box,turn,collar,tubes,glass,glassTube,glassMaterial,bed,plaque,shaftGeo};
}

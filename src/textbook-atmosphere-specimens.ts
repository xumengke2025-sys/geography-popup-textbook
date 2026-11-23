import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';
import { applyEarthScan } from './textbook-earth-scan';
import { estuaryLandmarks, mountFieldInstrument } from './textbook-field-instruments';
import { phaseTrackPoint } from './textbook-model-input';

type PaintedMesh=InstanceType<typeof T.Mesh>;
function named(groups:Map<string,PaintedMesh[]>,key:string) {
  const part=groups.get(key);
  if(!part) throw Error('Missing authored atmospheric specimen part '+key);
  return part;
}
function select(meshes:PaintedMesh[],selection:number,label:string,keepPhase:boolean) {
  for(const mesh of meshes) mesh.userData.modelInput={kind:'select',selection,label,keepPhase};
}

/** Both specimen drawers use the same model-space track as their established
 * page control. Every piece of the carriage translates together on its rails. */
function drawer(b:TextbookGeometry,groups:Map<string,PaintedMesh[]>,s:number,label:string) {
  const track={start:b.p(.15,1.14,3*s),end:b.p(.85,1.14,3*s)};
  const carriage=named(groups,'cursor');
  for(const mesh of carriage) {
    mesh.geometry.translate(-track.start[0],-track.start[1],-track.start[2]);
    mesh.userData.modelInput={kind:'phase-track',track,label};
    mesh.userData.smallPointTarget=true;
  }
  return (phase:number)=>{const at=phaseTrackPoint(phase,track);carriage.forEach(m=>m.position.set(...at));};
}

export function mountHeatingBench(b:TextbookGeometry,s:number,origin:Vec3) {
  const parts=mountFieldInstrument(b,'heating',s,origin);
  const labels=['太阳短波','地面增温','地面长波','大气吸收'];
  const keys=labels.map((label,i)=>{
    const key=named(parts,'key'+i);
    select(key,i,'定位到'+label,false);
    return key;
  });
  select(named(parts,'lamp'),0,'查看太阳短波从光源发出',false);
  select(named(parts,'receiver'),1,'查看同一地面吸收短波',false);
  select(named(parts,'probe'),3,'查看近地面大气吸收长波',false);
  const [ground]=named(parts,'sample-surface');
  select([ground],1,'观察土样吸收短波并升温',false);
  ground.userData.airProcessRole='ground-volume';
  for(const m of [ground,...named(parts,'heat-bed')]){
    if(!Array.isArray(m.material)&&!m.material.userData.earthScan)applyEarthScan(m.material,'loam',8*s);
  }
  return {ground,setHeatingStage:(stage:number)=>keys.forEach((key,i)=>key.forEach(m=>{m.position.y=(stage===i?-.21:0)*s;}))};
}

export function mountRadiationReceiver(b:TextbookGeometry,s:number) {
  const groups=mountFieldInstrument(b,'greenhouse',s,b.p(0,.50),b.height/100);
  const vacant=named(groups,'empty'), medium=named(groups,'medium');
  select(vacant,1,'装上大气观察抽板',true);
  for(const mesh of medium) mesh.userData.modelInput={kind:'select',selection:2,toggleTo:1,keepPhase:true,label:'切换大气与低云试样'};
  const advance=drawer(b,groups,s,'推拉辐射观察尺，比较当前介质的热量去向');
  return (phase:number,selection:number)=>{
    advance(phase);
    vacant.forEach(m=>{m.visible=selection===0;});
    medium.forEach(m=>{m.visible=selection!==0;});
  };
}

export function mountEstuarySpecimen(b:TextbookGeometry,s:number) {
  const groups=mountFieldInstrument(b,'external-spheres',s,b.p(0,.50),b.height/100),specimen=estuaryLandmarks();
  const at=(val:readonly number[])=>b.p(val[0]/100,.50+val[2]/100,val[1]*s);
  const covers=['圈层联系','水的迁移','生物联系'].map((caption,i)=>{
    const meshes=named(groups,'key'+i);
    select(meshes,i,'切换至'+caption,true);
    return meshes;
  });
  const ground=named(groups,'landform'),shore=named(groups,'cutwall'),sea=named(groups,'estuary');
  const tree=named(groups,'tree'),leaves=tree.filter(m=>m.geometry.hasAttribute('color'));
  const clouds=named(groups,'cloud'),cloudAt=at([49,36,20]);
  select([...ground,...shore],0,'观察同一地景中的圈层联系',true);
  select([...clouds,...sea],1,'追踪降水、径流与海水蒸发',true);
  select([...tree,...named(groups,'roots')],2,'追踪根吸水与叶片蒸腾',true);
  for(const m of shore){
    if(!Array.isArray(m.material)&&!m.material.userData.earthScan)applyEarthScan(m.material,'outcrop',15*s);
  }
  for(const m of clouds){
    m.geometry.translate(-cloudAt[0],-cloudAt[1],-cloudAt[2]);m.position.set(...cloudAt);
  }
  const slide=drawer(b,groups,s,'推拉物质示踪尺，追踪同一批水');
  return {ground,sea,leaves,clouds,cloudAt,river:specimen.river.map(at),treeAt:at(specimen.treeBase),
    canopy:at(specimen.canopy),soilAt:at(specimen.soilAt),
    update(phase:number,selected:number,cloudResponse:number,leafResponse:number) {
      slide(phase);clouds.forEach(mesh=>{mesh.scale.setScalar(.88+.12*cloudResponse);});
      covers.forEach((set,i)=>set.forEach(m=>{m.position.y=(i===selected?-.20:0)*s;}));
      // Vertex pigmentation supplies the small crown shadows. The leaf
      // response is a gentle local tint, separate from the permanent forest.
      leaves.forEach(mesh=>{const material=mesh.material;if(!Array.isArray(material)&&'color' in material)
        (material as InstanceType<typeof T.MeshStandardMaterial>).color.setRGB(1-.13*leafResponse,1,1-.10*leafResponse);});
    }};
}

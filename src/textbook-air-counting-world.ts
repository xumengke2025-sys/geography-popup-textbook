import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { AIR_VAPOR_FRAME, evaluateAirComposition } from './textbook-air-composition-model';
import { chamferedPlateGeometry, createInstrumentParts, mergeInstrumentGeometry } from './textbook-instrument-parts';
import type { SolidMaterialRole } from './textbook-solid-materials';

/** An open counting instrument, not a chemical separation apparatus. The
 * ceramic inlays count volume fractions, never molecules. The two independent
 * observation frames hold symbolic tracers, not captured visible water gas. */
export function buildAirCountingWorld(b: TextbookGeometry): ModelMotion {
  const s=b.width/100, back=-LIFT_MARGIN-b.height*.48;
  const p=(x:number,y:number,z:number):Vec3=>[x*s,y*s,back+z*s];
  const parts=createInstrumentParts(b);
  const mount=(geometry:any,color:string,role:SolidMaterialRole,name:string)=>{
    const mesh=b.mesh(geometry,color,false,true,role);
    mesh.name=name;mesh.userData.airCountingPart=name;return mesh;
  };
  const plate=(a:Vec3,c:Vec3,color:string,role:SolidMaterialRole,name:string)=>
    mount(chamferedPlateGeometry(a,c,.14*s),color,role,name);
  const select=(mesh:any,value:number)=>{
    mesh.userData.modelInput={kind:'replay',selection:value,label:value?'观察水汽与杂质示踪':'查看干洁空气体积分数'};
    mesh.userData.interactionFeedback=false;return mesh;
  };
  // The one low bed carries both yokes and the independent observation bay.
  plate(p(4,1.1,-13),p(98,3.4,20),'#544534','wood','continuous-timber-bed');
  plate(p(4.6,3.4,-12.4),p(97.4,3.75,19.4),'#a88b50','brass','thin-bed-reveal');
  plate(p(5.1,3.75,-11.9),p(96.9,4.6,18.9),'#293e35','enamel','fitted-iron-bed');
  for(const x of [9,58,91])for(const z of [-8,14]){
    parts.bearing(p(x,1.2,z),[0,1,0],1.1*s,1.8*s);
  }
  // A slightly inclined panel is held at its actual transverse trunnion.
  // Every mesh is directly registered on b.root, so the rigid-part reveal
  // sees the whole instrument; there is no scaled hidden parent assembly.
  const angle=-Math.PI/10, panelY=12, panelZ=8, panelMeshes:any[]=[];
  const panelPoint=(x:number,y:number,z:number):Vec3=>p(x,panelY+y*Math.cos(angle)-z*Math.sin(angle),panelZ+y*Math.sin(angle)+z*Math.cos(angle));
  const panelMesh=(a:Vec3,c:Vec3,color:string,role:SolidMaterialRole,name:string)=>{
    const g=chamferedPlateGeometry(a.map(n=>n*s) as Vec3,c.map(n=>n*s) as Vec3,.12*s);
    g.rotateX(angle);g.translate(0,panelY*s,back+panelZ*s);
    const m=mount(g,color,role,name);panelMeshes.push(m);return m;
  };
  const pivot=panelPoint(0,19,-1.2);
  for(const x of [8,60]){
    plate(p(x-2.3,4.6,-3.8),p(x+2.3,6.2,7),'#293e35','enamel','yoke-foot');
    plate(p(x-1.15,6.2,-1.4),p(x+1.15,pivot[1]/s,2.4),'#293e35','enamel','load-bearing-yoke');
    parts.bearing([x*s,pivot[1],pivot[2]],[1,0,0],1.9*s,3.8*s);
    parts.shaft([(x-2.2)*s,pivot[1],pivot[2]],[(x+2.2)*s,pivot[1],pivot[2]],.55*s);
  }
  const tiltKnob=parts.knob([63*s,pivot[1],pivot[2]],[1,0,0],2.2*s,1.6*s);
  const knobMeshes:any[]=[];
  tiltKnob.traverse((m:any)=>{if(m.isMesh){
    m.userData.modelInput={kind:'inspect',target:'counting-face',toggleTo:'overview',label:'转动铰轴，调整计数板角度'};
    m.userData.interactionFeedback=false;knobMeshes.push(m);
  }});
  knobMeshes.forEach(m=>{b.root.add(m);panelMeshes.push(m)});
  // Back, narrow rim and recessed ceramic field. The brass is an edge reveal,
  // rather than a large gold slab competing with the scientific content.
  panelMesh([9,0,-1.7],[59,49,-.6],'#293e35','enamel','counting-panel-back');
  panelMesh([9.5,.5,-.6],[58.5,48.5,-.28],'#a88b50','brass','counting-panel-edge');
  select(panelMesh([10,1,-.28],[58,48,.1],'#e3ddc9','ivory','ceramic-counting-field'),0);
  panelMesh([12,8,.12],[56,45,.32],'#354b44','enamel','recessed-hundred-cell-bed');
  const cellGroups:any[][]=[[],[],[]];
  for(let i=0;i<100;i++){
    const col=i%10,row=Math.floor(i/10),x=12.9+col*4.25,y=41.1-row*3.55;
    const g=chamferedPlateGeometry([x*s,y*s,.32*s],[(x+3.8)*s,(y+3.12)*s,.86*s],.13*s);
    g.rotateX(angle);g.translate(0,panelY*s,back+panelZ*s);cellGroups[i<78?0:i<99?1:2].push(g);
  }
  ['#87abb0','#be8c69','#b7a06a'].forEach((color,i)=>{
    const mesh=select(mount(mergeInstrumentGeometry(cellGroups[i]),color,'enamel','counted-ceramic-inlays'),0);
    mesh.userData.dryAirSpecies=['nitrogen','oxygen','other'][i];
    mesh.userData.volumeCellCount=[78,21,1][i];
    panelMeshes.push(mesh);
  });
  // Text is attached to the panel and shares its inclination, not a set of
  // floating billboard labels. Font textures contain text only.
  const label=(text:string,at:Vec3,w:number,h:number,tilted=false)=>{
    const m=b.label(text,at,w*s,h*s,{appearance:'engraved'});m.userData.airCountingPart='attached-nameplate';
    m.userData.labelMount='surface';
    if(tilted){m.rotation.x=angle;panelMeshes.push(m)}return m;
  };
  label('氮 78%   氧 21%   其他 1%',panelPoint(34,4.4,.98),43,4.7,true);
  label('100格 · 体积分数',panelPoint(34,46.4,.98),32,3.1,true);
  // Two small open sample frames: fixed rear contrast, actual edge thickness,
  // short feet, and separate symbols. They never enter the fixed 100 cells.
  const vapor:any[]=[],dust:any[]=[],extras:any[]=[];
  const template=evaluateAirComposition(0,1);
  for(const [index,x] of [73,90].entries()){
    for(const dx of [-5.8,5.8]){
      plate(p(x+dx-.75,4.6,-2.5),p(x+dx+.75,6.1,6.5),'#293e35','enamel','observation-frame-foot');
      plate(p(x+dx-.45,6.1,.2),p(x+dx+.45,39,1.2),'#a88b50','brass','observation-frame-jamb');
    }
    select(plate(p(x-6.3,17.5,-.5),p(x+6.3,38.8,.3),'#e3ddc9','ivory','observation-contrast-back'),1);
    for(const yy of [17.4,38.8])plate(p(x-6.6,yy,.25),p(x+6.6,yy+.65,1.7),'#a88b50','brass','observation-frame-crossbar');
    // The inscription belongs to the ivory lower crosspiece, not the air.
    plate(p(x-6.3,10.5,.3),p(x+6.3,15.3,1),'#e3ddc9','ivory','observation-name-strip');
    label(index?'杂质':'水汽不可见',p(x,12.9,1.04),index?10:12,3.1);
    const control=parts.knob(p(x,6.5,9),[0,1,0],1.7*s,1.1*s);
    control.traverse((m:any)=>{if(m.isMesh)select(m,1)});
  }
  const shape=new T.Shape();
  AIR_VAPOR_FRAME.outer.forEach(([x,y],i)=>i?shape.lineTo(x*s,y*s):shape.moveTo(x*s,y*s));shape.closePath();
  const hole=new T.Path();
  [...AIR_VAPOR_FRAME.outer].reverse().forEach(([x,y],i)=>i?hole.lineTo(x*s*AIR_VAPOR_FRAME.innerRatio,y*s*AIR_VAPOR_FRAME.innerRatio):hole.moveTo(x*s*AIR_VAPOR_FRAME.innerRatio,y*s*AIR_VAPOR_FRAME.innerRatio));
  hole.closePath();shape.holes.push(hole);
  for(const mark of template.vapor){
    const g=new T.ExtrudeGeometry(shape,{depth:.32*s,bevelEnabled:false});
    const mesh=select(mount(g,'#759da8','enamel','water-vapor-symbol'),1);
    mesh.userData.compositionSymbol='water-vapor-tracer';mesh.userData.symbolId=mark.id;vapor.push(mesh);extras.push(mesh);
  }
  for(const mark of template.impurities){
    const mesh=select(mount(new T.BoxGeometry(.85*s,.85*s,.7*s),'#66594a','rock','impurity-symbol'),1);
    mesh.userData.compositionSymbol='impurity-grain';mesh.userData.symbolId=mark.id;dust.push(mesh);extras.push(mesh);
  }
  parts.fasteners([p(8,4.66,15),p(60,4.66,15),p(94,4.66,15)],[0,1,0],.48*s);
  const poses=panelMeshes.map(mesh=>({mesh,position:mesh.position.clone(),quaternion:mesh.quaternion.clone()}));
  const axisPoint=new T.Vector3(34*s,pivot[1],pivot[2]);
  const rotation=new T.Quaternion(),axis=new T.Vector3(1,0,0),position=new T.Vector3();
  let state=evaluateAirComposition(0),inspection='overview',tilt=0,tiltFrom=0,tiltStart=-Infinity;
  const setTilt=(value:number)=>{
    tilt=value;rotation.setFromAxisAngle(axis,tilt);
    for(const pose of poses){
      position.copy(pose.position).sub(axisPoint).applyQuaternion(rotation).add(axisPoint);
      pose.mesh.position.copy(position);pose.mesh.quaternion.copy(rotation).multiply(pose.quaternion);
    }
  };
  return {update(phase,selection,_dt,reduced){
    state=evaluateAirComposition(phase,selection);extras.forEach(m=>m.visible=!!state.selected);
    state.vapor.forEach((m,i)=>vapor[i].position.set(...p(73+m.x*4.4,28+m.y*7.2,1.65)));
    state.impurities.forEach((m,i)=>dust[i].position.set(...p(90+m.x*3.2,28+m.y*6.1,1.65)));
    const target=inspection==='counting-face'?-.35:0;
    // Scientific playback deliberately supplies dt=0 when paused. A manual
    // hinge adjustment is a separate presentation transition, like a camera
    // move; it must remain responsive while the scientific phase is frozen.
    const q=Math.max(0,Math.min(1,(performance.now()-tiltStart)/450)),ease=q*q*(3-2*q);
    setTilt(reduced?target:tiltFrom+(target-tiltFrom)*ease);
  },describe:()=>({kind:'air-composition',dryAirVolumeCells:{nitrogen:78,oxygen:21,other:1},selected:state.selected,
    cellsAreMolecules:false,waterAndDustVariable:true,dryAirBelowKm:25,...state.reference,
    vaporTracerCount:state.vapor.length,impuritySymbolCount:state.impurities.length,sharedFlatState:true,
    construction:'trunnion-supported-counting-panel',illustrativeInstrument:true,inspection,tilt}),
  inspect(target){tiltFrom=tilt;tiltStart=performance.now();inspection=target==='counting-face'?target:'overview';},
  inspectTargets:()=>[{target:'counting-face',label:'转动计数板'}],
  focusBounds:()=>({min:p(3,-.8,-24),max:p(99,60,21)})};
}

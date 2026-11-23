import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { AIR_VAPOR_FRAME, evaluateAirComposition } from './textbook-air-composition-model';
import { chamferedPlateGeometry, createInstrumentParts, mergeInstrumentGeometry, turnedShaftGeometry, turnedSleeveGeometry } from './textbook-instrument-parts';
import { createSpecimenMaterial, type SolidMaterialRole } from './textbook-solid-materials';

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
    mesh.userData.modelInput={kind:'select',keepPhase:true,selection:value,label:value?'观察水汽与杂质示踪':'查看干洁空气体积分数'};
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
  // A walnut abacus hangs in its trunnions. Every vitreous counter occupies
  // one equal share, independent of the amount actually drawn by the aspirator.
  for(const x of [9.2,56.9]){
    panelMesh([x,0,-1.9],[x+1.95,52,1.52],'#674832','wood','walnut-abacus-stile');
    panelMesh([x+.17,.25,1.52],[x+.50,51.77,1.68],'#967142','brass','ebony-inlaid-bead');
  }
  for(const [y,h] of [[0,8.1],[44.65,7.34]]){
    panelMesh([10.4,y,-1.75],[58.2,y+h,1.42],'#654630','wood','walnut-abacus-rail');
    panelMesh([11,y+.45,1.42],[57.5,y+h-.45,1.58],'#e4dbc3','ivory','ceramic-legend-strip');
  }
  const panelShape=(g:any,color:string,role:SolidMaterialRole,name:string)=>{
    g.rotateX(angle);g.translate(0,panelY*s,back+panelZ*s);
    const m=mount(g,color,role,name);panelMeshes.push(m);return m;
  };
  const rods=[],cellGroups:any[][]=[[],[],[]];
  for(let row=0;row<10;row++){
    const y=(42.2-row*3.55)*s;
    rods.push(turnedShaftGeometry([10.6*s,y,0],[57.3*s,y,0],[[.24*s,0],[.24*s,1]]));
    for(let col=0;col<10;col++){
      const i=row*10+col,x=(12.64+col*4.51)*s;
      const bead=turnedShaftGeometry([x-1.72*s,y,0],[x+1.72*s,y,0],
        [[.51*s,0],[.78*s,.06],[1.34*s,.25],[1.50*s,.40],[1.50*s,.61],[1.34*s,.76],[.78*s,.94],[.51*s,1]]);
      const g=bead.toNonIndexed();bead.dispose();g.rotateX(angle);g.translate(0,panelY*s,back+panelZ*s);cellGroups[i<78?0:i<99?1:2].push(g);
    }
  }
  panelShape(mergeInstrumentGeometry(rods),'#7c7861','brass','ten-spindles');
  const cellColors=['#87abb0','#be8c69','#b7a06a'];
  cellColors.forEach((color,i)=>{
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
  // Each fraction carries a short inlay fired in the same colour as its cells.
  const legend=[{text:'氮78%',x:17.3,width:13.9},{text:'氧21%',x:32.4,width:14.3},{text:'其他1%',x:49,width:17.5}];
  legend.forEach(({text,x,width},i)=>{
    label(text,panelPoint(x,4.9,1.7),width,6.2,true);
    panelMesh([x-width*.31,1.42,1.65],[x+width*.31,1.9,1.79],cellColors[i],'enamel','fraction-colour-key');
  });
  label('百格体积分数',panelPoint(34,48.0,1.69),36,5.5,true);
  // Two small open sample frames: fixed rear contrast, actual edge thickness,
  // short feet, and separate symbols. They never enter the fixed 100 cells.
  const vapor:any[]=[],dust:any[]=[],extras:any[]=[];
  const template=evaluateAirComposition(0,1);
  const glass=createSpecimenMaterial(b.pop??{},{color:'#9bbab0',role:'water'});
  glass.opacity=.14;glass.roughness=.11;glass.depthWrite=false;glass.userData.materialRole='historical-glass';
  const turn=(x:number,y0:number,y1:number,z:number,profile:readonly(readonly[number,number])[],color:string,role:SolidMaterialRole,name:string)=>
    mount(turnedShaftGeometry(p(x,y0,z),p(x,y1,z),profile.map(([r,v])=>[r*s,v])) ,color,role,name);
  const cups:any[]=[];
  for(const [index,x] of [73,90].entries()){
    turn(x,4.62,16.85,0,[[4.75,0],[5.95,.05],[5.90,.15],[3.72,.29],[2.60,.62],[3.33,.77],[6.33,.91],[6.40,1]],'#806443','brass','turned-sample-holder');
    const shell=new T.CylinderGeometry(6.23*s,6.23*s,21.05*s,48,1,true);shell.translate(...p(x,27.22,0));
    const window=mount(shell,'#9cbdb4','water','glass-observation-vessel');window.material=glass;window.raycast=()=>{};window.castShadow=false;window.renderOrder=4;
    select(plate(p(x-5.92,17.64,-3.85),p(x+5.92,37.30,-3.54),'#ddd6bd','ivory','observation-contrast-back'),1);
    for(const y of [16.75,37.52]){
      const r=turnedSleeveGeometry(p(x,y,0),p(x,y+1.16,0),[[6.31*s,0],[6.58*s,.20],[6.58*s,.78],[6.31*s,1]],5.87*s);
      cups.push(select(mount(r,'#a18552','brass','spun-vessel-lip'),1));
    }
    const lid=turn(x,38.65,40.54,0,[[6.35,0],[6.42,.16],[5.89,.41],[3.46,.7],[1.31,1]],'#866e48','brass','sampling-cap');cups.push(select(lid,1));
    for(const z of [-4.4,4.6])for(const dx of [-4.7,4.7])
      turn(x+dx,17.65,37.88,z,[[.31,0],[.15,.04],[.15,.96],[.31,1]],'#7f7762','brass','bell-jar-stay');
    plate(p(x-7.82,9.38,7.9),p(x+7.82,16.61,8.61),'#755f41','brass','nameplate-bezel');
    select(plate(p(x-7.53,9.65,8.61),p(x+7.53,16.35,8.77),'#ded5b8','ivory','porcelain-nameplate'),1);
    const note=label(index?'杂质':'水汽不可见',p(x,13.03,8.87),15.03,index?5.85:4.67);select(note,1);
  }
  // A sample enters the observation bay when the plunger is withdrawn. The
  // rods at left always keep the dry-air denominator fixed at one hundred.
  const pipe=mount(new T.TubeGeometry(new T.CatmullRomCurve3([[73,40.5,0],[73,43,0],[81.5,44,0],[90,43,0],[90,40.5,0]].map(v=>new T.Vector3(...p(v[0],v[1],v[2])))),28,.36*s,9,false),'#97784d','brass','sample-header-pipe');
  select(pipe,1);
  const intake=mount(new T.TubeGeometry(new T.CatmullRomCurve3([[81.5,44,0],[83,42,-4],[83,17,-7],[81.5,8.2,-4],[76,8.2,10]].map(v=>new T.Vector3(...p(v[0],v[1],v[2])))),38,.45*s,10,false),'#8c754f','brass','aspirator-air-line');select(intake,1);
  const cylinder=mount(turnedSleeveGeometry(p(65,8.2,12.4),p(81,8.2,12.4),[[2.58*s,0],[2.94*s,.05],[2.40*s,.12],[2.40*s,.83],[2.85*s,.9],[2.7*s,1]],1.12*s),'#aa895a','brass','aspirator-barrel');select(cylinder,1);
  const pump=[mount(turnedShaftGeometry(p(73,8.2,12.4),p(84,8.2,12.4),[[.61*s,0],[.61*s,1]]),'#898c83','steel','draw-rod'),
    mount(turnedShaftGeometry(p(83.5,8.2,12.4),p(87.5,8.2,12.4),[[1.44*s,0],[1.96*s,.26],[2.13*s,.66],[1.43*s,1]]),'#654630','wood','wooden-sample-grip')];
  for(const mesh of pump){mesh.userData.modelInput={kind:'select',selection:1,toggleTo:0,keepPhase:true,label:'抽取或退回比较样本'};mesh.userData.smallPointTarget=true;}
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
    state=evaluateAirComposition(phase,selection);for(const m of pump)m.position.x=state.selected*8.2*s;glass.depthWrite=false;extras.forEach(m=>m.visible=!!state.selected);
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
    construction:'trunnion-supported-counting-panel',illustrativeInstrument:true,samplerTravel:state.selected*8.2,sampleVessels:2,inspection,tilt}),
  inspect(target){tiltFrom=tilt;tiltStart=performance.now();inspection=target==='counting-face'?target:'overview';},
  inspectTargets:()=>[{target:'counting-face',label:'转动计数板'}],
  focusBounds:()=>({min:p(3,-.8,-24),max:p(99,60,21)})};
}

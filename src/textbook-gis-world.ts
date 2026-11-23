import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { GIS_COUNTS, GIS_REGIONS, GIS_REFERENCE, evaluateGis, type GisPoint } from './textbook-gis-model';
import { chamferedPlateGeometry, turnedShaftGeometry, turnedSleeveGeometry, mergeInstrumentGeometry } from './textbook-instrument-parts';
import { gisComparator } from './textbook-gis-comparator';
import type { SolidMaterialRole } from './textbook-solid-materials';

/** A registration instrument, not a surveying machine. Its two original map
 * layers retain a common coordinate system; the open rails explain how the
 * sheets approach without crossing either map or its 33 station identities. */
export function buildGisWorld(b: TextbookGeometry): ModelMotion {
  const scale=b.width/100, back=-LIFT_MARGIN-75*scale, rise=40*scale;
  b.root.position.set(0,rise,-8*scale);
  const p=(x:number,y:number,z:number):Vec3=>[x*scale,y*scale,back+z*scale];
  const moveComparator=gisComparator(b,scale,p);
  const point=([u,v]:GisPoint,y=0,z=0):Vec3=>p(7+u*86,y,v*54+z);
  const footprint=(path:readonly GisPoint[])=>path.map(q=>{const c=point(q);return[c[0],c[2]]as[number,number]});
  const border:readonly GisPoint[]=[[0,0],[1,0],[1,1],[0,1]];
  let inspection='overview';
  const tag=(mesh:any,role:string)=>{mesh.userData.gisRole=role;return mesh};
  const inspectRegion=(mesh:any,region:number)=>{
    mesh.userData.modelInput={kind:'inspect',target:`region-${region-1}`,toggleTo:'overview',label:`观察${region}区及所属雨量站`};
    mesh.userData.interactionFeedback=false;return mesh;
  };
  const plate=(a:Vec3,c:Vec3,color:string,material:SolidMaterialRole,role:string)=>
    tag(b.mesh(chamferedPlateGeometry(a,c,.08*scale),color,false,true,material),role);
  const rod=(a:Vec3,c:Vec3,r:number,color:string,material:SolidMaterialRole,role:string)=>
    tag(b.mesh(turnedShaftGeometry(a,c,[[r*.8,0],[r,.035],[r,.965],[r*.8,1]]),color,false,true,material),role);
  const bars=(boxes:[Vec3,Vec3][],color:string,material:SolidMaterialRole,role:string)=>
    tag(b.mesh(mergeInstrumentGeometry(boxes.map(([a,c])=>chamferedPlateGeometry(a,c,.07*scale))),color,false,true,material),role);
  const enamel='#293e35',brass='#a88b50',steel='#929b98';

  // Two small runners, rather than a slab below the entire diagram. The tall
  // rear seats and diagonal rails lie OUTSIDE x=7..93, the moving map field.
  const feet:[Vec3,Vec3][]=[],seats:[Vec3,Vec3][]=[];
  for(const x of[3,97]){
    feet.push([p(x-1.7,.2,-15),p(x+1.7,1.6,93)]);
    seats.push([p(x-1.35,1.6,-14.2),p(x+1.35,37.6,-11.8)]);
    rod(p(x,37,-12),p(x,4.8,0),.46*scale,steel,'steel','external-registration-guide');
    rod(p(x,3,0),p(x,3,12),.44*scale,steel,'steel','lower-slide-rail');
    for(const z of[-12.6,90.5])rod(p(x,1.6,z),p(x,1.84,z),.72*scale,brass,'brass','flush-runner-fastener');
  }
  bars(feet,enamel,'enamel','paired-open-runners');bars(seats,enamel,'enamel','rear-guide-seats');
  // This cross member is a useful process control, not a third information
  // layer. Dragging its carriage seeks the very same scientific phase.
  plate(p(2.2,1.55,87.6),p(97.8,2.4,92.2),enamel,'enamel','timeline-crossmember');
  rod(p(9,2.9,90),p(91,2.9,90),.38*scale,steel,'steel','phase-control-rail');
  const track={start:p(9,3.2,90),end:p(91,3.2,90)};
  const handle=plate(p(-2.4,-.75,-1.7),p(2.4,.75,1.7),brass,'brass','phase-carriage');
  // Geometry above was authored with p() for the common map origin; this one
  // local carriage instead centres its geometry and moves along a root track.
  handle.geometry.translate(0,0,-back);
  handle.userData.modelInput={kind:'phase-track',track,label:'拖动滑柄，对位图层并逐区统计'};
  handle.userData.interactionFeedback=false;
  const tickBoxes:[Vec3,Vec3][]=[];
  for(let i=0;i<=20;i++)tickBoxes.push([p(9+i*4.1,2.41,88),p(9.13+i*4.1,2.44,i%5===0?89.1:88.65)]);
  bars(tickBoxes,brass,'brass','uncalibrated-process-ticks');

  // Both carriers are thin sheet frames, with a narrow brass reveal. All
  // hardware is individually registered at b.root for the rigid page reveal.
  const carrier=(name:string)=>{
    const outer=bars([[p(5.4,-.26,-1.6),p(94.6,.25,-.35)],[p(5.4,-.26,54.35),p(94.6,.25,55.6)],
      [p(5.4,-.26,-.35),p(6.65,.25,54.35)],[p(93.35,-.26,-.35),p(94.6,.25,54.35)]],enamel,'enamel',`${name}-thin-frame`);
    const reveal=bars([[p(6.5,.18,-.34),p(93.5,.3,0)],[p(6.5,.18,54),p(93.5,.3,54.34)]],brass,'brass',`${name}-edge-reveal`);
    // Bored carriages follow the scientific layer axes, rather than solid
    // blocks pierced by a nearby rail. Bridges attach at the sleeve wall.
    const lugs=bars([[p(3.7,-.55,-.6),p(6.2,.25,.6)],[p(93.8,-.55,-.6),p(96.3,.25,.6)]],brass,'brass',`${name}-registration-lugs`);
    const axis=new T.Vector3(0,name==='station'?-32.2:0,12).normalize();
    const sleeves=tag(b.mesh(mergeInstrumentGeometry([3,97].map(x=>{
      const center=new T.Vector3(...p(x,0,0)),half=axis.clone().multiplyScalar(1.35*scale);
      return turnedSleeveGeometry(center.clone().sub(half).toArray() as Vec3,center.clone().add(half).toArray() as Vec3,
        [[.86*scale,0],[.92*scale,.12],[.74*scale,.24],[.74*scale,.76],[.92*scale,.88],[.86*scale,1]],.49*scale);
    })),brass,false,true,'brass'),`${name}-bored-carriages`);
    // Two register pins on the lower frame enter bored eyes on the upper
    // frame. Both sit outside the printed map and share its moving origin.
    const pins:any[]=[];
    for(const x of [13,87]){
      const z=57.1;
      pins.push(chamferedPlateGeometry(p(x-1.08,-.24,54.8),p(x+1.08,.24,z-.8),.15*scale));
      if(name==='administrative'){
        pins.push(turnedShaftGeometry(p(x,-.23,z),p(x,2.57,z),[
          [1.62*scale,0],[1.77*scale,.08],[1.77*scale,.17],[.91*scale,.23],
          [.91*scale,.66],[.78*scale,.76],[.21*scale,1]]));
      }else{
        pins.push(turnedSleeveGeometry(p(x,-.35,z),p(x,.84,z),[
          [1.57*scale,0],[1.86*scale,.15],[1.86*scale,.63],[1.58*scale,1]],1.30*scale));
      }
    }
    const registers=tag(b.mesh(mergeInstrumentGeometry(pins),brass,false,true,'brass'),`${name}-registration-datums`);
    return[outer,reveal,lugs,sleeves,registers];
  };
  const lowerParts=carrier('administrative'),upperParts=carrier('station');
  const base=tag(b.prism(footprint(border),0,.3*scale,'#e2d8c3',false),'region-paper');base.renderOrder=1;
  const regions=GIS_REGIONS.map(region=>{
    const mesh=b.prism(footprint(region.polygon),.3*scale,.55*scale,region.color,false);
    mesh.material=b.materialFor('enamel',region.color);mesh.renderOrder=2;
    tag(mesh,'administrative-region');mesh.userData.region=region.id;inspectRegion(mesh,region.id);return{region,mesh};
  });
  const sheet=tag(b.prism(footprint(border),0,.28*scale,'#e8e9dd',false),'station-vellum');
  const vellum=b.pop.paper({color:'#edf0e7',ink:'#6c7c75',hatch:.025,shade:.02,spacing:2.3,seed:17});
  vellum.side=T.DoubleSide;vellum.transparent=true;vellum.depthWrite=false;
  const compileVellum=vellum.onBeforeCompile;
  vellum.onBeforeCompile=(shader:any,renderer:any)=>{compileVellum.call(vellum,shader,renderer);shader.fragmentShader=shader.fragmentShader.replace('gl_FragColor.a = uSurfAlpha;','gl_FragColor.a = uSurfAlpha * opacity;')};
  vellum.customProgramCacheKey=()=> 'gis-tracing-sheet-opacity-v1';
  sheet.material=vellum;sheet.renderOrder=3;sheet.raycast=()=>{};
  const profile=[[0,-.12],[.50,-.1],[.68,.1],[.70,.37],[.50,.8],[.16,1.38],[0,1.50]].map(([r,y])=>new T.Vector2(r*scale,y*scale));
  const dropGeometry=new T.LatheGeometry(profile,24),neutral=b.materialFor('enamel','#648d9d');
  const stationMaterials=GIS_REGIONS.map(region=>b.materialFor('enamel',region.stationColor));
  const stations=evaluateGis(0).stations.map(station=>{
    const mesh=tag(b.mesh(dropGeometry,'#648d9d',false),'rain-station');mesh.renderOrder=4;
    mesh.userData.stationId=station.id;mesh.userData.region=station.region;if(station.region!==null)inspectRegion(mesh,station.region);return{station,mesh};
  });
  const stationSettings=evaluateGis(0).stations.map(station=>turnedSleeveGeometry(
    point(station.point,.29),point(station.point,.60),[[.84*scale,0],[.90*scale,.24],[.84*scale,.85],[.75*scale,1]],.46*scale));
  upperParts.push(tag(b.mesh(mergeInstrumentGeometry(stationSettings),brass,false,true,'brass'),'brass-station-settings'));
  // These inscriptions are fixed to actual lips and sockets. They never turn
  // into free billboard cards as the maps approach one another.
  const inscription=(text:string,at:Vec3,w:number,h:number,role:string)=>{
    const m=tag(b.label(text,at,w*scale,h*scale,{appearance:'engraved'}),role);
    m.userData.labelMount='surface';m.rotation.x=-Math.PI/2;m.renderOrder=5;return m;
  };
  const regionCodes=GIS_REGIONS.map(region=>inspectRegion(inscription(String(region.id),point(region.label,1),11.4,11.4,'region-code'),region.id));
  // Offset index tabs stay attached to the back edges. Sloping each tab
  // towards the reader keeps its face legible when the carriers meet.
  const tabAngle=-.67, tabY=3.75;
  const titleTab=(text:string,x:number,z:number,role:string,parts:any[])=>{
    const geom=chamferedPlateGeometry([-12*scale,-4.55*scale,-.26*scale],[12*scale,4.55*scale,.26*scale],.14*scale);
    geom.rotateX(tabAngle);geom.translate(...p(x,tabY,z));
    const lip=tag(b.mesh(geom,'#e3ddc9',false,true,'ivory'),role+'-name-lip');parts.push(lip);
    const label=inscription(text,p(x,tabY,z),21.9,8.55,role+'-title');
    label.rotation.x=tabAngle;
    return {label,lip,x,z};
  };
  const stationTab=titleTab('雨量站',83,-.35,'station',upperParts);
  const regionTab=titleTab('行政区',-4,35,'region',lowerParts);
  const countBed=plate(p(7,-.2,57),p(93,.65,64.8),enamel,'enamel','result-counter-bed');lowerParts.push(countBed);
  const counts=GIS_REGIONS.map((region,i)=>{
    const x=21+i*29;
    const slope = .42, centerZ = 62.2, front = 65.9, rear = 58.5;
    const faceHeight = (z:number) => .74 + (front-z)*slope;
    const block = chamferedPlateGeometry(p(x-12,.65,rear),p(x+12,1.05,front),.07*scale);
    const vertices = block.attributes.position;
    for(let j=0;j<vertices.count;j++){
      const z = (vertices.getZ(j)-back)/scale;
      const fraction = (vertices.getY(j)/scale-.65)/.4;
      vertices.setY(j,(.65+fraction*(faceHeight(z)-.65))*scale);
    }
    block.computeVertexNormals();
    const socket=inspectRegion(tag(b.mesh(block,'#e3ddc9',false,true,'ivory'),'count-socket'),region.id);
    socket.userData.region=region.id;lowerParts.push(socket);
    const labelY=faceHeight(centerZ)+.12;
    const label=inspectRegion(inscription(`${region.id}区 —`,p(x,labelY,centerZ),24,7.25,'derived-count'),region.id);
    label.rotation.x+=Math.atan(slope);
    label.userData.region=region.id;return{label,value:-2,x,labelY,centerZ};
  });
  const setCount=(entry:typeof counts[number],region:number,count:number|null)=>{
    const next=count??-1;if(entry.value===next)return;entry.value=next;
    const label=entry.label,text=`${region}区 ${count??'—'}`,canvas=label.material.map.image as HTMLCanvasElement,ctx=canvas.getContext('2d')!;
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#303a40';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font=`500 ${Math.floor(canvas.height*.69)}px FieldSans,Microsoft YaHei,sans-serif`;ctx.fillText(text,canvas.width/2,canvas.height*.53);
    label.material.map.needsUpdate=true;label.userData.text=text;
  };
  let state=evaluateGis(0);
  return{
    inspect(target){if(target==='overview'||/^region-[012]$/.test(target))inspection=target},
    inspectTargets:()=>[{target:'overview',label:'整体'},...GIS_REGIONS.map(region=>({target:`region-${region.id-1}`,label:`${region.id}区`}))],
    update(phase){
      state=evaluateGis(phase);moveComparator(state);const inspectedRegion=inspection==='overview'?null:Number(inspection.slice(-1))+1;
      const lower=state.layers.regions,upper=state.layers.stations;
      base.position.set(0,lower.y*scale,lower.z*scale);
      lowerParts.forEach(m=>m.position.set(0,lower.y*scale,lower.z*scale));upperParts.forEach(m=>m.position.set(0,upper.y*scale,upper.z*scale));
      handle.position.set(...track.start.map((v,i)=>v+(track.end[i]-v)*state.phase));
      regions.forEach(({region,mesh})=>{
        mesh.position.set(0,lower.y*scale,lower.z*scale);
        b.contour(region.polygon.map(q=>point(q,lower.y+.62,lower.z)).concat([point(region.polygon[0],lower.y+.62,lower.z)]),inspectedRegion===region.id?1.05:state.activeRegion===region.id?.72:.28);
      });
      sheet.position.set(0,upper.y*scale,upper.z*scale);vellum.opacity=state.vellumOpacity;
      stations.forEach(({mesh},i)=>{
        const station=state.stations[i];mesh.position.set(...point(station.point,upper.y+.62,upper.z));
        mesh.material=station.counted&&station.region!==null?stationMaterials[station.region-1]:neutral;
        const inspected=inspectedRegion!==null && inspectedRegion===station.region,pulse=Math.sin(station.match*Math.PI),r=1+pulse*.28+(inspected?.2:0);
        mesh.scale.set(r,1+pulse*.18,r);
        if(pulse>.01||inspected){const c=point(station.point,upper.y+.7,upper.z);b.contour(Array.from({length:25},(_,k):Vec3=>{const a=k/24*Math.PI*2,rr=(1.4+pulse*.35)*scale;return[c[0]+Math.cos(a)*rr,c[1],c[2]+Math.sin(a)*rr]}),inspected?.78:.7)}
      });
      regionCodes.forEach((label,i)=>{label.visible=state.phase<.4;label.position.set(...point(GIS_REGIONS[i].label,lower.y+.65,lower.z))});
      for(const [tab,layer] of [[stationTab,upper],[regionTab,lower]] as const){
        tab.label.position.set(...p(tab.x,layer.y+tabY-.31*Math.sin(tabAngle),layer.z+tab.z+.31*Math.cos(tabAngle)));
      }
      counts.forEach((entry,i)=>{entry.label.position.set(...p(entry.x,lower.y+entry.labelY,lower.z+entry.centerZ));setCount(entry,state.counts[i].id,state.counts[i].visible?state.counts[i].count:null)});
    },
    focusBounds:()=>({min:p(-17,-1,-21),max:p(102,44,97)}),
    describe:()=>({kind:'gis-spatial-overlay',phase:state.phase,stage:state.stage,assembled:state.overlay>=.999,inspection,
      source:GIS_REFERENCE,geometricLayers:2,stationMeshCount:stations.length,oneStationSet:true,
      counts:state.counts.map(r=>({region:r.id,count:r.count})),derivedTotals:GIS_COUNTS,membershipMethod:'point-in-polygon',activeRegion:state.activeRegion,
      resultReady:state.resultReady,originalPagePreserved:true,measuredGeographicData:false,elevatedAbovePage:rise,
      registrationRig:{openFrame:true,mapThickness:.55,stationSheetThickness:.28,guideXs:[3,97],mapXRange:[7,93],
        guidesOutsideMapSweep:true,sharedLayerCoordinates:true,stationIds:stations.map(s=>s.station.id),
        directPhaseTrack:track,handlePosition:handle.position.toArray(),attachedCountSockets:3,viewBoundsStable:true},
    }),
  };
}


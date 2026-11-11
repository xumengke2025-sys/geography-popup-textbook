import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { GIS_COUNTS, GIS_REGIONS, GIS_REFERENCE, evaluateGis, type GisPoint } from './textbook-gis-model';
import { chamferedPlateGeometry, turnedShaftGeometry, mergeInstrumentGeometry } from './textbook-instrument-parts';
import type { SolidMaterialRole } from './textbook-solid-materials';

/** A registration instrument, not a surveying machine. Its two original map
 * layers retain a common coordinate system; the open rails explain how the
 * sheets approach without crossing either map or its 33 station identities. */
export function buildGisWorld(b: TextbookGeometry): ModelMotion {
  const scale=b.width/100, back=-LIFT_MARGIN-75*scale, rise=40*scale;
  b.root.position.set(0,rise,-8*scale);
  const p=(x:number,y:number,z:number):Vec3=>[x*scale,y*scale,back+z*scale];
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
    feet.push([p(x-1.7,.2,-15),p(x+1.7,1.6,85)]);
    seats.push([p(x-1.35,1.6,-14.2),p(x+1.35,37.6,-11.8)]);
    rod(p(x,37.25,-12),p(x,5.05,0),.46*scale,steel,'steel','external-registration-guide');
    rod(p(x,2.6,0),p(x,2.6,12),.44*scale,steel,'steel','lower-slide-rail');
    for(const z of[-12.6,82.5])rod(p(x,1.6,z),p(x,1.84,z),.72*scale,brass,'brass','flush-runner-fastener');
  }
  bars(feet,enamel,'enamel','paired-open-runners');bars(seats,enamel,'enamel','rear-guide-seats');
  // This cross member is a useful process control, not a third information
  // layer. Dragging its carriage seeks the very same scientific phase.
  plate(p(2.2,1.55,79.6),p(97.8,2.4,84.2),enamel,'enamel','timeline-crossmember');
  rod(p(9,2.9,82),p(91,2.9,82),.38*scale,steel,'steel','phase-control-rail');
  const track={start:p(9,3.2,82),end:p(91,3.2,82)};
  const handle=plate(p(-2.4,-.75,-1.7),p(2.4,.75,1.7),brass,'brass','phase-carriage');
  // Geometry above was authored with p() for the common map origin; this one
  // local carriage instead centres its geometry and moves along a root track.
  handle.geometry.translate(0,0,-back);
  handle.userData.modelInput={kind:'phase-track',track,label:'拖动滑柄，对位图层并逐区统计'};
  handle.userData.interactionFeedback=false;
  const tickBoxes:[Vec3,Vec3][]=[];
  for(let i=0;i<=20;i++)tickBoxes.push([p(9+i*4.1,2.41,80),p(9.13+i*4.1,2.44,i%5===0?81.1:80.65)]);
  bars(tickBoxes,brass,'brass','uncalibrated-process-ticks');

  // Both carriers are thin sheet frames, with a narrow brass reveal. All
  // hardware is individually registered at b.root for the rigid page reveal.
  const carrier=(name:string)=>{
    const outer=bars([[p(5.4,-.26,-1.6),p(94.6,.25,-.35)],[p(5.4,-.26,54.35),p(94.6,.25,55.6)],
      [p(5.4,-.26,-.35),p(6.65,.25,54.35)],[p(93.35,-.26,-.35),p(94.6,.25,54.35)]],enamel,'enamel',`${name}-thin-frame`);
    const reveal=bars([[p(6.5,.18,-.34),p(93.5,.3,0)],[p(6.5,.18,54),p(93.5,.3,54.34)]],brass,'brass',`${name}-edge-reveal`);
    const lugs=bars([[p(2,-.7,-1),p(6.2,.3,1)],[p(93.8,-.7,-1),p(98,.3,1)]],brass,'brass',`${name}-registration-lugs`);
    return[outer,reveal,lugs];
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
  const profile=[[0,-.12],[.32,-.1],[.51,.1],[.52,.37],[.31,.8],[0,1.5]].map(([r,y])=>new T.Vector2(r*scale,y*scale));
  const dropGeometry=new T.LatheGeometry(profile,10),neutral=b.materialFor('enamel','#648d9d');
  const stationMaterials=GIS_REGIONS.map(region=>b.materialFor('enamel',region.stationColor));
  const stations=evaluateGis(0).stations.map(station=>{
    const mesh=tag(b.mesh(dropGeometry,'#648d9d',false),'rain-station');mesh.renderOrder=4;
    mesh.userData.stationId=station.id;mesh.userData.region=station.region;if(station.region!==null)inspectRegion(mesh,station.region);return{station,mesh};
  });
  // These inscriptions are fixed to actual lips and sockets. They never turn
  // into free billboard cards as the maps approach one another.
  const inscription=(text:string,at:Vec3,w:number,h:number,role:string)=>{
    const m=tag(b.label(text,at,w*scale,h*scale,{appearance:'engraved'}),role);
    m.userData.labelMount='surface';m.rotation.x=-Math.PI/2;m.renderOrder=5;return m;
  };
  const regionCodes=GIS_REGIONS.map(region=>inspectRegion(inscription(String(region.id),point(region.label,1),5.8,5.8,'region-code'),region.id));
  const stationLip=plate(p(29,-.2,-6.8),p(71,.22,-1.6),'#e3ddc9','ivory','station-name-lip');upperParts.push(stationLip);
  const regionLip=plate(p(29,-.2,-6.8),p(71,.22,-1.6),'#e3ddc9','ivory','region-name-lip');lowerParts.push(regionLip);
  const stationTitle=inscription('雨量站',p(50,.26,-4.2),18,4.2,'station-title');
  const regionTitle=inscription('行政区',p(50,.26,-4.2),18,4.2,'region-title');
  const countBed=plate(p(7,-.2,57),p(93,.65,64.8),enamel,'enamel','result-counter-bed');lowerParts.push(countBed);
  const counts=GIS_REGIONS.map((region,i)=>{
    const x=21+i*29;
    const socket=inspectRegion(plate(p(x-12,.65,58),p(x+12,1.05,63.8),'#e3ddc9','ivory','count-socket'),region.id);
    socket.userData.region=region.id;lowerParts.push(socket);
    const label=inspectRegion(inscription(`${region.id}区 —`,p(x,1.1,61),21,4.5,'derived-count'),region.id);
    label.userData.region=region.id;return{label,value:-2,x};
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
      state=evaluateGis(phase);const inspectedRegion=inspection==='overview'?null:Number(inspection.slice(-1))+1;
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
        const inspected=inspectedRegion===station.region,pulse=Math.sin(station.match*Math.PI),r=1+pulse*.28+(inspected?.2:0);
        mesh.scale.set(r,1+pulse*.18,r);
        if(pulse>.01||inspected){const c=point(station.point,upper.y+.7,upper.z);b.contour(Array.from({length:25},(_,k):Vec3=>{const a=k/24*Math.PI*2,rr=(1.4+pulse*.35)*scale;return[c[0]+Math.cos(a)*rr,c[1],c[2]+Math.sin(a)*rr]}),inspected?.78:.7)}
      });
      regionCodes.forEach((label,i)=>{label.visible=state.phase<.4;label.position.set(...point(GIS_REGIONS[i].label,lower.y+.65,lower.z))});
      // The two source titles occupy separate real lips before contact; the
      // administrative lip is hidden once the transparent carrier seats.
      stationTitle.position.set(...p(50,upper.y+.26,upper.z-4.2));regionTitle.position.set(...p(50,lower.y+.26,lower.z-4.2));
      regionTitle.visible=regionLip.visible=state.overlay<.94;
      counts.forEach((entry,i)=>{entry.label.position.set(...p(entry.x,lower.y+1.1,lower.z+61));setCount(entry,state.counts[i].id,state.counts[i].visible?state.counts[i].count:null)});
    },
    focusBounds:()=>({min:p(-1,0,-21),max:p(101,42,86)}),
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


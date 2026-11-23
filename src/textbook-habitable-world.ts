import { geographicLand, paintSolarHemisphere } from './textbook-geographical-globes';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { chamferedPlateGeometry, mergeInstrumentGeometry, turnedShaftGeometry } from './textbook-instrument-parts';
import type { SolidMaterialRole } from './textbook-solid-materials';

const CONDITIONS = ['temperature', 'liquid-water', 'atmosphere'] as const;
const NAMES = ['适宜温度', '液态水', '大气条件'] as const;
export function evaluateHabitable(phase: number, selection = 0) {
  const progress = Math.max(0, Math.min(1, phase)), selected = Math.max(0, Math.min(2, Math.round(selection)));
  return { progress, selected, condition: CONDITIONS[selected], observation: 'one-earth-three-conditions',
    lifeGuaranteed: false, causalScope: 'conditions-not-biogenesis-simulation',
    temperatureCalibrated: false, atmosphereThicknessToScale: false, geographySchematic: true };
}

/** A single globe on a closed load path: foot → neck → polar bearing → globe.
 * Surface water and the atmospheric envelope belong to that same Earth.
 * Selecting a condition reveals evidence, without a fictitious time axis. */
export function buildHabitableWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, back = -LIFT_MARGIN - 62 * s;
  const c: Vec3 = [54, 35, 36], radius = 24, owned: any[] = [];
  const p = (v: Vec3): Vec3 => [v[0] * s, v[1] * s, back + v[2] * s];
  const palette: Partial<Record<SolidMaterialRole, string>> = { brass: '#ad9059', steel: '#99a3a0', enamel: '#344840', ivory: '#e3ddc9', water: '#598b97', land: '#b5b698', air: '#c4d6d5' };
  const add = (g: any, role: SolidMaterialRole, name: string, color = palette[role]!) => {
    g.scale(s, s, s); const m = b.mesh(g, color, false, true, role); m.position.z = back;
    m.name = `habitable:${name}`; m.userData.habitablePart = name; owned.push(m); return m;
  };
  const rodGeo = (a: Vec3, d: Vec3, r: number) => turnedShaftGeometry(a, d, [[r, 0], [r, 1]]);
  const rod = (a: Vec3, d: Vec3, r: number, role: SolidMaterialRole, name: string) => add(rodGeo(a, d, r), role, name);
  const tube = (points: Vec3[], r: number, role: SolidMaterialRole, name: string) => add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(v => new T.Vector3(...v))), Math.max(16, points.length * 2), r, 7, false), role, name);
  const select = (m: any, selection: number, label: string) => { m.userData.modelInput = { kind: 'select', selection, label }; return m; };
  const sphere = (r: number, name: string, role: SolidMaterialRole) => { const g = new T.SphereGeometry(r, 72, 48); g.translate(...c); return add(g, role, name); };
  const surface = (lon: number, lat: number, r = radius): Vec3 => {
    const a = lon * Math.PI / 180, h = lat * Math.PI / 180;
    return [c[0] + r * Math.cos(h) * Math.sin(a), c[1] + r * Math.sin(h), c[2] + r * Math.cos(h) * Math.cos(a)];
  };

  // Turned walnut stock, fine brass stringing and three rising scroll legs
  // carry the horizon ring. Its empty centre keeps the whole globe visible.
  const footProfile:readonly (readonly [number,number])[]=[[21,0],[22.3,.06],[22.5,.13],[22,.23],[20.6,.34],[20.4,.49],[21.8,.62],[21.6,.72],[20.2,.82],[19.6,.97],[19.5,1]];
  add(turnedShaftGeometry([54,.75,38],[54,4.3,38],footProfile),'wood','turned-walnut-plinth','#68452f');
  for(const [y,r] of [[1.28,22.5],[3.16,21.75]])add(turnedShaftGeometry([54,y,38],[54,y+.19,38],[[r,0],[r+.08,.4],[r,1]]),'brass','inlaid-stringing');
  for(const [x,z] of [[40,29],[68,29],[54,53]])add(turnedShaftGeometry([x,.06,z],[x,1.2,z],[[1.9,0],[2.1,.15],[1.75,.48],[1.95,.88],[1.9,1]]),'brass','levelling-foot');
  add(turnedShaftGeometry([54,4.25,36],[54,8.8,36],[[5.6,0],[5.8,.08],[4.65,.20],[3.54,.38],[2.9,.56],[2.45,.74],[3.3,.91],[3.4,1]]),'brass','turned-bearing-neck');
  const horizonY=31.9;
  const annulus=new T.LatheGeometry([[26.35,-.41],[28.5,-.41],[28.83,-.23],[28.83,.18],[28.55,.4],[26.35,.4],[26.35,-.41]].map(([r,y])=>new T.Vector2(r,y)),144);
  annulus.translate(54,horizonY,36);add(annulus,'brass','horizon-stock');
  const horizonMarks:any[]=[];
  for(let i=0;i<120;i++){const a=i*Math.PI/60,r=i%10===0?26.44:i%5===0?27.04:27.69;
    const at=(r:number):Vec3=>[54+r*Math.cos(a),horizonY+.43,36+r*Math.sin(a)];
    horizonMarks.push(rodGeo(at(r),at(28.25),i%5===0?.065:.037));}
  add(mergeInstrumentGeometry(horizonMarks),'enamel','azimuth-divisions','#524637');
  for(const a of [28,151,269].map(q=>q*Math.PI/180)){
    const at=(r:number,y:number):Vec3=>[54+r*Math.cos(a),y,36+r*Math.sin(a)];
    const route=[at(16.7,4.1),at(20.2,6.65),at(22.3,13.2),at(22.5,20.8),at(25.1,25.6),at(27.4,27.9),at(27.4,horizonY-.25)];
    tube(route,1.02,'brass','curved-horizon-support');
    add(turnedShaftGeometry(at(16.7,4.1),at(16.7,5.95),[[2.14,0],[2.2,.14],[1.8,.42],[1.35,.8],[1.42,1]]),'brass','leg-socket');
    add(turnedShaftGeometry(at(27.4,28.6),at(27.4,horizonY-.3),[[1.1,0],[1.4,.23],[1.1,.5],[1.25,.83],[1.55,1]]),'brass','ring-seat');
  }
  // A flat meridian limb has a face wide enough to carry real index marks.
  // The narrow bevel catches window light along both edges of the casting.
  const arc = new T.Shape(), topAngle=Math.PI/2, bottomAngle=topAngle+Math.PI;
  arc.absarc(0,0,28.6,topAngle,bottomAngle,false);
  arc.absarc(0,0,25.45,bottomAngle,topAngle,true);
  arc.closePath();
  const limb = new T.ExtrudeGeometry(arc,{depth:1,bevelEnabled:true,bevelThickness:.16,bevelSize:.20,bevelSegments:2,curveSegments:72});
  limb.translate(c[0],c[1],c[2]-.5);
  select(add(limb,'brass','open-bearing-meridian'),0,'沿子午托架查看地球的温度条件');
  for (const y of [9.2, 60.8]) {
    add(turnedShaftGeometry([54, y - 1.4, 36], [54, y + 1.4, 36], [[1.9, 0], [2.5, .13], [2.5, .33], [1.7, .43], [1.7, .6], [2.5, .7], [2.5, .9], [1.9, 1]]), 'brass', 'polar-bearing-collar');
    rod([54, y - 2.4, 36], [54, y + 2.4, 36], .7, 'steel', 'polar-journal');
  }
  const divisions: any[] = [];
  for (let i=1;i<60;i++) {
    const a=topAngle+Math.PI*i/60, r0=i%5===0?26.0:27.05, r1=28.14;
    const point=(r:number):Vec3=>[c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r,c[2]+.67];
    divisions.push(rodGeo(point(r0),point(r1),i%5===0?.105:.055));
  }
  add(mergeInstrumentGeometry(divisions),'enamel','ungraduated-alignment-divisions','#514230');

  const ocean = select(sphere(radius, 'continuous-ocean-surface', 'water'), 1, '点海面查看液态水，水位于同一地球表面');
  ocean.userData.waterOnEarth = true;
  const sunward:Vec3=[-.84,0,Math.sqrt(1-.84**2)];
  paintSolarHemisphere(ocean.geometry,sunward,'#4f8f91','#28494d');ocean.material.color.set('#ffffff');ocean.material.vertexColors=true;
  const landGeo=geographicLand(radius+.25,c,true);
  paintSolarHemisphere(landGeo,sunward,'#ceb782','#796b52');
  const land=add(landGeo,'land','organic-curved-continents','#ffffff');land.material.vertexColors=true;land.material.roughness=.56;
  land.userData.coastline='Natural Earth 1:110m Land';
  // Fine geographical graticule remains on the sphere, not floating rings.
  const graticule: any[]=[];
  for(const lat of[-40,0,40])graticule.push(new T.TubeGeometry(new T.CatmullRomCurve3(Array.from({length:97},(_,i)=>new T.Vector3(...surface(i/96*360,lat,radius+.045)))),96,.022,4,false));
  for(const lon of[-120,-60,0,60,120,180])graticule.push(new T.TubeGeometry(new T.CatmullRomCurve3(Array.from({length:65},(_,i)=>new T.Vector3(...surface(lon,-89+i/64*178,radius+.045)))),64,.022,4,false));
  add(mergeInstrumentGeometry(graticule),'water','surface-engraved-graticule','#8db0b4');

  // Atmosphere is ONE translucent enclosing surface with clouds on the same
  // Earth; thickness exaggerated. It is not a mechanically detached torus.
  const atmosphere = select(sphere(radius * 1.075, 'single-atmosphere-envelope', 'air'), 2, '点大气包络观察大气条件');
  // Keep the registered Popout material: clone() drops onBeforeCompile and
  // makes this envelope ignore formation/retraction alpha.
  const airMaterial = atmosphere.material; airMaterial.transparent=true;
  airMaterial.opacity=.055; airMaterial.depthWrite=false; airMaterial.side=T.FrontSide;
  // All solid geometry is registered with Popout for the shared reveal.
  // Render the enclosing translucent layer after its opaque surface evidence.
  atmosphere.renderOrder=2;
  // The envelope's centre is clear glass. Picking its rim still leaves the
  // water and land underneath accessible through the clear viewing window.
  const airRaycast=atmosphere.raycast,airHits:any[]=[],airNormal=new T.Vector3();
  atmosphere.raycast=function(ray:any,out:any[]){
    airHits.length=0;airRaycast.call(this,ray,airHits);
    const hit=airHits[0];if(!hit?.face)return;
    airNormal.copy(hit.face.normal).transformDirection(this.matrixWorld);
    if(Math.abs(airNormal.dot(ray.ray.direction))<.32)out.push(hit);
  };
  atmosphere.castShadow=false; atmosphere.receiveShadow=false;
  const cloudParts:any[]=[];
  for(const [lon,lat,len]of[[-36,24,18],[27,45,14],[80,17,23],[-12,-28,17],[137,-11,12]]){
    const path=Array.from({length:18},(_,i)=>surface(lon+(i/17-.5)*len,lat+Math.sin(i/17*Math.PI)*1.5,radius*1.045));
    cloudParts.push(new T.TubeGeometry(new T.CatmullRomCurve3(path.map(v=>new T.Vector3(...v))),24,.23,6,false));
  }
  const clouds=select(add(mergeInstrumentGeometry(cloudParts),'ivory','surface-weather-cloud-ribbons'),2,'点地球云层观察大气条件');

  // Teaching glyphs are surface-bound evidence, not a heat budget, ocean-
  // current model or atmospheric circulation. Conditions are static views.
  const heatLines:any[]=[], waterLines:any[]=[], airMarkers:any[]=[];
  for(let i=0;i<3;i++){
    const lat=8+i*12,path=Array.from({length:35},(_,j)=>surface(-51+j/34*31,lat,radius+.25));
    heatLines.push(select(tube(path,.095,'brass','temperature-surface-observation'),0,'查看适宜温度条件；弧线是观察标记，不是等温线'));
    const end=path[0],start=end.map((v,i)=>v+sunward[i]*9.6) as Vec3;
    const ray=select(rod(start,end,.10,'ivory','incident-light-to-surface'),0,'入射光到达同一地球表面；不表示实测热收支');
    ray.userData.surfaceContact=end; ray.userData.observationOnly=true; heatLines.push(ray);
  }
  for(let i=0;i<4;i++){
    const path=Array.from({length:40},(_,j)=>surface(-53+j/39*18,4+i*3+Math.sin(j/39*Math.PI*3)*.55,radius+.23));
    waterLines.push(select(tube(path,.075,'ivory','ocean-surface-wave-observation'),1,'查看海面液态水；波纹是示意，不是洋流路径'));
  }
  for(let i=0;i<7;i++){const g=new T.SphereGeometry(.35,12,8);const m=select(add(g,'ivory','atmosphere-observation-tracer'),2,'查看包围同一地球的大气条件');airMarkers.push(m);}

  // Native options are fixed into the same foot, not loose floating labels.
  const selectors:any[]=[];
  for(let i=0;i<3;i++){
    const x=43+i*11,start=owned.length;
    const m=select(rod([x,3.95,52.4],[x,4.72,52.4],3.02,'brass','condition-selector'),i,`查看${NAMES[i]}`);selectors.push(m);
    // Three distinctive inset motifs: sun, wave, atmosphere arc. No numeric
    // scales or invented measurements are implied by the detents.
    if(i===0){for(let k=0;k<8;k++){const a=k*Math.PI/4;rod([x+Math.cos(a)*1.1,4.77,52.4+Math.sin(a)*1.1],[x+Math.cos(a)*1.65,4.77,52.4+Math.sin(a)*1.65],.07,'enamel','temperature-selector-mark');}}
    else for(let row=0;row<(i===1?2:3);row++){const points=Array.from({length:14},(_,j):Vec3=>[x-1.55+j/13*3.1,4.77,51.6+row*.65+(i===1?Math.sin(j/13*Math.PI*2)*.16:Math.sin(j/13*Math.PI)*.45)]);tube(points,.07,'enamel','condition-selector-mark');}
    for(const piece of owned.slice(start))select(piece,i,'查看'+NAMES[i]);
  }
  const pointer=rod([0,0,0],[0,.0,2.0],.15,'enamel','selected-condition-pointer');
  tube([[70.4,3.6,46.3],[72.7,4.5,46.9],[75.4,6.5,47.25],[75.8,8.05,47.3]],1.10,'brass','selector-bracket');
  const dialCenter:Vec3=[75.8,8.05,49.1],dialRadius=3.4;
  const dial={center:p(dialCenter),radiusX:dialRadius*s,radiusY:dialRadius*s};
  const selector={kind:'indexed-dial',dial,start:Math.PI*.83,step:-Math.PI/3,stops:[0,1,2].map(selection=>({selection})),advanceAtHub:true,label:'转动三档选择柄，查看温度、水和大气'};
  add(turnedShaftGeometry([75.8,8.05,46.9],[75.8,8.05,49.05],[[3.85,0],[4,.12],[3.64,.36],[3.91,.79],[3.83,1]]),'brass','selector-bezel').userData.modelInput=selector;
  rod([75.8,8.05,49.03],[75.8,8.05,49.13],3.46,'ivory','selector-face').userData.modelInput=selector;
  for(let i=0;i<3;i++){
    const a=selector.start+i*selector.step;
    rod([75.8+Math.cos(a)*2.75,8.05+Math.sin(a)*2.75,49.17],[75.8+Math.cos(a)*3.28,8.05+Math.sin(a)*3.28,49.17],.12,'enamel','selector-stop').userData.modelInput=selector;
  }
  const hand=add(turnedShaftGeometry([.2,0,0],[2.85,0,0],[[.31,0],[.49,.13],[.33,.64],[.17,1]]),'enamel','three-stop-pointer');
  hand.position.set(...p([75.8,8.05,49.29]));hand.userData.modelInput=selector;
  rod([75.8,8.05,49.17],[75.8,8.05,50.1],.67,'brass','selector-hub').userData.modelInput=selector;
  let state=evaluateHabitable(0),oldPhase=-1,oldSelection=-1;
  const bufferIds=owned.map(m=>m.geometry.attributes.position.array);
  return {
    update(phase,selection){
      // Popout._surfaces restores depthWrite=true on every registered material,
      // including in a stationary live frame. Restore this envelope's optical
      // contract before the cached scientific-state early return; otherwise it
      // writes an invisible front sphere that occludes land and cloud ribbons.
      airMaterial.depthWrite=false;
      if(phase===oldPhase&&selection===oldSelection)return;oldPhase=phase;oldSelection=selection;state=evaluateHabitable(phase,selection);
      heatLines.forEach(m=>{m.visible=state.selected===0;m.userData.observationOnly=true;});
      waterLines.forEach(m=>{m.visible=state.selected===1;m.userData.liquidWaterOnGlobe=true;});
      // Conditions coexist; selection changes the observation emphasis only.
      atmosphere.visible=true; airMaterial.opacity=state.selected===2?.12:.055; clouds.visible=true;
      airMarkers.forEach((m,i)=>{m.visible=state.selected===2;const at=surface(-57+i*18,-18+i*9,radius*1.078);m.position.set(...p(at));});
      pointer.position.set(...p([43+state.selected*11,4.8,52.4]));
      pointer.userData.modelInput=selectors[state.selected].userData.modelInput;
      hand.rotation.z=selector.start+state.selected*selector.step;
      selectors.forEach((m,i)=>m.userData.selected=state.selected===i);
    },
    focusBounds:()=>({min:p([22,0,5]),max:p([85,65,66])}),
    describe:()=>({kind:'habitable-earth',...state,conditions:[...CONDITIONS],conditionsCoexist:true,singleEarth:true,waterOnSameGlobe:true,atmosphereEnclosesSameGlobe:true,
      directPartOperations:['temperature-surface','ocean-surface','atmosphere-envelope','fixed-condition-selectors'],
      supportingStructure:'one-open-meridian-with-polar-journals-and-bearing-neck',bitmapSurfaces:0,looseWaterDrop:false,floatingAtmosphereRings:0,
      progressMeaning:'not-applicable-static-condition-observation',timeAxis:false,oceanCurrentSimulation:false,heatBudget:false,
      coastlineSource:'Natural Earth 1:110m Land',terminatorSunward:sunward,selectorAngle:hand.rotation.z,sameScientificScopeAsTextbook:true,buffersStable:owned.every((m,i)=>m.geometry.attributes.position.array===bufferIds[i]),parts:owned.length}),
  };
}
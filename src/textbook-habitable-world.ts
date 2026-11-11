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

  // A compact three-footed casting, not a presentation platform. The single
  // meridian bears both polar journals and has actual end collars.
  add(chamferedPlateGeometry([38, 1.1, 25], [70, 3.4, 47], 1.3), 'enamel', 'cast-tripod-foot');
  for (const [x, z] of [[41, 28], [67, 28], [54, 44]]) rod([x, .1, z], [x, 1.3, z], 2.15, 'steel', 'levelling-foot');
  add(turnedShaftGeometry([54, 3.4, 36], [54, 8.6, 36], [[5.3, 0], [5.3, .12], [3.2, .24], [2.2, .8], [3, 1]]), 'brass', 'turned-bearing-neck');
  const meridian = Array.from({ length: 83 }, (_, i): Vec3 => { const a = Math.PI / 2 + Math.PI * i / 82; return [c[0] + Math.cos(a) * 26.8, c[1] + Math.sin(a) * 26.8, c[2]]; });
  select(tube(meridian, .76, 'brass', 'open-bearing-meridian'), 0, '沿子午托架查看地球的温度条件');
  for (const y of [9.2, 60.8]) {
    add(turnedShaftGeometry([54, y - 1.4, 36], [54, y + 1.4, 36], [[1.9, 0], [2.5, .13], [2.5, .33], [1.7, .43], [1.7, .6], [2.5, .7], [2.5, .9], [1.9, 1]]), 'brass', 'polar-bearing-collar');
    rod([54, y - 2.4, 36], [54, y + 2.4, 36], .7, 'steel', 'polar-journal');
  }
  const divisions: any[] = [];
  for (let i = 0; i <= 18; i++) { const a = Math.PI / 2 + Math.PI * i / 18, r0 = 26.1, r1 = i % 3 === 0 ? 27.7 : 27.05;
    divisions.push(rodGeo([54 + Math.cos(a) * r0, 35 + Math.sin(a) * r0, 36.72], [54 + Math.cos(a) * r1, 35 + Math.sin(a) * r1, 36.72], .055)); }
  add(mergeInstrumentGeometry(divisions), 'steel', 'ungraduated-alignment-divisions');

  const ocean = select(sphere(radius, 'continuous-ocean-surface', 'water'), 1, '点海面查看液态水，水位于同一地球表面');
  ocean.userData.waterOnEarth = true;
  // Hand-authored schematic coast polygons; no bitmap and no rectangular
  // sphere patches. Subdivision projects every triangle back onto the sphere.
  const continents: [number, number][][] = [
    [[-17,36],[-7,37],[3,35],[13,33],[25,32],[34,29],[43,12],[51,11],[44,1],[40,-12],[34,-24],[19,-35],[12,-28],[9,-12],[1,5],[-10,6],[-17,15]],
    [[-10,36],[-10,44],[-1,49],[-5,56],[7,58],[11,69],[24,71],[34,62],[42,58],[55,64],[74,70],[100,76],[130,70],[160,60],[164,51],[142,44],[131,32],[121,24],[109,20],[103,3],[97,11],[86,20],[78,8],[70,23],[56,28],[48,30],[40,40],[29,42],[23,38],[16,42],[12,45],[3,43]],
    [[-81,12],[-70,11],[-58,6],[-49,-1],[-36,-6],[-42,-22],[-52,-33],[-67,-54],[-73,-46],[-71,-28],[-76,-11]],
    [[-167,65],[-150,70],[-128,71],[-111,69],[-95,72],[-78,60],[-57,53],[-63,46],[-80,26],[-87,15],[-98,18],[-109,31],[-124,43],[-133,56],[-151,59]],
    [[113,-22],[120,-18],[130,-12],[138,-17],[145,-15],[153,-26],[148,-38],[135,-35],[126,-34],[115,-35]],
    [[-52,60],[-44,61],[-24,72],[-26,82],[-47,83],[-62,76]],
    [[47,-13],[50,-17],[49,-25],[44,-24],[44,-18]],
  ];
  const landVertices: number[] = [];
  const landPoint = (q: [number, number]) => surface(q[0], q[1], radius + .25 + .025 * Math.sin(q[0] * .17) * Math.cos(q[1] * .11));
  const subdivide = (a: [number,number], d: [number,number], e: [number,number], depth: number) => {
    if (!depth) { landVertices.push(...landPoint(a), ...landPoint(d), ...landPoint(e)); return; }
    const mid = (x: [number,number], y: [number,number]): [number,number] => [(x[0]+y[0])/2,(x[1]+y[1])/2];
    const ad=mid(a,d),de=mid(d,e),ea=mid(e,a);subdivide(a,ad,ea,depth-1);subdivide(ad,d,de,depth-1);subdivide(ea,de,e,depth-1);subdivide(ad,de,ea,depth-1);
  };
  for (const polygon of continents) for (const indices of T.ShapeUtils.triangulateShape(polygon.map(([x,y])=>new T.Vector2(x,y)), [])) subdivide(polygon[indices[0]],polygon[indices[1]],polygon[indices[2]],4);
  const landGeo = new T.BufferGeometry();landGeo.setAttribute('position',new T.Float32BufferAttribute(landVertices,3));
  // Radial normals make the separately triangulated coastline one continuous
  // curved surface. Fine subdivisions keep chord interiors above the ocean.
  const normals=landVertices.map((value,i)=>value-c[i%3]);
  for(let i=0;i<normals.length;i+=3){const n=Math.hypot(normals[i],normals[i+1],normals[i+2]);normals[i]/=n;normals[i+1]/=n;normals[i+2]/=n;}
  landGeo.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
  const land = add(landGeo, 'land', 'organic-curved-continents');land.userData.coastline = 'schematic-organic-polygons';
  // Fine geographical graticule remains on the sphere, not floating rings.
  const graticule: any[]=[];
  for(const lat of[-40,0,40])graticule.push(new T.TubeGeometry(new T.CatmullRomCurve3(Array.from({length:97},(_,i)=>new T.Vector3(...surface(i/96*360,lat,radius+.045)))),96,.022,4,false));
  for(const lon of[-120,-60,0,60,120,180])graticule.push(new T.TubeGeometry(new T.CatmullRomCurve3(Array.from({length:65},(_,i)=>new T.Vector3(...surface(lon,-89+i/64*178,radius+.045)))),64,.022,4,false));
  add(mergeInstrumentGeometry(graticule),'water','surface-engraved-graticule','#8db0b4');

  // Atmosphere is ONE translucent enclosing surface with clouds on the same
  // Earth; thickness exaggerated. It is not a mechanically detached torus.
  const atmosphere = select(sphere(radius * 1.075, 'single-atmosphere-envelope', 'air'), 2, '点大气包络观察大气条件');
  const airMaterial = atmosphere.material.clone();atmosphere.material=airMaterial;airMaterial.opacity=.12;airMaterial.depthWrite=false;
  if(airMaterial.userData.uniforms)airMaterial.userData.uniforms={...airMaterial.userData.uniforms};
  atmosphere.geometry.addEventListener('dispose',()=>airMaterial.dispose());
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
  }
  for(let i=0;i<4;i++){
    const path=Array.from({length:40},(_,j)=>surface(-53+j/39*18,4+i*3+Math.sin(j/39*Math.PI*3)*.55,radius+.23));
    waterLines.push(select(tube(path,.075,'ivory','ocean-surface-wave-observation'),1,'查看海面液态水；波纹是示意，不是洋流路径'));
  }
  for(let i=0;i<7;i++){const g=new T.SphereGeometry(.35,12,8);const m=select(add(g,'ivory','atmosphere-observation-tracer'),2,'查看包围同一地球的大气条件');airMarkers.push(m);}

  // Native options are fixed into the same foot, not loose floating labels.
  const selectors:any[]=[];
  for(let i=0;i<3;i++){
    const x=43+i*11;
    const m=select(rod([x,3.4,43],[x,4.1,43],2.4,'brass','condition-selector'),i,`查看${NAMES[i]}`);selectors.push(m);
    // Three distinctive inset motifs: sun, wave, atmosphere arc. No numeric
    // scales or invented measurements are implied by the detents.
    if(i===0){for(let k=0;k<8;k++){const a=k*Math.PI/4;rod([x+Math.cos(a)*1.1,4.15,43+Math.sin(a)*1.1],[x+Math.cos(a)*1.65,4.15,43+Math.sin(a)*1.65],.07,'enamel','temperature-selector-mark');}}
    else for(let row=0;row<(i===1?2:3);row++){const points=Array.from({length:14},(_,j):Vec3=>[x-1.55+j/13*3.1,4.15,42.2+row*.65+(i===1?Math.sin(j/13*Math.PI*2)*.16:Math.sin(j/13*Math.PI)*.45)]);tube(points,.07,'enamel','condition-selector-mark');}
  }
  const pointer=rod([0,0,0],[0,.0,2.0],.15,'enamel','selected-condition-pointer');
  let state=evaluateHabitable(0),oldPhase=-1,oldSelection=-1;
  const bufferIds=owned.map(m=>m.geometry.attributes.position.array);
  return {
    update(phase,selection){
      if(phase===oldPhase&&selection===oldSelection)return;oldPhase=phase;oldSelection=selection;state=evaluateHabitable(phase,selection);
      heatLines.forEach(m=>{m.visible=state.selected===0;m.userData.observationOnly=true;});
      waterLines.forEach(m=>{m.visible=state.selected===1;m.userData.liquidWaterOnGlobe=true;});
      atmosphere.visible=state.selected===2;clouds.visible=true;
      airMarkers.forEach((m,i)=>{m.visible=state.selected===2;const at=surface(-57+i*18,-18+i*9,radius*1.078);m.position.set(...p(at));});
      pointer.position.set(...p([43+state.selected*11,4.22,43]));
      selectors.forEach((m,i)=>m.userData.selected=state.selected===i);
    },
    focusBounds:()=>({min:p([24,.05,9]),max:p([81,64,64])}),
    describe:()=>({kind:'habitable-earth',...state,conditions:[...CONDITIONS],singleEarth:true,waterOnSameGlobe:true,atmosphereEnclosesSameGlobe:true,
      directPartOperations:['temperature-surface','ocean-surface','atmosphere-envelope','fixed-condition-selectors'],
      supportingStructure:'one-open-meridian-with-polar-journals-and-bearing-neck',bitmapSurfaces:0,looseWaterDrop:false,floatingAtmosphereRings:0,
      progressMeaning:'not-applicable-static-condition-observation',timeAxis:false,oceanCurrentSimulation:false,heatBudget:false,
      sameScientificScopeAsTextbook:true,buffersStable:owned.every((m,i)=>m.geometry.attributes.position.array===bufferIds[i]),parts:owned.length}),
  };
}

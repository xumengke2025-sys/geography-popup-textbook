import { THREE as T } from './reference/engine.js';
import { createSpecimenMaterial } from './textbook-solid-materials';
import { PALETTE as C, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { applyEarthScan } from './textbook-earth-scan';
import { mergeInstrumentGeometry } from './textbook-instrument-parts';
import { mountMarsSequencer } from './textbook-mars-sequencer';
import { buildMarsCabin } from './textbook-mars-cabin';
import { evaluateMarsTransfer, skyClamp, skyEase } from './textbook-sky-causality-model';

const world = (b: TextbookGeometry) => {
  const s = b.width / 100;
  return { s, p: (u: number, v: number, h = 0): Vec3 => b.p(u, v, h * s) };
};
const curve = (b: TextbookGeometry, points: Vec3[]) => points.length === 2 ? new T.LineCurve3(b.v(points[0]), b.v(points[1])) : new T.CatmullRomCurve3(points.map(q => b.v(q)), false, 'catmullrom', .15);
function partial(b: TextbookGeometry, path: any, progress: number, color: 'flow' | 'accent' = 'flow', width = 1.15) {
  if (progress <= 0) return;
  const points = Array.from({ length: 41 }, (_, i) => path.getPoint(skyClamp(progress) * i / 40));
  (color === 'flow' ? b.flow : b.accentStrokes).push({ points, width });
}
function ball(b: TextbookGeometry, radius: number, color: string, at: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]) {
  const g = new T.SphereGeometry(radius, 18, 12); g.scale(...scale);
  const mesh = b.mesh(g, color, false); mesh.position.set(...at); return mesh;
}
function uniqueMaterial(b: TextbookGeometry, mesh: any) {
  // A Three.js clone drops the reference renderer's onBeforeCompile hook.
  // Register a separate physical surface with the same reveal and disposal
  // lifecycle so a response cannot recolour unrelated objects.
  mesh.material = createSpecimenMaterial(b.pop,{color:`#${mesh.material.color.getHexString()}`});
  mesh.material.side = T.DoubleSide; return mesh.material;
}
function input(meshes: any[], selection: number, text: string) {
  meshes.forEach(mesh => { mesh.userData.modelInput = { kind: 'select', selection, label: text }; });
}
/** Four different modules remain present. Only the chosen connection is active;
 * each receiving indicator waits for its own incoming water/gas/food/energy. */
export function buildMarsTransferWorld(b: TextbookGeometry): ModelMotion {
  const { s, p } = world(b), centers = [p(.18, .80, 3), p(.48, .60, 3), p(.79, .80, 3), p(.49, .98, 3)];
  // A continuous cut piece of regolith follows the occupied field and the
  // service run, leaving the original page visible around its natural edge.
  // The four prepared contacts stay at exactly y=1.3, where the feet end.
  const outline=curve(b,[[.025,1.11],[.06,.67],[.17,.46],[.39,.43],[.48,.39],[.66,.46],[.92,.43],[.98,.68],[.94,1.09],[.80,1.37],[.50,1.415],[.20,1.36],[.025,1.11]].map(([u,v])=>p(u,v,0)));
  const boundary=outline.getPoints(96).slice(0,-1),center=b.v(p(.5,.91,0)),vertices:number[]=[],indices:number[]=[],rings=15;
  const groundHeight=(x:number,z:number)=>{
    const contact=Math.min(...centers.map(at=>Math.hypot((x-at[0])/s,(z-at[2])/s)));
    const edge=skyClamp((contact-12)/10);
    return (1.3+edge*(.18*Math.sin(x/s*.13)*Math.cos(z/s*.16)+.10*Math.sin((x+z)/s*.37)))*s;
  };
  vertices.push(center.x,groundHeight(center.x,center.z),center.z);
  for(let ring=1;ring<=rings;ring++)for(const edge of boundary){
    const x=center.x+(edge.x-center.x)*ring/rings,z=center.z+(edge.z-center.z)*ring/rings;
    vertices.push(x,groundHeight(x,z),z);
  }
  const count=boundary.length;
  for(let i=0;i<count;i++)indices.push(0,1+i,1+(i+1)%count);
  for(let ring=0;ring<rings-1;ring++)for(let i=0;i<count;i++){
    const j=(i+1)%count,a=1+ring*count+i,c=1+ring*count+j,d=a+count,e=c+count;
    indices.push(a,d,c,c,d,e);
  }
  for(let i=0;i<count;i++){
    const a=boundary[i],c=boundary[(i+1)%count],k=vertices.length/3;
    vertices.push(a.x,groundHeight(a.x,a.z),a.z,c.x,groundHeight(c.x,c.z),c.z,c.x,-1.90*s,c.z,a.x,-1.90*s,a.z);
    indices.push(k,k+1,k+2,k,k+2,k+3);
  }
  // A real underside closes the specimen without adding a second plinth.
  const bottom=vertices.length/3;vertices.push(center.x,-1.90*s,center.z);
  for(const edge of boundary)vertices.push(edge.x,-1.90*s,edge.z);
  for(let i=0;i<count;i++)indices.push(bottom,bottom+1+(i+1)%count,bottom+1+i);
  // x/z authored polygons have the opposite orientation to x/y shapes.
  // Reverse once so the land's actual upper surface has upward normals.
  for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  const groundGeometry=new T.BufferGeometry();groundGeometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));groundGeometry.setIndex(indices);groundGeometry.computeVertexNormals();
  const regolith=b.mesh(groundGeometry,'#ac8061',false,true,'land');applyEarthScan(regolith.material,'alluvium',9.3*s);regolith.userData.causalRole='continuous-natural-regolith';regolith.userData.preparedContactHeight=1.3*s;
  // Marginal clusters share a geological finish with the exposed cut. The
  // colour and grains are an illustrative analogue, not a sampled Mars site.
  const chips=[];
  for(let j=0;j<18;j++){
    const rim=boundary[(7+j*17)%boundary.length],baseX=center.x+(rim.x-center.x)*.91,baseZ=center.z+(rim.z-center.z)*.91;
    for(let n=0;n<3;n++){
      const x=baseX+Math.sin(j*9.1+n*2.29)*s*(.5+n*.44),z=baseZ+Math.cos(j*7.2+n*1.85)*s*(.4+n*.36);
      if(centers.some(v=>Math.abs(v[0]-x)<11.2*s&&Math.abs(v[2]-z)<12.3*s))continue;
      const size=s*(.28+(1+Math.sin(1.73*j+n*2.42))*.22);
      const grain=new T.DodecahedronGeometry(size,1);
      grain.scale(1.4,.54+.09*n,1);grain.rotateY(j*2.33+n);
      grain.translate(x,groundHeight(x,z)+size*.10,z);chips.push(grain);
    }
  }
  if(chips.length){const clasts=b.mesh(mergeInstrumentGeometry(chips),'#846654',false,true,'rock');clasts.name='表土边缘的岩屑';applyEarthScan(clasts.material,'outcrop',3.15*s);}
  const windows: any[] = [], moduleSurfaces: any[][] = [], cabins: ReturnType<typeof buildMarsCabin>[] = [];
  centers.forEach((at, i) => {
    const cabin=buildMarsCabin(b,at,s,i);uniqueMaterial(b,cabin.window);windows.push(cabin.window);
    cabins.push(cabin);
    input(cabin.meshes,[0,2,1,3][i],['查看基地整体','查看植物与乘员的交换','查看水的再生','查看能源供给'][i]);
    moduleSurfaces.push(cabin.meshes.filter(m=>m.userData.kind!=='text-label'));
  });
  const crew = centers[0], plants = centers[1], support = centers[2], resources = centers[3];
  // Visible instruments sit at the front of their own cabin, so a response
  // belongs to a receiver rather than to an unrelated floating title.
  for (const dx of [-3.2, 3.2]) {
    ball(b, .9 * s, C.ink, [crew[0] + dx * s, crew[1] + 5.4 * s, crew[2] + 8.6 * s]);
    b.cylinder([crew[0] + dx * s, crew[1] + 1.4 * s, crew[2] + 8.6 * s], [crew[0] + dx * s, crew[1] + 4.4 * s, crew[2] + 8.6 * s], .8 * s, C.rock);
  }
  const plantLeaves: any[] = [];
  for (const dx of [-2.6, 0, 2.6]) { b.cylinder([plants[0] + dx * s, plants[1] + 1.2 * s, plants[2] + 8.4 * s], [plants[0] + dx * s, plants[1] + 5 * s, plants[2] + 8.4 * s], .1 * s, C.darkGreen); for (const sign of [-1, 1]) { const leaf = ball(b, 1.05 * s, C.green, [plants[0] + (dx + sign * .7) * s, plants[1] + (3.5 + sign * .6) * s, plants[2] + 8.5 * s], [1, .32, .42]); uniqueMaterial(b, leaf); plantLeaves.push(leaf); } }
  const instrumentAt: Vec3 = [support[0], support[1] + 4 * s, support[2] + 9.1 * s];
  const rotor = b.mesh(new T.BoxGeometry(5.6 * s, .75 * s, .65 * s), C.cool, false); rotor.position.set(...instrumentAt); rotor.userData.causalRole = 'receiving-filter-rotor';
  const rotorCross = b.mesh(new T.BoxGeometry(.75 * s, 5.6 * s, .65 * s), C.cool, false); rotorCross.position.set(...instrumentAt);
  const valve = b.mesh(new T.BoxGeometry(3.4 * s, 1 * s, .6 * s), C.warm, false); valve.position.set(support[0] - 4.7 * s, support[1] + 4 * s, support[2] + 9.1 * s); valve.userData.causalRole = 'receiving-filter-valve';
  b.cylinder([support[0] - 4.7 * s, support[1] + .8 * s, support[2] + 8.7 * s], [support[0] - 4.7 * s, support[1] + 6.8 * s, support[2] + 8.7 * s], .65 * s, C.rock);
  const tank = b.mesh(new T.BoxGeometry(7 * s, 5.2 * s, .7 * s), C.water, false); tank.userData.causalRole = 'reclaimed-water-receiving-store';
  const cup = b.mesh(new T.CylinderGeometry(2.6 * s, 2.3 * s, 2.7 * s, 18, 1, true), C.paper, false); cup.position.set(crew[0], crew[1] + 2 * s, crew[2] + 10.2 * s);
  const drinkingWater = b.mesh(new T.CylinderGeometry(2.3 * s, 2.1 * s, 2.2 * s, 18), C.water, false); drinkingWater.userData.causalRole = 'crew-received-water';
  const oxygenPiston = b.mesh(new T.BoxGeometry(2 * s, 1 * s, .6 * s), C.darkGreen, false); oxygenPiston.position.set(crew[0] + 5.5 * s, crew[1] + 6.7 * s, crew[2] + 9.2 * s); oxygenPiston.userData.causalRole = 'crew-received-oxygen';
  const foodTray = b.mesh(new T.BoxGeometry(3.8 * s, .6 * s, 2.8 * s), C.land, false); foodTray.position.set(crew[0] - 3.7 * s, crew[1] + 1.4 * s, crew[2] + 10 * s); foodTray.userData.causalRole = 'crew-received-food-tray';
  const plantGasPiston = b.mesh(new T.BoxGeometry(2.4 * s, 1.2 * s, .65 * s), C.cool, false); plantGasPiston.position.set(plants[0] + 5.3 * s, plants[1] + 2 * s, plants[2] + 9 * s); plantGasPiston.userData.causalRole = 'plant-received-gas';
  const powerSwitch = b.mesh(new T.BoxGeometry(2 * s, 1 * s, .75 * s), C.gold, false); powerSwitch.position.set(support[0] + 5 * s, support[1] + 2.3 * s, support[2] + 9.2 * s); powerSwitch.userData.causalRole = 'life-support-power-switch';
  const solar = b.box(p(.76, .43, 2), p(.94, .60, 3), '#6b8790', false); input([solar], 3, '查看太阳能供给基地');
  for (const u of [.80, .85, .90]) b.stroke([p(u, .44, 3.1), p(u, .59, 3.1)], .3);
  // All routes terminate at actual receiving parts. Their intermediate bends
  // are service runs beside the modules, never high decorative roof arches.
  const q=(at:Vec3,x:number,y:number,z:number):Vec3=>[at[0]+x*s,at[1]+y*s,at[2]+z*s];
  const waterCup=q(crew,0,3.4,10.2),waterFilter=instrumentAt,waterStore=q(resources,0,6.2,9.2);
  const waterLegs=[
    curve(b,[waterCup,q(crew,9,2.4,17),p(.30,1.32,5.4),p(.72,1.32,5.4),q(support,-9,2.4,17),waterFilter]),
    curve(b,[waterFilter,q(support,-9,2.7,16),q(resources,10,3,13),waterStore]),
    curve(b,[waterStore,q(resources,-10,3,13),q(crew,7,2.7,16),waterCup]),
  ];
  const waterPath=new T.CurvePath<import('three').Vector3>();waterLegs.forEach(path=>waterPath.add(path));
  const paths = {
    water: waterPath,
    'carbon-dioxide': curve(b,[q(crew,0,7,9),q(crew,8,6.7,9),p(.32,.76,8.5),q(plants,-7,4.1,10),q(plants,5.3,2,9)]),
    oxygen: curve(b,[q(plants,0,7,9),q(plants,-7,7,9),p(.29,.72,10),q(crew,5.5,6.7,9.2)]),
    food: curve(b,[q(plants,-4,2.5,12),p(.33,.82,5.5),q(crew,4,2.5,13),q(crew,-3.7,2.5,10)]),
    electricity: curve(b,[p(.84,.52,3.2),p(.91,.66,3),q(support,11,1.3,3),q(support,5,2.3,9.2)]),
  };
  // Short interior returns join the external purifier route to the two real
  // cartridge housings. These are pipe joints, not additional process stages.
  for(const x of [-4.5,4.5]){
    const inner=[waterFilter,q(support,x,4,5),q(support,x,4,-1)];
    const mesh=b.tube(inner,.27*s,C.cool,false);mesh.userData.causalRole='filter-cartridge-service-connection';
  }
  // Keep each run and its fittings as one assembly. Hiding just the pipe left
  // floating collars and an empty food trough in unrelated system views.
  const routeFittings=new Map<string,any[]>();
  const attachFitting=(kind:string,mesh:any)=>{
    mesh.userData.routeKind=kind;
    const parts=routeFittings.get(kind)??[];parts.push(mesh);routeFittings.set(kind,parts);
  };
  const pathMeshes = Object.entries(paths).map(([kind, path]) => {
    const color = kind === 'electricity' ? C.gold : kind === 'carbon-dioxide' ? '#9d9b8e' : kind === 'oxygen' ? C.darkGreen : kind === 'food' ? C.land : C.cool;
    let mesh:any;
    if(kind==='food'){
      // Food is an open service trough with a visible carrying surface. It
      // must not acquire the same closed-pipe language as water or gases.
      const points=path.getPoints(40),vertices:number[]=[],indices:number[]=[];
      points.forEach((at:any,i:number)=>{const tangent=path.getTangent(i/40),side=new T.Vector3(-tangent.z,0,tangent.x).normalize().multiplyScalar(1.8*s);for(const sign of [-1,1])vertices.push(at.x+side.x*sign,at.y-1.15*s,at.z+side.z*sign);if(i<40){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);}});
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();mesh=b.mesh(g,'#c5bea8',false);
      for(const sign of [-1,1]){const guide=points.map((at:any,i:number)=>{const tangent=path.getTangent(i/40),side=new T.Vector3(-tangent.z,0,tangent.x).normalize().multiplyScalar(sign*1.8*s);return [at.x+side.x,at.y-.75*s,at.z+side.z] as Vec3;});const rail=b.tube(guide,.12*s,C.rock,false);rail.userData.causalRole='open-food-trough-edge';attachFitting(kind,rail);}
      mesh.userData.causalRole='open-food-transfer-trough';
    }else mesh=b.tube(path.getPoints(kind==='water'?90:40).map((at:any)=>at.toArray()),(kind==='electricity'?.15:.25)*s,color,false);
    uniqueMaterial(b,mesh);
    const selection=kind==='water'?1:kind==='electricity'?3:2;
    mesh.userData.transferRoute={kind,start:path.getPoint(0).toArray(),end:path.getPoint(1).toArray()};
    if(kind==='water')mesh.userData.waterLegJoints=waterLegs.map(path=>({start:path.getPoint(0).toArray(),end:path.getPoint(1).toArray()}));
    input([mesh],selection,'选择这条物资联系');return {kind,mesh,color,selection};
  });
  // A pair of collars on each connection gives direction changes a physical
  // joining detail without wrapping every object in a metal frame.
  for(const [kind,path] of Object.entries(paths))if(kind!=='food')for(const t of [.04,.96]){
    const at=path.getPoint(t),axis=path.getTangent(t).normalize(),g=new T.CylinderGeometry(.47*s,.47*s,.42*s,12);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),axis));g.translate(at.x,at.y,at.z);
    const collar=b.mesh(g,C.gold,false);collar.userData.cabinPart='physical-route-collar';attachFitting(kind,collar);
  }
  const symbols = new Map<string, any>();
  for (const id of ['reclaimed-water-0', 'reclaimed-water-1', 'reclaimed-water-2', 'carbon-dioxide-transfer', 'oxygen-transfer', 'food-transfer', 'solar-electricity']) {
    const water = id.startsWith('reclaimed'), oxygen = id.startsWith('oxygen'), food = id.startsWith('food'), electric = id.startsWith('solar');
    const parts: any[] = [];
    const addPart = (geometry: any, color: string) => { const mesh = b.mesh(geometry, color, false); mesh.userData.transferId = id; parts.push(mesh); return mesh; };
    if (water) { const geometry = new T.SphereGeometry(1.5 * s, 16, 12); geometry.scale(.75, 1.5, .75); addPart(geometry, C.water); }
    else if (food) addPart(new T.BoxGeometry(3.1 * s, 2.2 * s, 2.5 * s), C.land);
    else if (electric) { const shape = new T.Shape(); [[.4, 2.2], [-1.2, -.1], [-.2, -.1], [-.7, -2.2], [1.3, .5], [.3, .5]].forEach(([x, y], i) => i ? shape.lineTo(x * s, y * s) : shape.moveTo(x * s, y * s)); shape.closePath(); addPart(new T.ExtrudeGeometry(shape, { depth: .55 * s, bevelEnabled: false }), C.gold); }
    else {
      const count = oxygen ? 2 : 3;
      for (let i = 0; i < count; i++) { const geometry = new T.SphereGeometry((oxygen ? 1.1 : i === 1 ? 1 : .95) * s, 12, 8); geometry.translate((i - (count - 1) / 2) * 1.9 * s, 0, 0); addPart(geometry, oxygen ? C.darkGreen : i === 1 ? C.rock : C.cool); }
      const bond = new T.CylinderGeometry(.22 * s, .22 * s, (count - 1) * 1.9 * s, 8); bond.rotateZ(Math.PI / 2); addPart(bond, C.ink);
    }
    parts.forEach(mesh => { mesh.userData.symbolKind = water ? 'water-drop' : food ? 'food-box' : electric ? 'electricity-mark' : oxygen ? 'oxygen-diatomic' : 'carbon-dioxide-triatomic'; });
    symbols.set(id, { parts, food, water });
  }
  const drive=mountMarsSequencer(b,s,p); let state = evaluateMarsTransfer(0),lastSelection=-1;
  const shellOverrides=new Map<number,boolean>(),shellOpening=[.82,.82,.82,.82];
  const baseBounds = () => {const low=p(-.01,.34,-5.0),high=p(1.01,1.45,24);high[2]+=14*s;return {min:low,max:high};};
  let observedCabin: number | undefined;
  const shellTarget=(i:number)=>shellOverrides.has(i)?(shellOverrides.get(i)?1:0):state.selected===0?.82:state.selected===1?(i!==1?1:.18):state.selected===2?(i<2?1:.18):(i>1?1:.18);
  // Register after cabin selection inputs, so a shell pull is an actual
  // opening action rather than another generic select button.
  cabins.forEach((cabin,i)=>{
    const opening={kind:'inspect',target:`mars-shell-${i}`,label:`开合${['乘员舱','植物舱','生保舱','资源舱'][i]}侧壳`};
    for(const pull of cabin.hatchHandles){
      // Both the physical leaf and its centre button operate the hinge.
      // The previous tiny open ring let clicks pass through into the cabin.
      for(const piece of pull.parent.children)if(piece.isMesh)piece.userData.modelInput=opening;
      pull.geometry.computeBoundingSphere();const center=pull.geometry.boundingSphere.center;
      const escutcheon=new T.CylinderGeometry(.86*s,.71*s,.34*s,24);escutcheon.rotateX(Math.PI/2);escutcheon.translate(center.x,center.y,center.z-.18*s);
      const button=b.mesh(escutcheon,'#b08e57',false,true,'brass');pull.parent.add(button);button.name='舱盖转扣';button.userData.modelInput=opening;
      pull.userData.smallPointTarget=button.userData.smallPointTarget=true;
    }
  });
  return { update(phase, selection, dt, reduced) {
    state = evaluateMarsTransfer(phase, selection); symbols.forEach(symbol => { symbol.parts.forEach((mesh: any) => { mesh.visible = false; }); });
    if(state.selected!==lastSelection){shellOverrides.clear();observedCabin=undefined;lastSelection=state.selected;}
    cabins.forEach((cabin,i)=>{const target=shellTarget(i);shellOpening[i]=reduced?target:shellOpening[i]+(target-shellOpening[i])*(1-Math.exp(-Math.min(dt,.1)*8));cabin.setOpening(shellOpening[i]);cabin.hatchHandles.forEach(mesh=>b.outline(mesh,.5));});
    pathMeshes.forEach(({ mesh, color, selection: mode, kind }) => {
      const active = state.selected === mode; mesh.visible = state.selected === 0 || active; mesh.material.color.copy(new T.Color(color).lerp(new T.Color(C.rock), active ? 0 : .62));
      routeFittings.get(kind)?.forEach(fitting=>{fitting.visible=mesh.visible;});
      if (active && kind === 'water') {
        // Stage durations are not proportional to pipe length. Highlight the
        // actual water legs so the visible front reaches a receiver together
        // with the packet that drives it, including while scrubbing backwards.
        waterLegs.forEach((leg,index)=>{
          const progress=Math.max(0,...state.packets.filter(packet=>packet.kind==='water'&&packet.visible).map(packet=>
            (packet.leg??0)>index?1:(packet.leg??0)===index?(packet.legProgress??0):0));
          partial(b,leg,progress,'flow',1.0);
        });
      } else if (active) partial(b, paths[kind as keyof typeof paths], state.packets.find(packet => packet.kind === kind)?.progress ?? 0, 'accent', 1.0);
    });
    state.packets.forEach(packet => {
      const symbol = symbols.get(packet.id); if (!symbol) return;
      const at = packet.kind === 'water' ? waterLegs[packet.leg ?? 0].getPoint(packet.legProgress ?? 0) : paths[packet.kind].getPoint(packet.progress);
      if (packet.received && packet.kind === 'water') { const i = Number(packet.id.at(-1)), dock = skyEase(.94 + i * .025, Math.min(1, .97 + i * .025), phase); at.x += (i - 1) * 1.6 * s * dock; at.y += .7 * s * dock; at.z += 1.2 * s * dock; }
      if (packet.received && packet.kind === 'food') { at.y -= .8 * s * state.crewFoodResponse; at.z += 1.4 * s * state.crewFoodResponse; }
      symbol.parts.forEach((mesh: any) => { mesh.visible = packet.visible; mesh.position.copy(at); if (mesh.visible) b.outline(mesh, .7); });
    });
    const responses = [Math.max(state.crewOxygenResponse, state.crewFoodResponse, state.crewWaterReceived ? 1 : 0), state.plantResponse, Math.max(state.purifierResponse, state.powerResponse), state.reservoirResponse];
    windows.forEach((mesh, i) => { mesh.material.color.copy(new T.Color('#aabfc1').lerp(new T.Color(i === 1 ? C.green : C.water), responses[i] * .7)); b.outline(mesh, .3 + responses[i] * .25); });
    plantLeaves.forEach(mesh => { mesh.material.color.copy(new T.Color(C.green).lerp(new T.Color(C.darkGreen), state.plantResponse * .7)); });
    rotor.rotation.z = rotorCross.rotation.z = state.purifierStroke * Math.PI * .65; b.outline(rotor, .6); b.outline(rotorCross, .6);
    valve.rotation.z = state.purifierStroke * Math.PI * .45; b.outline(valve, .65);
    const tankFraction = .06 + .94 * state.reservoirResponse; tank.scale.y = tankFraction; tank.position.set(resources[0], resources[1] + (.7 + 2.6 * tankFraction) * s, resources[2] + 9.2 * s);
    b.contour([[resources[0] - 3.8 * s, resources[1] + .5 * s, resources[2] + 9.6 * s], [resources[0] - 3.8 * s, resources[1] + 6.1 * s, resources[2] + 9.6 * s], [resources[0] + 3.8 * s, resources[1] + 6.1 * s, resources[2] + 9.6 * s], [resources[0] + 3.8 * s, resources[1] + .5 * s, resources[2] + 9.6 * s]], .65);
    drinkingWater.scale.y = .05 + .95 * state.crewWaterResponse; drinkingWater.position.set(crew[0], crew[1] + (.65 + 1.1 * drinkingWater.scale.y) * s, crew[2] + 10.2 * s);
    oxygenPiston.position.y = crew[1] + (6.7 + 2.7 * state.crewOxygenResponse) * s; b.outline(oxygenPiston, .7);
    plantGasPiston.position.y = plants[1] + (2 + 3.4 * state.plantResponse) * s; b.outline(plantGasPiston, .7);
    foodTray.position.z = crew[2] + (9 + 2.4 * state.crewFoodResponse) * s; b.outline(foodTray, .65);
    powerSwitch.rotation.z = state.powerResponse * Math.PI / 2; b.outline(powerSwitch, .65);
    for (const [at, x, low, high] of [[crew, 5.5, 6.1, 10.2], [plants, 5.3, 1.2, 6.3]] as const) b.contour([[at[0] + (x - 1.4) * s, at[1] + low * s, at[2] + 9.7 * s], [at[0] + (x - 1.4) * s, at[1] + high * s, at[2] + 9.7 * s], [at[0] + (x + 1.4) * s, at[1] + high * s, at[2] + 9.7 * s], [at[0] + (x + 1.4) * s, at[1] + low * s, at[2] + 9.7 * s]], .4);
    moduleSurfaces.forEach((meshes, i) => { if (state.selected > 0 && ([0, 2, 1, 3][i] === state.selected || i === 0 && state.selected < 3)) meshes.slice(0, 3).forEach(mesh => b.outline(mesh, .5)); });
    drive.update(phase,state.selected);
  }, inspect(target){
    const match=/^mars-shell-([0-3])$/.exec(target);
    if (!match) { observedCabin=undefined; return; }
    const i=Number(match[1]), open=shellTarget(i)<.5;
    shellOverrides.set(i,open);
    observedCabin=open ? i : undefined;
  },
    inspectTargets:()=>cabins.map((_,i)=>({target:`mars-shell-${i}`,label:`开合${['乘员舱','植物舱','生保舱','资源舱'][i]}侧壳`})),
    overviewBounds: baseBounds,
    focusBounds: () => {
      if (observedCabin === undefined) return baseBounds();
      const [x,y,z]=centers[observedCabin];
      return {min:[x-22*s,y-2*s,z-12*s], max:[x+22*s,y+17*s,z+16*s]};
    },
    describe: () => ({ kind: 'mars-base', ...state, construction:'longitudinal-thick-shell-cutaway-cabins',terrain:'continuous-irregular-regolith-with-prepared-contacts',manualDrive:{kind:'capstan-and-carriage',circumference:drive.travel,crankAngle:drive.handle.rotation.z},shellOpening:[...shellOpening],shellActions:'direct-physical-pulls',waterLegJoints:waterLegs.map(path=>({start:path.getPoint(0).toArray(),end:path.getPoint(1).toArray()})),foodTransport:'open-service-trough',receivingPartsOnCabinFloor:true,selectedCircuitOnly: true, receivingIndicatorsFollowArrival: true, chemicalSpeciesRemainDistinct: true, materialShapes: ['water-drop', 'carbon-dioxide-triatomic', 'oxygen-diatomic', 'food-box', 'electricity-mark'], receiverGeometryRetainsEndState: true, phaseMeaning: 'transfer-explanation-order' }) };
}

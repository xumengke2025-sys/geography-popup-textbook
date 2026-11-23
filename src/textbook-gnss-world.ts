import { surveyBench } from './textbook-survey-bench';
import { globeLandRelief } from './textbook-globe-relief';
import { mergeInstrumentGeometry } from './textbook-instrument-parts';
import type { SolidMaterialRole } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { GNSS_LAYOUT, GNSS_REFERENCE, GNSS_STOPS, evaluateGnss, gnssSpacecraft, gnssMonitorDish, gnssGlobeLines,
  gnssSegmentClearance, gnssVehiclePoint, evaluateGnssInspection, type GnssPoint } from './textbook-gnss-model';

/** A continuous desktop navigation globe: the complete system stays in place. Signals
 * travel once, arrive, and only then permit the location/communication/result
 * marks. Navigation arrows never double as distress uplinks. */
export function buildGnssWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, back = -LIFT_MARGIN - 82 * s, rise = 40 * s;
  const p = ([x, y, z]: readonly number[]): Vec3 => [x * s, y * s, back + z * s];
  b.root.position.set(0, rise, 0);
  const bench=surveyBench(b,s,p);
  const finishes:Record<string,[SolidMaterialRole,string]>={
    earth:['enamel','#3e6664'],'satellite-body':['brass','#bc975c'],'satellite-panel':['enamel','#2d475a'],
    'array-hinge':['steel','#64706d'],'satellite-antenna':['ivory','#d8c9ab'],'ground-monitor':['enamel','#365247'],
    'user-receiver':['ivory','#e8dac0'],'independent-communication-device':['brass','#af8156'],
    'rescue-station':['enamel','#426258'],'monitor-dish':['brass','#bea573']
  };
  const solid = (geometry: any, color: string, role: string) => {
    const finish=finishes[role],mesh=b.mesh(geometry,finish?.[1]??color,false,true,finish?.[0]);
    mesh.userData.gnssRole=role;return mesh;
  };
  const select = (mesh: any, selection: number, label: string) => {
    mesh.userData.modelInput = { kind: 'select', selection, label }; return mesh;
  };
  const box = (center: GnssPoint, size: GnssPoint, color: string, role: string) => {
    const mesh = solid(new T.BoxGeometry(...size.map(v => v * s)), color, role); mesh.position.set(...p(center)); return mesh;
  };
  const sphere = (point: GnssPoint, radius: number, color: string, role: string) => {
    const mesh = solid(new T.SphereGeometry(radius * s, 20, 14), color, role); mesh.position.set(...p(point)); return mesh;
  };
  const plus = (point: GnssPoint, offset: GnssPoint): GnssPoint => point.map((v, i) => v + offset[i]) as GnssPoint;
  const stem = (point: GnssPoint, height: number, radius: number, color: string, role: string) => {
    const mesh = solid(new T.CylinderGeometry(radius * s, radius * s, height * s, 12), color, role);
    mesh.position.set(...p(plus(point, [0, height / 2, 0]))); return mesh;
  };

  const globe = solid(new T.SphereGeometry(GNSS_LAYOUT.earth.radius * s, 40, 28), '#adc5c5', 'earth');
  globe.position.set(...p(GNSS_LAYOUT.earth.center));
  bench.bed(-5,98,1,76.5);
  bench.column([47,.1,25],[47,6.25,25],5);
  const land=bench.mount(globeLandRelief(GNSS_LAYOUT.earth.radius*s,8),'brass','#a78d61','chased continent inlays');
  land.position.copy(globe.position);land.rotation.y=-.36;
  for (const line of gnssGlobeLines()) b.stroke(line.map(p), .25);
  // A fixed horseshoe and two side bearings cradle the globe.
  const meridian=(a:number,r:number):Vec3=>[47+Math.cos(a)*r,28+Math.sin(a)*r,25];
  const angles=Array.from({length:61},(_,i)=>-.1+Math.PI*1.21*i/60);
  bench.curve(angles.map(a=>meridian(a,24.55)),.67,'brass','quadrant arc');
  for(const x of [22.75,71.25]){
    bench.column([x,.12,25],[x,28,25],2.6);
    bench.parts.bearing(p([x,28,25]),[1,0,0],1.85*s,3.9*s);
  }
  const ticks=Array.from({length:37},(_,i)=>{
    const a=Math.PI*i/36,from=new T.Vector3(...p(meridian(a,24.55))),to=new T.Vector3(...p(meridian(a,i%3?25.28:25.8)));
    const axis=to.clone().sub(from),g=new T.CylinderGeometry(.10*s,.10*s,axis.length(),5);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),axis.normalize()));return g.translate(...from.lerp(to,.5).toArray());
  });
  bench.mount(mergeInstrumentGeometry(ticks),'brass','#cab27d','quadrant divisions');
  // The four spacecraft on the upper gallery are fixed teaching positions.
  const gallery:Vec3[]=GNSS_LAYOUT.satellites.map(([x,y,z])=>[x,y-4.4,z-6.3]);
  bench.curve(gallery,1.11,'brass','spatial demonstration rail');
  const parallel=gallery.map(([x,y,z]):Vec3=>[x,y-1.7,z-1.55]);
  bench.curve(parallel,.49,'steel','gallery spine');
  for(const i of [0,3]){
    const [x,y,z]=gallery[i];
    bench.column([x,.12,42],[x,y-5,z-3],2.76);
    bench.curve([[x,y-7,z-4],[x,y-3,z-1.7],[x,y,z]],1.2,'brass','gallery shoulder');
  }
  gallery.forEach(([x,y,z],i)=>{
    const [a,h,c]=GNSS_LAYOUT.satellites[i];
    bench.turning([x,y-1,z],[a,h-1.4,c],[[.97,0],[1.2,.1],[.87,.24],[.65,.72],[1.06,.83],[1.06,1]],'brass','satellite carriage');
  });

  const satellites = GNSS_LAYOUT.satellites.map((at, i) => {
    const craft=gnssSpacecraft(at);
    const observe={kind:'inspect',target:`sat-${i}`,toggleTo:'overview',label:`查看卫星${i+1}到用户的接收链路，保持过程时刻`};
    const meshes=craft.parts.map(part=>{
      const position:number[]=[];
      for(const face of part.faces)for(let j=1;j<face.length-1;j++){
        for(const index of [face[0],face[j],face[j+1]]){
          const q=part.vertices[index];
          position.push((q[0]-at[0])*s,(q[1]-at[1])*s,(q[2]-at[2])*s);
        }
      }
      const geometry=new T.BufferGeometry();
      geometry.setAttribute('position',new T.Float32BufferAttribute(position,3));geometry.computeVertexNormals();
      const mesh=solid(geometry,part.color,part.role);
      mesh.position.set(...p(at));mesh.userData.modelInput=observe;
      return mesh;
    });
    const body=meshes[0],wings=meshes.filter(mesh=>mesh.userData.gnssRole==='satellite-panel');
    body.userData.gnssId=`sat-${i}`;
    for(const cell of craft.cells)b.stroke(cell.map(p),.28);
    return { body, wings };
  });

  const monitor = GNSS_LAYOUT.monitor;
  const monitorBox = select(box(plus(monitor, [0, 1.1, 0]), [5, 2.2, 4], '#ded2bb', 'ground-monitor'), 0, '查看地面监控部分');
  const reflector=gnssMonitorDish(), bowl:number[]=[];
  for(let ring=1;ring<reflector.rings.length;ring++){
    const outer=reflector.rings[ring],inner=reflector.rings[ring-1];
    for(let i=0;i<outer.length;i++){
      const j=(i+1)%outer.length;
      for(const point of [inner[i],outer[i],outer[j],inner[i],outer[j],inner[j]])bowl.push(...p(point));
    }
  }
  const bowlGeometry=new T.BufferGeometry();
  bowlGeometry.setAttribute('position',new T.Float32BufferAttribute(bowl,3));bowlGeometry.computeVertexNormals();
  const dish=select(solid(bowlGeometry,'#eee1c6','monitor-dish'),0,'查看地面监控与卫星联系');
  const strut=(a:GnssPoint,c:GnssPoint,r:number,role:string)=>{
    const from=new T.Vector3(...p(a)),to=new T.Vector3(...p(c)),delta=to.clone().sub(from);
    const mesh=solid(new T.CylinderGeometry(r*s,r*s,delta.length(),10),'#a78c5c',role);
    mesh.position.copy(from).lerp(to,.5);
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
    select(mesh,0,'查看地面监控与卫星联系');
  };
  strut(plus(monitor,[0,1.9,0]),reflector.foot,.4,'dish-pivot');
  for(const [a,c] of reflector.legs)strut(a,c,.095,'dish-feed-arm');
  select(sphere(reflector.feed,.30,'#a78c5c','ground-antenna'),0,'查看地面监控与卫星联系');
  const monitorLight = sphere(plus(monitor, [1.8, 2.5, 1.3]), .38, '#8c9a7d', 'monitor-status');

  const receiver = GNSS_LAYOUT.receiver;
  const receiverBox = select(box(plus(receiver, [0, 1.4, 0]), [2.5, 2.8, 1.5], '#f1e8d6', 'user-receiver'), 1, '查看用户接收与定位');
  box(plus(receiver, [0, 1.7, .8]), [1.6, 1.3, .13], '#6e94a0', 'receiver-screen');
  stem(plus(receiver, [0, 2.5, 0]), 1.5, .12, '#8f8267', 'receiver-antenna');
  const leds = GNSS_LAYOUT.satellites.map((_, i) => sphere(plus(receiver, [-.75 + i * .5, .75, .85]), .22, '#6d8c70', 'received-signal-led'));
  const communication = select(box(plus(receiver, [2.4, 1.4, 0]), [1.4, 2.7, 1], '#b98b5f', 'independent-communication-device'), 2, '定位信息经独立通信设备发送');
  stem(plus(receiver, [2.4, 2.7, 0]), .8, .10, '#8f7858', 'communication-antenna');

  const base = GNSS_LAYOUT.rescueBase;
  const baseBox = select(box(plus(base, [0, 1.1, 0]), [4, 2.2, 3], '#d8c5a6', 'rescue-station'), 2, '查看收到位置后的救援行动');
  stem(plus(base, [0, 2, 0]), 2.2, .15, '#9b815d', 'rescue-station-antenna');
  const baseLight = sphere(plus(base, [0, 4.4, 0]), .4, '#b98b5f', 'message-received-light');

  let state = evaluateGnss(0), inspection = 'overview';
  const roadCurve = new T.CatmullRomCurve3(state.road.map(point => new T.Vector3(...p(point))), false, 'catmullrom', .15);
  const road = select(solid(new T.TubeGeometry(roadCurve, 48, .46 * s, 6, false), '#e5dcc8', 'rescue-road'), 2, '收到位置信息后沿示意路线接近目标');
  b.stroke(state.road.filter((_, i) => i % 2 === 0).map(p), .24);
  const vehicleParts = [
    { local: [0, 1, 0] as GnssPoint, mesh: solid(new T.BoxGeometry(4 * s, 1.5 * s, 2.4 * s), '#b98b5f', 'rescue-vehicle-body') },
    { local: [-.35, 2.05, 0] as GnssPoint, mesh: solid(new T.BoxGeometry(1.8 * s, 1 * s, 2.1 * s), '#f0e7d6', 'rescue-vehicle-cabin') },
    ...[-1.3, 1.3].flatMap(x => [-1.25, 1.25].map(z => {
      const geometry = new T.CylinderGeometry(.53 * s, .53 * s, .35 * s, 12); geometry.rotateX(Math.PI / 2);
      return { local: [x, .52, z] as GnssPoint, mesh: solid(geometry, '#676a5d', 'rescue-vehicle-wheel') };
    })),
  ];
  for (const part of vehicleParts) select(part.mesh, 2, '查看依据收到位置前往目标的救援车');

  const positionPin = solid(new T.ConeGeometry(.65 * s, 1.7 * s, 14), '#aa744c', 'position-result-pin');
  positionPin.rotation.z = Math.PI;
  const signals = state.signals.map(signal => {
    const color = signal.kind === 'communication' ? '#b38152' : signal.kind === 'navigation' ? '#648e99' : '#869780';
    const mesh = sphere(signal.source, .52, color, 'signal-tracer'); mesh.userData.gnssId = signal.id; return mesh;
  });
  const links=state.signals.map((signal,i)=>{
    const source=new T.Vector3(...p(signal.source)),end=new T.Vector3(...p(signal.target));
    const delta=end.clone().sub(source);
    const mesh=solid(new T.CylinderGeometry(.14*s,.14*s,delta.length(),6),
      signal.kind==='communication'?'#bd804d':signal.kind==='navigation'?'#6698a4':'#849572','signal-link');
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
    mesh.userData.gnssId=signal.id;mesh.raycast=()=>{};
    return {mesh,source,end};
  });
  const keyPositions:Vec3[]=[[10,1.17,60.5],[34,1.17,60.5],[58,1.17,60.5],[82,1.17,60.5]];
  const labels=GNSS_LAYOUT.labels.map((spec,i)=>{
    const mesh=bench.key(spec.text,keyPositions[i],19.9,9.2,spec.selection,GNSS_STOPS[spec.selection].label);
    mesh.userData.gnssRole='node-label';mesh.userData.gnssSelection=spec.selection;return mesh;
  });
  // Four shuttered telltales register separate navigation links at the bench.
  bench.casting([32,.1,49.3],[60,1.4,55.9],'brass','four-channel register');
  const tells=GNSS_LAYOUT.satellites.map((_,i)=>{
    const x=35.8+i*6.7,at:Vec3=[x,1.52,52.5];
    const bezel=bench.turning(at,[x,1.87,52.5],[[2.1,0],[2.12,.18],[1.9,.94],[1.85,1]],'enamel','channel shutter');
    const lens=solid(new T.SphereGeometry(1.59*s,24,12),'#9cbe8a','received-channel-window');
    lens.position.set(...p([x,1.81,52.5]));lens.scale.y=.28;
    for(const part of [bezel,lens]) part.userData.modelInput={kind:'inspect',target:'sat-'+i,toggleTo:'overview',label:'查看卫星'+(i+1)+'的接收链路'};
    return lens;
  });
  const drive=bench.carriage(GNSS_LAYOUT.track.start,GNSS_LAYOUT.track.end,'推拉铜轨上的木柄，回看监控、接收定位和通信助援');
  const {grip:front,track}=drive;front.userData.gnssRole='process-front';
  const buffers = b.meshes.map(mesh => mesh.geometry.attributes.position.array);
  const basis = new T.Matrix4();
  const motion: ModelMotion = {
    update(phase) {
      state = evaluateGnss(phase);
      const observation = evaluateGnssInspection(phase, inspection);
      if (observation.signal) for (let i = 0; i < 24; i += 2) b.contour([i, i + 1].map(q => observation.signal!.source.map((value, axis) => value + (observation.signal!.target[axis] - value) * q / 24) as GnssPoint).map(p), .32);
      state.signals.forEach((signal, i) => {
        const mesh = signals[i]; mesh.position.set(...p(signal.point)); mesh.visible = signal.status === 'moving';
        const focused = signal.kind === 'communication' ? state.selection === 2
          : signal.kind === 'navigation' ? state.selection === 1 : state.selection === 0;
        const link=links[i];
        // The outbound and return monitoring contacts share a line of sight.
        // Show the returning front over the faint original contact without coincident tubes.
        link.mesh.visible=signal.progress>0 && !(i===0 && state.signals[1].progress>0);
        if(link.mesh.visible){
          const width=observation.signal?(signal.id===observation.signal.id?1.6:.42):(focused?1.25:.60);
          link.mesh.position.copy(link.source).lerp(link.end,signal.progress/2);
          link.mesh.scale.set(width,signal.progress,width);
        }
      });
      monitorLight.visible = state.signals[0].status === 'arrived'; baseLight.visible = state.communicationDelivered;
      leds.forEach((led, i) => { led.visible = state.receivedSignalIds.includes(`nav-${i}`); });
      for (const led of leds) if (led.visible) b.outline(led, state.selection === 1 ? .45 : .24);
      if (monitorLight.visible) b.outline(monitorLight, .42);
      if (baseLight.visible) b.outline(baseLight, .48);
      positionPin.visible = state.positionMark > 0;
      positionPin.position.set(...p(plus(receiver, [0, 5.2 + state.positionMark * 2.5, 0])));
      positionPin.scale.y = Math.max(.01, state.positionMark);
      const vehicle = state.rescue;
      basis.makeBasis(new T.Vector3(...vehicle.forward), new T.Vector3(...vehicle.up), new T.Vector3(...vehicle.side));
      vehicleParts.forEach(part => {
        part.mesh.position.set(...p(gnssVehiclePoint(vehicle, part.local))); part.mesh.quaternion.setFromRotationMatrix(basis); b.outline(part.mesh, .30);
      });
      drive.move(state.phase);
      tells.forEach((mesh,i)=>{mesh.visible=state.receivedSignalIds.includes("nav-"+i);});
      labels.forEach((label, i) => { label.userData.gnssActive = GNSS_LAYOUT.labels[i].selection === state.selection; });
      for (const [i, satellite] of satellites.entries()) { const chosen = i === observation.satellite; b.outline(satellite.body, chosen ? .85 : .35); for (const panel of satellite.wings) b.outline(panel, chosen ? .6 : .28); }
      for (const mesh of [monitorBox, dish, receiverBox, communication, baseBox]) b.outline(mesh, .35);
    },
    inspect(target) { inspection = evaluateGnssInspection(0, target).inspection; },
    focusBounds: () => ({ min: p([-6,-5.8,1]), max: p([100,79,76.5]) }),
    framingPoints: () => [[-5,1],[98,1],[-5,76.5],[98,76.5]].flatMap(([x,z])=>[p([x,-5.8,z]),p([x,2,z])]).concat(
      GNSS_LAYOUT.satellites.flatMap(([x,y,z])=>[p([x-9,y+6,z]),p([x+9,y+6,z])])),
    describe: () => {
      b.root.updateWorldMatrix(true, true);
      const world = (point: Vec3): Vec3 => new T.Vector3(...point).applyMatrix4(b.root.matrixWorld).toArray() as Vec3;
      const meshWorld = (mesh: any): Vec3 => mesh.getWorldPosition(new T.Vector3()).toArray() as Vec3;
      return { kind: 'gnss-three-segments', phase: state.phase, stage: state.stage, stageIndex: state.stageIndex,
        inspection, observation: evaluateGnssInspection(state.phase, inspection),
        selection: state.selection, mode: state.selection, state, caption: state.caption, explanation: state.explanation,
        source: GNSS_REFERENCE, segments: ['space', 'ground-control', 'user'], displayedSatellites: 4,
        completeStructureAlwaysPresent: true, constellationCountIsSchematic: true,
        communicationRequiredForDistress: true, passiveReceiverTransmitsDistress: false,
        solvedCoordinates: false, accuracyCalculated: false, actualOrbits: false,
        earthWorld: { center: meshWorld(globe), radius: GNSS_LAYOUT.earth.radius * s },
        satelliteWorld: satellites.map((satellite, i) => ({ id: `sat-${i}`, point: meshWorld(satellite.body) })),
        receiverWorld: world(p(receiver)), monitorWorld: world(p(monitor)), rescueBaseWorld: world(p(base)),
        linkWorld: state.signals.map(signal => ({ id: signal.id, kind: signal.kind, status: signal.status,
          source: world(p(signal.source)), target: world(p(signal.target)), point: world(p(signal.point)),
          earthClearance: gnssSegmentClearance(signal.source, signal.target) * s })),
        vehicleWorld: { id: state.rescue.id, progress: state.rescue.progress, point: world(p(state.rescue.position)),
          up: state.rescue.up, forward: state.rescue.forward },
        roadWorld: state.road.map(point => world(p(point))), nodeStops: GNSS_STOPS,
        nodeWorld: labels.map((mesh, i) => ({ selection: GNSS_LAYOUT.labels[i].selection, point: meshWorld(mesh) })),
        handleWorld: meshWorld(front), phaseTrackWorld: { start: world(track.start), end: world(track.end) },
        geometryBuffersReused: buffers.every((buffer, i) => b.meshes[i]?.geometry.attributes.position.array === buffer),
        elevatedAbovePage: rise, directInteraction: 'segment-click-and-process-front-drag',
      };
    },
  };
  motion.update(0, 0, 0, true); return motion;
}
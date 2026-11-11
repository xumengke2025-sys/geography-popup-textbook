import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry, ModelMotion, Vec3 } from './textbook-geometry';
import { chamferedPlateGeometry, castBodyGeometry, pedestalColumnGeometry, mergeInstrumentGeometry, turnedShaftGeometry, createInstrumentParts } from './textbook-instrument-parts';
import { globeLandRelief } from './textbook-globe-relief';
import { galaxySpecimenGeometry } from './textbook-galaxy-specimen';
import type { SolidMaterialRole } from './textbook-solid-materials';

const NAMES = ['地月系', '太阳系', '银河系', '可观测宇宙'];
const FINISH = { brass: '#a88b50', steel: '#929b98', enamel: '#30443b', wood: '#544534', ivory: '#e3ddc9' };
const clampSelection = (n: number) => Math.max(0, Math.min(3, Math.round(Number.isFinite(n) ? n : 0)));

/** Four permanent stations on one inclined armature. Their arrangement is a
 * magnification diagram, not real positions, scale, or celestial machinery. */
export function buildCosmicInstrumentWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, c = b.p(.49, .77, 0);
  const root = new T.Group(); root.name = 'cosmic-inset-observation-instrument'; root.position.set(...c); root.scale.setScalar(s); b.root.add(root);
  root.userData.rigidFormationGroup={start:.03,offset:[0,-6*s,0],angle:-.045,axis:'x'};
  const part = (geo: any, role: SolidMaterialRole, name: string, parent = root, color?: string) => {
    const mesh = b.mesh(geo, color ?? FINISH[role as keyof typeof FINISH], false, true, role);
    parent.add(mesh); mesh.name = name; mesh.userData.cosmicInstrument = name; return mesh;
  };
  const shaft = (a: Vec3, z: Vec3, r: number, role: SolidMaterialRole, name: string, parent = root) =>
    part(turnedShaftGeometry(a, z, [[r, 0], [r, 1]]), role, name, parent);
  const plate = (a: Vec3, z: Vec3, role: SolidMaterialRole, name: string, parent = root) =>
    part(chamferedPlateGeometry(a, z, .18), role, name, parent);
  const tube = (points: Vec3[], radius: number, role: SolidMaterialRole, name: string, parent = root) =>
    part(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))), Math.max(16, Math.min(80, points.length)), radius, 6, false), role, name, parent);
  const orb = (r: number, at: Vec3, role: SolidMaterialRole, name: string, parent = root, scale: Vec3 = [1, 1, 1], color?: string) => {
    const g = new T.SphereGeometry(r, name === 'earth-globe' ? 64 : 32, name === 'earth-globe' ? 40 : 20); g.scale(...scale); const m = part(g, role, name, parent, color); m.position.set(...at); return m;
  };
  const pick = (mesh: any, selection: number) => { mesh.userData.modelInput = { kind: 'select', selection, label: `观察${NAMES[selection]}` }; mesh.userData.cosmicSelection = selection; return mesh; };
  const group = (name: string, at: Vec3) => { const g = new T.Group(); g.name = name; g.position.set(...at); root.add(g); return g; };
  const arc = (cx: number, cy: number, r: number, z: number, from = 0, to = Math.PI * 2, n = 96): Vec3[] =>
    Array.from({ length: n + 1 }, (_, i) => { const a = from + (to - from) * i / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]; });
  const hardware = createInstrumentParts(b, root);


  // A thin sole and one inclined casting carry all four trunnions. There is
  // no tall box below the subject and no separate stand for each specimen.
  part(castBodyGeometry([-42, .5, -20], [42, 1.8, 12], .5), 'wood', 'shallow-timber-sole');
  part(mergeInstrumentGeometry([[-36,-14],[36,-14],[0,9]].map(([x,z])=>
    turnedShaftGeometry([x,0,z],[x,.7,z],[[1.7,0],[1.7,.3],[1.35,.6],[1.35,1]]))),
    'enamel','three-contact-levelling-feet');
  const soleEdge=mergeInstrumentGeometry([
    chamferedPlateGeometry([-41.5,1.8,-19.5],[41.5,2.04,-19.2],.04),
    chamferedPlateGeometry([-41.5,1.8,11.2],[41.5,2.04,11.5],.04),
    chamferedPlateGeometry([-41.5,1.8,-19.2],[-41.2,2.04,11.2],.04),
    chamferedPlateGeometry([41.2,1.8,-19.2],[41.5,2.04,11.2],.04),
  ]);
  part(soleEdge,'brass','fine-cut-sole-edge');
  // A low front edge carries the four detents. The title is fitted to this
  // edge, rather than enlarging the entire foundation to hold a sign.
  const bedProfile=new T.Shape();
  bedProfile.moveTo(4.5,2.04);bedProfile.lineTo(11,2.04);bedProfile.lineTo(11,5.2);
  bedProfile.lineTo(4.5,4.875);bedProfile.closePath();
  const bedGeometry=new T.ExtrudeGeometry(bedProfile,{depth:43.8,bevelEnabled:true,
    bevelSize:.18,bevelThickness:.18,bevelSegments:2,curveSegments:1});
  // Shape x is fore/aft, y is height; extrusion spans the instrument width.
  bedGeometry.applyMatrix4(new T.Matrix4().set(0,0,-1,21.9, 0,1,0,0, 1,0,0,0, 0,0,0,1));
  part(bedGeometry,'enamel','integrated-observation-bed');
  // Twin rails expose the working objects. A large opaque diagonal bracket
  // would dominate the silhouette and hide the small astronomical specimens.
  part(pedestalColumnGeometry([-33,3,-16.4],[-33,21,-16.4],2.0),'brass','armature-raised-left-foot');
  const guideGeometry=mergeInstrumentGeometry([
    turnedShaftGeometry([-33,21,-14.8],[35,66.3,-14.8],[[.67,0],[.67,1]]),
    turnedShaftGeometry([-33,21,-18],[35,66.3,-18],[[.67,0],[.67,1]]),
  ]);
  part(guideGeometry,'steel','continuous-inclined-armature');
  shaft([32,3,-16.4],[28,62,-16.4],.58,'steel','armature-rear-stay');
  part(pedestalColumnGeometry([32,2.04,-16.4],[32,5,-16.4],1.8),'brass','rear-stay-foot');
  hardware.fasteners([[-33,3.1,-16.3],[32,2.15,-16.3]], [0,1,0], .5);
  // An operable, shaft-mounted handwheel scrubs this teaching instrument.
  // Its fork and spindle meet the column; it is not a floating UI badge or
  // a claim that celestial motion is physically powered by clockwork.
  shaft([-33,11,-16.4],[-41,11,-16.4],.75,'enamel','handwheel-bearing-outrigger');
  hardware.bearing([-41,11,-15],[0,0,1],1.35,3.4);
  shaft([-41,11,-17],[-41,11,12],.46,'steel','phase-wheel-to-column-spindle');
  const wheel=group('operable-phase-handwheel',[-41,11,12]);
  const wheelInput={kind:'phase-dial',dial:{center:[c[0]-41*s,c[1]+11*s,c[2]+12*s],radiusX:4.6*s,radiusY:4.6*s},
    label:'转动手轮，连续观察天体示意'};
  const wheelRim=tube(arc(0,0,4.6,0),.34,'brass','phase-wheel-rim',wheel);
  wheelRim.userData.modelInput=wheelInput;
  const spokes:any[]=[];
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2;spokes.push(turnedShaftGeometry([Math.cos(a)*.8,Math.sin(a)*.8,0],[Math.cos(a)*4.3,Math.sin(a)*4.3,0],[[.17,0],[.17,1]]));
  }
  const wheelSpokes=part(mergeInstrumentGeometry(spokes),'brass','phase-wheel-spokes',wheel);wheelSpokes.userData.modelInput=wheelInput;
  const wheelHub=part(turnedShaftGeometry([0,0,-.4],[0,0,.55],[[.85,0],[1.05,.2],[1.05,.7],[.65,1]]),'brass','phase-wheel-hub',wheel);wheelHub.userData.modelInput=wheelInput;
  const grip=shaft([0,-4.6,.1],[0,-4.6,2.15],.47,'wood','phase-wheel-crank-grip',wheel);grip.userData.modelInput=wheelInput;

  const earthMoon = group('earth-moon-working-specimen', [0, 34.6, 0]);
  const local = createInstrumentParts(b, earthMoon);
  const earthRadius = 13.4, lunarRadius = 23.7;
  pick(orb(earthRadius, [0, 0, 1.7], 'enamel', 'earth-globe', earthMoon, [1, 1, 1], '#537d80'), 0);
  // A painted teaching globe, not a metallic planet or a geographical map.
  const land = pick(part(globeLandRelief(earthRadius,12), 'land', 'schematic-earth-land-relief', earthMoon, '#b0ac86'), 0); land.position.z = 1.7;
  shaft([0, -15.5, 1.7], [0, 15.5, 1.7], .28, 'steel', 'earth-polar-spindle', earthMoon);
  const meridian = tube(arc(0, 0, 15.1, 0), .31, 'brass', 'earth-carried-meridian', earthMoon); meridian.rotation.y = .9; meridian.position.z = 1.7;
  // Fine graticule belongs to the globe's painted surface. It reveals the
  // sphere's curvature without turning the Earth into another metal cage.
  const graticule: any[] = [];
  const gridRadius=earthRadius*1.012+.085;
  for (const lat of [-60, -30, 0, 30, 60]) {
    const phi = lat * Math.PI / 180, r = gridRadius * Math.cos(phi);
    const pts = Array.from({length:97}, (_,i) => {
      const a=i*Math.PI/48; return new T.Vector3(Math.cos(a)*r,Math.sin(phi)*gridRadius,1.7+Math.sin(a)*r);
    });
    graticule.push(new T.TubeGeometry(new T.CatmullRomCurve3(pts),48,.09,4,false));
  }
  for (let i=0;i<6;i++) {
    const phi=i*Math.PI/6,pts=Array.from({length:97},(_,j)=>{
      const a=j*Math.PI/48; return new T.Vector3(Math.cos(a)*Math.cos(phi)*gridRadius,Math.sin(a)*gridRadius,1.7+Math.cos(a)*Math.sin(phi)*gridRadius);
    });
    graticule.push(new T.TubeGeometry(new T.CatmullRomCurve3(pts),48,.075,4,false));
  }
  const grid=part(mergeInstrumentGeometry(graticule),'enamel','painted-globe-graticule',earthMoon,'#4a6d6b');
  grid.castShadow=false;grid.receiveShadow=false;
  const graduation: any[]=[];
  for(let i=0;i<72;i++) {
    const a=i*Math.PI/36,r0=14.45,r1=i%6===0?15.02:14.78;
    graduation.push(turnedShaftGeometry([Math.cos(a)*r0,Math.sin(a)*r0,0],[Math.cos(a)*r1,Math.sin(a)*r1,0],[[.035,0],[.035,1]]));
  }
  const meridianTicks=part(mergeInstrumentGeometry(graduation),'ivory','meridian-division-marks',earthMoon);
  meridianTicks.rotation.copy(meridian.rotation);meridianTicks.position.copy(meridian.position);
  local.bearing([0, 0, -.7], [0, 0, 1], 2.5, 2.4);
  const lunarReference = pick(tube(arc(0, 0, lunarRadius, -.8), .10, 'brass', 'lunar-orbit-reference', earthMoon), 0);
  lunarReference.userData.cosmicBoundary = 'instrument-reference-not-cosmic-shell';
  const moonCarrier = new T.Group(); moonCarrier.name = 'supported-lunar-carriage'; earthMoon.add(moonCarrier);
  pick(orb(3.1, [0, 0, 1.7], 'ivory', 'moon-globe', moonCarrier, [1,1,1], '#c5bea5'), 0);
  shaft([0, 0, -1.8], [0, 0, 1.7], .25, 'steel', 'moon-to-arm-socket', moonCarrier);
  const lunarArm = shaft([0, 0, -1.8], [1, 0, -1.8], .32, 'steel', 'radial-lunar-support', earthMoon);
  const lunarHub = part(turnedShaftGeometry([0, 0, -2.7], [0, 0, -.8], [[2.1, 0], [2.4, .15], [2.4, .4], [1.3, .65], [1.3, 1]]), 'brass', 'lunar-drive-hub', earthMoon);
  const phaseIndex = shaft([0, 0, -2.9], [3.8, 0, -2.9], .22, 'ivory', 'lunar-drive-index', earthMoon);

  // The stellar disk remains open between concentrations. A solid plate or
  // four broad mechanical blades would give the wrong astronomical reading.
  const galaxy = group('milky-way-specimen', [0, 34.6, 0]);
  const disk=pick(part(galaxySpecimenGeometry(22.8), 'ivory', 'continuous-galactic-spiral-relief', galaxy, '#fffffe'),2);
  disk.material.vertexColors=true;disk.material.needsUpdate=true;
  // A fine sight ring locates a member on the disk, not a bright second sun.
  const memberAt:Vec3=[-13.05,5.34,1.35];
  const member=pick(tube(arc(0,0,1.45,0,0,Math.PI*2,40),.09,'brass','solar-membership-sight-ring',galaxy),1);member.position.set(...memberAt);
  pick(orb(.42,memberAt,'ivory','solar-membership-marker',galaxy,[1,1,1],'#ba985a'),1);

  // Three supported carriages retain
  // deterministic motion; real sizes, distances and periods are not implied.
  const solar = group('solar-inset-specimen', [0, 34.6, 0]);
  const sun = pick(orb(4.1, [0, 0, 1.2], 'ivory', 'solar-inset-sun', solar, [1, 1, 1], '#c2a262'), 1);
  sun.userData.isGalacticCentre = false;
  const solarHardware = createInstrumentParts(b, solar);
  solarHardware.bearing([0, 0, -1], [0, 0, 1], 3, 3.4);
  for (const r of [9, 16, 23]) pick(tube(arc(0, 0, r, -1.8), .12, 'brass', 'solar-orbit-reference', solar), 1);
  const planets = [9, 16, 23].map((r, i) => {
    const g = new T.Group(); solar.add(g); g.name = 'solar-body-supported-carriage-' + i;
    const z = -2.5 - i * .45;
    const support = shaft([0, 0, z], [1, 0, z], .24, 'steel', 'radial-planet-support', solar);
    pick(orb(i === 2 ? 2.4 : 1.3 + i * .2, [0, 0, 1.2], 'enamel', i === 2 ? 'solar-earth-globe' : 'schematic-solar-planet', g, [1, 1, 1], i === 2 ? '#7a9998' : i ? '#b7a179' : '#91978e'), i === 2 ? 0 : 1);
    shaft([0, 0, z], [0, 0, 1.2], .25, 'steel', 'planet-to-arm-socket', g);
    return { radius: r, group: g, support, z };
  });

  // Independently inclined, solid galaxies occupy an open volume. There is
  // no enclosing globe and no evenly spaced row suggesting real positions.
  const cosmic = group('observable-universe-specimen', [0, 34.6, 0]);
  const stems: any[] = [], galaxyCenters:Vec3[]=[];
  for (let i = 0; i < 7; i++) {
    const a = i * 2.39996, r = 9 + Math.sqrt(i / 6) * 12;
    const x = Math.cos(a) * r, y = Math.sin(a) * r * .82, z = Math.sin(i * 1.7) * 6;
    const q = new T.Quaternion().setFromEuler(new T.Euler(.15 + i % 3 * .3, .12 * Math.sin(i), a * .3));
    const transform = (g: any) => { g.applyQuaternion(q); g.translate(x, y, z); return g; };
    const g=galaxySpecimenGeometry(4.2+i%3*.45,10,48);
    const specimen=pick(part(transform(g),'ivory','sparse-relief-galaxies',cosmic,'#fffffe'),i===0?2:3);
    specimen.material.vertexColors=true;specimen.material.needsUpdate=true;
    galaxyCenters.push([x,y,z]);
    stems.push(turnedShaftGeometry([0, 0, -6], [x, y, z - .35], [[.10, 0], [.10, 1]]));
  }
  part(mergeInstrumentGeometry(stems), 'steel', 'galaxy-specimen-carriers', cosmic);
  // The first galaxy is the marked Milky Way teaching specimen, not a central
  // galaxy of the universe. Its reference ring follows that actual specimen.
  const milkyWayAt=galaxyCenters[0];
  const milkyWayMark=pick(tube(arc(0,0,5.7,0,0,Math.PI*2,48),.095,'brass','milky-way-membership-marker',cosmic),2);
  milkyWayMark.position.set(...milkyWayAt);milkyWayMark.quaternion.setFromEuler(new T.Euler(.15,0,0));

  // Four shallow selection stops seat directly in the cast control deck.
  // Continuous motion has one physical input: the shaft-mounted handwheel.
  const detents = NAMES.map((_, i) => pick(part(turnedShaftGeometry([-15 + i * 10, 5.23, 8], [-15 + i * 10, 6.51, 7.936], [[1.5, 0], [1.8, .15], [1.8, .75], [1.4, 1]]), 'brass', 'system-selector-detent'), i));
  const pointer = part(chamferedPlateGeometry([-2.3, -.15, -.7], [2.3, .15, .7], .08), 'ivory', 'selected-system-index');
  pointer.position.set(-15, 5.22, 10.3);pointer.rotation.x=.05;
  // The readable DOM caption already names the selected level. Repeating it
  // as tiny type on a narrow physical edge adds noise and unreadable text.
  const specimens = [earthMoon, solar, galaxy, cosmic];
  const stations:Vec3[]=[[-30,23,1],[-9,37,-2],[12,51,-5],[33,65,-8]];
  const magnifications=[.60,.54,.58,.60];
  const axialDepth=stations.map(p=>p[2]-3);
  const stationShafts=stations.map(([x,y])=>{
    part(castBodyGeometry([x-1.75,y-1.75,-18.8],[x+1.75,y+1.75,-14],.35),'enamel','fitted-station-carrier');
    hardware.bearing([x,y,-16.4],[0,0,1],1.55,3.6);
    return shaft([0,0,0],[0,0,1],.36,'steel','station-telescopic-spindle');
  });
  specimens.forEach((g,i)=>{
    g.scale.setScalar(magnifications[i]);
    g.userData.rigidFormationGroup={start:.18+i*.075,offset:[0,-3,0],angle:-.18,axis:'x'};
  });
  // Fine links terminate at actual member markers. They explain diagrammatic
  // magnification, while the rear casting alone carries the real hardware.
  const links=[0,1,2].map(()=>shaft([0,0,0],[0,1,0],.075,'ivory','membership-magnification-link'));
  const up=new T.Vector3(0,1,0),linkFrom=new T.Vector3(),linkTo=new T.Vector3(),linkDelta=new T.Vector3();
  const memberPoints=[new T.Vector3(),new T.Vector3(...memberAt),new T.Vector3(...milkyWayAt)];
  let selected = 0, phase = 0;
  const overview=()=>({min:[c[0]-46*s,c[1],c[2]-22*s] as Vec3,max:[c[0]+48*s,c[1]+81*s,c[2]+14*s] as Vec3});
  const focus=()=>{
    // Keep the selected body and one neighboring level as a scale reference.
    // The overview retains the complete armature and native control deck.
    const adjacent=selected===3?2:selected+1;
    const a=stations[selected],n=stations[adjacent];
    const min:Vec3=[Math.min(a[0]-18,n[0]-14),Math.min(a[1]-18,n[1]-13),-21];
    const max:Vec3=[Math.max(a[0]+18,n[0]+14),Math.max(a[1]+18,n[1]+13),15];
    if(selected===0){min[0]=Math.min(min[0],-47);min[1]=3;max[2]=16;}
    return{min:min.map((v,i)=>c[i]+v*s) as Vec3,max:max.map((v,i)=>c[i]+v*s) as Vec3};
  };
  const snapshots: { name: string; body: Vec3; support: Vec3 }[] = [];
  return {
    update(t, selection, dt=1/60, reduced=false) {
      selected = clampSelection(selection); phase = Number.isFinite(t) ? ((t % 1) + 1) % 1 : 0;
      const a = phase * Math.PI * 2;
      planets.forEach((planet, i) => {
        const theta = a * (3 - i) + [.9, 3.4, .1][i];
        planet.group.position.set(Math.cos(theta) * planet.radius, Math.sin(theta) * planet.radius, 0);
        planet.support.rotation.z = theta; planet.support.scale.x = planet.radius;
      });
      const theta = a * 4 + 1.9;
      moonCarrier.position.set(Math.cos(theta) * lunarRadius, Math.sin(theta) * lunarRadius, 0);
      lunarArm.rotation.z = theta; lunarArm.scale.x = lunarRadius;
      lunarHub.rotation.z = theta; phaseIndex.rotation.z = theta;
      wheel.rotation.z=a;
      // In large-scale views this control tilts the display specimen to reveal
      // its depth; it is explicitly not a rigid-body galactic rotation model.
      galaxy.rotation.x = Math.sin(a) * .38; cosmic.rotation.y = Math.sin(a) * .38;
      pointer.position.x = -15 + selected * 10;
      const settle=reduced||dt<=0?1:1-Math.exp(-Math.min(dt,.1)*10);
      specimens.forEach((g,i)=>{
        axialDepth[i]+=((stations[i][2]+(i===selected?5:-3))-axialDepth[i])*settle;
        g.position.set(stations[i][0],stations[i][1],axialDepth[i]);g.visible=true;
        const spindle=stationShafts[i];spindle.position.set(stations[i][0],stations[i][1],-18.8);
        spindle.scale.z=axialDepth[i]+18.8-magnifications[i];
      });
      root.updateMatrixWorld(true);
      memberPoints[0].copy(planets[2].group.position);memberPoints[0].z+=1.2;
      links.forEach((link,i)=>{
        linkFrom.copy(memberPoints[i]);specimens[i+1].localToWorld(linkFrom);root.worldToLocal(linkFrom);
        linkTo.set(0,0,0);specimens[i].localToWorld(linkTo);root.worldToLocal(linkTo);
        linkDelta.copy(linkTo).sub(linkFrom);const length=linkDelta.length();
        // Stop at the child's outer working envelope rather than passing a
        // bright line through its globe or spiral.
        const endInset=11.7,segmentLength=Math.max(.05,length-endInset);
        link.position.copy(linkFrom);link.quaternion.setFromUnitVectors(up,linkDelta.normalize());link.scale.y=segmentLength;
        link.userData.diagrammaticMembership=true;
      });
      root.updateMatrixWorld(true); snapshots.length = 0;
      planets.forEach((planet, i) => snapshots.push({ name: i === 2 ? 'earth' : 'planet-' + i, body: planet.group.localToWorld(new T.Vector3(0, 0, planet.z)).toArray(), support: planet.support.localToWorld(new T.Vector3(1, 0, planet.z)).toArray() }));
    },
    overviewBounds:overview,
    focusBounds:focus,
    describe: () => ({ kind: 'cosmic-scale', hierarchy: ['earth-moon', 'solar-system', 'milky-way', 'observable-universe'], selected, selectedName: NAMES[selected], phase,
      relationship: 'membership-not-physical-stacked-shells', trueScale: false, realOrbitalPeriodRatio: false, instrumentMechanismIsAstronomicalCause: false,
      construction: 'four-permanent-stations-one-inclined-armature', outerFrameIsCosmicBoundary: false, solarInsetAtGalacticCentre: false,
      directSystemSelections: detents.length, nativePhaseTrack: false, nativePhaseDial: true, supportConnections: snapshots, labelCountVisible: 0,
      largeScalePhaseAction: 'tilt-teaching-specimen-not-cosmic-evolution',
      visibleSpecimens: specimens.filter(g => g.visible).map(g => g.name), lunarOrbitRadius: lunarRadius, earthRadius,
      stationCenters:specimens.map(g=>g.position.toArray()),specimenMagnifications:magnifications,selectedStationDepth:axialDepth[selected],
      observationEnvelope:focus(),completeApparatusEnvelope:overview(),galaxyRelief:'volumetric-stellar-bulge-disk-and-four-spiral-concentrations',
      starFieldIsObservedData: false, displayedStarCountIsQuantitative: false }),
  };
}

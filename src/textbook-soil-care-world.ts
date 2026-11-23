import { handValve, hydrologyCore, hydrologyTopRelief, specimenNoise, meniscusGeometry, wetGlassFill } from './textbook-hydrology-cutaway';
import { applyEarthScan } from './textbook-earth-scan';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { mountCareSection } from './textbook-soil-care-section';
import { evaluateSoilCare } from './textbook-soil-care-model';
import { createSoilInstrument } from './textbook-soil-instrument-parts';
import { mergeInstrumentGeometry } from './textbook-instrument-parts';
import { phaseTrackPoint } from './textbook-model-input';

/** One retained cutaway, not three unrelated dioramas. The front paths are an
 * enlarged schematic water network. Salt identity and all scientific x/y
 * coordinates belong to evaluateSoilCare; depth only separates coincident
 * markers in the physical cutaway. No water volume or pore size is measured. */
export function buildSoilCareWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, z0 = -LIFT_MARGIN - b.height * .45;
  const p = (x: number, y: number, z = 0): Vec3 => [x * s, y * s, z0 + z * s];
  const y = (height: number) => 8 + height * 1.8;
  const { parts, solid, plate, pipe, bearing, finish, openBox, nozzle } = createSoilInstrument(b, s);
  const role = (mesh: any, name: string) => { mesh.userData.soilCareRole = name; return mesh; };
  const input = (mesh: any, selection: number) => {
    mesh.userData.modelInput = { kind: 'select', selection, keepPhase: true,
      label: `在当前进度比较，${['观察蒸发返盐', '观察引淡淋盐', '观察覆盖抑蒸发'][selection]}` };
    mesh.userData.interactionFeedback = false; return mesh;
  };
  const inspectionPane = (a: Vec3, c: Vec3) => {
    const mesh = plate(a, c, '#d7e3dc', 'air', 'unframed-inspection-pane');
    mesh.material.opacity = .055; mesh.material.depthWrite = false;
    mesh.castShadow = mesh.receiveShadow = false; mesh.userData.castShadow = false; return mesh;
  };
  // A continuous low chassis retains the groundwater section and its outlet.
  // The pale walls are vessel walls; the soil itself carries no metal frame.
  plate(p(5, 2, -14), p(100, 4, 22), '#544534', 'wood', 'water-salt-bed');
  plate(p(5.6, 4, -13.4), p(99.4, 4.35, 21.4), '#a88b50', 'brass', 'bed-edge-reveal');
  plate(p(6.3, 4.35, -12.7), p(98.7, 5.25, 20.7), '#2c443d', 'enamel', 'retaining-bed');
  parts.fasteners([p(9, 5.3, -10), p(96, 5.3, -10), p(9, 5.3, 18), p(96, 5.3, 18)], [0, 1, 0], .38 * s);
  for (const x of [18, 78]) for (const z of [-6, 12]) {
    pipe(p(x, 5.25, z), p(x, 11.4, z), .62 * s);
    bearing(p(x, 8.2, z), [0, 1, 0], .95 * s, 2.2 * s);
  }
  const basalWalls = openBox(13.6 * s, 83.4 * s, 12 * s, 17.2 * s, z0 - 10 * s, z0 + 17.3 * s,
    '#d8d3bb', 'ivory', 'groundwater-section', false, true, .6 * s);
  input(inspectionPane(p(14.2, 12, 17.2), p(82.8, 17.2, 17.3)), 1);
  // Replace the right wall by a retained wall with a real exit opening.
  // Moving markers must not pass through an intact vessel wall.
  basalWalls[3].visible = false;
  plate(p(82.8, 12, -10), p(83.4, 17.2, 8.6), '#d8d3bb', 'ivory', 'groundwater-right-retained-wall');
  plate(p(82.8, 12, 8.6), p(83.4, 14.5, 17.3), '#d8d3bb', 'ivory', 'groundwater-open-exit-sill');
  const groundwater = role(solid(meniscusGeometry(68.4 * s, 5.2 * s, 25.7 * s), '#78a1a6', 'water', 'retained-groundwater'), 'groundwater');
  groundwater.position.set(...p(48.5, 14.6, 3.35)); groundwater.userData.castShadow = false; input(groundwater, 1);
  wetGlassFill(groundwater,b,.38);
  const gravels:any[]=[];
  for(let i=0;i<155;i++){
    const x=15.2+specimenNoise(i,7)*66.7,z=-8.6+specimenNoise(i,49)*24.6,r=.39+specimenNoise(i,60)*.78;
    const stone=new T.IcosahedronGeometry(1,1);
    stone.scale(r*s,.45*r*s,.68*r*s);stone.rotateY(specimenNoise(i,23)*6.28);
    stone.translate(...p(x,12.23+r*.26+(z>12?.21:0),z));gravels.push(stone);
  }
  const gravel=role(solid(mergeInstrumentGeometry(gravels),'#81745e','rock','submerged-gravel-bed'),'wet-gravel');
  applyEarthScan(gravel.material,'alluvium',7*s);
  // An actual empty channel connects the groundwater cutaway to the cup.
  // Its sliding gate visibly opens only in the drainage condition.
  plate(p(82.6, 13.8, 8), p(90.6, 14.5, 17.3), '#d8d3bb', 'ivory', 'drain-bridge-floor');
  plate(p(82.6, 14.5, 8), p(90.6, 18.0, 8.6), '#d8d3bb', 'ivory', 'drain-bridge-back');
  plate(p(82.6, 14.5, 16.7), p(90.6, 18.0, 17.3), '#d8d3bb', 'ivory', 'drain-bridge-front');
  const gate = role(plate(p(84.5, 14.5, 8.7), p(85.1, 18.2, 16.6), '#a88b50', 'brass', 'drainage-gate'), 'drainage-gate');
  input(gate, 1);
  pipe(p(84.8, 18.2, 12.6), p(84.8, 24.5, 12.6), .35 * s, '#929b98', 'steel');
  const gateKnob = parts.knob(p(84.8, 24.5, 12.6), [0, 1, 0], 1.7 * s, 1.4 * s);
  gateKnob.traverse((m: any) => { if (m.isMesh) input(role(m, 'drainage-control'), 1); });
  const receivingWalls = openBox(90 * s, 99 * s, 10.6 * s, 18.8 * s, z0 + 8 * s, z0 + 18.8 * s,
    '#d8d3bb', 'ivory', 'drained-salt-receiver', false, true, .5 * s);
  inspectionPane(p(90.5, 10.6, 18.7), p(98.5, 18.8, 18.8));
  receivingWalls[2].visible = false;
  plate(p(90, 10.6, 8), p(90.5, 14.5, 18.8), '#d8d3bb', 'ivory', 'receiver-open-inlet-sill');
  plate(p(90, 14.5, 8), p(90.5, 18.8, 8.6), '#d8d3bb', 'ivory', 'receiver-inlet-back-jamb');
  const receiver = role(solid(meniscusGeometry(7.9 * s, 5.5 * s, 9.1 * s), '#91b2b5', 'water', 'receiver-inspection-water'), 'receiver-water');
  wetGlassFill(receiver,b,.51);
  receiver.position.set(...p(94.5, 13.85, 13.35)); receiver.userData.castShadow = false;
  // One continuous natural cut face. Flow lanes belong to the schematic
  // tracers, never to eight vertical trenches cut through the soil specimen.
  const lanes = Array.from({ length: 8 }, (_, i) => 21 + i * 7.8);
  const topAt = (x:number)=>43.6+.55*Math.sin(x*.21)+.32*Math.sin(x*.73+.7);
  const surfaceAt=(x:number,z:number)=>topAt(x)+hydrologyTopRelief((x-14.3)/68.5,(11.57-z)/19.57,68.5/42,42);
  const soilGeometry=hydrologyCore(p(14.3,17.16,-8),p(82.8,44,11.57),x=>topAt(x/s)*s,'profile');
  const soil=role(solid(soilGeometry,'#ffffff','land','single-irregular-porous-soil-monolith'),'soil-aggregate');
  soil.material=b.materialFor('land','#8e7959');soil.material.color.set('#ffffff');soil.material.vertexColors=true;
  applyEarthScan(soil.material,'loam',10*s);
  // Broken surface efflorescence lies above the matrix. Its exposed area
  // tracks the surface salt independently of the twenty dissolved tracers.
  const filmPositions:number[]=[],filmColors:number[]=[];
  const saltTint=new T.Color();
  for(let i=0;i<144;i++){
    const x=16.4+64.2*specimenNoise(i,18),z=-6.5+16.7*specimenNoise(i,36);
    const spread=.32+specimenNoise(i,62)*1.07;
    for(let island=0;island<6;island++){
      const xx=x+(specimenNoise(i,island+32)-.5)*spread*2.4,zz=z+(specimenNoise(i,island+44)-.5)*spread*1.5;
      const radius=spread*(.18+.39*specimenNoise(i,island+61)),ring:Vec3[]=[];
      for(let k=0;k<7;k++){
        const angle=k*Math.PI*2/7,edge=.64+.5*specimenNoise(i+island,k+91);
        const px=xx+Math.cos(angle)*radius*edge,pz=zz+Math.sin(angle)*radius*edge*.76;
        ring.push(p(px,surfaceAt(px,pz)+.105,pz));
      }
      for(let k=0;k<7;k++){
        filmPositions.push(...p(xx,surfaceAt(xx,zz)+.16,zz),...ring[(k+1)%7],...ring[k]);
        for(const hex of ['#dfd8bd','#aa9a7e','#c3b599']){
          saltTint.set(hex).multiplyScalar(.85+.17*specimenNoise(i+island,k));filmColors.push(saltTint.r,saltTint.g,saltTint.b);
        }
      }
    }
  }
  const filmGeometry=new T.BufferGeometry();
  filmGeometry.setAttribute('position',new T.Float32BufferAttribute(filmPositions,3));
  filmGeometry.setAttribute('color',new T.Float32BufferAttribute(filmColors,3));filmGeometry.computeVertexNormals();
  const film=role(solid(filmGeometry,'#f3eeea','rock','broken-surface-efflorescence'),'surface-crust');
  film.material.vertexColors=true;applyEarthScan(film.material,'alluvium',3.5*s);input(film,0);
  soil.userData.singleContinuousSoil = true;soil.userData.schematicFlowLanes = lanes;input(soil,0);
  const section=mountCareSection(b,soil,p,s,z0,lanes,topAt);
  for (const x of [12.1, 84.8]) {
    plate(p(x - 1.2, 5.25, -7), p(x + 1.2, 7.1, -2), '#2c443d', 'enamel', 'header-upright-foot');
    pipe(p(x, 7.1, -4.5), p(x, 52.5, -4.5), .58 * s);
    bearing(p(x, 50.8, -4.5), [0, 1, 0], .9 * s, 2.8 * s);
  }
  plate(p(11.2, 51.1, -5.3), p(85.7, 52.05, .5), '#2c443d', 'enamel', 'freshwater-header-seat');
  const header = openBox(14 * s, 82.5 * s, 52.5 * s, 56.8 * s, z0 - 5 * s, z0 + 13.5 * s,
    '#d8d3bb', 'ivory', 'freshwater-distribution-gutter', false, false, .45 * s);
  input(inspectionPane(p(14.45,52.5,13.4),p(82.05,56.8,13.5)),1);
  header.forEach(m => input(role(m, 'freshwater-header'), 1));
  // Perforated gutter floor and eight aligned open downspouts.
  const floor = new T.Shape(); floor.moveTo(14 * s, -(z0 - 5 * s)); floor.lineTo(82.5 * s, -(z0 - 5 * s));
  floor.lineTo(82.5 * s, -(z0 + 13.5 * s)); floor.lineTo(14 * s, -(z0 + 13.5 * s)); floor.closePath();
  for (const x of lanes) { const h = new T.Path(); h.absarc(x * s, -(z0 + 12.8 * s), .52 * s, 0, Math.PI * 2, true); floor.holes.push(h);
    input(role(nozzle(p(x, 51.9, 12.8), .76 * s, .52 * s, 1.7 * s), 'freshwater-nozzle'), 1); }
  const floorGeometry = new T.ExtrudeGeometry(floor, { depth: .45 * s, bevelEnabled: false, curveSegments: 16 });
  floorGeometry.rotateX(-Math.PI / 2); floorGeometry.translate(0, 52.05 * s, 0);
  input(role(solid(floorGeometry, '#a88b50', 'brass', 'open-perforated-freshwater-floor'), 'freshwater-floor'), 1);
  const freshwater = role(solid(meniscusGeometry(66.9 * s, 2.7 * s, 17.2 * s), '#a5c4c8', 'water', 'freshwater-surface'), 'freshwater');
  wetGlassFill(freshwater,b,.56);
  freshwater.position.set(...p(48.25, 53.85, 4.2)); freshwater.userData.castShadow = false; input(freshwater, 1);
  // The natural cover rests on the SAME soil. Short irregular stems and curled
  // leaf ribbons form an open mulch mat; no long green rods substitute for it.
  const straw: any[] = [], leaf: any[] = [];
  for (let i = 0; i < 90; i++) {
    const x = 15.5 + (i * .61803398875 % 1) * 65, z = -6.5 + (i * .41421356237 % 1) * 19;
    const angle = i * 2.39996, length = 2.3 + (i % 7) * .52, ax = x - Math.cos(angle) * length / 2, cx = x + Math.cos(angle) * length / 2;
    const a = new T.Vector3(...p(ax, surfaceAt(ax,z - Math.sin(angle)*length/2) + .2 + i % 4 * .13, z - Math.sin(angle) * length / 2));
    const c = new T.Vector3(...p(cx, surfaceAt(cx,z + Math.sin(angle)*length/2) + .2 + i % 4 * .13, z + Math.sin(angle) * length / 2));
    const g = new T.CylinderGeometry(.105 * s, .16 * s, a.distanceTo(c), 5);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), c.clone().sub(a).normalize())); g.translate(...a.add(c).multiplyScalar(.5).toArray()); straw.push(g);
  }
  for (let i = 0; i < 20; i++) {
    const x = 16 + (i * .754877666 % 1) * 63, zz = -6 + (i * .56984 % 1) * 19, angle = i * 1.64;
    const v: number[] = [], at = (u: number, side: number): Vec3 => p(x + Math.cos(angle) * u * 3.5 - Math.sin(angle) * side * Math.sin(Math.PI * u) * 1.2,
      topAt(x + Math.cos(angle) * u * 3.5 - Math.sin(angle) * side * Math.sin(Math.PI * u) * 1.2) + .2 + Math.sin(Math.PI * u) * .55,
      zz + Math.sin(angle) * u * 3.5 + Math.cos(angle) * side * Math.sin(Math.PI * u) * 1.2);
    for (let k = 0; k < 6; k++) { const a = k / 6, c = (k + 1) / 6; v.push(...at(a, -1), ...at(c, -1), ...at(a, 1), ...at(a, 1), ...at(c, -1), ...at(c, 1)); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); leaf.push(g);
  }
  const cover = [role(solid(mergeInstrumentGeometry(straw), '#a28d51', 'plant', 'short-natural-straw-mulch'), 'mulch-stems'),
    role(solid(mergeInstrumentGeometry(leaf), '#777445', 'plant', 'curled-organic-mulch'), 'mulch-leaves')];
  cover.forEach(m => input(m, 2));
  const roll=role(solid(new T.CylinderGeometry(1.52*s,1.6*s,11.2*s,24),'#9a8055','plant','mulch-roll'),'stored-mulch');
  roll.rotation.z=Math.PI/2;roll.position.set(...p(71,topAt(71)+1.41,-4.2));
  roll.userData.modelInput={kind:'select',selection:2,toggleTo:0,keepPhase:true,label:'铺开或收卷覆盖物，比较相同进度的土壤'};

  const salts = evaluateSoilCare(0, 0).packets.map(packet => {
    const mesh = role(solid(new T.SphereGeometry(.59 * s, 10, 6), '#b48943', 'rock', 'retained-salt-marker'), 'salt-packet');
    mesh.userData.soilCareSaltId = packet.id; mesh.userData.castShadow = false; return mesh;
  });
  const saltZ = (id: number) => 12.1 + (id % 5) * .6 + Math.floor(id / 8) * .16;
  const track = { start: p(7.9, 49.2, 15.4), end: p(7.9, 17.1, 15.4) };
  pipe(track.start, track.end, .26 * s);
  for (const at of [track.start, track.end]) {
    bearing(at, [0, 1, 0], .61 * s, 1.3 * s);
    // Short horizontal brackets connect the observation slide to the actual
    // header mast. The guide no longer floats beside the specimen.
    pipe([at[0], at[1], at[2]], [12.1 * s, at[1], z0 - 4.5 * s], .32 * s);
    bearing([12.1 * s, at[1], z0 - 4.5 * s], [0, 1, 0], .9 * s, 1.8 * s);
  }
  const rider = role(solid(new T.SphereGeometry(1.45 * s, 20, 12), '#e3ddc9', 'ivory', 'migration-observation-rider'), 'observation-slider');
  rider.scale.set(1, 1.3, .8); rider.userData.modelInput = { kind: 'phase-track', track, label: '拖动观察水盐迁移，倒拖回看同一批盐的去向' }; rider.userData.interactionFeedback = false;
  const valveAt=p(92,33.3,17.8);
  plate(p(90.4,5.25,9.2),p(93.6,33.8,11.8),'#374b3c','enamel','salt-tracer-bearing-post');
  pipe(p(92,33.3,10.4),valveAt,.7*s,'#8e774f','brass');
  bearing(p(92,33.3,13.4),[0,0,1],1.45*s,3.1*s);
  const turnValve=handValve(b,s,valveAt,5.25,'转动水盐示踪轮，观察这一批水盐的迁移和去向');
  const conditionKeys=[25,48,71].map((x,index)=>{
    plate(p(x-7.2,4.7,16.4),p(x+7.2,7.55,20.5),'#8d7348','brass','condition-key-brass-seat');
    const key=role(plate(p(x-6.7,5.1,20.4),p(x+6.7,7.15,21.15),'#dbd1ae','ivory','soil-care-condition-key'),'condition-key');
    input(key,index);
    // Marks on each key reproduce the sun, water and mulch used in the experiment.
    const marks:any[]=[],line=(ax:number,ay:number,bx:number,by:number)=>{
      const a=new T.Vector3(...p(x+ax,6.1+ay,21.24)),b=new T.Vector3(...p(x+bx,6.1+by,21.24));
      const g=new T.CylinderGeometry(.105*s,.105*s,a.distanceTo(b),7);
      g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize()));g.translate(...a.add(b).multiplyScalar(.5).toArray());marks.push(g);};
    if(index===0){const ring=new T.TorusGeometry(.47*s,.12*s,7,20);ring.translate(...p(x,6.1,21.24));marks.push(ring);
      for(let k=0;k<8;k++){const a=k*Math.PI/4;line(.68*Math.cos(a),.68*Math.sin(a),.97*Math.cos(a),.97*Math.sin(a));}}
    else if(index===1){for(const dx of [-1,0,1]){line(dx,.73,dx,-.66);line(dx,-.66,dx+.22,-.34);}}
    else{for(const dx of [-1.12,0,1.12]){line(dx-.65,-.56,dx+.6,.56);line(dx+.6,.56,dx+.04,.53);}}
    input(solid(mergeInstrumentGeometry(marks),'#715a37','brass','condition-key-pictogram'),index);
    return key;
  });
  const waterSource = new T.IcosahedronGeometry(1, 0), waterVertices = new Float32Array(waterSource.attributes.position.array), stride = waterSource.attributes.position.count;
  const waterGeometry = new T.BufferGeometry(); waterGeometry.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(8 * 4 * stride * 3), 3));
  const water = role(solid(waterGeometry, '#76a6af', 'water', 'schematic-water-migration'), 'water-flow'); water.userData.castShadow = false; waterSource.dispose();
  let state = evaluateSoilCare(0, 0), previous = '';
  return { update(phase, selection) {
    state = evaluateSoilCare(phase, selection);
    const key = `${state.phase}:${state.selection}`;
    if (key !== previous) {
      const washing = state.freshwaterWithDrainage, covered = state.protectedFromEvaporation;
      turnValve(state.phase);section.wet(state.phase,washing,covered);
      filmGeometry.setDrawRange(0,Math.round(144*state.surfaceSalt)*6*7*3);
      conditionKeys.forEach((key,i)=>{key.position.z=i===state.selection?-.13*s:0;});
      for (const m of cover) m.visible = covered;
      freshwater.visible = washing; receiver.visible = washing;
      gate.position.y = washing ? 6 * s : 0;
      salts.forEach((m, i) => { const packet = state.packets[i]; m.position.set(...p(packet.u * 100, y(packet.height), saltZ(packet.id)));
        m.userData.drained = packet.drained; m.userData.modelU = packet.u; m.userData.modelHeight = packet.height; });
      const a = waterGeometry.attributes.position;
      for (let lane = 0; lane < 8; lane++) for (let j = 0; j < 4; j++) {
        const visible = state.phase > .08 && state.phase < .98 && (!covered || j < 1), fraction = (state.phase * 2 + j / 4) % 1;
        const yy = washing ? 51.0 - fraction * 34.6 : 17.2 + fraction * 29.5;
        const radius = visible ? (covered ? .31 : .42) * s : 0, center = section.trace(lane,yy);
        for (let k = 0; k < stride; k++) { const base = k * 3, vertex = (lane * 4 + j) * stride + k;
          a.setXYZ(vertex, center[0] + waterVertices[base] * radius, center[1] + waterVertices[base + 1] * radius * 1.45, center[2] + waterVertices[base + 2] * radius); }
      }
      a.needsUpdate = true; waterGeometry.computeVertexNormals(); waterGeometry.computeBoundingSphere();
      rider.position.set(...phaseTrackPoint(state.phase, track)); previous = key;
    }
  }, focusBounds: () => ({ min: p(3, 0, -15), max: p(103, 60, 24) }),
    describe: () => ({ ...state, construction: 'retained-soil-water-salt-instrument', schematicFlowLaneCenters: lanes,
      packetPositionsFromSameState: true, packetIdentitiesRetained: true, actualDrainageReceiver: true,
      drainedMarkersRemainVisible: true, naturalMulchOnSameSoil: true, selfSupporting: true,
      poreGeometryMeasured: false, waterAmountMeasured: false, schematicWaterTracers: true,
      geometryLayout: { scale: s, z0, heightOffset: 8, heightScale: 1.8, saltDepths: state.packets.map(packet => saltZ(packet.id)) }, observationTrack: track }),
  };
}
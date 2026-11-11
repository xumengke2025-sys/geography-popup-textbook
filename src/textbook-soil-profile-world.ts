import { createSpecimenMaterial } from './textbook-solid-materials';
import { createSoilSpecimenFinish } from './textbook-soil-specimen-finish';
import { createInstrumentParts, mergeInstrumentGeometry, turnedSleeveGeometry, turnedShaftGeometry } from './textbook-instrument-parts';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint } from './textbook-model-input';
import { evaluateSoilProfile, soilProfileBoundary, soilProfileLayerOffset, soilProfileOffsetAtDepth,
  soilProfileWaterU, SOIL_PROFILE_LAYERS, SOIL_PROFILE_REFERENCE } from './textbook-soil-profile-model';
import { soilProfileInspection } from './textbook-soil-profile-model';

/** Six adjoining volumes form one cut soil column. All moving material and
 * water positions are derived from the pure model, never accumulated by dt. */
export function buildSoilProfileWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, width = 40 * s, height = Math.min(b.height * .90, 105 * s), depth = 19 * s;
  const x0 = 27 * s, z0 = -LIFT_MARGIN - b.height * .58, z1 = z0 + depth;
  // Adjacent horizons use the same cut boundary. Relief changes the exposed
  // surface only, never horizon depth, marker identity or scientific progress.
  const point = (u: number, d: number, v = 1, offset = 0): Vec3 => {
    const cut = Math.pow(Math.max(0,(v-.88)/.12),2);
    const relief = (.25*Math.sin(u*37+d*19)+.12*Math.sin(u*91-d*47))*s;
    const edge = (Math.exp(-u*30)-Math.exp(-(1-u)*30))*.26*s*Math.sin(d*41+v*7);
    return [x0+(u+offset)*width+edge,height*(1-d),z0+v*depth+cut*relief];
  };
  const input = (i: number) => ({ kind: 'select', selection: i, toggleTo: -1, label: `查看${SOIL_PROFILE_LAYERS[i].name}，再次选择复原` });
  const nx = 20, nz = 6;
  let inspection = 'overview', viewDirty = true;
  const frontShift = () => soilProfileInspection(inspection).frontOffset * width;
  const viewPoint = (u: number, d: number, v = 1, offset = 0): Vec3 => {
    const at = point(u, d, v, offset); if (v >= .55) at[0] += frontShift(); return at;
  };
  const layers = SOIL_PROFILE_LAYERS.map((layer, index) => {
    const buildHalf = (v0: number, v1: number, front: boolean) => {
    const vertices: number[] = [], indices: number[] = [];
    const grid=(cols:number,rows:number,at:(u:number,v:number)=>Vec3,reverse=false)=>{
      const start=vertices.length/3;
      for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++)vertices.push(...at(i/cols,j/rows));
      for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
        const a=start+j*(cols+1)+i,c=a+cols+1;
        if(reverse)indices.push(a,c,a+1,a+1,c,c+1);else indices.push(a,a+1,c,a+1,c+1,c);
      }
    };
    for(const face of [index,index+1])grid(nx,nz,(u,t)=>{
      const v=v0+(v1-v0)*t;return point(u,soilProfileBoundary(face,u,v),v);
    },face===index);
    for(const v of [v0,v1])grid(nx,8,(u,t)=>{
      const a=soilProfileBoundary(index,u,v),c=soilProfileBoundary(index+1,u,v);
      return point(u,a+(c-a)*t,v);
    },v===v1);
    for(const u of [0,1])grid(nz,8,(t,f)=>{
      const v=v0+(v1-v0)*t,a=soilProfileBoundary(index,u,v),c=soilProfileBoundary(index+1,u,v);
      return point(u,a+(c-a)*f,v);
    },u===0);
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const mesh = b.mesh(geometry, layer.color, false);
    mesh.material = createSoilSpecimenFinish(b.pop, layer.color, index === 5 ? 0 : index + 1, s);
    mesh.material.side = T.DoubleSide;
    mesh.userData.soilProfileRole = front ? 'front-half' : 'layer'; mesh.userData.soilProfileLayer = index; mesh.userData.layerName = layer.name;
    mesh.userData.sectionRange = [v0, v1];
    mesh.userData.modelInput = front ? { kind: 'inspect', target: 'section', toggleTo: 'overview', label: '剖开土柱前半部；再次选择合拢，过程不变' } : input(index);
    return mesh;
    };
    return { rear: buildHalf(0, .55, false), front: buildHalf(.55, 1, true) };
  });

  const grainGeometry = new T.IcosahedronGeometry(1, 0);
  const materials = evaluateSoilProfile(0).materials.map(material => {
    const mesh = b.mesh(grainGeometry, '#80613a', false);
    mesh.scale.set(material.radius * .58 * s, material.radius * .44 * s, material.radius * .23 * s);
    mesh.userData.soilProfileRole = 'material'; mesh.userData.soilProfileMaterial = material.id;
    return mesh;
  });
  // Larger, stationary weathering fragments distinguish the parent material.
  const fragments = Array.from({ length: 11 }, (_, i) => {
    const u = .08 + i % 6 * .16, d = .724 + Math.floor(i / 6) * .069 + (i % 3) * .003;
    const mesh = b.mesh(grainGeometry, i % 2 ? '#b39f7d' : '#d1c0a2', false);
    mesh.scale.set((1.6 + i % 3 * .35) * s, (.9 + i % 2 * .25) * s, .32 * s);
    mesh.rotation.z = i * .73; mesh.userData.soilProfileRole = 'parent-fragment';
    mesh.userData.modelInput = input(4);
    return { mesh, u, d };
  });
  const leafGeometry = (()=>{
    const positions:number[]=[],indices:number[]=[];
    for(let i=0;i<=8;i++){
      const t=i/8,x=t*2-1,w=Math.sin(t*Math.PI)*.55;
      for(const side of [-1,1])positions.push(x,.12*Math.sin(t*Math.PI)+side*.08,side*w);
      if(i<8){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
  })();
  const leaves=[0,1].flatMap(shade=>[false,true].map(front=>{
    const pieces=[];
    for(let i=shade;i<18;i+=2){
      const u=.06+i%9*.105,v=.14+(Math.sin(i*17.3)*.5+.5)*.74;
      if((v>=.55)!==front)continue;
      const geometry=leafGeometry.clone();geometry.scale((1.8+i%3*.3)*s,s,.9*s);geometry.rotateY(i*1.39);
      const at=point(u,soilProfileBoundary(0,u,v),v);at[1]+=.17*s;geometry.translate(...at);pieces.push(geometry);
    }
    const mesh=b.mesh(mergeInstrumentGeometry(pieces),shade?'#8e7750':'#b29c69',false,true,'plant');
    mesh.userData.soilProfileRole='leaf-litter';mesh.userData.sampleFront=front;mesh.userData.modelInput=input(0);return mesh;
  }));
  leafGeometry.dispose();

  const waterMaterial = createSpecimenMaterial(b.pop, { color: '#88a6aa', ink: '#567c82', hatch: .025, shade: .02, spacing: 3, seed: 107 });
  waterMaterial.side = T.DoubleSide;
  const waters = Array.from({ length: 4 }, (_, lane) => {
    const geometry = new T.BufferGeometry(), position = new T.Float32BufferAttribute(new Float32Array(45 * 6), 3), indices: number[] = [];
    for (let i = 0; i < 44; i++) { const k = i * 2; indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    geometry.setAttribute('position', position); geometry.setIndex(indices);
    const mesh = b.mesh(geometry, '#88a6aa', false, false); mesh.material = waterMaterial;
    mesh.userData.soilProfileRole = 'water'; mesh.userData.waterLane = lane;
    return { lane, mesh, geometry, position };
  });

  const labels = SOIL_PROFILE_LAYERS.map((layer, i) => {
    const d = (layer.top + layer.bottom) / 2;
    const label = b.label(layer.name, [80 * s, height * (1 - d), z1 + 2 * s], (layer.name.length * 6.8 + 1) * s, 7.2 * s,{appearance:'engraved'});
    label.userData.soilProfileRole = 'layer-label'; label.userData.soilProfileLayer = i; label.userData.modelInput = input(i);
    label.userData.labelMount='surface';
    return label;
  });
  // The specimen, its pull-out shelves and the water carriage belong to one
  // open section instrument. Nothing spans the exposed cut or the root zone.
  const parts = createInstrumentParts(b);
  const tagged = (mesh: any, name: string) => { mesh.name = name; mesh.userData.soilProfileRig = name; return mesh; };
  const plate = (a: Vec3, c: Vec3, role: 'wood'|'brass'|'steel'|'ivory', name: string) => tagged(parts.plate(a, c, role), name);
  const metal = (geometry: any, role: 'brass'|'steel', name: string) => tagged(b.mesh(geometry, role === 'brass' ? '#a88b50' : '#929b98', false, true, role), name);
  const rootPaths:any[]=[];
  for(let i=0;i<4;i++){
    const u=.14+i*.23;
    const path=(start:number,end:number,bend:number)=>Array.from({length:12},(_,j)=>{
      const t=j/11,d=start+(end-start)*t,p=point(u+Math.sin(t*3+i)*.018+bend*t,d,1);p[2]+=.22*s;return new T.Vector3(...p);
    });
    rootPaths.push(new T.TubeGeometry(new T.CatmullRomCurve3(path(.104,.231,0)),18,.15*s,5,false));
    for(const bend of [-.045,.048])rootPaths.push(new T.TubeGeometry(new T.CatmullRomCurve3(path(.16,.226,bend)),12,.075*s,5,false));
  }
  const roots=b.mesh(mergeInstrumentGeometry(rootPaths),'#75664c',false,true,'plant');roots.name='retained-humus-root-network';
  const labelCarriages=labels.map((label,i)=>{
    const layer=SOIL_PROFILE_LAYERS[i],y=height*(1-(layer.top+layer.bottom)/2),half=(layer.name.length*6.8+1)*s/2;
    const node=new T.Group();b.root.add(node);node.name=`layer-attached-caption-${i}`;node.add(label);
    node.add(plate([80*s-half-.25*s,y-3.85*s,z1+1.15*s],[80*s+half+.25*s,y+3.85*s,z1+1.55*s],'brass','caption-rim'));
    node.add(plate([80*s-half,y-3.6*s,z1+1.55*s],[80*s+half,y+3.6*s,z1+1.95*s],'ivory','caption-ceramic-face'));
    node.add(metal(turnedShaftGeometry([x0+width-.2*s,y,z1+.6*s],[80*s-half+.5*s,y,z1+1.4*s],[[.25*s,0],[.25*s,1]]),'brass','caption-side-stem'));
    return node;
  });
  // A narrow bed is a contact surface, not a second terrain block.
  plate([12*s,-3.4*s,z0-3*s], [80*s,-1.7*s,z1+3*s], 'wood','section-instrument-bed');
  plate([12.4*s,-1.7*s,z0-2.6*s], [79.6*s,-1.4*s,z1+2.6*s], 'brass','bed-machined-edge');
  const cradle = tagged(parts.casting([x0-.8*s,-1.4*s,z0-.5*s],[x0+width+.8*s,0,z0+depth*.55], 'steel'), 'specimen-contact-cradle');
  cradle.material = createSpecimenMaterial(b.pop,{role:'enamel',color:'#293e35'});
  // Back spine keeps the contiguous sample supported while a single layer
  // moves. It is behind the soil, never across the observation face.
  const spine = tagged(parts.casting([x0-2*s,-.8*s,z0-2.3*s],[x0+.3*s,height+1.8*s,z0-.5*s], 'steel'), 'rear-section-spine');
  spine.material = createSpecimenMaterial(b.pop,{role:'enamel',color:'#293e35'});
  const shelfGroups = SOIL_PROFILE_LAYERS.map((layer, i) => {
    const y = height * (1-layer.bottom), node = new T.Group(); b.root.add(node); node.name=`soil-layer-carriage-${i}`;
    // Only the back edge is retained. The visible front and all extraction
    // paths are open; a thin jaw carries the layer, not a duplicate soil slab.
    const shoe = plate([x0-.4*s,y-.5*s,z0-1*s], [x0+width+.4*s,y,z0+.5*s], 'brass','layer-rear-shoe');
    shoe.userData.soilProfileLayer=i; node.add(shoe);
    const rods = [-1.35,-.6].map(z => turnedShaftGeometry([x0-1.8*s,y-.5*s,z0+z*s], [x0+width*1.28,y-.5*s,z0+z*s], [[.20*s,0],[.20*s,1]]));
    const guide = metal(mergeInstrumentGeometry(rods), 'steel','layer-extraction-guides');
    guide.userData.soilProfileLayer=i; guide.visible=false;
    return { node, guide };
  });
  // The front-half observation is a horizontal opening of the SAME sample.
  // A small sliding foot follows it, without moving the scientific markers.
  const frontCradle = plate([x0-.3*s,-1.4*s,z0+depth*.55],[x0+width+.3*s,0,z1+.4*s], 'brass','front-half-contact-shoe');
  const openingGuides = metal(mergeInstrumentGeometry([.63,.94].map(v => turnedShaftGeometry(
    [x0, -1.0*s,z0+v*depth], [x0+width*2.12,-1.0*s,z0+v*depth], [[.23*s,0],[.23*s,1]]))), 'steel','section-opening-guides');
  openingGuides.visible=false;
  // A single water-drop pull tab is a real carriage on two steel guide rods.
  // Its normalized progress has no units of soil depth or elapsed years.
  const track = { start: [16 * s, height + 1.5 * s, z1 + 2 * s] as Vec3, end: [16 * s, 2.5 * s, z1 + 2 * s] as Vec3 };
  const rail = metal(mergeInstrumentGeometry([14.65,17.35].map(x => turnedShaftGeometry(
    [x*s,.5*s,z1+1.5*s],[x*s,height+3*s,z1+1.5*s],[[.27*s,0],[.27*s,1]]))), 'steel','water-carriage-guides');
  rail.userData.soilProfileRole = 'water-track';
  for (const y of [.7*s,height+2.5*s]) {
    const cap = tagged(parts.casting([12.9*s,y-.65*s,z1+.5*s],[19.1*s,y+.65*s,z1+2.5*s],'brass'), 'guide-crosshead');
    if(y<height/2) plate([13*s,-1.4*s,z0-1.5*s],[19*s,y,z1+2.5*s],'steel','guide-contact-foot');
    cap.userData.waterGuideDatum=y;
  }
  const carriage = new T.Group(); b.root.add(carriage); carriage.name='water-progress-carriage';
  const sleeves = [14.65,17.35].map(x => turnedSleeveGeometry([x*s,-1.8*s,-.5*s],[x*s,1.8*s,-.5*s],[[.62*s,0],[.73*s,.12],[.73*s,.88],[.62*s,1]],.31*s));
  const sleeveMesh = metal(mergeInstrumentGeometry(sleeves),'brass','water-slider-bearings'); carriage.add(sleeveMesh);
  // Local coordinates are relative to the existing native drag track.
  sleeveMesh.position.x=-16*s;
  const drop = new T.Shape(); drop.moveTo(0, 2.6 * s);
  drop.bezierCurveTo(-.15 * s, 1.5 * s, -1.55 * s, .35 * s, -1.55 * s, -.55 * s);
  drop.bezierCurveTo(-1.55 * s, -2.5 * s, 1.55 * s, -2.5 * s, 1.55 * s, -.55 * s);
  drop.bezierCurveTo(1.55 * s, .35 * s, .15 * s, 1.5 * s, 0, 2.6 * s);
  const dropGeometry = new T.ExtrudeGeometry(drop, { depth: .6 * s, bevelEnabled: false, curveSegments: 9 });
  const handle = b.mesh(dropGeometry, '#70969e', false, true, 'enamel'); handle.userData.soilProfileRole = 'water-handle';
  carriage.add(handle);
  handle.userData.soilProfileHandle = true;
  handle.userData.modelInput = { kind: 'phase-track', track, label: '上下拖动水滴，观察下渗、淋溶与淀积' };

  let state = evaluateSoilProfile(0), previousPhase = -1, previousSelection = -2;
  const contour = (layer: number, boundary: number, v: number, width = .43) => {
    const offset = soilProfileLayerOffset(state.selection, layer);
    b.contour(Array.from({ length: 25 }, (_, i) => viewPoint(i / 24, soilProfileBoundary(boundary, i / 24, v), v, offset)), width);
  };
  return {
    update(phase, selection) {
      if (phase !== previousPhase || selection !== previousSelection || viewDirty) {
        state = evaluateSoilProfile(phase, selection);
        layers.forEach(({ rear, front }, i) => { rear.position.x = soilProfileLayerOffset(state.selection, i) * width; front.position.x = rear.position.x + frontShift(); });
        shelfGroups.forEach(({node,guide},i)=>{node.position.x=soilProfileLayerOffset(state.selection,i)*width;guide.visible=state.selection===i;});
        frontCradle.position.x=frontShift(); openingGuides.visible=inspection==='section';
        roots.position.x=frontShift()+soilProfileLayerOffset(state.selection,1)*width;
        materials.forEach((mesh, i) => {
          const material = state.materials[i];
          const at = viewPoint(material.u, material.depth, 1, material.offsetX); at[2] += .65 * s;
          mesh.position.set(...at); mesh.rotation.z = i * .6 + material.travel * .8;
          Object.assign(mesh.userData, { u: material.u, depth: material.depth, offset: material.offsetX, travel: material.travel, status: material.status });
        });
        fragments.forEach(({ mesh, u, d }) => { const at = viewPoint(u, d, 1, soilProfileLayerOffset(state.selection, 4)); at[2] += .4 * s; mesh.position.set(...at); });
        leaves.forEach(mesh=>{mesh.position.x=soilProfileLayerOffset(state.selection,0)*width+(mesh.userData.sampleFront?frontShift():0);});
        waters.forEach(({ lane, position, geometry }) => {
          for (let i = 0; i <= 44; i++) {
            const d = state.water.front * i / 44, u = soilProfileWaterU(lane, d), offset = soilProfileOffsetAtDepth(d, state.selection);
            const half = .0042 * state.water.strength;
            const a = viewPoint(u - half, d, 1, offset), z = viewPoint(u + half, d, 1, offset);
            a[2] += .22 * s; z[2] += .22 * s;
            position.setXYZ(i * 2, ...a); position.setXYZ(i * 2 + 1, ...z);
          }
          position.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingSphere();
        });
        carriage.position.set(...phaseTrackPoint(state.phase, track));
        handle.position.set(0,0,0);
        previousPhase = phase; previousSelection = selection;
        viewDirty = false;
      }
      for (const { mesh } of waters) mesh.visible = state.water.active;
      labels.forEach((mesh, i) => {
        mesh.visible=i===2||i===3||state.selection===i;
        labelCarriages[i].visible=mesh.visible;
        labelCarriages[i].position.x=frontShift()+soilProfileLayerOffset(state.selection,i)*width;
      });

      for (let i = 0; i < layers.length; i++) {
        const offset = soilProfileLayerOffset(state.selection, i);
        contour(i, i, 1, .48); contour(i, i + 1, 1, .40);
        if (i === 0 || i === state.selection) contour(i, i, 0, .40);
        for (const u of [0, 1]) {
          b.contour([viewPoint(u, soilProfileBoundary(i, u, 1), 1, offset), viewPoint(u, soilProfileBoundary(i + 1, u, 1), 1, offset)], .47);
          b.contour([viewPoint(u, soilProfileBoundary(i, u, .55), .55, offset), viewPoint(u, soilProfileBoundary(i, u, 1), 1, offset)], .38);
          b.contour([point(u, soilProfileBoundary(i, u, 0), 0, offset), point(u, soilProfileBoundary(i, u, .55), .55, offset)], .38);
          if (inspection === 'section') {
            b.contour([point(u, soilProfileBoundary(i, u, .55), .55, offset), point(u, soilProfileBoundary(i + 1, u, .55), .55, offset)], .43);
          }
        }
        b.contour([point(1, soilProfileBoundary(i, 1, 0), 0, offset), point(1, soilProfileBoundary(i + 1, 1, 0), 0, offset)], .38);
        // Stationary matrix texture makes it clear that only a portion moves.
        const layer = SOIL_PROFILE_LAYERS[i];
        for (let j = 0; j < (i === 5 ? 12 : 20); j++) {
          const q = Math.sin((i * 31 + j) * 12.9) * .5 + .5, u = .04 + (j * .618 % 1) * .92;
          const d = layer.top + .016 + q * (layer.bottom - layer.top - .032), len = i === 5 ? .085 : .014;
          const a = viewPoint(u - len / 2, d, 1, offset), z = viewPoint(u + len / 2, d + (i === 5 ? .005 : .001), 1, offset);
          a[2] += .09 * s; z[2] += .09 * s; b.contour([a, z], i === 5 ? .25 : .16);
        }
      }
      const rootOffset = soilProfileLayerOffset(state.selection, 1);
      for (let i = 0; i < 5; i++) {
        const root = Array.from({ length: 15 }, (_, j) => {
          const p = viewPoint(.10 + i * .18 + Math.sin(j * .5 + i) * .023, .105 + j / 14 * .127, 1, rootOffset);
          p[2] += .12 * s; return p;
        });
        b.contour(root, .30);
      }
      b.contour([track.start, track.end], .25); b.outline(handle, .36);
      if (state.water.active) {
        for (const tracer of state.water.tracers) {
          const a = viewPoint(soilProfileWaterU(tracer.lane, tracer.tailDepth), tracer.tailDepth, 1, soilProfileOffsetAtDepth(tracer.tailDepth, state.selection));
          const z = viewPoint(tracer.u, tracer.depth, 1, soilProfileOffsetAtDepth(tracer.depth, state.selection));
          a[2] += .4 * s; z[2] += .4 * s;
          const end = b.v(z), tangent = end.clone().sub(b.v(a)).normalize();
          if (tangent.lengthSq() < .01) continue;
          const normal = new T.Vector3(-tangent.y, tangent.x, 0), back = end.clone().addScaledVector(tangent, -1.15 * s);
          b.flow.push({ points: [back.clone().addScaledVector(normal, .5 * s), end, back.clone().addScaledVector(normal, -.5 * s)], width: .72 * state.water.strength });
        }
        if (state.water.rain) for (let i = 0; i < 7; i++) {
          const u = .06 + i * .145, at = viewPoint(u, -.032, .78, soilProfileLayerOffset(state.selection, 0));
          b.flow.push({ points: [b.v([at[0] + .2 * s, at[1] + 1.5 * s, at[2]]), b.v([at[0] - .2 * s, at[1] - .6 * s, at[2]])], width: .66 * state.water.strength });
        }
      }
    },
    inspect(target) { inspection = soilProfileInspection(target).inspection; viewDirty = true; },
    focusBounds: () => ({ min: [12 * s, -3.4*s, z0 - 3 * s], max: [106 * s + frontShift(), height + 7 * s, z1 + 8 * s] }),
    describe: () => ({ kind: 'soil-profile', reference: SOIL_PROFILE_REFERENCE, phase: state.phase, selection: state.selection,
      stage: state.stage, layers: SOIL_PROFILE_LAYERS.map((layer, i) => ({ name: layer.name, offset: soilProfileLayerOffset(state.selection, i) })),
      inspection, section: soilProfileInspection(inspection), materials: state.materials, inventory: state.inventory, water: state.water, fixedMaterialCount: materials.length,
      waterTrack: track, rig:'guided-open-section', selfSupporting:true, buffersStable: true, notAllSoilMinerals: true, progressIsNotSoilFormingTime: true }),
  };
}

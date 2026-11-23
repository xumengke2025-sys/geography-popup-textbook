import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { buildSoilSortingWorld } from './textbook-soil-sorting-world';
import { evaluateSoilTransferDetail } from './textbook-soil-transfer-detail-model';
import { createInstrumentParts, mergeInstrumentGeometry } from './textbook-instrument-parts';
import { phaseTrackPoint } from './textbook-model-input';
import type { SolidMaterialRole } from './textbook-solid-materials';
import { mineralChip, specimenLeaf, specimenSeed, taperRoot } from './textbook-agricultural-specimens';
import { createSoilSpecimenFinish } from './textbook-soil-specimen-finish';

/** Four independent views of one retained, closed soil specimen. The fifth
 * factor remains the existing slope-sorting world, with its own exact grains.
 * Native controls locate an explanatory sequence; they do not manufacture
 * soil, measure its age, or imply that factors occur one after another. */
export function buildSoilFactorsWorld(b: TextbookGeometry): ModelMotion {
  const first = b.meshes.length, s = b.width / 100, depth = .36 * Math.max(43 * s, Math.min(68 * s, b.height));
  const sectionWidth = .84, sectionHeight = 1.10;
  const z0 = -LIFT_MARGIN - b.height * .62;
  const p = (u: number, v: number, h = 0): Vec3 => [(.5 + (u - .5) * sectionWidth) * b.width, h * s * sectionHeight, z0 + v * depth];
  const parts = createInstrumentParts(b);
  const role = (mesh: any, name: string) => { mesh.name = name; mesh.userData.soilFactorsPart = name; return mesh; };
  const solid = (g: any, color: string, material: SolidMaterialRole, name: string) => role(b.mesh(g, color, false, true, material), name);
  const input = (mesh: any, selection: number) => {
    mesh.userData.modelInput = { kind: 'select', selection, keepPhase:true,
      label: `独立观察${['成土母质与风化','生物循环','温度与降水','时间积累'][selection]}的作用` };
    mesh.userData.interactionFeedback = false; return mesh;
  };
  const plate = (a: Vec3, c: Vec3, material: 'wood' | 'brass' | 'steel' | 'ivory', name: string) => role(parts.plate(a, c, material), name);
  // A thin collector-like specimen tray touches the natural bottom. Short
  // feet and side jaws carry this actual footprint; no frame crosses the soil.
  plate(p(.105, .16, -3.2), p(.895, 1.16, -1.9), 'wood', 'specimen-tray');
  plate(p(.11, .165, -1.9), p(.89, 1.15, -1.57), 'brass', 'tray-cut-edge');
  const pan = role(parts.casting(p(.125, .18, -1.57), p(.875, 1.12, 0), 'steel'), 'specimen-contact-pan');
  pan.material = b.materialFor ? b.materialFor('enamel', '#293e35') : b.material('#293e35');
  for (const u of [.18, .82]) for (const v of [.24, .91]) {
    parts.bearing(p(u, v, -3.7), [0, 1, 0], 1.05 * s, 2.1 * s);
    plate(p(u - .023, v - .038, -5), p(u + .023, v + .038, -4.6), 'wood', 'short-support-pad');
  }
  for (const u of [.125, .875]) {
    const sign = u < .5 ? 1 : -1;
    plate(p(u - .009, .45, -1.42), p(u + .009, .62, 6.6), 'brass', 'low-side-retaining-jaw');
    plate(p(u, .46, 5.3), p(u + sign * .025, .61, 6.5), 'ivory', 'jaw-contact-pad');
    parts.fasteners([p(u, .48, 6.7), p(u, .59, 6.7)], [0, 1, 0], .34 * s);
  }
  // Every layer shares the same cut silhouette and contact function. Face
  // relief is shallow and aperiodic: no separate floating bricks or trenches.
  let soilDepth = 6;
  const noise = (x: number, y: number) => {
    const hash = (a: number, c: number) => { const n = Math.sin(a * 127.1 + c * 311.7 + 23.4) * 43758.5453; return n - Math.floor(n); };
    const a = Math.floor(x), c = Math.floor(y), u = x - a, v = y - c;
    const sx = u * u * (3 - 2 * u), sy = v * v * (3 - 2 * v);
    return (hash(a, c) * (1 - sx) + hash(a + 1, c) * sx) * (1 - sy)
      + (hash(a, c + 1) * (1 - sx) + hash(a + 1, c + 1) * sx) * sy;
  };
  const seam = (u: number, v: number) => .35 * Math.sin(u * 19 + v * 1.4) + .19 * Math.sin(u * 41 + v * 8.2);
  const boundary = (level: number, u: number, v: number) => {
    if (level === 0) return 0;
    if (level === 1) return 8 + seam(u, v);
    if (level === 2) return 14 + seam(u, v) * .6;
    if (level === 3) return 14 + soilDepth * .73 + seam(u, v) * .42;
    return 14 + soilDepth + .65 * (noise(u * 19, v * 12) - .5)
      + .25 * (noise(u * 43, v * 28) - .5);
  };
  const xAt = (u: number, v: number) => {
    const edge = Math.exp(-v * 16) + Math.exp(-(1 - v) * 16);
    return .14 + .72 * u + (.019 * edge + Math.sin(v * 16.3) * .004) * (Math.exp(-u * 25) - Math.exp(-(1 - u) * 25));
  };
  // Shallow recesses expose grain surfaces at a fresh cut. Adjacent horizons
  // evaluate the same relief field so contacts still meet as the column grows.
  const faceRelief=(u:number,h:number)=> .71*(noise(u*26,h*.46)-.5)+.42*(noise(u*83,h*1.21)-.5);
  const faceV=(u:number)=>{
    let lo=0,hi=1;
    for(let i=0;i<14;i++){const mid=(lo+hi)/2;if(xAt(mid,1)<u)lo=mid;else hi=mid;}
    const t=(lo+hi)/2;return .9+.012*Math.sin(t*16.1)+.006*Math.sin(t*35);
  };
  // The visible roots and their pores share these authored centre curves.
  const rootCurves = [-1, 0, 1].map(sign => {
    const at = (u: number, h: number) => {
      const point = p(u, faceV(u), h); point[2] += (faceRelief(u,h)-.10) * s; return new T.Vector3(...point);
    };
    return new T.CatmullRomCurve3([new T.Vector3(...p(.5,.55,20)),
      new T.Vector3(...p(.5+sign*.025,.72,18.7)), at(.5+sign*.075,16), at(.5+sign*.12,12.4)]);
  });
  const poreSamples = rootCurves.flatMap(curve => curve.getPoints(80).slice(45));
  const layer = (level: number, color: string, material: SolidMaterialRole) => {
    const nx = 84, nz = 10, ny = 24, coords: { u: number; v: number; f: number; front: boolean }[] = [], indices: number[] = [];
    const add = (u: number, v: number, f: number, front = false) => { coords.push({ u, v, f, front }); return coords.length - 1; };
    // Top/bottom and all four sides are closed, with permanent vertex buffers.
    const grid = (cols: number, rows: number, at: (u: number, v: number) => [number, number, number, boolean?], reverse = false) => {
      const start = coords.length;
      for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) add(...at(i / cols, j / rows));
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const a = start + j * (cols + 1) + i, c = a + cols + 1;
        if (reverse) indices.push(a, a + 1, c, a + 1, c + 1, c); else indices.push(a, c, a + 1, a + 1, c, c + 1);
      }
    };
    grid(nx, nz, (u, v) => [u, v, 0], true); grid(nx, nz, (u, v) => [u, v, 1]);
    grid(nx, ny, (u, f) => [u, 0, f]); grid(nx, ny, (u, f) => [u, 1, f, true], true);
    grid(nz, ny, (v, f) => [0, v, f], true); grid(nz, ny, (v, f) => [1, v, f]);
    const g = new T.BufferGeometry(), attr = new T.Float32BufferAttribute(new Float32Array(coords.length * 3), 3);
    const colors = new Float32Array(coords.length * 3), base = new T.Color(color);
    coords.forEach((v, i) => {
      const grain = noise(v.u * 39 + level * 7, v.f * 13 + v.v * 17);
      const patch=noise(v.u*13+level,v.f*3.9+v.v*5.7);
      const shade=.81+.19*grain+.20*patch;
      colors.set([base.r * shade, base.g * shade, base.b * shade], i * 3);
    });
    g.setAttribute('position', attr); g.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); g.setIndex(indices);
    const mesh = solid(g, color, material, ['bedrock-monolith', 'weathered-parent-material', 'mineral-soil', 'organic-horizon'][level]);
    // Material.clone discards onBeforeCompile, breaking the shared reveal alpha.
    // Register this finish with the same Popout lifecycle as every other solid.
    mesh.material = createSoilSpecimenFinish(b.pop, '#ffffff', level, s,
      (['outcrop', 'alluvium', 'loam', 'turf'] as const)[level]);
    mesh.material.vertexColors = true;
    input(mesh, level < 2 ? 0 : level === 3 ? 1 : 3);
    // Horizontal coordinates and the weathered contact stay fixed while the
    // upper horizons grow. Cache the profile at its starting depth, including
    // only root samples close enough in x to cut a pore at this vertex.
    const baseDepth=soilDepth, growth=[0,0,0,.73,1];
    const vertices=coords.map(v=>{
      const u=xAt(v.u,v.v);
      const vv=.21+.69*v.v+(.012*Math.sin(v.u*16.1)+.006*Math.sin(v.u*35))*Math.pow(Math.abs(v.v-.5)*2,3);
      const a=boundary(level,u,vv),c=boundary(level+1,u,vv);
      const [x,y,z]=p(u,vv,a+(c-a)*v.f);
      const rise=(growth[level]+(growth[level+1]-growth[level])*v.f)*s*sectionHeight;
      const roots=v.v===1?poreSamples.filter(root=>Math.abs(x-root.x)<1.2*s):[];
      const cut=v.v>.89?Math.max(0,(v.v-.89)/.11)**2*faceRelief(u,y/(s*sectionHeight))*s:0;
      return {x,y,z:z+cut,rise,roots};
    });
    const update = () => {
      const rootScale=(soilDepth+6)/12;
      const rootOffset=(boundary(4,.5,.55)-20*rootScale)*s*sectionHeight;
      vertices.forEach(({x,y,z,rise,roots},i)=>{
        const height=y+rise*(soilDepth-baseDepth);
        let recess=0;
        for(const root of roots){
          const distance=Math.hypot(x-root.x,height-(root.y*rootScale+rootOffset));
          recess=Math.max(recess,Math.max(0,1-distance/(1.2*s))**2);
        }
        attr.setXYZ(i,x,height,z-recess*.8*s);
      });
      attr.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
    };
    // Material that reaches a horizon mottles the exposed cut itself. A
    // smooth envelope and mineral-scale variation feather the deposit into
    // the surrounding grains, including the pore walls.
    const frontIndices=coords.flatMap((c,i)=>c.front?[i]:[]);
    const pigment=[new T.Color('#a08d71'),new T.Color('#463a2e'),new T.Color('#99784f')];
    let lastMix='';
    const receive=(record:ReturnType<typeof evaluateSoilTransferDetail>)=>{
      const factor=record.factor,patches=record.receiverPatches;
      const active=level===(factor===1?3:1)&&factor<3&&patches.some(q=>q.amount>.001);
      const key=active?factor+'/'+patches.map(q=>q.amount.toFixed(3)).join(','):'none';
      if(lastMix===key)return;lastMix=key;
      const out=g.attributes.color;
      for(const i of frontIndices){
        const specimenU=xAt(coords[i].u,1),h=attr.getY(i)/(s*sectionHeight);
        let amount=0;
        if(active){
          const column=Math.max(0,Math.min(5,Math.round((specimenU-patches[0].u)/(patches[1].u-patches[0].u))));
          const patch=patches[column],dx=(specimenU-patch.u)/.065;
          const warp=noise(specimenU*49,h*1.3)-.5;
          const dh=(h-patch.base-.45*patch.growth*patch.amount-warp*.58)/(.28+patch.growth*patch.amount*.64);
          amount=patch.amount*.66*Math.exp(-1.75*dx*dx-2.05*dh*dh)*(.78+.38*noise(specimenU*115,h*2));
        }
        const tone=pigment[factor]??base;
        out.setXYZ(i,colors[3*i]*(1-amount)+tone.r*amount,colors[3*i+1]*(1-amount)+tone.g*amount,colors[3*i+2]*(1-amount)+tone.b*amount);
      }
      out.needsUpdate=true;
    };
    update(); return { mesh, update, receive };
  };
  const layers = [layer(0, '#97958b', 'rock'), layer(1, '#b6a07d', 'land'), layer(2, '#8a6c49', 'land'), layer(3, '#584633', 'land')];
  // Fractured rock remains attached at each packet source. Its exposed
  // thickness decreases independently as the two pieces leave that column.
  const sources=evaluateSoilTransferDetail(0,0).particles;
  const weatheringFronts=sources.slice(0,6).map(({source},column)=>{
    const chips=[];
    const pieces=4+Math.floor(noise(column,7)*6);
    for(let j=0;j<pieces;j++){
      const g=mineralChip(column*12+j);
      g.scale((.28+1.17*noise(column,j))*s,(.24+.85*noise(j,column+3))*s,.48*s);
      g.rotateZ((noise(column+3,j)-.5)*.95);
      g.translate((noise(column+9,j)-.5)*7.8*s,(noise(j,column+2)-.5)*3.3*s,0);
      chips.push(g);
    }
    const mesh=input(solid(mergeInstrumentGeometry(chips),'#a39a83','rock','attached-weathering-front'),0);
    mesh.material=createSoilSpecimenFinish(b.pop,'#97876f',0, .55*s,'outcrop');
    mesh.position.set(...p(source.u,.913,boundary(2,source.u,.913)));
    return mesh;
  });
  // Inclusions left in the parent matrix stay behind when the tracked
  // weathering packets move. Each chip rests partly inside the cut face.
  for(let shade=0;shade<3;shade++){
    const chips=[];
    for(let j=0;j<21;j++){
      const id=shade*21+j,u=.195+.61*specimenSeed(id,15),h=8.95+3.94*specimenSeed(id,18);
      const at=p(u,faceV(u),h),r=.16+.71*specimenSeed(id,21)**1.55;
      const chip=mineralChip(id);chip.scale(r*1.53*s,r*.55*s,r*.77*s);chip.rotateZ((specimenSeed(id,22)-.5)*1.26);
      chip.translate(at[0],at[1],at[2]+(faceRelief(u,h)-.04)*s);chips.push(chip);
    }
    const m=input(solid(mergeInstrumentGeometry(chips),'#9b8b71','rock','parent-matrix-grit'),0);
    m.material=createSoilSpecimenFinish(b.pop,['#7b7162','#b7a891','#9c825e'][shade],0,.27*s,'outcrop');
    m.userData.agriculturalSpecimen='fixed-parent-minerals';
  }
  const litterPieces=[];
  for(let i=0;i<39;i++){
    const u=.17+.66*specimenSeed(i,25),v=.24+.60*specimenSeed(i,26),h=boundary(4,u,v);
    const at=p(u,v,h),leaf=specimenLeaf(33+i),r=.35+.93*specimenSeed(i,22);
    leaf.scale(r*1.94*s,r*1.60*s,r*s);leaf.rotateX(-Math.PI/2+.16*(specimenSeed(i,27)-.5));
    leaf.rotateY(i*2.4);leaf.translate(at[0],at[1]+.11*s,at[2]);litterPieces.push(leaf);
  }
  const litter=input(solid(mergeInstrumentGeometry(litterPieces),'#776343','plant','retained-surface-litter'),1);
  litter.userData.agriculturalSpecimen='organic-litter';
  // Organic matter belongs to the very same upper surface and stem. Roots
  // emerge continuously into the visible cut, then branch inside the soil.
  const plant = new T.Group(); b.root.add(plant);
  const plantStart = b.meshes.length;
  const stemPath: Vec3[] = [[0, 0, 0], [.2 * s, 3 * s, 0], [-.45 * s, 7 * s, .2 * s], [.3 * s, 10.9 * s, 0]];
  const stem = solid(new T.TubeGeometry(new T.CatmullRomCurve3(stemPath.map(v => new T.Vector3(...v))), 20, .23 * s, 7, false), '#6e7551', 'plant', 'retained-plant-stem');
  plant.add(stem);
  for (let i = 0; i < 6; i++) {
    const sign=i%2?1:-1,h=2.6+Math.floor(i/2)*2.55+i%2*.57;
    const blade=specimenLeaf(i),length=(4.5-i*.19)*s;blade.scale(length,length,length);
    const leaf=input(solid(blade,i%3?'#71804e':'#84945a','plant','connected-leaf'),1);
    leaf.rotation.set(0,.73*Math.sin(i*2.85+.4),sign<0?Math.PI-.24:.25,'YZX');
    leaf.position.set(0,h*s,.1*s);plant.add(leaf);
  }
  const plantMembers = b.meshes.slice(plantStart);
  const rootMeshes = rootCurves.flatMap((curve, i) => {
    const out: any[] = [];
    const add = (path: any, radius: number, parentPoint?: any) => {
      const mesh = input(solid(taperRoot(path,radius*s,30), i===1?'#73593c':'#816446', 'land', 'continuous-profile-root'),1);
      mesh.userData.agriculturalSpecimen='tapered-root';
      if (parentPoint) mesh.userData.rootJunction = parentPoint.toArray();
      out.push(mesh);
    };
    add(curve,.36);
    for(let j=0;j<5;j++) {
      const anchor=curve.getPoint(.68+j*.064),side=(i+j)%2?1:-1;
      const reach=(1.5+2.55*specimenSeed(i,j+3))*s;
      const middle=anchor.clone().add(new T.Vector3(side*reach*.40,-.77*s,.12*s));
      const tip=anchor.clone().add(new T.Vector3(side*reach,-(1.2+1.4*specimenSeed(j,i+5))*s,-.14*s));
      const fork=new T.CatmullRomCurve3([anchor,middle,tip]);add(fork,.12+.06*specimenSeed(i,j),anchor);
      const join=fork.getPoint(.55);
      add(new T.LineCurve3(join,join.clone().add(new T.Vector3(side*.53*s,-.98*s,-.12*s))),.073,join);
    }
    return out;
  });
  const weatheredGrains=Array.from({length:12},(_,id)=>{
    const chip=mineralChip(80+id),r=(.77+.20*specimenSeed(id,55))*s;
    chip.scale(1.23*r,.86*r,r);return chip;
  });
  const mobileGrain=new T.IcosahedronGeometry(.75*s,1);
  const packetFinishes=[createSoilSpecimenFinish(b.pop,'#8d8069',0,.28*s,'outcrop'),null,createSoilSpecimenFinish(b.pop,'#a48960',1,.33*s,'alluvium')];

  const markers = Array.from({ length: 12 }, (_, id) => {
    const mesh = solid(weatheredGrains[id], '#8c805e', 'land', 'same-identity-transfer-marker'); mesh.userData.soilPacketId = id; return mesh;
  });
  const litterGeometry=specimenLeaf(78);litterGeometry.scale(3.4*s,3.4*s,3.4*s);litterGeometry.translate(-1.7*s,0,0);
  const climateStart = b.meshes.length;
  // Mounted rain and radiant-heat heads form an environmental test rig.
  // They are explanatory apparatus, not a claim to simulate real weather or
  // accelerate actual soil formation. Both return to the same specimen tray.
  for (const u of [.16, .84]) {
    role(parts.column(p(u, .25, -.1), p(u, .25, 32.5), 1.65 * s), 'climate-column');
    parts.fasteners([p(u-.024,.24,.05),p(u+.024,.24,.05)], [0,1,0], .34*s);
  }
  const rainLine: Vec3[] = [p(.16,.25,32.5),p(.16,.25,35),p(.21,.33,35),p(.27,.37,34)];
  input(solid(new T.TubeGeometry(new T.CatmullRomCurve3(rainLine.map(v=>new T.Vector3(...v))),24,.54*s,10,false),'#a88b50','brass','rain-supply-arm'),2);
  role(parts.shaft(p(.16,.37,33.5),p(.36,.37,33.5),.7*s,'brass'),'rain-manifold');
  for(let i=0;i<4;i++) {
    const u=.18+i*.045;
    input(role(parts.shaft(p(u,.37,33.5),p(u,.38,32),.34*s,'steel'),'rain-nozzle'),2);
  }
  role(parts.shaft(p(.84,.25,32.5),p(.78,.35,33.7),.58*s,'brass'),'heater-arm');
  const heatHead = new T.Group();heatHead.position.set(...p(.78,.35,33.5));heatHead.rotation.x=-.78;b.root.add(heatHead);
  const heatShell=input(solid(new T.CylinderGeometry(4.7*s,4.2*s,1.5*s,40),'#a88b50','brass','radiant-heat-housing'),2);heatHead.add(heatShell);
  const heaterFace=input(solid(new T.CylinderGeometry(3.9*s,3.9*s,.3*s,40),'#b88b56','ivory','radiant-heat-face'),2);heaterFace.position.y=-.86*s;heatHead.add(heaterFace);
  // Narrow concentric ribs belong to the emitting face.
  for(const radius of [1.1,2.2,3.3]){
    const ring=solid(new T.TorusGeometry(radius*s,.07*s,6,40),'#544534','wood','heater-face-rib');ring.rotation.x=Math.PI/2;ring.position.y=-1.03*s;heatHead.add(ring);
  }
  const climateMembers = b.meshes.slice(climateStart);
  // Four small legends are on actual specimen controls, below the exposed
  // natural section. Text is neither a hanging billboard nor duplicated above.
  const selectorMeshes: any[] = [];
  const rake=-.44;
  // Selectors seat in the tray's projecting front apron. The rail brackets
  // return to that same apron, rather than an unrelated second plinth.
  role(parts.casting(p(.135, .97, -1.57), p(.865, 1.12, -.2), 'steel'), 'front-controls-contact-shelf');
  for (let i = 0; i < 4; i++) {
    const u = .23 + i * .18, z = p(0, 1.15)[2], x = p(u, 0)[0];
    const panelHeight=5.8*s,center=new T.Vector3(x,-.5*s,z);
    const panel=role(parts.casting([-7*s,-panelHeight/2,-.56*s],[7*s,panelHeight/2,.28*s],'brass'),'factor-selector-body');
    panel.geometry.rotateX(rake);panel.geometry.translate(...center.toArray());
    input(panel,i);
    const onFace=(offset:number):Vec3=>[x,center.y-Math.sin(rake)*offset,z+Math.cos(rake)*offset];
    const face=input(solid(new T.BoxGeometry(13.25*s,5.36*s,.18*s),'#e3ddc9','ivory','factor-selector-inset'),i);
    face.rotation.x=rake;face.position.set(...onFace(.36*s));
    const text=input(b.label(['母质','生物','气候','时间'][i],onFace(.48*s),12*s,5.12*s,{appearance:'engraved'}),i);
    role(text,'inset-factor-text');text.rotation.x=rake;text.userData.labelMount='surface';
    selectorMeshes.push(face);
  }
  const track = { start: p(.17, 1.26, -4.1), end: p(.83, 1.26, -4.1) };
  const sliderInput = { kind: 'phase-track' as const, track, label: '拖动标本前缘，回看当前因素的作用' };
  const rail = parts.shaft(track.start, track.end, .39 * s, 'steel'); role(rail, 'native-observation-rail'); rail.userData.modelInput = sliderInput;
  for (const u of [.17, .83]) {
    plate(p(u - .017, .985, -4.65), p(u + .017, 1.28, -3.2), 'brass', 'rail-contact-bracket');
    parts.bearing(p(u, 1.26, -4.1), [1, 0, 0], .75 * s, 2.1 * s);
  }
  const handle = new T.Group(); b.root.add(handle);
  const handleStart = b.meshes.length;
  const collar = parts.bearing([0, 0, 0], [1, 0, 0], 1.04 * s, 3.3 * s); handle.add(collar);
  const grip = solid(new T.SphereGeometry(1.8 * s, 20, 10), '#34483e', 'enamel', 'native-rail-grip'); grip.scale.set(1, .73, 1.15); grip.position.set(0, .7 * s, .6 * s); handle.add(grip);
  for (const m of b.meshes.slice(handleStart)) { m.userData.modelInput = sliderInput; m.userData.interactionFeedback = false; }
  const owned = b.meshes.slice(first), sorting = buildSoilSortingWorld(b);
  let selection = 0, state = evaluateSoilTransferDetail(0, 0), previousDepth = 6;
  // Pulling the ring exchanges the soil monolith with the runoff tray.
  const ring=new T.TorusGeometry(1.72*s,.37*s,10,36);
  const drawer=b.mesh(ring,'#a88b50',false,true,'brass');drawer.name='slope-tray-pull';
  const shoe=parts.casting([-1.98*s,-.62*s,-.8*s],[1.98*s,.62*s,.8*s],'brass');shoe.name='slope-tray-eye-plate';
  const drawerPlate=parts.plate([-4.8*s,-1.9*s,0],[4.8*s,1.9*s,.44*s],'ivory',.18*s);
  const faceNames=['坡面','土柱'].map(name=>b.label(name,[0,0,0],9.25*s,3.62*s,{appearance:'engraved'}));
  for(const m of faceNames)m.userData.labelMount='surface';
  drawer.userData.smallPointTarget=true;
  shoe.userData.modelInput=drawer.userData.modelInput={kind:'select',selection:4,toggleTo:0,keepPhase:true,label:'拉环更换坡面冲刷标本，再拨回土柱'};
  for(const mesh of [drawerPlate,...faceNames]){mesh.userData.modelInput=drawer.userData.modelInput;mesh.userData.smallPointTarget=true;}
  const count = owned.length;
  return { update(phase, n, dt, reduced) {
    selection = Math.max(0, Math.min(4, Math.round(n)));
    const mount=selection===4 ? [b.width*.94,.9*s,z0+57*s] : p(.875,1.10,-.4);
    drawer.position.set(mount[0],mount[1]-1.0*s,mount[2]+1.05*s); shoe.position.set(...mount);
    drawerPlate.position.set(mount[0]+3.4*s,mount[1]+1.75*s,mount[2]);
    faceNames.forEach((mesh,i)=>{mesh.position.copy(drawerPlate.position);mesh.position.z+=.48*s;mesh.visible=i===Number(selection===4);});
    for (const mesh of owned) mesh.visible = selection !== 4;
    sorting.update(phase, selection, dt, reduced); if (selection === 4) return;
    state = evaluateSoilTransferDetail(phase, selection); soilDepth = state.soilDepth;
    if (soilDepth !== previousDepth) { layers.forEach(v => v.update()); previousDepth = soilDepth; }
    weatheringFronts.forEach((mesh,i)=>{
      mesh.visible=selection===0;
      mesh.scale.y=sectionHeight*(1-.76*(state.particles[i].travel+state.particles[i+6].travel)/2);
    });
    litter.position.y=(soilDepth-6)*s*sectionHeight;
    const surface = boundary(4, .5, .55); plant.position.set(...p(.5, .55, surface));
    const rootScale = (soilDepth + 6) / 12;
    rootMeshes.forEach(mesh => { mesh.scale.y = rootScale; mesh.position.y = (surface - 20 * rootScale) * s * sectionHeight; });
    plantMembers.forEach(mesh => { mesh.visible = true; });
    markers.forEach((mesh, i) => {
      const packet = state.particles[i]; mesh.visible = selection < 3; mesh.position.set(...p(packet.u, packet.v, packet.h));
      mesh.position.z += .7 * s; mesh.userData.soilTransferStage = packet.stage;
      const leaf = selection === 1;
      mesh.geometry=leaf?litterGeometry:selection===2?mobileGrain:weatheredGrains[i];
      mesh.scale.set(leaf ? 1 : selection === 2 ? .6 : 1.15, leaf ? 1 : selection === 2 ? .57 : .8, leaf ? .8 : .85);
      mesh.rotation.set(leaf ? .18 : i * .71, leaf ? packet.travel * .5 : i * .13, leaf ? packet.travel + i * .2 : i * .33);
      mesh.material=packetFinishes[selection]??(b.materialFor?b.materialFor('plant',packet.arrived?'#73664a':'#a29262'):b.material('#a29262'));
      // Approaching grains stand clear. Retained grains settle against the cut.
      if(!leaf)mesh.position.z-=(.80*s)*packet.incorporation;
    });
    for(const layer of layers)layer.receive(state);
    climateMembers.forEach(mesh => { mesh.visible = selection === 2; });
    heatHead.visible = selection === 2;
    handle.position.set(...phaseTrackPoint(state.phase, track));
    selectorMeshes.forEach((mesh, i) => { mesh.material = b.materialFor ? b.materialFor('ivory', selection === i ? '#eee7d1' : '#c5c0ad') : b.material('#e3ddc9'); });
    if (selection === 2) {
      if (state.water.rain) for (let i = 0; i < 4; i++) b.trace([p(.18 + i * .045, .38, 32), p(.18 + i * .045, .38, 32 - (32 - surface) * state.water.rainReach)], phase + i * .13, 2);
      if (state.water.active) for (let i = 0; i < 3; i++) b.trace([p(.66 + i * .07, .927, surface), p(.66 + i * .07, .927, state.water.front)], phase + i * .17, 2, 'flow', 1, .65);
    }
  }, focusBounds: () => selection === 4 ? sorting.focusBounds!() : ({ min: p(.07, .12, -6), max: p(1, 1.29, selection === 2 ? 45 : 37) }),
  describe: () => ({ kind: 'soil-forming-factors', construction: 'continuous-closed-contact-specimen', factor: ['parent-material','biological-cycle','climate','time','relief-sorting'][selection],
    ...(selection === 4 ? { sorting: sorting.describe!() } : { provenance: state }), soilDepth: 'illustrative-not-centimetres', organicMatterViaBiology: true, hotWetIsNotAutomaticallyFertile: true,
    growthIsNotAChronometer: true, factorsAreIndependent: true, climateRigIsTeachingAnalogy: true, connectedNaturalContacts: true, nativeControlsOnSpecimen: true, ownMeshes: count, sharedSortingUnmodified: true, buffersStable: true }) };
}

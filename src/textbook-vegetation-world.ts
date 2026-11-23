import { botanicalBark, botanicalFloor, botanicalCabinet } from './textbook-botanical-specimens';
import { applyEarthScan } from './textbook-earth-scan';
import { chamferedPlateGeometry, turnedShaftGeometry } from './textbook-instrument-parts';
import { mountSpecimenDial } from './textbook-specimen-dial';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { createSpecimenMaterial } from './textbook-solid-materials';
import { buildFernSurface, buildLeafBladeSurface, type CrownHabit, type NaturalSurface } from './textbook-natural-form-geometry';
import { vegetationCrown, vegetationStem } from './textbook-vegetation-form';
const clamp = (n: number, a = 0, c = 1) => Math.max(a, Math.min(c, n));
const smooth = (a: number, c: number, n: number) => { const q = clamp((n - a) / (c - a)); return q * q * (3 - 2 * q); };
const stage = (n: number, max: number) => Math.round(clamp(n, 0, max));
const cycle = (n: number) => ((n % 1) + 1) % 1;

function frame(b: TextbookGeometry) {
  const s = b.width / 100, depth = clamp(b.height, 43 * s, 68 * s);
  const z0 = -LIFT_MARGIN - b.height * .62, z1 = z0 + depth;
  return { s, z0, z1, depth,
    p: (u: number, v: number, h = 0): Vec3 => [u * b.width, h * s, z0 + v * depth],
    bounds: (height = 54) => ({ min: [0, 0, z0 - 8 * s] as Vec3, max: [b.width, height * s, z1 + 12 * s] as Vec3 }),
  };
}

type LabelSpec = [string, number, number, number, number?];
function labelSets(b: TextbookGeometry, f: ReturnType<typeof frame>, sets: LabelSpec[][]) {
  const tilt=-Math.PI*.31;
  return sets.map(set=>set.map(([text],i)=>{
    const at=f.p([.5,.2,.8][i],1.214,1.65);at[1]-=Math.sin(tilt)*.72*f.s;at[2]+=Math.cos(tilt)*.72*f.s;
    const m=b.label(text,at,(i===0?28.1:24.8)*f.s,5.1*f.s,{appearance:'engraved',ink:'#3e3c2c'});
    m.rotation.x=tilt;m.userData.labelMount='surface';return m;
  }));
}
function showLabels(sets: any[][], index: number) { sets.forEach((set, i) => set.forEach(label => { label.visible = i === index; })); }

function naturalGeometry(surface: NaturalSurface) {
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(surface.positions, 3)); g.setIndex(surface.indices);
  g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere(); return g;
}

function pebble(b: TextbookGeometry, radius: number, color: string) { return b.mesh(new T.IcosahedronGeometry(radius,0), color, false); }
/** Reusable low-poly vegetation. Species are represented by structural
 * traits, not a collection of photographic cards or decorative icons. */
export function buildVegetationWorld(b: TextbookGeometry): ModelMotion {
  const f = frame(b), { s, p } = f;
  const featuredTree = 4;
  // The full forest floor belongs to the overview. A close observation uses a
  // small piece of that same ground instead of magnifying the whole plinth.
  const soil=botanicalFloor(b,p(.02,.1,1.8),p(.98,.98,1.8),s),forestFloor=soil.ground;
  const cabinet=botanicalCabinet(b,p,s);
  const dialStart=b.meshes.length;
  const specimenDial=mountSpecimenDial(b,p(.78,1.05,6),5.5*s,{label:'旋转标本盘，更换植被',choices:['热带雨林','常绿阔叶林','落叶阔叶林','针叶林','热带草原','温带草原','荒漠']});
  const selectorParts=b.meshes.slice(dialStart);
  const seasonalStart=b.meshes.length;
  const seasonDial=mountSpecimenDial(b,p(.22,1.05,6),5.5*s,{label:'转动季节盘，观察叶和草的变化',turns:1});
  const seasonParts=b.meshes.slice(seasonalStart);
  const habits: CrownHabit[] = ['rainforest', 'evergreen', 'deciduous', 'conifer', 'savanna', 'shrub'];
  const bark = botanicalBark(b,.028,'#817059');
  const places = [[.13, .31], [.39, .23], [.67, .28], [.88, .4], [.26, .65], [.55, .58], [.76, .77], [.12, .84]];
  // Mottled litter and shade sit in the same coordinates as their trees.
  // The dryland and grassland branches keep their own open ground.
  const rainFloor = createSpecimenMaterial(b.pop, { color: '#958b68', role: 'land' });
  applyEarthScan(rainFloor,'turf',14*s);
  const openGround = forestFloor.material;
  const arid = createSpecimenMaterial(b.pop,{color:'#baa27d',role:'land'});applyEarthScan(arid,'alluvium',8*s);
  const groundPoints = forestFloor.geometry.attributes.position;
  const groundColors = new Float32Array(groundPoints.count * 3);
  for (let i=0; i<groundPoints.count; i++) {
    const u=groundPoints.getX(i)/b.width, v=(groundPoints.getZ(i)-f.z0)/f.depth;
    let shade=0;
    for(const [tu,tv] of places) shade=Math.max(shade,Math.exp(-48*((tu-u)**2+(tv-v)**2)));
    const light=1-.38*shade+.08*Math.sin(u*25+v*14)*Math.cos(v*23);
    groundColors.set([light,light*(1.03-.09*shade),light*.81],i*3);
  }
  forestFloor.geometry.setAttribute('color',new T.Float32BufferAttribute(groundColors,3));
  rainFloor.vertexColors=true;
  const trees = places.map(([u, v], i) => {
    const stems = habits.map(habit => {
      const mesh = b.mesh(naturalGeometry(vegetationStem(habit, i + 1, i === featuredTree)), '#796d53', false); mesh.material = bark;
      mesh.userData.vegetationPart = 'branched-stem'; mesh.userData.vegetationTree = i; mesh.userData.vegetationHabit = habit;
      mesh.userData.modelInput = { kind: 'inspect', target: 'layers', toggleTo: 'overview', label: '查看树冠之下保留的林内空间' };
      return { habit, mesh };
    }); const trunk = stems[0].mesh;
    const crowns = habits.map(habit => {
      const mesh = b.mesh(naturalGeometry(vegetationCrown(habit, i + 1)), '#819575', false);
      mesh.material = createSpecimenMaterial(b.pop, { color: '#75875f', role: 'plant' });
      if (habit === 'rainforest') {
        const positions = mesh.geometry.attributes.position;
        const colors = new Float32Array(positions.count * 3);
        for (let k = 0; k < positions.count; k++) {
          const x = positions.getX(k), y = positions.getY(k), z = positions.getZ(k);
          const exposure = clamp(.44 + y*.88 + .13*Math.sin(7*x+3*z+i) + .08*Math.cos(9*z-x));
          colors.set([.60+.57*exposure, .72+.42*exposure, .62+.28*exposure], k*3);
        }
        mesh.geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
        mesh.material.vertexColors = true;
      }
      mesh.userData.vegetationPart = 'crown'; mesh.userData.vegetationHabit = habit; mesh.userData.vegetationTree = i;
      mesh.userData.modelInput = { kind: 'inspect', target: 'layers', toggleTo: 'overview', label: '查看树冠与林内层次' };
      return { habit, mesh };
    });
    return { u, v, index: i, trunk, stems, crowns };
  });
  const grassPatch = (sparse: boolean) => {
    const vertices: number[] = [], indices: number[] = [], count = sparse ? 24 : 120;
    for (let i = 0; i < count; i++) {
      const u = .06 + .88 * cycle(i * .61803399), v = .15 + .78 * cycle(i * .41421356), at = p(u, v, 1.8);
      for (let j = 0; j < 3; j++) {
        // Folded, bent blades catch light as small paper solids. The tuft count
        // stays fixed; a readable silhouette replaces a field of thin triangles.
        const a = j / 3 * Math.PI + i * .13, w = .7 * s, h = (3.6 + i % 4) * s, dx = Math.cos(a), dz = Math.sin(a), k = vertices.length / 3;
        vertices.push(at[0]-dx*w,at[1],at[2]-dz*w,at[0]+dx*w,at[1],at[2]+dz*w,
          at[0]+dx*.35*s,at[1]+h*.6,at[2]+dz*.35*s+.24*s,
          at[0]+dx*1.25*s,at[1]+h,at[2]+dz*1.25*s);
        indices.push(k,k+1,k+2,k+1,k+3,k+2);
      }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals(); return b.mesh(g, sparse ? '#9eaa82' : '#96a47c', false, false);
  };
  const grass = grassPatch(false), sparseGrass = grassPatch(true);
  const understory = Array.from({ length: 9 }, (_, i) => {
    const m = b.mesh(naturalGeometry(buildFernSurface(i + 1)), '#94a67c', false);
    m.material = createSpecimenMaterial(b.pop, { color: '#82946a', role: 'plant' });
    m.position.set(...p(.09 + i * .1, .86 - (i % 3) * .16, 1.8)); m.scale.setScalar((8.0 + i % 3 * 1.2) * s); m.userData.vegetationPart = 'understory-fronds'; return m;
  });
  // A rooted woody climber follows the trunk in continuous three-dimensional
  // turns. Its few broad leaves make the form readable without another label.
  const vines = [0, 2, featuredTree].map(index => {
    const tree = trees[index], top = index === featuredTree ? 28 : 29 + index;
    const points = Array.from({ length: 45 }, (_, i): Vec3 => {
      const q = i / 44, angle = -.65 + q * Math.PI * 4.4, radius = (1.45 + .2 * Math.sin(q * Math.PI * 3)) * s;
      const at = p(tree.u, tree.v, 2.1 + q * top); return [at[0] + Math.cos(angle) * radius, at[1], at[2] + Math.sin(angle) * radius];
    });
    const mesh = b.tube(points, (index === featuredTree ? .43 : .32) * s, '#778563');
    const leaves = Array.from({ length: 6 }, (_, i) => {
      const at = points[6 + i * 6], leaf = b.mesh(naturalGeometry(buildLeafBladeSurface()), '#839773', false), sign = i % 2 ? 1 : -1;
      leaf.scale.set(2.25 * s, .8 * s, 2.1 * s); leaf.position.set(at[0] + sign * .55 * s, at[1] + .25 * s, at[2] + .55 * s); leaf.rotation.z = sign * .35; leaf.rotation.y = sign < 0 ? Math.PI : 0;
      return leaf;
    });
    [mesh, ...leaves].forEach(part => { part.userData.modelInput = { kind: 'inspect', target: 'vine', toggleTo: 'overview', label: '近看藤本攀附树干的结构' }; part.userData.vegetationPart = 'vine'; part.userData.vegetationTree = index; });
    return { index, mesh, leaves, points };
  });
  // Closed, curved fins spread from the same trunk into the soil. They have
  // visible thickness and a tapered ridge, rather than two flat triangles.
  const buttresses: { index: number; mesh: any }[] = [];
  for (const index of [0, 2, featuredTree]) for (let direction = 0; direction < (index === featuredTree ? 4 : 3); direction++) {
    const at = p(trees[index].u, trees[index].v, 1.8), featured = index === featuredTree, shape = new T.Shape();
    const reach = featured ? 8.8 : 5.7, h = featured ? 11.2 : 7.8;
    shape.moveTo(.35 * s, 0); shape.lineTo(.52 * s, h * s);
    shape.bezierCurveTo(1.3 * s, h * .70 * s, 2.5 * s, h * .32 * s, reach * .62 * s, 1.45 * s);
    shape.quadraticCurveTo(reach * .85 * s, .35 * s, reach * s, .1 * s); shape.lineTo(reach * s, 0); shape.closePath();
    const thickness = (featured ? 1.0 : .7) * s;
    const g = new T.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 12 });
    g.translate(0, 0, -thickness / 2); g.rotateY(.45 + direction / (featured ? 4 : 3) * Math.PI * 2); g.translate(...at);
    const mesh = b.mesh(g, '#9c967a', false); mesh.userData.vegetationPart = 'buttress'; mesh.userData.vegetationTree = index;
    mesh.userData.modelInput = { kind: 'inspect', target: 'buttress', toggleTo: 'overview', label: '近看板根从树干向地面展开' };
    buttresses.push({ index, mesh });
  }
  const litterShape = naturalGeometry(buildLeafBladeSurface());
  const fallen = Array.from({ length: 12 }, (_, i) => {
    const m = b.mesh(litterShape, i % 2 ? '#b48b57' : '#b7a471', false);
    m.scale.set(2.8 * s, 1.1 * s, 2.8 * s); m.userData.vegetationPart = 'retained-fallen-leaf';
    // Anchor the leaf to its own crown at release, instead of a fixed height.
    const source = trees[i % trees.length].crowns[2].mesh;
    const attribute = source.geometry.attributes.position;
    const vertex = 1 + (3 + i % 4) * 26 + (i * 7) % 26;
    m.userData.sourceTree = i % trees.length; m.userData.sourceCrownVertex = vertex;
    m.userData.sourceCrownPoint = [attribute.getX(vertex), attribute.getY(vertex), attribute.getZ(vertex)];
    return m;
  });
  const sets: LabelSpec[][] = [
    [['热带雨林', .5, 1.12, 3, 27], ['层次丰富', .2, .3, 44], ['藤本、板根', .77, .57, 35, 26]],
    [['常绿阔叶林', .5, 1.12, 3, 30], ['常绿', .19, .3, 35], ['革质叶片', .77, .57, 32]],
    [['落叶阔叶林', .5, 1.12, 3, 30], ['春夏发叶', .19, .3, 35], ['秋冬落叶', .77, .57, 32]],
    [['亚寒带针叶林', .5, 1.12, 3, 34], ['针状叶', .18, .3, 39], ['抗寒抗旱', .77, .57, 35]],
    [['热带草原', .5, 1.12, 3, 27], ['湿季葱绿', .18, .3, 19], ['干季枯黄', .77, .57, 19]],
    [['温带草原', .5, 1.12, 3, 27], ['夏绿冬枯', .18, .3, 12], ['草本较低', .77, .57, 12]],
    [['荒漠植被', .5, 1.12, 3, 27], ['旱生灌木', .18, .3, 12], ['稀疏、耐旱', .77, .57, 12, 27]],
  ];
  const labels = labelSets(b, f, sets);
  const tree = trees[featuredTree], patchShape = new T.Shape();
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * Math.PI * 2, r = 1 + .045 * Math.sin(a * 3) + .025 * Math.cos(a * 5);
    const x = Math.cos(a) * 12.4 * s * r, z = Math.sin(a) * 10.5 * s * r;
    i ? patchShape.lineTo(x, -z) : patchShape.moveTo(x, -z);
  }
  patchShape.closePath();
  const patchGeometry = new T.ExtrudeGeometry(patchShape, { depth: .9 * s, bevelEnabled: false });
  patchGeometry.rotateX(-Math.PI / 2); patchGeometry.translate(...p(tree.u, tree.v, .9));
  const localFloor = b.mesh(patchGeometry, '#c7c3ab', false);
  localFloor.material = createSpecimenMaterial(b.pop, { color: '#928466', role: 'land' });applyEarthScan(localFloor.material,'loam',7*s);
  const localParts=[localFloor],tagCenter=p(tree.u+.092,tree.v+.11,7.4);
  const tagAt=(dx:number,dy:number,dz:number):Vec3=>[tagCenter[0]+s*dx,tagCenter[1]+s*dy,tagCenter[2]+s*dz];
  const foot=p(tree.u,tree.v,0);
  const barrel=b.mesh(turnedShaftGeometry([foot[0],-.84*s,foot[2]],[foot[0],1.28*s,foot[2]],[[12.7*s,0],[12.93*s,.18],[12.79*s,.30],[12.66*s,.87],[12.72*s,1]]),'#976f46',false,true,'brass');
  barrel.geometry.scale(1,1,.85);barrel.geometry.translate(0,0,foot[2]*.15);localParts.push(barrel);
  localParts.push(b.mesh(turnedShaftGeometry(tagAt(0,-5.52,-.29),tagAt(0,-.13,-.29),[[.21*s,0],[.21*s,1]]),'#9e8c5e',false,true,'brass'));
  localParts.push(b.mesh(chamferedPlateGeometry(tagAt(-3.9,-1.85,-.34),tagAt(3.9,1.85,.0),.12*s),'#ac915e',false,true,'brass'));
  localParts.push(b.mesh(chamferedPlateGeometry(tagAt(-3.71,-1.65,.01),tagAt(3.71,1.65,.13),.09*s),'#e5dcc1',false,true,'ivory'));
  const vineTag=b.label('藤本',tagAt(0,0,.17),6.85*s,3.1*s,{appearance:'engraved'});
  const rootTag=b.label('板根',tagAt(0,0,.17),6.85*s,3.1*s,{appearance:'engraved'});
  for(const m of [vineTag,rootTag])m.userData.labelMount='surface';
  const rootBark=botanicalBark(b,.33*s,'#887655'),litRootBark=botanicalBark(b,.33*s,'#a08a62');
  const targets = [{ id: 'overview', label: '整体' }, { id: 'vine', label: '藤本' }, { id: 'buttress', label: '板根' }, { id: 'layers', label: '林内层次' }];
  labels[0][0].userData.modelInput = { kind: 'inspect', target: 'overview', label: '返回雨林整体' };
  labels[0][1].userData.modelInput = { kind: 'inspect', target: 'layers', toggleTo: 'overview', label: '看清林内高低层次' };
  labels[0][2].userData.modelInput = { kind: 'inspect', target: 'vine', toggleTo: 'buttress', label: '近看藤本与板根' };
  [vineTag, rootTag].forEach(tag => { tag.userData.modelInput = { kind: 'inspect', target: 'overview', label: '返回雨林整体' }; });
  trees.forEach(tree => { tree.trunk.userData.modelInput = { kind: 'inspect', target: 'layers', toggleTo: 'overview', label: '查看林内层次' }; });
  understory.forEach(mesh => { mesh.userData.modelInput = { kind: 'inspect', target: 'layers', toggleTo: 'overview', label: '查看乔木下的林内层次' }; });
  let selected = 0, previousType = 0, inspection = 'overview';
  return { update(t, n) {
    selected = stage(n, 6);
    specimenDial(t,selected);seasonDial(t,selected);
    for(const mesh of seasonParts)mesh.visible=[2,4,5].includes(selected);
    if (selected !== previousType) { inspection = 'overview'; previousType = selected; }
    showLabels(labels, selected); const partView = inspection === 'vine' || inspection === 'buttress';
    cabinet.update(selected,partView);selectorParts.forEach(m=>m.visible=!partView);
    for(const m of localParts)m.visible=partView;
    const foldingSupport=b.root.children.find((m:any)=>m.userData.instrumentAssembly);if(foldingSupport)foldingSupport.visible=!partView;
    forestFloor.visible=!partView; localFloor.visible=partView;soil.cut.visible=!partView;
    soil.litter.visible=!partView&&selected<4;forestFloor.material=selected===0?rainFloor:selected===6?arid:openGround;
    openGround.color.set(selected===3?'#8c8064':selected<4?'#968765':selected===4?'#ad9e68':'#9e9c71');
    if (partView) labels[selected].forEach(tag=>{tag.visible=false;});
    vineTag.visible = selected === 0 && inspection === 'vine'; rootTag.visible = selected === 0 && inspection === 'buttress';
    const forest = selected < 4, autumn = smooth(.28, .82, clamp(t));
    trees.forEach(tree => {
      const typeVisible = forest || selected === 4 && [0, 3, 6].includes(tree.index) || selected === 6 && [0, 6].includes(tree.index);
      // Inspection retains every tree. The focus moves to the actual opening
      // below the crowns instead of deleting foreground trees.
      const visible = typeVisible && (!partView || tree.index === featuredTree);
      const height = (selected === 0 ? [36, 28, 39, 25, 33, 20, 31, 23][tree.index]
        : [34, 25, 25, 30, 13, 0, 5.5][selected] + (forest ? tree.index % 3 * 2 : 0)) * s, at = p(tree.u, tree.v, 1.8);
      const spread = selected === 3 ? .56 : selected === 4 ? 1.4 : selected === 6 ? 1.2 : 1;
      tree.stems.forEach(({mesh}, habitIndex) => {
        const activeHabit = selected < 5 ? selected : selected === 6 ? 5 : -1;
        mesh.visible = visible && habitIndex === activeHabit; mesh.position.set(...at); mesh.scale.set(height * spread, height, height * spread);
      });
      tree.crowns.forEach(({ habit, mesh: m }, habitIndex) => {
        const activeHabit = selected < 5 ? selected : selected === 6 ? 5 : -1, leafiness = selected === 2 ? 1 - .95 * autumn : 1;
        const radius = height * (selected === 4 ? .42 : selected === 6 ? .4 : selected === 3 ? .22 : selected === 0 ? .33 : .3), cover = selected === 2 ? .48 + .52 * leafiness : 1;
        m.visible = visible && habitIndex === activeHabit && leafiness > .08 && inspection !== 'buttress';
        m.position.set(at[0], at[1] + height * (selected === 3 ? .61 : selected === 4 ? .80 : selected === 6 ? .56 : selected === 0 ? .79 : .70), at[2]);
        m.scale.set(radius * cover, height * (selected === 3 ? .52 : selected === 4 ? .28 : selected === 6 ? .42 : .31) * (selected === 2 ? .66 + .34 * leafiness : 1), radius * cover);
        const variation = tree.index % 3 * .018;
        m.material.color.set(selected === 3 ? '#526c58' : selected === 1 ? '#647a54' : selected === 0 ? '#70855b' : selected === 4 ? '#879563' : selected === 6 ? '#8d9873' : '#8c9b68');
        m.material.color.offsetHSL(variation, -.02, variation * .9);
        if (selected === 2) m.material.color.lerp(new T.Color('#b18b4f'),autumn);
        
      });
    });
    grass.visible = selected === 4 || selected === 5; sparseGrass.visible = selected === 6;
    grass.scale.y = selected === 5 ? .66 : 1;
    grass.position.y = selected === 5 ? .34 * 1.8 * s : 0;
    grass.material.color.set('#798c57').lerp(new T.Color(selected===5?'#c0ac79':'#c7a95e'),autumn);
    understory.forEach((m, i) => { m.visible = !partView && (selected === 0 || selected === 1 && i % 3 === 0);  });
    vines.forEach(v => {
      const visible = selected === 0 && inspection !== 'buttress' && (!partView || v.index === featuredTree); v.mesh.visible = visible;
      v.mesh.material = b.materialFor ? b.materialFor('plant',inspection === 'vine' ? '#9b8152' : '#627651') : b.material('#627651');
      v.leaves.forEach(leaf => { leaf.visible = visible;  });
      
    });
    buttresses.forEach(({ index, mesh }) => { mesh.visible = selected === 0 && (!partView || index === featuredTree); mesh.material=inspection==='buttress'?litRootBark:rootBark;  });
    fallen.forEach((m, i) => {
      const release = .29 + i / 12 * .37, q = smooth(release, Math.min(.97,release+.31),t);
      const sourceTree = trees[i % trees.length], at = p(sourceTree.u, sourceTree.v, 1.8);
      m.visible = selected === 2 && t >= release;
      const height = (25 + sourceTree.index % 3 * 2) * s;
      const leafinessAtRelease = 1 - .95 * smooth(.28, .82, release);
      const radius = height * .3 * (.48 + .52 * leafinessAtRelease);
      const anchor = m.userData.sourceCrownPoint as Vec3;
      const source: Vec3 = [at[0] + anchor[0] * radius,
        at[1] + height * .70 + anchor[1] * height * .31 * (.66 + .34 * leafinessAtRelease),
        at[2] + anchor[2] * radius];
      m.position.set(source[0] + Math.sin(q * 7 + i) * q * 3 * s,
        at[1] + .08 * s + (1 - q) * (source[1] - at[1] - .08 * s), source[2] + q * 4 * s);
      m.rotation.set((1-q)*.8, i*.71, (1-q)*q*3);
    });
  }, inspect(target) {
    if (target === 'overview' || target === 'layers' && selected < 4 || selected === 0 && ['vine', 'buttress'].includes(target)) inspection = target;
  }, focusBounds: () => inspection === 'buttress'
    ? { min: p(tree.u - .19, tree.v - .26, 0), max: p(tree.u + .29, tree.v + .26, 25) }
    : inspection === 'vine' ? { min: p(tree.u - .17, tree.v - .25, 0), max: p(tree.u + .29, tree.v + .25, 39) }
      : inspection === 'layers' && selected === 0 ? { min: p(.12, .26, 0), max: p(.86, 1.01, 35) }
        : {min:p(-.025,.03,-6),max:p(1.26,1.34,[50,42,42,45,35,35,35][selected])}, describe: () => ({ kind: 'vegetation-types', inspection, inspectTargets: selected === 0 ? targets : selected < 4 ? targets.filter(target => ['overview', 'layers'].includes(target.id)) : targets.slice(0, 1), type: ['rainforest', 'evergreen-broadleaf', 'deciduous-broadleaf', 'boreal-conifer', 'tropical-grassland', 'temperate-grassland', 'desert'][selected], featuredTree, closedButtressGeometry: true, allTreesRetainedDuringLayerInspection: true, habitSpecificBranchSkeletons: true, fallenLeavesRetainedAtSeasonEnd: true, continuousRootedVines: true, climateQuantitiesAreMeasured: false, speciesAreStructuralRepresentations: true, phaseMeaning: selected === 2 ? 'leaf-season' : selected === 4 ? 'wet-to-dry-season' : selected === 5 ? 'summer-to-winter' : 'static-traits', buffersStable: true }) };
}


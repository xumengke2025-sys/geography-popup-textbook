import { createSpecimenMaterial } from './textbook-solid-materials';
import { applyEarthScan, type EarthScan } from './textbook-earth-scan';
import { fossilBed, impression } from './textbook-strata-specimens';
import { chamferedPlateGeometry, createInstrumentParts, mergeInstrumentGeometry, turnedShaftGeometry } from './textbook-instrument-parts';
import { THREE as T } from './reference/engine.js';
import type { ModelMotion, TextbookGeometry, Vec3 } from './textbook-geometry';
import { phaseTrackPoint } from './textbook-model-input';
import { evaluateStrata, STRATA_FOSSIL_INK, STRATA_FOSSIL_NAMES, STRATA_LAYERS,
  STRATA_REFERENCE, strataInputLabel } from './textbook-strata-model';

/** Original figure 1.23, reconstructed as six closed stone prisms. Every
 * fossil body, its relief grooves and the specimen outline share one owner
 * transform; no printed fossil is left behind when a layer is pulled apart. */
export function buildStrataWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, frontZ = b.p(0, .94)[2];
  const point = ([x, y]: readonly number[], z = 0): Vec3 => [x * s, y * s, frontZ + z * s];
  const finish = (key: string, color: string, scan: EarthScan, span: number) => {
    if (!b.materials.has(key)) {
      const material = applyEarthScan(createSpecimenMaterial(b.pop, { role: 'rock', color }), scan, span*s);
      material.vertexColors = true;
      b.materials.set(key, material);
    }
    return b.materials.get(key);
  };
  const hardware = (geometry: any, role: 'brass'|'steel'|'enamel'|'ivory'|'wood', color: string, name: string) => {
    const mesh=b.mesh(geometry,color,false); const key=`strata-hardware-${role}-${color}`;
    if(!b.materials.has(key)) b.materials.set(key,createSpecimenMaterial(b.pop,{role,color}));
    mesh.material=b.materials.get(key);mesh.userData.strataRole=name;return mesh;
  };
  const plate = (a: number[],c: number[],role:'brass'|'steel'|'enamel',color:string,name:string) =>
    hardware(chamferedPlateGeometry(point(a,a[2]),point(c,c[2]),.10*s),role,color,name);
  const rod = (a: number[],c: number[],r:number,role:'brass'|'steel'|'enamel',color:string,name:string) => {
    const from=new T.Vector3(...point(a,a[2])),to=new T.Vector3(...point(c,c[2])),d=to.clone().sub(from);
    const geometry=new T.CylinderGeometry(r*s,r*s,d.length(),16);
    geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));
    geometry.translate(...from.add(to).multiplyScalar(.5).toArray());return hardware(geometry,role,color,name);
  };
  const parts = createInstrumentParts(b);
  const world = (x: number, y: number, z: number) => point([x,y],z);
  parts.plate(world(1,-5.3,-22),world(102.5,-1.5,6.5),'wood',.46*s);
  parts.plate(world(1.7,-1.65,-21.3),world(101.8,-1.22,5.8),'brass',.13*s);
  parts.plate(world(2.2,-1.22,-20.8),world(101.3,-.68,5.3),'wood',.2*s);
  for (const x of [5,98.5]) for (const z of [-17.8,2.8])
    parts.column(world(x,-8.2,z), world(x,-5.25,z),2.05*s,'brass');
  parts.fasteners([world(4,-.62,-18.5),world(99,-.62,-18.5),world(4,-.62,3.1),world(99,-.62,3.1)],[0,1,0],.52*s);
  const columnRails = [[4],[98]];
  const railDepth=-4, sliders: {index:number;members:any[]}[]=[];
  const verticalGuides:any[]=[], guideHeads:any[]=[];
  for (const [column,xs] of columnRails.entries()) {
    // Only a low cross-foot; the stone never sits on a stack of pedestals.
    plate([column?90:2,-1.25,-13],[column?100:12,-.25,-1],'enamel','#304434','column-foot');
    for(const x of xs) {
      verticalGuides.push(rod([x,-.25,railDepth],[x,56.2,railDepth],.34,'steel','#9c9d96','vertical-guide'));
      rod([x,-.25,railDepth],[x,.5,railDepth],.8,'brass','#a88b50','guide-foot-bearing');
      guideHeads.push(rod([x,55.7,railDepth],[x,56.3,railDepth],.58,'brass','#a88b50','guide-end-stop'));
    }
  }
  const groups = STRATA_LAYERS.map((d, index) => {
    const members: any[] = [];
    const input = { kind: 'select', selection: index + 2, toggleTo: 1, label: strataInputLabel(index) };
    const own = (mesh: any, role: string) => {
      mesh.userData.strataRole = role; mesh.userData.strataLayer = index; mesh.userData.strataLayerId = d.id;
      mesh.userData.modelInput = input; members.push(mesh); return mesh;
    };
    const body = own(b.mesh(fossilBed(d, point), d.color, false), 'layer');
    const sandstone = d.correlation === 'paired-shells';
    body.material = finish('strata-rock-'+d.id, d.color, sandstone ? 'alluvium' : 'outcrop', sandstone ? 10 : 13);
    body.userData.column = d.column; body.userData.level = d.level;
    const fossils = d.fossils.map(f => {
      const shell = impression(f, point);
      const color = d.correlation === 'cone' ? '#8c755a' : '#aa8561';
      const mesh = own(b.mesh(shell.geometry, color, false), 'fossil');
      mesh.material = finish('strata-shell-'+color,color,'outcrop',6.8);
      mesh.userData.strataFossilId = f.id; mesh.userData.fossilKind = f.kind;
      mesh.userData.fossilName = STRATA_FOSSIL_NAMES[f.kind];
      mesh.userData.baseCenter = shell.veinPoint([0,0]);
      const ridges=STRATA_FOSSIL_INK[f.kind].ribs.map(rib=>{
        const path:any[]=[];
        for(let i=1;i<rib.length;i++){
          const a=rib[i-1],e=rib[i],samples=Math.max(1,Math.ceil(Math.hypot(e[0]-a[0],e[1]-a[1])*12));
          for(let j=0;j<samples;j++){
            const t=j/samples,pt=shell.veinPoint([a[0]+(e[0]-a[0])*t,a[1]+(e[1]-a[1])*t]);
            path.push(new T.Vector3(...pt));
          }
        }
        path.push(new T.Vector3(...shell.veinPoint(rib[rib.length-1])));
        return new T.TubeGeometry(new T.CatmullRomCurve3(path),Math.min(64,path.length),.105*s,6,false);
      });
      const ribbing=own(hardware(mergeInstrumentGeometry(ridges),'ivory','#c7ae87','calcite-ribs'),'calcite-ribs');
      ribbing.userData.fossilKind=f.kind;
      return mesh;
    });
    const fixed: any[]=[];
    for(const x of columnRails[d.column==='A'?0:1]) {
      const y=d.level*12;
      fixed.push(rod([x,y+.35,railDepth],[x,y+2.1,railDepth],.69,'brass','#a88b50','layer-slide-bearing'));
      // The complete load path is on the visible outer edge: rail, brass
      // sleeve, short arm, depth slide, and two narrow forks under the stone.
      // The centre gap stays free for the two scientific correlation lines.
      const isA=d.column==='A',edge=isA?8:94,gripX=isA?7:95;
      fixed.push(rod([x,y+.85,railDepth],[gripX,y+.85,railDepth],.32,'steel','#9c9d96','lateral-clamp-arm'));
      fixed.push(rod([gripX,y+.85,-4.6],[gripX,y+.85,.3],.23,'steel','#9c9d96','pullout-guide'));
      own(rod([gripX,y+.85,-4.35],[gripX,y+.85,-2.75],.46,'brass','#a88b50','specimen-slide-sleeve'),'specimen-slide-sleeve');
      own(rod([gripX,y+.85,-3.3],[edge,y+.85,-3.3],.34,'steel','#9c9d96','specimen-side-arm'),'specimen-side-arm');
      const outside=isA?edge-.55:edge-.1,inside=isA?edge+.1:edge+.55;
      own(plate([outside,y-.38,-11.1],[inside,y+.95,-2.8],'enamel','#304434','specimen-side-jaw'),'specimen-side-jaw');
      for(const z of [-10.8,-3.6]) own(plate([isA?edge-.55:edge-3.5,y-.38,z],
        [isA?edge+3.5:edge+.55,y-.04,z+.65],'steel','#9c9d96','specimen-lower-fork'),'specimen-lower-fork');
    }
    sliders.push({index,members:fixed});
    return { index, body, fossils, members };
  });
  const labels = (['A', 'B'] as const).map((column,i) => {
    const x=i?83:18,owner=groups[i?5:2];
    const stem=rod([x,35.7,-2.7],[x,41,-2.7],.17,'brass','#a88b50','locality-label-stem');
    for(const mesh of [stem]) {mesh.userData.strataLayer=owner.index;mesh.userData.strataLayerId=STRATA_LAYERS[owner.index].id;owner.members.push(mesh);}
    const label = b.label(column, point([column === 'A' ? 18 : 83, 41]), 6.5 * s, 6.2 * s);
    label.userData.strataRole = 'column-label'; label.userData.column = column; return label;
  });
  const track = { start: point([100, 6], 5.5), end: point([100, 54], 5.5) };
  const rail = rod([100,-.4,5.2],[100,54.8,5.2],.23,'steel','#9c9d96','phase-rail');
  const railMounts=[plate([90,-1.25,-19],[101.8,-.5,6.3],'enamel','#304434','phase-rail-foot'),
    rod([100,-.5,5.2],[100,1,5.2],.7,'brass','#a88b50','phase-rail-bearing'),
    rod([100,54.2,5.2],[100,54.9,5.2],.48,'brass','#a88b50','phase-rail-end-stop')];
  const tab = hardware(turnedShaftGeometry([0,0,0],[0,0,3.2*s],
    [[1.66*s,0],[1.72*s,.08],[1.2*s,.2],[1.02*s,.62],[1.72*s,.8],[1.78*s,.91],[1.45*s,1]]),'brass','#ae8543','phase-handle');
  tab.userData.strataHandle = true;
  tab.userData.smallPointTarget = true;
  tab.userData.modelInput = { kind: 'phase-track', track, engage:{from:0,to:1}, label: '上下拖动铜钮，调节两组标本的层间距' };
  rail.userData.modelInput = tab.userData.modelInput;
  const knobCap = hardware(turnedShaftGeometry([0,0,2.94*s],[0,0,3.56*s],
    [[1.35*s,0],[1.46*s,.35],[1.38*s,.7],[1.17*s,1]]),'wood','#654231','phase-grip-end');
  knobCap.userData.modelInput=tab.userData.modelInput;
  for(const mesh of railMounts) mesh.userData.modelInput={kind:'select',selection:1,toggleTo:0,keepPhase:true,label:'拨动轨座，切换分层与叠合'};
  for(const label of labels) label.userData.modelInput={kind:'select',selection:0,keepPhase:true,label:'按下采样地标牌，合起地层'};
  let state = evaluateStrata(0);
  const links=state.connections.map(()=>hardware(new T.CylinderGeometry(.11*s,.11*s,1,12),'brass','#b69b67','correlation-wire'));
  const localUp=new T.Vector3(0,1,0);
  return {
    update(phase, selection) {
      state = evaluateStrata(phase, selection);
      for(const guide of verticalGuides) guide.scale.y=(38.45+2*state.gap)/56.45;
      for(const head of guideHeads) head.position.y=(2*state.gap-18)*s;
      for(const slider of sliders) for(const mesh of slider.members) mesh.position.y=state.layers[slider.index].offsetY*s;
      for (const group of groups) {
        const layer = state.layers[group.index];
        for (const mesh of group.members) {
          mesh.position.set(0, layer.offsetY * s, layer.offsetZ * s);
          mesh.userData.highlighted = layer.highlighted;
        }
        group.body.material.emissive.setHex(layer.highlighted ? 0x332210 : 0x000000);
      }
      state.connections.forEach((connection,i)=>{
        const wire=links[i];
        wire.visible=connection.visible;
        if(!wire.visible)return;
        const a=new T.Vector3(...point(connection.from,connection.from[2]+.65));
        const e=new T.Vector3(...point(connection.to,connection.to[2]+.65));
        const delta=e.clone().sub(a);
        wire.position.copy(a).addScaledVector(delta,.5);
        wire.scale.set(connection.highlighted?1.45:.78,delta.length(),connection.highlighted?1.45:.78);
        wire.quaternion.setFromUnitVectors(localUp,delta.normalize());
      });
      labels.forEach((label, i) => {const layer=state.layers[i?5:2];label.position.set(...point([i?83:18,41+layer.offsetY],layer.offsetZ));});
      tab.position.set(...phaseTrackPoint(state.phase, track));
      knobCap.position.copy(tab.position);
    },
    // Frame the whole separation, not its current pose: a moving camera would
    // shift the pull tab's screen-to-track mapping during the same grab.
    // Rocks span y=0..54; labels reach 59 plus their 4.5-unit half-diagonal.
    // The tab ends at x=102 and its forward ink is at z=6, ahead of the focus.
    focusBounds: () => ({ min: point([1, -8.2], -22), max: point([102.5, 64], 9.2) }),
    describe: () => ({ kind: 'strata', mechanism: 'fossil-correlation', reference: STRATA_REFERENCE, columns: 2, layersPerColumn: 3,
      phase: state.phase, selection: state.selection, separated: state.separated, gap: state.gap, focused: state.focused,
      match: state.match, timeIsEquallySpaced: false, missingMatchMeansMissingAge: false,
      selectionOrder: STRATA_LAYERS.map(l => l.id), correlations: state.connections,
      layerGroups: groups.map(g => ({ index: g.index, id: STRATA_LAYERS[g.index].id, members: g.members.length,
        fossils: g.fossils.map(f => ({ id: f.userData.strataFossilId, kind: f.userData.fossilKind })),
        offsetY: state.layers[g.index].offsetY, offsetZ: state.layers[g.index].offsetZ,
        highlighted: state.layers[g.index].highlighted })), phaseTrack: track }),
  };
}

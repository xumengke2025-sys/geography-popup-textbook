import { createSpecimenMaterial } from './textbook-solid-materials';
import { chamferedPlateGeometry } from './textbook-instrument-parts';
import { THREE as T } from './reference/engine.js';
import type { ModelMotion, TextbookGeometry, Vec3 } from './textbook-geometry';
import { phaseTrackPoint } from './textbook-model-input';
import { evaluateStrata, STRATA_FOSSIL_INK, STRATA_FOSSIL_NAMES, STRATA_LAYERS,
  STRATA_REFERENCE, strataInputLabel, type StrataPoint } from './textbook-strata-model';

/** Original figure 1.23, reconstructed as six closed stone prisms. Every
 * fossil body, its relief grooves and the specimen outline share one owner
 * transform; no printed fossil is left behind when a layer is pulled apart. */
export function buildStrataWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, frontZ = b.p(0, .94)[2];
  const point = ([x, y]: readonly number[], z = 0): Vec3 => [x * s, y * s, frontZ + z * s];
  const shapeFrom = (points: readonly StrataPoint[]) => {
    const shape = new T.Shape();
    points.forEach(([x, y], i) => i ? shape.lineTo(x * s, y * s) : shape.moveTo(x * s, y * s));
    shape.closePath(); return shape;
  };
  const quietPaper = (key: string, color: string, hatch = .12) => {
    const cacheKey = `strata-${key}`;
    let material = b.materials.get(cacheKey);
    if (!material) {
      material = createSpecimenMaterial(b.pop, { color, role: 'rock' });
      // Sedimentary grain is attached to the specimen, not a screen overlay.
      // Broad mottling and fine unaligned grains preserve the fossil silhouette.
      const compile = material.onBeforeCompile;
      material.onBeforeCompile = (shader: any) => {
        compile?.(shader);
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vStrataStone;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStrataStone = position;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
          varying vec3 vStrataStone;
          float strataHash(vec3 p) { return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
          float strataNoise(vec3 p) {
            vec3 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
            return mix(mix(mix(strataHash(i),strataHash(i+vec3(1,0,0)),f.x),
              mix(strataHash(i+vec3(0,1,0)),strataHash(i+vec3(1,1,0)),f.x),f.y),
              mix(mix(strataHash(i+vec3(0,0,1)),strataHash(i+vec3(1,0,1)),f.x),
              mix(strataHash(i+vec3(0,1,1)),strataHash(i+vec3(1,1,1)),f.x),f.y),f.z);
          }`)
          .replace('#include <color_fragment>', `#include <color_fragment>
            vec3 specimenP = vStrataStone / ${s.toFixed(6)};
            float stoneCloud = strataNoise(specimenP * vec3(.30,.46,.34));
            float stoneGrain = strataNoise(specimenP * 2.5);
            float grainFilter = 1.0-smoothstep(.6,2.5,length(fwidth(specimenP*2.5)));
            diffuseColor.rgb *= .87 + .21*stoneCloud + ${hatch < .1 ? '.025' : '.16'}*(stoneGrain-.5)*grainFilter;
          `);
      };
      material.customProgramCacheKey = () => `strata-grain-v1:${s}:${hatch < .1}`;
      material.side = T.DoubleSide; b.materials.set(cacheKey, material);
    }
    return material;
  };
  // The six scientific profiles are unchanged. The interior cut face has a
  // restrained physical relief, while each shared boundary remains exact.
  const stoneGeometry = (profile: readonly StrataPoint[], seed: number) => {
    const vertices: number[] = [], nx = 24, ny = 12;
    const tri = (a: Vec3, c: Vec3, d: Vec3) => vertices.push(...a, ...c, ...d);
    const v = (i: number, j: number, back = false): Vec3 => {
      const u = i / nx, t = j / ny;
      const left = profile[0][0] + (profile[3][0] - profile[0][0]) * t;
      const right = profile[1][0] + (profile[2][0] - profile[1][0]) * t;
      const x = left + (right - left) * u, y = profile[0][1] + 12 * t;
      const edge = Math.sin(Math.PI*u) * Math.sin(Math.PI*t);
      const relief = edge * (.055*Math.sin(x*1.21+y*.83+seed) + .035*Math.sin(x*3.3-y*1.9+seed));
      return point([x,y], back ? -16 : relief);
    };
    for (let j=0;j<ny;j++) for(let i=0;i<nx;i++) {
      tri(v(i,j),v(i+1,j),v(i+1,j+1)); tri(v(i,j),v(i+1,j+1),v(i,j+1));
      tri(v(i,j,true),v(i+1,j+1,true),v(i+1,j,true)); tri(v(i,j,true),v(i,j+1,true),v(i+1,j+1,true));
    }
    const edge = (a: Vec3,c: Vec3,d: Vec3,e: Vec3) => {tri(a,c,d);tri(a,d,e);};
    for(let i=0;i<nx;i++) {edge(v(i,0),v(i,0,true),v(i+1,0,true),v(i+1,0));edge(v(i,ny),v(i+1,ny),v(i+1,ny,true),v(i,ny,true));}
    for(let j=0;j<ny;j++) {edge(v(0,j),v(0,j+1),v(0,j+1,true),v(0,j,true));edge(v(nx,j),v(nx,j,true),v(nx,j+1,true),v(nx,j+1));}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();return geometry;
  };
  const hardware = (geometry: any, role: 'brass'|'steel'|'enamel'|'ivory', color: string, name: string) => {
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
    const members: any[] = [], contours: { points: Vec3[]; width: number; fossil: boolean }[] = [];
    const input = { kind: 'select', selection: index + 2, toggleTo: 1, label: strataInputLabel(index) };
    const own = (mesh: any, role: string) => {
      mesh.userData.strataRole = role; mesh.userData.strataLayer = index; mesh.userData.strataLayerId = d.id;
      mesh.userData.modelInput = input; members.push(mesh); return mesh;
    };
    const geometry = stoneGeometry(d.profile,index*1.7);
    const body = own(b.mesh(geometry, d.color, false), 'layer');
    body.material = quietPaper(d.id, d.color);
    body.userData.column = d.column; body.userData.level = d.level;
    const front = d.profile.map(p => point(p, .025)), back = d.profile.map(p => point(p, -16));
    contours.push({ points: [...front, front[0]], width: .48, fossil: false });
    // A visible top and outer side make the exhibit a stone volume, rather
    // than a stack of flat cutouts. Internal back seams remain quiet.
    contours.push({ points: [front[2], back[2], back[3], front[3]], width: .32, fossil: false });
    const outer = d.column === 'A' ? 0 : 1;
    const outerTop = outer === 0 ? 3 : 2;
    contours.push({ points: [front[outer], back[outer], back[outerTop], front[outerTop]], width: .30, fossil: false });
    const fossils = d.fossils.map(f => {
      const ink = STRATA_FOSSIL_INK[f.kind];
      const xy = ([x, y]: StrataPoint): StrataPoint => [f.x + x * f.width / 2, f.y + y * f.height / 2];
      const surface = new T.ExtrudeGeometry(shapeFrom(ink.outline.map(xy)), { depth: .27 * s,
        bevelEnabled: true, bevelSize: .045 * s, bevelThickness: .045 * s, bevelSegments: 1, curveSegments: 1 });
      // The bulk of a fossil is inside the cut rock. Only its weathered ridge
      // reaches the section surface; it is not a separate mounted medallion.
      surface.translate(0, 0, frontZ - .23 * s);
      const mesh = own(b.mesh(surface, '#9f795b', false), 'fossil');
      mesh.material = quietPaper('fossil', '#9f795b', .055);
      mesh.userData.strataFossilId = f.id; mesh.userData.fossilKind = f.kind;
      mesh.userData.fossilName = STRATA_FOSSIL_NAMES[f.kind];
      mesh.userData.baseCenter = point([f.x, f.y], .32);
      const path = (points: readonly StrataPoint[]) => points.map(p => point(xy(p), .105));
      contours.push({ points: [...path(ink.outline), path(ink.outline)[0]], width: .34, fossil: true });
      for (const rib of ink.ribs) contours.push({ points: path(rib), width: .22, fossil: true });
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
    return { index, body, fossils, members, contours };
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
  const tabShape = new T.Shape(); tabShape.moveTo(-2.0 * s, -2.6 * s); tabShape.lineTo(2 * s, -2.6 * s);
  tabShape.lineTo(2 * s, 2.6 * s); tabShape.lineTo(-2 * s, 2.6 * s); tabShape.closePath();
  const tabGeometry = new T.ExtrudeGeometry(tabShape, { depth: .45 * s, bevelEnabled: true, bevelSize:.13*s,bevelThickness:.13*s,bevelSegments:2 });
  const tab = hardware(tabGeometry,'enamel','#304434','phase-handle');
  tab.userData.strataRole = 'phase-handle'; tab.userData.strataHandle = true;
  tab.userData.modelInput = { kind: 'phase-track', track, label: '上下拖动纸签，调节地层间距；间距不表示地质年代' };
  const tabArrows=[-1,1].map(sign=>{
    const shape=new T.Shape();[[-.85,.4],[0,1.3],[.85,.4],[.65,.18],[0,.86],[-.65,.18]].forEach(([x,y],i)=>
      i?shape.lineTo(x*s,y*sign*s):shape.moveTo(x*s,y*sign*s));shape.closePath();
    const geometry=new T.ExtrudeGeometry(shape,{depth:.09*s,bevelEnabled:false});geometry.translate(0,0,.56*s);
    const arrow=hardware(geometry,'ivory','#f4f0e5','phase-handle-arrow');arrow.userData.modelInput=tab.userData.modelInput;return arrow;
  });
  let state = evaluateStrata(0);
  const moveContour = (points: Vec3[], y: number, z: number) => points.map(([x, yy, zz]): Vec3 => [x, yy + y * s, zz + z * s]);
  const dashConnection = (a: Vec3, c: Vec3, width: number) => {
    const delta = c.map((n, i) => n - a[i]), length = Math.hypot(...delta), count = Math.max(3, Math.ceil(length / (2.8 * s)));
    for (let i = 0; i < count; i++) {
      const start = i / count, end = Math.min(1, (i + .57) / count);
      b.contour([a.map((n, j) => n + delta[j] * start) as Vec3, a.map((n, j) => n + delta[j] * end) as Vec3], width);
    }
  };
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
        const hovered = group.members.some(mesh => mesh.userData.modelHovered === true);
        for (const c of group.contours) b.contour(moveContour(c.points, layer.offsetY, layer.offsetZ),
          c.width + (layer.highlighted ? (c.fossil ? .12 : .34) : 0) + (hovered && !c.fossil ? .10 : 0));
      }
      for (const c of state.connections.filter(c => c.visible))
        dashConnection(point(c.from, c.from[2] + .9), point(c.to, c.to[2] + .9), c.highlighted ? .67 : .34);
      labels.forEach((label, i) => {const layer=state.layers[i?5:2];label.position.set(...point([i?83:18,41+layer.offsetY],layer.offsetZ));});
      rail.visible = tab.visible = state.separated;
      tabArrows.forEach(mesh=>mesh.visible=state.separated);
      railMounts.forEach(mesh=>mesh.visible=state.separated);
      if (state.separated) {
        tab.position.set(...phaseTrackPoint(state.phase, track));
        tabArrows.forEach(mesh=>mesh.position.copy(tab.position));
        b.contour([[-2, -2.6], [2, -2.6], [2, 2.6], [-2, 2.6], [-2, -2.6]].map(([x, y]): Vec3 =>
          [tab.position.x + x * s, tab.position.y + y * s, tab.position.z + .48 * s]), .38);
      }
    },
    // Frame the whole separation, not its current pose: a moving camera would
    // shift the pull tab's screen-to-track mapping during the same grab.
    // Rocks span y=0..54; labels reach 59 plus their 4.5-unit half-diagonal.
    // The tab ends at x=102 and its forward ink is at z=6, ahead of the focus.
    focusBounds: () => ({ min: point([2, -1.25], -20), max: point([102.2, 64], 6.3) }),
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

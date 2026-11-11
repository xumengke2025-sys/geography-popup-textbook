import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint, type PhaseTrack } from './textbook-model-input';
import { airArrowMeshData, type AirArrow } from './textbook-air-process-model';
import { createInstrumentParts } from './textbook-instrument-parts';
import type { SolidMaterialRole } from './textbook-solid-materials';
import { ATMOSPHERE_BOUNDS, ATMOSPHERE_LAYERS, ATMOSPHERE_PROFILE, ATMOSPHERE_REFERENCE,
  ATMOSPHERE_STOPS, ATMOSPHERE_TRACK, atmosphereDiagnostics, atmosphereHeight, evaluateAtmosphere,
  type AtmospherePoint } from './textbook-atmosphere-model';

/** A height comparator with a real sliding carriage. The open observation
 * window and bent temperature track retain the textbook's qualitative state;
 * the mechanism positions the observer, it does not cause atmospheric layers. */
export function buildAtmosphereWorld(b: TextbookGeometry): ModelMotion {
  const scale = b.width / 100, back = -LIFT_MARGIN - 64 * scale;
  const p = (x: number, y: number, z: number): Vec3 => [x * scale, y * scale, back + z * scale];
  const point = (at: AtmospherePoint): Vec3 => p(...at);
  const parts = createInstrumentParts(b);
  const brightSteel=(object:any)=>{object.material=b.materialFor('steel','#9c9d96');return object};
  const role = (mesh: any, name: string, layer?: number) => {
    mesh.userData.atmosphereRole = name;
    if (layer !== undefined) mesh.userData.atmosphereLayer = ATMOSPHERE_LAYERS[layer].id;
    return mesh;
  };
  const select = (mesh: any, selection: number) => {
    mesh.userData.modelInput = { kind: 'select', selection, label: `观察${ATMOSPHERE_STOPS[selection].label}高度` };
    return mesh;
  };
  const mesh = (geometry: any, color: string, name: string, layer?: number, material?:SolidMaterialRole) =>
    role(b.mesh(geometry, color, false, true, material), name, layer);
  const box = (a: AtmospherePoint, c: AtmospherePoint, color: string, name: string, layer?: number, material?:SolidMaterialRole) => {
    const lo=point(a),hi=point(c),geometry=new T.BoxGeometry(hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2]);
    geometry.translate((lo[0]+hi[0])/2,(lo[1]+hi[1])/2,(lo[2]+hi[2])/2);return mesh(geometry,color,name,layer,material);
  };
  const shape = (positions: readonly number[], indices: readonly number[], color: string, name: string, layer?: number) => {
    const vertices: number[] = [];
    for (let i = 0; i < positions.length; i += 3) vertices.push(...p(positions[i], positions[i + 1], positions[i + 2]));
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    g.setIndex([...indices]); g.computeVertexNormals(); return mesh(g, color, name, layer);
  };
  const tag = (text: string, at: AtmospherePoint, width: number, height: number, name: string, selection?: number) => {
    const label = role(b.label(text, point(at), width * scale, height * scale, {appearance:'engraved'}), name, selection);
    label.userData.labelMount='surface';
    return selection === undefined ? label : select(label, selection);
  };
  const finish = (object:any, material:SolidMaterialRole, color:string) => {
    object.material=b.materialFor(material,color);object.userData.materialRole=material;return object;
  };
  // A single open comparator, not independent stands beneath a diagram.
  // Timber plinth, inset painted bed and turned feet share one assembly datum.
  for (const x of [13,99]) for (const z of [24,47]) {
    parts.shaft(p(x,.1,z),p(x,1.5,z),1.45*scale,'brass');
  }
  role(parts.casting(p(6,1.3,19),p(107,2.9,53),'wood',.5*scale),'instrument-plinth');
  parts.plate(p(6.5,2.9,19.5),p(106.5,3.2,52.5),'brass');
  finish(role(parts.casting(p(7.5,3.2,20.5),p(105.5,4.7,51.5),'steel',.4*scale),'instrument-bed'),'enamel','#263e36');
  parts.fasteners([p(9.5,4.75,23),p(9.5,4.75,49),p(103.5,4.75,23),p(103.5,4.75,49)],[0,1,0],.38*scale);

  // The right column carries the layer tablets and the upper curve anchor.
  // Both columns meet the crown; no structural member floats in the window.
  role(parts.column(p(78,4.7,49),p(78,94,49),1.65*scale),'comparator-column');
  parts.plate(p(74,4.7,45),p(82,5.4,52),'brass');
  const crownShape=new T.Shape();
  crownShape.moveTo(10,92);crownShape.lineTo(10,95);
  crownShape.quadraticCurveTo(10,98,15,98);crownShape.lineTo(75,98);
  crownShape.quadraticCurveTo(81,98,81,95);crownShape.lineTo(81,92);
  crownShape.lineTo(76,92);crownShape.quadraticCurveTo(75,94.2,72,94.2);
  crownShape.lineTo(19,94.2);crownShape.quadraticCurveTo(16,94.2,15,92);crownShape.closePath();
  const crownGeometry=new T.ExtrudeGeometry(crownShape,{depth:2.8,bevelEnabled:true,bevelSize:.24,bevelThickness:.24,bevelSegments:2,curveSegments:8});
  crownGeometry.scale(scale,scale,scale);crownGeometry.translate(0,0,back+47.6*scale);
  role(b.mesh(crownGeometry,'#b18b48',false,true,'brass'),'comparator-crown');

  /** Four vertices around every rectangular ribbon cross-section, with both
   * end caps. These are solid paper strips, never camera-facing line images. */
  const ribbon = (path: readonly AtmospherePoint[], width: number, depth: number, color: string, name: string, layer?: number) => {
    const positions: number[] = [], indices: number[] = [];
    path.forEach(([x, y, z], i) => {
      const a = path[Math.max(0, i - 1)], c = path[Math.min(path.length - 1, i + 1)];
      const dx = c[0] - a[0], dy = c[1] - a[1], d = Math.hypot(dx, dy) || 1;
      const nx = -dy / d * width / 2, ny = dx / d * width / 2;
      positions.push(x + nx, y + ny, z + depth / 2, x - nx, y - ny, z + depth / 2,
        x - nx, y - ny, z - depth / 2, x + nx, y + ny, z - depth / 2);
      if (i < path.length - 1) for (let side = 0; side < 4; side++) {
        const a = i * 4 + side, c = i * 4 + (side + 1) % 4;
        indices.push(a, c, c + 4, a, c + 4, a + 4);
      }
    });
    const last = (path.length - 1) * 4;
    indices.push(0, 2, 1, 0, 3, 2, last, last + 1, last + 2, last, last + 2, last + 3);
    return shape(positions, indices, color, name, layer);
  };

  // Three enamel specimen blades locate the bands. They occupy only the
  // left comparison bay; the temperature curve remains in actual open air.
  // These are positional keys, never sealed boxes filled with atmosphere.
  const layers = ATMOSPHERE_LAYERS.map((layer, index) => {
    const low = atmosphereHeight(layer.bottom), high = atmosphereHeight(layer.top);
    const sheet = select(box([19, low, 26], [39, high, 26.45], layer.color, 'layer-sheet', index, 'air'), index);
    sheet.userData.normalizedBounds = [layer.bottom, layer.top];
    return { sheet, low, high, selected: new T.Color(layer.color), quiet: new T.Color(layer.color).lerp(new T.Color('#dadfd6'), .22) };
  });
  const folds = [0, .24, .56, 1].map((height, index) => {
    const y = atmosphereHeight(height);
    return role(parts.plate(p(18.4,y-.17,25.8),p(39.5,y+.17,27.1),'brass'),`band-datum-${index}`);
  });
  const edge = role(brightSteel(parts.shaft(p(18.2,8,25.5),p(18.2,93,25.5),.42*scale,'steel')),'section-spine');
  const ground = select(box([19, 4.8, 24], [74, 8, 42], '#a79a7b', 'ground-volume',undefined,'rock'), 0);
  // Narrow retaining lips leave the ground's actual cut face visible.
  parts.plate(p(18.5,4.7,23.4),p(74.5,5.2,24.3),'brass');
  parts.plate(p(18.5,4.7,41.7),p(74.5,5.2,42.6),'brass');
  parts.plate(p(8,4.7,44.5),p(17.5,5.4,52),'brass');
  const groundPath = [[19,8],[24,12],[29,8.7],[33,10.4],[39,8.1],[45,9],[52,8.3],[59,8.7],[67,8.2],[74,8]];
  const terrainVertices: number[] = [], terrainIndices: number[] = [];
  groundPath.forEach(([x, top], i) => {
    terrainVertices.push(x, top, 37, x, 7.5, 37, x, 7.5, 25, x, top, 25);
    if (i < groundPath.length - 1) for (let side = 0; side < 4; side++) {
      const a = i * 4 + side, c = i * 4 + (side + 1) % 4;
      terrainIndices.push(a, c, c + 4, a, c + 4, a + 4);
    }
  });
  const end = (groundPath.length - 1) * 4;
  terrainIndices.push(0, 2, 1, 0, 3, 2, end, end + 1, end + 2, end, end + 2, end + 3);
  const terrain = select(shape(terrainVertices, terrainIndices, '#c8c7ad', 'ground-relief'), 0);

  const arrows: { mesh: any; outline: readonly AtmospherePoint[]; layer: number }[] = [];
  const arrow = (id: string, path: readonly AtmospherePoint[], layer: number) => {
    const a: AirArrow = { id, path, reveal: 1, width: .95, thickness: .58, color: '#789c97', tip: path[path.length - 1] };
    const data = airArrowMeshData(a, 12), entry = select(shape(data.positions, data.indices, a.color, 'dominant-motion', layer), layer);
    entry.userData.atmosphereMotion = layer === 0 ? 'vertical-dominant' : 'horizontal-dominant';
    arrows.push({ mesh: entry, outline: data.outline, layer });
  };
  arrow('vertical-ascent', [[25, 14, 36], [25, 24, 36]], 0);
  arrow('vertical-descent', [[34, 24, 36], [34, 14, 36]], 0);
  arrow('horizontal-out', [[23, 39, 36], [36, 39, 36]], 1);
  arrow('horizontal-back', [[36, 48, 36], [23, 48, 36]], 1);
  // One restrained folded strip connects to the aurora illustrated in fig.2.5.
  // It is an association marker, not a forecast or a height-of-aurora readout.
  const auroraPath = Array.from({ length: 33 }, (_, i): AtmospherePoint => {
    const t = i / 32; return [24 + 16 * t, 80 + 2.3 * Math.sin(t * Math.PI * 3), 33 + 1.8 * Math.cos(t * Math.PI * 3)];
  });
  const aurora = select(ribbon(auroraPath, 1.15, .5, '#9bb09b', 'upper-association', 2), 2);
  aurora.userData.association = 'aurora-in-upper-atmosphere-not-everywhere';
  const profile = ribbon(ATMOSPHERE_PROFILE, 1.02, 1.7, '#ad7155', 'temperature-profile');
  profile.material=b.materialFor('brass','#b9874c');profile.userData.materialRole='brass';
  profile.userData.qualitativeOnly = true;
  // The profile is one continuous bent comparison track, anchored at its
  // lower end. It does not turn into a second thermometer or calibrated ruler.
  const initial=ATMOSPHERE_PROFILE[0];
  parts.shaft(p(initial[0],4.7,49),p(initial[0],initial[1],49),.52*scale,'brass');
  parts.bearing(p(initial[0],5.1,49),[0,1,0],1.15*scale,2.2*scale);
  const terminal=ATMOSPHERE_PROFILE[ATMOSPHERE_PROFILE.length-1];
  parts.shaft(p(terminal[0],terminal[1],49),p(terminal[0],94.2,49),.48*scale,'brass');
  parts.bearing(p(terminal[0],93.3,49),[0,1,0],.95*scale,2.1*scale);
  layers.forEach((layer, index) => {
    const y=(layer.low+layer.high)/2;
    parts.shaft(p(78,y,49),p(80,y,43),.48*scale,'brass');
    const mount=select(role(parts.casting(p(78.5,y-5.3,41.8),p(105,y+5.3,43),'brass',.3*scale),'layer-tablet',index),index);
    finish(mount,'brass','#a88b50');
    const face=finish(parts.casting(p(79,y-4.8,43),p(104.5,y+4.8,43.4),'ivory',.18*scale),'ivory','#e3ddc9');
    select(face,index);face.userData.interactionFeedback=false;mount.userData.interactionFeedback=false;
    tag(ATMOSPHERE_LAYERS[index].label, [91.75,y,43.6],25,8.7,'layer-label',index);
  });
  parts.plate(p(32,97.2,47.8),p(74,106,49.2),'brass');
  finish(parts.casting(p(32.5,97.7,49.2),p(73.5,105.5,49.5),'ivory',.15*scale),'ivory','#e3ddc9');
  tag('气温变化示意', [53,101.6,49.7],40,7.3,'profile-label');
  // These short axis tags must remain readable in the whole-book tablet view.
  // Increase the physical paper, not only its texture resolution; the label
  // centres and the fixed camera bounds stay unchanged.
  // Inscriptions share the plinth's vertical front face rather than floating
  // as two more paper signs beyond its feet.
  const footTablet=new T.Group();b.root.add(footTablet);
  footTablet.position.set(...p(61,1.9,53.2));footTablet.rotation.x=-.42;
  const tabletParts=createInstrumentParts(b,footTablet);
  tabletParts.casting([-29*scale,-4.8*scale,-.4*scale],[29*scale,4.8*scale,0],'brass',.14*scale);
  finish(tabletParts.casting([-28.5*scale,-4.3*scale,0],[28.5*scale,4.3*scale,.24*scale],'ivory',.1*scale),'ivory','#e3ddc9');
  for(const [text,x,name] of [['较冷',-19,'relative-cool-label'],['较暖',19,'relative-warm-label']] as const){
    const label=tag(text,[0,0,0],15,8.2,name);footTablet.add(label);label.position.set(x*scale,0,.6*scale);
  }
  tabletParts.shaft([-8*scale,0,.4*scale],[8*scale,0,.4*scale],.09*scale,'brass');

  const track: PhaseTrack = { start: point(ATMOSPHERE_TRACK.start), end: point(ATMOSPHERE_TRACK.end) };
  const rail = role(brightSteel(parts.shaft(p(12,5.4,49),p(12,95,49),.68*scale,'steel')),'height-rail');
  brightSteel(parts.shaft(p(15.5,5.4,47),p(15.5,95,47),.40*scale,'steel'));
  for(const y of [5.5,93.4]){
    parts.bearing(p(12,y,49),[0,1,0],1.18*scale,2.8*scale);
    parts.plate(p(10,y-.55,45.5),p(17.1,y+.55,50.4),'brass');
    brightSteel(parts.shaft(p(15.5,y,47),p(18.2,y,25.5),.27*scale,'steel'));
  }
  // The ruler is a comparison aid with no km labels. Its spacing is the
  // normalized teaching window, not a linear altitude calibration.
  const scaleFace=parts.etchedScale([0,0,0],[82*scale,0,0],{ticks:33,majorEvery:4,width:2.2*scale,thickness:.3*scale});
  scaleFace.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(0,1,0),new T.Vector3(0,0,1),new T.Vector3(1,0,0)));
  scaleFace.position.set(...p(7.2,9,50));
  // The engraved face is bolted to the mast rather than hanging beside it.
  for(const y of [9,91])parts.plate(p(6.1,y-.36,49.6),p(12.3,y+.36,50.35),'brass');
  const handle = role(parts.casting([-2.1*scale,-1.8*scale,-1*scale],[4.3*scale,1.8*scale,1*scale],'brass',.26*scale),'height-handle');
  handle.userData.modelInput = { kind: 'phase-track', track, label: '上下拖动探针，观察大气分层和气温变化' };
  const carriageParts=createInstrumentParts(b,handle);
  carriageParts.bearing([0,0,0],[0,1,0],1.1*scale,3.4*scale);
  const grip=carriageParts.knob([-2.2*scale,0,1.6*scale],[0,0,1],1.45*scale,1.1*scale);
  grip.traverse((object:any)=>{if(object.isMesh)object.userData.modelInput=handle.userData.modelInput});
  carriageParts.plate([3.5*scale,-.68*scale,-.4*scale],[12*scale,.68*scale,.4*scale],'brass');
  // The crosshead is a telescoping blade. Its moving end remains seated on
  // the curve follower; stretching only its length cannot disconnect the grip.
  const needle = mesh(new T.BoxGeometry(scale, .58 * scale, .64 * scale), '#929b98', 'height-probe',undefined,'steel');
  needle.userData.modelInput = handle.userData.modelInput;
  const probe = mesh(new T.SphereGeometry(1.05 * scale, 18, 12), '#b27c5c', 'temperature-probe',undefined,'brass');
  probe.userData.modelInput = handle.userData.modelInput;
  const probeRing = mesh(new T.TorusGeometry(1.48 * scale, .20 * scale, 8, 24), '#a88b50', 'probe-collar',undefined,'brass');
  probeRing.userData.modelInput = handle.userData.modelInput;

  let state = evaluateAtmosphere(0), lastPhase = -1;
  return {
    update(phase) {
      const next = evaluateAtmosphere(phase);
      if (next.phase !== lastPhase) {
        state = next; lastPhase = next.phase;
        handle.position.set(...point(state.handle));
        probe.position.set(...p(state.probe[0], state.probe[1], 49));
        probeRing.position.set(...p(state.probe[0], state.probe[1], 49.3));
        const start = 13.5, end = state.probe[0];
        needle.position.set(...p((start + end) / 2, state.probe[1], 49)); needle.scale.x = end - start;
        layers.forEach((layer, index) => {
          const selected = index === state.selection;
          layer.sheet.material.color.copy(selected ? layer.selected : layer.quiet);
          layer.sheet.userData.highlighted = selected;
        });
      }
      // Outlines are rebuilt into fixed-capacity ink buffers by the existing
      // book renderer; meshes, materials, topology and camera bounds stay fixed.
      for (const layer of layers) if(layer.sheet.userData.modelHovered)b.contour([
        p(19,layer.low,26.5),p(39,layer.low,26.5),p(39,layer.high,26.5),p(19,layer.high,26.5),p(19,layer.low,26.5),
      ],.48);
      for (const entry of arrows) b.contour([...entry.outline, entry.outline[0]].map(([x, y, z]) => p(x, y, z + .32)),
        entry.mesh.userData.modelHovered ? .66 : entry.layer === state.selection ? .36 : .23);
      if(profile.userData.modelHovered)b.contour(ATMOSPHERE_PROFILE.map(([x, y, z]) => p(x, y, z + .58)), .38);
      for (const stop of ATMOSPHERE_STOPS) {
        const at = phaseTrackPoint(stop.phase, track);
        b.contour([[at[0] - .8 * scale, at[1], at[2] + .45 * scale], [at[0] + .8 * scale, at[1], at[2] + .45 * scale]], .32);
      }
      b.outline(terrain, .16);
      if(handle.userData.modelHovered)b.outline(handle,.54);
      // profile and aurora are actual solids; hover strengthens their ink only.
      if (profile.userData.modelHovered) b.contour(ATMOSPHERE_PROFILE.map(at => point(at)), .7);
      if (aurora.userData.modelHovered) b.contour(auroraPath.map(at => point(at)), .7);
    },
    focusBounds: () => ({ min: point(ATMOSPHERE_BOUNDS.min), max: point(ATMOSPHERE_BOUNDS.max) }),
    describe: () => {
      b.root.updateWorldMatrix(true, true);
      const world = (at: AtmospherePoint) => b.root.localToWorld(new T.Vector3(...point(at))).toArray();
      return { kind: 'atmosphere-height-observation', reference: ATMOSPHERE_REFERENCE, ...atmosphereDiagnostics(state),
        originalPagePreserved: true, sharedFlatState: true, fixedBuffers: true, volumeSection: true,
        probeWorld: probe.getWorldPosition(new T.Vector3()).toArray(),
        handleWorld: handle.getWorldPosition(new T.Vector3()).toArray(),
        profilePointWorld: world(state.profilePoint), phaseTrack: track,
        phaseTrackWorld: { start: world(ATMOSPHERE_TRACK.start), end: world(ATMOSPHERE_TRACK.end) },
        controls: ['vertical-phase-track', 'height-bookmarks'], measuredValues: false,
        instrument: { family:'guided-height-comparator', guideRods:2, linkedCarriage:true,
          scaleUnits:'none', openObservationWindow:true, paperMaterialOverride:false,
          construction:'single-bed-guided-comparator', supportedCurveEnds:2, mountedLayerTablets:3 } };
    },
  };
}

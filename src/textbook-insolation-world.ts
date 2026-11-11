import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import type { PhaseTrack } from './textbook-model-input';
import { createInstrumentParts, turnedShaftGeometry } from './textbook-instrument-parts';
import { createSolidMaterial, inferSolidMaterialRole, type SolidMaterialRole } from './textbook-solid-materials';
import { evaluateInsolation, insolationHit, insolationSource,
  INSOLATION_LAYOUT as L, INSOLATION_REFERENCE, INSOLATION_STOPS,
  type InsolationPoint } from './textbook-insolation-model';

/** One persistent instrument globe, a fixed square of parallel light and its
 * actual spherical footprint. Dragging raises the beam; it never replaces
 * the globe, crops the beam at high latitude or substitutes a page image. */
export function buildInsolationWorld(b: TextbookGeometry): ModelMotion {
  const scale = b.width / 100, back = -LIFT_MARGIN - 78 * scale, rise = 36 * scale;
  const p = ([x, y, z]: InsolationPoint): Vec3 => [x * scale, y * scale, back + z * scale];
  b.root.position.set(0, rise, -8 * scale);
  const role = (mesh: any, name: string) => { mesh.userData.insolationRole = name; return mesh; };
  const solid = (geometry: any, color: string, name: string, _hatch = .025, materialRole:SolidMaterialRole=inferSolidMaterialRole(color)) =>
    role(b.mesh(geometry, color, false, true, materialRole), name);
  const parts=createInstrumentParts(b),brass='#a88b50',steel='#929b98',enamel='#293c37';
  const source0=insolationSource(0),normal=new T.Vector3(...L.sunward),tangent=new T.Vector3(L.sunward[2],0,-L.sunward[0]);
  const opticalPoint=(along:number,y:number,across=0):InsolationPoint=>[
    L.center[0]+normal.x*along+tangent.x*across,y,L.center[2]+normal.z*along+tangent.z*across];
  const axisQuaternion=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),normal);
  // A narrow optical bed follows the actual source/globe axis. The raised
  // golden line is a fine edge, not a second platform or a decorative frame.
  const bench=new T.Group();b.root.add(bench);bench.position.set(...p(opticalPoint(27,0)));bench.quaternion.copy(axisQuaternion);
  const benchParts=createInstrumentParts(b,bench);
  benchParts.plate([-11*scale,.5*scale,-39*scale],[11*scale,1.9*scale,39*scale],'wood',.3*scale);
  benchParts.plate([-10.4*scale,1.9*scale,-38.4*scale],[10.4*scale,2.14*scale,38.4*scale],'brass',.1*scale);
  const deck=benchParts.plate([-10.1*scale,2.14*scale,-38.1*scale],[10.1*scale,2.65*scale,38.1*scale],'steel',.14*scale);deck.material=b.materialFor('enamel',enamel);deck.userData.materialRole='enamel';
  benchParts.fasteners([[-8.8*scale,2.69*scale,-32*scale],[8.8*scale,2.69*scale,-32*scale],[-8.8*scale,2.69*scale,32*scale],[8.8*scale,2.69*scale,32*scale]],[0,1,0],.55*scale);
  for(const across of [-6.5,6.5])parts.shaft(p(opticalPoint(-4,4,across)),p(opticalPoint(61,4,across)),.58*scale,'steel');
  // The globe is carried at its poles; the lower shaft ends at the surface,
  // leaving the illuminated hemisphere free for incidence comparison.
  parts.bearing(p([L.center[0],4.4,L.center[2]]),[0,1,0],3.3*scale,2.4*scale);
  parts.shaft(p([L.center[0],5.6,L.center[2]]),p([L.center[0],6.4,L.center[2]]),.7*scale,'steel');
  const bowPoints=Array.from({length:81},(_,i)=>{const a=-Math.PI/2+i/80*Math.PI;return new T.Vector3(...p([
    L.center[0]+Math.cos(a)*26,L.center[1]+Math.sin(a)*26,L.center[2]]));});
  solid(new T.TubeGeometry(new T.CatmullRomCurve3(bowPoints),80,.65*scale,10,false),brass,'globe-open-bow',0,'brass');
  parts.bearing(p([L.center[0],54,L.center[2]]),[0,1,0],1.7*scale,2.8*scale);
  // Two real guide posts stand behind the source plane. The entire carrier
  // moves on them by the same height used to construct the exact light rays.
  const railAlong=L.sourceDistance+4.5,railHeight=L.center[1]+L.radius*Math.sin(65*Math.PI/180)+4;
  for(const across of [-4.8,4.8]){
    const base=p(opticalPoint(railAlong,3.2,across));
    parts.bearing(base,[0,1,0],1.65*scale,2.3*scale);
    parts.shaft(p(opticalPoint(railAlong,4.3,across)),p(opticalPoint(railAlong,railHeight,across)),.48*scale,'steel');
    parts.bearing(p(opticalPoint(railAlong,railHeight,across)),[0,1,0],.95*scale,1.1*scale);
  }
  const slide=new T.Group();slide.name='insolation-source-carriage';b.root.add(slide);
  slide.position.set(...p(source0));slide.quaternion.copy(axisQuaternion);
  const slideParts=createInstrumentParts(b,slide);
  slideParts.plate([-6.4*scale,-2.8*scale,3.7*scale],[6.4*scale,2.8*scale,5.3*scale],'brass',.3*scale);
  slideParts.fasteners([[-5.1*scale,-1.7*scale,3.67*scale],[5.1*scale,-1.7*scale,3.67*scale],[-5.1*scale,1.7*scale,3.67*scale],[5.1*scale,1.7*scale,3.67*scale]],[0,0,-1],.35*scale);
  for(const x of [-4.8,4.8])slideParts.bearing([x*scale,0,4.5*scale],[0,1,0],.95*scale,5.5*scale);
  slideParts.shaft([0,-2.2*scale,.7*scale],[0,-2.2*scale,4.5*scale],.65*scale,'brass');
  const sleeve=solid(turnedShaftGeometry([0,0,.22*scale],[0,0,3.7*scale],[[2.7*scale,0],[3.1*scale,.08],[3.1*scale,.24],[2.65*scale,.3],[2.65*scale,.9],[3*scale,1]]),enamel,'collimator-barrel',0,'enamel');
  slide.add(sleeve);
  const select = (mesh: any, selection: number) => {
    mesh.userData.modelInput = { kind: 'select', selection, label: `查看${INSOLATION_STOPS[selection].label}的等宽光束` };
    mesh.userData.insolationSelection = selection; return mesh;
  };
  const globe = solid(new T.SphereGeometry(L.radius * scale, 48, 28), '#b7ccc5', 'earth', .012, 'ivory');
  // This is a painted teaching globe, rather than a water material inferred
  // from its pale green hue. Keep its highlight broad and the hit area clear.
  globe.material.roughness = .62;
  // This is a closed convex globe, unlike the double-sided open shells used
  // elsewhere in the book. Casting its back faces removes near-coincident
  // front-surface depth comparisons while retaining both cast/receive shadows.
  globe.material.side=T.FrontSide;globe.material.shadowSide=T.BackSide;
  globe.position.set(...p(L.center));
  for (const latitude of [-40, 0, 40]) {
    const a = latitude * Math.PI / 180;
    b.stroke(Array.from({ length: 81 }, (_, i) => {
      const lon = i / 80 * Math.PI * 2, r = (L.radius + .045) * Math.cos(a);
      return p([L.center[0] + r * Math.cos(lon), L.center[1] + (L.radius + .045) * Math.sin(a), L.center[2] + r * Math.sin(lon)]);
    }), .20);
  }
  let state = evaluateInsolation(0), previous = -1;
  const patchGeometry = new T.BufferGeometry();
  const patchPositions = new Float32Array(state.patch.points.length * 3), patchNormals = new Float32Array(patchPositions.length);
  patchGeometry.setAttribute('position', new T.BufferAttribute(patchPositions, 3));
  patchGeometry.setAttribute('normal', new T.BufferAttribute(patchNormals, 3));
  patchGeometry.setIndex(state.patch.indices);
  const patch = solid(patchGeometry, '#d2ab5e', 'illumination-footprint', .015);
  // Light and its illuminated footprint are explanatory light geometry, not
  // opaque objects. Their depth must not darken the receiving sphere.
  patch.userData.castShadow=false;
  // Its endpoints are physical closed geometry, not a screen-space trace.
  const rayGeometry = new T.CylinderGeometry(.205 * scale, .205 * scale, 1, 10);
  const arrowGeometry = new T.ConeGeometry(.63 * scale, 1.85 * scale, 10);
  const rays = state.rays.map(ray => {
    const mesh = solid(rayGeometry, '#bd984c', 'parallel-light-cylinder', .012);
    const arrow = solid(arrowGeometry, '#a9823b', 'light-direction-arrow', .012);
    mesh.userData.insolationRayId = arrow.userData.insolationRayId = ray.id;
    mesh.userData.castShadow=arrow.userData.castShadow=false;
    return { mesh, arrow };
  });
  const frameGeometry = new T.CylinderGeometry(.105 * scale, .105 * scale, 1, 8);
  const frame = Array.from({ length: 4 }, () => solid(frameGeometry, '#b8a77b', 'fixed-beam-cross-section', .012));
  const maxHeight = L.radius * Math.sin(L.maxLatitudeDegrees * Math.PI / 180);
  const track: PhaseTrack = { start: p(insolationSource(0)), end: p(insolationSource(maxHeight)) };
  const aperture=new T.Shape();aperture.moveTo(-3.4*scale,-3.4*scale);aperture.lineTo(3.4*scale,-3.4*scale);aperture.lineTo(3.4*scale,3.4*scale);aperture.lineTo(-3.4*scale,3.4*scale);aperture.closePath();
  const opening=new T.Path();opening.moveTo(-1.6*scale,-1.6*scale);opening.lineTo(-1.6*scale,1.6*scale);opening.lineTo(1.6*scale,1.6*scale);opening.lineTo(1.6*scale,-1.6*scale);opening.closePath();aperture.holes.push(opening);
  // A sharp diaphragm edge keeps the true clear opening exactly 3.2 square;
  // bevels belong to the carrying frame, never inside the teaching aperture.
  const apertureGeo=new T.ExtrudeGeometry(aperture,{depth:.6*scale,bevelEnabled:false});apertureGeo.translate(0,0,-.3*scale);
  const handle = solid(apertureGeo,brass,'height-handle',0,'brass');
  handle.quaternion.copy(axisQuaternion);
  handle.userData.smallPointTarget = true;
  // The source aperture and supporting carriage form one rigid assembly;
  // generic per-mesh hover nudges would pull the aperture away from its mount.
  handle.userData.interactionFeedback=false;
  handle.userData.modelInput = { kind: 'phase-track', track, label: '上下拖动等宽光束，比较不同纬度' };
  const nodes = INSOLATION_STOPS.map(stop => {
    const at = insolationHit(stop.phase * maxHeight);
    // A small physical pin sits just above the surface; its exact coordinate
    // remains independent of the current moving illumination patch.
    const normal = at.map((v, i) => (v - L.center[i]) / L.radius) as InsolationPoint;
    const position = at.map((v, i) => v + normal[i] * .32) as InsolationPoint;
    const mesh = select(solid(new T.SphereGeometry(.62 * scale, 14, 10), '#6d8071', 'latitude-node', .012), stop.selection);
    mesh.position.set(...p(position)); mesh.userData.smallPointTarget = true;
    return { mesh, stop, surface: at };
  });
  const label = (text: string, at: InsolationPoint, width: number, height: number, name: string) => role(b.label(text, p(at), width * scale, height * scale), name);
  const labelHeight=5.2;
  label(L.labels.beam.text,[24,57,59],23,labelHeight,'beam-label');
  label(L.labels.footprint.text,[83,56,46],23,labelHeight,'footprint-label');
  const nodeLabels = INSOLATION_STOPS.map(stop => select(label(stop.label,[83,6.5,50],18,labelHeight,'latitude-label'), stop.selection));
  const from = new T.Vector3(), to = new T.Vector3(), axis = new T.Vector3(), up = new T.Vector3(0, 1, 0);
  const orientSegment = (mesh: any, a: InsolationPoint, c: InsolationPoint) => {
    from.set(...p(a)); to.set(...p(c)); axis.copy(to).sub(from);
    const length = axis.length(); mesh.position.copy(from).add(to).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(up, axis.normalize()); mesh.scale.y = length;
  };
  const allMeshes = [...b.meshes], arrays = allMeshes.map(mesh => mesh.geometry.attributes.position.array);
  const allIndices = allMeshes.map(mesh => mesh.geometry.index?.array), fixedMeshCount = allMeshes.length;
  const inactive = new T.Color('#6d8071'), active = new T.Color('#a57b35');
  // Independent physical highlights retain the original Popout alpha object;
  // cloning a material would discard the reveal callback.
  for (const node of nodes) {
    node.mesh.material = createSolidMaterial(b.pop,'brass','#6d8071');
  }
  const motion: ModelMotion = {
    update(phase) {
      const next = evaluateInsolation(phase);
      if (next.phase !== previous) {
        state = next; previous = state.phase;
        state.patch.points.forEach((point, i) => {
          const normal = point.map((v, j) => (v - L.center[j]) / L.radius);
          const at = p(point.map((v, j) => v + normal[j] * .085) as InsolationPoint);
          patchPositions.set(at, i * 3); patchNormals.set(normal, i * 3);
        });
        patchGeometry.attributes.position.needsUpdate = true; patchGeometry.attributes.normal.needsUpdate = true;
        patchGeometry.computeBoundingSphere();
        state.rays.forEach((ray, i) => {
          orientSegment(rays[i].mesh, ray.source, ray.hit);
          const arrowAt = ray.source.map((v, j) => v + (ray.hit[j] - v) * .60) as InsolationPoint;
          rays[i].arrow.position.set(...p(arrowAt)); rays[i].arrow.quaternion.copy(rays[i].mesh.quaternion);
        });
        const corners = [[-L.halfBeam, -L.halfBeam], [-L.halfBeam, L.halfBeam], [L.halfBeam, L.halfBeam], [L.halfBeam, -L.halfBeam]]
          .map(([v, w]) => insolationSource(state.height + v, w));
        frame.forEach((mesh, i) => orientSegment(mesh, corners[i], corners[(i + 1) % 4]));
        handle.position.set(...p(state.sourceCenter));
        slide.position.copy(handle.position);
        nodeLabels.forEach((mesh, i) => { mesh.visible = i === state.selection; });
        nodes.forEach(({ mesh }, i) => { mesh.material.color.copy(i === state.selection ? active : inactive); });
      }
      b.contour([...state.patch.boundary, state.patch.boundary[0]].map(point => {
        const normal = point.map((v, i) => (v - L.center[i]) / L.radius);
        return p(point.map((v, i) => v + normal[i] * .11) as InsolationPoint);
      }), .55);
      // Three meridians on the actual lit patch make its changing footprint
      // legible without covering the globe in a second decorative grid.
      for (const fraction of [.25, .5, .75]) {
        const column = Math.round(state.patch.columns * fraction);
        b.contour(Array.from({ length: state.patch.rows + 1 }, (_, row) => {
          const point = state.patch.points[row * (state.patch.columns + 1) + column];
          return p(point.map((v, i) => v + (v - L.center[i]) / L.radius * .12) as InsolationPoint);
        }), .20);
      }
      b.outline(handle, handle.userData.modelHovered ? .64 : .32);
      for (const { mesh } of nodes) if (mesh.userData.modelHovered) b.outline(mesh, .52);
    },
    focusBounds: () => ({ min: p(L.bounds.min), max: p(L.bounds.max) }),
    describe: () => {
      b.root.updateWorldMatrix(true, true);
      const world = (point: Vec3) => b.v(point).applyMatrix4(b.root.matrixWorld).toArray() as Vec3;
      const modelWorld = (point: InsolationPoint) => world(p(point));
      return {
        kind: 'solar-distribution', ...state, state, reference: INSOLATION_REFERENCE,
        source: INSOLATION_REFERENCE.source, note: INSOLATION_REFERENCE.note,
        sphereRadius: L.radius, fixedBeamWidth: L.halfBeam * 2, fixedBeamHeight: L.halfBeam * 2,
        beamClampedAtHighLatitude: false, phaseRepresentsTime: false,
        originalPagePreserved: true, elevatedAbovePage: rise,
        opticalBench:{supportedSource:true,verticalGuides:2,apertureWidth:3.2,apertureHeight:3.2,
          carriageWorld:slide.getWorldPosition(new T.Vector3()).toArray(),sourceFrameWorld:handle.getWorldPosition(new T.Vector3()).toArray(),
          phaseIsObservationLatitude:true,annualRadiationCalculated:false},
        nodeStops: INSOLATION_STOPS, fixedMeshCount,
        geometryBuffersReused: b.meshes.length === fixedMeshCount && allMeshes.every((mesh, i) => mesh.geometry.attributes.position.array === arrays[i] && mesh.geometry.index?.array === allIndices[i]),
        globeWorld: { center: modelWorld(L.center), radius: L.radius * scale },
        rayWorld: rays.map(({ mesh, arrow }, i) => ({ id: state.rays[i].id,
          source: mesh.localToWorld(new T.Vector3(0, -.5, 0)).toArray(),
          hit: mesh.localToWorld(new T.Vector3(0, .5, 0)).toArray(), arrow: arrow.getWorldPosition(new T.Vector3()).toArray() })),
        patchWorld: state.patch.points.map(modelWorld),
        patchRenderWorld: Array.from({ length: patchPositions.length / 3 }, (_, i) => world([patchPositions[i * 3], patchPositions[i * 3 + 1], patchPositions[i * 3 + 2]])),
        handleWorld: handle.getWorldPosition(new T.Vector3()).toArray(), phaseTrack: track,
        phaseTrackWorld: { start: world(track.start), end: world(track.end) },
        nodeWorld: nodes.map(({ mesh, stop, surface }) => ({ ...stop, point: mesh.getWorldPosition(new T.Vector3()).toArray(), surface: modelWorld(surface) })),
        nodeLabelWorld: nodeLabels.map((mesh, i) => ({ ...INSOLATION_STOPS[i], point: mesh.getWorldPosition(new T.Vector3()).toArray(),
          visible: mesh.visible, width:18 * scale, height:labelHeight * scale })),
        labelWorld: allMeshes.filter(mesh => mesh.userData.kind === 'text-label' && mesh.visible).map(mesh => ({
          text: mesh.userData.text, point: mesh.getWorldPosition(new T.Vector3()).toArray() })),
        meshRoles: allMeshes.map(mesh => ({ role: mesh.userData.insolationRole, selection: mesh.userData.insolationSelection,
          visible: mesh.visible, id: mesh.userData.insolationRayId })),
      };
    },
  };
  motion.update(0, 0, 0, true); return motion;
}

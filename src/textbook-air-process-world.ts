import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint, type PhaseTrack } from './textbook-model-input';
import { createConvectionSmoke } from './textbook-convection-smoke';
import { mountFieldInstrument } from './textbook-field-instruments';
import { mountHeatingBench } from './textbook-atmosphere-specimens';
import { createAirInstrumentRig } from './textbook-air-instrument-rig';
import { AIR_PROCESS_BOUNDS, AIR_PROCESS_REFERENCE, AIR_PROCESS_STOPS, AIR_PROCESS_TRACK,
  airArrowMeshData, airProcessDiagnostics, evaluateAirProcess,
  type AirArrow, type AirPoint, type AirProcessEffect } from './textbook-air-process-model';

/** Raised paper solids share the original Popout material and ink machinery.
 * The ground has actual thickness; the radiation and air arrows have front,
 * back and edge faces. Nothing samples or replaces the printed textbook. */
export function buildAirProcessWorld(b: TextbookGeometry, effect: AirProcessEffect): ModelMotion {
  const scale = b.width / 100, back = -LIFT_MARGIN - 72 * scale;
  const p = (x: number, y: number, z: number): Vec3 => [x * scale, y * scale, back + z * scale];
  const rig = createAirInstrumentRig(b, scale, back);
  const point = (a: AirPoint): Vec3 => p(...a);
  const role = (mesh: any, name: string) => { mesh.userData.airProcessRole = name; mesh.userData.airProcessEffect = effect; return mesh; };
  const input = (mesh: any, selection: number) => {
    const label = AIR_PROCESS_STOPS[effect][selection].label;
    mesh.userData.modelInput = { kind: 'select', selection, label: `查看${label}` };
    return mesh;
  };
  const quiet = (mesh: any, color: string, hatch = .09) => {
    mesh.material = createSpecimenMaterial(b.pop, { color, ink: '#6e776a', hatch, shade: .085, spacing: 2.9, seed: effect === 'heat' ? 213 : 219 });
    mesh.material.side = T.DoubleSide; return mesh;
  };
  const tint = (mesh: any, from: string, to: string, t: number) => mesh.material.color.copy(new T.Color(from).lerp(new T.Color(to), t));
  const solid = (g: any, color: string, name: string, hatch = .09) => role(quiet(b.mesh(g, color, false), color, hatch), name);
  const shape = (positions: readonly number[], indices: readonly number[], color: string, name: string, hatch = .09) => {
    const vertices: number[] = [];
    for (let i = 0; i < positions.length; i += 3) vertices.push(...p(positions[i], positions[i + 1], positions[i + 2]));
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    g.setIndex([...indices]); g.computeVertexNormals(); return solid(g, color, name, hatch);
  };
  const box = (a: AirPoint, c: AirPoint, color: string, name: string) =>
    role(quiet(b.box(point(a), point(c), color, false), color), name);
  const tag = (text: string, at: AirPoint, width: number, height: number, name: string, selection?: number, engraved = false) => {
    const mesh = role(b.label(text, point(at), width * scale * 1.2, height * scale * 1.4,
      { appearance: engraved ? 'engraved' : 'paper', ink: engraved && !['pressure-label','uniform-column-label','thermal-column-label'].includes(name) ? '#e6dcc5' : undefined }), name);
    return selection === undefined ? mesh : input(mesh, selection);
  };
  /** Closed cross-sections give the ground and thin isobaric paper surfaces
   * stable buffers; changing phase updates positions instead of rebuilding. */
  const sectionData = (path: readonly AirPoint[], zBack: number, zFront: number, bottom: number | 'ribbon') => {
    const positions: number[] = [], indices: number[] = [];
    path.forEach(([x, y], i) => {
      const top = bottom === 'ribbon' ? y + .15 : y, low = bottom === 'ribbon' ? y - .15 : bottom;
      positions.push(x, top, zFront, x, low, zFront, x, low, zBack, x, top, zBack);
      if (i < path.length - 1) for (let side = 0; side < 4; side++) {
        const a = i * 4 + side, c = i * 4 + (side + 1) % 4;
        indices.push(a, c, c + 4, a, c + 4, a + 4);
      }
    });
    const last = (path.length - 1) * 4;
    indices.push(0, 2, 1, 0, 3, 2, last, last + 1, last + 2, last, last + 2, last + 3);
    return { positions, indices };
  };
  const setVertices = (mesh: any, positions: readonly number[]) => {
    const a = mesh.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) a.setXYZ(i, ...p(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]));
    a.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere(); mesh.geometry.computeBoundingBox();
  };
  const rail = role(rig.plate([10, -13.6, 66.3], [90, -13.2, 69.7], 'ivory', 'recessed-phase-scale', .08), 'phase-rail');
  if (effect === 'heat') rig.phaseSlide([...AIR_PROCESS_TRACK.start], [...AIR_PROCESS_TRACK.end]);
  else {
    rig.circulationChassis();
    for (const z of [67.1, 68.9]) rig.rod([10, -12.4, z], [90, -12.4, z], .22, 'steel', 'integrated-phase-guide');
  }
  const track: PhaseTrack = { start: point(AIR_PROCESS_TRACK.start), end: point(AIR_PROCESS_TRACK.end) };
  const handleGeometry = new T.LatheGeometry([[0, -.75], [1.7, -.75], [1.9, -.5], [1.9, .25], [1.55, .55], [0, .55]]
    .map(([r, y]) => new T.Vector2(r * scale, y * scale)), 32);
  const handle = role(b.mesh(handleGeometry, '#b39359', false, true, 'brass'), 'phase-handle');
  handle.userData.modelInput = { kind: 'phase-track', track,
    label: effect === 'heat' ? '拖动滑钮，回看短波、地面增温与长波' : '拖动滑钮，逐步查看冷热差、气压与环流' };

  let state = evaluateAirProcess(effect, 0), lastPhase = -1;
  const arrowMeshes = state.arrows.map((a, i) => {
    const data = airArrowMeshData(a), mesh = shape(data.positions, data.indices, a.color, a.id, .065);
    mesh.visible = false; mesh.userData.airArrowId = a.id;
    mesh.userData.airTipVertex = data.positions.length / 3 - 5;
    input(mesh, effect === 'heat' ? i === 0 ? 0 : 2 : i < 3 ? 2 : 4);
    return { mesh, outline: data.outline, color: a.color };
  });
  const updateArrows = (arrows: AirArrow[]) => {
    arrows.forEach((a, i) => {
      const entry = arrowMeshes[i], data = airArrowMeshData(a);
      setVertices(entry.mesh, data.positions); entry.outline = data.outline;
      entry.mesh.visible = a.reveal > .001; entry.mesh.userData.airReveal = a.reveal;
      entry.mesh.userData.airTip = [...a.tip];
    });
  };
  const inkArrows = () => {
    arrowMeshes.forEach(entry => {
      if (!entry.mesh.visible) return;
      const front = entry.outline.map(([x, y, z]) => p(x, y, z + .36));
      b.contour([...front, front[0]], entry.mesh.userData.modelHovered ? .73 : .32);
    });
  };
  const inkRail = () => {
    b.contour([track.start, track.end], .28);
    for (const stop of AIR_PROCESS_STOPS[effect]) {
      const at = phaseTrackPoint(stop.phase, track); b.contour([[at[0], at[1] - .7 * scale, at[2]], [at[0], at[1] + .7 * scale, at[2]]], .34);
    }
    b.outline(rail, .25); b.outline(handle, handle.userData.modelHovered ? .82 : .42);
  };
  const worldPosition = (a: AirPoint) => b.root.localToWorld(new T.Vector3(...point(a))).toArray();
  const diagnostics = () => {
    b.root.updateWorldMatrix(true, false);
    return { kind: effect === 'heat' ? 'air-heating-process' : 'thermal-circulation-process',
      reference: AIR_PROCESS_REFERENCE[effect], ...airProcessDiagnostics(state),
      originalPagePreserved: true, sharedFlatState: true, volumeArrows: true, fixedBuffers: true,
      handleWorld: handle.getWorldPosition(new T.Vector3()).toArray(), handleLocal: handle.position.toArray(), phaseTrack: track,
      keyWorldPositions: Object.fromEntries(Object.entries(state.keyPositions).map(([key, at]) => [key, worldPosition(at)])),
      controls: ['phase-track', 'object-nodes'], measuredValues: false,
      specimenConstruction: effect === 'heat' ? 'open-radiation-specimen-with-supported-source' : 'open-three-column-same-height-comparator',
      comparisonInstrumentCalibrated: false };
  };
  const bounds = () => effect === 'circulation'
    ? { min: point([2, -19, 4]), max: point([98, 61, 73]) }
    : { min: point(AIR_PROCESS_BOUNDS.min), max: point(AIR_PROCESS_BOUNDS.max) };

  if (effect === 'heat') {
    const {ground,setHeatingStage}=mountHeatingBench(b,scale,p(0,0,0));
    // The ground and receiving air remain natural objects. The small probes
    // indicate relative warming only and share exactly the existing state.
    const groundGauge = rig.gauge([34, 9.7, 23], 3.4, 'ground-warmth');
    rig.rod([34, -2.5, 20], [34, 9.7, 20], .38, 'steel', 'ground-warmth-probe-stem');
    rig.rod([34, 9.7, 20], [34, 9.7, 22], .38, 'steel', 'ground-warmth-probe-coupling');
    const airGauge = rig.gauge([83, 27, 23], 3.4, 'air-warmth');
    rig.rod([91, -2.5, 19], [91, 27, 19], .38, 'steel', 'air-warmth-probe-stem');
    rig.rod([91, 27, 19], [83, 27, 19], .32, 'steel', 'air-warmth-probe-arm');
    rig.rod([83, 27, 19], [83, 27, 22], .32, 'steel', 'air-warmth-probe-coupling');
    groundGauge.body.userData.modelInput = { kind: 'select', selection: 1, label: '查看地面增温' };
    airGauge.body.userData.modelInput = { kind: 'select', selection: 3, label: '查看大气吸收' };
    // Sparse open ribs locate the atmospheric space without making an opaque
    // dome or a glass container. Their geometry remains fixed as the air warms.
    [21, 37].forEach(h => {
      const path = Array.from({ length: 49 }, (_, i): AirPoint => [6 + 88 * i / 48, h + 3.5 * Math.sin(i / 48 * Math.PI), 0]);
      const data = sectionData(path, 17.7, 18.17, 'ribbon');
      shape(data.positions, data.indices, '#a1b5ab', 'atmosphere-rib', .035);
    });
    // Stationary qualitative air markers change colour where terrestrial
    // longwave is absorbed. Their count has no energetic or molecular scale.
    const airMarks = Array.from({ length: 9 }, (_, i) => {
      const g = new T.OctahedronGeometry(.68 * scale, 0);
      g.translate(...p(69 + i % 3 * 4.3, 16 + Math.floor(i / 3) * 7.3, 35 + i % 2 * 3));
      return input(solid(g, '#afc2bd', 'absorbing-air', .06), 3);
    });
    return {
      update(phase) {
        if (phase !== lastPhase) {
          const next = evaluateAirProcess('heat', phase); state = next; lastPhase = phase;
          updateArrows(next.arrows); tint(ground, '#ac8f6b', '#a77751', next.visibility.groundWarmth);
          groundGauge.set(next.visibility.groundWarmth); airGauge.set(next.visibility.airWarmth);
          airMarks.forEach(mesh => tint(mesh, '#afc2bd', '#bf916f', next.visibility.airWarmth));
          setHeatingStage(next.stageIndex);
          handle.position.set(...phaseTrackPoint(next.phase, track));
        }
        inkArrows(); inkRail();
      }, focusBounds: bounds, describe: diagnostics,
    };
  }

  const base = input(box([4, 0, 14], [96, 2.8, 52], '#bdb5a0', 'ground-base'), 0);
  const baths = mountFieldInstrument(b, 'thermal', scale, p(0, 0, 0));
  const thermalSources = ['left-ice', 'fire', 'right-ice'].map((group, i) => {
    const origin = p([18, 50, 82][i], i === 1 ? 7.04 : 4.44, i === 1 ? 45.25 : 43);
    const pivot = new T.Group();
    b.root.add(pivot);
    pivot.position.set(...origin);
    for (const mesh of baths.get(group)!) {
      mesh.geometry.translate(-origin[0], -origin[1], -origin[2]);
      pivot.add(mesh);
      input(mesh, 1);
      const finish = mesh.material as InstanceType<typeof T.MeshStandardMaterial>;
      if (group === 'fire') finish.emissive?.setRGB(.21, .046, .006);
    }
    return pivot;
  });
  for (const group of ['left', 'warm', 'right', 'hotplate']) {
    for (const mesh of baths.get(group)!) input(role(mesh, group === 'hotplate' ? 'warm-ground' : 'thermal-bath'), 1);
  }
  const traceAir = createConvectionSmoke(b, scale, p);
  const columns = ['B', 'A', 'C'];
  const uniformTags = columns.map((id, i) => tag(id, [[18, 50, 82][i], -5.8, 58], 10, 5.1, 'uniform-column-label', 0,true));
  const thermalTags = columns.map((id, i) => tag(`${id} · ${i === 1 ? '暖' : '冷'}`, [[18, 50, 82][i], -5.8, 58], 17, 5.1, 'thermal-column-label', 1,true));
  for (const label of [...uniformTags, ...thermalTags]) {
    label.rotation.x = -Math.atan(1 / .8);
    label.position.add(new T.Vector3(0,0,.18*scale).applyAxisAngle(new T.Vector3(1,0,0),label.rotation.x));
    label.userData.labelMount = 'surface';
    // Dark ink belongs to the ceramic inset, never an emissive paper slip.
    label.material.map && (label.material.userData.ceramicInscription=true);
  }
  // The inscription and ivory background are ONE circular dial surface.
  // Separate transparent glyph carriers were visibly sparkling over the face.
  const pressureTags = [12, 51].flatMap((height, layer) => [18, 50, 82].map((x, i) =>
    input(role(b.label((layer === 0 ? i !== 1 : i === 1) ? '高' : '低', point([x, height, 27.11]),
      8.6 * 1.65 * scale, 8.6 * 1.65 * scale, { appearance: 'dial' }), 'pressure-label'), 3)));
  pressureTags.forEach(label => { label.userData.labelMount = 'surface'; });
  // Two distinct comparison rails, both horizontal. Vertical posts are only
  // mounting supports; they never join a high/low pair as a wind direction.
  const pressureGauges = [12, 51].flatMap((height, layer) => [18, 50, 82].map((x, i) => {
    const gauge = rig.gauge([x, height, 27], 8.6, `layer-${layer}-column-${i}`);
    gauge.body.userData.modelInput = { kind: 'select', selection: 3, label: '在同一高度比较气压' };
    return { gauge, layer, column: i };
  }));
  const initial = evaluateAirProcess('circulation', 0);
  const isobars = [initial.isobars.lower, initial.isobars.upper].map(path => {
    const data = sectionData(path, 4, 12, 'ribbon'); return input(shape(data.positions, data.indices, '#a0b6ad', 'isobaric-surface', .035), 3);
  });
  return {
    update(phase) {
      if (phase !== lastPhase) {
        const next = evaluateAirProcess('circulation', phase); state = next; lastPhase = phase;
        updateArrows(next.arrows); handle.position.set(...phaseTrackPoint(next.phase, track));
        thermalSources.forEach(source => {
          source.visible = next.visibility.thermalContrast > .005;
          source.scale.setScalar(Math.max(.001, next.visibility.thermalContrast));
        });
        traceAir(next);
        uniformTags.forEach(mesh => { mesh.visible = next.visibility.thermalContrast < .01; });
        thermalTags.forEach(mesh => { mesh.visible = next.visibility.thermalContrast >= .01; });
        pressureTags.forEach(mesh => { mesh.visible = next.visibility.pressure > .01; });
        pressureGauges.forEach(({ gauge, layer, column }) => {
          const field = layer === 0 ? next.columns[column].nearPressure : next.columns[column].upperPressure;
          gauge.set((field === 'equal' ? 0 : field === 'high' ? 1 : -1) * next.visibility.pressure);
        });
        [next.isobars.lower, next.isobars.upper].forEach((path, i) => setVertices(isobars[i], sectionData(path, 4, 12, 'ribbon').positions));
      }
      // Pressure labels lie on horizontal comparison rails. The equal-pressure
      // surfaces behind them may bend; a vertical arrow never joins high/low tags.
      if (state.effect === 'circulation') {
        for (const path of [state.isobars.lower, state.isobars.upper]) b.contour(path.map(([x, y]) => p(x, y + .16, 12.05)), .28);
        if (state.visibility.horizontal > .001) for (const loop of state.loops) b.contour(loop.map(([x, y, z]) => p(x, y, z - .3)), .33 * state.visibility.horizontal);
      }
      // Fine natural section boundaries keep the substrate readable; the
      // physical mounts get their edge definition from lighting, not ink.
      b.outline(base, .25);
      inkArrows(); inkRail();
    }, focusBounds: bounds, describe: diagnostics,
  };
}



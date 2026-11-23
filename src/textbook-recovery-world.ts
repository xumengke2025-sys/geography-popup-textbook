import { createSpecimenMaterial, type SolidMaterialRole } from './textbook-solid-materials';
import { applyEarthScan } from './textbook-earth-scan';
import { recoveryMiniatures,recoveryCabinet,recoveryPlateAt } from './textbook-recovery-cabinet';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint, type PhaseTrack } from './textbook-model-input';
import { evaluateRecovery, recoveryBox, recoveryDiagnostics, recoveryLinkMesh,
  RECOVERY_LAYOUT as L, RECOVERY_PARTS, RECOVERY_LINKS, RECOVERY_STOPS,
  type RecoveryCase, type RecoveryMeshData, type RecoveryPoint } from './textbook-recovery-model';

/** Two separately observed paper scenes. Nothing is lifted away from the
 * Yushu ruin and no house grows out of it. Only the current case is visible;
 * all allocations are made once and all instructional progress is seekable. */
export function buildRecoveryWorld(b: TextbookGeometry): ModelMotion {
  const scale = b.width / 100, back = -LIFT_MARGIN - 72 * scale, rise = 33 * scale;
  const p = ([x, y, z]: RecoveryPoint): Vec3 => [x * scale, y * scale, back + z * scale];
  b.root.position.set(0, rise, -8 * scale);
  const meshes: any[] = [];
  const role = (mesh: any, name: string, caseIndex?: RecoveryCase) => {
    mesh.userData.recoveryRole = name;
    if (caseIndex !== undefined) {
      mesh.userData.recoveryCase = caseIndex;
      // A station is a part of this case, never a shortcut to the other case.
      mesh.userData.modelInput = { kind: 'select', selection: caseIndex, keepPhase:true,
        label: caseIndex === 0 ? '暂停查看玉树救援案例' : '暂停查看北川异地重建案例' };
    }
    meshes.push(mesh); return mesh;
  };
  const paper = (color: string, own = false, hatch = .055, role?:Exclude<SolidMaterialRole,'paper'>) => {
    // Separate materials allow a restrained emphasis change without changing
    // the physical structure or tinting unrelated parts of another case.
    const material = createSpecimenMaterial(b.pop, { color, role, ink: '#6f796c', hatch, shade: .075, spacing: 2.9, seed: 483 });
    material.side = T.DoubleSide;
    if (own) material.userData.recoveryOwned = true;
    return material;
  };
  const geometry = (data: RecoveryMeshData, dynamic = false) => {
    const positions: number[] = [];
    for (let i = 0; i < data.positions.length; i += 3) positions.push(...p(data.positions.slice(i, i + 3) as RecoveryPoint));
    const result = new T.BufferGeometry(), position = new T.Float32BufferAttribute(positions, 3);
    if (dynamic) position.setUsage(T.DynamicDrawUsage);
    result.setAttribute('position', position); result.setIndex(data.indices); result.computeVertexNormals(); return result;
  };
  const solid = (data: RecoveryMeshData, color: string, name: string, caseIndex?: RecoveryCase, dynamic = false) => {
    const mesh = role(b.mesh(geometry(data, dynamic), color, false), name, caseIndex);
    const finish=name==='ground-base'?'land':/concrete|masonry|roofs?|walls/.test(name)?'rock':name==='planted-crowns'?'plant':/crate-bindings|support-frame/.test(name)?'steel':/supply-crates|platform/.test(name)?'wood':/windows/.test(name)?'enamel':undefined;
    mesh.material=paper(color,true,.055,finish);
    if(name==='ground-base')applyEarthScan(mesh.material,caseIndex===0?'alluvium':'turf',13*scale);
    mesh.material.flatShading=/housing|service|supply|crate|concrete|masonry|canopy|square|street/.test(name);
    if(name==='planted-crowns')applyEarthScan(mesh.material,'turf',6.3*scale);
    if(/concrete|masonry/.test(name))applyEarthScan(mesh.material,'outcrop',9.5*scale);
    return mesh;
  };
  const scenes = RECOVERY_PARTS.map((parts, caseIndex) => parts.map(definition => {
    const mesh = solid(definition.mesh, definition.color, definition.role, caseIndex as RecoveryCase);
    mesh.userData.recoveryPartId = definition.id; mesh.userData.recoveryStage = definition.stage;
    return { definition, mesh };
  }));
  // The thin connections have no arrowheads. They reveal supporting
  // relationships rather than prescribe a rescue or evacuation route.
  const links = RECOVERY_LINKS.map((definitions, caseIndex) => definitions.map(definition => {
    const mesh = solid(recoveryLinkMesh(definition, 1), definition.color, 'support-relationship', caseIndex as RecoveryCase, true);
    mesh.userData.recoveryLinkId = definition.id; mesh.userData.relationshipIsRoute = false;
    return { definition, mesh };
  }));
  const labels = RECOVERY_STOPS.map((stops, caseIndex) => stops.map((stop, stage) => {
    const mesh = role(b.label(stop.label, p(recoveryPlateAt), 39.4 * scale, 9.1 * scale,{appearance:'engraved'}), 'current-observation-label', caseIndex as RecoveryCase);
    mesh.userData.recoveryStage = stage; mesh.userData.labelMount='surface'; return mesh;
  }));
  const track: PhaseTrack = { start: p(L.track.start), end: p(L.track.end) };
  const rail = solid(recoveryBox([50, -9, 83], [76, .22, .42]), '#afa184', 'phase-rail');
  rail.userData.modelInput = { kind: 'phase-track', track, label: '拖动纸签，连续观察当前独立案例' };
  const tab = new T.Shape();
  [[-3.1, 2.2], [3.1, 2.2], [3.1, -.6], [0, -2.8], [-3.1, -.6]].forEach(([x, y], i) =>
    i ? tab.lineTo(x * scale, y * scale) : tab.moveTo(x * scale, y * scale));
  tab.closePath(); const tabGeometry = new T.ExtrudeGeometry(tab, { depth: .65 * scale, bevelEnabled: false }); tabGeometry.translate(0, 0, -.325 * scale);
  const handle = role(b.mesh(tabGeometry, '#d6c18e', false), 'phase-handle'); handle.material = paper('#d6c18e');
  handle.userData.smallPointTarget = true;
  handle.userData.modelInput = { kind: 'phase-track', track, label: '拖动当前案例的观察纸签，不改变案例' };
  const latch=solid(recoveryBox([90,-8.3,81],[4.8,1.8,4.2]),'#a89164','case-latch');
  latch.userData.smallPointTarget=true;
  latch.userData.modelInput={kind:'select',selection:1,toggleTo:0,keepPhase:true,label:'拨动案例卡座，对照玉树与北川'};
  const extra=recoveryMiniatures(b,scale,p([0,0,0]));
  extra.forEach((parts,i)=>parts.forEach(m=>{role(m,'case-detail',i as RecoveryCase);}));
  const turnWheel=recoveryCabinet(b,scale,p);
  const fixedMeshCount = b.meshes.length, buffers = b.meshes.map(mesh => mesh.geometry.attributes.position.array);
  let state = evaluateRecovery(0, 0), previous = '', colorCache = new Map<string, any>();
  const tint = (mesh: any, color: string, emphasis: number) => {
    if (!colorCache.has(color)) colorCache.set(color, new T.Color(color));
    mesh.material.color.copy(colorCache.get(color)).lerp(new T.Color('#f3edda'), .10 * (1 - emphasis));
  };
  const motion: ModelMotion = {
    update(phase, selection) {
      const next = evaluateRecovery(phase, selection), key = `${next.selection}:${next.phase}`;
      if (key !== previous) {
        state = next; previous = key;
        turnWheel(state.phase,state.selection,state.focusPoint);
        extra.forEach((parts,i)=>parts.forEach(m=>{m.visible=i===state.selection;}));
        scenes.forEach((parts, caseIndex) => parts.forEach(({ definition, mesh }) => {
          mesh.visible = caseIndex === state.selection;
          tint(mesh, definition.color, definition.stage < 0 ? 1 : caseIndex === state.selection ? state.emphasis[definition.stage] : 0);
        }));
        links.forEach((entries, caseIndex) => entries.forEach(({ definition, mesh }) => {
          const reveal = caseIndex === state.selection ? state.links.find(link => link.id === definition.id)?.reveal ?? 0 : 0;
          mesh.visible = caseIndex === state.selection && reveal > .003; mesh.userData.recoveryReveal = reveal;
          const data = recoveryLinkMesh(definition, reveal), position = mesh.geometry.attributes.position;
          for (let i = 0; i < data.positions.length; i += 3) position.setXYZ(i / 3, ...p(data.positions.slice(i, i + 3) as RecoveryPoint));
          position.needsUpdate = true; mesh.geometry.computeVertexNormals();
        }));
        labels.forEach((entries, caseIndex) => entries.forEach((mesh, stage) => { mesh.visible = caseIndex === state.selection && stage === state.stageIndex; }));
        handle.position.set(...phaseTrackPoint(state.phase, track));
      }
      // Sparse edge work preserves the original engraved paper vocabulary.
      for (const { mesh, definition } of scenes[state.selection]) {
        if (mesh.userData.modelHovered) b.outline(mesh, .52);
        else if (['ground-base', 'concrete-remnant', 'housing-roofs', 'life-service-roof', 'medical-canopy', 'open-square'].includes(definition.role)) b.outline(mesh, definition.role === 'ground-base' ? .32 : .24);
      }
      const focus = state.focusPoint;
      // A short bracket connects the current caption to its object. It is an
      // annotation, not a traffic line or a suggested path through rubble.
      const labelEdge: RecoveryPoint = [L.label[0], L.label[1] - 6, L.label[2]];
      b.contour([p(labelEdge), p([focus[0], Math.max(focus[1] + 5, 27), focus[2]]), p(focus)], .22);
      b.contour([track.start, track.end], .24); b.outline(handle, handle.userData.modelHovered ? .63 : .38);
      for (const stop of RECOVERY_STOPS[state.selection]) {
        const at = phaseTrackPoint(stop.phase, track);
        b.contour([[at[0], at[1] - .7 * scale, at[2]], [at[0], at[1] + .7 * scale, at[2]]], .28);
      }
    },
    focusBounds: () => ({ min: p(L.bounds.min), max: p([L.bounds.max[0],34,L.bounds.max[2]]) }),
    describe: () => {
      b.root.updateWorldMatrix(true, true);
      const world = (point: Vec3): Vec3 => b.v(point).applyMatrix4(b.root.matrixWorld).toArray() as Vec3;
      const nodeWorld = state.nodes.map(node => ({ ...node, point: world(p(node.point)) }));
      return { kind: 'independent-recovery-cases', ...recoveryDiagnostics(state), state: recoveryDiagnostics(state),
        elevatedAbovePage: rise, source: state.source, originalPagePreserved: true,
        fixedFocusBounds: true, fixedMeshCount, geometryBuffersReused: b.meshes.length === fixedMeshCount && b.meshes.every((mesh, i) => mesh.geometry.attributes.position.array === buffers[i]),
        nodeWorld, targetWorld: nodeWorld, focusWorld: world(p(state.focusPoint)),
        labelWorld: { text: state.label.text, point: world(p(recoveryPlateAt)), width: 39.4 * scale, height: 9.1 * scale },
        handleWorld: handle.getWorldPosition(new T.Vector3()).toArray(), phaseTrack: track,
        phaseTrackWorld: { start: world(track.start), end: world(track.end) },
        activeMeshCount: meshes.filter(mesh => mesh.visible).length,
        actualActiveParts: scenes[state.selection].map(({ definition, mesh }) => ({ id: definition.id, role: definition.role,
          caseIndex: mesh.userData.recoveryCase, selection: mesh.userData.modelInput?.selection, mesh: mesh.uuid,
          point: new T.Box3().setFromObject(mesh).getCenter(new T.Vector3()).toArray() })),
        linkWorld: links[state.selection].map(({ definition, mesh }) => ({ id: definition.id, reveal: mesh.userData.recoveryReveal,
          route: false, start: world(p(definition.path[0])), end: world(p(definition.path.at(-1)!)), visible: mesh.visible })),
        directInteraction: 'independent-case-solids-and-stable-phase-track',
      };
    },
  };
  motion.update(0, 0, 0, true); return motion;
}
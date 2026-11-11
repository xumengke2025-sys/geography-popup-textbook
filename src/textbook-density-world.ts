import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { chamferedPlateGeometry, createInstrumentParts, mergeInstrumentGeometry, turnedShaftGeometry } from './textbook-instrument-parts';
import type { SolidMaterialRole } from './textbook-solid-materials';
import { DENSITY_INSTRUMENT as D, densityInstrumentPose } from './textbook-density-instrument';

/** A working equal-volume comparator. The open sample windows, suspended
 * pans and bearing-supported beam are geometry; no textbook image is used. */
export function buildDensityInstrumentWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, back = -LIFT_MARGIN - 56 * s;
  const root = new T.Group(); root.name = 'equal-volume-density-instrument';
  root.position.z = back; root.scale.setScalar(s); b.root.add(root);
  const colors = { brass: '#a88b50', steel: '#929b98', wood: '#65503b', enamel: '#344841', ivory: '#e8e1cd', water: '#719da7' };
  const groups = { beam: new T.Group(), pans: [new T.Group(), new T.Group()] };
  const mesh = (geometry: any, role: SolidMaterialRole, name: string, parent: any = root, color?: string) => {
    const object = b.mesh(geometry, color ?? colors[role as keyof typeof colors], false, true, role);
    parent.add(object); object.name = name; object.userData.densityPart = name; return object;
  };
  const plate = (at: Vec3, size: Vec3, role: SolidMaterialRole, name: string, parent = root, bevel = .2) =>
    mesh(chamferedPlateGeometry(at.map((v, i) => v - size[i] / 2) as Vec3,
      at.map((v, i) => v + size[i] / 2) as Vec3, bevel), role, name, parent);
  const shaft = (a: Vec3, c: Vec3, radius: number, role: SolidMaterialRole, name: string, parent = root) =>
    mesh(turnedShaftGeometry(a, c, [[radius, 0], [radius, 1]]), role, name, parent);
  const ring = (at: Vec3, radius: number, tube: number, role: SolidMaterialRole, name: string, parent = root, vertical = false) => {
    const geometry = new T.TorusGeometry(radius, tube, 7, 48);
    if (!vertical) geometry.rotateX(Math.PI / 2); geometry.translate(...at);
    return mesh(geometry, role, name, parent);
  };
  const insetPlaque = (text: string, x: number) => {
    plate([x, 5.10, 28.45], [10.2, .22, 3.8], 'brass', 'selector-inset-plaque', root, .12);
    // The inscription is fixed to the casting, not a camera-facing paper
    // label. Its local texture is only type; every instrument part is solid.
    let texture: any;
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas'); canvas.width = 408; canvas.height = 128;
      const c = canvas.getContext('2d')!;
      c.fillStyle = colors.brass; c.fillRect(0, 0, 408, 128);
      c.fillStyle = '#29332d'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = "500 76px FieldSans, 'Microsoft YaHei', sans-serif"; c.fillText(text, 204, 68);
      texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 8;
    }
    const geometry = new T.PlaneGeometry(9.6, 3.2); geometry.rotateX(-Math.PI / 2); geometry.translate(x, 5.23, 28.45);
    const inscription = mesh(geometry, 'brass', 'fixed-selector-inscription');
    const material = new T.MeshStandardMaterial({ map: texture, color: '#ffffff', roughness: .68, metalness: .22 });
    inscription.material = material; inscription.userData.text = text;
    geometry.addEventListener('dispose', () => { texture?.dispose(); material.dispose(); });
    return inscription;
  };

  // One low balance chassis, with an inset enamel casting and actual turned
  // feet. It belongs to the instrument instead of enclosing the whole scene.
  plate([50, 1.5, 17], [91, 3, 31], 'wood', 'rounded-timber-foot', root, .55);
  plate([50, 3.4, 17], [87, .8, 27.5], 'brass', 'fine-chassis-edge');
  plate([50, 4.4, 17], [85, 1.2, 25.6], 'enamel', 'cast-chassis');
  for (const x of [10, 90]) for (const z of [7, 27]) {
    mesh(turnedShaftGeometry([x, -1.6, z], [x, .15, z], [[1.9, 0], [2.1, .18], [2.1, .38], [1.45, .55], [1.45, 1]]), 'brass', 'levelling-foot');
  }
  plate([50, 5.4, 17], [17, 1.2, 14], 'brass', 'column-bolted-flange');
  mesh(turnedShaftGeometry([50, 6, 17], [50, 50, 17], [[5.8, 0], [5.8, .04], [3.8, .10], [3.1, .22], [2.45, .83], [3.3, .91], [3.3, 1]]), 'enamel', 'tapered-pivot-column');
  mesh(turnedShaftGeometry([50, 7, 17], [50, 10.5, 17], [[4.4, 0], [4.4, .18], [3.5, .28], [3.5, .78], [4, 1]]), 'brass', 'column-lower-collar');
  // Rear and front fork cheeks visibly carry the beam's transverse axle.
  for (const z of [12.5, 21.5]) {
    plate([50, 50.8, z], [10.4, 6.6, 2.4], 'enamel', 'pivot-fork');
    mesh(turnedShaftGeometry([50, 54, z - 1.5], [50, 54, z + 1.5], [[2.7, 0], [2.9, .14], [2.9, .32], [2.1, .42], [2.1, .65], [2.7, .79], [2.7, 1]]), 'brass', 'pivot-bearing');
  }
  shaft([50, 54, 10], [50, 54, 24], .8, 'steel', 'continuous-transverse-axle');
  const hardware = createInstrumentParts(b, root);
  hardware.fasteners([[44.3, 6.1, 12], [55.7, 6.1, 12], [44.3, 6.1, 22], [55.7, 6.1, 22]], [0, 1, 0], .45);

  // A pierced cast beam has actual holes and a raised spine. Small rounded
  // arm ends meet the hanger eyes; no decorative gear is added to the lesson.
  const beamShape = new T.Shape();
  const outline = [[-33.6, 0], [-30, 2.4], [-8, 3.5], [-4, 5.1], [4, 5.1], [8, 3.5], [30, 2.4], [33.6, 0], [30, -2.4], [7, -1.8], [3, -3.5], [-3, -3.5], [-7, -1.8], [-30, -2.4]];
  outline.forEach(([x, y], i) => i ? beamShape.lineTo(x, y) : beamShape.moveTo(x, y)); beamShape.closePath();
  for (const side of [-1, 1]) {
    const hole = new T.Path(), points = [[side * 9, .05], [side * 9, 2], [side * 26.3, 1.35], [side * 26.3, -.45]];
    points.forEach(([x, y], i) => i ? hole.lineTo(x, y) : hole.moveTo(x, y)); hole.closePath(); beamShape.holes.push(hole);
  }
  const beamGeo = new T.ExtrudeGeometry(beamShape, { depth: 2.5, bevelEnabled: true, bevelSize: .18, bevelThickness: .18, bevelSegments: 2, curveSegments: 1 }); beamGeo.translate(0, 0, -1.25);
  root.add(groups.beam); groups.beam.position.set(...D.pivot);
  mesh(beamGeo, 'brass', 'pierced-balance-beam', groups.beam);
  shaft([-30, 2.45, 0], [30, 2.45, 0], .26, 'steel', 'beam-spine', groups.beam);
  for (const side of [-1, 1]) {
    mesh(turnedShaftGeometry([side * D.arm, 0, -2.4], [side * D.arm, 0, 2.4], [[1.8, 0], [1.8, .18], [1.15, .28], [1.15, .74], [1.8, .84], [1.8, 1]]), 'steel', 'hanger-cross-pin', groups.beam);
  }

  // The pointer is mechanically owned by the beam, while its zero reference
  // is fixed to the column. Unnumbered marks do not pretend to measure grams.
  const zeroShape = new T.Shape(); zeroShape.absarc(0, 0, 12, Math.PI * 1.34, Math.PI * 1.66, false);
  zeroShape.absarc(0, 0, 8.6, Math.PI * 1.66, Math.PI * 1.34, true); zeroShape.closePath();
  const zeroGeo = new T.ExtrudeGeometry(zeroShape, { depth: .6, bevelEnabled: true, bevelSize: .12, bevelThickness: .12, bevelSegments: 1 }); zeroGeo.translate(50, 54, 24.6);
  mesh(zeroGeo, 'ivory', 'fixed-zero-reference');
  const marks: any[] = [];
  for (let i = -4; i <= 4; i++) {
    const a = Math.PI * 1.5 + i * .065, r0 = i ? 10.0 : 9;
    marks.push(turnedShaftGeometry([50 + Math.cos(a) * r0, 54 + Math.sin(a) * r0, 25.4], [50 + Math.cos(a) * 11.4, 54 + Math.sin(a) * 11.4, 25.4], [[i ? .055 : .095, 0], [i ? .055 : .095, 1]]));
  }
  mesh(mergeInstrumentGeometry(marks), 'steel', 'unnumbered-balance-divisions');
  shaft([0, -.8, 8.9], [0, -10.1, 8.9], .12, 'steel', 'beam-owned-pointer', groups.beam);
  ring([0, 0, 8.9], 1.15, .22, 'brass', 'pointer-hub', groups.beam, true);

  const panData = groups.pans.map((pan, index) => {
    root.add(pan); pan.name = `plumb-sample-${index}`;
    // Three slender real rods converge at the transverse hanger pin. They
    // form a rigid three-point cradle instead of screen-drawn contour lines.
    const hangerTop: Vec3 = [0, D.suspension, 0];
    const rods: any[] = [];
    for (const a of [Math.PI / 2, Math.PI * 7 / 6, Math.PI * 11 / 6]) {
      const foot: Vec3 = [Math.cos(a) * 8.5, 1.35, Math.sin(a) * 8.5];
      rods.push(turnedShaftGeometry(hangerTop, foot, [[.23, 0], [.23, 1]]));
      mesh(turnedShaftGeometry([foot[0], .55, foot[2]], [foot[0], 2.25, foot[2]], [[.53, 0], [.53, .18], [.35, .4], [.35, .8], [.5, 1]]), 'brass', 'pan-suspension-socket', pan);
    }
    mesh(mergeInstrumentGeometry(rods), 'steel', 'three-point-suspension', pan);
    ring([0, 1.05, 0], D.panRadius, .42, 'brass', 'rolled-pan-edge', pan);
    mesh(turnedShaftGeometry([0, .1, 0], [0, .9, 0], [[8.6, 0], [9.2, .35], [9.2, .7], [8.8, 1]]), 'steel', 'rigid-weighing-pan', pan);
    // Equal laboratory cups have the same shell, rim and liquid geometry.
    // An open front section exposes the liquid; it is not a transparent wall
    // or a false filled volume that grows when density changes.
    const cupProfile = [[D.cupOuterRadius - .4, 0], [D.cupOuterRadius, .6], [D.cupOuterRadius, D.cupHeight - .5], [D.cupOuterRadius - .15, D.cupHeight], [D.cupInnerRadius, D.cupHeight], [D.cupInnerRadius, .95], [0, .95], [0, 0]];
    const cupLathe = new T.LatheGeometry(cupProfile.map(([r, y]) => new T.Vector2(r, y)), 48, Math.PI * .31, Math.PI * 1.38);
    const section = new T.Shape(); cupProfile.forEach(([r, y], i) => i ? section.lineTo(r, y) : section.moveTo(r, y)); section.closePath();
    const cutFaces = [Math.PI * .31, Math.PI * 1.69].map(angle => {
      const face = new T.ShapeGeometry(section), a = face.attributes.position;
      for (let i = 0; i < a.count; i++) { const r = a.getX(i), y = a.getY(i); a.setXYZ(i, Math.sin(angle) * r, y, Math.cos(angle) * r); }
      face.computeVertexNormals(); return face;
    });
    const cupGeo = mergeInstrumentGeometry([cupLathe, ...cutFaces]); cupGeo.translate(0, 1, 0);
    const cup = mesh(cupGeo, 'ivory', 'equal-volume-sectioned-cup', pan);
    ring([0, 1 + D.cupHeight, 0], D.cupInnerRadius + .22, .22, 'brass', 'rolled-sample-rim', pan);
    ring([0, 2.1, 0], D.cupOuterRadius + .03, .18, 'brass', 'sample-foot-ring', pan);
    const liquidGeo = new T.CylinderGeometry(D.waterRadius, D.waterRadius, D.waterHeight, 48, 1);
    liquidGeo.translate(0, 2.05 + D.waterHeight / 2, 0);
    const liquid = mesh(liquidGeo, 'water', 'fixed-volume-seawater', pan);
    liquid.userData.equalVolumeSample = index; liquid.userData.teachingVolume = Math.PI * D.waterRadius ** 2 * D.waterHeight;
    // A fine common fill-line stays at the same level in both specimens.
    ring([0, 2.05 + D.waterHeight, 0], D.cupInnerRadius - .03, .10, 'steel', 'common-fill-line', pan);
    const symbolBack = plate([0, 2.15, 10.1], [8, 4.4, .55], 'ivory', 'mass-symbol-plaque', pan, .2);
    const symbols = Array.from({ length: 13 }, (_, i) => {
      const g = new T.CylinderGeometry(.26, .26, .1, 10); g.rotateX(Math.PI / 2); g.translate(-2.4 + (i % 4) * 1.6, 3.45 - Math.floor(i / 4) * .9, 10.46);
      return mesh(g, 'steel', 'qualitative-mass-symbol', pan);
    });
    const input = index === 0 ? { kind: 'select', selection: 0, label: '恢复相同条件，比较两个等体积样本' }
      : { kind: 'select', selection: 1, toggleTo: 2, label: '对照只降温与只增盐；样本体积不变' };
    for (const object of [cup, liquid, symbolBack]) object.userData.modelInput = input;
    return { cup, liquid, symbols };
  });

  // The three controls and engraved slips are part of the existing chassis;
  // no second projecting UI shelf or hovering title surrounds the balance.
  const labels = ['对照', '降温', '增盐'];
  const choices = labels.map((text, selection) => {
    const x = 31 + selection * 19, knob = hardware.knob([x, 6.1, 23.3], [0, 1, 0], 2.1, 1.1);
    const input = { kind: 'select', selection, label: `等体积海水：${['相同条件', '只降低右侧温度', '只增加右侧盐度'][selection]}` };
    knob.traverse((object: any) => { if (object.isMesh) { object.userData.modelInput = input; object.userData.densitySelection = selection; } });
    const caption = insetPlaque(text, x); caption.userData.modelInput = input; caption.userData.densitySelection = selection;
    return knob;
  });
  const normal = b.materialFor('water', colors.water), colder = b.materialFor('water', '#618d9f');
  const fixedMeshCount = b.meshes.length, buffers = b.meshes.map(object => object.geometry.attributes.position.array);
  let state = densityInstrumentPose(0);
  return {
    update(_phase, selection) {
      state = densityInstrumentPose(selection); groups.beam.rotation.z = state.angle;
      groups.pans.forEach((pan, i) => {
        pan.position.set(...state.suspensions[i].pan); pan.rotation.set(0, 0, 0);
        panData[i].liquid.material = i === 1 && state.mode === 1 ? colder : normal;
        panData[i].symbols.forEach((symbol, j) => { symbol.visible = j < state.massTokens[i]; });
      });
      choices.forEach((choice, i) => { choice.position.y = i === state.mode ? -.32 : 0; });
    },
    focusBounds: () => ({ min: [4 * s, 0, back + 1 * s], max: [96 * s, 71 * s, back + 50 * s] }),
    describe: () => ({ kind: 'equal-volume-density', ...state, control: ['same', 'temperature-only', 'salinity-only'][state.mode],
      comparison: state.mode ? 'right-more-mass-per-same-volume' : 'equal', pressureHeldEqual: true, numericDensity: false,
      instrument: { kind: 'suspended-equal-volume-comparator', transversePivot: true, piercedBeam: true, realThreePointHangers: true,
        uprightSamplePans: true, cupGeometryIdentical: true, samplesAreFrontSectioned: true, massSymbolsAreNotSaltGrains: true,
        sampleScales: panData.map(sample => sample.liquid.scale.toArray()), panAngles: groups.pans.map(pan => pan.rotation.z),
        beamAngle: groups.beam.rotation.z, endpointAnchors: state.suspensions.map(hanger => hanger.anchor),
        fixedMeshCount: b.meshes.length === fixedMeshCount, buffersStable: b.meshes.every((object, i) => object.geometry.attributes.position.array === buffers[i]) } }),
  };
}

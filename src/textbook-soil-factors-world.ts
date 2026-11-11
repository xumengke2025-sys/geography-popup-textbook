import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { buildSoilSortingWorld } from './textbook-soil-sorting-world';
import { evaluateSoilTransferDetail } from './textbook-soil-transfer-detail-model';
import { createInstrumentParts } from './textbook-instrument-parts';
import { phaseTrackPoint } from './textbook-model-input';
import type { SolidMaterialRole } from './textbook-solid-materials';
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
    mesh.userData.modelInput = { kind: 'replay', selection,
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
  const layer = (level: number, color: string, material: SolidMaterialRole) => {
    const nx = 42, nz = 10, ny = 7, coords: { u: number; v: number; f: number; front: boolean }[] = [], indices: number[] = [];
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
      const grain = noise(v.u * 39 + level * 7, v.f * 13 + v.v * 17), shade = .94 + grain * .1;
      colors.set([base.r * shade, base.g * shade, base.b * shade], i * 3);
    });
    g.setAttribute('position', attr); g.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); g.setIndex(indices);
    const mesh = solid(g, color, material, ['bedrock-monolith', 'weathered-parent-material', 'mineral-soil', 'organic-horizon'][level]);
    // Material.clone discards onBeforeCompile, breaking the shared reveal alpha.
    // Register this finish with the same Popout lifecycle as every other solid.
    mesh.material = createSoilSpecimenFinish(b.pop, '#ffffff', level, s);
    mesh.material.vertexColors = true;
    input(mesh, level < 2 ? 0 : level === 3 ? 1 : 3);
    const update = () => {
      coords.forEach((v, i) => {
        const u = xAt(v.u, v.v), vv = .21 + .69 * v.v + (.012 * Math.sin(v.u * 16.1) + .006 * Math.sin(v.u * 35)) * Math.pow(Math.abs(v.v - .5) * 2, 3);
        const a = boundary(level, u, vv), c = boundary(level + 1, u, vv), h = a + (c - a) * v.f;
        const point = p(u, vv, h);
        if (v.front) point[2] += (noise(v.u * 29 + level * 3, v.f * 9) - .5) * .35 * s * Math.sin(v.f * Math.PI) * Math.sin(v.u * Math.PI);
        attr.setXYZ(i, ...point);
      });
      attr.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
    };
    update(); return { mesh, update };
  };
  const layers = [layer(0, '#97958b', 'rock'), layer(1, '#b6a07d', 'land'), layer(2, '#997349', 'land'), layer(3, '#504333', 'land')];
  // Broken parent-material lips at the exposed upper weathering zone. The old
  // full-height extruded wall hid the section and read as a second grey slab.
  const weatheringShape = new T.Shape(); weatheringShape.moveTo(0, 0); weatheringShape.lineTo(72 * s, 0);
  for (let i = 72; i >= 0; i--) { const x = i; weatheringShape.lineTo(x * s, (.9 + .55 * noise(x * .87, 2) + .9 * Math.pow(Math.max(0, Math.sin(x * .57)), 3)) * s); }
  weatheringShape.closePath();
  const weatheringGeometry = new T.ExtrudeGeometry(weatheringShape, { depth: 1.0 * s, bevelEnabled: true, bevelSize: .11 * s, bevelThickness: .1 * s, bevelSegments: 1 });
  const weatheringFront = input(solid(weatheringGeometry, '#969384', 'rock', 'attached-weathering-front'), 0); weatheringFront.position.set(...p(.14, .88, 13.9)); weatheringFront.scale.x = sectionWidth;
  // Organic matter belongs to the very same upper surface and stem. Roots
  // emerge continuously into the visible cut, then branch inside the soil.
  const plant = new T.Group(); b.root.add(plant);
  const plantStart = b.meshes.length;
  const stemPath: Vec3[] = [[0, 0, 0], [.2 * s, 3 * s, 0], [-.45 * s, 7 * s, .2 * s], [.3 * s, 10.9 * s, 0]];
  const stem = solid(new T.TubeGeometry(new T.CatmullRomCurve3(stemPath.map(v => new T.Vector3(...v))), 20, .23 * s, 7, false), '#6e7551', 'plant', 'retained-plant-stem');
  plant.add(stem);
  for (let i = 0; i < 6; i++) {
    const sign = i % 2 ? 1 : -1, h = 3.2 + Math.floor(i / 2) * 2.5, shape = new T.Shape();
    shape.moveTo(0, 0); shape.bezierCurveTo(1.1 * s, .9 * s, 3.1 * s, .9 * s, 4 * s, 0); shape.bezierCurveTo(2.7 * s, -.8 * s, 1.2 * s, -.55 * s, 0, 0);
    const leaf = input(solid(new T.ExtrudeGeometry(shape, { depth: .11 * s, bevelEnabled: true, bevelSize: .06 * s, bevelThickness: .04 * s, bevelSegments: 1 }), i % 3 ? '#7c8959' : '#92996d', 'plant', 'connected-leaf'), 1);
    leaf.rotation.z = sign < 0 ? Math.PI - .3 : .3; leaf.position.set(0, h * s, .1 * s); plant.add(leaf);
  }
  const plantMembers = b.meshes.slice(plantStart);
  const rootMeshes = [-1, 0, 1].flatMap((sign, i) => {
    const controls: Vec3[] = [p(.5, .55, 20), p(.5 + sign * .025, .72, 18.7), p(.5 + sign * .075, .908, 16), p(.5 + sign * .12, .912, 12.4)];
    const out: any[] = [];
    const add = (points: Vec3[], radius: number) => { const mesh = input(solid(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(v => new T.Vector3(...v))), 24, radius * s, 6, false), '#716d4f', 'plant', 'continuous-profile-root'), 1); out.push(mesh); };
    add(controls, .19);
    for (let j = 0; j < 2; j++) {
      const u = .5 + sign * .075 + (j ? -.04 : .035), h = 16 - j * 1.5;
      add([p(.5 + sign * .075, .91, h + .4), p(u, .914, h - 1), p(u + sign * .025, .916, h - 2.2)], .085);
    }
    return out;
  });
  const markerGeometry = new T.IcosahedronGeometry(1.1 * s, 0);
  const markers = Array.from({ length: 12 }, (_, id) => {
    const mesh = solid(markerGeometry, '#8c805e', 'land', 'same-identity-transfer-marker'); mesh.userData.soilPacketId = id; return mesh;
  });
  const litterGeometry = (() => { const shape = new T.Shape(); shape.moveTo(-1.7 * s, 0); shape.quadraticCurveTo(.1 * s, 1 * s, 1.7 * s, .05 * s); shape.quadraticCurveTo(.1 * s, -.8 * s, -1.7 * s, 0); return new T.ExtrudeGeometry(shape, { depth: .18 * s, bevelEnabled: false, curveSegments: 7 }); })();
  const lenses = Array.from({ length: 6 }, () => {
    const mesh = solid(new T.SphereGeometry(1, 16, 7), '#bda579', 'land', 'retained-receiving-lens'); return mesh;
  });
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
  // Selectors seat in the tray's projecting front apron. The rail brackets
  // return to that same apron, rather than an unrelated second plinth.
  role(parts.casting(p(.135, .97, -1.57), p(.865, 1.12, -.2), 'steel'), 'front-controls-contact-shelf');
  for (let i = 0; i < 4; i++) {
    const u = .23 + i * .18, z = p(0, 1.15)[2], x = p(u, 0)[0];
    const panel = role(parts.casting([x - 7.1 * s, -2.7 * s * sectionHeight, z - .8 * s], [x + 7.1 * s, .6 * s * sectionHeight, z + .1 * s], 'brass'), 'factor-selector-body'); input(panel, i);
    const face = input(solid(new T.BoxGeometry(13.2 * s, 2.8 * s * sectionHeight, .22 * s), '#e3ddc9', 'ivory', 'factor-selector-inset'), i); face.position.set(x, -1.0 * s * sectionHeight, z + .24 * s);
    const text = input(b.label(['母质','生物','气候','时间'][i], [x, -.94 * s * sectionHeight, z + .41 * s], 12 * s, 3.8 * s, { appearance: 'engraved' }), i); role(text, 'inset-factor-text'); text.userData.labelMount = 'surface';
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
  const count = owned.length;
  return { update(phase, n, dt, reduced) {
    selection = Math.max(0, Math.min(4, Math.round(n)));
    for (const mesh of owned) mesh.visible = selection !== 4;
    sorting.update(phase, selection, dt, reduced); if (selection === 4) return;
    state = evaluateSoilTransferDetail(phase, selection); soilDepth = state.soilDepth;
    if (soilDepth !== previousDepth) { layers.forEach(v => v.update()); previousDepth = soilDepth; }
    weatheringFront.visible = selection === 0;
    weatheringFront.scale.y = sectionHeight * (1 - .76 * state.particles.reduce((sum, packet) => sum + packet.travel, 0) / 12);
    const surface = boundary(4, .5, .55); plant.position.set(...p(.5, .55, surface));
    const rootScale = (soilDepth + 6) / 12;
    rootMeshes.forEach(mesh => { mesh.scale.y = rootScale; mesh.position.y = (surface - 20 * rootScale) * s * sectionHeight; });
    plantMembers.forEach(mesh => { mesh.visible = true; });
    markers.forEach((mesh, i) => {
      const packet = state.particles[i]; mesh.visible = selection < 3; mesh.position.set(...p(packet.u, packet.v, packet.h));
      mesh.position.z += .7 * s; mesh.userData.soilTransferStage = packet.stage;
      const leaf = selection === 1;
      if (mesh.userData.leafMarker !== leaf) { mesh.geometry = leaf ? litterGeometry : markerGeometry; mesh.userData.leafMarker = leaf; }
      mesh.scale.set(leaf ? 1 : selection === 2 ? .6 : 1.15, leaf ? 1 : selection === 2 ? .57 : .8, leaf ? .8 : .85);
      mesh.rotation.set(leaf ? .18 : i * .71, leaf ? packet.travel * .5 : i * .13, leaf ? packet.travel + i * .2 : i * .33);
      mesh.material = b.materialFor ? b.materialFor(leaf ? 'plant' : 'land', leaf ? packet.arrived ? '#76684b' : '#a9945f' : selection === 2 ? '#b59c64' : '#94856b') : b.material(leaf ? '#a9945f' : '#94856b');
    });
    lenses.forEach((mesh, i) => {
      const lens = state.receiverPatches[i]; mesh.visible = selection < 3 && lens.amount > .004;
      mesh.position.set(...p(lens.u, .936, lens.base + lens.amount * lens.growth * .45));
      mesh.scale.set(4.5 * s, Math.max(.015, lens.amount * lens.growth * .52) * s, .42 * s);
      mesh.material = b.materialFor ? b.materialFor('land', selection === 0 ? '#c4ae84' : selection === 1 ? '#635f43' : '#b29b69') : b.material('#b29b69');
      input(mesh, selection < 3 ? selection : 0);
    });
    climateMembers.forEach(mesh => { mesh.visible = selection === 2; });
    heatHead.visible = selection === 2;
    handle.position.set(...phaseTrackPoint(state.phase, track));
    selectorMeshes.forEach((mesh, i) => { mesh.material = b.materialFor ? b.materialFor('ivory', selection === i ? '#eee7d1' : '#c5c0ad') : b.material('#e3ddc9'); });
    if (selection === 2) {
      if (state.water.rain) for (let i = 0; i < 4; i++) b.trace([p(.18 + i * .045, .38, 32), p(.18 + i * .045, .38, 32 - (32 - surface) * state.water.rainReach)], phase + i * .13, 2);
      if (state.water.active) for (let i = 0; i < 3; i++) b.trace([p(.66 + i * .07, .927, surface), p(.66 + i * .07, .927, state.water.front)], phase + i * .17, 2, 'flow', 1, .65);
    }
  }, focusBounds: () => selection === 4 ? sorting.focusBounds!() : ({ min: p(.07, .12, -6), max: p(.93, 1.23, selection === 2 ? 45 : 37) }),
  describe: () => ({ kind: 'soil-forming-factors', construction: 'continuous-closed-contact-specimen', factor: ['parent-material','biological-cycle','climate','time','relief-sorting'][selection],
    ...(selection === 4 ? { sorting: sorting.describe!() } : { provenance: state }), soilDepth: 'illustrative-not-centimetres', organicMatterViaBiology: true, hotWetIsNotAutomaticallyFertile: true,
    growthIsNotAChronometer: true, factorsAreIndependent: true, climateRigIsTeachingAnalogy: true, connectedNaturalContacts: true, nativeControlsOnSpecimen: true, ownMeshes: count, sharedSortingUnmodified: true, buffersStable: true }) };
}

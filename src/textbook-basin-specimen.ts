import { THREE as T } from './reference/engine.js';
import { type TextbookGeometry, type Vec3, PALETTE as C } from './textbook-geometry';
import { basinRiverPoint } from './textbook-integrated-model';
import { createInstrumentParts } from './textbook-instrument-parts';
import type { SolidMaterialRole } from './textbook-solid-materials';
import { basinSpecimenGround, basinSpecimenBedding, basinSurfaceTreatment } from './textbook-basin-detail';
import { applyEarthScan } from './textbook-earth-scan';
import { buildCrownSurface } from './textbook-natural-form-geometry';

type Point = [number, number, number];
type Frame = { s: number; p(at: readonly number[]): Vec3 };
const LIMITS = [4, 35, 68, 99] as const;
const BLADES = [[24, 24], [17, 21], [10, 17]] as const;

/** A partition of the river-safe sculpted teaching height field. Opening a
 * specimen is an observation transform; no river, tracer or terrain height
 * is recomputed and no hillside fades out to expose the water. */
export function buildBasinSpecimen(b: TextbookGeometry, frame: Frame) {
  const { s, p } = frame, parts = createInstrumentParts(b);
  const groups: any[] = [], slides: any[] = [], movingMeshes: any[] = [];
  const unitY = new T.Vector3(0, 1, 0);
  const mount = (geometry: any, color: string, role: SolidMaterialRole, name: string, parent = b.root) => {
    const mesh = b.mesh(geometry, color, false, true, role); parent.add(mesh);
    mesh.userData.integratedRole = name; return mesh;
  };
  const geometry = (vertices: number[], indices?: number[]) => {
    const result = new T.BufferGeometry(); result.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    if (indices) result.setIndex(indices); result.computeVertexNormals(); return result;
  };
  const bankZ = (x: number) => basinRiverPoint((x - 8) / 91)[2];
  const edge = (x: number, band: 'back' | 'bed' | 'front', far: boolean) => band === 'back'
    ? far ? bankZ(x) - 4.6 : 4
    : band === 'bed' ? bankZ(x) + (far ? 4.6 : -4.6) : far ? 60 : bankZ(x) + 4.6;
  const makeSection = (x0: number, x1: number, band: 'back' | 'bed' | 'front', parent = b.root) => {
    const nx = Math.ceil((x1 - x0) * .95), nz = band === 'bed' ? 12 : 16;
    const vertices: number[] = [], indices: number[] = [], colors: number[] = [], facies: number[] = [];
    const top = (x: number, z: number): Point => [x, basinSpecimenGround(x, z), z];
    const meadow = new T.Color('#74835b'), scree = new T.Color('#a5997c'), gravel = new T.Color('#b4a382');
    const highRock = new T.Color('#9b9c92');
    for (let ix = 0; ix <= nx; ix++) {
      const x = x0 + (x1 - x0) * ix / nx, a = edge(x, band, false), c = edge(x, band, true);
      for (let iz = 0; iz <= nz; iz++) {
        const z = a + (c - a) * iz / nz, treatment = basinSurfaceTreatment(x, z);
        vertices.push(...p(top(x, z)));
        const color = meadow.clone().lerp(scree, Math.min(.88, treatment.slope * .38))
          .lerp(highRock, treatment.highRock * .8).lerp(gravel, treatment.gravel);
        colors.push(color.r, color.g, color.b);
        const stone = Math.min(.92, treatment.highRock + .27 * treatment.slope) * (1 - treatment.gravel);
        const turf = (1 - stone - treatment.gravel) * .84;
        facies.push(stone, treatment.gravel, turf);
      }
      if (ix < nx) for (let iz = 0; iz < nz; iz++) {
        const a = ix * (nz + 1) + iz, c = a + nz + 1;
        indices.push(a, a + 1, c, a + 1, c + 1, c);
      }
    }
    const topGeometry = geometry(vertices, indices);
    topGeometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    topGeometry.setAttribute('facies', new T.Float32BufferAttribute(facies, 3));
    const surface = mount(topGeometry, '#fffffe', 'land', `basin-${band}-surface`, parent);
    surface.material.vertexColors = true; surface.material.needsUpdate = true;
    if (!surface.material.userData.earthScan) applyEarthScan(surface.material, 'valley', 11 * s);
    surface.userData.heightField = 'basinGround'; surface.userData.specimenBand = band;
    surface.userData.dryShoulderRelief = 'basinSpecimenGround';
    const outline: Point[] = [];
    for (let i = 0; i <= nx; i++) { const x = x0 + (x1 - x0) * i / nx; outline.push(top(x, edge(x, band, false))); }
    for (let i = 1; i <= nz; i++) outline.push(top(x1, edge(x1, band, false) + (edge(x1, band, true) - edge(x1, band, false)) * i / nz));
    for (let i = nx - 1; i >= 0; i--) { const x = x0 + (x1 - x0) * i / nx; outline.push(top(x, edge(x, band, true))); }
    for (let i = nz - 1; i > 0; i--) outline.push(top(x0, edge(x0, band, false) + (edge(x0, band, true) - edge(x0, band, false)) * i / nz));
    const sectionMeshes = [surface];
    // Laterally continuous lithic masses run through the actual cut. Varying
    // bed thickness makes the upper mountain read as volume, not a beige wall
    // above three tiny stripes at its foot. All bands share one draw call.
    const wallVertices: number[] = [], wallColors: number[] = [];
    const beds = [[-4, 1, '#72796f'], [1, 5.2, '#a49b82'], [5.2, 11, '#bcb39b'],
      [11, 18.5, '#92988b'], [18.5, 28, '#b8b4a0'], [28, 40, '#939b91'], [40, 80, '#b3b5a8']] as const;
    for (const [lo, hi, color] of beds) {
      const tint = new T.Color(color);
      for (let i = 0; i < outline.length; i++) {
        const a = outline[i], c = outline[(i + 1) % outline.length];
        const al = Math.min(a[1], basinSpecimenBedding(lo, a[0], a[2]));
        const cl = Math.min(c[1], basinSpecimenBedding(lo, c[0], c[2]));
        const ah = Math.min(a[1], basinSpecimenBedding(hi, a[0], a[2]));
        const ch = Math.min(c[1], basinSpecimenBedding(hi, c[0], c[2]));
        for (const at of [[a[0], al, a[2]], [c[0], cl, c[2]], [c[0], ch, c[2]], [a[0], al, a[2]], [c[0], ch, c[2]], [a[0], ah, a[2]]] as Point[]) {
          wallVertices.push(...p(at));
          const variation = 1 + .018 * Math.sin(at[0] * .49 + at[2] * .27);
          wallColors.push(tint.r * variation, tint.g * variation, tint.b * variation);
        }
      }
    }
    const wallGeometry = geometry(wallVertices);
    wallGeometry.setAttribute('color', new T.Float32BufferAttribute(wallColors, 3));
    const wall = mount(wallGeometry, '#fffefd', 'rock', 'basin-specimen-cut-stratum', parent);
    wall.material.vertexColors = true; wall.material.needsUpdate = true;
    if (!wall.material.userData.earthScan) applyEarthScan(wall.material, 'outcrop', 13 * s);
    wall.userData.diagrammaticBedding = true; sectionMeshes.push(wall);
    // A real closed bottom connects every cut wall. Visible front pieces are
    // movable solids, rather than a top sheet suspended over empty space.
    const bottomVertices: number[] = [], bottomIndices: number[] = [];
    for (const at of outline) bottomVertices.push(...p([at[0], -4, at[2]]));
    const center: Point = [outline.reduce((n, at) => n + at[0], 0) / outline.length, -4, outline.reduce((n, at) => n + at[2], 0) / outline.length];
    bottomVertices.push(...p(center));
    for (let i = 0; i < outline.length; i++) bottomIndices.push(outline.length, i, (i + 1) % outline.length);
    sectionMeshes.push(mount(geometry(bottomVertices, bottomIndices), '#807e72', 'rock', 'basin-specimen-bottom', parent));
    // A fitted underside follows the specimen's outline. The original long
    // rectangular cradle left half the rock apparently cantilevered in air.
    const cradle: number[] = [];
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i], c = outline[(i + 1) % outline.length];
      for (const at of [[a[0], -5.45, a[2]], [c[0], -5.45, c[2]], [c[0], -4.01, c[2]],
        [a[0], -5.45, a[2]], [c[0], -4.01, c[2]], [a[0], -4.01, a[2]]] as Point[]) cradle.push(...p(at));
    }
    const backing = mount(geometry(cradle), '#354c46', 'enamel', 'basin-fitted-specimen-shoe', parent);
    backing.userData.followsSpecimenFootprint = true; sectionMeshes.push(backing);
    for (const mesh of sectionMeshes) mesh.userData.scientificWaterCorridorPreserved = true;
    return { surface, meshes: sectionMeshes };
  };
  const rear = makeSection(4, 99, 'back'), bed = makeSection(4, 99, 'bed');
  rear.surface.userData.modelInput = { kind: 'inspect', target: 'upper', label: '观察山地与上游水路' };
  bed.surface.userData.modelInput = { kind: 'inspect', target: 'bend', label: '观察连续河床与河曲' };
  for (let i = 0; i < 3; i++) {
    const group = new T.Group(); group.name = `foreland-specimen-${i}`; b.root.add(group); groups.push(group);
    const section = makeSection(LIMITS[i], LIMITS[i + 1], 'front', group); movingMeshes.push(...section.meshes);
    section.meshes.forEach(mesh => {
      mesh.userData.specimenSlice = i;
      mesh.userData.modelInput = { kind: 'inspect', target: 'specimen-closed', toggleTo: 'specimen-open', label: '开合前坡标本切片；仅改变观察方式' };
      mesh.userData.interactionFeedback = false;
    });
    const local = createInstrumentParts(b, group), x0 = LIMITS[i] + 2.2, x1 = LIMITS[i + 1] - 2.2;
    // Two rails and real bearing shoes carry each slab. There is no separate
    // ornamental table: the narrow cradle is exactly as wide as its specimen.
    local.plate(p([x0, -5.6, 48]), p([x1, -4.05, 60.5]), 'steel');
    local.plate(p([x0 + .8, -4.05, 49]), p([x1 - .8, -3.8, 59.5]), 'brass');
    const [drop, travel] = BLADES[i], axis = new T.Vector3(0, -drop, travel).normalize().toArray() as Vec3;
    for (const x of [x0 + 2, x1 - 2]) {
      const start = p([x, -7, 53]), end = p([x, -7 - drop, 53 + travel]);
      const rail = parts.shaft(start, end, .42 * s, 'steel'); rail.userData.integratedRole = 'basin-drawer-guide';
      const shoe = local.bearing(p([x, -7, 53]), axis, .9 * s, 3.3 * s);
      shoe.traverse((mesh: any) => { if (mesh.isMesh) mesh.userData.integratedRole = 'basin-moving-guide-shoe'; });
      const saddle = local.plate(p([x - .95, -6.65, 51.3]), p([x + .95, -5.6, 54.7]), 'steel');
      saddle.userData.integratedRole = 'basin-bearing-to-carrier-saddle';
      parts.bearing(start, axis, 1.1 * s, 2.3 * s); parts.bearing(end, axis, 1.1 * s, 2.3 * s);
      parts.plate(p([x - 1.6, -9.5 - drop, 51.5 + travel]), p([x + 1.6, -8 - drop, 54.5 + travel]), 'steel');
    }
    local.fasteners([p([x0 + .7, -3.72, 49.8]), p([x1 - .7, -3.72, 49.8]), p([x0 + .7, -3.72, 58.7]), p([x1 - .7, -3.72, 58.7])], [0, 1, 0], .35 * s);
    const tip = (x0 + x1) / 2;
    const control = local.knob(p([tip, -4.5, 62.4]), [0, 0, 1], 1.7 * s, 1.1 * s);
    control.traverse((mesh: any) => {
      if (mesh.isMesh) {
        mesh.userData.integratedRole = 'basin-specimen-grip'; mesh.userData.specimenSlice = i;
        mesh.userData.modelInput = { kind: 'inspect', target: 'specimen-closed', toggleTo: 'specimen-open', label: '合拢或展开地形标本；水沙进度保持不变' };
      }
    });
    // A metal spine mechanically connects the moving slice to its datum.
    const piston = mount(new T.CylinderGeometry(.26 * s, .26 * s, 1, 16), '#879493', 'steel', 'basin-telescopic-slide');
    slides.push({ piston, from: new T.Vector3(...p([tip, -7, 53])), index: i });
    // Each copse shares one mesh and moves with its own sample carriage.
    const copseVertices: number[] = [], copseIndices: number[] = [], copseTint: number[] = [];
    const needle = new T.Color('#41593d'), tips = new T.Color('#809065');
    for (let tree = 0; tree < 15; tree++) {
      const seed = i * 15 + tree, spread = Math.sqrt((tree % 8) / 8);
      const angle = tree * 2.4 + i, x = (tree < 8 ? x0+6 : x1-7) + spread * 4 * Math.cos(angle);
      const z = (tree < 8 ? 55 : 50) + spread * 3 * Math.sin(angle);
      const h = 1.4 + .75 * (1 + Math.sin(seed*2.71));
      const ground = basinSpecimenGround(x,z), crown = buildCrownSurface('conifer', seed);
      const start = copseVertices.length / 3;
      for(let k=0;k<crown.positions.length;k+=3) {
        const [dx,dy,dz] = crown.positions.slice(k,k+3);
        copseVertices.push(...p([x+dx*h*.34, ground+(dy+.64)*h, z+dz*h*.34]));
        const color = needle.clone().lerp(tips,.28+.18*dy+.10*Math.sin(seed+dy*25+dx));
        copseTint.push(color.r,color.g,color.b);
      }
      for(const index of crown.indices)copseIndices.push(start+index);
    }
    const groveGeometry=geometry(copseVertices,copseIndices);
    groveGeometry.setAttribute('color',new T.Float32BufferAttribute(copseTint,3));
    const grove=mount(groveGeometry,'#fffffc','plant','specimen-slope-grove',group);
    grove.material.vertexColors=true;
  }
  // Independent specimen actuator, not a scientific input or a time control.
  const handwheel = parts.knob(p([104, -4, 70]), [0, 0, 1], 2.3 * s, 1.4 * s);
  const wheelAxis = new T.Group(); wheelAxis.position.set(...p([104, -4, 70])); b.root.add(wheelAxis);
  wheelAxis.add(handwheel); handwheel.position.copy(wheelAxis.position).multiplyScalar(-1);
  parts.plate(p([100, -7, 68]), p([108, -5.8, 72]), 'steel');
  parts.etchedScale(p([6, -4, 65]), p([29, -4, 65]), { ticks: 13, majorEvery: 3, width: 1.8 * s });
  const handMeshes: any[] = [];
  handwheel.traverse((mesh: any) => { if (mesh.isMesh) { handMeshes.push(mesh); mesh.userData.integratedRole = 'basin-section-handwheel'; } });
  let shown = 1, target = 1;
  const setTarget = (inspection: string) => { target = inspection === 'specimen-closed' ? 0 : 1; };
  const update = (inspection: string, dt: number, reduced: boolean) => {
    setTarget(inspection); shown = reduced ? target : shown + (target - shown) * (1 - Math.exp(-Math.max(0, Math.min(.1, dt || 1 / 60)) * 7));
    if (Math.abs(shown - target) < .0004) shown = target;
    for (let i = 0; i < groups.length; i++) groups[i].position.set(0, -BLADES[i][0] * shown * s, BLADES[i][1] * shown * s);
    for (const { piston, from, index } of slides) {
      const to = from.clone().add(new T.Vector3(0, -BLADES[index][0] * shown * s, BLADES[index][1] * shown * s + .3 * s));
      const delta = to.clone().sub(from); piston.position.copy(from).add(to).multiplyScalar(.5);
      piston.quaternion.setFromUnitVectors(unitY, delta.clone().normalize()); piston.scale.y = Math.max(.01, delta.length());
    }
    wheelAxis.rotation.z = -shown * Math.PI * 1.7;
    for (const mesh of handMeshes) mesh.userData.modelInput = { kind: 'inspect', target: target > .5 ? 'specimen-closed' : 'specimen-open', label: target > .5 ? '合拢地形标本' : '展开地形标本，观察河床与地下支路' };
    for (const mesh of movingMeshes) mesh.userData.observationOnlyDisplacement = true;
  };
  update('overview', 0, true);
  return {
    update,
    describe: () => ({ sectionOpening: shown, sectionTarget: target, terrainSpecimenSlices: 3,
      specimenOffsets: groups.map(group => group.position.toArray()),
      specimenMotionIsObservationOnly: true, waterCorridorHeightUnchanged: true,
      dryShoulderSculpted: true, diagrammaticBedding: true,
      sectionExplanation: '前坡为可移动的地形标本切片，沿导轨展开以观察原河床与地下支路；开合不表示真实山体、水路或地貌发生位移。' }),
  };
}

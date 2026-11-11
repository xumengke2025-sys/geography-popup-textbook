import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint, type PhaseTrack } from './textbook-model-input';
import { chamferedPlateGeometry, mergeInstrumentGeometry, turnedShaftGeometry } from './textbook-instrument-parts';
import type { SolidMaterialRole } from './textbook-solid-materials';
import { evaluateSolarHeating, solarHeatingSlab,
  SOLAR_HEATING_REFERENCE, SOLAR_HEATING_STOPS, SOLAR_HEATING_LAYOUT as L,
  SOLAR_HEATING_BOXES, SOLAR_HEATING_ROOFS, SOLAR_HEATING_COLLECTOR,
  SOLAR_HEATING_WATER_PATHS, SOLAR_HEATING_LABELS, SOLAR_HEATING_TARGETS,
  type SolarPoint, type SolarMeshData } from './textbook-solar-heating-model';

/** Fig.1.14 becomes one raised cutaway, never a projected photograph.
 * The collector is a sloping thermal plate with an actual water coil. Tank,
 * pump, room branches and return pipe remain in the same house throughout.
 * Radiation diamonds and pre-existing water spheres are separate objects. */
export function buildSolarHeatingWorld(b: TextbookGeometry): ModelMotion {
  const scale = b.width / 100, back = -LIFT_MARGIN - 72 * scale, rise = 33 * scale;
  const p = ([x, y, z]: SolarPoint): Vec3 => [x * scale, y * scale, back + z * scale];
  b.root.position.set(0, rise, -8 * scale);
  const role = (mesh: any, value: string) => { mesh.userData.solarHeatingRole = value; return mesh; };
  const select = (mesh: any, selection: number) => {
    mesh.userData.modelInput = { kind: 'select', selection, label: `查看${SOLAR_HEATING_STOPS[selection].label}` };
    mesh.userData.solarHeatingSelection = selection; return mesh;
  };
  const materials = new Map<string, any>();
  const paper = (color: string, hatch = .075, own = false, materialRole?: Exclude<SolidMaterialRole, 'paper'>) => {
    const key = `${materialRole}:${color}:${hatch}`;
    if (!own && materials.has(key)) return materials.get(key);
    const material = createSpecimenMaterial(b.pop, { color, role: materialRole, ink: '#6d7565', hatch, shade: .08, spacing: 2.9, seed: 347 + materials.size });
    material.side = T.DoubleSide;
    if (!own) materials.set(key, material); return material;
  };
  const solid = (geometry: any, color: string, name: string, own = false, hatch = .075, materialRole?: Exclude<SolidMaterialRole, 'paper'>) => {
    const mesh = role(b.mesh(geometry, color, false, true, materialRole), name); mesh.material = paper(color, hatch, own, materialRole); return mesh;
  };
  const dataGeometry = (data: SolarMeshData) => {
    const positions: number[] = [];
    for (let i = 0; i < data.positions.length; i += 3) positions.push(...p(data.positions.slice(i, i + 3) as SolarPoint));
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setIndex(data.indices); geometry.computeVertexNormals(); return geometry;
  };
  const centeredGeometry = (geometry: any, at: SolarPoint) => { geometry.scale(scale, scale, scale); geometry.translate(...p(at)); return geometry; };
  const meshData = (geometry: any): SolarMeshData => ({ positions: Array.from(geometry.attributes.position.array), indices: Array.from(geometry.index.array) });
  const merge = (entries: SolarMeshData[]): SolarMeshData => {
    const positions: number[] = [], indices: number[] = [];
    entries.forEach(data => { const offset = positions.length / 3; positions.push(...data.positions); indices.push(...data.indices.map(index => index + offset)); });
    return { positions, indices };
  };
  const color = (mesh: any, from: string, to: string, t: number) => mesh.material.color.copy(new T.Color(from).lerp(new T.Color(to), t));

  // The model is an open architectural teaching cutaway. Its visible fittings
  // assemble the actual heat circuit; there are no decorative gears or gauges.
  // Small repeated fittings share geometry batches, as in the source machine.
  const brass = '#b59a62', steel = '#aab2af', enamel = '#30473f', ivory = '#e4decd';
  const fittings = new Map<string, { color: string; materialRole: Exclude<SolidMaterialRole, 'paper'>; geometries: any[] }>();
  const detail = (geometry: any, materialRole: Exclude<SolidMaterialRole, 'paper'>, tint: string) => {
    const key = materialRole + tint;
    if (!fittings.has(key)) fittings.set(key, { color: tint, materialRole, geometries: [] });
    fittings.get(key)!.geometries.push(geometry);
  };
  const plate = (a: SolarPoint, c: SolarPoint, materialRole: Exclude<SolidMaterialRole, 'paper'>, tint: string, bevel = .15) =>
    detail(chamferedPlateGeometry(a, c, bevel), materialRole, tint);
  const shaft = (a: SolarPoint, c: SolarPoint, radius: number, materialRole: Exclude<SolidMaterialRole, 'paper'>, tint: string, collar = false) =>
    detail(turnedShaftGeometry(a, c, collar ? [[radius * .86, 0], [radius, .12], [radius, .25], [radius * .78, .32],
      [radius * .78, .68], [radius, .75], [radius, .88], [radius * .86, 1]] : [[radius * .94, 0], [radius, .08], [radius, .92], [radius * .94, 1]]), materialRole, tint);
  const torus = (at: SolarPoint, radius: number, thickness: number, materialRole: Exclude<SolidMaterialRole, 'paper'>, tint: string, front = false) => {
    const geometry = new T.TorusGeometry(radius, thickness, 8, 48);
    if (!front) geometry.rotateX(Math.PI / 2);
    geometry.translate(...at); detail(geometry, materialRole, tint);
  };
  const screw = (at: SolarPoint, front = false) => {
    const [x, y, z] = at;
    shaft(front ? [x, y, z - .13] : [x, y - .13, z], front ? [x, y, z + .13] : [x, y + .13, z], .28, 'brass', brass);
    if (front) plate([x - .17, y - .035, z + .14], [x + .17, y + .035, z + .155], 'enamel', enamel, 0);
    else plate([x - .17, y + .14, z - .035], [x + .17, y + .155, z + .035], 'enamel', enamel, 0);
  };

  const parts = SOLAR_HEATING_BOXES.map(part => {
    const [x, y, z] = part.center, [w, h, d] = part.size;
    const geometry = chamferedPlateGeometry([x - w / 2, y - h / 2, z - d / 2], [x + w / 2, y + h / 2, z + d / 2], .16);
    const tint = part.id === 'foundation' ? '#65513c' : part.id.includes('radiator') ? '#bdc5bd'
      : part.id.includes('floor') ? '#c8bda4' : ivory;
    const mesh = solid(centeredGeometry(geometry, [0, 0, 0]), tint, part.id, Boolean(part.warmth), .02,
      part.id === 'foundation' ? 'wood' : part.id.includes('radiator') ? 'enamel' : 'ivory');
    // A pierced back wall replaces the solid block. Window openings remain
    // on the unoccupied service side, clear of both room heat receivers.
    if (part.id === 'back-wall') mesh.visible = false;
    if (part.selection !== undefined) select(mesh, part.selection); return { definition: part, mesh };
  });
  // The back is a plaster shell with two actual apertures, not a painted
  // rectangle. The section edge and eaves expose their physical thickness.
  for (const [x0, x1, y0, y1] of [[23, 29, 4.5, 51.5], [47, 97, 4.5, 51.5], [29, 47, 4.5, 9],
    [29, 47, 21, 32], [29, 47, 44, 51.5]]) plate([x0, y0, 18], [x1, y1, 19.4], 'ivory', ivory);
  for (const [low, high] of [[9, 21], [32, 44]]) {
    for (const x of [29, 47]) plate([x - .28, low - .4, 19.35], [x + .28, high + .4, 19.85], 'wood', '#65513c');
    for (const y of [low, high]) plate([28.7, y - .3, 19.35], [47.3, y + .3, 19.85], 'wood', '#65513c');
    plate([37.8, low, 19.45], [38.2, high, 19.75], 'steel', steel, .05);
    plate([29, (low + high) / 2 - .18, 19.45], [47, (low + high) / 2 + .18, 19.75], 'steel', steel, .05);
    plate([28.2, low - .65, 18.9], [47.8, low - .25, 20.7], 'ivory', '#cec7b2');
  }
  SOLAR_HEATING_ROOFS.forEach((quad, index) => solid(dataGeometry(solarHeatingSlab(quad, .85)), '#56655e', `closed-roof-${index}`, false, .02, 'enamel'));
  const collector = select(solid(dataGeometry(solarHeatingSlab(SOLAR_HEATING_COLLECTOR, .7)), '#354c49', 'thermal-collector', true, .02, 'enamel'), 1);
  // A narrow cast frame, saddle clips and copper serpentine identify thermal
  // collection. No photovoltaic grid is introduced on the absorber plate.
  SOLAR_HEATING_COLLECTOR.forEach((from, i) => {
    const to = SOLAR_HEATING_COLLECTOR[(i + 1) % 4];
    shaft([from[0], from[1] + .34, from[2]], [to[0], to[1] + .34, to[2]], .38, 'steel', steel);
    screw([from[0], from[1] + .68, from[2]]);
  });
  // The exposed section has a continuous sill, two end posts, floor ledgers
  // and rafters. These carry the roof; pipes are not used as structural posts.
  for (const x of [23, 96]) {
    plate([x - .48, 4, 48.5], [x + .48, 51.4, 49.5], 'enamel', enamel, .12);
    for (const y of [4.4, 25.4, 50.4]) plate([x - .85, y, 48.1], [x + .85, y + .8, 49.9], 'brass', brass);
  }
  for (const y of [4.3, 25.1, 50.2]) plate([22.5, y, 48.4], [96.5, y + .65, 49.5], 'enamel', enamel, .12);
  for (const z of [17.4, 49.4]) for (const end of [[21, 51, z], [99, 51, z]] as SolarPoint[])
    shaft(end, [60, 68, z], .55, 'enamel', enamel);
  shaft([60, 68.1, 17], [60, 68.1, 50], .65, 'steel', steel);
  // Roof seams run down the untouched slope; they stop short of the ridge.
  for (const z of [22, 30, 38, 46]) shaft([61, 67.66, z], [98, 51.53, z], .10, 'steel', '#85918b');
  for (const x of [24, 95]) for (const z of [19, 47]) {
    shaft([x, -1.1, z], [x, .1, z], 1.15, 'enamel', enamel, true);
    screw([x, 4.15, z]);
  }

  // Deduplicate shared supply and return segments. Closed cylinders make the
  // network real solid geometry without Catmull-Rom corner overshoot.
  const pipeBuckets = new Map<string, { color: string; selection: number; data: SolarMeshData[] }>();
  const seenSegments = new Set<string>();
  SOLAR_HEATING_WATER_PATHS.forEach(path => path.points.slice(1).forEach((to, index) => {
    const from = path.points[index], segmentKey = [from.join(','), to.join(',')].sort().join('|');
    if (seenSegments.has(segmentKey)) return; seenSegments.add(segmentKey);
    const inCollector = path.id === 'collection' && index >= 3 && index < 12;
    const inRadiator = path.id !== 'collection' && from[0] >= 77 && from[0] <= 87 && to[0] >= 77 && to[0] <= 87;
    const selection = inCollector ? 1 : inRadiator ? 3 : 2;
    const tint = inCollector ? '#b79561' : path.id === 'collection'
      ? index < 3 || index >= 15 ? '#a4b4b2' : '#b58c65' : index < path.supplyEnd ? '#b58c65' : '#a4b4b2';
    const key = `${selection}:${tint}`;
    const entry = pipeBuckets.get(key) ?? { color: tint, selection, data: [] };
    const a = new T.Vector3(...from), c = new T.Vector3(...to), direction = c.clone().sub(a);
    const geometry = new T.CylinderGeometry(.48, .48, direction.length(), 16, 1, false);
    geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize()));
    geometry.translate(...a.add(c).multiplyScalar(.5).toArray()); entry.data.push(meshData(geometry)); geometry.dispose();
    pipeBuckets.set(key, entry);
  }));
  const pipeMeshes = [...pipeBuckets.values()].map(entry => select(solid(dataGeometry(merge(entry.data)), entry.color,
    entry.selection === 1 ? 'collector-water-coil' : entry.selection === 3 ? 'room-radiator-coil' : 'supply-return-pipes', false, .02, 'steel'), entry.selection));
  // Rounded junctions close straight pipe ends without changing the analytic
  // route followed by a water tracer. Unions occur at equipment connections.
  const seenCorners = new Set<string>();
  for (const path of SOLAR_HEATING_WATER_PATHS) for (const at of path.points) {
    const key = at.join(','); if (seenCorners.has(key)) continue; seenCorners.add(key);
    const elbow = new T.SphereGeometry(.49, 12, 8); elbow.translate(...at);
    detail(elbow, 'steel', at[0] < 54 && at[1] > 53 ? '#b79561' : steel);
  }
  for (const [a, c] of [[[23, 23, 52], [23, 25, 52]], [[53, 25, 52], [53, 27, 52]],
    [[68, 28, 52], [68, 30, 52]], [[91, 24, 52], [91, 26, 52]],
    [[38.7, 18, 52], [40.2, 18, 52]], [[45.8, 18, 52], [47.3, 18, 52]]] as [SolarPoint, SolarPoint][])
    shaft(a, c, .82, 'brass', brass, true);
  // Small stand-offs visibly fix the upright pipes to the cutaway ledgers.
  for (const x of [23, 53, 68, 91]) for (const y of [7, 25.7]) {
    shaft([x, y, 49], [x, y, 51.5], .23, 'steel', steel);
    torus([x, y, 52], .57, .13, 'brass', brass, true);
  }

  const tankProfile = [[0, -6.5], [2.9, -6.5], [3.8, -6.25], [4.35, -5.7], [4.5, -5.1],
    [4.5, 5.1], [4.35, 5.7], [3.8, 6.25], [2.9, 6.5], [0, 6.5]].map(([r, y]) => new T.Vector2(r, y));
  const tank = select(solid(centeredGeometry(new T.LatheGeometry(tankProfile, 40), L.tank.center),
    '#90a9a0', 'storage-tank', true, .02, 'enamel'), 2);
  for (const y of [7.4, 17.6]) torus([33, y, 48.2], 4.51, .20, 'brass', brass);
  for (const x of [30.2, 35.8]) {
    shaft([x, 4, 48.2], [x, 6.5, 48.2], .65, 'enamel', enamel, true);
    plate([x - 1, 4, 47.1], [x + 1, 4.4, 49.3], 'brass', brass);
  }
  // Separate open face, impeller shaft and mounting neck make this a pump,
  // rather than a coloured disc suspended in the water pipe.
  const pump = select(solid(centeredGeometry(new T.CylinderGeometry(2.55, 2.55, 2.1, 36).rotateX(Math.PI / 2), [43, 18, 51.8]),
    enamel, 'water-pump', false, .02, 'enamel'), 2);
  torus([43, 18, 53.35], 2.35, .36, 'brass', brass, true);
  shaft([43, 18, 52.4], [43, 18, 53.9], .47, 'steel', steel, true);
  plate([41.5, 4, 48], [44.5, 4.65, 52.5], 'enamel', enamel, .25);
  plate([42.4, 4.6, 50.2], [43.6, 15.8, 51.2], 'enamel', enamel, .25);
  for (const a of [Math.PI / 4, Math.PI * 3 / 4, Math.PI * 5 / 4, Math.PI * 7 / 4])
    screw([43 + 2.32 * Math.cos(a), 18 + 2.32 * Math.sin(a), 53.63], true);
  const blades: SolarMeshData[] = [];
  for (let i = 0; i < 3; i++) {
    const g = new T.BoxGeometry(3.3, .45, .36); g.translate(.8, 0, 0); g.rotateZ(i / 3 * Math.PI * 2); blades.push(meshData(g)); g.dispose();
  }
  const rotorData = merge(blades), rotorGeometry = new T.BufferGeometry();
  rotorGeometry.setAttribute('position', new T.Float32BufferAttribute(rotorData.positions.map(n => n * scale), 3));
  rotorGeometry.setIndex(rotorData.indices); rotorGeometry.computeVertexNormals();
  const rotor = select(solid(rotorGeometry, brass, 'pump-impeller', false, .02, 'brass'), 2); rotor.position.set(...p([43, 18, 53.5]));

  // Thin radiator fins give the receiver a readable physical surface, with
  // the source serpentine still exposed on its front and two wall brackets.
  const receiverFins = [14, 36.5].map((middle, index) => {
    const geometry = mergeInstrumentGeometry(Array.from({ length: 8 }, (_, i) => chamferedPlateGeometry(
      [76.6 + i * 1.5, middle - 4.15, 49.55], [77.3 + i * 1.5, middle + 4.15, 51.1], .22)));
    const mesh = select(solid(centeredGeometry(geometry, [0, 0, 0]), '#e4e2d4', 'receiver-fins', true, .02, 'ivory'), 3);
    mesh.userData.receiverRoom = index === 0 ? 'lower' : 'upper';
    for (const x of [78, 86]) shaft([x, middle - 3, 48.5], [x, middle - 3, 49.8], .3, 'steel', steel);
    return mesh;
  });

  const sun = select(solid(centeredGeometry(new T.SphereGeometry(L.sunRadius, 28, 18), L.sun), '#d8c17d', 'solar-source', false, .02, 'brass'), 0);
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * Math.PI * 2;
    b.stroke([p([L.sun[0] + 5.2 * Math.cos(angle), L.sun[1] + 5.2 * Math.sin(angle), L.sun[2]]),
      p([L.sun[0] + 6.8 * Math.cos(angle), L.sun[1] + 6.8 * Math.sin(angle), L.sun[2]])], .28);
  }
  let state = evaluateSolarHeating(0), previous = -1;
  const lightGeometry = new T.OctahedronGeometry(.95 * scale, 0);
  const rayMarks = state.rays.map(ray => {
    const mark = select(solid(lightGeometry, '#b99a60', 'shortwave-mark', false, .02), 0);
    mark.userData.solarRadiationId = ray.id; mark.userData.medium = 'radiation'; return mark;
  });
  const waterGeometry = new T.SphereGeometry(1.14 * scale, 12, 8);
  const waterMarks = state.water.map(mark => {
    const mesh = solid(waterGeometry, '#527f95', 'persistent-water-mark', true, .025);
    mesh.userData.solarWaterId = mark.id; mesh.userData.medium = 'water'; mesh.raycast = () => {}; return mesh;
  });
  // The active legend is a single inset in the actual front apron, never a
  // floating board across the room or in front of the collector.
  plate([22, -4, 49.6], [97, 3.9, 50.8], 'wood', '#65513c', .35);
  const plaqueAt: SolarPoint = [62, -.2, 50.94];
  const labels = SOLAR_HEATING_LABELS.map(label => {
    const mesh = select(role(b.label(label.text, p(plaqueAt), 27 * scale, 6.1 * scale), 'process-label'), label.selection);
    mesh.userData.labelMount = 'surface'; return mesh;
  });
  for (const x of [47.4, 76.6]) screw([x, -.2, 51.05], true);
  const track: PhaseTrack = { start: p(L.trackStart), end: p(L.trackEnd) };
  const rail = solid(centeredGeometry(chamferedPlateGeometry([11, -13, 65], [93, -9, 65.75], .22), [0, 0, 0]), ivory, 'phase-rail', false, .02, 'ivory');
  rail.userData.modelInput = { kind: 'phase-track', track, label: '拖动太阳能供热过程滑座' };
  // The reader-facing observation rail is cantilevered from the sill, with
  // two steel guide rods and end stops. Its rider is the actual phase input.
  for (const x of [25, 89]) {
    shaft([x, -2.7, 49.7], [x, -11, 65.2], .52, 'enamel', enamel);
    plate([x - 1.2, -12.2, 64.2], [x + 1.2, -9.8, 65.2], 'brass', brass, .2);
  }
  for (const y of [-12.4, -9.6]) shaft([12, y, 66], [92, y, 66], .18, 'steel', steel);
  for (const x of [12, 92]) shaft([x, -13.7, 66], [x, -8.3, 66], .48, 'brass', brass, true);
  for (let i = 0; i <= 20; i++) plate([12 + i * 4 - .05, -12, 65.78],
    [12 + i * 4 + .05, i % 5 === 0 ? -10.1 : -11, 65.83], 'enamel', enamel, 0);
  const tabGeometry = chamferedPlateGeometry([-1.45 * scale, -2.15 * scale, -.4 * scale], [1.45 * scale, 2.15 * scale, .55 * scale], .2 * scale);
  const handle = solid(tabGeometry, brass, 'phase-handle', false, .02, 'brass');
  handle.userData.smallPointTarget = true;
  handle.userData.modelInput = { kind: 'phase-track', track, label: '拖动滑座，分步查看光、集热、水路与供暖' };
  const thumb = solid(new T.CylinderGeometry(.72 * scale, .72 * scale, .8 * scale, 24).rotateX(Math.PI / 2), enamel, 'phase-thumb', false, .02, 'enamel');
  thumb.userData.smallPointTarget = true; thumb.userData.modelInput = handle.userData.modelInput;
  for (const entry of fittings.values()) solid(centeredGeometry(mergeInstrumentGeometry(entry.geometries), [0, 0, 0]),
    entry.color, 'connected-fittings-' + entry.materialRole, false, .02, entry.materialRole);
  const meshes = [...b.meshes], buffers = meshes.map(mesh => mesh.geometry.attributes.position.array), fixedMeshCount = meshes.length;

  const motion: ModelMotion = {
    update(phase) {
      const next = evaluateSolarHeating(phase);
      if (next.phase !== previous) {
        state = next; previous = next.phase;
        color(collector, '#354c49', '#9c7950', state.collectorWarmth);
        color(tank, '#90a9a0', '#b08c64', state.storageWarmth);
        for (const part of parts) if (part.definition.warmth) color(part.mesh, part.definition.color,
          part.definition.id.includes('radiator') ? '#b88862' : '#e1ceb0', state.roomWarmth[part.definition.warmth]);
        for (const fins of receiverFins) color(fins, '#e4e2d4', '#c39a6c', state.roomWarmth[fins.userData.receiverRoom as 'lower' | 'upper']);
        state.rays.forEach((ray, index) => { rayMarks[index].position.set(...p(ray.point)); rayMarks[index].scale.setScalar(ray.absorbed ? .48 : 1); });
        state.water.forEach((mark, index) => { waterMarks[index].position.set(...p(mark.point)); color(waterMarks[index], '#527f95', '#bd7954', mark.warmth); });
        labels.forEach((label, index) => { label.visible = index === state.selection; });
        rotor.rotation.z = -state.pumpTurning * 2.8;
        handle.position.set(...phaseTrackPoint(state.phase, track));
        thumb.position.copy(handle.position); thumb.position.z += 1.05 * scale;
      }
      for (const ray of state.rays) if (ray.progress > .001) b.accentStrokes.push({ points: [b.v(p(ray.source)), b.v(p(ray.point))], width: .62 });
      rayMarks.forEach(mesh => b.outline(mesh, .25));
      waterMarks.forEach((mesh, index) => b.outline(mesh, index === 0 ? .48 : .29));
      for (const mesh of [sun, collector, tank, pump, ...pipeMeshes]) if (mesh.userData.modelHovered) b.outline(mesh, .62);
      if (handle.userData.modelHovered || thumb.userData.modelHovered) b.outline(handle, .62);
    },
    focusBounds: () => ({ min: p(L.bounds.min), max: p(L.bounds.max) }),
    describe: () => {
      b.root.updateWorldMatrix(true, true);
      const world = (point: Vec3) => b.v(point).applyMatrix4(b.root.matrixWorld).toArray() as Vec3;
      const nodeWorld = SOLAR_HEATING_TARGETS.map(target => ({ ...target, point: world(p(target.at)), phase: SOLAR_HEATING_STOPS[target.selection].phase }));
      return { kind: 'solar-heating-process', ...state, reference: SOLAR_HEATING_REFERENCE,
        originalPagePreserved: true, elevatedAbovePage: rise, fixedMeshCount,
        geometryBuffersReused: b.meshes.length === fixedMeshCount && meshes.every((mesh, index) => mesh.geometry.attributes.position.array === buffers[index]),
        finiteWaterMarkers: true, waterMarkersRespawn: false, lightBecomesWater: false,
        nodeWorld, targetWorld: nodeWorld, keyWorldPositions: Object.fromEntries(nodeWorld.map(target => [target.id, target.point])),
        radiationWorld: state.rays.map(ray => ({ id: ray.id, point: world(p(ray.point)), absorbed: ray.absorbed })),
        waterWorld: state.water.map(mark => ({ id: mark.id, point: world(p(mark.point)), circuit: mark.circuit, returned: mark.returned })),
        labelWorld: state.labels.map(label => ({ text: label.text, point: world(p(plaqueAt)), width: 27 * scale, height: 6.1 * scale })),
        handleWorld: handle.getWorldPosition(new T.Vector3()).toArray(), phaseTrack: track,
        phaseTrackWorld: { start: world(track.start), end: world(track.end) },
        meshRoles: meshes.map(mesh => ({ role: mesh.userData.solarHeatingRole, selection: mesh.userData.solarHeatingSelection,
          medium: mesh.userData.medium, id: mesh.userData.solarWaterId ?? mesh.userData.solarRadiationId,
          world: new T.Box3().setFromObject(mesh).getCenter(new T.Vector3()).toArray() })),
        directInteraction: 'device-nodes-and-stable-phase-track', depictsPhotovoltaicElectricity: false,
        construction: 'open-architectural-thermal-cutaway', floatingProcessBoards: false,
        wallOpenings: 2, supportedPump: true, radiatorFinBanks: 2,
      };
    },
  };
  motion.update(0, 0, 0, true); return motion;
}

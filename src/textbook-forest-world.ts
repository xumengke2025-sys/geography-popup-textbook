import { THREE as T } from './reference/engine.js';
import { createSpecimenMaterial } from './textbook-solid-materials';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { buildForestInstrument } from './textbook-forest-instrument';
import { evaluateForest, forestPartMeshData, FOREST_LAYOUT, FOREST_PARTS, FOREST_PLANTS,
  FOREST_REFERENCE, FOREST_STOPS, type ForestPart, type ForestMeshData } from './textbook-forest-model';

/** One fixed forest specimen, held in an open vertical comparator. The
 * observation carriage moves; the forest never grows or disappears. */
export function buildForestWorld(b: TextbookGeometry): ModelMotion {
  const scale = b.width / 100, back = -LIFT_MARGIN - 72 * scale, rise = 33 * scale;
  const p = ([x, y, z]: readonly number[]): Vec3 => [x * scale, y * scale, back + z * scale];
  b.root.position.set(0, rise, -8 * scale);
  const solid = (geometry: any, color: string, value: string) => {
    const mesh = b.mesh(geometry, color, false);
    mesh.material = createSpecimenMaterial(b.pop, { color, role: value === 'plant-crowns' || value === 'plant-leaves' ? 'plant' : 'land' });
    mesh.userData.forestRole = value; return mesh;
  };
  const meshData = (data: ForestMeshData) => {
    const positions: number[] = [];
    for (let i = 0; i < data.positions.length; i += 3) positions.push(...p(data.positions.slice(i, i + 3)));
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setIndex(data.indices); geometry.computeVertexNormals(); return geometry;
  };
  const merge = (entries: ForestMeshData[]): ForestMeshData => {
    const positions: number[] = [], indices: number[] = [];
    for (const data of entries) {
      const offset = positions.length / 3;
      positions.push(...data.positions); indices.push(...data.indices.map(index => index + offset));
    }
    return { positions, indices };
  };

  // Eleven shared surfaces preserve the plant/part identities without one
  // draw call per leaf. Rounded lobes replace the old outlined sphere stacks.
  const buckets = new Map<string, ForestPart[]>();
  for (const part of FOREST_PARTS) {
    const key = `${part.layer}:${part.kind}:${part.color}`;
    const values = buckets.get(key) ?? []; values.push(part); buckets.set(key, values);
  }
  const plantMeshes = [...buckets.values()].map(parts => {
    // Lobes of one crown share a quiet substance colour. Three contrasting
    // paints on the old intersecting lobes read as stacked toy balls.
    const first = parts[0], color = first.kind === 'crown' ? first.layer === 0 ? '#7a8e64' : '#91a175' : first.color;
    const mesh = solid(meshData(merge(parts.map(forestPartMeshData))), color,
      first.kind === 'crown' ? 'plant-crowns' : first.kind === 'leaf' ? 'plant-leaves' : 'plant-stems');
    mesh.userData.forestLayer = first.layer;
    mesh.userData.modelInput = { kind: 'select', selection: first.layer, label: `观察${FOREST_STOPS[first.layer].label}` };
    mesh.userData.forestPlantIds = [...new Set(parts.map(part => part.plantId))];
    mesh.userData.forestPartIds = parts.map(part => part.id); return mesh;
  });

  // Continuous floor and thin cut edge seated in the specimen tray. The tiny
  // surface relief is authored, not a measured field elevation.
  const ground: ForestMeshData = { positions: [], indices: [] }, nx = 30, nz = 14;
  const height = (x: number, z: number) => 1.4 + .045 * Math.sin(x * .51) * Math.sin(z * .43);
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = 3 + i / nx * 81, z = 18 + j / nz * 39;
    ground.positions.push(x, height(x, z), z);
    if (i < nx && j < nz) { const a = j * (nx + 1) + i; ground.indices.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2); }
  }
  solid(meshData(ground), '#9c9d78', 'forest-floor');
  const edge: ForestMeshData = { positions: [], indices: [] }, perimeter: Vec3[] = [];
  for (let i = 0; i <= nx; i++) perimeter.push([3 + i / nx * 81, 0, 18]);
  for (let j = 1; j <= nz; j++) perimeter.push([84, 0, 18 + j / nz * 39]);
  for (let i = nx - 1; i >= 0; i--) perimeter.push([3 + i / nx * 81, 0, 57]);
  for (let j = nz - 1; j > 0; j--) perimeter.push([3, 0, 18 + j / nz * 39]);
  perimeter.forEach(([x, , z], i) => {
    const [xx, , zz] = perimeter[(i + 1) % perimeter.length], k = edge.positions.length / 3;
    edge.positions.push(x, .04, z, xx, .04, zz, xx, height(xx, zz), zz, x, height(x, z), z);
    edge.indices.push(k, k + 1, k + 2, k, k + 2, k + 3);
  });
  solid(meshData(edge), '#9b8464', 'soil-plinth');
  // Short root flares meet the same thin soil floor. They explain the actual
  // trunk/ground contact without making another plinth or a decorative frame.
  const rootData: ForestMeshData[] = [];
  for (const plant of FOREST_PLANTS.filter(v => v.layer === 0)) for (let j = 0; j < 4; j++) {
    const a = plant.seed + j * Math.PI / 2, start: Vec3 = [plant.x, 2.3, plant.z];
    const end: Vec3 = [plant.x + Math.cos(a) * 2.2, 1.4, plant.z + Math.sin(a) * 1.8];
    rootData.push(forestPartMeshData({ id: `${plant.id}-root-${j}`, plantId: plant.id, layer: 0,
      kind: 'rod', role: 'branch', color: '#806b51', start, end, radius: .45, topRadius: .065 }));
  }
  const roots = solid(meshData(merge(rootData)), '#806b51', 'specimen-root-contacts');
  roots.userData.rootContact = 'same-trunk-same-floor';
  const apparatus = buildForestInstrument(b, p, scale), area = FOREST_LAYOUT.observation;
  const sheetGeometry = new T.BoxGeometry((area.maxX - area.minX) * scale, .035 * scale, (area.maxZ - area.minZ) * scale);
  sheetGeometry.translate((area.minX + area.maxX) / 2 * scale, 0, back + (area.minZ + area.maxZ) / 2 * scale);
  const sheet = b.mesh(sheetGeometry, '#c6bc91', false);
  sheet.userData.forestRole = 'observation-plane';
  sheet.material = b.pop.paper({ color: '#c6bc91', hatch: 0, shade: .045, seed: 274 });
  sheet.material.transparent = true; sheet.material.depthWrite = false;
  const compileSheet = sheet.material.onBeforeCompile;
  sheet.material.onBeforeCompile = (shader: any, renderer: any) => {
    compileSheet.call(sheet.material, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('gl_FragColor.a = uSurfAlpha;', 'gl_FragColor.a = uSurfAlpha * opacity;');
  };
  sheet.material.customProgramCacheKey = () => 'forest-observation-sheet-opacity-v1';
  sheet.renderOrder = 3; sheet.raycast = () => {};
  sheet.castShadow = sheet.receiveShadow = false; sheet.userData.castShadow = false;

  for (let i = 0; i < 10; i++) {
    const x = 9 + i * 7.1, z = 49 + i % 3 * 2.3;
    b.stroke([[x - .9, 1.46, z], [x, 1.49, z + .6], [x + 1.2, 1.46, z - .3]].map(p), .14);
  }
  const liveMeshes = [...b.meshes], buffers = liveMeshes.map(mesh => mesh.geometry.attributes.position.array);
  const fixedMeshCount = liveMeshes.length;
  let state = evaluateForest(0);
  const motion: ModelMotion = {
    update(phase) {
      state = evaluateForest(phase); apparatus.update(state.observationHeight, state.selection);
      sheet.position.y = state.observationHeight * scale;
      sheet.material.opacity = Math.fround(.012 + state.relativeLight * .018);
      apparatus.handle.userData.forestRelativeLight = state.relativeLight;
    },
    focusBounds: () => ({ min: [-3 * scale, -3 * scale, back + 13 * scale], max: [117 * scale, 55 * scale, back + 69 * scale] }),
    describe: () => {
      b.root.updateWorldMatrix(true, true);
      const world = (point: Vec3): Vec3 => b.v(point).applyMatrix4(b.root.matrixWorld).toArray() as Vec3;
      return { kind: 'forest-strata-observation', source: FOREST_REFERENCE,
        phase: state.phase, stage: state.stage, stageIndex: state.stageIndex, caption: state.caption,
        selection: state.selection, selectedLayer: state.selectedLayer, activeStop: state.activeStop,
        observationHeight: state.observationHeight, relativeLight: state.relativeLight, lightLabel: state.lightLabel,
        phaseMeaning: state.phaseMeaning, phaseMeansElapsedTime: false, depictsGrowth: false, depictsSuccession: false,
        heightsAreMeasured: false, lightIsMeasured: false, allLayersRetained: true, plantStructuresAreStatic: true,
        plants: FOREST_PLANTS, plantCount: FOREST_PLANTS.length, partCount: FOREST_PARTS.length,
        layers: 3, layerPlantCounts: FOREST_STOPS.map((_, layer) => FOREST_PLANTS.filter(plant => plant.layer === layer).length),
        solidPlantMeshes: plantMeshes.length, allPlantMeshesVisible: plantMeshes.every(mesh => mesh.visible),
        fixedMeshCount, geometryBuffersReused: liveMeshes.every((mesh, i) => mesh.geometry.attributes.position.array === buffers[i]),
        nodeStops: FOREST_STOPS,
        nodeWorld: FOREST_LAYOUT.labels.map((point, selection) => ({ selection, point: world(p(point)) })),
        probeWorld: world(p(state.probe)), handleWorld: apparatus.handle.getWorldPosition(new T.Vector3()).toArray(),
        phaseTrackWorld: { start: world(p(FOREST_LAYOUT.track.start)), end: world(p(FOREST_LAYOUT.track.end)) },
        observationPlaneWorld: { min: world(p([area.minX, state.observationHeight, area.minZ])),
          max: world(p([area.maxX, state.observationHeight, area.maxZ])) },
        instrumentConstruction: apparatus.diagnostics(),
        directInteraction: 'plant-and-layer-select-and-vertical-phase-track',
        elevatedAbovePage: rise, originalPagePreserved: true,
      };
    },
  };
  motion.update(0, 0, 0, true); return motion;
}
